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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function editorialRequestHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function isEditorialConflict(error) {
  return /40001|editorial (?:snapshot|lease|version|item).*conflict/i.test(
    String(error?.message || error),
  )
}

function needsConcurrencyMigration(error) {
  return /PGRST202|apply_editorial_sync_guarded/i.test(
    String(error?.message || error),
  )
}

function requireNewsId(value) {
  const id = String(value || '')
  if (!uuidPattern.test(id)) throw new Error('invalid news id')
  return id
}

function requireExpectedVersion(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('invalid expected version')
  }
  return value
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

  const runId = String(body.run_id || '').slice(0, 200)
  const claimRunId = String(body.claim_run_id || '')
  const leaseOwner = String(body.lease_owner || '').slice(0, 200)
  if (!runId || !uuidPattern.test(claimRunId) || !leaseOwner) {
    return response(
      400,
      {
        ok: false,
        error: 'run_id, claim_run_id, and lease_owner are required',
      },
      {},
      event,
    )
  }

  let rows
  try {
    rows = body.news.map((item) => ({
      news_id: requireNewsId(item.id),
      expected_version: requireExpectedVersion(item.expected_version),
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
      {
        ok: false,
        error: 'Every news item requires a valid id, version, and URL',
      },
      {},
      event,
    )
  }

  const readouts = (body.readouts || []).map((item) => ({
    period_type: item.period_type,
    period_key: String(item.period_key || '').slice(0, 100),
    lede: String(item.lede || '').slice(0, 2000),
    bullets: Array.isArray(item.bullets) ? item.bullets.slice(0, 5) : [],
    generated_by: String(item.generated_by || 'cursor-automation').slice(0, 200),
  }))
  const requestHash = editorialRequestHash({
    runId,
    claimRunId,
    leaseOwner,
    news: rows,
    readouts,
  })

  try {
    const result = await supabaseRpc('apply_editorial_sync_guarded', {
      p_news: rows,
      p_readouts: readouts,
      p_external_run_id: runId,
      p_claim_run_id: claimRunId,
      p_lease_owner: leaseOwner,
      p_request_hash: requestHash,
    })

    return response(200, { ok: true, ...result }, {}, event)
  } catch (error) {
    console.error('editorial sync failed', error)
    await supabaseRpc('record_editorial_run_failure_guarded', {
      p_external_run_id: runId,
      p_claim_run_id: claimRunId,
      p_lease_owner: leaseOwner,
      p_error_message: 'Editorial sync failed',
    }).catch((failureError) => {
      console.error('editorial run failure could not be recorded', failureError)
    })
    if (isEditorialConflict(error)) {
      return response(
        409,
        {
          ok: false,
          error: 'Editorial snapshot changed; export the queue again',
          code: 'EDITORIAL_CONFLICT',
          run_id: runId,
        },
        {},
        event,
      )
    }
    if (needsConcurrencyMigration(error)) {
      return response(
        503,
        {
          ok: false,
          error: 'Editorial concurrency migration is not available',
          code: 'EDITORIAL_SCHEMA_REQUIRED',
          run_id: runId,
        },
        {},
        event,
      )
    }
    return response(
      500,
      { ok: false, error: 'Editorial sync failed', run_id: runId },
      {},
      event,
    )
  }
}
