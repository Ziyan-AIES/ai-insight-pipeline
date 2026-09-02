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
    expect(manifest.version).toBe('0.4.5')
    expect(manifest.permissions).toContain('alarms')
    expect(manifest.web_accessible_resources.some((entry) => entry.resources.includes('qira-mark.svg'))).toBe(true)
    expect(contentSource).toMatch(/chrome\.runtime\.getURL\('qira-mark\.svg'\)/)
    expect(contentSource).toMatch(/aria-label="AI Signals"/)
    expect(contentSource).not.toMatch(/>MI</)
  })

  it('does not render an empty toast or a disabled dock', () => {
    expect(contentSource).toMatch(
      /#\$\{rootId\}\[hidden\],[\s\S]*#\$\{rootId\} \.bsw-toast\[hidden\][\s\S]*display: none !important/,
    )
    expect(contentSource).toMatch(/<div class="bsw-toast" hidden><\/div>/)
    expect(contentSource).toMatch(/toast\.hidden = true/)
  })

  it('keeps the official color mark on an unchanged white orb', () => {
    expect(qiraMark).toMatch(/#EB6296/)
    expect(qiraMark).toMatch(/#FF7257/)
    expect(qiraMark).toMatch(/#5C8DFF/)
    expect(qiraMark).toMatch(/#A079FF/)
    expect(qiraMark).toMatch(/#D06AD6/)
    expect(contentSource).toMatch(/background: rgba\(255, 255, 255, \.98\)/)
    expect(contentSource).not.toMatch(/orb\.dataset\.kind/)
    expect(contentSource).not.toMatch(/orb\.dataset\.busy/)
  })

  it('reveals a labeled vertical action hierarchy around Qira', () => {
    expect(contentSource).toMatch(/bsw-slot-top/)
    expect(contentSource).toMatch(/bsw-slot-bottom/)
    expect(contentSource).toMatch(/bsw-action-label/)
    expect(contentSource).toMatch(/topSlot\.innerHTML = actionMarkup\([\s\S]*'save'/)
    expect(contentSource).toMatch(/bottomSlot\.innerHTML = actionMarkup\('dashboard'/)
    expect(contentSource).not.toMatch(/\.bsw-actions/)
    expect(contentSource).not.toMatch(/translateX\(6px\)/)
  })

  it('signs in through the dashboard handshake without a name or token', () => {
    expect(contentSource).toMatch(/actionMarkup\('signin', 'Sign in'/)
    expect(contentSource).toContain('aria-label="${label}"')
    expect(contentSource).toMatch(/setupDashboardHandshake/)
    expect(contentSource).toMatch(/bsw-claim-now/)
    expect(backgroundSource).toMatch(/extension_auth=1&state=/)
    expect(backgroundSource).toMatch(/chrome\.alarms/)
    expect(backgroundSource).toMatch(/bsw-claim-now/)
    expect(contentSource).toMatch(/ai-signals:request-dashboard-session/)
    expect(contentSource).toMatch(/bsw-adopt-dashboard-session/)
    expect(contentSource).toMatch(/ai-signals:dashboard-sign-out/)
    expect(backgroundSource).toMatch(/bsw-complete-dashboard-session/)
    expect(backgroundSource).toMatch(/bsw-open-dashboard/)
    expect(backgroundSource).toMatch(/#dashboard_auth=1&state=/)
    expect(backgroundSource).toMatch(/action: 'clone'/)
    expect(backgroundSource).toMatch(/action: 'dashboard'/)
    expect(backgroundSource).toMatch(/extension_auth_error=/)
    expect(contentSource).not.toMatch(/window\.open\(state\.apiBase/)
    expect(optionsSource).toMatch(/bsw-open-dashboard/)
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

  it('shows action-level capture progress and mature result feedback', () => {
    expect(contentSource).toMatch(/topSlot\.innerHTML = actionMarkup\([\s\S]*'save'/)
    expect(contentSource).toMatch(/bottomSlot\.innerHTML = actionMarkup\('dashboard'/)
    expect(contentSource).toContain('data-act="${act}"')
    expect(contentSource).toMatch(/type: 'bsw-capture'/)
    expect(contentSource).toMatch(/captureIcon\(state\.captureState\)/)
    expect(contentSource).toMatch(/Save to AI Signals/)
    expect(contentSource).toMatch(/Optional thought/)
    expect(contentSource).toMatch(/data-act="capture-save"/)
    expect(contentSource).toMatch(/takeaway: state\.thought\.trim\(\)/)
    expect(contentSource).toMatch(/Saved with thought/)
    expect(contentSource).toMatch(/Saved to AI Signals/)
    expect(contentSource).toMatch(/Already saved · thought added/)
    expect(contentSource).toMatch(/Already saved · no duplicate created/)
    expect(contentSource).toMatch(/Already captured/)
    expect(contentSource).toMatch(/captureLabel = state\.captureState === 'saved'/)
    expect(contentSource).toMatch(/'Captured'/)
    expect(contentSource).toMatch(/type: 'bsw-capture-status'/)
    expect(backgroundSource).toMatch(/\/api\/status\?url=/)
    expect(contentSource).toMatch(
      /addEventListener\('pointerenter', \(\) => void refreshCaptureStatus\(\)\)/,
    )
    expect(contentSource).not.toMatch(
      /setInterval\(\(\) => \{\s*if \(location\.href === state\.captureStatusUrl\)/,
    )
    expect(contentSource).toMatch(/\.map\(\(node\) => visibleText\(node\)\)/)
    expect(contentSource).toMatch(/Access expired/)
    expect(contentSource).toMatch(/Couldn't save/)
    expect(contentSource).toMatch(/Retry/)
    expect(backgroundSource).toMatch(/authorization: `Bearer \$\{accessToken\}`/)
    expect(contentSource).not.toMatch(/user:\s*state\.user/)
  })

  it('keeps the thought composer and textarea inside the viewport', () => {
    expect(contentSource).toMatch(
      /\.bsw-composer \{[\s\S]*width: min\(292px, calc\(100vw - 92px\)\);[\s\S]*box-sizing: border-box/,
    )
    expect(contentSource).toMatch(
      /\.bsw-composer textarea \{[\s\S]*max-width: 100%;[\s\S]*box-sizing: border-box/,
    )
  })

  it('keeps settings lightweight and aligned to the Dashboard', () => {
    expect(optionsHtml).toMatch(/Aptos/)
    expect(optionsHtml).toMatch(/#f3f1f6/)
    expect(optionsHtml).toMatch(/#17102f/)
    expect(optionsHtml).toMatch(/Open Dashboard/)
    expect(optionsHtml).toMatch(/Show floating capture button/)
    expect(optionsHtml).not.toMatch(/Workspace URL/)
    expect(optionsHtml).not.toMatch(/Start collapsed/)
    expect(optionsHtml).not.toMatch(/Default category/)
    expect(optionsSource).toMatch(/STORAGE_KEYS\.dockEnabled/)
    expect(optionsSource).not.toMatch(/startCollapsed/)
    expect(optionsSource).not.toMatch(/defaultCategory/)
  })
})
