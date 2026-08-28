import { describe, expect, it } from 'vitest'
import {
  firstSentences,
  isInDashboardTimeRange,
  signalTime,
} from './intelligence'

describe('firstSentences', () => {
  it('keeps scannable intelligence blocks short', () => {
    expect(
      firstSentences('First point. Second point. Third point.', 2),
    ).toBe('First point. Second point.')
    expect(firstSentences('', 1)).toBe('')
  })
})

describe('dashboard time range', () => {
  const now = Date.parse('2026-08-28T12:00:00Z')

  it('uses rolling windows and calendar months', () => {
    expect(
      isInDashboardTimeRange('2020-01-01T00:00:00Z', 'all', { year: 2026, month: 7 }, now),
    ).toBe(true)
    expect(
      isInDashboardTimeRange('2026-08-22T00:00:00Z', 'week', { year: 2026, month: 7 }, now),
    ).toBe(true)
    expect(
      isInDashboardTimeRange('2026-08-01T00:00:00Z', 'week', { year: 2026, month: 7 }, now),
    ).toBe(false)
    expect(
      isInDashboardTimeRange('2026-08-01T00:00:00Z', 'month', { year: 2026, month: 7 }, now),
    ).toBe(true)
    expect(
      isInDashboardTimeRange('2026-07-31T23:00:00Z', 'month', { year: 2026, month: 7 }, now),
    ).toBe(false)
  })
})

describe('signalTime', () => {
  it('uses an explicit publication date before the original added date', () => {
    expect(
      signalTime({
        capturedAt: '2026-08-01T08:00:00Z',
        publishedAt: '2026-07-28T10:00:00Z',
      }),
    ).toBe('2026-07-28T10:00:00Z')
  })

  it('ignores editorial update timestamps such as category changes', () => {
    const editedItem = {
      capturedAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-29T01:00:00Z',
    }
    expect(signalTime(editedItem)).toBe('2026-08-01T08:00:00Z')
  })
})
