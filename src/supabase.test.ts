import { describe, expect, it } from 'vitest'
import { canonicalizeUrl, captureContributorName } from './supabase'

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

describe('news contributor display', () => {
  const members = new Map([['original-user', 'Current user']])

  it('keeps an explicitly edited contributor after workspace reload', () => {
    expect(
      captureContributorName(
        { contributor_name: 'Another colleague' },
        'original-user',
        members,
      ),
    ).toBe('Another colleague')
  })

  it('falls back to the original team member when no contributor override exists', () => {
    expect(captureContributorName({}, 'original-user', members)).toBe(
      'Current user',
    )
  })
})
