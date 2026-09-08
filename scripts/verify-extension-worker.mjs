import http from 'node:http'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const extensionPath = resolve(process.env.AI_SIGNALS_EXTENSION_PATH || 'extension')
const profilePath = await mkdtemp(join(tmpdir(), 'ai-signals-worker-'))
let captureAttempts = 0

const server = http.createServer(async (request, response) => {
  if (request.method === 'POST') {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    response.setHeader('content-type', 'application/json')
    if (request.url === '/api/extension-auth' && body.action === 'claim') {
      response.end(JSON.stringify({
        authorized: true,
        access_token: 'WORKER_TEST_ACCESS',
        refresh_token: 'WORKER_TEST_REFRESH',
        identity: { email: 'worker-test@example.com', displayName: 'Worker Test' },
      }))
      return
    }
    if (request.url === '/api/capture') {
      captureAttempts += 1
      if (captureAttempts === 1) {
        response.statusCode = 503
        response.end(JSON.stringify({ error: 'Controlled capture failure' }))
      } else {
        response.end(JSON.stringify({ ok: true, already_existed: false }))
      }
      return
    }
    response.statusCode = 404
    response.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  response.setHeader('content-type', 'text/html; charset=utf-8')
  response.end(`<!doctype html><title>AI Signals worker check</title>
    <main><h1>Controlled extension page</h1><p>${request.url}</p></main>`)
})

await new Promise((ready) => server.listen(0, ready))
const address = server.address()
if (!address || typeof address === 'string') throw new Error('Test server did not start')
const workspaceOrigin = `http://127.0.0.1:${address.port}`
const articleOrigin = `http://localhost:${address.port}`

const context = await chromium.launchPersistentContext(profilePath, {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
})

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const worker = context.serviceWorkers()[0]
    || await context.waitForEvent('serviceworker', { timeout: 15_000 })
  const extensionId = new URL(worker.url()).host
  await worker.evaluate(async (apiBase) => {
    await chrome.storage.local.clear()
    await chrome.storage.local.set({ bswApiBase: apiBase, bswDockEnabled: true })
  }, workspaceOrigin)

  const article = await context.newPage()
  await article.goto(`${articleOrigin}/article`)
  const orb = article.locator('#bsw-floating-tools .bsw-orb')
  await orb.waitFor({ state: 'visible' })
  assert(
    await orb.getAttribute('aria-label') === 'Sign in to AI Signals',
    'Signed-out orb did not expose the sign-in action',
  )

  const workspacePageReady = context.waitForEvent('page', { timeout: 10_000 })
  await orb.click()
  const workspace = await workspacePageReady
  await workspace.waitForLoadState('domcontentloaded')
  assert(
    workspace.url().startsWith(`${workspaceOrigin}/?extension_auth=1&state=`),
    'Sign-in did not open the configured workspace handoff URL',
  )
  await article.locator('[data-act="save"]').waitFor({ state: 'visible' })

  await article.locator('[data-act="save"]').click()
  await article.locator('.bsw-composer textarea').fill('Controlled worker thought')
  await article.locator('[data-act="capture-save"]').click()
  await article.locator('.bsw-toast').filter({ hasText: "Couldn't save" }).waitFor()
  assert(
    await article.locator('.bsw-composer textarea').inputValue() === 'Controlled worker thought',
    'Capture failure discarded the pending thought',
  )
  await article.locator('[data-act="retry"]').click()
  await article.locator('.bsw-toast').filter({ hasText: 'Saved with thought' }).waitFor()
  assert(captureAttempts === 2, 'Capture retry did not make exactly two requests')

  await workspace.waitForFunction(() => (
    document.documentElement.getAttribute('data-ai-signals-batch-open') === '0.4.8'
  ))
  const openResult = await workspace.evaluate(({ first, second }) => new Promise((resolveResult) => {
    const requestId = `worker-check-${Date.now()}`
    const listener = (event) => {
      if (event.detail?.requestId !== requestId) return
      window.removeEventListener('ai-signals:open-urls-result', listener)
      resolveResult(event.detail)
    }
    window.addEventListener('ai-signals:open-urls-result', listener)
    window.dispatchEvent(new CustomEvent('ai-signals:open-urls', {
      detail: { requestId, urls: [first, second] },
    }))
  }), {
    first: `${articleOrigin}/source-a`,
    second: `${articleOrigin}/source-b`,
  })
  assert(openResult?.opened === 2 && openResult?.failedUrls?.length === 0, 'Batch open failed')

  const options = await context.newPage()
  await options.goto(`chrome-extension://${extensionId}/options.html`)
  await options.locator('#signOut').click()
  await article.locator('.bsw-orb[data-act="signin"]').waitFor({ state: 'visible' })
  const stored = await worker.evaluate(() => chrome.storage.local.get(null))
  assert(!stored.bswAccessToken && !stored.bswRefreshToken, 'Sign-out left credentials in storage')
  assert(stored.bswAuthorized === false, 'Sign-out left the extension authorized')

  const manifest = await worker.evaluate(() => chrome.runtime.getManifest())
  console.log(JSON.stringify({
    manifest: `${manifest.name}@${manifest.version}`,
    handoff: 'passed',
    captureRetry: 'passed',
    batchOpen: openResult.opened,
    signOut: 'passed',
  }))
} finally {
  await context.close()
  await new Promise((closed) => server.close(closed))
}
