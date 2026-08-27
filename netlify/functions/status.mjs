import {
  canonicalizeUrl,
  handleOptions,
  requireAllowedOrigin,
  requireCaptureAccess,
  response,
  supabaseRpc,
} from './_supabase.mjs'

export const config = {
  path: '/api/status',
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
}

export async function handler(event) {
  const options = handleOptions(event)
  if (options) return options
  const blockedOrigin = requireAllowedOrigin(event, {
    allowTokenAuthenticatedClients: true,
  })
  if (blockedOrigin) return blockedOrigin
  if (event.httpMethod !== 'GET') {
    return response(
      405,
      { ok: false, error: 'Method not allowed' },
      { allow: 'GET, OPTIONS' },
      event,
    )
  }
  const access = await requireCaptureAccess(event)
  if (access.denied) return access.denied

  let canonicalUrl = ''
  try {
    canonicalUrl = canonicalizeUrl(event.queryStringParameters?.url || '')
  } catch {
    return response(
      400,
      { ok: false, error: 'A valid URL is required' },
      {},
      event,
    )
  }

  try {
    const result = await supabaseRpc('news_capture_status', {
      p_canonical_url: canonicalUrl,
    })
    return response(
      200,
      { ok: true, write_authorized: true, caller: access.caller, ...result },
      {},
      event,
    )
  } catch (error) {
    console.error('status failed', error)
    return response(
      500,
      { ok: false, error: 'Status lookup failed' },
      {},
      event,
    )
  }
}
