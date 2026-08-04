import fs from 'node:fs/promises'
import path from 'node:path'
import { response, supabase } from './_supabase.mjs'

async function authenticatedUser(event) {
  const token = String(event.headers.authorization || '').replace(
    /^Bearer\s+/i,
    '',
  )
  if (!token) return null
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const result = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${token}` },
  })
  return result.ok ? result.json() : null
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return response(405, { ok: false, error: 'Method not allowed' })
  }

  try {
    const user = await authenticatedUser(event)
    if (!user?.id) return response(401, { ok: false, error: 'Sign in required' })

    const members = await supabase(
      `team_members?select=role&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { method: 'GET', headers: { prefer: '' } },
    )
    if (members?.[0]?.role !== 'admin') {
      return response(403, { ok: false, error: 'Admin access required' })
    }

    const newsSeedPath = path.resolve(
      process.cwd(),
      'supabase/seed-legacy-news.json',
    )
    const topicSeedPath = path.resolve(
      process.cwd(),
      'supabase/seed-legacy-topics.json',
    )
    const newsRows = JSON.parse(await fs.readFile(newsSeedPath, 'utf8'))
    const topicRows = JSON.parse(await fs.readFile(topicSeedPath, 'utf8'))
    await supabase('news_items?on_conflict=canonical_url', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(newsRows),
    })
    await supabase('topics?on_conflict=id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(topicRows),
    })
    return response(200, {
      ok: true,
      imported: newsRows.length + topicRows.length,
      imported_news: newsRows.length,
      imported_topics: topicRows.length,
    })
  } catch (error) {
    console.error('legacy import failed', error)
    return response(500, { ok: false, error: 'Legacy import failed' })
  }
}
