import crypto from 'node:crypto'
import {
  canonicalizeUrl,
  handleOptions,
  parseJsonBody,
  requireExtensionToken,
  response,
  supabase,
} from './_supabase.mjs'

function eventId(payload, occurredAt) {
  return crypto
    .createHash('sha256')
    .update(`${payload.url}|${payload.kind || 'save'}|${occurredAt}`)
    .digest('hex')
    .slice(0, 20)
}

export async function handler(event) {
  const options = handleOptions(event)
  if (options) return options
  if (event.httpMethod !== 'POST') {
    return response(405, { ok: false, error: 'Method not allowed' })
  }
  const denied = requireExtensionToken(event)
  if (denied) return denied
  const payload = parseJsonBody(event)
  if (!payload) return response(400, { ok: false, error: 'Invalid JSON' })

  let canonicalUrl = ''
  try {
    canonicalUrl = canonicalizeUrl(payload.url)
  } catch {
    return response(400, { ok: false, error: 'A valid URL is required' })
  }

  const occurredAt = new Date().toISOString()
  const id = String(payload.id || eventId(payload, occurredAt))
  const normalizedEvent = {
    ...payload,
    id,
    url: canonicalUrl,
    kind: String(payload.kind || 'save'),
    created_at: String(payload.created_at || occurredAt),
  }

  try {
    await supabase('capture_events?on_conflict=id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        id,
        event_kind: normalizedEvent.kind,
        canonical_url: canonicalUrl,
        payload: normalizedEvent,
        occurred_at: normalizedEvent.created_at,
      }),
    })

    const rows = await supabase('news_items?on_conflict=canonical_url', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        canonical_url: canonicalUrl,
        title: String(payload.title || 'Untitled').slice(0, 500),
        source: String(payload.source || '').slice(0, 200),
        raw_text: String(payload.text || '').slice(0, 60000),
        image_url: String(payload.selected_image || '').slice(0, 2000),
        captured_at: normalizedEvent.created_at,
        captured_via: 'extension',
        editorial_status: 'pending',
        metadata: {
          images: Array.isArray(payload.images) ? payload.images.slice(0, 20) : [],
          comments: payload.comment ? [String(payload.comment).slice(0, 4000)] : [],
          legacy_user: String(payload.user || ''),
        },
      }),
    })
    return response(200, { ok: true, event: normalizedEvent, news: rows?.[0] })
  } catch (error) {
    console.error('capture failed', error)
    return response(500, { ok: false, error: 'Capture failed' })
  }
}
