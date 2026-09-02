-- Shared workspace search and explicit Trend health reviews.

alter table public.trends
  add column if not exists last_reviewed_at timestamptz;

comment on column public.trends.last_reviewed_at is
  'Last explicit health review. Separate from a discussion outcome.';

create or replace function public.search_workspace(
  p_query text,
  p_category public.news_category default null,
  p_contributor text default null,
  p_limit_per_type integer default 8
)
returns table (
  entity_type text,
  entity_id uuid,
  title text,
  category public.news_category,
  url text,
  contributor text,
  archived boolean,
  status text,
  kind text,
  owner_name text,
  evidence_count bigint,
  matched_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with parameters as (
    select
      lower(trim(coalesce(p_query, ''))) as needle,
      greatest(1, least(coalesce(p_limit_per_type, 8), 20)) as result_limit
  ),
  matches as (
    select
      'news'::text as entity_type,
      n.id as entity_id,
      n.title,
      n.category,
      n.canonical_url as url,
      coalesce(
        nullif(trim(tm.display_name), ''),
        nullif(trim(tm.email), ''),
        nullif(trim(n.metadata ->> 'contributor_name'), ''),
        nullif(trim(n.metadata ->> 'legacy_user'), ''),
        'Imported'
      ) as contributor,
      nullif(n.metadata ->> 'archived_at', '') is not null as archived,
      n.editorial_status::text as status,
      null::text as kind,
      null::text as owner_name,
      0::bigint as evidence_count,
      coalesce(n.published_at, n.captured_at) as matched_at
    from public.news_items n
    left join public.team_members tm on tm.user_id = n.captured_by
    cross join parameters p
    where n.deleted_at is null
      and p.needle <> ''
      and (p_category is null or n.category = p_category)
      and (
        p_contributor is null
        or lower(coalesce(
          nullif(trim(tm.display_name), ''),
          nullif(trim(tm.email), ''),
          nullif(trim(n.metadata ->> 'contributor_name'), ''),
          nullif(trim(n.metadata ->> 'legacy_user'), ''),
          'Imported'
        )) = lower(trim(p_contributor))
      )
      and strpos(
        lower(
          coalesce(n.title, '') || ' ' ||
          coalesce(n.source, '') || ' ' ||
          coalesce(n.summary, '') || ' ' ||
          coalesce(n.takeaway, '') || ' ' ||
          coalesce(n.team_synthesis, '') || ' ' ||
          coalesce(n.industry_importance, '') || ' ' ||
          coalesce(n.qira_relevance, '') || ' ' ||
          replace(n.category::text, '_', ' ') || ' ' ||
          coalesce(tm.display_name, '') || ' ' ||
          coalesce(tm.email, '')
        ),
        p.needle
      ) > 0

    union all

    select
      'trend'::text,
      t.id,
      t.title,
      t.category,
      null::text,
      null::text,
      t.status::text = 'archived',
      t.status::text,
      null::text,
      null::text,
      (
        select count(*)
        from public.trend_news tn
        where tn.trend_id = t.id and tn.deleted_at is null
      ),
      t.updated_at
    from public.trends t
    cross join parameters p
    where t.deleted_at is null
      and p.needle <> ''
      and p_contributor is null
      and (p_category is null or t.category = p_category)
      and strpos(
        lower(
          coalesce(t.title, '') || ' ' ||
          coalesce(t.observation, '') || ' ' ||
          coalesce(t.initial_read, '') || ' ' ||
          coalesce(t.discussion_question, '') || ' ' ||
          replace(t.category::text, '_', ' ')
        ),
        p.needle
      ) > 0

    union all

    select
      'topic'::text,
      t.id,
      t.title,
      t.category,
      null::text,
      null::text,
      false,
      coalesce(t.thread_status::text, t.status::text),
      t.kind::text,
      coalesce(nullif(trim(owner.display_name), ''), nullif(trim(owner.email), '')),
      (
        select count(*)
        from public.topic_news tn
        where tn.topic_id = t.id and tn.deleted_at is null
      ),
      t.updated_at
    from public.topics t
    left join public.team_members owner on owner.user_id = t.owner_id
    cross join parameters p
    where t.deleted_at is null
      and p.needle <> ''
      and p_contributor is null
      and (p_category is null or t.category = p_category)
      and strpos(
        lower(
          coalesce(t.title, '') || ' ' ||
          coalesce(t.notes, '') || ' ' ||
          coalesce(t.decision_summary, '') || ' ' ||
          coalesce(t.next_step, '') || ' ' ||
          coalesce(t.analysis::text, '') || ' ' ||
          coalesce(owner.display_name, '') || ' ' ||
          coalesce(owner.email, '') || ' ' ||
          replace(t.category::text, '_', ' ')
        ),
        p.needle
      ) > 0
  ),
  ranked as (
    select
      matches.*,
      row_number() over (
        partition by matches.entity_type
        order by matches.matched_at desc, matches.title
      ) as entity_rank
    from matches
  )
  select
    ranked.entity_type,
    ranked.entity_id,
    ranked.title,
    ranked.category,
    ranked.url,
    ranked.contributor,
    ranked.archived,
    ranked.status,
    ranked.kind,
    ranked.owner_name,
    ranked.evidence_count,
    ranked.matched_at
  from ranked
  cross join parameters p
  where ranked.entity_rank <= p.result_limit
  order by
    case ranked.entity_type when 'news' then 1 when 'trend' then 2 else 3 end,
    ranked.matched_at desc,
    ranked.title;
$$;

revoke all on function public.search_workspace(text, public.news_category, text, integer)
  from public;
grant execute on function public.search_workspace(text, public.news_category, text, integer)
  to authenticated, service_role;

do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array[
    'news_votes',
    'news_ideas',
    'trend_news',
    'trend_topics'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        realtime_table
      );
    end if;
  end loop;
end
$$;
