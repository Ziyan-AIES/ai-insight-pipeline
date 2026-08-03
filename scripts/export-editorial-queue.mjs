import process from 'node:process'

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
if (!url || !key) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
}

const response = await fetch(
  `${url}/rest/v1/news_items?select=id,canonical_url,title,source,raw_text,summary,category,captured_at,metadata&editorial_status=eq.pending&order=captured_at.asc`,
  {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
    },
  },
)
if (!response.ok) throw new Error(await response.text())
const rows = await response.json()
console.log(JSON.stringify({ generated_at: new Date().toISOString(), news: rows }))
