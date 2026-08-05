import fs from 'node:fs/promises'
import process from 'node:process'

const targetUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const actorId = process.env.LEGACY_MIGRATION_ACTOR_ID || ''

if (!targetUrl || !targetKey || !actorId) {
  throw new Error(
    'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and LEGACY_MIGRATION_ACTOR_ID for the new project',
  )
}

async function target(path, options = {}) {
  const response = await fetch(`${targetUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: targetKey,
      authorization: `Bearer ${targetKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
      ...(options.headers || {}),
    },
  })
  if (!response.ok) throw new Error(await response.text())
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

function canonicalUrl(value) {
  const url = new URL(value)
  url.hash = ''
  return url.toString()
}

async function migrateNews() {
  const sourcePath = process.env.BSW_ARTICLES_JSON
  if (!sourcePath) return []
  const parsed = JSON.parse(await fs.readFile(sourcePath, 'utf8'))
  const articles = Array.isArray(parsed) ? parsed : parsed.articles || []
  const rows = articles.map((item) => ({
    canonical_url: canonicalUrl(item.url),
    title: item.title || 'Untitled',
    source: item.source || '',
    raw_text: item.text || '',
    summary: item.summary || '',
    category: item.topic || item.category || 'ecosystem',
    image_url: item.selected_image || item.image_url || '',
    captured_at: item.display_created_at || item.created_at || item.last_seen,
    captured_via: 'migration',
    editorial_status: item.summary ? 'processed' : 'pending',
    editorial_updated_at: item.editorial_updated_at || null,
    metadata: {
      news_facts: item.news_facts || [],
      implications: item.implications || [],
      legacy_saves: item.saves || [],
      legacy_comments: item.comments || [],
    },
  }))
  return rows
}

async function migrateTopics() {
  const oldUrl = (process.env.OLD_TOPIC_SUPABASE_URL || '').replace(/\/$/, '')
  const oldKey = process.env.OLD_TOPIC_SUPABASE_ANON_KEY || ''
  if (!oldUrl || !oldKey) return []
  const response = await fetch(
    `${oldUrl}/rest/v1/monthly_topics?select=*&order=month_order.asc,display_order.asc`,
    {
      headers: {
        apikey: oldKey,
        authorization: `Bearer ${oldKey}`,
      },
    },
  )
  if (!response.ok) throw new Error(await response.text())
  const oldTopics = await response.json()
  const rows = oldTopics.map((item) => ({
    id: item.id,
    title: item.topic_title,
    notes: item.notes || '',
    category: item.category,
    status: 'published',
    scheduled_month: `${String(item.month_order).slice(0, 4)}-${String(item.month_order).slice(4, 6)}-01`,
    display_order: item.display_order || 1,
  }))
  return rows
}

const [newsRows, topicRows] = await Promise.all([
  migrateNews(),
  migrateTopics(),
])
const result = await target('rpc/import_legacy_data_once', {
  method: 'POST',
  body: JSON.stringify({
    p_migration_key:
      process.env.LEGACY_MIGRATION_KEY || 'external-legacy-migration-v1',
    p_actor_id: actorId,
    p_news: newsRows,
    p_topics: topicRows,
  }),
})
console.log(
  JSON.stringify({
    ok: true,
    ...result,
  }),
)
