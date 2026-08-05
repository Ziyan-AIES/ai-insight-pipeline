alter table public.news_items
  add column if not exists published_at date;

create index if not exists news_items_effective_date_idx
  on public.news_items (
    (coalesce(published_at, captured_at::date)) desc
  )
  where deleted_at is null;

comment on column public.news_items.published_at is
  'Article publication date supplied by an editor; captured_at remains the ingestion timestamp.';
