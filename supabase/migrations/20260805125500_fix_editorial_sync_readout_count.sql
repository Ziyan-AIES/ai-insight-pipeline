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
  synced_readout_count integer := 0;
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
      category = case
        when item ->> 'category' in (
          'interaction', 'ai_software', 'ai_hardware', 'ecosystem',
          'ai_capability', 'industry_events'
        ) then (item ->> 'category')::public.news_category
        else n.category
      end,
      image_url = left(
        coalesce(nullif(item ->> 'image_url', ''), n.image_url),
        2000
      ),
      editorial_status = 'processed',
      editorial_updated_at = now(),
      editorial_run_id = run_uuid,
      editorial_lease_owner = null,
      editorial_lease_expires_at = null,
      metadata =
        n.metadata || coalesce(item -> 'editorial_metadata', '{}'::jsonb)
    where n.canonical_url = item ->> 'canonical_url'
      and n.deleted_at is null;
    get diagnostics affected = row_count;
    news_count := news_count + affected;
  end loop;

  if news_count <> jsonb_array_length(coalesce(p_news, '[]'::jsonb)) then
    raise exception 'one or more editorial items were not found or were deleted'
      using errcode = 'P0002';
  end if;

  for item in
    select value from jsonb_array_elements(coalesce(p_readouts, '[]'::jsonb))
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
      left(
        coalesce(nullif(item ->> 'generated_by', ''), 'cursor-automation'),
        200
      )
    )
    on conflict (period_type, period_key) do update set
      lede = excluded.lede,
      bullets = excluded.bullets,
      generated_at = excluded.generated_at,
      generated_by = excluded.generated_by;
    synced_readout_count := synced_readout_count + 1;
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
    readout_count = synced_readout_count,
    finished_at = now(),
    updated_at = now()
  where id = run_uuid;

  return jsonb_build_object(
    'run_id', run_uuid,
    'external_run_id', p_external_run_id,
    'upserted_news', news_count,
    'upserted_readouts', synced_readout_count
  );
end;
$$;
