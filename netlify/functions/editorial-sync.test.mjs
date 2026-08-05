import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from './editorial-sync.mjs'

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
      request({
        run_id: 'run-1',
        news: [
          {
            url: 'https://example.com/story',
            title: 'Reviewed',
            summary: 'Evidence-backed summary',
            category: 'ai_capability',
            evidence: [{ claim: 'Fact', source_url: 'https://example.com/story' }],
          },
        ],
      }),
    )
    expect(result.statusCode).toBe(200)
    const [, options] = fetchMock.mock.calls[0]
    const rpcBody = JSON.parse(options.body)
    expect(rpcBody.p_external_run_id).toBe('run-1')
    expect(rpcBody.p_news[0].editorial_metadata.evidence).toHaveLength(1)
    expect(rpcBody.p_news[0]).not.toHaveProperty('metadata')
  })
})
