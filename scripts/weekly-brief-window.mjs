// Monday publication covers the previous complete Monday-Sunday in Beijing.
export function weeklyBriefWindow(now, published = []) {
  const local = new Date(+now + 8 * 3600000)
  if (local.getUTCDay() !== 1) return null
  const end = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 8 * 3600000).toISOString()
  const start = new Date(Date.parse(end) - 7 * 86400000).toISOString()
  return published.some(meta => meta.period === 'weekly' && meta.start === start && meta.end === end) ? null : { start, end }
}
