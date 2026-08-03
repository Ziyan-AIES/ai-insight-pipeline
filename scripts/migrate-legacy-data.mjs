import fs from 'node:fs/promises'
import process from 'node:process'

const targetUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!targetUrl || !targetKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the new project')
}

async function target(path, options = {}) {
  const response = await fetch(`${targetUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: targetKey,
      authorization: `Bearer ${targetKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
      ...(options.headers || {}),
    },
  })
  if (!response.ok) throw new Error(await response.text())
}

function canonicalUrl(value) {
  const url = new URL(value)
  url.hash = ''
  return url.toString()
}

async function migrateNews() {
  const sourcePath = process.env.BSW_ARTICLES_JSON
  if (!sourcePath) return 0
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
  if (rows.length) {
    await target('news_items?on_conflict=canonical_url', {
      method: 'POST',
      body: JSON.stringify(rows),
    })
  }
  return rows.length
}

async function migrateTopics() {
  const oldUrl = (process.env.OLD_TOPIC_SUPABASE_URL || '').replace(/\/$/, '')
  const oldKey = process.env.OLD_TOPIC_SUPABASE_ANON_KEY || ''
  if (!oldUrl || !oldKey) return 0
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
  if (rows.length) {
    await target('topics?on_conflict=id', {
      method: 'POST',
      body: JSON.stringify(rows),
    })
  }
  return rows.length
}

const [newsCount, topicCount] = await Promise.all([
  migrateNews(),
  migrateTopics(),
])
console.log(
  JSON.stringify({
    ok: true,
    migrated_news: newsCount,
    migrated_topics: topicCount,
  }),
)
