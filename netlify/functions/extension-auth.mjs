import crypto from 'node:crypto'
import {
  bearerToken,
  getAuthUser,
  handleOptions,
  lookupTeamMember,
  memberIdentity,
  parseJsonBody,
  requireAllowedOrigin,
  response,
  supabase,
} from './_supabase.mjs'

export const config = {
  path: '/api/extension-auth',
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
}

const DASHBOARD_SESSION_MARKER = '__dashboard_session__'

function hashState(state) {
  return crypto.createHash('sha256').update(String(state || '')).digest('hex')
}

async function refreshSupabaseSession(refreshToken) {
  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const result = await fetch(
    `${url.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15000),
    },
  )
  const body = await result.json().catch(() => ({}))
  if (!result.ok) {
    throw new Error(body.error_description || body.msg || 'Session refresh failed')
  }
  return body
}

async function issueIndependentSession(email) {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const linkResult = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
    signal: AbortSignal.timeout(15000),
  })
  const link = await linkResult.json().catch(() => ({}))
  if (!linkResult.ok) {
    throw new Error(link.msg || link.error || 'Could not create a session link')
  }
  const tokenHash = String(
    link.hashed_token || link.properties?.hashed_token || '',
  )
  if (!tokenHash) throw new Error('Session link did not include a token hash')
  const verifyResult = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
    signal: AbortSignal.timeout(15000),
  })
  const session = await verifyResult.json().catch(() => ({}))
  if (!verifyResult.ok || !session.access_token || !session.refresh_token) {
    throw new Error(
      session.error_description || session.msg || 'Could not verify a new session',
    )
  }
  return session
}

async function storeHandoff({
  state,
  userId,
  email,
  authorized,
  accessToken = '',
  refreshToken = '',
}) {
  const stateHash = hashState(state)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await supabase('extension_auth_handoffs?state_hash=eq.' + stateHash, {
    method: 'DELETE',
  }).catch(() => null)
  await supabase('extension_auth_handoffs', {
    method: 'POST',
    body: JSON.stringify({
      state_hash: stateHash,
      user_id: userId,
      email: String(email || '').slice(0, 320),
      authorized,
      access_token: authorized ? accessToken : '',
      refresh_token: authorized ? refreshToken : '',
      expires_at: expiresAt,
    }),
  })
}

export async function handler(event) {
  const options = handleOptions(event)
  if (options) return options
  const blockedOrigin = requireAllowedOrigin(event, {
    allowTokenAuthenticatedClients: true,
    allowExtensionOrigin: true,
  })
  if (blockedOrigin) return blockedOrigin
  if (event.httpMethod !== 'POST') {
    return response(
      405,
      { ok: false, error: 'Method not allowed' },
      { allow: 'POST, OPTIONS' },
      event,
    )
  }
  const parsed = parseJsonBody(event, 16 * 1024)
  if (!parsed.value) {
    return response(
      parsed.statusCode,
      { ok: false, error: parsed.error },
      {},
      event,
    )
  }
  const body = parsed.value
  const action = String(body.action || '')

  try {
    if (action === 'complete') {
      const accessToken = bearerToken(event)
      const state = String(body.state || '').trim()
      if (state.length < 16 || !accessToken) {
        return response(
          400,
          { ok: false, error: 'state and session tokens are required' },
          {},
          event,
        )
      }
      const auth = await getAuthUser(accessToken, event)
      if (auth.denied) return auth.denied
      const member = await lookupTeamMember(auth.user.id)
      const authorized = Boolean(member)
      const email = member?.email || auth.user.email || ''
      const independent = authorized
        ? await issueIndependentSession(email)
        : null
      await storeHandoff({
        state,
        userId: auth.user.id,
        email,
        authorized,
        accessToken: independent?.access_token || '',
        refreshToken: independent?.refresh_token || '',
      })
      if (!authorized) {
        return response(
          200,
          {
            ok: true,
            connected: false,
            authorized: false,
            email: auth.user.email || '',
          },
          {},
          event,
        )
      }
      return response(
        200,
        {
          ok: true,
          connected: true,
          authorized: true,
          identity: memberIdentity(member, auth.user),
        },
        {},
        event,
      )
    }

    if (action === 'dashboard') {
      const accessToken = bearerToken(event)
      const state = String(body.state || '').trim()
      if (state.length < 16 || !accessToken) {
        return response(400, { ok: false, error: 'Invalid dashboard handoff' }, {}, event)
      }
      const auth = await getAuthUser(accessToken, event)
      if (auth.denied) return auth.denied
      const member = await lookupTeamMember(auth.user.id)
      if (!member) {
        return response(
          403,
          { ok: false, code: 'not_authorized', error: 'Workspace access is not enabled' },
          {},
          event,
        )
      }
      await storeHandoff({
        state,
        userId: auth.user.id,
        email: member.email || auth.user.email || '',
        authorized: true,
        accessToken: DASHBOARD_SESSION_MARKER,
      })
      return response(200, { ok: true, connected: true, authorized: true }, {}, event)
    }

    if (action === 'clone') {
      const accessToken = bearerToken(event)
      if (!accessToken) {
        return response(401, { ok: false, error: 'Sign in required' }, {}, event)
      }
      const auth = await getAuthUser(accessToken, event)
      if (auth.denied) return auth.denied
      const member = await lookupTeamMember(auth.user.id)
      if (!member) {
        return response(
          403,
          { ok: false, code: 'not_authorized', error: 'Workspace access is not enabled' },
          {},
          event,
        )
      }
      const independent = await issueIndependentSession(
        member.email || auth.user.email || '',
      )
      return response(
        200,
        {
          ok: true,
          authorized: true,
          access_token: independent.access_token,
          refresh_token: independent.refresh_token,
          identity: memberIdentity(member, auth.user),
        },
        {},
        event,
      )
    }

    if (action === 'claim') {
      const state = String(body.state || '').trim()
      if (state.length < 16) {
        return response(400, { ok: false, error: 'Invalid handshake' }, {}, event)
      }
      const stateHash = hashState(state)
      const rows = await supabase(
        `extension_auth_handoffs?state_hash=eq.${stateHash}&select=access_token,refresh_token,user_id,email,authorized,expires_at,claimed_at`,
      )
      const row = Array.isArray(rows) ? rows[0] : null
      if (!row || row.claimed_at || new Date(row.expires_at).getTime() < Date.now()) {
        return response(404, { ok: false, pending: true }, {}, event)
      }
      await supabase(`extension_auth_handoffs?state_hash=eq.${stateHash}`, {
        method: 'DELETE',
      })
      if (!row.authorized || !row.access_token) {
        return response(
          200,
          {
            ok: true,
            authorized: false,
            email: row.email || '',
          },
          {},
          event,
        )
      }
      const member = await lookupTeamMember(row.user_id)
      if (!member) {
        return response(
          200,
          {
            ok: true,
            authorized: false,
            email: row.email || '',
          },
          {},
          event,
        )
      }
      if (row.access_token === DASHBOARD_SESSION_MARKER) {
        const independent = await issueIndependentSession(
          member.email || row.email || '',
        )
        return response(
          200,
          {
            ok: true,
            authorized: true,
            access_token: independent.access_token,
            refresh_token: independent.refresh_token,
            identity: memberIdentity(member),
          },
          {},
          event,
        )
      }
      return response(
        200,
        {
          ok: true,
          authorized: true,
          access_token: row.access_token,
          refresh_token: row.refresh_token,
          identity: memberIdentity(member),
        },
        {},
        event,
      )
    }

    if (action === 'refresh') {
      const refreshToken = String(body.refresh_token || '').trim()
      if (!refreshToken) {
        return response(400, { ok: false, error: 'refresh_token is required' }, {}, event)
      }
      const tokens = await refreshSupabaseSession(refreshToken)
      const userRes = await fetch(
        `${String(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/auth/v1/user`,
        {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
            authorization: `Bearer ${tokens.access_token}`,
          },
        },
      )
      if (!userRes.ok) {
        return response(401, { ok: false, error: 'Invalid session' }, {}, event)
      }
      const user = await userRes.json()
      const member = await lookupTeamMember(user.id)
      if (!member) {
        return response(
          403,
          {
            ok: false,
            code: 'not_authorized',
            error: 'This account is not authorized to use AI Signals',
            email: user.email || '',
          },
          {},
          event,
        )
      }
      return response(
        200,
        {
          ok: true,
          authorized: true,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || refreshToken,
          identity: memberIdentity(member, user),
        },
        {},
        event,
      )
    }

    return response(400, { ok: false, error: 'Unknown action' }, {}, event)
  } catch (error) {
    console.error('extension-auth failed', error)
    return response(500, { ok: false, error: 'Extension auth failed' }, {}, event)
  }
}
