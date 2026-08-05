-- Server-side safety and collaboration controls for the internal dashboard pilot.

alter table public.news_items
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.team_members(user_id),
  add column if not exists last_edited_by uuid references public.team_members(user_id),
  add column if not exists version bigint not null default 1,
  add column if not exists editorial_run_id uuid,
  add column if not exists editorial_lease_owner text,
  add column if not exists editorial_lease_expires_at timestamptz;

alter table public.theses
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.team_members(user_id),
  add column if not exists updated_by uuid references public.team_members(user_id),
  add column if not exists version bigint not null default 1;

alter table public.topics
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.team_members(user_id),
  add column if not exists version bigint not null default 1;

alter table public.topic_news
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.team_members(user_id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists version bigint not null default 1;

create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  actor_id uuid references public.team_members(user_id) on delete set null,
  occurred_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.legacy_migrations (
  migration_key text primary key,
  completed_at timestamptz not null default now(),
  completed_by uuid references public.team_members(user_id),
  imported_news integer not null default 0,
  imported_topics integer not null default 0,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.editorial_job_runs (
  id uuid primary key default gen_random_uuid(),
  external_run_id text unique,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'abandoned')),
  lease_owner text,
  lease_expires_at timestamptz,
  claimed_count integer not null default 0,
  processed_count integer not null default 0,
  readout_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.news_items
  drop constraint if exists news_items_editorial_run_id_fkey;
alter table public.news_items
  add constraint news_items_editorial_run_id_fkey
  foreign key (editorial_run_id) references public.editorial_job_runs(id)
  on delete set null;

alter table public.activity_events enable row level security;
alter table public.legacy_migrations enable row level security;
alter table public.editorial_job_runs enable row level security;

create or replace function private.current_team_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tm.role
  from public.team_members tm
  where tm.user_id = auth.uid()
$$;

revoke all on function private.current_team_role() from public;
grant execute on function private.current_team_role() to authenticated;

create or replace function private.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    hashtext('team_members_admin_invariant')
  );
  if old.role = 'admin'
    and (tg_op = 'DELETE' or new.role <> 'admin')
    and (select count(*) from public.team_members where role = 'admin') <= 1
  then
    raise exception 'the workspace must retain at least one admin'
      using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger team_members_retain_admin
before update of role or delete on public.team_members
for each row execute function private.prevent_last_admin_removal();

create or replace function private.bump_content_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create or replace function private.enforce_soft_delete_boundary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.deleted_at is null
    and new.deleted_at is not null
    and auth.uid() is not null
    and private.current_team_role() <> 'admin'
  then
    raise exception 'only admins can remove content'
      using errcode = '42501';
  end if;

  if old.deleted_at is not null
    and new.deleted_at is null
    and auth.uid() is not null
    and private.current_team_role() <> 'admin'
  then
    raise exception 'only admins can restore deleted content'
      using errcode = '42501';
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
  elsif old.deleted_at is not null and new.deleted_at is null then
    new.deleted_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists news_items_touch_updated_at on public.news_items;
drop trigger if exists theses_touch_updated_at on public.theses;
drop trigger if exists topics_touch_updated_at on public.topics;

create trigger news_items_enforce_soft_delete_boundary
before update on public.news_items
for each row execute function private.enforce_soft_delete_boundary();
create trigger theses_enforce_soft_delete_boundary
before update on public.theses
for each row execute function private.enforce_soft_delete_boundary();
create trigger topics_enforce_soft_delete_boundary
before update on public.topics
for each row execute function private.enforce_soft_delete_boundary();
create trigger topic_news_enforce_soft_delete_boundary
before update on public.topic_news
for each row execute function private.enforce_soft_delete_boundary();

create trigger news_items_bump_content_version
before update on public.news_items
for each row execute function private.bump_content_version();
create trigger theses_bump_content_version
before update on public.theses
for each row execute function private.bump_content_version();
create trigger topics_bump_content_version
before update on public.topics
for each row execute function private.bump_content_version();
create trigger topic_news_bump_content_version
before update on public.topic_news
for each row execute function private.bump_content_version();

create or replace function private.activity_actor_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  configured_actor text;
begin
  configured_actor := current_setting('app.actor_id', true);
  return coalesce(auth.uid(), nullif(configured_actor, '')::uuid);
exception when invalid_text_representation then
  return auth.uid();
end;
$$;

create or replace function private.audit_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_json jsonb;
  new_json jsonb;
  row_json jsonb;
  entity_key text;
  event_action text := lower(tg_op);
  event_actor uuid;
  event_metadata jsonb := '{}'::jsonb;
begin
  old_json := case
    when tg_op = 'INSERT' then null
    else to_jsonb(old) - 'raw_text'
  end;
  new_json := case
    when tg_op = 'DELETE' then null
    else to_jsonb(new) - 'raw_text'
  end;
  row_json := coalesce(new_json, old_json);
  entity_key := coalesce(
    row_json ->> 'id',
    row_json ->> 'user_id',
    concat_ws(':', row_json ->> 'topic_id', row_json ->> 'news_id')
  );
  event_actor := private.activity_actor_id();
  if tg_table_name = 'team_members'
    and tg_op = 'DELETE'
    and event_actor::text = entity_key
  then
    event_metadata := jsonb_build_object('actor_user_id', event_actor);
    event_actor := null;
  end if;

  if tg_op = 'UPDATE' then
    if old_json ? 'deleted_at'
      and old_json ->> 'deleted_at' is null
      and new_json ->> 'deleted_at' is not null
    then
      event_action := 'soft_delete';
    elsif old_json ? 'deleted_at'
      and old_json ->> 'deleted_at' is not null
      and new_json ->> 'deleted_at' is null
    then
      event_action := 'restore';
    elsif row_json ? 'editorial_status'
      and old_json ->> 'editorial_status' is distinct from new_json ->> 'editorial_status'
    then
      event_action := 'editorial_status_change';
    end if;
  end if;

  insert into public.activity_events (
    entity_type, entity_id, action, actor_id, old_data, new_data, metadata
  ) values (
    tg_table_name, entity_key, event_action,
    event_actor, old_json, new_json, event_metadata
  );
  return null;
end;
$$;

create trigger news_items_audit
after insert or update or delete on public.news_items
for each row execute function private.audit_content_change();
create trigger theses_audit
after insert or update or delete on public.theses
for each row execute function private.audit_content_change();
create trigger topics_audit
after insert or update or delete on public.topics
for each row execute function private.audit_content_change();
create trigger topic_news_audit
after insert or update or delete on public.topic_news
for each row execute function private.audit_content_change();
create trigger team_members_audit
after insert or update or delete on public.team_members
for each row execute function private.audit_content_change();

create or replace function private.reject_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name
    using errcode = '55000';
end;
$$;

create trigger activity_events_immutable
before update or delete on public.activity_events
for each row execute function private.reject_immutable_change();
create trigger capture_events_immutable
before update or delete on public.capture_events
for each row execute function private.reject_immutable_change();

-- Replace broad team-member policies with explicit pilot role boundaries.
drop policy if exists "team members can read team directory" on public.team_members;
drop policy if exists "admins can manage team directory" on public.team_members;
create policy "team can read team directory"
on public.team_members for select to authenticated
using (private.current_team_role() is not null);
create policy "admins can insert team members"
on public.team_members for insert to authenticated
with check (private.current_team_role() = 'admin');
create policy "admins can update team members"
on public.team_members for update to authenticated
using (private.current_team_role() = 'admin')
with check (private.current_team_role() = 'admin');
create policy "admins can delete team members"
on public.team_members for delete to authenticated
using (private.current_team_role() = 'admin');

drop policy if exists "team members can read news" on public.news_items;
drop policy if exists "team members can insert news" on public.news_items;
drop policy if exists "team members can update news" on public.news_items;
drop policy if exists "team members can delete news" on public.news_items;
create policy "team can read visible news"
on public.news_items for select to authenticated
using (
  private.current_team_role() in ('editor', 'admin')
  or (private.current_team_role() = 'member' and deleted_at is null)
);
create policy "members can capture drafts"
on public.news_items for insert to authenticated
with check (
  private.current_team_role() is not null
  and deleted_at is null
  and editorial_status = 'pending'
  and (captured_by = auth.uid() or captured_by is null)
);
create policy "members can maintain own pending news"
on public.news_items for update to authenticated
using (
  private.current_team_role() = 'member'
  and captured_by = auth.uid()
  and editorial_status = 'pending'
  and deleted_at is null
)
with check (
  private.current_team_role() = 'member'
  and captured_by = auth.uid()
  and editorial_status = 'pending'
  and deleted_at is null
);
create policy "editors can curate news"
on public.news_items for update to authenticated
using (private.current_team_role() in ('editor', 'admin'))
with check (private.current_team_role() in ('editor', 'admin'));
create policy "admins can permanently delete news"
on public.news_items for delete to authenticated
using (private.current_team_role() = 'admin');

drop policy if exists "team members can manage theses" on public.theses;
create policy "team can read visible theses"
on public.theses for select to authenticated
using (
  private.current_team_role() in ('editor', 'admin')
  or (private.current_team_role() = 'member' and deleted_at is null)
);
create policy "members can create theses"
on public.theses for insert to authenticated
with check (
  private.current_team_role() is not null
  and deleted_at is null
  and (created_by = auth.uid() or created_by is null)
);
create policy "members can maintain own theses"
on public.theses for update to authenticated
using (
  private.current_team_role() = 'member'
  and created_by = auth.uid()
  and deleted_at is null
)
with check (
  private.current_team_role() = 'member'
  and created_by = auth.uid()
  and deleted_at is null
);
create policy "editors can curate theses"
on public.theses for update to authenticated
using (private.current_team_role() in ('editor', 'admin'))
with check (private.current_team_role() in ('editor', 'admin'));
create policy "admins can permanently delete theses"
on public.theses for delete to authenticated
using (private.current_team_role() = 'admin');

drop policy if exists "team members can manage topics" on public.topics;
create policy "team can read visible topics"
on public.topics for select to authenticated
using (
  private.current_team_role() in ('editor', 'admin')
  or (private.current_team_role() = 'member' and deleted_at is null)
);
create policy "members can create topic drafts"
on public.topics for insert to authenticated
with check (
  private.current_team_role() is not null
  and deleted_at is null
  and status in ('idea', 'researching')
  and (created_by = auth.uid() or created_by is null)
);
create policy "members can maintain own topic drafts"
on public.topics for update to authenticated
using (
  private.current_team_role() = 'member'
  and created_by = auth.uid()
  and status in ('idea', 'researching')
  and deleted_at is null
)
with check (
  private.current_team_role() = 'member'
  and created_by = auth.uid()
  and status in ('idea', 'researching')
  and deleted_at is null
);
create policy "editors can curate topics"
on public.topics for update to authenticated
using (private.current_team_role() in ('editor', 'admin'))
with check (private.current_team_role() in ('editor', 'admin'));
create policy "admins can permanently delete topics"
on public.topics for delete to authenticated
using (private.current_team_role() = 'admin');

drop policy if exists "team members can manage topic news" on public.topic_news;
create policy "team can read visible topic links"
on public.topic_news for select to authenticated
using (
  private.current_team_role() in ('editor', 'admin')
  or (private.current_team_role() = 'member' and deleted_at is null)
);
create policy "members can create topic links"
on public.topic_news for insert to authenticated
with check (
  private.current_team_role() is not null
  and deleted_at is null
  and (linked_by = auth.uid() or linked_by is null)
);
create policy "members can maintain own topic links"
on public.topic_news for update to authenticated
using (
  private.current_team_role() = 'member'
  and linked_by = auth.uid()
  and deleted_at is null
)
with check (
  private.current_team_role() = 'member'
  and linked_by = auth.uid()
  and deleted_at is null
);
create policy "editors can curate topic links"
on public.topic_news for update to authenticated
using (private.current_team_role() in ('editor', 'admin'))
with check (private.current_team_role() in ('editor', 'admin'));
create policy "editors can unlink topic news"
on public.topic_news for delete to authenticated
using (private.current_team_role() in ('editor', 'admin'));

drop policy if exists "team members can read editorial readouts" on public.editorial_readouts;
create policy "team can read editorial readouts"
on public.editorial_readouts for select to authenticated
using (private.current_team_role() is not null);
create policy "editors can insert editorial readouts"
on public.editorial_readouts for insert to authenticated
with check (private.current_team_role() in ('editor', 'admin'));
create policy "editors can update editorial readouts"
on public.editorial_readouts for update to authenticated
using (private.current_team_role() in ('editor', 'admin'))
with check (private.current_team_role() in ('editor', 'admin'));
create policy "admins can delete editorial readouts"
on public.editorial_readouts for delete to authenticated
using (private.current_team_role() = 'admin');

create policy "editors can read activity events"
on public.activity_events for select to authenticated
using (private.current_team_role() in ('editor', 'admin'));
create policy "admins can read legacy migrations"
on public.legacy_migrations for select to authenticated
using (private.current_team_role() = 'admin');
create policy "editors can read editorial runs"
on public.editorial_job_runs for select to authenticated
using (private.current_team_role() in ('editor', 'admin'));
create policy "clients cannot read capture events"
on public.capture_events for select to authenticated
using (false);

-- Narrow service-role RPC: append capture provenance and merge capture-only fields.
create or replace function public.capture_news_event(
  p_event_id text,
  p_event_kind text,
  p_canonical_url text,
  p_title text,
  p_source text,
  p_raw_text text,
  p_image_url text,
  p_occurred_at timestamptz,
  p_payload jsonb,
  p_capture_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_id uuid;
  saved public.news_items%rowtype;
begin
  if nullif(trim(p_event_id), '') is null
    or nullif(trim(p_canonical_url), '') is null
  then
    raise exception 'event id and canonical URL are required'
      using errcode = '22023';
  end if;

  select n.id into existing_id
  from public.news_items n
  where n.canonical_url = p_canonical_url;

  insert into public.capture_events (
    id, event_kind, canonical_url, payload, occurred_at
  ) values (
    p_event_id, coalesce(nullif(p_event_kind, ''), 'save'),
    p_canonical_url, coalesce(p_payload, '{}'::jsonb), p_occurred_at
  )
  on conflict (id) do nothing;

  insert into public.news_items (
    canonical_url, title, source, raw_text, image_url, captured_at,
    captured_via, editorial_status, metadata
  ) values (
    p_canonical_url, coalesce(nullif(p_title, ''), 'Untitled'),
    coalesce(p_source, ''), coalesce(p_raw_text, ''),
    coalesce(p_image_url, ''), p_occurred_at, 'extension', 'pending',
    jsonb_build_object('capture', coalesce(p_capture_metadata, '{}'::jsonb))
  )
  on conflict (canonical_url) do update set
    title = case
      when news_items.editorial_status = 'processed' then news_items.title
      else excluded.title
    end,
    source = case
      when news_items.editorial_status = 'processed' then news_items.source
      else excluded.source
    end,
    raw_text = case
      when length(excluded.raw_text) > length(news_items.raw_text)
        then excluded.raw_text
      else news_items.raw_text
    end,
    image_url = case
      when news_items.editorial_status = 'processed' then news_items.image_url
      when excluded.image_url <> '' then excluded.image_url
      else news_items.image_url
    end,
    metadata = news_items.metadata
  returning * into saved;

  return jsonb_build_object(
    'news', to_jsonb(saved),
    'already_existed', existing_id is not null
  );
end;
$$;

revoke all on function public.capture_news_event(
  text, text, text, text, text, text, text, timestamptz, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.capture_news_event(
  text, text, text, text, text, text, text, timestamptz, jsonb, jsonb
) to service_role;

create or replace function public.news_capture_status(p_canonical_url text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'saved', n.deleted_at is null,
        'editorial_status', n.editorial_status,
        'news_id', n.id,
        'deleted', n.deleted_at is not null,
        'version', n.version
      )
      from public.news_items n
      where n.canonical_url = p_canonical_url
    ),
    jsonb_build_object(
      'saved', false, 'editorial_status', null,
      'news_id', null, 'deleted', false, 'version', null
    )
  )
$$;

revoke all on function public.news_capture_status(text)
from public, anon, authenticated;
grant execute on function public.news_capture_status(text) to service_role;

-- Narrow editorial publication RPC. It updates existing rows only and merges
-- editorial metadata without replacing capture/contributor metadata.
create or replace function public.apply_editorial_sync(
  p_news jsonb,
  p_readouts jsonb,
  p_external_run_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  run_uuid uuid;
  news_count integer := 0;
  readout_count integer := 0;
  affected integer;
begin
  insert into public.editorial_job_runs (
    external_run_id, status, started_at, updated_at
  ) values (
    nullif(p_external_run_id, ''), 'running', now(), now()
  )
  on conflict (external_run_id) do update set
    status = 'running',
    error_message = null,
    finished_at = null,
    updated_at = now()
  returning id into run_uuid;

  for item in select value from jsonb_array_elements(coalesce(p_news, '[]'::jsonb))
  loop
    update public.news_items n set
      title = left(coalesce(nullif(item ->> 'title', ''), n.title), 500),
      source = left(coalesce(nullif(item ->> 'source', ''), n.source), 200),
      raw_text = case
        when nullif(item ->> 'raw_text', '') is null then n.raw_text
        else left(item ->> 'raw_text', 60000)
      end,
      summary = left(coalesce(item ->> 'summary', ''), 4000),
      category = case
        when item ->> 'category' in (
          'interaction', 'ai_software', 'ai_hardware', 'ecosystem',
          'ai_capability', 'industry_events'
        ) then (item ->> 'category')::public.news_category
        else n.category
      end,
      image_url = left(coalesce(nullif(item ->> 'image_url', ''), n.image_url), 2000),
      editorial_status = 'processed',
      editorial_updated_at = now(),
      editorial_run_id = run_uuid,
      editorial_lease_owner = null,
      editorial_lease_expires_at = null,
      metadata = n.metadata || coalesce(item -> 'editorial_metadata', '{}'::jsonb)
    where n.canonical_url = item ->> 'canonical_url'
      and n.deleted_at is null;
    get diagnostics affected = row_count;
    news_count := news_count + affected;
  end loop;

  if news_count <> jsonb_array_length(coalesce(p_news, '[]'::jsonb)) then
    raise exception 'one or more editorial items were not found or were deleted'
      using errcode = 'P0002';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_readouts, '[]'::jsonb))
  loop
    if item ->> 'period_type' not in ('week', 'month', 'quarter')
      or nullif(item ->> 'period_key', '') is null
    then
      raise exception 'invalid editorial readout'
        using errcode = '22023';
    end if;

    insert into public.editorial_readouts (
      period_type, period_key, lede, bullets, generated_at, generated_by
    ) values (
      item ->> 'period_type',
      item ->> 'period_key',
      left(coalesce(item ->> 'lede', ''), 2000),
      coalesce(item -> 'bullets', '[]'::jsonb),
      now(),
      left(coalesce(nullif(item ->> 'generated_by', ''), 'cursor-automation'), 200)
    )
    on conflict (period_type, period_key) do update set
      lede = excluded.lede,
      bullets = excluded.bullets,
      generated_at = excluded.generated_at,
      generated_by = excluded.generated_by;
    readout_count := readout_count + 1;
  end loop;

  update public.news_items set
    editorial_run_id = null,
    editorial_lease_owner = null,
    editorial_lease_expires_at = null
  where editorial_run_id = run_uuid
    and editorial_status = 'pending';

  update public.editorial_job_runs set
    status = 'completed',
    processed_count = news_count,
    readout_count = readout_count,
    finished_at = now(),
    updated_at = now()
  where id = run_uuid;

  return jsonb_build_object(
    'run_id', run_uuid,
    'external_run_id', p_external_run_id,
    'upserted_news', news_count,
    'upserted_readouts', readout_count
  );
end;
$$;

revoke all on function public.apply_editorial_sync(jsonb, jsonb, text)
from public, anon, authenticated;
grant execute on function public.apply_editorial_sync(jsonb, jsonb, text)
to service_role;

create or replace function public.record_editorial_run_failure(
  p_external_run_id text,
  p_error_message text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run_uuid uuid;
begin
  insert into public.editorial_job_runs (
    external_run_id, status, error_message, finished_at, updated_at
  ) values (
    nullif(p_external_run_id, ''), 'failed',
    left(coalesce(p_error_message, 'Editorial sync failed'), 2000),
    now(), now()
  )
  on conflict (external_run_id) do update set
    status = 'failed',
    error_message = excluded.error_message,
    finished_at = now(),
    updated_at = now()
  returning id into run_uuid;

  update public.news_items set
    editorial_run_id = null,
    editorial_lease_owner = null,
    editorial_lease_expires_at = null
  where editorial_run_id = run_uuid
    and editorial_status = 'pending';
end;
$$;

revoke all on function public.record_editorial_run_failure(text, text)
from public, anon, authenticated;
grant execute on function public.record_editorial_run_failure(text, text)
to service_role;

create or replace function public.claim_editorial_job(
  p_external_run_id text,
  p_lease_owner text,
  p_batch_size integer default 10,
  p_lease_seconds integer default 1800
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run_uuid uuid;
  claimed jsonb;
begin
  if nullif(p_external_run_id, '') is null
    or nullif(p_lease_owner, '') is null
  then
    raise exception 'run id and lease owner are required'
      using errcode = '22023';
  end if;

  insert into public.editorial_job_runs (
    external_run_id, status, lease_owner, lease_expires_at
  ) values (
    p_external_run_id, 'running', left(p_lease_owner, 200),
    now() + make_interval(secs => least(greatest(p_lease_seconds, 60), 7200))
  )
  on conflict (external_run_id) do update set
    status = 'running',
    lease_owner = excluded.lease_owner,
    lease_expires_at = excluded.lease_expires_at,
    error_message = null,
    finished_at = null,
    updated_at = now()
  returning id into run_uuid;

  with candidates as (
    select n.id
    from public.news_items n
    where n.editorial_status = 'pending'
      and n.deleted_at is null
      and (
        n.editorial_lease_expires_at is null
        or n.editorial_lease_expires_at < now()
      )
    order by n.captured_at
    for update skip locked
    limit least(greatest(p_batch_size, 1), 25)
  ),
  leased as (
    update public.news_items n set
      editorial_run_id = run_uuid,
      editorial_lease_owner = left(p_lease_owner, 200),
      editorial_lease_expires_at =
        now() + make_interval(secs => least(greatest(p_lease_seconds, 60), 7200))
    from candidates c
    where n.id = c.id
    returning n.*
  )
  select coalesce(jsonb_agg(to_jsonb(leased)), '[]'::jsonb)
  into claimed
  from leased;

  update public.editorial_job_runs set
    claimed_count = jsonb_array_length(claimed),
    updated_at = now()
  where id = run_uuid;

  return jsonb_build_object('run_id', run_uuid, 'news', claimed);
end;
$$;

revoke all on function public.claim_editorial_job(text, text, integer, integer)
from public, anon, authenticated;
grant execute on function public.claim_editorial_job(text, text, integer, integer)
to service_role;

-- Optimistic update primitive used by authenticated dashboard clients.
create or replace function public.update_news_with_version(
  p_news_id uuid,
  p_expected_version bigint,
  p_patch jsonb
)
returns public.news_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.news_items%rowtype;
  forbidden jsonb;
begin
  forbidden := coalesce(p_patch, '{}'::jsonb) - array[
    'title', 'source', 'raw_text', 'summary', 'category', 'image_url',
    'editorial_status', 'metadata', 'deleted_at', 'deleted_by'
  ];
  if forbidden <> '{}'::jsonb then
    raise exception 'patch contains unsupported fields'
      using errcode = '22023';
  end if;

  update public.news_items n set
    title = left(coalesce(p_patch ->> 'title', n.title), 500),
    source = left(coalesce(p_patch ->> 'source', n.source), 200),
    raw_text = left(coalesce(p_patch ->> 'raw_text', n.raw_text), 60000),
    summary = left(coalesce(p_patch ->> 'summary', n.summary), 4000),
    category = case
      when p_patch ? 'category'
        then (p_patch ->> 'category')::public.news_category
      else n.category
    end,
    image_url = left(coalesce(p_patch ->> 'image_url', n.image_url), 2000),
    editorial_status = case
      when p_patch ? 'editorial_status'
        then (p_patch ->> 'editorial_status')::public.editorial_status
      else n.editorial_status
    end,
    metadata = case
      when p_patch ? 'metadata' then p_patch -> 'metadata'
      else n.metadata
    end,
    deleted_at = case
      when p_patch ? 'deleted_at'
        then nullif(p_patch ->> 'deleted_at', '')::timestamptz
      else n.deleted_at
    end,
    deleted_by = case
      when p_patch ? 'deleted_at' and nullif(p_patch ->> 'deleted_at', '') is not null
        then auth.uid()
      when p_patch ? 'deleted_at' then null
      else n.deleted_by
    end,
    last_edited_by = auth.uid()
  where n.id = p_news_id
    and n.version = p_expected_version
  returning * into saved;

  if saved.id is null then
    raise exception 'news item changed or is not writable'
      using errcode = '40001';
  end if;
  return saved;
end;
$$;

revoke all on function public.update_news_with_version(uuid, bigint, jsonb)
from public, anon;
grant execute on function public.update_news_with_version(uuid, bigint, jsonb)
to authenticated;

-- Atomic, one-time legacy import. The durable marker is written in the same
-- transaction as the data so a partial import cannot be marked complete.
create or replace function public.import_legacy_data_once(
  p_migration_key text,
  p_actor_id uuid,
  p_news jsonb,
  p_topics jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  news_count integer := 0;
  topic_count integer := 0;
begin
  if nullif(trim(p_migration_key), '') is null then
    raise exception 'migration key is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_migration_key));
  if exists (
    select 1 from public.legacy_migrations
    where migration_key = p_migration_key
  ) then
    raise exception 'legacy migration has already completed'
      using errcode = '23505';
  end if;

  perform set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);

  for item in select value from jsonb_array_elements(coalesce(p_news, '[]'::jsonb))
  loop
    insert into public.news_items (
      canonical_url, title, source, raw_text, summary, category, image_url,
      captured_at, captured_via, editorial_status, editorial_updated_at, metadata
    ) values (
      item ->> 'canonical_url',
      left(coalesce(nullif(item ->> 'title', ''), 'Untitled'), 500),
      left(coalesce(item ->> 'source', ''), 200),
      left(coalesce(item ->> 'raw_text', ''), 60000),
      left(coalesce(item ->> 'summary', ''), 4000),
      case when item ->> 'category' in (
        'interaction', 'ai_software', 'ai_hardware', 'ecosystem',
        'ai_capability', 'industry_events'
      ) then (item ->> 'category')::public.news_category
      else 'ecosystem'::public.news_category end,
      left(coalesce(item ->> 'image_url', ''), 2000),
      coalesce((item ->> 'captured_at')::timestamptz, now()),
      'migration',
      case when item ->> 'editorial_status' in ('pending', 'processed', 'failed')
        then (item ->> 'editorial_status')::public.editorial_status
        else 'pending'::public.editorial_status end,
      nullif(item ->> 'editorial_updated_at', '')::timestamptz,
      coalesce(item -> 'metadata', '{}'::jsonb)
    )
    on conflict (canonical_url) do update set
      raw_text = case
        when length(excluded.raw_text) > length(news_items.raw_text)
          then excluded.raw_text
        else news_items.raw_text
      end,
      metadata = news_items.metadata || jsonb_build_object(
        'legacy_import', excluded.metadata
      );
    news_count := news_count + 1;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_topics, '[]'::jsonb))
  loop
    insert into public.topics (
      id, thesis_id, parent_topic_id, title, notes, category, status,
      scheduled_month, display_order
    ) values (
      (item ->> 'id')::uuid,
      nullif(item ->> 'thesis_id', '')::uuid,
      nullif(item ->> 'parent_topic_id', '')::uuid,
      item ->> 'title',
      coalesce(item ->> 'notes', ''),
      case when item ->> 'category' in (
        'interaction', 'ai_software', 'ai_hardware', 'ecosystem',
        'ai_capability', 'industry_events'
      ) then (item ->> 'category')::public.news_category
      else 'ecosystem'::public.news_category end,
      case when item ->> 'status' in (
        'idea', 'researching', 'scheduled', 'published', 'completed', 'archived'
      ) then (item ->> 'status')::public.topic_status
      else 'published'::public.topic_status end,
      (item ->> 'scheduled_month')::date,
      greatest(coalesce((item ->> 'display_order')::integer, 1), 1)
    )
    on conflict (id) do nothing;
    topic_count := topic_count + 1;
  end loop;

  insert into public.legacy_migrations (
    migration_key, completed_by, imported_news, imported_topics
  ) values (
    p_migration_key, p_actor_id, news_count, topic_count
  );

  return jsonb_build_object(
    'migration_key', p_migration_key,
    'imported_news', news_count,
    'imported_topics', topic_count
  );
end;
$$;

revoke all on function public.import_legacy_data_once(text, uuid, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.import_legacy_data_once(text, uuid, jsonb, jsonb)
to service_role;

create index if not exists news_items_visible_captured_idx
  on public.news_items (captured_at desc) where deleted_at is null;
create index if not exists news_items_pending_editorial_idx
  on public.news_items (captured_at, id)
  where editorial_status = 'pending' and deleted_at is null;
create index if not exists news_items_editorial_lease_idx
  on public.news_items (editorial_lease_expires_at)
  where editorial_status = 'pending' and deleted_at is null;
create index if not exists news_items_deleted_idx
  on public.news_items (deleted_at desc) where deleted_at is not null;
create index if not exists news_items_captured_by_idx
  on public.news_items (captured_by) where captured_by is not null;
create index if not exists topics_visible_schedule_idx
  on public.topics (scheduled_month, display_order) where deleted_at is null;
create index if not exists topics_created_by_idx
  on public.topics (created_by) where created_by is not null;
create index if not exists topics_updated_by_idx
  on public.topics (updated_by) where updated_by is not null;
create index if not exists topics_parent_topic_idx
  on public.topics (parent_topic_id) where parent_topic_id is not null;
create index if not exists theses_visible_order_idx
  on public.theses (display_order) where deleted_at is null;
create index if not exists theses_created_by_idx
  on public.theses (created_by) where created_by is not null;
create index if not exists topic_news_visible_news_idx
  on public.topic_news (news_id, topic_id) where deleted_at is null;
create index if not exists topic_news_linked_by_idx
  on public.topic_news (linked_by) where linked_by is not null;
create index if not exists activity_events_entity_time_idx
  on public.activity_events (entity_type, entity_id, occurred_at desc);
create index if not exists activity_events_actor_time_idx
  on public.activity_events (actor_id, occurred_at desc)
  where actor_id is not null;
create index if not exists editorial_job_runs_status_time_idx
  on public.editorial_job_runs (status, started_at desc);

alter publication supabase_realtime add table public.editorial_readouts;
alter publication supabase_realtime add table public.editorial_job_runs;

comment on table public.activity_events is
  'Immutable audit history for collaborative content changes.';
comment on table public.legacy_migrations is
  'Durable markers for explicit one-time legacy imports.';
comment on table public.editorial_job_runs is
  'Observable editorial executions and their queue leases.';
