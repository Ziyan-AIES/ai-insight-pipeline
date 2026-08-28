import {
  CATEGORIES,
  DEFAULT_WORKSPACE_URL,
  STORAGE_KEYS,
  normalizeWorkspaceUrl,
} from './shared.js'

const displayNameEl = document.getElementById('displayName')
const emailEl = document.getElementById('email')
const authorizedEl = document.getElementById('authorized')
const signedOutEl = document.getElementById('signedOut')
const accountEl = document.getElementById('account')
const workspaceField = document.getElementById('workspaceField')
const apiBaseInput = document.getElementById('apiBase')
const statusEl = document.getElementById('status')
const startCollapsed = document.getElementById('startCollapsed')
const defaultCategory = document.getElementById('defaultCategory')

for (const category of CATEGORIES) {
  const option = document.createElement('option')
  option.value = category.id
  option.textContent = category.label
  defaultCategory.append(option)
}

async function load() {
  const values = await chrome.storage.local.get(Object.values(STORAGE_KEYS))
  const signedIn = Boolean(values[STORAGE_KEYS.identity] || values[STORAGE_KEYS.email])
  const authorized = values[STORAGE_KEYS.authorized] === true
  const pending = Boolean(values[STORAGE_KEYS.pendingState])
  const identity = values[STORAGE_KEYS.identity] || {}
  const storedOrigin = String(values[STORAGE_KEYS.apiBase] || '').trim()
  apiBaseInput.value = storedOrigin || DEFAULT_WORKSPACE_URL
  const originUnknown = !storedOrigin
  workspaceField.hidden = signedIn || !originUnknown
  signedOutEl.hidden = signedIn
  accountEl.hidden = !signedIn
  displayNameEl.textContent = authorized
    ? identity.displayName || 'Team member'
    : '—'
  emailEl.textContent = identity.email || values[STORAGE_KEYS.email] || '—'
  authorizedEl.textContent = authorized ? 'Yes' : 'No'
  startCollapsed.checked = values[STORAGE_KEYS.startCollapsed] !== false
  defaultCategory.value = values[STORAGE_KEYS.defaultCategory] || 'auto'
  if (!signedIn && pending) {
    statusEl.textContent =
      'Waiting for work-email sign-in on the dashboard. This page updates automatically.'
  } else if (!signedIn) {
    statusEl.textContent = ''
  }
}

document.getElementById('signIn').addEventListener('click', async () => {
  statusEl.textContent = 'Opening workspace sign-in…'
  const apiBase = normalizeWorkspaceUrl(apiBaseInput.value)
  await chrome.storage.local.set({ [STORAGE_KEYS.apiBase]: apiBase })
  chrome.runtime.sendMessage({ type: 'bsw-sign-in', apiBase }, (result) => {
    statusEl.textContent = result?.ok
      ? 'Finish sign-in in the workspace tab, then return here.'
      : 'Could not start sign-in'
  })
})

document.getElementById('signOut').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'bsw-sign-out' }, () => {
    void load()
  })
})

startCollapsed.addEventListener('change', () => {
  void chrome.storage.local.set({
    [STORAGE_KEYS.startCollapsed]: startCollapsed.checked,
  })
})

defaultCategory.addEventListener('change', () => {
  void chrome.storage.local.set({
    [STORAGE_KEYS.defaultCategory]: defaultCategory.value,
  })
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') void load()
})

void load()
