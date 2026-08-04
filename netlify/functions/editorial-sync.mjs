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
    const rows = await Promise.all(
      body.news.map(async (item) => {
        const canonicalUrl = canonicalizeUrl(item.url)
        const existingRows = await supabase(
          `news_items?select=raw_text,image_url,captured_at,captured_via,metadata&canonical_url=eq.${encodeURIComponent(canonicalUrl)}&limit=1`,
          { method: 'GET', headers: { prefer: '' } },
        )
        const existing = existingRows?.[0] || {}
        return {
          canonical_url: canonicalUrl,
          title: String(item.title || 'Untitled').slice(0, 500),
          source: String(item.source || '').slice(0, 200),
          raw_text: String(item.text || existing.raw_text || '').slice(0, 60000),
          summary: String(item.summary || '').slice(0, 4000),
          category: categories.has(item.category) ? item.category : 'ecosystem',
          image_url: String(
            item.image_url || item.selected_image || existing.image_url || '',
          ).slice(0, 2000),
          captured_at: String(
            existing.captured_at ||
              item.captured_at ||
              item.created_at ||
              new Date().toISOString(),
          ),
          captured_via: String(existing.captured_via || 'automation'),
          editorial_status: 'processed',
          editorial_updated_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            news_facts: Array.isArray(item.news_facts)
              ? item.news_facts.slice(0, 5)
              : [],
            implications: Array.isArray(item.implications)
              ? item.implications.slice(0, 5)
              : [],
            evidence: Array.isArray(item.evidence)
              ? item.evidence.slice(0, 6)
              : [],
            impact_paths: Array.isArray(item.impact_paths)
              ? item.impact_paths.slice(0, 6)
              : [],
            open_questions: Array.isArray(item.open_questions)
              ? item.open_questions.slice(0, 5)
              : [],
            editorial_audit:
              item.editorial_audit &&
              typeof item.editorial_audit === 'object' &&
              !Array.isArray(item.editorial_audit)
                ? item.editorial_audit
                : {},
            ...(item.legacy_id ? { legacy_id: item.legacy_id } : {}),
          },
        }
      }),
    )

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
