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
    expect(manifest.version).toBe('0.2.0')
  })

  it('signs in through the dashboard handshake without a name or token', () => {
    expect(contentSource).toMatch(/Not signed in/)
    expect(contentSource).toMatch(/Sign in with work email/)
    expect(backgroundSource).toMatch(/extension_auth=1&state=/)
    expect(contentSource).not.toMatch(/bswWriteToken/)
    expect(optionsHtml).not.toMatch(/Write token/)
    expect(optionsHtml).not.toMatch(/Display name/)
    expect(optionsSource).not.toMatch(/bswWriteToken/)
  })

  it('blocks capture when the signed-in account is not authorized', () => {
    expect(contentSource).toMatch(/Access not enabled/)
    expect(contentSource).toMatch(/status === 403/)
  })

  it('saves with a Bearer session and shows Saved', () => {
    expect(contentSource).toMatch(/authorization: `Bearer \$\{state\.accessToken\}`/)
    expect(contentSource).toMatch(/Save Signal/)
    expect(contentSource).toMatch(/Saved ✓/)
    expect(contentSource).not.toMatch(/user:\s*state\.user/)
  })
})
