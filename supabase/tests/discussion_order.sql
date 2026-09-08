begin;
select plan(7);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000091',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'order-test@example.com', '',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.team_members (user_id, email, display_name, role)
values (
  '00000000-0000-4000-8000-000000000091',
  'order-test@example.com', 'Order Test', 'editor'
);
insert into public.news_items (id, canonical_url, title, version)
values
  ('00000000-0000-4000-8000-000000000092', 'https://example.com/order-a', 'A', 1),
  ('00000000-0000-4000-8000-000000000093', 'https://example.com/order-b', 'B', 1);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',
  true
);

select lives_ok(
  $test$
    select public.persist_discussion_order('[
      {"id":"00000000-0000-4000-8000-000000000093","position":1,"expected_version":1},
      {"id":"00000000-0000-4000-8000-000000000092","position":2,"expected_version":1}
    ]'::jsonb)
  $test$,
  'an editor can save a complete ordering'
);
select is(discussion_order, 1, 'first requested row receives position one')
from public.news_items where id = '00000000-0000-4000-8000-000000000093';
select is(discussion_order, 2, 'second requested row receives position two')
from public.news_items where id = '00000000-0000-4000-8000-000000000092';
select is(version, 2::bigint, 'ordering increments row versions')
from public.news_items where id = '00000000-0000-4000-8000-000000000092';

select throws_ok(
  $test$
    select public.persist_discussion_order('[
      {"id":"00000000-0000-4000-8000-000000000092","position":1,"expected_version":1},
      {"id":"00000000-0000-4000-8000-000000000093","position":2,"expected_version":1}
    ]'::jsonb)
  $test$,
  '40001',
  'discussion order conflict: reload and try again',
  'a stale second editor is rejected before writes'
);
select is(discussion_order, 1, 'failed stale request leaves prior order intact')
from public.news_items where id = '00000000-0000-4000-8000-000000000093';
select throws_ok(
  $test$
    select public.persist_discussion_order('[
      {"id":"00000000-0000-4000-8000-000000000092","position":1,"expected_version":2},
      {"id":"00000000-0000-4000-8000-000000000092","position":2,"expected_version":2}
    ]'::jsonb)
  $test$,
  '22023',
  'duplicate discussion item',
  'duplicate IDs are rejected'
);

reset role;
update public.team_members set role = 'member'
where user_id = '00000000-0000-4000-8000-000000000091';
set local role authenticated;
select throws_ok(
  $test$
    select public.persist_discussion_order('[
      {"id":"00000000-0000-4000-8000-000000000092","position":1,"expected_version":2}
    ]'::jsonb)
  $test$,
  '42501',
  'not allowed',
  'members cannot reorder the editorial queue'
);

select * from finish();
rollback;
