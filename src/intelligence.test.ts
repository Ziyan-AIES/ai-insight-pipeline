import { describe, expect, it } from 'vitest'
import { firstSentences } from './intelligence'

describe('firstSentences', () => {
  it('keeps scannable intelligence blocks short', () => {
    expect(
      firstSentences('First point. Second point. Third point.', 2),
    ).toBe('First point. Second point.')
    expect(firstSentences('', 1)).toBe('')
  })
})
