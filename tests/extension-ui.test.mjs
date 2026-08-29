import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentSource = readFileSync(join(root, 'extension/content.js'), 'utf8')
const optionsSource = readFileSync(join(root, 'extension/options.js'), 'utf8')
const optionsHtml = readFileSync(join(root, 'extension/options.html'), 'utf8')
const backgroundSource = readFileSync(join(root, 'extension/background.js'), 'utf8')
const qiraMark = readFileSync(join(root, 'extension/qira-mark.svg'), 'utf8')
const manifest = JSON.parse(readFileSync(join(root, 'extension/manifest.json'), 'utf8'))

describe('extension session UI', () => {
  it('bumps the unpacked extension version', () => {
    expect(manifest.version).toBe('0.2.3')
    expect(manifest.permissions).toContain('alarms')
    expect(manifest.web_accessible_resources.some((entry) => entry.resources.includes('qira-mark.svg'))).toBe(true)
    expect(contentSource).toMatch(/chrome\.runtime\.getURL\('qira-mark\.svg'\)/)
    expect(contentSource).toMatch(/aria-label="AI Signals"/)
    expect(contentSource).not.toMatch(/>MI</)
  })

  it('keeps the official color mark on a white orb in every status', () => {
    expect(qiraMark).toMatch(/#EB6296/)
    expect(qiraMark).toMatch(/#FF7257/)
    expect(qiraMark).toMatch(/#5C8DFF/)
    expect(qiraMark).toMatch(/#A079FF/)
    expect(qiraMark).toMatch(/#D06AD6/)
    expect(contentSource).toMatch(/background: rgba\(255, 255, 255, \.98\)/)
    expect(contentSource).toMatch(/\.bsw-orb\[data-kind="ok"\][\s\S]*border-color/)
    expect(contentSource).toMatch(/\.bsw-orb\[data-kind="err"\][\s\S]*border-color/)
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
    expect(contentSource).toMatch(/data-act="save"/)
    expect(contentSource).toMatch(/data-act="dashboard"/)
    expect(contentSource).toMatch(/type: 'bsw-capture'/)
    expect(contentSource).toMatch(/Saved/)
    expect(contentSource).toMatch(/Save failed/)
    expect(backgroundSource).toMatch(/authorization: `Bearer \$\{accessToken\}`/)
    expect(contentSource).not.toMatch(/user:\s*state\.user/)
  })
})
