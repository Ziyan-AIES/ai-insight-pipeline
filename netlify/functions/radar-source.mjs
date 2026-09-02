import {
  handleOptions,
  parseJsonBody,
  requireAllowedOrigin,
  resolveAuthorizedCaller,
  response,
} from './_supabase.mjs'
import { probeSource } from './_radar.mjs'

export const config = {
  path: '/api/radar/source',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
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
  const parsed = parseJsonBody(event, 16 * 1024)
  if (parsed.error) return response(parsed.statusCode, { ok: false, error: parsed.error }, {}, event)
  if (parsed.value.action !== 'probe' || typeof parsed.value.url !== 'string') {
    return response(400, { ok: false, error: 'A source URL is required' }, {}, event)
  }
  try {
    return response(200, { ok: true, ...(await probeSource(parsed.value.url)) }, {}, event)
  } catch (error) {
    console.error('radar source probe failed', error)
    return response(422, { ok: false, error: error.message || 'Could not inspect source' }, {}, event)
  }
}
