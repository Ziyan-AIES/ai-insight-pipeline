import type { NewsItem } from './types'

export function discussionPriorityScore(item: NewsItem) {
  if (item.discussionPriorityScore) return item.discussionPriorityScore
  const votes = item.voteCount || 0
  const updated = Date.parse(item.updatedAt || item.publishedAt || item.capturedAt)
  const ageDays = Number.isFinite(updated)
    ? Math.max(0, (Date.now() - updated) / 86400000)
    : 14
  const importance = item.industryImportance?.trim() ? 3 : 0
  const qira = item.qiraRelevance?.trim() ? 3 : 0
  const processed = item.editorialStatus === 'processed' ? 1 : 0
  return votes * 8 + importance + qira + processed + Math.max(0, 10 - ageDays)
}

export function anonymousTeamSynthesis(item: NewsItem) {
  if (item.teamSynthesis.trim()) return item.teamSynthesis.trim()
  return ''
}

export function firstSentences(text: string | undefined, max = 2) {
  const value = (text || '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  const parts = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [value]
  return parts
    .slice(0, max)
    .map((part) => part.trim())
    .join(' ')
    .trim()
}

export function signalTime(item: {
  updatedAt?: string
  publishedAt?: string
  capturedAt: string
}) {
  return item.updatedAt || item.publishedAt || item.capturedAt
}

export type DashboardTimeMode = 'week' | 'fortnight' | 'month'

export function isInDashboardTimeRange(
  iso: string,
  mode: DashboardTimeMode,
  month: { year: number; month: number },
  now = Date.now(),
) {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return true
  if (mode === 'week') return then >= now - 7 * 86400000
  if (mode === 'fortnight') return then >= now - 14 * 86400000
  const start = Date.UTC(month.year, month.month, 1)
  const end = Date.UTC(month.year, month.month + 1, 1) - 1
  return then >= start && then <= end
}

export function formatMonthFilterLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month, 1)))
}

export function formatRelativeAge(value: string) {
  const then = Date.parse(value)
  if (!Number.isFinite(then)) return ''
  const hours = Math.max(1, Math.round((Date.now() - then) / 3600000))
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 14) return `${days}d ago`
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(then))
}
