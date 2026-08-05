import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from './capture.mjs'

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.CAPTURE_WRITE_TOKEN = 'capture-secret'
  process.env.APP_ORIGIN = 'chrome-extension://pilot'
  process.env.SUPABASE_URL = 'https://project.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

function request(body, token = 'capture-secret') {
  return {
    httpMethod: 'POST',
    headers: {
      origin: 'chrome-extension://pilot',
      'x-capture-token': token,
    },
    body: JSON.stringify(body),
  }
}

describe('capture API contract', () => {
  it('rejects unauthorized capture before database access', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const result = await handler(request({ url: 'https://example.com' }, 'bad'))
    expect(result.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('canonicalizes and sends capture through the narrow RPC', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          already_existed: true,
          news: { id: 'news-id', editorial_status: 'processed' },
        }),
        { status: 200 },
      ),
    )
    const result = await handler(
      request({
        id: 'capture-1',
        url: 'https://example.com/news?utm_source=test&id=4#part',
        title: 'Captured title',
      }),
    )
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body).already_existed).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/rest/v1/rpc/capture_news_event')
    expect(JSON.parse(options.body).p_canonical_url).toBe(
      'https://example.com/news?id=4',
    )
  })

  it('rejects oversized request bodies', async () => {
    const result = await handler({
      ...request({ url: 'https://example.com' }),
      headers: {
        origin: 'chrome-extension://pilot',
        'x-capture-token': 'capture-secret',
        'content-length': String(300 * 1024),
      },
    })
    expect(result.statusCode).toBe(413)
  })
})
