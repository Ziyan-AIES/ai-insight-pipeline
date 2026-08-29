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
}

export function normalizeWorkspaceUrl(value) {
  const clean = String(value || '').trim().replace(/\/+$/, '')
  if (!clean) return DEFAULT_WORKSPACE_URL
  try {
    return new URL(clean).origin
  } catch {
    return clean
  }
}
