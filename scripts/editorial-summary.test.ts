import { describe, expect, it } from 'vitest'
import {
  editorialSummaryWordCount,
  hasValidEditorialSummaryLength,
} from './editorial-summary'

describe('editorial summary length', () => {
  it('accepts concise 15-20 word summaries', () => {
    const summary =
      'OpenAI adds persistent agent memory, raising expectations for assistants that preserve context across devices and recurring workflows.'
    expect(editorialSummaryWordCount(summary)).toBe(17)
    expect(hasValidEditorialSummaryLength(summary)).toBe(true)
  })

  it('rejects summaries outside the required range', () => {
    expect(hasValidEditorialSummaryLength('Too short to publish.')).toBe(false)
    expect(
      hasValidEditorialSummaryLength(
        'This deliberately oversized editorial summary contains far too many words and should never pass the strict publishing validation used by the scheduled review workflow today.',
      ),
    ).toBe(false)
  })
})
