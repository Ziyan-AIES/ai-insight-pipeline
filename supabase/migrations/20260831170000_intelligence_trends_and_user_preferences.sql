-- Trend-first intelligence layer and per-user workspace restoration.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'trend_status') then
    create type public.trend_status as enum ('draft', 'active', 'archived');
  end if;
end
$$;

create table if not exists public.trends (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category public.news_category not null default 'ecosystem',
  observation text not null default '',
  initial_read text not null default '',
  discussion_question text not null default '',
  status public.trend_status not null default 'draft',
  discussion_status public.discussion_status not null default 'not_discussed',
  last_discussed_at timestamptz,
  last_discussed_by uuid references public.team_members(user_id),
  meeting_nominated_at timestamptz,
  meeting_nominated_by uuid references public.team_members(user_id),
  created_by uuid references public.team_members(user_id),
  updated_by uuid references public.team_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.team_members(user_id),
  version bigint not null default 1
);

create table if not exists public.trend_news (
  trend_id uuid not null references public.trends(id) on delete cascade,
  news_id uuid not null references public.news_items(id) on delete cascade,
  evidence_role text not null default 'supporting'
    check (evidence_role in ('primary', 'supporting', 'counter')),
  display_order integer not null default 1,
  linked_by uuid references public.team_members(user_id),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.team_members(user_id),
  version bigint not null default 1,
  primary key (trend_id, news_id)
);

create table if not exists public.trend_topics (
  trend_id uuid not null references public.trends(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  linked_by uuid references public.team_members(user_id),
  linked_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.team_members(user_id),
  primary key (trend_id, topic_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.team_members(user_id) on delete cascade,
  last_workspace_page text not null default 'synthesis'
    check (last_workspace_page in ('signals', 'synthesis', 'threads')),
  updated_at timestamptz not null default now()
);

drop trigger if exists trends_bump_content_version on public.trends;
create trigger trends_bump_content_version
before update on public.trends
for each row execute function private.bump_content_version();

drop trigger if exists trends_enforce_soft_delete_boundary on public.trends;
create trigger trends_enforce_soft_delete_boundary
before update on public.trends
for each row execute function private.enforce_soft_delete_boundary();

drop trigger if exists trend_news_bump_content_version on public.trend_news;
create trigger trend_news_bump_content_version
before update on public.trend_news
for each row execute function private.bump_content_version();

drop trigger if exists trend_news_enforce_soft_delete_boundary on public.trend_news;
create trigger trend_news_enforce_soft_delete_boundary
before update on public.trend_news
for each row execute function private.enforce_soft_delete_boundary();

drop trigger if exists user_preferences_touch_updated_at on public.user_preferences;
create trigger user_preferences_touch_updated_at
before update on public.user_preferences
for each row execute function public.touch_updated_at();

drop trigger if exists trends_audit on public.trends;
create trigger trends_audit
after insert or update or delete on public.trends
for each row execute function private.audit_content_change();

alter table public.trends enable row level security;
alter table public.trend_news enable row level security;
alter table public.trend_topics enable row level security;
alter table public.user_preferences enable row level security;

revoke all on public.trends from anon;
revoke all on public.trend_news from anon;
revoke all on public.trend_topics from anon;
revoke all on public.user_preferences from anon;
grant select, insert, update, delete on public.trends to authenticated;
grant select, insert, update, delete on public.trend_news to authenticated;
grant select, insert, update, delete on public.trend_topics to authenticated;
grant select, insert, update on public.user_preferences to authenticated;

drop policy if exists "team can read trends" on public.trends;
create policy "team can read trends"
on public.trends for select to authenticated
using (private.current_team_role() is not null);

drop policy if exists "editors can create trends" on public.trends;
create policy "editors can create trends"
on public.trends for insert to authenticated
with check (
  private.current_team_role() in ('editor', 'admin')
  and deleted_at is null
  and created_by = auth.uid()
);

drop policy if exists "editors can update trends" on public.trends;
create policy "editors can update trends"
on public.trends for update to authenticated
using (private.current_team_role() in ('editor', 'admin'))
with check (private.current_team_role() in ('editor', 'admin'));

drop policy if exists "admins can delete trends" on public.trends;
create policy "admins can delete trends"
on public.trends for delete to authenticated
using (private.current_team_role() = 'admin');

drop policy if exists "team can read trend evidence" on public.trend_news;
create policy "team can read trend evidence"
on public.trend_news for select to authenticated
using (private.current_team_role() is not null);

drop policy if exists "editors can manage trend evidence" on public.trend_news;
create policy "editors can manage trend evidence"
on public.trend_news for all to authenticated
using (private.current_team_role() in ('editor', 'admin'))
with check (private.current_team_role() in ('editor', 'admin'));

drop policy if exists "team can read trend threads" on public.trend_topics;
create policy "team can read trend threads"
on public.trend_topics for select to authenticated
using (private.current_team_role() is not null);

drop policy if exists "editors can manage trend threads" on public.trend_topics;
create policy "editors can manage trend threads"
on public.trend_topics for all to authenticated
using (private.current_team_role() in ('editor', 'admin'))
with check (private.current_team_role() in ('editor', 'admin'));

drop policy if exists "users can read own preferences" on public.user_preferences;
create policy "users can read own preferences"
on public.user_preferences for select to authenticated
using (private.current_team_role() is not null and user_id = auth.uid());

drop policy if exists "users can insert own preferences" on public.user_preferences;
create policy "users can insert own preferences"
on public.user_preferences for insert to authenticated
with check (private.current_team_role() is not null and user_id = auth.uid());

drop policy if exists "users can update own preferences" on public.user_preferences;
create policy "users can update own preferences"
on public.user_preferences for update to authenticated
using (private.current_team_role() is not null and user_id = auth.uid())
with check (private.current_team_role() is not null and user_id = auth.uid());

create index if not exists trends_active_updated_idx
  on public.trends (status, updated_at desc) where deleted_at is null;
create index if not exists trends_category_updated_idx
  on public.trends (category, updated_at desc) where deleted_at is null;
create index if not exists trend_news_visible_news_idx
  on public.trend_news (news_id, trend_id) where deleted_at is null;
create index if not exists trend_topics_visible_topic_idx
  on public.trend_topics (topic_id, trend_id) where deleted_at is null;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trends'
  ) then
    alter publication supabase_realtime add table public.trends;
  end if;
end
$$;

comment on table public.trends is
  'Evidence-backed emerging changes. Trends are independent from discussion outcomes and Action Threads.';
comment on table public.trend_news is
  'Supporting, primary, or counter evidence attached to a Trend.';
comment on table public.trend_topics is
  'Action Threads created from or linked to a Trend.';
