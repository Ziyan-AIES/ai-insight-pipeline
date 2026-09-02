import type { Trend } from './types'

export const trendStaleAfterDays = 60

export function trendLastActivityAt(trend: Trend) {
  return [
    trend.createdAt,
    trend.updatedAt,
    trend.lastDiscussedAt,
    trend.lastReviewedAt,
    ...trend.evidence.map((evidence) => evidence.linkedAt),
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || trend.createdAt
}

export function trendInactiveDays(trend: Trend, now = Date.now()) {
  const activity = new Date(trendLastActivityAt(trend)).getTime()
  if (!Number.isFinite(activity)) return 0
  return Math.max(0, Math.floor((now - activity) / 86_400_000))
}

export function isTrendStale(trend: Trend, now = Date.now()) {
  return Boolean(
    trend.status === 'active' &&
      trend.discussionStatus === 'discussed' &&
      trend.actionThreadIds.length === 0 &&
      trendInactiveDays(trend, now) >= trendStaleAfterDays,
  )
}

