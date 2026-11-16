begin;
create policy "editors can add radar sources" on public.radar_sources
for insert to authenticated with check(private.current_team_role()='editor' and created_by=auth.uid() and deleted_at is null);
create policy "editors can update radar sources" on public.radar_sources
for update to authenticated using(private.current_team_role()='editor') with check(private.current_team_role()='editor');
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
    and coalesce(private.current_team_role(), '') not in ('editor', 'admin')
  then
    raise exception 'only editors can remove content'
      using errcode = '42501';
  end if;

  if old.deleted_at is not null
    and new.deleted_at is null
    and auth.uid() is not null
    and coalesce(private.current_team_role(), '') not in ('editor', 'admin')
  then
    raise exception 'only editors can restore deleted content'
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


create policy "editors can read recycled news_items" on public.news_items for select to authenticated using(private.current_team_role()='editor');
create policy "editors can read recycled topics" on public.topics for select to authenticated using(private.current_team_role()='editor');
create policy "editors can read recycled theses" on public.theses for select to authenticated using(private.current_team_role()='editor');
create policy "editors can read recycled trends" on public.trends for select to authenticated using(private.current_team_role()='editor');
commit;
