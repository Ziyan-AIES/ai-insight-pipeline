import {
  DEFAULT_WORKSPACE_URL,
  STORAGE_KEYS,
  normalizeWorkspaceUrl,
} from './shared.js'

const CLAIM_ALARM = 'bsw-claim-session'
const REFRESH_ALARM = 'bsw-refresh-session'
const CLAIM_PERIOD_MINUTES = 1
const REFRESH_PERIOD_MINUTES = 30
const HANDSHAKE_TTL_MS = 24 * 60 * 60 * 1000

chrome.runtime.onInstalled.addListener(() => {
  void resumeBackgroundWork()
})
chrome.runtime.onStartup.addListener(() => {
  void resumeBackgroundWork()
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CLAIM_ALARM) void claimPendingSession()
  if (alarm.name === REFRESH_ALARM) void refreshSession()
})
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab?.url) return
  if (!/extension_auth=1|aiinsightpipeline\.netlify\.app/i.test(tab.url)) return
  void claimPendingSession()
})

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
  if (message.type === 'bsw-claim-now') {
    void claimPendingSession().then(sendResponse)
    return true
  }
  if (message.type === 'bsw-get-session') {
    void getStoredSession().then(sendResponse)
    return true
  }
  if (message.type === 'bsw-adopt-dashboard-session') {
    void adoptDashboardSession(message).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-complete-dashboard-session') {
    void completeDashboardSession(message).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-open-dashboard') {
    void openDashboard(message.apiBase).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-capture') {
    void captureFromPage(message.payload).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-capture-status') {
    void captureStatus(message.url).then(sendResponse)
    return true
  }
  return false
})

void resumeBackgroundWork()

async function resumeBackgroundWork() {
  const stored = await getStoredSession()
  if (stored.pendingState) {
    await chrome.alarms.create(CLAIM_ALARM, { periodInMinutes: CLAIM_PERIOD_MINUTES })
    await claimPendingSession()
  }
  if (stored.refreshToken) {
    await chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_PERIOD_MINUTES })
  }
}

async function startSignIn(apiBase) {
  const origin = normalizeWorkspaceUrl(apiBase || (await storedApiBase()))
  const state = randomState()
  await chrome.storage.local.set({
    [STORAGE_KEYS.apiBase]: origin,
    [STORAGE_KEYS.pendingState]: state,
    [STORAGE_KEYS.pendingStartedAt]: Date.now(),
  })
  await chrome.alarms.create(CLAIM_ALARM, { periodInMinutes: CLAIM_PERIOD_MINUTES })
  const url = `${origin}/?extension_auth=1&state=${encodeURIComponent(state)}`
  await chrome.tabs.create({ url, active: true })
  void claimPendingSession()
  return { ok: true, url }
}

async function claimPendingSession() {
  const stored = await getStoredSession()
  const state = stored.pendingState
  if (!state) {
    await chrome.alarms.clear(CLAIM_ALARM)
    return { ok: false, pending: false }
  }
  if (
    stored.pendingStartedAt &&
    Date.now() - stored.pendingStartedAt > HANDSHAKE_TTL_MS
  ) {
    await chrome.storage.local.set({ [STORAGE_KEYS.pendingState]: '' })
    await chrome.alarms.clear(CLAIM_ALARM)
    return { ok: false, expired: true }
  }
  try {
    const result = await fetch(`${stored.apiBase}/api/extension-auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'claim', state }),
    })
    if (result.status === 404) return { ok: false, pending: true }
    const body = await result.json().catch(() => ({}))
    if (!result.ok) return { ok: false, pending: true }
    await applyClaim(stored.apiBase, body)
    await chrome.alarms.clear(CLAIM_ALARM)
    if (body.authorized && body.refresh_token) {
      await chrome.alarms.create(REFRESH_ALARM, {
        periodInMinutes: REFRESH_PERIOD_MINUTES,
      })
    }
    return { ok: true, authorized: body.authorized !== false }
  } catch {
    return { ok: false, pending: true }
  }
}

async function captureFromPage(payload) {
  const stored = await getStoredSession()
  if (!stored.accessToken || !stored.authorized) {
    return { ok: false, status: 401, error: 'Sign in required' }
  }
  const body = {
    kind: 'save',
    title: payload?.title || 'Untitled',
    url: payload?.url || '',
    source: payload?.source || '',
    text: payload?.text || '',
    images: Array.isArray(payload?.images) ? payload.images : [],
    takeaway: payload?.takeaway || '',
    category: payload?.category || 'ecosystem',
  }
  try {
    let result = await postCapture(stored.apiBase, stored.accessToken, body)
    if (result.status === 401) {
      const refreshed = await refreshSession()
      if (refreshed.ok && refreshed.access_token) {
        result = await postCapture(
          stored.apiBase,
          refreshed.access_token,
          body,
        )
      }
    }
    const parsed = await result.json().catch(() => ({}))
    if (result.status === 403 || parsed.code === 'not_authorized') {
      await chrome.storage.local.set({
        [STORAGE_KEYS.accessToken]: '',
        [STORAGE_KEYS.refreshToken]: '',
        [STORAGE_KEYS.identity]: null,
        [STORAGE_KEYS.authorized]: false,
        [STORAGE_KEYS.email]: parsed.email || stored.email || '',
      })
    }
    return {
      ok: result.ok,
      status: result.status,
      already_existed: Boolean(parsed.already_existed),
      error: parsed.error || (result.ok ? '' : `Save failed (${result.status})`),
    }
  } catch (error) {
    return { ok: false, status: 0, error: error.message || 'Save failed' }
  }
}

async function captureStatus(url) {
  const stored = await getStoredSession()
  if (!stored.accessToken || !stored.authorized) {
    return { ok: false, status: 401, saved: false }
  }
  try {
    let result = await getCaptureStatus(stored.apiBase, stored.accessToken, url)
    if (result.status === 401) {
      const refreshed = await refreshSession()
      if (refreshed.ok && refreshed.access_token) {
        result = await getCaptureStatus(
          stored.apiBase,
          refreshed.access_token,
          url,
        )
      }
    }
    const parsed = await result.json().catch(() => ({}))
    return {
      ok: result.ok,
      status: result.status,
      saved: Boolean(parsed.saved && !parsed.deleted),
      editorial_status: parsed.editorial_status || '',
    }
  } catch {
    return { ok: false, status: 0, saved: false }
  }
}

async function postCapture(apiBase, accessToken, body) {
  return fetch(`${apiBase}/api/capture`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
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

async function adoptDashboardSession(message) {
  const origin = normalizeWorkspaceUrl(message.apiBase || (await storedApiBase()))
  const accessToken = String(message.accessToken || '')
  if (!accessToken) return { ok: false, status: 401 }
  try {
    const result = await fetch(`${origin}/api/extension-auth`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: 'clone' }),
    })
    const body = await result.json().catch(() => ({}))
    if (!result.ok || body.authorized === false) {
      return { ok: false, status: result.status, authorized: false }
    }
    await applyClaim(origin, {
      authorized: true,
      access_token: body.access_token || '',
      refresh_token: body.refresh_token || '',
      identity: body.identity || null,
    })
    await chrome.alarms.create(REFRESH_ALARM, {
      periodInMinutes: REFRESH_PERIOD_MINUTES,
    })
    return { ok: true, authorized: true, identity: body.identity || null }
  } catch {
    return { ok: false, status: 0 }
  }
}

async function completeDashboardSession(message) {
  const state = String(message.state || '')
  const origin = normalizeWorkspaceUrl(message.apiBase || (await storedApiBase()))
  if (!/^[a-f0-9]{32,}$/i.test(state)) return { ok: false, status: 400 }
  let stored = await getStoredSession()
  if (!stored.authorized || !stored.accessToken || !stored.refreshToken) {
    return { ok: false, status: 401 }
  }
  let result = await postDashboardSession(origin, state, stored)
  if (result.status === 401) {
    const refreshed = await refreshSession()
    if (!refreshed.ok) return refreshed
    stored = await getStoredSession()
    result = await postDashboardSession(origin, state, stored)
  }
  const body = await result.json().catch(() => ({}))
  return { ok: result.ok, status: result.status, ...body }
}

async function openDashboard(apiBase) {
  const origin = normalizeWorkspaceUrl(apiBase || (await storedApiBase()))
  const stored = await getStoredSession()
  if (!stored.authorized || !stored.accessToken || !stored.refreshToken) {
    const url = `${origin}/#extension_auth_error=${encodeURIComponent('Extension session is not active. Sign in once with your work email.')}`
    await chrome.tabs.create({ url, active: true })
    return { ok: false, signedIn: false, url }
  }
  const state = randomState()
  const completed = await createDashboardHandoff(origin, state)
  if (!completed.ok) {
    const error = completed.error || 'Extension session expired. Sign in again.'
    const url = `${origin}/#extension_auth_error=${encodeURIComponent(error)}`
    await chrome.tabs.create({ url, active: true })
    return { ...completed, url }
  }
  const url = `${origin}/#dashboard_auth=1&state=${encodeURIComponent(state)}`
  await chrome.tabs.create({ url, active: true })
  return { ok: true, signedIn: true, url }
}

async function createDashboardHandoff(origin, state) {
  let stored = await getStoredSession()
  let result = await postDashboardHandoff(origin, state, stored.accessToken)
  if (result.status === 401) {
    const refreshed = await refreshSession()
    if (!refreshed.ok) {
      await signOut()
      return {
        ok: false,
        status: refreshed.status || 401,
        error: 'Extension session expired. Sign in again.',
      }
    }
    stored = await getStoredSession()
    result = await postDashboardHandoff(origin, state, stored.accessToken)
  }
  const body = await result.json().catch(() => ({}))
  return { ok: result.ok, status: result.status, ...body }
}

function postDashboardHandoff(origin, state, accessToken) {
  return fetch(`${origin}/api/extension-auth`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action: 'dashboard', state }),
  })
}

async function getCaptureStatus(apiBase, accessToken, url) {
  return fetch(`${apiBase}/api/status?url=${encodeURIComponent(url || '')}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
}

function postDashboardSession(origin, state, stored) {
  return fetch(`${origin}/api/extension-auth`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${stored.accessToken}`,
    },
    body: JSON.stringify({
      action: 'complete',
      state,
      refresh_token: stored.refreshToken,
    }),
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
    await chrome.alarms.clear(REFRESH_ALARM)
    return { ok: false, status: 403, email: body.email || stored.email }
  }
  if (!result.ok) return { ok: false, status: result.status }
  await applyClaim(stored.apiBase, body)
  return { ok: true, ...body }
}

async function signOut() {
  await chrome.alarms.clear(CLAIM_ALARM)
  await chrome.alarms.clear(REFRESH_ALARM)
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
    dockEnabled: values[STORAGE_KEYS.dockEnabled] !== false,
    pendingState: values[STORAGE_KEYS.pendingState] || '',
    pendingStartedAt: Number(values[STORAGE_KEYS.pendingStartedAt] || 0),
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
