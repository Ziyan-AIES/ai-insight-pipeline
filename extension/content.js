(function () {
  const DEFAULT_WORKSPACE_URL = 'https://aiinsightpipeline.netlify.app'
  const rootId = 'bsw-floating-tools'
  const CATEGORY_KEYWORDS = {
    interaction: ['interaction', 'interface', 'ux', 'ui', 'assistant', 'browser', 'voice', 'multimodal'],
    ai_software: ['software', 'app', 'saas', 'copilot', 'agent', 'workflow', 'automation', 'cursor'],
    ai_hardware: ['chip', 'gpu', 'npu', 'device', 'robot', 'nvidia', 'hardware'],
    ecosystem: ['ecosystem', 'platform', 'partner', 'open source', 'marketplace', 'funding', 'regulation'],
    ai_capability: ['model', 'llm', 'reasoning', 'benchmark', 'training', 'inference', 'gpt', 'claude'],
    industry_events: ['ces', 'earnings', 'market', 'ipo', 'acquisition', 'conference'],
  }

  const state = {
    apiBase: DEFAULT_WORKSPACE_URL,
    accessToken: '',
    authorized: false,
    email: '',
    pendingState: '',
    defaultCategory: 'auto',
    toast: '',
    toastKind: 'ok',
    busy: false,
  }
  const onDashboard = isWorkspacePage()

  if (onDashboard) {
    setupDashboardHandshake()
  }
  mountDock()

  chrome.storage.local.get(null, (values) => {
    applyStorage(values)
    renderDock()
  })
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    chrome.storage.local.get(null, (values) => {
      applyStorage(values)
      renderDock()
    })
  })

  function applyStorage(values) {
    state.apiBase = normalizeWorkspaceUrl(values.bswApiBase || DEFAULT_WORKSPACE_URL)
    state.accessToken = values.bswAccessToken || ''
    state.authorized = values.bswAuthorized === true
    state.email = values.bswEmail || values.bswIdentity?.email || ''
    state.pendingState = values.bswPendingAuthState || ''
    state.defaultCategory = values.bswDefaultCategory || 'auto'
  }

  function authMode() {
    if (state.authorized && state.accessToken) return 'authorized'
    if (state.email && !state.authorized) return 'unauthorized'
    if (state.pendingState) return 'pending'
    return 'signed-out'
  }

  function mountDock() {
    if (document.getElementById(rootId)) return
    const root = document.createElement('div')
    root.id = rootId
    root.innerHTML = `
      <style>
        #${rootId} {
          position: fixed;
          right: 16px;
          top: 42%;
          z-index: 2147483647;
          font-family: Inter, Segoe UI, Arial, sans-serif;
        }
        #${rootId} .bsw-dock {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #${rootId} .bsw-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          opacity: 0;
          pointer-events: none;
          transform: translateX(6px);
          transition: opacity 140ms ease, transform 140ms ease;
        }
        #${rootId} .bsw-dock:hover .bsw-actions,
        #${rootId} .bsw-dock:focus-within .bsw-actions,
        #${rootId}.bsw-hold .bsw-actions {
          opacity: 1;
          pointer-events: auto;
          transform: none;
        }
        #${rootId} .bsw-orb,
        #${rootId} .bsw-icon {
          width: 40px;
          height: 40px;
          border: 0;
          border-radius: 50%;
          cursor: pointer;
          display: grid;
          place-items: center;
          box-shadow: 0 8px 22px rgba(61, 52, 112, .22);
        }
        #${rootId} .bsw-orb {
          background: #4d467d;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .04em;
        }
        #${rootId} .bsw-orb[data-kind="ok"] { background: #215c3d; }
        #${rootId} .bsw-orb[data-kind="err"] { background: #8a2f2f; }
        #${rootId} .bsw-icon {
          background: #fff;
          color: #3d3470;
          border: 1px solid #d7d0f0;
        }
        #${rootId} .bsw-icon svg { width: 18px; height: 18px; }
        #${rootId} .bsw-toast {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          min-width: 140px;
          max-width: 220px;
          padding: 8px 10px;
          border-radius: 10px;
          background: #20243d;
          color: #fff;
          font-size: 12px;
          line-height: 1.35;
          box-shadow: 0 10px 24px rgba(32, 36, 61, .24);
        }
        #${rootId} .bsw-toast[data-kind="err"] { background: #8a2f2f; }
      </style>
      <div class="bsw-dock">
        <div class="bsw-actions"></div>
        <button class="bsw-orb" type="button" aria-label="MI">MI</button>
      </div>
      <div class="bsw-toast" hidden></div>
    `
    document.documentElement.appendChild(root)
    root.querySelector('.bsw-actions').addEventListener('click', onActionClick)
  }

  function renderDock() {
    const root = document.getElementById(rootId)
    if (!root) return
    const mode = authMode()
    if (onDashboard && mode === 'authorized') {
      root.hidden = true
      return
    }
    root.hidden = false
    const orb = root.querySelector('.bsw-orb')
    const actions = root.querySelector('.bsw-actions')
    const toast = root.querySelector('.bsw-toast')
    orb.textContent = state.busy ? '…' : 'MI'
    orb.dataset.kind = state.toastKind === 'err' && state.toast ? 'err' : state.toastKind === 'ok' && state.toast ? 'ok' : 'idle'
    if (mode === 'authorized') {
      actions.innerHTML = `
        <button class="bsw-icon" type="button" data-act="save" title="Capture" aria-label="Capture">
          ${captureIcon()}
        </button>
        <button class="bsw-icon" type="button" data-act="dashboard" title="Dashboard" aria-label="Dashboard">
          ${dashboardIcon()}
        </button>
      `
    } else if (mode === 'unauthorized') {
      actions.innerHTML = `
        <button class="bsw-icon" type="button" data-act="dashboard" title="Dashboard" aria-label="Dashboard">
          ${dashboardIcon()}
        </button>
      `
    } else {
      actions.innerHTML = `
        <button class="bsw-icon" type="button" data-act="signin" title="Sign in" aria-label="Sign in">
          ${signInIcon()}
        </button>
      `
    }
    if (state.toast) {
      toast.hidden = false
      toast.dataset.kind = state.toastKind
      toast.textContent = state.toast
      root.classList.add('bsw-hold')
    } else {
      toast.hidden = true
      toast.textContent = ''
      root.classList.remove('bsw-hold')
    }
  }

  async function onActionClick(event) {
    const act = event.target.closest('[data-act]')?.dataset.act
    if (act === 'signin') {
      chrome.runtime.sendMessage({ type: 'bsw-sign-in', apiBase: state.apiBase })
      showToast('Open the dashboard tab to finish sign-in', 'ok')
    }
    if (act === 'dashboard') {
      window.open(state.apiBase, '_blank', 'noopener')
    }
    if (act === 'save') {
      await saveSignal()
    }
  }

  async function saveSignal() {
    if (state.busy) return
    state.busy = true
    showToast('Saving…', 'ok')
    const page = scrapePage()
    const category =
      state.defaultCategory === 'auto'
        ? detectCategory(`${page.title} ${page.url} ${page.text.slice(0, 4000)}`)
        : state.defaultCategory
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'bsw-capture',
        payload: {
          title: page.title,
          url: page.url,
          source: page.source,
          text: page.text,
          images: page.images,
          category,
        },
      })
      if (result?.ok) {
        showToast(result.already_existed ? 'Already saved' : 'Saved', 'ok')
      } else {
        showToast(result?.error || 'Save failed', 'err')
      }
    } catch (error) {
      showToast(error.message || 'Save failed', 'err')
    } finally {
      state.busy = false
      renderDock()
    }
  }

  function showToast(text, kind) {
    state.toast = text
    state.toastKind = kind
    renderDock()
    window.clearTimeout(showToast.timer)
    showToast.timer = window.setTimeout(() => {
      state.toast = ''
      state.toastKind = 'ok'
      renderDock()
    }, 2400)
  }

  function scrapePage() {
    let source = ''
    try {
      source = new URL(location.href).hostname.replace(/^www\./, '')
    } catch {
      source = location.hostname || ''
    }
    return {
      title: (document.querySelector('meta[property="og:title"]')?.content || document.title || '').trim() || 'Untitled',
      url: location.href,
      source,
      text: extractText(),
      images: extractImages(),
    }
  }

  function detectCategory(text) {
    const haystack = String(text || '').toLowerCase()
    let best = { id: 'ecosystem', score: 0 }
    for (const [id, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const score = keywords.reduce((sum, keyword) => sum + (haystack.includes(keyword) ? 1 : 0), 0)
      if (score > best.score) best = { id, score }
    }
    return best.id
  }

  function extractText() {
    const candidates = [
      document.querySelector('article'),
      document.querySelector('main'),
      document.body,
    ].filter(Boolean)
    const best = candidates.sort((a, b) => visibleText(b).length - visibleText(a).length)[0]
    return visibleText(best).slice(0, 60000)
  }

  function extractImages() {
    const pageUrl = new URL(location.href)
    return Array.from(document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]'))
      .map((meta) => {
        const src = meta.getAttribute('content') || ''
        if (!src) return null
        try {
          return { url: new URL(src, pageUrl).href, alt: document.title || 'Article image' }
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .slice(0, 12)
  }

  function visibleText(node) {
    return (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim()
  }

  function normalizeWorkspaceUrl(value) {
    const clean = String(value || '').trim().replace(/\/+$/, '')
    if (!clean) return DEFAULT_WORKSPACE_URL
    try {
      return new URL(clean).origin
    } catch {
      return clean
    }
  }

  function captureIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/></svg>`
  }

  function dashboardIcon() {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>`
  }

  function signInIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2"/><path d="M4 12h11"/><path d="m12 8 4 4-4 4"/></svg>`
  }

  function isWorkspacePage() {
    return /aiinsightpipeline\.netlify\.app$/i.test(location.hostname)
  }

  function readSupabaseSession() {
    const prefix = 'sb-'
    const suffix = '-auth-token'
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(prefix) || !key.endsWith(suffix)) continue
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '')
        if (parsed?.access_token) {
          return {
            access_token: String(parsed.access_token),
            refresh_token: String(parsed.refresh_token || ''),
          }
        }
      } catch {
        /* ignore malformed supabase keys */
      }
    }
    return null
  }

  function setupDashboardHandshake() {
    let inFlight = false
    async function syncHandoff() {
      if (inFlight) return
      inFlight = true
      try {
        const values = await chrome.storage.local.get([
          'bswPendingAuthState',
          'bswApiBase',
        ])
        const pending = values.bswPendingAuthState
        if (!pending) return
        chrome.runtime.sendMessage({ type: 'bsw-claim-now' })
        const tokens = readSupabaseSession()
        if (!tokens?.access_token) return
        const origin = normalizeWorkspaceUrl(
          values.bswApiBase || DEFAULT_WORKSPACE_URL,
        )
        await fetch(`${origin}/api/extension-auth`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${tokens.access_token}`,
          },
          body: JSON.stringify({
            action: 'complete',
            state: pending,
            refresh_token: tokens.refresh_token || '',
          }),
        })
        chrome.runtime.sendMessage({ type: 'bsw-claim-now' })
      } catch (error) {
        console.warn('[AI Signals] dashboard handshake failed', error)
      } finally {
        inFlight = false
      }
    }
    void syncHandoff()
    const timer = window.setInterval(() => {
      chrome.storage.local.get('bswPendingAuthState', (values) => {
        if (!values.bswPendingAuthState) {
          window.clearInterval(timer)
          return
        }
        void syncHandoff()
      })
    }, 2500)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.bswPendingAuthState) void syncHandoff()
    })
  }
})()
