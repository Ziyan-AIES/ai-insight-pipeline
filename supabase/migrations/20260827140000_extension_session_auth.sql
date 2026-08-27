-- Store short-lived extension login handoffs and attach captures to team users.

create table if not exists public.extension_auth_handoffs (
  state_hash text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null default '',
  authorized boolean not null default false,
  access_token text not null default '',
  refresh_token text not null default '',
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.extension_auth_handoffs enable row level security;

revoke all on public.extension_auth_handoffs from public, anon, authenticated;
grant all on public.extension_auth_handoffs to service_role;

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
  capture_meta jsonb := coalesce(p_capture_metadata, '{}'::jsonb);
  contributor text := coalesce(
    nullif(trim(capture_meta ->> 'contributor_name'), ''),
    nullif(trim(capture_meta ->> 'legacy_user'), '')
  );
  captured_by_id uuid := null;
  takeaway_text text := coalesce(nullif(trim(capture_meta ->> 'takeaway'), ''), '');
  selected_category public.news_category := 'ecosystem';
  initial_metadata jsonb :=
    jsonb_build_object('capture', capture_meta)
    || case
      when contributor is null then '{}'::jsonb
      else jsonb_build_object('contributor_name', contributor)
    end;
begin
  if nullif(trim(p_event_id), '') is null
    or nullif(trim(p_canonical_url), '') is null
  then
    raise exception 'event id and canonical URL are required'
      using errcode = '22023';
  end if;

  begin
    captured_by_id := nullif(trim(capture_meta ->> 'team_user_id'), '')::uuid;
  exception
    when invalid_text_representation then
      captured_by_id := null;
  end;

  begin
    if nullif(trim(capture_meta ->> 'category'), '') is not null
      and trim(capture_meta ->> 'category') not in ('auto', 'auto_detect')
    then
      selected_category := trim(capture_meta ->> 'category')::public.news_category;
    end if;
  exception
    when invalid_text_representation then
      selected_category := 'ecosystem';
  end;

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
    captured_by, captured_via, editorial_status, metadata, takeaway, source_type,
    category
  ) values (
    p_canonical_url, coalesce(nullif(p_title, ''), 'Untitled'),
    coalesce(p_source, ''), coalesce(p_raw_text, ''),
    coalesce(p_image_url, ''), p_occurred_at, captured_by_id, 'extension', 'pending',
    initial_metadata, takeaway_text, 'captured_news', selected_category
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
    captured_by = coalesce(news_items.captured_by, excluded.captured_by),
    takeaway = case
      when news_items.takeaway <> '' then news_items.takeaway
      else excluded.takeaway
    end,
    category = case
      when news_items.editorial_status = 'processed' then news_items.category
      else excluded.category
    end,
    metadata =
      news_items.metadata
      || jsonb_build_object(
        'capture',
        coalesce(news_items.metadata -> 'capture', '{}'::jsonb) || capture_meta
      )
      || case
        when contributor is null then '{}'::jsonb
        when nullif(news_items.metadata ->> 'contributor_name', '') is null
          then jsonb_build_object('contributor_name', contributor)
        else '{}'::jsonb
      end
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
