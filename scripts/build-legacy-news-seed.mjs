import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const [, , sourceArg, outputArg] = process.argv
if (!sourceArg) {
  throw new Error('Usage: node scripts/build-legacy-news-seed.mjs <articles.json> [output.sql]')
}

const sourcePath = path.resolve(sourceArg)
const outputPath = path.resolve(
  outputArg || 'supabase/seed-legacy-news.sql',
)
const jsonOutputPath = outputPath.replace(/\.sql$/i, '.json')
const payload = JSON.parse(await fs.readFile(sourcePath, 'utf8'))
const articles = Array.isArray(payload) ? payload : payload.articles || []

const rows = articles.map((item) => ({
  canonical_url: item.url,
  title: item.title || 'Untitled',
  source: item.source || '',
  raw_text: item.summary || '',
  summary: item.summary || '',
  category: item.topic || 'ecosystem',
  image_url: item.selected_image || '',
  captured_at: `${item.date}T04:00:00Z`,
  captured_via: 'migration',
  editorial_status: item.summary ? 'processed' : 'pending',
  editorial_updated_at: item.summary ? new Date().toISOString() : null,
  metadata: {
    legacy_article_id: item.article_id,
    legacy_week: item.week,
    news_facts: item.news_facts || [],
    implications: item.implications || [],
    save_count: item.save_count || 0,
    comment_count: item.comment_count || 0,
    latest_comment: item.latest_comment || '',
    imported_from: 'browser-signal-watcher',
  },
}))

const json = JSON.stringify(rows, null, 2).replaceAll('$legacy$', '$ legacy $')
const sql = `-- Generated from Browser Signal Watcher curated agent view.
-- Idempotent: canonical_url is the conflict key.
insert into public.news_items (
  canonical_url,
  title,
  source,
  raw_text,
  summary,
  category,
  image_url,
  captured_at,
  captured_via,
  editorial_status,
  editorial_updated_at,
  metadata
)
select
  item.canonical_url,
  item.title,
  item.source,
  item.raw_text,
  item.summary,
  item.category::public.news_category,
  item.image_url,
  item.captured_at,
  item.captured_via,
  item.editorial_status::public.editorial_status,
  item.editorial_updated_at,
  item.metadata
from jsonb_to_recordset($legacy$
${json}
$legacy$::jsonb) as item(
  canonical_url text,
  title text,
  source text,
  raw_text text,
  summary text,
  category text,
  image_url text,
  captured_at timestamptz,
  captured_via text,
  editorial_status text,
  editorial_updated_at timestamptz,
  metadata jsonb
)
on conflict (canonical_url) do update set
  title = excluded.title,
  source = excluded.source,
  raw_text = excluded.raw_text,
  summary = excluded.summary,
  category = excluded.category,
  image_url = excluded.image_url,
  captured_at = excluded.captured_at,
  captured_via = excluded.captured_via,
  editorial_status = excluded.editorial_status,
  editorial_updated_at = excluded.editorial_updated_at,
  metadata = excluded.metadata;
`

await fs.writeFile(outputPath, sql, 'utf8')
await fs.writeFile(jsonOutputPath, JSON.stringify(rows), 'utf8')
console.log(
  JSON.stringify({
    output: outputPath,
    json: jsonOutputPath,
    rows: rows.length,
  }),
)
