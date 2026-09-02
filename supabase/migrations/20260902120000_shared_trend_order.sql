-- Team-shared Trend priority. Card order is editorial workspace state, not a
-- per-browser preference.

alter table public.trends
  add column if not exists display_order integer not null default 0;

create index if not exists trends_visible_display_order_idx
  on public.trends (display_order, created_at desc)
  where deleted_at is null;

create or replace function public.reorder_trends(p_trend_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  trend_id uuid;
  position integer := 1;
begin
  if private.current_team_role() not in ('editor', 'admin') then
    raise exception 'Only editors can reorder Trends';
  end if;

  foreach trend_id in array coalesce(p_trend_ids, array[]::uuid[])
  loop
    update public.trends
    set
      display_order = position,
      updated_by = auth.uid()
    where id = trend_id
      and deleted_at is null;
    position := position + 1;
  end loop;
end;
$$;

revoke all on function public.reorder_trends(uuid[]) from public;
grant execute on function public.reorder_trends(uuid[]) to authenticated;

comment on column public.trends.display_order is
  'Team-shared editorial priority for Trend cards. Lower values appear first.';
