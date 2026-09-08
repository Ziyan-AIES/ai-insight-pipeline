begin;
select plan(6);

insert into public.news_items (
  id, canonical_url, title, source, summary, takeaway, team_synthesis,
  category, raw_text, image_url, captured_at, captured_via, editorial_status,
  metadata
) values (
  '00000000-0000-0000-0000-000000000061',
  'https://example.com/manual-field-test', 'Human title', 'Example',
  'Human summary', 'Human takeaway', 'Human synthesis', 'interaction', '', '',
  now(), 'dashboard', 'pending',
  '{"manual_field_locks":{"title":{"edited_at":"2026-09-08T00:00:00Z"},"summary":{"edited_at":"2026-09-08T00:00:00Z"},"takeaway":{"edited_at":"2026-09-08T00:00:00Z"},"team_synthesis":{"edited_at":"2026-09-08T00:00:00Z"},"category":{"edited_at":"2026-09-08T00:00:00Z"}}}'::jsonb
);

update public.news_items set
  title = 'AI title', summary = 'AI summary', takeaway = 'AI takeaway',
  team_synthesis = 'AI synthesis', category = 'ecosystem',
  metadata = metadata || '{"editorial":{"run":"test"}}'::jsonb
where id = '00000000-0000-0000-0000-000000000061';

select is(title, 'Human title', 'manual title survives automated update')
from public.news_items where id = '00000000-0000-0000-0000-000000000061';
select is(summary, 'Human summary', 'manual summary survives automated update')
from public.news_items where id = '00000000-0000-0000-0000-000000000061';
select is(takeaway, 'Human takeaway', 'manual takeaway survives automated update')
from public.news_items where id = '00000000-0000-0000-0000-000000000061';
select is(team_synthesis, 'Human synthesis', 'manual synthesis survives automated update')
from public.news_items where id = '00000000-0000-0000-0000-000000000061';
select is(category::text, 'interaction', 'manual category survives automated update')
from public.news_items where id = '00000000-0000-0000-0000-000000000061';

update public.news_items set
  category = 'ai_capability',
  metadata = jsonb_set(
    metadata,
    '{manual_field_locks,category}',
    '{"edited_at":"2026-09-08T01:00:00Z"}'::jsonb
  )
where id = '00000000-0000-0000-0000-000000000061';

select is(category::text, 'ai_capability', 'a refreshed manual marker permits a new human value')
from public.news_items where id = '00000000-0000-0000-0000-000000000061';

select * from finish();
rollback;
