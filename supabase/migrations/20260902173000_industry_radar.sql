-- External source coverage and machine-observed Industry Radar evidence.

alter table public.user_preferences
  drop constraint if exists user_preferences_last_workspace_page_check;
alter table public.user_preferences
  add constraint user_preferences_last_workspace_page_check
  check (last_workspace_page in ('radar', 'signals', 'synthesis', 'threads'));

create table if not exists public.radar_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  domain text not null check (char_length(domain) between 1 and 255),
  homepage_url text not null check (homepage_url ~ '^https?://'),
  feed_url text not null default '' check (feed_url = '' or feed_url ~ '^https?://'),
  source_type text not null default 'industry_news'
    check (source_type in ('industry_news', 'official', 'product_discovery', 'investor', 'community')),
  connector_type text not null default 'rss'
    check (connector_type in ('rss', 'producthunt', 'hacker_news')),
  enabled boolean not null default true,
  priority smallint not null default 50 check (priority between 0 and 100),
  display_order integer not null default 1,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_error text not null default '',
  created_by uuid references public.team_members(user_id),
  updated_by uuid references public.team_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists radar_sources_active_domain_idx
  on public.radar_sources (lower(domain)) where deleted_at is null;
create index if not exists radar_sources_order_idx
  on public.radar_sources (display_order, name) where deleted_at is null;

create table if not exists public.radar_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.radar_sources(id),
  external_id text not null check (char_length(external_id) between 1 and 500),
  canonical_url text not null check (canonical_url ~ '^https?://'),
  title text not null check (char_length(title) between 1 and 500),
  summary text not null default '',
  author text not null default '',
  published_at timestamptz not null,
  discovered_at timestamptz not null default now(),
  story_key text not null,
  topic_slugs text[] not null default '{}',
  engagement jsonb not null default '{}',
  raw_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index if not exists radar_items_published_idx
  on public.radar_items (published_at desc);
create index if not exists radar_items_source_published_idx
  on public.radar_items (source_id, published_at desc);
create index if not exists radar_items_story_idx
  on public.radar_items (story_key, published_at desc);
create index if not exists radar_items_topics_idx
  on public.radar_items using gin (topic_slugs);

drop trigger if exists radar_sources_touch_updated_at on public.radar_sources;
create trigger radar_sources_touch_updated_at
before update on public.radar_sources
for each row execute function public.touch_updated_at();

drop trigger if exists radar_items_touch_updated_at on public.radar_items;
create trigger radar_items_touch_updated_at
before update on public.radar_items
for each row execute function public.touch_updated_at();

alter table public.radar_sources enable row level security;
alter table public.radar_items enable row level security;

revoke all on public.radar_sources from anon;
revoke all on public.radar_items from anon;
grant select, insert, update, delete on public.radar_sources to authenticated;
grant select on public.radar_items to authenticated;

drop policy if exists "team can read radar sources" on public.radar_sources;
create policy "team can read radar sources"
on public.radar_sources for select to authenticated
using (private.current_team_role() is not null);

drop policy if exists "admins can add radar sources" on public.radar_sources;
create policy "admins can add radar sources"
on public.radar_sources for insert to authenticated
with check (
  private.current_team_role() = 'admin'
  and created_by = auth.uid()
  and deleted_at is null
);

drop policy if exists "admins can update radar sources" on public.radar_sources;
create policy "admins can update radar sources"
on public.radar_sources for update to authenticated
using (private.current_team_role() = 'admin')
with check (private.current_team_role() = 'admin');

drop policy if exists "admins can delete radar sources" on public.radar_sources;
create policy "admins can delete radar sources"
on public.radar_sources for delete to authenticated
using (private.current_team_role() = 'admin');

drop policy if exists "team can read radar items" on public.radar_items;
create policy "team can read radar items"
on public.radar_items for select to authenticated
using (private.current_team_role() is not null);

insert into public.radar_sources (
  id, name, domain, homepage_url, feed_url, source_type, connector_type, priority, display_order
)
values
  ('a1000000-0000-4000-8000-000000000001', 'Product Hunt', 'producthunt.com', 'https://www.producthunt.com/', '', 'product_discovery', 'producthunt', 80, 1),
  ('a1000000-0000-4000-8000-000000000002', 'TechCrunch', 'techcrunch.com', 'https://techcrunch.com/', 'https://techcrunch.com/feed/', 'industry_news', 'rss', 90, 2),
  ('a1000000-0000-4000-8000-000000000003', 'VentureBeat', 'venturebeat.com', 'https://venturebeat.com/category/ai/', 'https://venturebeat.com/feed/', 'industry_news', 'rss', 85, 3),
  ('a1000000-0000-4000-8000-000000000004', 'The Verge AI', 'theverge.com', 'https://www.theverge.com/ai-artificial-intelligence', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'industry_news', 'rss', 82, 4),
  ('a1000000-0000-4000-8000-000000000005', 'MIT Technology Review', 'technologyreview.com', 'https://www.technologyreview.com/topic/artificial-intelligence/', 'https://www.technologyreview.com/feed/', 'industry_news', 'rss', 80, 5),
  ('a1000000-0000-4000-8000-000000000006', 'OpenAI News', 'openai.com', 'https://openai.com/news/', 'https://openai.com/news/rss.xml', 'official', 'rss', 75, 6),
  ('a1000000-0000-4000-8000-000000000007', 'Google AI', 'blog.google', 'https://blog.google/technology/ai/', 'https://blog.google/technology/ai/rss/', 'official', 'rss', 72, 7),
  ('a1000000-0000-4000-8000-000000000008', 'Hacker News', 'news.ycombinator.com', 'https://news.ycombinator.com/', '', 'community', 'hacker_news', 55, 8),
  ('a1000000-0000-4000-8000-000000000009', 'a16z AI', 'a16z.com', 'https://a16z.com/category/ai/', 'https://a16z.com/feed/', 'investor', 'rss', 45, 9)
on conflict (id) do update set
  name = excluded.name,
  domain = excluded.domain,
  homepage_url = excluded.homepage_url,
  feed_url = excluded.feed_url,
  source_type = excluded.source_type,
  connector_type = excluded.connector_type,
  priority = excluded.priority,
  display_order = excluded.display_order;

comment on table public.radar_sources is
  'Transparent, team-visible coverage configuration for Industry Radar. Soft removal preserves historical evidence.';
comment on table public.radar_items is
  'Machine-collected external evidence. Items remain separate from editorial news_items until a user promotes one.';
comment on column public.radar_items.story_key is
  'Event-level near-duplicate key used so syndicated reporting does not inflate trend counts.';
