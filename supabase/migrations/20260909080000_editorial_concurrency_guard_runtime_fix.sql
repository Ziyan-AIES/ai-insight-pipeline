-- Repair production drift found during the controlled phase 3 validation.
-- Recreate the guarded RPCs from the reviewed phase 1 definition.

create or replace function public.apply_editorial_sync_guarded(
  p_news jsonb,
  p_readouts jsonb,
  p_external_run_id text,
  p_claim_run_id uuid,
  p_lease_owner text,
  p_request_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  run_record public.editorial_job_runs%rowtype;
  news_count integer := 0;
  synced_readout_count integer := 0;
  affected integer;
  submitted_count integer;
begin
  if jsonb_typeof(coalesce(p_news, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_readouts, '[]'::jsonb)) <> 'array'
    or nullif(p_external_run_id, '') is null
    or p_claim_run_id is null
    or nullif(p_lease_owner, '') is null
    or nullif(p_request_hash, '') is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'invalid guarded editorial request'
      using errcode = '22023';
  end if;

  select * into run_record
  from public.editorial_job_runs r
  where r.id = p_claim_run_id
    and r.external_run_id = p_external_run_id
  for update;

  if not found then
    raise exception 'editorial snapshot conflict: claim does not exist'
      using errcode = '40001';
  end if;

  -- A timed-out caller may retry after the first transaction committed. Only
  -- the byte-identical normalized request is accepted as an idempotent retry.
  if run_record.status = 'completed'
    and run_record.metadata ->> 'request_hash' = p_request_hash
  then
    return jsonb_build_object(
      'run_id', run_record.id,
      'external_run_id', run_record.external_run_id,
      'upserted_news', run_record.processed_count,
      'upserted_readouts', run_record.readout_count,
      'idempotent_replay', true
    );
  end if;

  if run_record.status <> 'running'
    or run_record.lease_owner is distinct from left(p_lease_owner, 200)
    or run_record.lease_expires_at is null
    or run_record.lease_expires_at <= now()
  then
    raise exception 'editorial lease conflict: claim is no longer current'
      using errcode = '40001';
  end if;

  submitted_count := jsonb_array_length(coalesce(p_news, '[]'::jsonb));
  if submitted_count <> (
    select count(distinct value ->> 'news_id')
    from jsonb_array_elements(coalesce(p_news, '[]'::jsonb))
  ) then
    raise exception 'editorial snapshot conflict: duplicate news id'
      using errcode = '40001';
  end if;

  -- Preflight the complete batch before writing any editorial fields. A manual
  -- edit, deletion, expired lease, or reassignment aborts the whole transaction.
  for item in
    select value from jsonb_array_elements(coalesce(p_news, '[]'::jsonb))
  loop
    if nullif(item ->> 'news_id', '') is null
      or coalesce(item ->> 'expected_version', '') !~ '^[1-9][0-9]*$'
      or nullif(item ->> 'canonical_url', '') is null
    then
      raise exception 'invalid editorial snapshot item'
        using errcode = '22023';
    end if;

    perform 1
    from public.news_items n
    where n.id = (item ->> 'news_id')::uuid
      and n.canonical_url = item ->> 'canonical_url'
      and n.version = (item ->> 'expected_version')::bigint
      and n.editorial_status = 'pending'
      and n.editorial_run_id = p_claim_run_id
      and n.editorial_lease_owner = left(p_lease_owner, 200)
      and n.editorial_lease_expires_at > now()
      and n.deleted_at is null
    for update;

    if not found then
      raise exception 'editorial snapshot conflict: item changed, expired, reassigned, or deleted'
        using errcode = '40001';
    end if;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(p_news, '[]'::jsonb))
  loop
    update public.news_items n set
      title = left(coalesce(nullif(item ->> 'title', ''), n.title), 500),
      source = left(coalesce(nullif(item ->> 'source', ''), n.source), 200),
      raw_text = case
        when nullif(item ->> 'raw_text', '') is null then n.raw_text
        else left(item ->> 'raw_text', 60000)
      end,
      summary = left(coalesce(item ->> 'summary', ''), 4000),
      takeaway = left(coalesce(item ->> 'summary', ''), 4000),
      team_synthesis = left(coalesce(item ->> 'team_synthesis', ''), 2000),
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
      last_reviewed_at = now(),
      editorial_run_id = p_claim_run_id,
      editorial_lease_owner = null,
      editorial_lease_expires_at = null,
      metadata = n.metadata || coalesce(item -> 'editorial_metadata', '{}'::jsonb)
    where n.id = (item ->> 'news_id')::uuid
      and n.canonical_url = item ->> 'canonical_url'
      and n.version = (item ->> 'expected_version')::bigint
      and n.editorial_status = 'pending'
      and n.editorial_run_id = p_claim_run_id
      and n.editorial_lease_owner = left(p_lease_owner, 200)
      and n.editorial_lease_expires_at > now()
      and n.deleted_at is null;
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'editorial snapshot conflict during update'
        using errcode = '40001';
    end if;
    news_count := news_count + 1;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(p_readouts, '[]'::jsonb))
  loop
    if item ->> 'period_type' not in ('week', 'month', 'quarter')
      or nullif(item ->> 'period_key', '') is null
    then
      raise exception 'invalid editorial readout' using errcode = '22023';
    end if;
    insert into public.editorial_readouts (
      period_type, period_key, lede, bullets, generated_at, generated_by
    ) values (
      item ->> 'period_type', item ->> 'period_key',
      left(coalesce(item ->> 'lede', ''), 2000),
      coalesce(item -> 'bullets', '[]'::jsonb), now(),
      left(coalesce(nullif(item ->> 'generated_by', ''), 'cursor-automation'), 200)
    )
    on conflict (period_type, period_key) do update set
      lede = excluded.lede,
      bullets = excluded.bullets,
      generated_at = excluded.generated_at,
      generated_by = excluded.generated_by;
    synced_readout_count := synced_readout_count + 1;
  end loop;

  -- Release only unprocessed rows still owned by this exact claim. This covers
  -- items the reviewer left pending for insufficient evidence.
  update public.news_items n set
    editorial_run_id = null,
    editorial_lease_owner = null,
    editorial_lease_expires_at = null
  where n.editorial_run_id = p_claim_run_id
    and n.editorial_lease_owner = left(p_lease_owner, 200)
    and n.editorial_status = 'pending';

  update public.editorial_job_runs r set
    status = 'completed',
    processed_count = news_count,
    readout_count = synced_readout_count,
    lease_owner = null,
    lease_expires_at = null,
    error_message = null,
    finished_at = now(),
    updated_at = now(),
    metadata = r.metadata || jsonb_build_object('request_hash', p_request_hash)
  where r.id = p_claim_run_id
    and r.external_run_id = p_external_run_id
    and r.status = 'running'
    and r.lease_owner = left(p_lease_owner, 200);
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'editorial lease conflict during completion'
      using errcode = '40001';
  end if;

  return jsonb_build_object(
    'run_id', p_claim_run_id,
    'external_run_id', p_external_run_id,
    'upserted_news', news_count,
    'upserted_readouts', synced_readout_count,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.apply_editorial_sync_guarded(jsonb, jsonb, text, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.apply_editorial_sync_guarded(jsonb, jsonb, text, uuid, text, text)
to service_role;

create or replace function public.record_editorial_run_failure_guarded(
  p_external_run_id text,
  p_claim_run_id uuid,
  p_lease_owner text,
  p_error_message text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.editorial_job_runs r set
    status = 'failed',
    error_message = left(coalesce(p_error_message, 'Editorial sync failed'), 2000),
    lease_owner = null,
    lease_expires_at = null,
    finished_at = now(),
    updated_at = now()
  where r.id = p_claim_run_id
    and r.external_run_id = p_external_run_id
    and r.status = 'running'
    and r.lease_owner = left(p_lease_owner, 200)
    and r.lease_expires_at > now();
  get diagnostics affected = row_count;
  if affected <> 1 then return false; end if;

  update public.news_items n set
    editorial_run_id = null,
    editorial_lease_owner = null,
    editorial_lease_expires_at = null
  where n.editorial_run_id = p_claim_run_id
    and n.editorial_lease_owner = left(p_lease_owner, 200)
    and n.editorial_status = 'pending';
  return true;
end;
$$;

revoke all on function public.record_editorial_run_failure_guarded(text, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.record_editorial_run_failure_guarded(text, uuid, text, text)
to service_role;

comment on function public.apply_editorial_sync_guarded(jsonb, jsonb, text, uuid, text, text) is
  'Atomically applies an editorial batch only when row versions and the active queue lease still match.';

