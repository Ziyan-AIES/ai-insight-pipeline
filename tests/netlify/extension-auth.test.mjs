import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from '../../netlify/functions/extension-auth.mjs'

const originalEnv = { ...process.env }
const handoffs = new Map()

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://project.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.APP_ORIGIN = 'https://aiinsightpipeline.netlify.app'
  handoffs.clear()
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

function post(body, headers = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      origin: 'chrome-extension://pilot',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  }
}

function mockBackend({ user, member } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
    const href = String(url)
    const method = String(options.method || 'GET').toUpperCase()
    if (href.includes('/auth/v1/user')) {
      if (!user) return new Response('{}', { status: 401 })
      return new Response(JSON.stringify(user), { status: 200 })
    }
    if (href.includes('team_members')) {
      return new Response(JSON.stringify(member ? [member] : []), { status: 200 })
    }
    if (href.includes('extension_auth_handoffs')) {
      const parsed = new URL(href)
      const stateEq = parsed.searchParams.get('state_hash')
      const stateHash = stateEq ? stateEq.replace(/^eq\./, '') : ''
      if (method === 'DELETE') {
        handoffs.delete(stateHash)
        return new Response('', { status: 204 })
      }
      if (method === 'POST') {
        const row = JSON.parse(options.body)
        handoffs.set(row.state_hash, row)
        return new Response(JSON.stringify([row]), { status: 201 })
      }
      const row = handoffs.get(stateHash)
      return new Response(JSON.stringify(row ? [row] : []), { status: 200 })
    }
    return new Response(`unexpected ${href}`, { status: 500 })
  })
}

const member = {
  user_id: 'user-1',
  email: 'person@example.com',
  display_name: 'Pilot Person',
  role: 'editor',
}

describe('extension auth handshake', () => {
  it('stores an authorized session for claim', async () => {
    mockBackend({
      user: { id: 'user-1', email: 'person@example.com' },
      member,
    })
    const complete = await handler(
      post(
        {
          action: 'complete',
          state: 'handshake-state-123456',
          refresh_token: 'refresh-token',
        },
        { authorization: 'Bearer access-token' },
      ),
    )
    expect(complete.statusCode).toBe(200)
    expect(JSON.parse(complete.body)).toMatchObject({
      connected: true,
      authorized: true,
      identity: { displayName: 'Pilot Person', userId: 'user-1' },
    })

    const claim = await handler(
      post({ action: 'claim', state: 'handshake-state-123456' }),
    )
    expect(claim.statusCode).toBe(200)
    expect(JSON.parse(claim.body)).toMatchObject({
      authorized: true,
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      identity: { email: 'person@example.com', displayName: 'Pilot Person' },
    })
  })

  it('hands the extension a denied identity without capture tokens', async () => {
    mockBackend({ user: { id: 'user-2', email: 'outsider@example.com' } })
    const complete = await handler(
      post(
        {
          action: 'complete',
          state: 'handshake-state-denied-1',
          refresh_token: 'refresh-token',
        },
        { authorization: 'Bearer outsider-session' },
      ),
    )
    expect(complete.statusCode).toBe(200)
    expect(JSON.parse(complete.body)).toMatchObject({
      authorized: false,
      connected: false,
    })
    const stored = [...handoffs.values()][0]
    expect(stored.access_token).toBe('')
    expect(stored.refresh_token).toBe('')

    const claim = await handler(
      post({ action: 'claim', state: 'handshake-state-denied-1' }),
    )
    expect(JSON.parse(claim.body)).toMatchObject({
      authorized: false,
      email: 'outsider@example.com',
    })
    expect(JSON.parse(claim.body).access_token).toBeUndefined()
  })
})
