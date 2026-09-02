import {
  handleOptions,
  requireAllowedOrigin,
  resolveAuthorizedCaller,
  response,
} from './_supabase.mjs'
import { runRadarIngest } from './_radar.mjs'

export const config = {
  path: '/api/radar/ingest',
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}

export async function handler(event) {
  const options = handleOptions(event)
  if (options) return options
  const blocked = requireAllowedOrigin(event)
  if (blocked) return blocked
  if (event.httpMethod !== 'POST') return response(405, { ok: false, error: 'Method not allowed' }, { allow: 'POST, OPTIONS' }, event)
  const access = await resolveAuthorizedCaller(event)
  if (access.denied) return access.denied
  if (!access.caller) return response(401, { ok: false, error: 'Sign in required' }, {}, event)
  if (!['admin', 'editor'].includes(access.caller.role)) return response(403, { ok: false, error: 'Editor access required' }, {}, event)
  try {
    return response(200, { ok: true, ...(await runRadarIngest()) }, {}, event)
  } catch (error) {
    console.error('radar ingest failed', error)
    return response(500, { ok: false, error: 'Radar refresh failed' }, {}, event)
  }
}
