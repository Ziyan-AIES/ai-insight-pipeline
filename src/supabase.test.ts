import { describe, expect, it } from 'vitest'
import { canonicalizeUrl } from './supabase'

describe('dashboard URL canonicalization', () => {
  it('matches extension tracking-parameter behavior', () => {
    expect(
      canonicalizeUrl(
        'https://example.com/article?gclid=1&story=2&utm_campaign=test#comments',
      ),
    ).toBe('https://example.com/article?story=2')
  })

  it('rejects invalid links', () => {
    expect(() => canonicalizeUrl('not a URL')).toThrow()
    expect(() => canonicalizeUrl('file:///C:/secret.txt')).toThrow(/HTTP/)
  })
})
