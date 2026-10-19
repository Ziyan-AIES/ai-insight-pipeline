-- Additive: no historical news, trends, topics, or outputs are changed.
begin;
create table if not exists public.research_workspace_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.research_workspace_editors enable row level security;
revoke all on public.research_workspace_editors from anon, authenticated;

-- Resolve the approved email to its immutable Auth user ID. Preserve admin roles.
insert into public.team_members(user_id,email,display_name,role)
select id,email,coalesce(raw_user_meta_data->>'full_name','Research editor'),'editor'
from auth.users where lower(email) = 'lizy76@lenovo.com'
on conflict (user_id) do update set role = case when team_members.role = 'admin' then 'admin' else 'editor' end;
insert into public.research_workspace_editors(user_id)
select id from auth.users where lower(email) = 'lizy76@lenovo.com'
on conflict do nothing;

create or replace function public.can_access_research_workspace()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.research_workspace_editors e
  join public.team_members m on m.user_id = e.user_id
  where e.user_id = auth.uid() and m.role in ('editor','admin')
); $$;
revoke all on function public.can_access_research_workspace() from public, anon;
grant execute on function public.can_access_research_workspace() to authenticated;

create table if not exists public.research_private_notes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.research_private_notes enable row level security;
revoke all on public.research_private_notes from anon;
grant select,insert,update,delete on public.research_private_notes to authenticated;
create policy "authorized research editors only" on public.research_private_notes
for all to authenticated using (public.can_access_research_workspace())
with check (public.can_access_research_workspace());
commit;
