import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKSPACE_URL,
  STORAGE_KEYS,
  isAllowedWorkspaceOrigin,
  normalizeWorkspaceUrl,
} from '../extension/shared.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const backgroundSource = readFileSync(
  join(root, 'extension/background.js'),
  'utf8',
).replace(/^import \{[\s\S]*?\} from '\.\/shared\.js'\s*/, '')

function backgroundHarness(overrides = {}, options = {}) {
  const extensionId = 'test-extension-id'
  const values = {
    [STORAGE_KEYS.apiBase]: DEFAULT_WORKSPACE_URL,
    [STORAGE_KEYS.accessToken]: 'FAKE_ACCESS',
    [STORAGE_KEYS.refreshToken]: 'FAKE_REFRESH',
    [STORAGE_KEYS.authorized]: true,
    [STORAGE_KEYS.sessionGeneration]: 0,
    ...overrides,
  }
  const requests = []
  const createdTabs = []
  let messageListener
  let tabUpdatedListener

  const chrome = {
    runtime: {
      id: extensionId,
      getURL: (path = '') => `chrome-extension://${extensionId}/${path}`,
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: {
        addListener(listener) {
          messageListener = listener
        },
      },
    },
    alarms: {
      onAlarm: { addListener() {} },
      async create() {},
      async clear() {},
    },
    tabs: {
      onUpdated: {
        addListener(listener) {
          tabUpdatedListener = listener
        },
      },
      async create(options) {
        if (options.url === optionsForHarness.failTabUrl) {
          throw new Error('Simulated tab creation failure')
        }
        createdTabs.push(options)
      },
    },
    storage: {
      local: {
        async get(keys) {
          if (keys == null) return { ...values }
          const requested = Array.isArray(keys) ? keys : [keys]
          return Object.fromEntries(
            requested
              .filter((key) => Object.hasOwn(values, key))
              .map((key) => [key, values[key]]),
          )
        },
        async set(patch) {
          Object.assign(values, patch)
        },
      },
    },
  }

  const optionsForHarness = options

  const context = vm.createContext({
    AbortSignal,
    DEFAULT_WORKSPACE_URL,
    Date,
    STORAGE_KEYS,
    URL,
    Uint8Array,
    chrome,
    crypto: globalThis.crypto,
    fetch: async (url, requestOptions = {}) => {
      if (options.fetchImpl) {
        return options.fetchImpl(String(url), requestOptions, requests)
      }
      requests.push({ url: String(url), options: requestOptions })
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true }
        },
      }
    },
    isAllowedWorkspaceOrigin,
    normalizeWorkspaceUrl,
  })
  vm.runInContext(backgroundSource, context)

  async function send(message, sender) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`No response for ${message.type}`)),
        1000,
      )
      const handled = messageListener(message, sender, (response) => {
        clearTimeout(timeout)
        resolve(response)
      })
      if (!handled) {
        clearTimeout(timeout)
        reject(new Error(`Unhandled message ${message.type}`))
      }
    })
  }

  async function updateTab(url) {
    tabUpdatedListener(1, { status: 'complete' }, { url })
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  return { createdTabs, requests, send, updateTab, values }
}

describe('extension credential destination boundary', () => {
  it('accepts only the production origin and explicit loopback development origins', () => {
    expect(isAllowedWorkspaceOrigin(DEFAULT_WORKSPACE_URL)).toBe(true)
    expect(isAllowedWorkspaceOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedWorkspaceOrigin('https://127.0.0.1:4173/path')).toBe(true)
    expect(isAllowedWorkspaceOrigin('https://audit-aiinsightpipeline.netlify.app')).toBe(false)
    expect(isAllowedWorkspaceOrigin(`${DEFAULT_WORKSPACE_URL}:444`)).toBe(false)
    expect(isAllowedWorkspaceOrigin('http://aiinsightpipeline.netlify.app')).toBe(false)
    expect(normalizeWorkspaceUrl('https://audit-aiinsightpipeline.netlify.app')).toBe(
      DEFAULT_WORKSPACE_URL,
    )
  })

  it('does not send extension credentials for a lookalike workspace sender', async () => {
    const harness = backgroundHarness()
    const sender = {
      id: 'test-extension-id',
      url: 'https://audit-aiinsightpipeline.netlify.app/dashboard',
    }
    const state = 'a'.repeat(48)

    await expect(
      harness.send(
        {
          type: 'bsw-complete-dashboard-session',
          state,
          apiBase: 'https://audit-aiinsightpipeline.netlify.app',
        },
        sender,
      ),
    ).resolves.toMatchObject({ ok: false, status: 403 })
    await expect(
      harness.send(
        {
          type: 'bsw-adopt-dashboard-session',
          accessToken: 'FAKE_DASHBOARD_ACCESS',
          apiBase: 'https://audit-aiinsightpipeline.netlify.app',
        },
        sender,
      ),
    ).resolves.toMatchObject({ ok: false, status: 403 })

    expect(harness.requests).toHaveLength(0)
    expect(harness.values[STORAGE_KEYS.accessToken]).toBe('FAKE_ACCESS')
    expect(harness.values[STORAGE_KEYS.refreshToken]).toBe('FAKE_REFRESH')
  })

  it('derives the legitimate handoff destination from trusted storage', async () => {
    const harness = backgroundHarness()
    const state = 'b'.repeat(48)
    const response = await harness.send(
      {
        type: 'bsw-complete-dashboard-session',
        state,
        apiBase: 'https://audit-aiinsightpipeline.netlify.app',
      },
      {
        id: 'test-extension-id',
        url: `${DEFAULT_WORKSPACE_URL}/dashboard`,
      },
    )

    expect(response).toMatchObject({ ok: true, status: 200 })
    expect(harness.requests).toHaveLength(1)
    expect(harness.requests[0].url).toBe(`${DEFAULT_WORKSPACE_URL}/api/extension-auth`)
    expect(harness.requests[0].options.headers.authorization).toBe(
      'Bearer FAKE_ACCESS',
    )
    expect(JSON.parse(harness.requests[0].options.body)).toEqual({
      action: 'complete',
      state,
    })
  })

  it('ignores a page-supplied destination when starting sign-in', async () => {
    const harness = backgroundHarness({
      [STORAGE_KEYS.accessToken]: '',
      [STORAGE_KEYS.refreshToken]: '',
      [STORAGE_KEYS.authorized]: false,
    })
    await harness.send(
      {
        type: 'bsw-sign-in',
        apiBase: 'https://audit-aiinsightpipeline.netlify.app',
      },
      {
        id: 'test-extension-id',
        url: 'https://example.com/article',
      },
    )

    expect(harness.createdTabs).toHaveLength(1)
    expect(harness.createdTabs[0].url).toMatch(
      /^https:\/\/aiinsightpipeline\.netlify\.app\/\?extension_auth=1&state=/,
    )
  })

  it('claims a pending handoff only for a tab on the configured origin', async () => {
    const harness = backgroundHarness()
    harness.values[STORAGE_KEYS.pendingState] = 'c'.repeat(48)
    harness.values[STORAGE_KEYS.pendingStartedAt] = Date.now()

    await harness.updateTab('https://audit-aiinsightpipeline.netlify.app/?extension_auth=1')
    await harness.updateTab('http://localhost:5173/?extension_auth=1')
    expect(harness.requests).toHaveLength(0)

    await harness.updateTab(`${DEFAULT_WORKSPACE_URL}/?extension_auth=1`)
    expect(harness.requests).toHaveLength(1)
    expect(harness.requests[0].url).toBe(`${DEFAULT_WORKSPACE_URL}/api/extension-auth`)
  })

  it('opens a unique capped URL set only for the trusted workspace tab', async () => {
    const harness = backgroundHarness()
    const sender = {
      id: 'test-extension-id',
      url: `${DEFAULT_WORKSPACE_URL}/?workspace=radar`,
      tab: { id: 17, url: `${DEFAULT_WORKSPACE_URL}/?workspace=radar` },
    }
    const response = await harness.send(
      {
        type: 'bsw-open-urls',
        urls: [
          'https://example.com/source-a',
          'https://example.org/source-b',
          'https://example.com/source-a',
        ],
      },
      sender,
    )

    expect(response).toMatchObject({ ok: true, status: 200, opened: 2, failedUrls: [] })
    expect(harness.createdTabs).toEqual([
      {
        url: 'https://example.com/source-a',
        active: false,
        openerTabId: 17,
      },
      {
        url: 'https://example.org/source-b',
        active: false,
        openerTabId: 17,
      },
    ])
  })

  it('rejects untrusted, oversized, and unsafe batch-open requests', async () => {
    const harness = backgroundHarness()
    const trustedSender = {
      id: 'test-extension-id',
      url: `${DEFAULT_WORKSPACE_URL}/?workspace=radar`,
      tab: { id: 18, url: `${DEFAULT_WORKSPACE_URL}/?workspace=radar` },
    }

    await expect(
      harness.send(
        { type: 'bsw-open-urls', urls: ['https://example.com/source'] },
        {
          id: 'test-extension-id',
          url: 'https://audit-aiinsightpipeline.netlify.app/?workspace=radar',
          tab: { id: 19 },
        },
      ),
    ).resolves.toMatchObject({ ok: false, status: 403 })
    await expect(
      harness.send(
        { type: 'bsw-open-urls', urls: Array.from({ length: 6 }, (_, index) => `https://example.com/${index}`) },
        trustedSender,
      ),
    ).resolves.toMatchObject({ ok: false, status: 400, opened: 0 })
    await expect(
      harness.send(
        { type: 'bsw-open-urls', urls: ['javascript:alert(1)'] },
        trustedSender,
      ),
    ).resolves.toMatchObject({ ok: false, status: 400, opened: 0 })

    expect(harness.createdTabs).toHaveLength(0)
  })

  it('reports partial tab creation failures without claiming full success', async () => {
    const failedUrl = 'https://example.org/fails'
    const harness = backgroundHarness({}, { failTabUrl: failedUrl })
    const response = await harness.send(
      {
        type: 'bsw-open-urls',
        urls: ['https://example.com/opens', failedUrl],
      },
      {
        id: 'test-extension-id',
        url: `${DEFAULT_WORKSPACE_URL}/?workspace=radar`,
        tab: { id: 20 },
      },
    )

    expect(response).toMatchObject({
      ok: false,
      status: 502,
      opened: 1,
      failedUrls: [failedUrl],
    })
    expect(harness.createdTabs).toHaveLength(1)
  })

  it('returns a retryable response when a network request rejects', async () => {
    const harness = backgroundHarness({}, {
      fetchImpl: async (url, requestOptions, requests) => {
        requests.push({ url, options: requestOptions })
        throw new Error('Network unavailable')
      },
    })
    const response = await harness.send(
      { type: 'bsw-refresh-session' },
      {
        id: 'test-extension-id',
        url: 'chrome-extension://test-extension-id/options.html',
      },
    )
    expect(response).toMatchObject({
      ok: false,
      status: 0,
      retryable: true,
      error: 'Network unavailable',
    })
  })

  it('deduplicates concurrent refreshes in one worker', async () => {
    let release
    const responseReady = new Promise((resolve) => { release = resolve })
    const harness = backgroundHarness({}, {
      fetchImpl: async (url, requestOptions, requests) => {
        requests.push({ url, options: requestOptions })
        await responseReady
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              authorized: true,
              access_token: 'NEW_ACCESS',
              refresh_token: 'NEW_REFRESH',
              identity: { email: 'person@example.com' },
            }
          },
        }
      },
    })
    const sender = {
      id: 'test-extension-id',
      url: 'chrome-extension://test-extension-id/options.html',
    }
    const first = harness.send({ type: 'bsw-refresh-session' }, sender)
    const second = harness.send({ type: 'bsw-refresh-session' }, sender)
    await Promise.resolve()
    release()
    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(harness.requests).toHaveLength(1)
    expect(harness.values[STORAGE_KEYS.accessToken]).toBe('NEW_ACCESS')
  })

  it('does not restore a session when refresh finishes after sign-out', async () => {
    let release
    const responseReady = new Promise((resolve) => { release = resolve })
    const harness = backgroundHarness({}, {
      fetchImpl: async (url, requestOptions, requests) => {
        requests.push({ url, options: requestOptions })
        await responseReady
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              authorized: true,
              access_token: 'LATE_ACCESS',
              refresh_token: 'LATE_REFRESH',
              identity: { email: 'person@example.com' },
            }
          },
        }
      },
    })
    const sender = {
      id: 'test-extension-id',
      url: 'chrome-extension://test-extension-id/options.html',
    }
    const refresh = harness.send({ type: 'bsw-refresh-session' }, sender)
    await Promise.resolve()
    await harness.send({ type: 'bsw-sign-out' }, sender)
    release()
    await refresh
    expect(harness.values[STORAGE_KEYS.accessToken]).toBe('')
    expect(harness.values[STORAGE_KEYS.refreshToken]).toBe('')
    expect(harness.values[STORAGE_KEYS.authorized]).toBe(false)
    expect(harness.values[STORAGE_KEYS.sessionGeneration]).toBe(1)
  })
})
