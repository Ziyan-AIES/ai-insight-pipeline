import crypto from 'node:crypto'
import {
  canonicalizeUrl,
  handleOptions,
  parseJsonBody,
  requireAllowedOrigin,
  requireEditorialToken,
  response,
  supabaseRpc,
} from './_supabase.mjs'

export const config = {
  path: '/api/editorial-sync',
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
}

const categories = new Set([
  'interaction',
  'ai_software',
  'ai_hardware',
  'ecosystem',
  'ai_capability',
  'industry_events',
])

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
  const denied = requireEditorialToken(event)
  if (denied) return denied
  const parsed = parseJsonBody(event, 1024 * 1024)
  if (!parsed.value) {
    return response(
      parsed.statusCode,
      { ok: false, error: parsed.error },
      {},
      event,
    )
  }
  const body = parsed.value
  if (!Array.isArray(body.news) || body.news.length > 25) {
    return response(
      400,
      { ok: false, error: 'news must be an array of at most 25 items' },
      {},
      event,
    )
  }
  if (body.readouts != null && !Array.isArray(body.readouts)) {
    return response(
      400,
      { ok: false, error: 'readouts must be an array' },
      {},
      event,
    )
  }
  if ((body.readouts?.length || 0) > 10) {
    return response(
      400,
      { ok: false, error: 'At most 10 readouts may be submitted' },
      {},
      event,
    )
  }

  let rows
  try {
    rows = body.news.map((item) => ({
      canonical_url: canonicalizeUrl(item.url),
      title: String(item.title || 'Untitled').slice(0, 500),
      source: String(item.source || '').slice(0, 200),
      raw_text: String(item.text || '').slice(0, 60000),
      summary: String(item.summary || '').slice(0, 4000),
      team_synthesis: String(item.team_synthesis || '').slice(0, 2000),
      category: categories.has(item.category) ? item.category : 'ecosystem',
      image_url: String(item.image_url || item.selected_image || '').slice(
        0,
        2000,
      ),
      editorial_metadata: {
        news_facts: Array.isArray(item.news_facts)
          ? item.news_facts.slice(0, 5)
          : [],
        implications: Array.isArray(item.implications)
          ? item.implications.slice(0, 5)
          : [],
        evidence: Array.isArray(item.evidence) ? item.evidence.slice(0, 6) : [],
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
    }))
  } catch {
    return response(
      400,
      { ok: false, error: 'Every news item requires a valid URL' },
      {},
      event,
    )
  }

  const runId = String(
    body.run_id ||
      rows[0]?.editorial_metadata?.editorial_audit?.run_id ||
      crypto.randomUUID(),
  ).slice(0, 200)

  try {
    const result = await supabaseRpc('apply_editorial_sync', {
      p_news: rows,
      p_readouts: (body.readouts || []).map((item) => ({
        period_type: item.period_type,
        period_key: String(item.period_key || '').slice(0, 100),
        lede: String(item.lede || '').slice(0, 2000),
        bullets: Array.isArray(item.bullets) ? item.bullets.slice(0, 5) : [],
        generated_by: String(
          item.generated_by || 'cursor-automation',
        ).slice(0, 200),
      })),
      p_external_run_id: runId,
    })

    return response(200, { ok: true, ...result }, {}, event)
  } catch (error) {
    console.error('editorial sync failed', error)
    await supabaseRpc('record_editorial_run_failure', {
      p_external_run_id: runId,
      p_error_message: 'Editorial sync failed',
    }).catch((failureError) => {
      console.error('editorial run failure could not be recorded', failureError)
    })
    return response(
      500,
      { ok: false, error: 'Editorial sync failed', run_id: runId },
      {},
      event,
    )
  }
}
