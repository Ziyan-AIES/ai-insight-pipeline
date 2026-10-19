import { bearerToken, getAuthUser, handleOptions, lookupTeamMember, requireAllowedOrigin, response } from './_supabase.mjs'

export const config = { path: '/api/research-workspace-access' }

export async function handler(event) {
  const options = handleOptions(event)
  if (options) return options
  const blocked = requireAllowedOrigin(event)
  if (blocked) return blocked
  if (event.httpMethod !== 'GET') return response(405, { allowed: false }, { allow: 'GET, OPTIONS' }, event)
  const token = bearerToken(event)
  if (!token) return response(401, { allowed: false }, {}, event)
  try {
    const auth = await getAuthUser(token, event)
    if (auth.denied) return auth.denied
    const member = await lookupTeamMember(auth.user.id)
    const allowed = auth.user.email?.toLowerCase() === 'lizy76@lenovo.com' && ['admin', 'editor'].includes(member?.role)
    return response(200, { allowed: Boolean(allowed) }, {}, event)
  } catch {
    return response(503, { allowed: false }, {}, event)
  }
}
