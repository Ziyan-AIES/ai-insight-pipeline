import {
  DEFAULT_WORKSPACE_URL,
  STORAGE_KEYS,
  isAllowedWorkspaceOrigin,
  normalizeWorkspaceUrl,
} from './shared.js'

const CLAIM_ALARM = 'bsw-claim-session'
const REFRESH_ALARM = 'bsw-refresh-session'
const CLAIM_PERIOD_MINUTES = 1
const REFRESH_PERIOD_MINUTES = 30
const HANDSHAKE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_BATCH_OPEN_URLS = 5

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
  void claimFromTrustedTabUpdate(tab.url)
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false
  if (message.type === 'bsw-sign-in') {
    void startSignIn().then(sendResponse)
    return true
  }
  if (message.type === 'bsw-sign-out') {
    void signOutFromSender(sender).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-refresh-session') {
    void refreshFromSender(sender).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-claim-now') {
    void claimFromSender(sender).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-get-session') {
    void sessionForSender(sender).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-adopt-dashboard-session') {
    void adoptDashboardSession(message, sender).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-complete-dashboard-session') {
    void completeDashboardSession(message, sender).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-open-urls') {
    void openUrlsFromSender(message, sender).then(sendResponse)
    return true
  }
  if (message.type === 'bsw-open-dashboard') {
    void openDashboard().then(sendResponse)
    return true
  }
  if (message.type === 'bsw-capture') {
    void captureFromPage(message.payload).then(sendResponse)
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

async function startSignIn() {
  const origin = await storedApiBase()
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

async function adoptDashboardSession(message, sender) {
  const origin = await storedApiBase()
  if (!isTrustedWorkspaceSender(sender, origin)) return untrustedSender()
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

async function completeDashboardSession(message, sender) {
  const state = String(message.state || '')
  const origin = await storedApiBase()
  if (!isTrustedWorkspaceSender(sender, origin)) return untrustedSender()
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

async function openUrlsFromSender(message, sender) {
  const origin = await storedApiBase()
  if (!isTrustedWorkspaceSender(sender, origin) || !Number.isInteger(sender?.tab?.id)) {
    return untrustedSender()
  }
  if (
    !Array.isArray(message.urls) ||
    message.urls.length === 0 ||
    message.urls.length > MAX_BATCH_OPEN_URLS
  ) {
    return { ok: false, status: 400, opened: 0, failedUrls: [] }
  }

  const urls = []
  for (const candidate of message.urls) {
    const normalized = normalizeExternalUrl(candidate)
    if (!normalized) {
      return { ok: false, status: 400, opened: 0, failedUrls: [] }
    }
    if (!urls.includes(normalized)) urls.push(normalized)
  }

  const failedUrls = []
  let nextIndex = Number.isInteger(sender.tab.index) ? sender.tab.index + 1 : null
  for (const url of urls) {
    try {
      const createOptions = {
        url,
        active: false,
        openerTabId: sender.tab.id,
      }
      if (Number.isInteger(sender.tab.windowId)) createOptions.windowId = sender.tab.windowId
      if (nextIndex !== null) createOptions.index = nextIndex
      await chrome.tabs.create(createOptions)
      if (nextIndex !== null) nextIndex += 1
    } catch {
      failedUrls.push(url)
    }
  }
  const opened = urls.length - failedUrls.length
  return {
    ok: failedUrls.length === 0,
    status: failedUrls.length === 0 ? 200 : 502,
    opened,
    failedUrls,
  }
}

function normalizeExternalUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return ''
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
    return parsed.href
  } catch {
    return ''
  }
}

async function openDashboard() {
  const origin = await storedApiBase()
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

function postDashboardSession(origin, state, stored) {
  return fetch(`${origin}/api/extension-auth`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${stored.accessToken}`,
    },
    body: JSON.stringify({ action: 'complete', state }),
  })
}

async function signOutFromSender(sender) {
  const origin = await storedApiBase()
  if (!isTrustedControlSender(sender, origin)) return untrustedSender()
  await signOut()
  return { ok: true }
}

async function refreshFromSender(sender) {
  const origin = await storedApiBase()
  if (!isTrustedControlSender(sender, origin)) return untrustedSender()
  return refreshSession()
}

async function claimFromSender(sender) {
  const origin = await storedApiBase()
  if (!isTrustedWorkspaceSender(sender, origin)) return untrustedSender()
  return claimPendingSession()
}

async function claimFromTrustedTabUpdate(tabUrl) {
  const origin = await storedApiBase()
  if (!isTrustedWorkspaceUrl(tabUrl, origin)) return
  await claimPendingSession()
}

async function sessionForSender(sender) {
  const origin = await storedApiBase()
  if (!isTrustedControlSender(sender, origin)) return untrustedSender()
  return getStoredSession()
}

function senderUrl(sender) {
  return String(sender?.url || sender?.tab?.url || '')
}

function senderOrigin(sender) {
  try {
    return new URL(senderUrl(sender)).origin
  } catch {
    return ''
  }
}

function isExtensionSender(sender) {
  return (
    sender?.id === chrome.runtime.id &&
    senderUrl(sender).startsWith(chrome.runtime.getURL(''))
  )
}

function isTrustedWorkspaceSender(sender, expectedOrigin) {
  return (
    sender?.id === chrome.runtime.id &&
    isAllowedWorkspaceOrigin(expectedOrigin) &&
    senderOrigin(sender) === expectedOrigin
  )
}

function isTrustedControlSender(sender, expectedOrigin) {
  return isExtensionSender(sender) || isTrustedWorkspaceSender(sender, expectedOrigin)
}

function isTrustedWorkspaceUrl(value, expectedOrigin) {
  try {
    return (
      isAllowedWorkspaceOrigin(expectedOrigin) &&
      new URL(value).origin === expectedOrigin
    )
  } catch {
    return false
  }
}

function untrustedSender() {
  return { ok: false, status: 403, error: 'Untrusted extension message source' }
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
