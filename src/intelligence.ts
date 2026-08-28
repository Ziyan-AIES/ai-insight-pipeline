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
