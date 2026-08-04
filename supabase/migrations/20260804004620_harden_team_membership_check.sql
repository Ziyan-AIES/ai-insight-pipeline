create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members
    where user_id = auth.uid()
  );
$$;

revoke all on function private.is_team_member() from public;
grant execute on function private.is_team_member() to authenticated;

alter policy "team members can read team directory"
on public.team_members using (private.is_team_member());
alter policy "team members can read news"
on public.news_items using (private.is_team_member());
alter policy "team members can insert news"
on public.news_items with check (private.is_team_member());
alter policy "team members can update news"
on public.news_items
using (private.is_team_member()) with check (private.is_team_member());
alter policy "team members can delete news"
on public.news_items using (private.is_team_member());
alter policy "team members can manage theses"
on public.theses
using (private.is_team_member()) with check (private.is_team_member());
alter policy "team members can manage topics"
on public.topics
using (private.is_team_member()) with check (private.is_team_member());
alter policy "team members can manage topic news"
on public.topic_news
using (private.is_team_member()) with check (private.is_team_member());
alter policy "team members can read editorial readouts"
on public.editorial_readouts using (private.is_team_member());

drop function public.is_team_member();
