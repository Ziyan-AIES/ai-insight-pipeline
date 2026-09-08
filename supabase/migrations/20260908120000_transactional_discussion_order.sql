-- Save a visible discussion ordering as one transaction. Version checks reject
-- a second editor who started from an older ordering snapshot.

create or replace function public.persist_discussion_order(p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  affected integer;
  result jsonb := '[]'::jsonb;
begin
  if private.current_team_role() not in ('editor', 'admin') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 500
  then
    raise exception 'invalid discussion order' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) <> (
    select count(distinct value ->> 'id') from jsonb_array_elements(p_items)
  ) then
    raise exception 'duplicate discussion item' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(item.value ->> 'id', '')
        !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or coalesce(item.value ->> 'position', '') !~ '^[1-9][0-9]*$'
      or (item.value ->> 'position')::integer > jsonb_array_length(p_items)
  ) or jsonb_array_length(p_items) <> (
    select count(distinct (value ->> 'position')::integer)
    from jsonb_array_elements(p_items)
  ) then
    raise exception 'invalid discussion position' using errcode = '22023';
  end if;

  -- Lock in a stable order, then validate the complete request before writing.
  perform 1
  from public.news_items n
  join jsonb_array_elements(p_items) item
    on n.id = (item.value ->> 'id')::uuid
  order by n.id
  for update of n;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
    left join public.news_items n on n.id = (item.value ->> 'id')::uuid
    where n.id is null
      or n.deleted_at is not null
      or coalesce(item.value ->> 'expected_version', '') !~ '^[1-9][0-9]*$'
      or n.version <> (item.value ->> 'expected_version')::bigint
  ) then
    raise exception 'discussion order conflict: reload and try again'
      using errcode = '40001';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    update public.news_items n set
      discussion_order = (item ->> 'position')::integer
    where n.id = (item ->> 'id')::uuid
      and (item ->> 'position') ~ '^[1-9][0-9]*$'
      and (item ->> 'position')::integer <= jsonb_array_length(p_items)
    returning result || jsonb_build_array(jsonb_build_object(
      'id', n.id, 'discussion_order', n.discussion_order, 'version', n.version
    )) into result;
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'invalid discussion position' using errcode = '22023';
    end if;
  end loop;
  return result;
end;
$$;

revoke all on function public.persist_discussion_order(jsonb) from public, anon;
grant execute on function public.persist_discussion_order(jsonb) to authenticated;

comment on function public.persist_discussion_order(jsonb) is
  'Atomically persists one visible news ordering after validating IDs, positions, role, and row versions.';
