import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from '../../netlify/functions/status.mjs'

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.CAPTURE_WRITE_TOKEN = 'capture-secret'
  process.env.SUPABASE_URL = 'https://project.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

describe('extension status API', () => {
  it('returns saved and editorial state from the status RPC', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          saved: true,
          editorial_status: 'processed',
          news_id: 'news-id',
          deleted: false,
          version: 3,
        }),
        { status: 200 },
      ),
    )
    const result = await handler({
      httpMethod: 'GET',
      headers: { 'x-capture-token': 'capture-secret' },
      queryStringParameters: {
        url: 'https://example.com/story?utm_source=extension',
      },
    })
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toMatchObject({
      saved: true,
      editorial_status: 'processed',
      version: 3,
    })
  })
})
