(function () {
  const DEFAULT_WORKSPACE_URL = 'https://aiinsightpipeline.netlify.app'
  const rootId = 'bsw-floating-tools'
  const QIRA_MARK_URL = chrome.runtime.getURL('qira-mark.svg')
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
    dockEnabled: true,
    toast: '',
    toastKind: 'ok',
    toastAction: '',
    captureState: 'idle',
    captureStatusUrl: '',
    captureStatusKnown: false,
    captured: false,
    statusBusy: false,
    busy: false,
    composerOpen: false,
    thought: '',
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
    state.dockEnabled = values.bswDockEnabled !== false
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
          color: #20242a;
          font-family: Aptos, "Helvetica Neue", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
        }
        #${rootId}[hidden],
        #${rootId} .bsw-toast[hidden] {
          display: none !important;
        }
        #${rootId} .bsw-dock {
          position: relative;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
        }
        #${rootId} .bsw-dock::before {
          content: "";
          position: absolute;
          inset: -48px -8px;
          z-index: 0;
          pointer-events: auto;
        }
        #${rootId} .bsw-slot {
          position: absolute;
          right: 0;
          z-index: 3;
          min-width: 164px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 150ms ease, transform 150ms ease;
        }
        #${rootId} .bsw-slot-top {
          bottom: calc(100% + 6px);
          transform: translateY(7px);
        }
        #${rootId} .bsw-slot-bottom {
          top: calc(100% + 6px);
          transform: translateY(-7px);
        }
        #${rootId} .bsw-dock:hover .bsw-slot,
        #${rootId} .bsw-dock:focus-within .bsw-slot,
        #${rootId}.bsw-hold .bsw-slot {
          opacity: 1;
          pointer-events: auto;
          transform: none;
        }
        #${rootId} .bsw-action-label {
          padding: 5px 8px;
          border: 1px solid rgba(215, 219, 224, .9);
          border-radius: 7px;
          background: rgba(247, 246, 250, .97);
          color: #30353c;
          font-size: 12px;
          font-weight: 650;
          line-height: 1;
          white-space: nowrap;
          box-shadow: 0 5px 14px rgba(23, 16, 47, .08);
        }
        #${rootId} .bsw-orb,
        #${rootId} .bsw-icon {
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        #${rootId} .bsw-orb {
          position: relative;
          z-index: 2;
          width: 40px;
          height: 40px;
          padding: 0;
          overflow: hidden;
          border: 1px solid rgba(137, 121, 201, .24);
          border-radius: 50%;
          background: rgba(255, 255, 255, .98);
          box-shadow: 0 8px 20px rgba(23, 16, 47, .14);
          transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
        }
        #${rootId} .bsw-orb:hover,
        #${rootId} .bsw-orb:focus-visible {
          transform: scale(1.03);
          border-color: rgba(77, 70, 125, .38);
          box-shadow: 0 10px 24px rgba(23, 16, 47, .17);
          outline: none;
        }
        #${rootId} .bsw-orb img {
          width: 31px;
          height: 31px;
          display: block;
        }
        #${rootId} .bsw-icon {
          width: 36px;
          height: 36px;
          padding: 0;
          border: 1px solid #d7dbe0;
          border-radius: 10px;
          background: #fff;
          color: #30353c;
          box-shadow: 0 5px 14px rgba(23, 16, 47, .08);
          transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
        }
        #${rootId} .bsw-icon:hover,
        #${rootId} .bsw-icon:focus-visible {
          transform: translateY(-1px);
          border-color: #aaaeb5;
          background: #f7f6fa;
          outline: none;
        }
        #${rootId} .bsw-icon[data-state="saved"] { color: #287f57; border-color: rgba(47, 151, 101, .4); }
        #${rootId} .bsw-icon[data-state="error"] { color: #a53a43; border-color: rgba(185, 67, 75, .42); }
        #${rootId} .bsw-icon svg { width: 17px; height: 17px; }
        #${rootId} .bsw-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(48, 53, 60, .18);
          border-top-color: #30353c;
          border-radius: 50%;
          animation: bsw-spin 700ms linear infinite;
        }
        @keyframes bsw-spin { to { transform: rotate(360deg); } }
        #${rootId} .bsw-toast {
          position: absolute;
          right: 0;
          top: calc(100% + 58px);
          min-width: 176px;
          max-width: 250px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 10px;
          border-radius: 8px;
          background: #20242a;
          color: #fff;
          font-size: 12px;
          line-height: 1.35;
          box-shadow: 0 10px 24px rgba(32, 36, 42, .2);
        }
        #${rootId} .bsw-toast[data-kind="err"] { background: #7f2d34; }
        #${rootId} .bsw-toast button {
          margin-left: auto;
          padding: 3px 6px;
          border: 1px solid rgba(255, 255, 255, .34);
          border-radius: 5px;
          background: transparent;
          color: #fff;
          cursor: pointer;
          font: 700 11px/1 Aptos, "Segoe UI", sans-serif;
          white-space: nowrap;
        }
        #${rootId} .bsw-composer {
          position: absolute;
          right: 52px;
          top: -24px;
          width: min(292px, calc(100vw - 92px));
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #d7dbe0;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 18px 42px rgba(32, 36, 42, .18);
        }
        #${rootId} .bsw-composer[hidden] { display: none; }
        #${rootId} .bsw-composer strong { display: block; font-size: 13px; }
        #${rootId} .bsw-composer p { margin: 4px 0 9px; color: #697079; font-size: 11px; line-height: 1.35; }
        #${rootId} .bsw-composer textarea {
          display: block;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          min-height: 68px;
          box-sizing: border-box;
          resize: vertical;
          padding: 8px 9px;
          border: 1px solid #d7dbe0;
          border-radius: 8px;
          color: #20242a;
          background: #faf9fb;
          font: 12px/1.4 Aptos, "Segoe UI", sans-serif;
        }
        #${rootId} .bsw-composer textarea:focus { border-color: #6e5b8d; outline: 2px solid rgba(85, 68, 114, .14); }
        #${rootId} .bsw-composer-actions { display: flex; justify-content: flex-end; gap: 7px; margin-top: 9px; }
        #${rootId} .bsw-composer-actions button {
          min-height: 30px;
          padding: 0 10px;
          border: 1px solid #d7dbe0;
          border-radius: 7px;
          background: #fff;
          color: #30353c;
          cursor: pointer;
          font: 700 11px/1 Aptos, "Segoe UI", sans-serif;
        }
        #${rootId} .bsw-composer-actions button[data-act="capture-save"] { border-color: #17102f; background: #17102f; color: #fff; }
      </style>
      <div class="bsw-dock">
        <div class="bsw-slot bsw-slot-top"></div>
        <button class="bsw-orb" type="button" title="AI Signals" aria-label="AI Signals">
          <img src="${QIRA_MARK_URL}" alt="" aria-hidden="true">
        </button>
        <div class="bsw-slot bsw-slot-bottom"></div>
      </div>
      <div class="bsw-composer" hidden>
        <strong>Save to AI Signals</strong>
        <p>Add a thought if there is something the team should discuss.</p>
        <textarea maxlength="500" aria-label="Optional thought" placeholder="Optional thought…"></textarea>
        <div class="bsw-composer-actions">
          <button type="button" data-act="capture-cancel">Cancel</button>
          <button type="button" data-act="capture-save">Save</button>
        </div>
      </div>
      <div class="bsw-toast" hidden></div>
    `
    document.documentElement.appendChild(root)
    root.addEventListener('click', onActionClick)
    root.addEventListener('pointerenter', () => void refreshCaptureStatus())
    root.addEventListener('input', (event) => {
      if (event.target.matches('.bsw-composer textarea')) state.thought = event.target.value
    })
  }

  function renderDock() {
    const root = document.getElementById(rootId)
    if (!root) return
    const mode = authMode()
    if (!state.dockEnabled || (onDashboard && mode === 'authorized')) {
      root.hidden = true
      return
    }
    root.hidden = false
    const topSlot = root.querySelector('.bsw-slot-top')
    const bottomSlot = root.querySelector('.bsw-slot-bottom')
    const toast = root.querySelector('.bsw-toast')
    const composer = root.querySelector('.bsw-composer')
    if (mode === 'authorized') {
      const captureLabel = state.captureState === 'saved'
        ? 'Captured'
        : state.captureState === 'saving'
          ? 'Saving…'
          : state.captureState === 'checking'
            ? 'Checking…'
            : 'Capture'
      topSlot.innerHTML = actionMarkup(
        'save',
        captureLabel,
        captureIcon(state.captureState),
        state.captureState,
      )
      bottomSlot.innerHTML = actionMarkup('dashboard', 'Dashboard', dashboardIcon())
    } else if (mode === 'unauthorized') {
      topSlot.innerHTML = actionMarkup('signin', 'Sign in again', signInIcon())
      bottomSlot.innerHTML = actionMarkup('dashboard', 'Dashboard', dashboardIcon())
    } else {
      topSlot.innerHTML = actionMarkup('signin', 'Sign in', signInIcon())
      bottomSlot.innerHTML = ''
    }
    if (state.toast) {
      toast.hidden = false
      toast.dataset.kind = state.toastKind
      toast.replaceChildren()
      const copy = document.createElement('span')
      copy.textContent = state.toast
      toast.append(copy)
      if (state.toastAction) {
        const action = document.createElement('button')
        action.type = 'button'
        action.dataset.act = state.toastAction
        action.textContent = state.toastAction === 'retry'
          ? 'Retry'
          : state.toastAction === 'dashboard'
            ? 'Dashboard'
            : 'Sign in again'
        toast.append(action)
      }
      root.classList.add('bsw-hold')
    } else {
      toast.hidden = true
      toast.replaceChildren()
      root.classList.remove('bsw-hold')
    }
    composer.hidden = !state.composerOpen || mode !== 'authorized'
    const thoughtInput = composer.querySelector('textarea')
    if (thoughtInput.value !== state.thought) thoughtInput.value = state.thought
  }

  function actionMarkup(act, label, icon, stateName = '') {
    const stateAttribute = stateName && stateName !== 'idle'
      ? ` data-state="${stateName}"`
      : ''
    return `
      <span class="bsw-action-label">${label}</span>
      <button class="bsw-icon" type="button" data-act="${act}"${stateAttribute} aria-label="${label}">
        ${icon}
      </button>
    `
  }

  async function onActionClick(event) {
    const act = event.target.closest('[data-act]')?.dataset.act
    if (act === 'signin') {
      chrome.runtime.sendMessage({ type: 'bsw-sign-in', apiBase: state.apiBase })
      showToast('Finish sign-in in the dashboard', 'ok', '', 3000)
    }
    if (act === 'dashboard') {
      chrome.runtime.sendMessage({
        type: 'bsw-open-dashboard',
        apiBase: state.apiBase,
      })
    }
    if (act === 'save') {
      state.composerOpen = true
      clearToast()
      renderDock()
      void refreshCaptureStatus()
      document.getElementById(rootId)?.querySelector('.bsw-composer textarea')?.focus()
    }
    if (act === 'capture-cancel') {
      state.composerOpen = false
      state.thought = ''
      renderDock()
    }
    if (act === 'capture-save' || act === 'retry') {
      await saveSignal()
    }
  }

  async function saveSignal() {
    if (state.busy) return
    if (state.captureStatusKnown && state.captured && !state.thought.trim()) {
      state.composerOpen = false
      showToast('Already captured', 'ok')
      return
    }
    state.busy = true
    state.captureState = 'saving'
    clearToast()
    renderDock()
    const page = scrapePage()
    const category = detectCategory(
      `${page.title} ${page.url} ${page.text.slice(0, 4000)}`,
    )
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
          takeaway: state.thought.trim(),
        },
      })
      if (result?.ok) {
        state.captureStatusUrl = page.url
        state.captureStatusKnown = true
        state.captured = true
        state.captureState = 'saved'
        const hadThought = Boolean(state.thought.trim())
        state.composerOpen = false
        state.thought = ''
        showToast(
          result.already_existed
            ? hadThought
              ? 'Already saved · thought added'
              : 'Already saved · no duplicate created'
            : hadThought
              ? 'Saved with thought'
              : 'Saved to AI Signals',
          'ok',
        )
      } else if (result?.status === 401) {
        state.captureState = 'error'
        showToast('Access expired', 'err', 'signin', 6000)
      } else if (result?.status === 403) {
        state.captureState = 'error'
        showToast('Access not enabled', 'err', 'dashboard', 6000)
      } else {
        state.captureState = 'error'
        showToast("Couldn't save", 'err', 'retry', 6000)
      }
    } catch {
      state.captureState = 'error'
      showToast("Couldn't save", 'err', 'retry', 6000)
    } finally {
      state.busy = false
      renderDock()
    }
  }

  async function refreshCaptureStatus(force = false) {
    if (
      !state.dockEnabled ||
      onDashboard ||
      authMode() !== 'authorized' ||
      state.statusBusy
    ) return
    const url = location.href
    if (state.captureStatusUrl !== url) {
      state.captureStatusKnown = false
      state.captured = false
    }
    if (
      !force &&
      state.captureStatusKnown &&
      state.captureStatusUrl === url
    ) return
    state.statusBusy = true
    state.captureStatusUrl = url
    if (state.captureState !== 'saving') state.captureState = 'checking'
    renderDock()
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'bsw-capture-status',
        url,
      })
      if (location.href !== url) return
      if (result?.ok) {
        state.captureStatusKnown = true
        state.captured = Boolean(result.saved)
      }
      if (state.captureState !== 'saving') {
        state.captureState = state.captured ? 'saved' : 'idle'
      }
    } catch {
      if (state.captureState !== 'saving') state.captureState = 'idle'
    } finally {
      state.statusBusy = false
      renderDock()
    }
  }

  function clearToast() {
    window.clearTimeout(showToast.timer)
    state.toast = ''
    state.toastAction = ''
  }

  function showToast(text, kind, action = '', duration = action ? 6000 : 1800) {
    state.toast = text
    state.toastKind = kind
    state.toastAction = action
    renderDock()
    window.clearTimeout(showToast.timer)
    showToast.timer = window.setTimeout(() => {
      state.toast = ''
      state.toastKind = 'ok'
      state.toastAction = ''
      state.captureState = state.captured ? 'saved' : 'idle'
      renderDock()
    }, duration)
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
    const candidates = [...new Set([
      document.querySelector('article'),
      document.querySelector('main'),
      document.body,
    ].filter(Boolean))]
    return candidates
      .map((node) => visibleText(node))
      .sort((a, b) => b.length - a.length)[0]
      ?.slice(0, 60000) || ''
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

  function captureIcon(stateName = 'idle') {
    if (stateName === 'saving' || stateName === 'checking') {
      return '<span class="bsw-spinner" aria-hidden="true"></span>'
    }
    if (stateName === 'saved') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
    }
    if (stateName === 'error') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 7v6"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>'
    }
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
        const tokens = readSupabaseSession()
        const origin = normalizeWorkspaceUrl(
          values.bswApiBase || DEFAULT_WORKSPACE_URL,
        )
        if (tokens?.access_token && tokens.refresh_token) {
          chrome.runtime.sendMessage({
            type: 'bsw-adopt-dashboard-session',
            apiBase: origin,
            accessToken: tokens.access_token,
          })
        }
        if (!pending) return
        chrome.runtime.sendMessage({ type: 'bsw-claim-now' })
        if (!tokens?.access_token) return
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
    window.addEventListener('ai-signals:request-dashboard-session', (event) => {
      const state = String(event.detail?.state || '')
      if (!/^[a-f0-9]{32,}$/i.test(state)) return
      chrome.runtime.sendMessage({
        type: 'bsw-complete-dashboard-session',
        state,
        apiBase: window.location.origin,
      })
    })
    window.addEventListener('ai-signals:dashboard-sign-out', () => {
      chrome.runtime.sendMessage({ type: 'bsw-sign-out' })
    })
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
