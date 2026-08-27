import {
  handleOptions,
  requireAllowedOrigin,
  resolveAuthorizedCaller,
  response,
} from './_supabase.mjs'

export const config = {
  path: '/api/extension-session',
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
}

export async function handler(event) {
  const options = handleOptions(event)
  if (options) return options
  const blockedOrigin = requireAllowedOrigin(event, {
    allowTokenAuthenticatedClients: true,
    allowExtensionOrigin: true,
  })
  if (blockedOrigin) return blockedOrigin
  if (event.httpMethod !== 'GET') {
    return response(
      405,
      { ok: false, error: 'Method not allowed' },
      { allow: 'GET, OPTIONS' },
      event,
    )
  }
  const session = await resolveAuthorizedCaller(event)
  if (session.denied) return session.denied
  if (!session.caller) {
    return response(401, { ok: false, error: 'Sign in required' }, {}, event)
  }
  return response(
    200,
    {
      ok: true,
      authorized: true,
      identity: session.caller,
    },
    {},
    event,
  )
}
