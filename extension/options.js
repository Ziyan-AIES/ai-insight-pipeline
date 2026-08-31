import {
  DEFAULT_WORKSPACE_URL,
  STORAGE_KEYS,
  normalizeWorkspaceUrl,
} from './shared.js'

const displayNameEl = document.getElementById('displayName')
const emailEl = document.getElementById('email')
const signedOutEl = document.getElementById('signedOut')
const accountEl = document.getElementById('account')
const statusEl = document.getElementById('status')
const accountDot = document.getElementById('accountDot')
const connectionLabel = document.getElementById('connectionLabel')
const accessLabel = document.getElementById('accessLabel')
const dockEnabled = document.getElementById('dockEnabled')

async function load() {
  const values = await chrome.storage.local.get(Object.values(STORAGE_KEYS))
  const signedIn = Boolean(values[STORAGE_KEYS.identity] || values[STORAGE_KEYS.email])
  const authorized = values[STORAGE_KEYS.authorized] === true
  const pending = Boolean(values[STORAGE_KEYS.pendingState])
  const identity = values[STORAGE_KEYS.identity] || {}

  signedOutEl.hidden = signedIn
  accountEl.hidden = !signedIn
  dockEnabled.checked = values[STORAGE_KEYS.dockEnabled] !== false

  displayNameEl.textContent = authorized
    ? identity.displayName || 'Team member'
    : 'Account not enabled'
  emailEl.textContent = identity.email || values[STORAGE_KEYS.email] || ''
  accountDot.dataset.state = authorized ? 'ok' : 'err'
  connectionLabel.textContent = authorized
    ? 'Connected to AI Signals'
    : 'Connected, access not enabled'
  accessLabel.textContent = authorized
    ? 'Capture enabled'
    : 'Ask a workspace admin to add this account to the team.'

  if (!signedIn && pending) {
    statusEl.textContent =
      'Waiting for work-email sign-in on the dashboard. This page updates automatically.'
  } else if (!signedIn) {
    statusEl.textContent = ''
  }
}

async function workspaceUrl() {
  const values = await chrome.storage.local.get(STORAGE_KEYS.apiBase)
  return normalizeWorkspaceUrl(
    values[STORAGE_KEYS.apiBase] || DEFAULT_WORKSPACE_URL,
  )
}

document.getElementById('signIn').addEventListener('click', async () => {
  statusEl.textContent = 'Opening workspace sign-in…'
  const apiBase = await workspaceUrl()
  await chrome.storage.local.set({ [STORAGE_KEYS.apiBase]: apiBase })
  chrome.runtime.sendMessage({ type: 'bsw-sign-in', apiBase }, (result) => {
    statusEl.textContent = result?.ok
      ? 'Finish sign-in in the workspace tab, then return here.'
      : 'Could not start sign-in'
  })
})

document.getElementById('openDashboard').addEventListener('click', async () => {
  chrome.runtime.sendMessage({
    type: 'bsw-open-dashboard',
    apiBase: await workspaceUrl(),
  })
})

document.getElementById('signOut').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'bsw-sign-out' }, () => {
    void load()
  })
})

dockEnabled.addEventListener('change', () => {
  void chrome.storage.local.set({
    [STORAGE_KEYS.dockEnabled]: dockEnabled.checked,
  })
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') void load()
})

void load()
