import fs from 'node:fs/promises'
import path from 'node:path'
import {
  header,
  handleOptions,
  requireAllowedOrigin,
  response,
  supabase,
  supabaseRpc,
} from './_supabase.mjs'

export const config = {
  path: '/api/import-legacy',
  rateLimit: {
    windowLimit: 2,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
}

async function authenticatedUser(event) {
  const token = header(event, 'authorization').replace(
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
  const options = handleOptions(event)
  if (options) return options
  const blockedOrigin = requireAllowedOrigin(event)
  if (blockedOrigin) return blockedOrigin
  if (event.httpMethod !== 'POST') {
    return response(
      405,
      { ok: false, error: 'Method not allowed' },
      { allow: 'POST, OPTIONS' },
      event,
    )
  }

  try {
    const user = await authenticatedUser(event)
    if (!user?.id) {
      return response(
        401,
        { ok: false, error: 'Sign in required' },
        {},
        event,
      )
    }

    const members = await supabase(
      `team_members?select=role&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { method: 'GET', headers: { prefer: '' } },
    )
    if (members?.[0]?.role !== 'admin') {
      return response(
        403,
        { ok: false, error: 'Admin access required' },
        {},
        event,
      )
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
    if (!Array.isArray(newsRows) || !Array.isArray(topicRows)) {
      throw new Error('Legacy seed files must contain arrays')
    }
    const result = await supabaseRpc('import_legacy_data_once', {
      p_migration_key: 'bundled-legacy-seed-v1',
      p_actor_id: user.id,
      p_news: newsRows,
      p_topics: topicRows,
    })
    return response(
      200,
      {
        ok: true,
        imported:
          Number(result?.imported_news || 0) +
          Number(result?.imported_topics || 0),
        ...result,
      },
      {},
      event,
    )
  } catch (error) {
    console.error('legacy import failed', error)
    const alreadyCompleted = String(error).includes('23505')
    return response(
      alreadyCompleted ? 409 : 500,
      {
        ok: false,
        error: alreadyCompleted
          ? 'Legacy import has already completed'
          : 'Legacy import failed',
      },
      {},
      event,
    )
  }
}
