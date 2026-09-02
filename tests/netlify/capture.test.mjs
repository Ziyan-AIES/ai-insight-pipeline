import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from '../../netlify/functions/capture.mjs'

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

function request(body, headers = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      origin: 'chrome-extension://pilot',
      ...headers,
    },
    body: JSON.stringify(body),
  }
}

function mockBackend({ user, member, rpc } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const href = String(url)
    if (href.includes('/auth/v1/user')) {
      if (!user) return new Response('{}', { status: 401 })
      return new Response(JSON.stringify(user), { status: 200 })
    }
    if (href.includes('team_members')) {
      return new Response(JSON.stringify(member ? [member] : []), { status: 200 })
    }
    if (href.includes('rpc/capture_news_event')) {
      return new Response(
        JSON.stringify(rpc || { already_existed: false, news: { id: 'n1' } }),
        { status: 200 },
      )
    }
    return new Response(`unexpected ${href}`, { status: 500 })
  })
}

const member = {
  user_id: 'user-1',
  email: 'person@example.com',
  display_name: 'Pilot Person',
  role: 'member',
}

describe('capture API contract', () => {
  it('rejects unauthorized capture before database access', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const result = await handler(
      request({ url: 'https://example.com' }, { 'x-capture-token': 'bad' }),
    )
    expect(result.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('canonicalizes and sends capture through the narrow RPC', async () => {
    const fetchMock = mockBackend()
    const result = await handler(
      request(
        {
          id: 'capture-1',
          url: 'https://example.com/news?utm_source=test&id=4#part',
          title: 'Captured title',
        },
        { 'x-capture-token': 'capture-secret' },
      ),
    )
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body).already_existed).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/rest/v1/rpc/capture_news_event')
    expect(JSON.parse(options.body).p_canonical_url).toBe(
      'https://example.com/news?id=4',
    )
  })

  it('does not duplicate article text and images in the audit payload or response', async () => {
    const fetchMock = mockBackend({
      rpc: {
        already_existed: false,
        news: {
          id: 'n1',
          canonical_url: 'https://example.com/compact',
          editorial_status: 'pending',
          raw_text: 'large response text',
        },
      },
    })
    const result = await handler(
      request(
        {
          url: 'https://example.com/compact',
          text: 'article body',
          images: [{ url: 'https://example.com/image.jpg' }],
        },
        { 'x-capture-token': 'capture-secret' },
      ),
    )
    const rpcBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(rpcBody.p_raw_text).toBe('article body')
    expect(rpcBody.p_payload).not.toHaveProperty('text')
    expect(rpcBody.p_payload).not.toHaveProperty('images')
    const responseBody = JSON.parse(result.body)
    expect(responseBody.event).not.toHaveProperty('text')
    expect(responseBody.news).not.toHaveProperty('raw_text')
  })

  it('allows token-authenticated extension captures from other origins', async () => {
    mockBackend()
    const result = await handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://news.example.com',
        'x-bsw-token': 'capture-secret',
      },
      body: JSON.stringify({ url: 'https://news.example.com/a', title: 'A' }),
    })
    expect(result.statusCode).toBe(200)
  })

  it('forwards the extension display name as contributor metadata for legacy tokens', async () => {
    const fetchMock = mockBackend()
    const result = await handler(
      request(
        {
          url: 'https://example.com/named',
          title: 'Named capture',
          user: 'Shawn',
          avatar: 'S',
        },
        { 'x-capture-token': 'capture-secret' },
      ),
    )
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.p_capture_metadata).toMatchObject({
      contributor_name: 'Shawn',
      legacy_user: 'Shawn',
      avatar: 'S',
    })
  })

  it('uses the team profile as contributor and ignores a typed name on session capture', async () => {
    const fetchMock = mockBackend({
      user: { id: 'user-1', email: 'person@example.com' },
      member,
    })
    const result = await handler(
      request(
        {
          url: 'https://example.com/session',
          title: 'Session capture',
          user: 'Typed Name',
          avatar: 'TN',
        },
        { authorization: 'Bearer user-session' },
      ),
    )
    expect(result.statusCode).toBe(200)
    const rpcCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('capture_news_event'),
    )
    const body = JSON.parse(rpcCall[1].body)
    expect(body.p_capture_metadata).toMatchObject({
      contributor_name: 'Pilot Person',
      team_user_id: 'user-1',
      legacy_user: 'Pilot Person',
      avatar: 'PI',
    })
    expect(body.p_capture_metadata.legacy_user).not.toBe('Typed Name')
  })

  it('rejects a signed-in caller who is not in team_members', async () => {
    const fetchMock = mockBackend({
      user: { id: 'user-2', email: 'outsider@example.com' },
    })
    const result = await handler(
      request(
        { url: 'https://example.com/denied', user: 'Outsider' },
        { authorization: 'Bearer outsider-session' },
      ),
    )
    expect(result.statusCode).toBe(403)
    expect(JSON.parse(result.body).code).toBe('not_authorized')
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('capture_news_event')),
    ).toBe(false)
  })

  it('still allows the legacy capture token when no Bearer session is sent', async () => {
    mockBackend()
    const result = await handler(
      request(
        { url: 'https://example.com/legacy' },
        { 'x-capture-token': 'capture-secret' },
      ),
    )
    expect(result.statusCode).toBe(200)
  })

  it('rejects oversized request bodies', async () => {
    const result = await handler({
      ...request({ url: 'https://example.com' }, { 'x-capture-token': 'capture-secret' }),
      headers: {
        origin: 'chrome-extension://pilot',
        'x-capture-token': 'capture-secret',
        'content-length': String(300 * 1024),
      },
    })
    expect(result.statusCode).toBe(413)
  })
})
