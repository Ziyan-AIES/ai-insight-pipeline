-- Shared Note/Signal fields, votes, discussion order, and topic kinds.

alter table public.news_items
  add column if not exists source_type text not null default 'captured_news'
    check (source_type in ('captured_news', 'manual_note')),
  add column if not exists vote_count integer not null default 0,
  add column if not exists discussion_order integer,
  add column if not exists takeaway text not null default '';

update public.news_items
set takeaway = coalesce(
  nullif(trim(takeaway), ''),
  nullif(trim(metadata -> 'implications' ->> 0), ''),
  ''
)
where coalesce(takeaway, '') = '';

create table if not exists public.news_votes (
  news_id uuid not null references public.news_items(id) on delete cascade,
  user_id uuid not null references public.team_members(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (news_id, user_id)
);

alter table public.news_votes enable row level security;

create policy "team can read news votes"
on public.news_votes for select to authenticated
using (private.current_team_role() is not null);

create policy "team can insert own votes"
on public.news_votes for insert to authenticated
with check (
  private.current_team_role() is not null
  and user_id = auth.uid()
);

create policy "team can delete own votes"
on public.news_votes for delete to authenticated
using (
  private.current_team_role() is not null
  and user_id = auth.uid()
);

create or replace function public.toggle_news_vote(p_news_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  already boolean;
  new_count integer;
begin
  if uid is null or private.current_team_role() is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.news_items n
    where n.id = p_news_id
      and n.deleted_at is null
  ) then
    raise exception 'note not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.news_votes v
    where v.news_id = p_news_id and v.user_id = uid
  ) into already;

  if already then
    delete from public.news_votes
    where news_id = p_news_id and user_id = uid;
  else
    insert into public.news_votes (news_id, user_id)
    values (p_news_id, uid);
  end if;

  select count(*)::integer into new_count
  from public.news_votes
  where news_id = p_news_id;

  update public.news_items
  set vote_count = new_count
  where id = p_news_id;

  return jsonb_build_object(
    'vote_count', new_count,
    'voted', not already
  );
end;
$$;

revoke all on function public.toggle_news_vote(uuid) from public;
grant execute on function public.toggle_news_vote(uuid) to authenticated;

create policy "editors can create curated notes"
on public.news_items for insert to authenticated
with check (
  private.current_team_role() in ('editor', 'admin')
  and deleted_at is null
);

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'topic_kind'
  ) then
    create type public.topic_kind as enum ('insight', 'poc', 'roadmap');
  end if;
end
$$;

alter table public.topics
  add column if not exists kind public.topic_kind not null default 'insight',
  add column if not exists analysis jsonb not null default '{}'::jsonb,
  add column if not exists outputs jsonb not null default '[]'::jsonb;

create index if not exists news_items_discussion_order_idx
  on public.news_items (discussion_order nulls last, vote_count desc, captured_at desc)
  where deleted_at is null;

create index if not exists topics_kind_created_idx
  on public.topics (kind, created_at desc)
  where deleted_at is null;
