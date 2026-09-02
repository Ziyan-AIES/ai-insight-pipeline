import crypto from 'node:crypto'
import {
  canonicalizeUrl,
  handleOptions,
  parseJsonBody,
  requireAllowedOrigin,
  requireCaptureAccess,
  response,
  supabaseRpc,
} from './_supabase.mjs'

export const config = {
  path: '/api/capture',
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
}

function eventId(payload, occurredAt) {
  return crypto
    .createHash('sha256')
    .update(`${payload.url}|${payload.kind || 'save'}|${occurredAt}`)
    .digest('hex')
    .slice(0, 20)
}

export async function handler(event) {
  const options = handleOptions(event, { allowAnyOrigin: true })
  if (options) return options
  const blockedOrigin = requireAllowedOrigin(event, {
    allowTokenAuthenticatedClients: true,
  })
  if (blockedOrigin) return blockedOrigin
  if (event.httpMethod !== 'POST') {
    return response(
      405,
      { ok: false, error: 'Method not allowed' },
      { allow: 'POST, OPTIONS' },
      event,
    )
  }
  const access = await requireCaptureAccess(event)
  if (access.denied) return access.denied
  const parsed = parseJsonBody(event, 256 * 1024)
  if (!parsed.value) {
    return response(
      parsed.statusCode,
      { ok: false, error: parsed.error },
      {},
      event,
    )
  }
  const payload = parsed.value

  let canonicalUrl = ''
  try {
    canonicalUrl = canonicalizeUrl(payload.url)
  } catch {
    return response(
      400,
      { ok: false, error: 'A valid URL is required' },
      {},
      event,
    )
  }

  const occurredAt = new Date().toISOString()
  const requestedDate = new Date(String(payload.created_at || ''))
  const eventTime = Number.isNaN(requestedDate.getTime())
    ? occurredAt
    : requestedDate.toISOString()
  const id = String(payload.id || eventId(payload, eventTime)).slice(0, 200)
  const normalizedEvent = {
    ...payload,
    id,
    url: canonicalUrl,
    kind: String(payload.kind || 'save'),
    created_at: eventTime,
  }
  const compactEvent = { ...normalizedEvent }
  delete compactEvent.text
  delete compactEvent.images

  const takeaway = String(payload.takeaway || payload.comment || '').slice(0, 2000)
  const contributorName = access.caller
    ? access.caller.displayName
    : String(payload.user || '').slice(0, 200)

  try {
    const result = await supabaseRpc('capture_news_event', {
      p_event_id: id,
      p_event_kind: normalizedEvent.kind.slice(0, 100),
      p_canonical_url: canonicalUrl,
      p_title: String(payload.title || 'Untitled').slice(0, 500),
      p_source: String(payload.source || '').slice(0, 200),
      p_raw_text: String(payload.text || '').slice(0, 60000),
      p_image_url: String(payload.selected_image || '').slice(0, 2000),
      p_occurred_at: eventTime,
      p_payload: compactEvent,
      p_capture_metadata: {
        images: Array.isArray(payload.images) ? payload.images.slice(0, 20) : [],
        comments: payload.comment
          ? [String(payload.comment).slice(0, 4000)]
          : [],
        takeaway,
        category: String(payload.category || ''),
        team_user_id: access.caller?.userId || '',
        contributor_name: contributorName,
        legacy_user: access.caller ? contributorName : String(payload.user || '').slice(0, 200),
        avatar: access.caller
          ? contributorName.slice(0, 2).toUpperCase()
          : String(payload.avatar || '').slice(0, 16),
      },
    })
    return response(
      200,
      {
        ok: true,
        event: compactEvent,
        news: result?.news
          ? {
              id: result.news.id,
              canonical_url: result.news.canonical_url,
              editorial_status: result.news.editorial_status,
            }
          : null,
        already_existed: Boolean(result?.already_existed),
      },
      {},
      event,
    )
  } catch (error) {
    console.error('capture failed', error)
    return response(500, { ok: false, error: 'Capture failed' }, {}, event)
  }
}
