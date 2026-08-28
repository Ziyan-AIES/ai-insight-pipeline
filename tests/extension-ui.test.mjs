import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentSource = readFileSync(join(root, 'extension/content.js'), 'utf8')
const optionsSource = readFileSync(join(root, 'extension/options.js'), 'utf8')
const optionsHtml = readFileSync(join(root, 'extension/options.html'), 'utf8')
const backgroundSource = readFileSync(join(root, 'extension/background.js'), 'utf8')
const manifest = JSON.parse(readFileSync(join(root, 'extension/manifest.json'), 'utf8'))

describe('extension session UI', () => {
  it('bumps the unpacked extension version', () => {
    expect(manifest.version).toBe('0.2.2')
    expect(manifest.permissions).toContain('alarms')
  })

  it('signs in through the dashboard handshake without a name or token', () => {
    expect(contentSource).toMatch(/aria-label="Sign in"/)
    expect(contentSource).toMatch(/setupDashboardHandshake/)
    expect(contentSource).toMatch(/bsw-claim-now/)
    expect(backgroundSource).toMatch(/extension_auth=1&state=/)
    expect(backgroundSource).toMatch(/chrome\.alarms/)
    expect(backgroundSource).toMatch(/bsw-claim-now/)
    expect(contentSource).not.toMatch(/bswWriteToken/)
    expect(optionsHtml).not.toMatch(/Write token/)
    expect(optionsHtml).not.toMatch(/Display name/)
    expect(optionsSource).not.toMatch(/bswWriteToken/)
    expect(optionsSource).toMatch(/Waiting for work-email sign-in/)
  })

  it('blocks capture when the signed-in account is not authorized', () => {
    expect(backgroundSource).toMatch(/status === 403/)
    expect(contentSource).toMatch(/unauthorized/)
  })

  it('one-click captures through the service worker and shows Saved or an error', () => {
    expect(contentSource).toMatch(/>MI</)
    expect(contentSource).toMatch(/data-act="save"/)
    expect(contentSource).toMatch(/data-act="dashboard"/)
    expect(contentSource).toMatch(/type: 'bsw-capture'/)
    expect(contentSource).toMatch(/Saved/)
    expect(contentSource).toMatch(/Save failed/)
    expect(backgroundSource).toMatch(/authorization: `Bearer \$\{accessToken\}`/)
    expect(contentSource).not.toMatch(/user:\s*state\.user/)
  })
})
