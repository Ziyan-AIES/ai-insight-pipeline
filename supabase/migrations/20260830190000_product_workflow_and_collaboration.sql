-- Product workflow: make team discussion state and thread accountability first-class.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'discussion_state') then
    create type public.discussion_state as enum (
      'needs_discussion', 'discussed', 'in_thread'
    );
  end if;
end
$$;

alter table public.news_items
  add column if not exists discussion_state public.discussion_state
    not null default 'needs_discussion',
  add column if not exists discussed_at timestamptz,
  add column if not exists discussed_by uuid references public.team_members(user_id);

update public.news_items
set
  discussion_state = 'discussed',
  discussed_at = coalesce(
    discussed_at,
    nullif(metadata ->> 'discussion_completed_at', '')::timestamptz
  )
where nullif(metadata ->> 'discussion_completed_at', '') is not null;

update public.news_items n
set discussion_state = 'in_thread'
where exists (
  select 1 from public.topic_news tn
  where tn.news_id = n.id and tn.deleted_at is null
);

alter table public.topics
  add column if not exists owner_id uuid references public.team_members(user_id),
  add column if not exists decision_summary text not null default '',
  add column if not exists next_step text not null default '',
  add column if not exists outcome_url text not null default '';

create index if not exists news_items_discussion_state_idx
  on public.news_items (discussion_state, captured_at desc)
  where deleted_at is null;

create or replace function private.sync_news_discussion_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_news_id uuid;
begin
  target_news_id := case when tg_op = 'DELETE' then old.news_id else new.news_id end;
  if exists (
    select 1 from public.topic_news
    where news_id = target_news_id and deleted_at is null
  ) then
    update public.news_items
    set discussion_state = 'in_thread'
    where id = target_news_id;
  else
    update public.news_items
    set
      discussion_state = 'discussed',
      discussed_at = coalesce(discussed_at, now())
    where id = target_news_id and discussion_state = 'in_thread';
  end if;
  return null;
end;
$$;

drop trigger if exists topic_news_sync_discussion_state on public.topic_news;
create trigger topic_news_sync_discussion_state
after insert or update of deleted_at or delete on public.topic_news
for each row execute function private.sync_news_discussion_state();

comment on column public.news_items.discussion_state is
  'Team workflow state. AI review remains independently represented by editorial_status.';
comment on column public.topics.decision_summary is
  'The current team decision or agreed point of view for this Action Thread.';
