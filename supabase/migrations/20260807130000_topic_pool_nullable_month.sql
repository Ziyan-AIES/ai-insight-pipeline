-- Allow topics without a scheduled month so they can live in the Topic Pool.
alter table public.topics
  alter column scheduled_month drop not null;

comment on column public.topics.scheduled_month is
  'First day of the planned month, or null when the topic is unscheduled in the Topic Pool.';
