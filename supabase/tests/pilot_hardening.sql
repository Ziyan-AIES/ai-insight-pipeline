begin;

select plan(15);

select has_column('public', 'news_items', 'deleted_at', 'news has soft deletion');
select has_column('public', 'news_items', 'version', 'news has row versioning');
select has_column('public', 'news_items', 'published_at', 'news can store publication date');
select has_column('public', 'topics', 'deleted_at', 'topics have soft deletion');
select has_column('public', 'theses', 'deleted_at', 'theses have soft deletion');
select has_table('public', 'activity_events', 'activity history exists');
select has_table('public', 'legacy_migrations', 'durable migration markers exist');
select has_table('public', 'editorial_job_runs', 'editorial runs are observable');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.activity_events'::regclass),
  'activity history has RLS enabled'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'news_items'
      and policyname = 'members can maintain own pending news'
  ),
  'member draft policy exists'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'news_items'
      and policyname = 'admins can permanently delete news'
  ),
  'permanent deletion is admin-scoped'
);
select has_function(
  'public',
  'capture_news_event',
  array['text', 'text', 'text', 'text', 'text', 'text', 'text', 'timestamp with time zone', 'jsonb', 'jsonb'],
  'capture uses a narrow RPC'
);
select has_function(
  'public',
  'claim_editorial_job',
  array['text', 'text', 'integer', 'integer'],
  'editorial work can be leased'
);
select has_function(
  'public',
  'update_news_with_version',
  array['uuid', 'bigint', 'jsonb'],
  'news supports optimistic concurrency'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.capture_news_event(text,text,text,text,text,text,text,timestamp with time zone,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated clients cannot invoke service capture RPC'
);

select * from finish();
rollback;
