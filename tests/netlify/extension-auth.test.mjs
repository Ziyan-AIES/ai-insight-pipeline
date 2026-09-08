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
    if (href.includes('/auth/v1/admin/generate_link')) {
      return new Response(
        JSON.stringify({ hashed_token: 'independent-token-hash' }),
        { status: 200 },
      )
    }
    if (href.includes('/auth/v1/verify')) {
      return new Response(
        JSON.stringify({
          access_token: 'independent-access-token',
          refresh_token: 'independent-refresh-token',
        }),
        { status: 200 },
      )
    }
    if (href.includes('team_members')) {
      return new Response(JSON.stringify(member ? [member] : []), { status: 200 })
    }
    if (href.includes('/rest/v1/rpc/claim_extension_auth_handoff')) {
      const { p_state_hash: stateHash } = JSON.parse(options.body)
      const row = handoffs.get(stateHash)
      if (!row) {
        return new Response(JSON.stringify({ status: 'pending' }), { status: 200 })
      }
      if (row.claimed_at) {
        return new Response(JSON.stringify({ status: 'consumed' }), { status: 200 })
      }
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        row.claimed_at = new Date().toISOString()
        row.access_token = ''
        row.refresh_token = ''
        return new Response(JSON.stringify({ status: 'expired' }), { status: 200 })
      }
      const claimed = { ...row, status: 'claimed' }
      row.claimed_at = new Date().toISOString()
      row.access_token = ''
      row.refresh_token = ''
      return new Response(JSON.stringify(claimed), { status: 200 })
    }
    if (href.includes('extension_auth_handoffs')) {
      const parsed = new URL(href)
      const stateEq = parsed.searchParams.get('state_hash')
      const stateHash = stateEq ? stateEq.replace(/^eq\./, '') : ''
      if (method === 'DELETE') {
        if (stateHash) handoffs.delete(stateHash)
        return new Response('[]', { status: 200 })
      }
      if (method === 'POST') {
        const row = JSON.parse(options.body)
        if (handoffs.has(row.state_hash) && String(options.headers?.prefer || '').includes('ignore-duplicates')) {
          return new Response('[]', { status: 200 })
        }
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
    const stored = [...handoffs.values()][0]
    const ttlMs = new Date(stored.expires_at).getTime() - Date.now()
    expect(ttlMs).toBeGreaterThan(9 * 60 * 1000)
    expect(ttlMs).toBeLessThan(11 * 60 * 1000)

    const claim = await handler(
      post({ action: 'claim', state: 'handshake-state-123456' }),
    )
    expect(claim.statusCode).toBe(200)
    expect(JSON.parse(claim.body)).toMatchObject({
      authorized: true,
      access_token: 'independent-access-token',
      refresh_token: 'independent-refresh-token',
      identity: { email: 'person@example.com', displayName: 'Pilot Person' },
    })
    expect([...handoffs.values()][0]).toMatchObject({
      access_token: '',
      refresh_token: '',
    })

    const replay = await handler(
      post({ action: 'claim', state: 'handshake-state-123456' }),
    )
    expect(replay.statusCode).toBe(409)
    expect(JSON.parse(replay.body)).toMatchObject({
      code: 'handoff_consumed',
      retry_needed: true,
    })
  })

  it('creates a fresh dashboard session only when the handoff is claimed', async () => {
    const backend = mockBackend({
      user: { id: 'user-1', email: 'person@example.com' },
      member,
    })
    const complete = await handler(
      post(
        { action: 'dashboard', state: 'dashboard-state-123456789' },
        { authorization: 'Bearer extension-access-token' },
      ),
    )
    expect(complete.statusCode).toBe(200)
    expect(
      backend.mock.calls.some(([url]) =>
        String(url).includes('/auth/v1/admin/generate_link'),
      ),
    ).toBe(false)

    const claim = await handler(
      post({ action: 'claim', state: 'dashboard-state-123456789' }),
    )
    expect(claim.statusCode).toBe(200)
    expect(JSON.parse(claim.body)).toMatchObject({
      access_token: 'independent-access-token',
      refresh_token: 'independent-refresh-token',
    })
  })

  it('clones a dashboard identity into a separate extension session', async () => {
    mockBackend({
      user: { id: 'user-1', email: 'person@example.com' },
      member,
    })
    const clone = await handler(
      post(
        { action: 'clone' },
        { authorization: 'Bearer dashboard-access-token' },
      ),
    )
    expect(clone.statusCode).toBe(200)
    expect(JSON.parse(clone.body)).toMatchObject({
      authorized: true,
      access_token: 'independent-access-token',
      refresh_token: 'independent-refresh-token',
      identity: { userId: 'user-1' },
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
