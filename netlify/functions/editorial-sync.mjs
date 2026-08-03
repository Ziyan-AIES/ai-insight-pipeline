import {
  canonicalizeUrl,
  parseJsonBody,
  requireExtensionToken,
  response,
  supabase,
} from './_supabase.mjs'

const categories = new Set([
  'interaction',
  'ai_software',
  'ai_hardware',
  'ecosystem',
  'ai_capability',
  'industry_events',
])

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return response(405, { ok: false, error: 'Method not allowed' })
  }
  const denied = requireExtensionToken(event)
  if (denied) return denied
  const body = parseJsonBody(event)
  if (!body || !Array.isArray(body.news)) {
    return response(400, { ok: false, error: 'news must be an array' })
  }

  try {
    const rows = body.news.map((item) => ({
      canonical_url: canonicalizeUrl(item.url),
      title: String(item.title || 'Untitled').slice(0, 500),
      source: String(item.source || '').slice(0, 200),
      raw_text: String(item.text || '').slice(0, 60000),
      summary: String(item.summary || '').slice(0, 4000),
      category: categories.has(item.category) ? item.category : 'ecosystem',
      image_url: String(item.image_url || item.selected_image || '').slice(
        0,
        2000,
      ),
      captured_at: String(item.captured_at || item.created_at),
      captured_via: String(item.captured_via || 'automation'),
      editorial_status: 'processed',
      editorial_updated_at: new Date().toISOString(),
      metadata: {
        news_facts: Array.isArray(item.news_facts) ? item.news_facts : [],
        implications: Array.isArray(item.implications)
          ? item.implications
          : [],
        legacy_id: item.legacy_id || null,
      },
    }))

    if (rows.length) {
      await supabase('news_items?on_conflict=canonical_url', {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      })
    }

    if (Array.isArray(body.readouts) && body.readouts.length) {
      await supabase(
        'editorial_readouts?on_conflict=period_type,period_key',
        {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(
            body.readouts.map((item) => ({
              period_type: item.period_type,
              period_key: item.period_key,
              lede: String(item.lede || '').slice(0, 2000),
              bullets: Array.isArray(item.bullets)
                ? item.bullets.slice(0, 5)
                : [],
              generated_by: String(item.generated_by || 'cursor-automation'),
              generated_at: new Date().toISOString(),
            })),
          ),
        },
      )
    }

    return response(200, {
      ok: true,
      upserted_news: rows.length,
      upserted_readouts: body.readouts?.length || 0,
    })
  } catch (error) {
    console.error('editorial sync failed', error)
    return response(500, { ok: false, error: 'Editorial sync failed' })
  }
}
