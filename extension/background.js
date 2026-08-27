import {
  DEFAULT_WORKSPACE_URL,
  STORAGE_KEYS,
  normalizeWorkspaceUrl,
} from './shared.js'

const AUTH_TIMEOUT_MS = 2 * 60 * 1000

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false
  if (message.type === 'bsw-sign-in') {
    void startSignIn(message.apiBase).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-sign-out') {
    void signOut().then(() => sendResponse({ ok: true }))
    return true
  }
  if (message.type === 'bsw-refresh-session') {
    void refreshSession().then(sendResponse)
    return true
  }
  if (message.type === 'bsw-get-session') {
    void getStoredSession().then(sendResponse)
    return true
  }
  return false
})

async function startSignIn(apiBase) {
  const origin = normalizeWorkspaceUrl(apiBase || (await storedApiBase()))
  const state = randomState()
  await chrome.storage.local.set({
    [STORAGE_KEYS.apiBase]: origin,
    [STORAGE_KEYS.pendingState]: state,
  })
  const url = `${origin}/?extension_auth=1&state=${encodeURIComponent(state)}`
  await chrome.tabs.create({ url, active: true })
  void pollClaim(origin, state)
  return { ok: true, url }
}

async function pollClaim(origin, state) {
  const started = Date.now()
  while (Date.now() - started < AUTH_TIMEOUT_MS) {
    await sleep(1200)
    try {
      const result = await fetch(`${origin}/api/extension-auth`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'claim', state }),
      })
      if (result.status === 404) continue
      const body = await result.json().catch(() => ({}))
      if (!result.ok) continue
      await applyClaim(origin, body)
      return
    } catch {
      // Keep polling until the dashboard handshake completes or times out.
    }
  }
}

async function applyClaim(origin, body) {
  if (body.authorized === false) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.apiBase]: origin,
      [STORAGE_KEYS.accessToken]: '',
      [STORAGE_KEYS.refreshToken]: '',
      [STORAGE_KEYS.identity]: null,
      [STORAGE_KEYS.authorized]: false,
      [STORAGE_KEYS.email]: body.email || '',
      [STORAGE_KEYS.pendingState]: '',
    })
    return
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.apiBase]: origin,
    [STORAGE_KEYS.accessToken]: body.access_token || '',
    [STORAGE_KEYS.refreshToken]: body.refresh_token || '',
    [STORAGE_KEYS.identity]: body.identity || null,
    [STORAGE_KEYS.authorized]: true,
    [STORAGE_KEYS.email]: body.identity?.email || '',
    [STORAGE_KEYS.pendingState]: '',
  })
}

async function refreshSession() {
  const stored = await getStoredSession()
  if (!stored.refreshToken) return { ok: false, status: 401 }
  const result = await fetch(`${stored.apiBase}/api/extension-auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'refresh',
      refresh_token: stored.refreshToken,
    }),
  })
  const body = await result.json().catch(() => ({}))
  if (result.status === 403 || body.code === 'not_authorized') {
    await chrome.storage.local.set({
      [STORAGE_KEYS.accessToken]: '',
      [STORAGE_KEYS.refreshToken]: '',
      [STORAGE_KEYS.identity]: null,
      [STORAGE_KEYS.authorized]: false,
      [STORAGE_KEYS.email]: body.email || stored.email || '',
    })
    return { ok: false, status: 403, email: body.email || stored.email }
  }
  if (!result.ok) return { ok: false, status: result.status }
  await applyClaim(stored.apiBase, body)
  return { ok: true, ...body }
}

async function signOut() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.accessToken]: '',
    [STORAGE_KEYS.refreshToken]: '',
    [STORAGE_KEYS.identity]: null,
    [STORAGE_KEYS.authorized]: false,
    [STORAGE_KEYS.email]: '',
    [STORAGE_KEYS.pendingState]: '',
  })
}

async function getStoredSession() {
  const values = await chrome.storage.local.get(Object.values(STORAGE_KEYS))
  return {
    apiBase: normalizeWorkspaceUrl(values[STORAGE_KEYS.apiBase] || DEFAULT_WORKSPACE_URL),
    accessToken: values[STORAGE_KEYS.accessToken] || '',
    refreshToken: values[STORAGE_KEYS.refreshToken] || '',
    identity: values[STORAGE_KEYS.identity] || null,
    authorized: values[STORAGE_KEYS.authorized] === true,
    email: values[STORAGE_KEYS.email] || values[STORAGE_KEYS.identity]?.email || '',
    startCollapsed: values[STORAGE_KEYS.startCollapsed] !== false,
    defaultCategory: values[STORAGE_KEYS.defaultCategory] || 'auto',
  }
}

async function storedApiBase() {
  const values = await chrome.storage.local.get(STORAGE_KEYS.apiBase)
  return normalizeWorkspaceUrl(values[STORAGE_KEYS.apiBase])
}

function randomState() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
