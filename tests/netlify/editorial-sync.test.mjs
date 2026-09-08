import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from '../../netlify/functions/editorial-sync.mjs'

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.EDITORIAL_WRITE_TOKEN = 'editorial-secret'
  process.env.APP_ORIGIN = 'http://localhost:5173'
  process.env.SUPABASE_URL = 'https://project.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

function request(body) {
  return {
    httpMethod: 'POST',
    headers: {
      origin: 'http://localhost:5173',
      'x-editorial-token': 'editorial-secret',
    },
    body: JSON.stringify(body),
  }
}

const claimRunId = '11111111-1111-4111-8111-111111111111'
const newsId = '22222222-2222-4222-8222-222222222222'

function validBody(overrides = {}) {
  return {
    run_id: 'run-1',
    claim_run_id: claimRunId,
    lease_owner: 'local:test-runner',
    news: [
      {
        id: newsId,
        expected_version: 7,
        url: 'https://example.com/story',
        title: 'Reviewed',
        summary: 'Evidence-backed summary',
        category: 'ai_capability',
        evidence: [{ claim: 'Fact', source_url: 'https://example.com/story' }],
      },
    ],
    ...overrides,
  }
}

describe('editorial synchronization contract', () => {
  it('rejects malformed payloads', async () => {
    const result = await handler(request({ news: 'invalid' }))
    expect(result.statusCode).toBe(400)
  })

  it('publishes validated editorial-only fields through the narrow RPC', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ upserted_news: 1, upserted_readouts: 0 }),
          { status: 200 },
        ),
      )
    const result = await handler(
      request(validBody()),
    )
    expect(result.statusCode).toBe(200)
    const [url, options] = fetchMock.mock.calls[0]
    const rpcBody = JSON.parse(options.body)
    expect(url).toContain('/rpc/apply_editorial_sync_guarded')
    expect(rpcBody.p_external_run_id).toBe('run-1')
    expect(rpcBody.p_claim_run_id).toBe(claimRunId)
    expect(rpcBody.p_lease_owner).toBe('local:test-runner')
    expect(rpcBody.p_news[0]).toMatchObject({
      news_id: newsId,
      expected_version: 7,
    })
    expect(rpcBody.p_request_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(rpcBody.p_news[0].editorial_metadata.evidence).toHaveLength(1)
    expect(rpcBody.p_news[0]).not.toHaveProperty('metadata')
  })

  it('requires trusted snapshot and lease identifiers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const result = await handler(
      request(validBody({ claim_run_id: '', lease_owner: '' })),
    )
    expect(result.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires every item to carry its claimed id and version', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const result = await handler(
      request(validBody({ news: [{ url: 'https://example.com/story' }] })),
    )
    expect(result.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a recognized conflict and releases only through the guarded RPC', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: '40001', message: 'editorial snapshot conflict' }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(new Response('true', { status: 200 }))

    const result = await handler(request(validBody()))
    expect(result.statusCode).toBe(409)
    expect(JSON.parse(result.body).code).toBe('EDITORIAL_CONFLICT')
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/rpc/record_editorial_run_failure_guarded',
    )
    const releaseBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(releaseBody).toMatchObject({
      p_external_run_id: 'run-1',
      p_claim_run_id: claimRunId,
      p_lease_owner: 'local:test-runner',
    })
  })

  it('hashes identical normalized retries identically', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            upserted_news: 1,
            upserted_readouts: 0,
            idempotent_replay: true,
          }),
          { status: 200 },
        ),
      ),
    )
    const firstResult = await handler(request(validBody()))
    const secondResult = await handler(request(validBody()))
    expect(firstResult.statusCode).toBe(200)
    expect(secondResult.statusCode).toBe(200)
    const first = JSON.parse(fetchMock.mock.calls[0][1].body)
    const second = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(second.p_request_hash).toBe(first.p_request_hash)
  })
})
