(function () {
  const DEFAULT_WORKSPACE_URL = 'https://aiinsightpipeline.netlify.app'
  const rootId = 'bsw-floating-tools'
  if (isWorkspacePage()) return
  if (document.getElementById(rootId)) return

  const CATEGORIES = [
    { id: 'auto', label: 'Auto detect' },
    { id: 'interaction', label: 'Entry & Interaction' },
    { id: 'ai_hardware', label: 'AI Devices' },
    { id: 'ai_software', label: 'AI Experiences' },
    { id: 'ai_capability', label: 'AI Capability & Technology' },
    { id: 'ecosystem', label: 'Ecosystem' },
    { id: 'industry_events', label: 'Industry & Market' },
  ]
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
    refreshToken: '',
    identity: null,
    authorized: false,
    email: '',
    expanded: false,
    startCollapsed: true,
    defaultCategory: 'auto',
    saved: false,
  }

  const root = document.createElement('div')
  root.id = rootId
  root.innerHTML = `
    <style>
      #${rootId} {
        position: fixed;
        right: 18px;
        top: 42%;
        z-index: 2147483647;
        font-family: Inter, Segoe UI, Arial, sans-serif;
      }
      #${rootId} .bsw-fab {
        width: 58px;
        height: 52px;
        border: 1px solid rgba(154, 166, 255, .44);
        border-radius: 18px;
        background: linear-gradient(135deg, rgba(238, 246, 255, .96), rgba(235, 229, 255, .94));
        color: #5053d9;
        cursor: pointer;
        box-shadow: 0 14px 36px rgba(116, 92, 255, .22);
      }
      #${rootId} .bsw-panel {
        width: min(382px, calc(100vw - 36px));
        margin-top: 10px;
        background: linear-gradient(145deg, rgba(255,255,255,.97), rgba(244, 240, 255, .97));
        color: #20243d;
        border: 1px solid rgba(151, 164, 255, .35);
        border-radius: 22px;
        box-shadow: 0 24px 60px rgba(92, 83, 194, .24);
        padding: 16px;
      }
      #${rootId} .bsw-panel[hidden] { display: none; }
      #${rootId} h1 { margin: 0 0 6px; font-size: 18px; }
      #${rootId} p, #${rootId} label, #${rootId} small { margin: 0 0 10px; font-size: 13px; color: #4a4f7a; }
      #${rootId} label { display: grid; gap: 5px; font-weight: 700; }
      #${rootId} input, #${rootId} select, #${rootId} textarea {
        border: 1px solid rgba(151, 164, 255, .34);
        border-radius: 12px;
        padding: 8px 10px;
        font: 13px Inter, Segoe UI, Arial, sans-serif;
        color: #20243d;
      }
      #${rootId} textarea { min-height: 72px; resize: vertical; }
      #${rootId} button {
        height: 38px;
        border: 0;
        border-radius: 14px;
        padding: 0 13px;
        cursor: pointer;
        font: 700 13px Inter, Segoe UI, Arial, sans-serif;
        background: linear-gradient(135deg, #7179ff, #9a72ff);
        color: #fff;
      }
      #${rootId} button.secondary {
        background: #fff;
        color: #4a4f7a;
        border: 1px solid rgba(151, 164, 255, .34);
      }
      #${rootId} .row { display: flex; gap: 8px; }
      #${rootId} .saved { color: #2f7a4a; font-weight: 800; }
    </style>
    <button class="bsw-fab" type="button" aria-label="AI Signals">AI</button>
    <section class="bsw-panel" hidden></section>
  `
  document.documentElement.appendChild(root)
  const fab = root.querySelector('.bsw-fab')
  const panel = root.querySelector('.bsw-panel')

  fab.addEventListener('click', () => {
    state.expanded = !state.expanded
    renderPanel()
  })

  chrome.storage.local.get(null, (values) => {
    applyStorage(values)
    state.expanded = authMode() !== 'authorized' || !state.startCollapsed
    renderPanel()
  })
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    chrome.storage.local.get(null, (values) => {
      applyStorage(values)
      if (authMode() !== 'authorized') state.expanded = true
      renderPanel()
    })
  })

  function applyStorage(values) {
    state.apiBase = normalizeWorkspaceUrl(values.bswApiBase || DEFAULT_WORKSPACE_URL)
    state.accessToken = values.bswAccessToken || ''
    state.refreshToken = values.bswRefreshToken || ''
    state.identity = values.bswIdentity || null
    state.authorized = values.bswAuthorized === true
    state.email = values.bswEmail || values.bswIdentity?.email || ''
    state.startCollapsed = values.bswStartCollapsed !== false
    state.defaultCategory = values.bswDefaultCategory || 'auto'
  }

  function authMode() {
    if (!state.accessToken && !state.email) return 'signed-out'
    if (!state.authorized) return 'unauthorized'
    return 'authorized'
  }

  function renderPanel() {
    panel.hidden = !state.expanded
    const mode = authMode()
    if (mode === 'signed-out') {
      panel.innerHTML = `
        <h1>AI Signals</h1>
        <p>Not signed in</p>
        <p>Sign in with work email</p>
        <button type="button" data-act="signin">Sign in</button>
      `
      return
    }
    if (mode === 'unauthorized') {
      panel.innerHTML = `
        <h1>Access not enabled</h1>
        <p>${escapeHtml(state.email || 'This account')}</p>
        <p>An admin must add this email to the dashboard team list before capture works.</p>
        <button class="secondary" type="button" data-act="signout">Sign out</button>
      `
      return
    }
    const identity = state.identity || {}
    const detected = detectCategory(`${document.title} ${location.href} ${visibleText(document.body).slice(0, 4000)}`)
    const selected = state.defaultCategory === 'auto' ? 'auto' : state.defaultCategory
    panel.innerHTML = `
      <p>Signed in as ${escapeHtml(identity.displayName || 'Team member')}</p>
      <p>${escapeHtml(identity.email || state.email)}</p>
      <p>Capture access enabled</p>
      <label>Title<input data-field="title" value="${escapeAttr(document.title || '')}"></label>
      <label>URL<input data-field="url" value="${escapeAttr(location.href)}"></label>
      <label>Source<input data-field="source" value="${escapeAttr(location.hostname)}"></label>
      <label>Category
        <select data-field="category">
          ${CATEGORIES.map((category) => `<option value="${category.id}" ${category.id === selected ? 'selected' : ''}>${category.label}</option>`).join('')}
        </select>
      </label>
      <small>Auto detect suggestion: ${escapeHtml(labelFor(detected))}</small>
      <label>Takeaway<textarea data-field="takeaway" placeholder="Optional takeaway"></textarea></label>
      <div class="row">
        <button type="button" data-act="save">Save Signal</button>
        <button class="secondary" type="button" data-act="collapse">Close</button>
      </div>
      <p class="saved" data-saved hidden>Saved ✓</p>
    `
  }

  panel.addEventListener('click', async (event) => {
    const act = event.target.closest('[data-act]')?.dataset.act
    if (act === 'signin') {
      chrome.runtime.sendMessage({ type: 'bsw-sign-in', apiBase: state.apiBase })
    }
    if (act === 'signout') {
      chrome.runtime.sendMessage({ type: 'bsw-sign-out' })
    }
    if (act === 'collapse') {
      state.expanded = false
      renderPanel()
    }
    if (act === 'save') {
      await saveSignal()
    }
  })

  async function saveSignal() {
    const button = panel.querySelector('[data-act="save"]')
    if (button) button.disabled = true
    const fields = Object.fromEntries(
      Array.from(panel.querySelectorAll('[data-field]')).map((el) => [el.dataset.field, el.value]),
    )
    const category =
      fields.category === 'auto'
        ? detectCategory(`${fields.title} ${fields.url} ${visibleText(document.body).slice(0, 4000)}`)
        : fields.category
    try {
      const result = await captureWithRefresh({
        kind: 'save',
        title: fields.title,
        url: fields.url,
        source: fields.source,
        text: extractText(),
        images: extractImages(),
        takeaway: fields.takeaway,
        category,
      })
      if (!result.ok) return
      state.saved = true
      const saved = panel.querySelector('[data-saved]')
      if (saved) saved.hidden = false
      window.setTimeout(() => {
        state.expanded = false
        renderPanel()
      }, 1400)
    } finally {
      if (button) button.disabled = false
    }
  }

  async function captureWithRefresh(payload) {
    let response = await postCapture(payload)
    if (response.status === 401) {
      const refreshed = await refreshSession()
      if (refreshed) response = await postCapture(payload)
    }
    if (response.status === 403) {
      const body = await response.json().catch(() => ({}))
      state.authorized = false
      state.accessToken = ''
      state.refreshToken = ''
      state.identity = null
      state.email = body.email || state.email
      await chrome.storage.local.set({
        bswAuthorized: false,
        bswAccessToken: '',
        bswRefreshToken: '',
        bswIdentity: null,
        bswEmail: state.email,
      })
      renderPanel()
      return { ok: false }
    }
    if (!response.ok) return { ok: false }
    return { ok: true }
  }

  async function postCapture(payload) {
    return fetch(`${state.apiBase}/api/capture`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.accessToken}`,
      },
      body: JSON.stringify(payload),
    })
  }

  function refreshSession() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'bsw-refresh-session' }, (result) => {
        if (result?.ok && result.access_token) {
          state.accessToken = result.access_token
          state.refreshToken = result.refresh_token || state.refreshToken
          state.identity = result.identity || state.identity
          state.authorized = true
        }
        resolve(Boolean(result?.ok))
      })
    })
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

  function labelFor(id) {
    return CATEGORIES.find((category) => category.id === id)?.label || id
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;')
  }

  function isWorkspacePage() {
    return /aiinsightpipeline\.netlify\.app$/i.test(location.hostname)
  }
})()
