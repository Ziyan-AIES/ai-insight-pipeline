import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  canonicalizeUrl,
  parseJsonBody,
  requireCaptureToken,
  requireEditorialToken,
  requireExtensionToken,
} from '../../netlify/functions/_supabase.mjs'

const originalToken = process.env.EXTENSION_WRITE_TOKEN
const originalCaptureToken = process.env.CAPTURE_WRITE_TOKEN
const originalEditorialToken = process.env.EDITORIAL_WRITE_TOKEN

beforeEach(() => {
  delete process.env.CAPTURE_WRITE_TOKEN
  delete process.env.EDITORIAL_WRITE_TOKEN
  delete process.env.EXTENSION_WRITE_TOKEN
})

afterEach(() => {
  if (originalToken === undefined) delete process.env.EXTENSION_WRITE_TOKEN
  else process.env.EXTENSION_WRITE_TOKEN = originalToken
  if (originalCaptureToken === undefined) delete process.env.CAPTURE_WRITE_TOKEN
  else process.env.CAPTURE_WRITE_TOKEN = originalCaptureToken
  if (originalEditorialToken === undefined) delete process.env.EDITORIAL_WRITE_TOKEN
  else process.env.EDITORIAL_WRITE_TOKEN = originalEditorialToken
})

describe('extension API helpers', () => {
  it('fails closed when no token is configured', () => {
    delete process.env.EXTENSION_WRITE_TOKEN
    expect(requireExtensionToken({ headers: {} })?.statusCode).toBe(503)
  })

  it('rejects an invalid token and accepts both supported headers', () => {
    process.env.EXTENSION_WRITE_TOKEN = 'secret'
    expect(
      requireExtensionToken({ headers: { 'x-extension-token': 'wrong' } })
        ?.statusCode,
    ).toBe(401)
    expect(
      requireExtensionToken({ headers: { 'x-extension-token': 'secret' } }),
    ).toBeNull()
    expect(
      requireExtensionToken({ headers: { 'x-bsw-token': 'secret' } }),
    ).toBeNull()
  })

  it('canonicalizes tracking variants to one URL', () => {
    expect(
      canonicalizeUrl(
        'https://example.com/news?utm_source=mail&id=7&fbclid=x#section',
      ),
    ).toBe('https://example.com/news?id=7')
  })

  it('rejects non-web URL schemes', () => {
    expect(() => canonicalizeUrl('file:///etc/passwd')).toThrow(/HTTP/)
    expect(() => canonicalizeUrl('javascript:alert(1)')).toThrow(/HTTP/)
  })

  it('keeps capture and editorial credentials independently revocable', () => {
    process.env.CAPTURE_WRITE_TOKEN = 'capture-only'
    process.env.EDITORIAL_WRITE_TOKEN = 'editorial-only'
    expect(
      requireCaptureToken({
        headers: { 'x-capture-token': 'editorial-only' },
      })?.statusCode,
    ).toBe(401)
    expect(
      requireEditorialToken({
        headers: { 'x-editorial-token': 'capture-only' },
      })?.statusCode,
    ).toBe(401)
  })

  it('rejects malformed JSON without throwing', () => {
    expect(parseJsonBody({ body: '{' })).toMatchObject({
      value: null,
      statusCode: 400,
    })
  })
})
