-- Trend and Action Thread are consecutive maturity stages of one workflow.
-- Keep the legacy evidence_role column for API compatibility, while making all
-- visible evidence equivalent in the product.

update public.trend_news
set evidence_role = 'supporting'
where evidence_role <> 'supporting';

alter table public.trend_news
  alter column evidence_role set default 'supporting';

comment on column public.trend_news.evidence_role is
  'Compatibility field. The product treats every Trend signal as equivalent evidence.';

comment on column public.trends.status is
  'Workflow state: active means Watching; archived means dismissed. A Trend linked through trend_topics has been upgraded to an Action Thread.';

