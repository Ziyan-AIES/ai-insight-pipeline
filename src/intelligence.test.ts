import { describe, expect, it } from 'vitest'
import { firstSentences, isInDashboardTimeRange } from './intelligence'

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
