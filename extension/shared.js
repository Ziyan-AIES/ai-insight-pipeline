export const DEFAULT_WORKSPACE_URL = 'https://aiinsightpipeline.netlify.app'

export const STORAGE_KEYS = {
  apiBase: 'bswApiBase',
  accessToken: 'bswAccessToken',
  refreshToken: 'bswRefreshToken',
  identity: 'bswIdentity',
  authorized: 'bswAuthorized',
  email: 'bswEmail',
  dockEnabled: 'bswDockEnabled',
  pendingState: 'bswPendingAuthState',
  pendingStartedAt: 'bswPendingStartedAt',
  handoffError: 'bswHandoffError',
  sessionGeneration: 'bswSessionGeneration',
}

export function isAllowedWorkspaceOrigin(value) {
  const clean = String(value || '').trim().replace(/\/+$/, '')
  if (!clean) return false
  try {
    const url = new URL(clean)
    if (url.origin === DEFAULT_WORKSPACE_URL) return true
    return (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      (url.protocol === 'http:' || url.protocol === 'https:')
    )
  } catch {
    return false
  }
}

export function normalizeWorkspaceUrl(value) {
  if (!isAllowedWorkspaceOrigin(value)) return DEFAULT_WORKSPACE_URL
  return new URL(String(value).trim()).origin
}
