-- Keep discussion outcomes, meeting nominations, and Thread membership independent.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'discussion_status') then
    create type public.discussion_status as enum (
      'not_discussed', 'discussed', 'dismissed'
    );
  end if;
end
$$;

alter table public.news_items
  add column if not exists discussion_status public.discussion_status
    not null default 'not_discussed',
  add column if not exists meeting_nominated_at timestamptz,
  add column if not exists meeting_nominated_by uuid
    references public.team_members(user_id);

update public.news_items
set discussion_status = 'discussed'::public.discussion_status
where discussion_status = 'not_discussed'::public.discussion_status
  and (
    discussed_at is not null
    or discussion_state::text = 'discussed'
  );

create index if not exists news_items_discussion_status_idx
  on public.news_items (discussion_status, captured_at desc)
  where deleted_at is null;

create index if not exists news_items_manual_meeting_queue_idx
  on public.news_items (meeting_nominated_at desc)
  where meeting_nominated_at is not null and deleted_at is null;

comment on column public.news_items.discussion_status is
  'Explicit team outcome. Thread membership and meeting eligibility are independent.';
comment on column public.news_items.meeting_nominated_at is
  'Manual editorial nomination. Votes, thoughts, and active Thread links are additional derived nomination reasons.';
