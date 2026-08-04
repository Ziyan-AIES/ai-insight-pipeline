alter type public.topic_status add value if not exists 'completed' before 'archived';

create policy "team members can delete news"
on public.news_items for delete to authenticated
using (public.is_team_member());

comment on column public.topics.status is
  'Lifecycle: idea, researching, scheduled, published, completed, or archived.';
