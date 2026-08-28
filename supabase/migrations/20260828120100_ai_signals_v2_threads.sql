-- AI Signals v2: Action Thread status, signal synthesis, anonymous ideas.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'thread_status') then
    create type public.thread_status as enum ('open', 'in_progress', 'parked', 'closed');
  end if;
end
$$;

alter table public.topics
  add column if not exists thread_status public.thread_status not null default 'open';

update public.topics
set thread_status = case status::text
  when 'completed' then 'closed'::public.thread_status
  when 'archived' then 'parked'::public.thread_status
  when 'researching' then 'in_progress'::public.thread_status
  when 'published' then 'in_progress'::public.thread_status
  else 'open'::public.thread_status
end;

alter table public.news_items
  add column if not exists industry_importance text not null default '',
  add column if not exists qira_relevance text not null default '',
  add column if not exists team_synthesis text not null default '',
  add column if not exists discussion_priority_score numeric not null default 0,
  add column if not exists last_reviewed_at timestamptz;

create table if not exists public.news_ideas (
  id uuid primary key default gen_random_uuid(),
  news_id uuid references public.news_items(id) on delete set null,
  user_id uuid not null references public.team_members(user_id) on delete cascade,
  content text not null,
  input_type text not null default 'text'
    check (input_type in ('text', 'voice')),
  created_at timestamptz not null default now()
);

alter table public.news_ideas enable row level security;

drop policy if exists "team can read news ideas" on public.news_ideas;
create policy "team can read news ideas"
on public.news_ideas for select to authenticated
using (private.current_team_role() is not null);

drop policy if exists "team can insert own ideas" on public.news_ideas;
create policy "team can insert own ideas"
on public.news_ideas for insert to authenticated
with check (
  private.current_team_role() is not null
  and user_id = auth.uid()
);

create index if not exists news_ideas_news_id_idx on public.news_ideas (news_id);
create index if not exists news_items_updated_at_idx on public.news_items (updated_at desc);
