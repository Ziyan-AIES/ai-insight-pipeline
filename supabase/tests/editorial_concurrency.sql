begin;

select plan(15);

select has_function(
  'public',
  'apply_editorial_sync_guarded',
  array['jsonb', 'jsonb', 'text', 'uuid', 'text', 'text'],
  'guarded editorial apply exists'
);
select has_function(
  'public',
  'record_editorial_run_failure_guarded',
  array['text', 'uuid', 'text', 'text'],
  'guarded editorial failure release exists'
);
insert into public.editorial_job_runs (
  id, external_run_id, status, lease_owner, lease_expires_at, claimed_count
) values
  ('10000000-0000-4000-8000-000000000001', 'run-a', 'running', 'runner-a', now() - interval '1 minute', 1),
  ('10000000-0000-4000-8000-000000000002', 'run-b', 'running', 'runner-b', now() + interval '30 minutes', 3);

insert into public.news_items (
  id, canonical_url, title, source, raw_text, summary, category,
  editorial_status, version, editorial_run_id, editorial_lease_owner,
  editorial_lease_expires_at, deleted_at
) values
  (
    '20000000-0000-4000-8000-000000000001', 'https://example.com/good',
    'Human title', 'Example', 'Source text', 'Original summary', 'ecosystem',
    'pending', 7, '10000000-0000-4000-8000-000000000002', 'runner-b',
    now() + interval '30 minutes', null
  ),
  (
    '20000000-0000-4000-8000-000000000002', 'https://example.com/version-conflict',
    'Second human title', 'Example', 'Source text', 'Original summary', 'ecosystem',
    'pending', 9, '10000000-0000-4000-8000-000000000002', 'runner-b',
    now() + interval '30 minutes', null
  ),
  (
    '20000000-0000-4000-8000-000000000003', 'https://example.com/deleted',
    'Deleted title', 'Example', 'Source text', 'Original summary', 'ecosystem',
    'pending', 4, '10000000-0000-4000-8000-000000000002', 'runner-b',
    now() + interval '30 minutes', now()
  );

select throws_ok(
  $test$
    select public.apply_editorial_sync_guarded(
      jsonb_build_array(jsonb_build_object(
        'news_id', '20000000-0000-4000-8000-000000000001',
        'expected_version', 7,
        'canonical_url', 'https://example.com/good',
        'title', 'Stale A title'
      )),
      '[]'::jsonb, 'run-a', '10000000-0000-4000-8000-000000000001',
      'runner-a', repeat('a', 64)
    )
  $test$,
  '40001',
  'editorial lease conflict: claim is no longer current',
  'an expired A lease cannot submit after B owns the item'
);

select is(
  public.record_editorial_run_failure_guarded(
    'run-a', '10000000-0000-4000-8000-000000000001', 'runner-a', 'late failure'
  ),
  false,
  'an expired A lease cannot release work'
);
select is(
  (select editorial_run_id from public.news_items where id = '20000000-0000-4000-8000-000000000001'),
  '10000000-0000-4000-8000-000000000002'::uuid,
  'A failure handling leaves B ownership intact'
);

select throws_ok(
  $test$
    select public.apply_editorial_sync_guarded(
      jsonb_build_array(
        jsonb_build_object(
          'news_id', '20000000-0000-4000-8000-000000000001',
          'expected_version', 7,
          'canonical_url', 'https://example.com/good',
          'title', 'AI title'
        ),
        jsonb_build_object(
          'news_id', '20000000-0000-4000-8000-000000000002',
          'expected_version', 8,
          'canonical_url', 'https://example.com/version-conflict',
          'title', 'Stale AI title'
        )
      ),
      '[]'::jsonb, 'run-b', '10000000-0000-4000-8000-000000000002',
      'runner-b', repeat('b', 64)
    )
  $test$,
  '40001',
  'editorial snapshot conflict: item changed, expired, reassigned, or deleted',
  'one changed version rejects the complete batch'
);
select is(
  (select title from public.news_items where id = '20000000-0000-4000-8000-000000000001'),
  'Human title',
  'the valid row was not partially updated after a batch conflict'
);

select throws_ok(
  $test$
    select public.apply_editorial_sync_guarded(
      jsonb_build_array(jsonb_build_object(
        'news_id', '20000000-0000-4000-8000-000000000001',
        'canonical_url', 'https://example.com/good'
      )),
      '[]'::jsonb, 'run-b', '10000000-0000-4000-8000-000000000002',
      'runner-b', repeat('c', 64)
    )
  $test$,
  '22023',
  'invalid editorial snapshot item',
  'missing expected version is rejected'
);

select throws_ok(
  $test$
    select public.apply_editorial_sync_guarded(
      jsonb_build_array(jsonb_build_object(
        'news_id', '20000000-0000-4000-8000-000000000003',
        'expected_version', 4,
        'canonical_url', 'https://example.com/deleted'
      )),
      '[]'::jsonb, 'run-b', '10000000-0000-4000-8000-000000000002',
      'runner-b', repeat('d', 64)
    )
  $test$,
  '40001',
  'editorial snapshot conflict: item changed, expired, reassigned, or deleted',
  'a deleted row is rejected'
);

create temporary table editorial_first_result(result jsonb);
insert into editorial_first_result
select public.apply_editorial_sync_guarded(
  jsonb_build_array(jsonb_build_object(
    'news_id', '20000000-0000-4000-8000-000000000001',
    'expected_version', 7,
    'canonical_url', 'https://example.com/good',
    'title', 'Reviewed title',
    'summary', 'Reviewed summary',
    'category', 'ai_capability',
    'editorial_metadata', jsonb_build_object('evidence', jsonb_build_array('fact'))
  )),
  '[]'::jsonb, 'run-b', '10000000-0000-4000-8000-000000000002',
  'runner-b', repeat('e', 64)
);

select is(
  (select title from public.news_items where id = '20000000-0000-4000-8000-000000000001'),
  'Reviewed title',
  'a current version and lease can be applied'
);
select is(
  (select editorial_status::text from public.news_items where id = '20000000-0000-4000-8000-000000000001'),
  'processed',
  'successful apply marks the item processed'
);
select is(
  (select editorial_lease_owner from public.news_items where id = '20000000-0000-4000-8000-000000000001'),
  null::text,
  'successful apply clears its own item lease'
);
select is(
  (select result ->> 'idempotent_replay' from editorial_first_result),
  'false',
  'the initial apply is not marked as a replay'
);

select is(
  (
    select public.apply_editorial_sync_guarded(
      jsonb_build_array(jsonb_build_object(
        'news_id', '20000000-0000-4000-8000-000000000001',
        'expected_version', 7,
        'canonical_url', 'https://example.com/good',
        'title', 'Reviewed title',
        'summary', 'Reviewed summary',
        'category', 'ai_capability',
        'editorial_metadata', jsonb_build_object('evidence', jsonb_build_array('fact'))
      )),
      '[]'::jsonb, 'run-b', '10000000-0000-4000-8000-000000000002',
      'runner-b', repeat('e', 64)
    ) ->> 'idempotent_replay'
  ),
  'true',
  'an identical request can be retried without writing again'
);
select is(
  (select version from public.news_items where id = '20000000-0000-4000-8000-000000000001'),
  8::bigint,
  'an idempotent retry does not increment the row version again'
);

select * from finish();
rollback;
