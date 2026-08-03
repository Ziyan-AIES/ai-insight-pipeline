create extension if not exists pgcrypto;

create type public.news_category as enum (
  'interaction',
  'ai_software',
  'ai_hardware',
  'ecosystem',
  'ai_capability',
  'industry_events'
);

create type public.editorial_status as enum ('pending', 'processed', 'failed');
create type public.topic_status as enum ('idea', 'researching', 'scheduled', 'published', 'archived');

create table public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  avatar_text text not null default '',
  role text not null default 'member' check (role in ('admin', 'editor', 'member')),
  created_at timestamptz not null default now()
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null unique,
  title text not null,
  source text not null default '',
  raw_text text not null default '',
  summary text not null default '',
  category public.news_category not null default 'ecosystem',
  image_url text not null default '',
  captured_at timestamptz not null default now(),
  captured_by uuid references public.team_members(user_id),
  captured_via text not null default 'dashboard'
    check (captured_via in ('dashboard', 'extension', 'migration', 'automation')),
  editorial_status public.editorial_status not null default 'pending',
  editorial_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.theses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  horizon text not null default '',
  display_order integer not null default 1,
  archived_at timestamptz,
  created_by uuid references public.team_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid references public.theses(id) on delete set null,
  parent_topic_id uuid references public.topics(id) on delete set null,
  title text not null,
  notes text not null default '',
  category public.news_category not null default 'ecosystem',
  status public.topic_status not null default 'idea',
  scheduled_month date not null,
  display_order integer not null default 1,
  created_by uuid references public.team_members(user_id),
  updated_by uuid references public.team_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topics_month_is_first check (extract(day from scheduled_month) = 1)
);

create table public.topic_news (
  topic_id uuid not null references public.topics(id) on delete cascade,
  news_id uuid not null references public.news_items(id) on delete cascade,
  display_order integer not null default 1,
  linked_by uuid references public.team_members(user_id),
  linked_at timestamptz not null default now(),
  primary key (topic_id, news_id)
);

create table public.editorial_readouts (
  id uuid primary key default gen_random_uuid(),
  period_type text not null check (period_type in ('week', 'month', 'quarter')),
  period_key text not null,
  lede text not null default '',
  bullets jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  generated_by text not null default 'automation',
  unique (period_type, period_key)
);

create table public.capture_events (
  id text primary key,
  event_kind text not null,
  canonical_url text,
  payload jsonb not null,
  occurred_at timestamptz not null,
  inserted_at timestamptz not null default now()
);

create index news_items_captured_at_idx on public.news_items (captured_at desc);
create index news_items_category_idx on public.news_items (category, captured_at desc);
create index topics_scheduled_month_idx on public.topics (scheduled_month, display_order);
create index topics_thesis_idx on public.topics (thesis_id, scheduled_month);
create index capture_events_url_idx on public.capture_events (canonical_url);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger news_items_touch_updated_at
before update on public.news_items
for each row execute function public.touch_updated_at();

create trigger theses_touch_updated_at
before update on public.theses
for each row execute function public.touch_updated_at();

create trigger topics_touch_updated_at
before update on public.topics
for each row execute function public.touch_updated_at();

alter table public.team_members enable row level security;
alter table public.news_items enable row level security;
alter table public.theses enable row level security;
alter table public.topics enable row level security;
alter table public.topic_news enable row level security;
alter table public.editorial_readouts enable row level security;
alter table public.capture_events enable row level security;

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members where user_id = auth.uid()
  );
$$;

create policy "team members can read team directory"
on public.team_members for select to authenticated
using (public.is_team_member());

create policy "team members can read news"
on public.news_items for select to authenticated
using (public.is_team_member());
create policy "team members can insert news"
on public.news_items for insert to authenticated
with check (public.is_team_member());
create policy "team members can update news"
on public.news_items for update to authenticated
using (public.is_team_member()) with check (public.is_team_member());

create policy "team members can manage theses"
on public.theses for all to authenticated
using (public.is_team_member()) with check (public.is_team_member());
create policy "team members can manage topics"
on public.topics for all to authenticated
using (public.is_team_member()) with check (public.is_team_member());
create policy "team members can manage topic news"
on public.topic_news for all to authenticated
using (public.is_team_member()) with check (public.is_team_member());
create policy "team members can read editorial readouts"
on public.editorial_readouts for select to authenticated
using (public.is_team_member());

alter publication supabase_realtime add table public.news_items;
alter publication supabase_realtime add table public.theses;
alter publication supabase_realtime add table public.topics;
alter publication supabase_realtime add table public.topic_news;

comment on table public.capture_events is
  'Append-only compatibility log for Browser Signal Watcher extension and migration replay.';
