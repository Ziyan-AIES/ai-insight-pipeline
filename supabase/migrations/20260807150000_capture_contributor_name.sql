-- Persist extension display names as top-level contributor metadata and
-- preserve them when a URL is captured again.
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
    initial_metadata
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

-- Backfill display names already stored under metadata.capture.legacy_user.
update public.news_items
set metadata =
  metadata || jsonb_build_object(
    'contributor_name',
    coalesce(
      nullif(trim(metadata -> 'capture' ->> 'contributor_name'), ''),
      nullif(trim(metadata -> 'capture' ->> 'legacy_user'), '')
    )
  )
where nullif(trim(metadata ->> 'contributor_name'), '') is null
  and (
    nullif(trim(metadata -> 'capture' ->> 'contributor_name'), '') is not null
    or nullif(trim(metadata -> 'capture' ->> 'legacy_user'), '') is not null
  );
