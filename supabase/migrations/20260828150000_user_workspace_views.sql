create table if not exists public.user_workspace_views (
  user_id uuid not null references public.team_members(user_id) on delete cascade,
  page_key text not null check (page_key in ('live_signals')),
  last_viewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, page_key)
);

drop trigger if exists user_workspace_views_touch_updated_at
on public.user_workspace_views;
create trigger user_workspace_views_touch_updated_at
before update on public.user_workspace_views
for each row execute function public.touch_updated_at();

alter table public.user_workspace_views enable row level security;

revoke all on public.user_workspace_views from anon;
grant select, insert, update on public.user_workspace_views to authenticated;

drop policy if exists "users can read own workspace views"
on public.user_workspace_views;
create policy "users can read own workspace views"
on public.user_workspace_views for select to authenticated
using (public.is_team_member() and user_id = auth.uid());

drop policy if exists "users can insert own workspace views"
on public.user_workspace_views;
create policy "users can insert own workspace views"
on public.user_workspace_views for insert to authenticated
with check (public.is_team_member() and user_id = auth.uid());

drop policy if exists "users can update own workspace views"
on public.user_workspace_views;
create policy "users can update own workspace views"
on public.user_workspace_views for update to authenticated
using (public.is_team_member() and user_id = auth.uid())
with check (public.is_team_member() and user_id = auth.uid());

comment on table public.user_workspace_views is
  'Per-user workspace read cursors used for session-stable New indicators.';
