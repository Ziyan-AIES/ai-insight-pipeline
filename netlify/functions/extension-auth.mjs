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
      const refreshToken = String(body.refresh_token || '').trim()
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
      if (authorized && !refreshToken) {
        return response(
          400,
          { ok: false, error: 'state and session tokens are required' },
          {},
          event,
        )
      }
      const stateHash = hashState(state)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      await supabase('extension_auth_handoffs?state_hash=eq.' + stateHash, {
        method: 'DELETE',
      }).catch(() => null)
      await supabase('extension_auth_handoffs', {
        method: 'POST',
        body: JSON.stringify({
          state_hash: stateHash,
          user_id: auth.user.id,
          email: (member?.email || auth.user.email || '').slice(0, 320),
          authorized,
          access_token: authorized ? accessToken : '',
          refresh_token: authorized ? refreshToken : '',
          expires_at: expiresAt,
        }),
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
