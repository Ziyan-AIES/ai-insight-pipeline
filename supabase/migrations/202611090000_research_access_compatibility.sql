-- Match the existing server-verified owner capability without changing membership.
begin;
create or replace function public.can_access_research_workspace()
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.team_members m join auth.users u on u.id=m.user_id
 where m.user_id=auth.uid() and m.role in ('editor','admin') and lower(u.email)='lizy76@lenovo.com');
$$;
revoke all on function public.can_access_research_workspace() from public,anon;
grant execute on function public.can_access_research_workspace() to authenticated;
commit;
