import process from 'node:process'

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
const headers = {
  apikey: key,
  authorization: `Bearer ${key}`,
}

async function rows(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers })
  if (!response.ok) {
    throw new Error(`Pilot report query failed (${response.status})`)
  }
  return response.json()
}

function median(values) {
  if (!values.length) return null
  const sorted = values.slice().sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

const [news, captures, activity, runs] = await Promise.all([
  rows(
    `news_items?select=editorial_status,captured_at,editorial_updated_at,deleted_at&captured_at=gte.${encodeURIComponent(since)}`,
  ),
  rows(
    `capture_events?select=id,event_kind,canonical_url,occurred_at&occurred_at=gte.${encodeURIComponent(since)}`,
  ),
  rows(
    `activity_events?select=action,occurred_at&occurred_at=gte.${encodeURIComponent(since)}`,
  ),
  rows(
    `editorial_job_runs?select=status,claimed_count,processed_count,started_at,finished_at,error_message&started_at=gte.${encodeURIComponent(since)}`,
  ),
])

const turnaroundHours = news.flatMap((item) =>
  item.editorial_updated_at
    ? [
        Math.round(
          ((new Date(item.editorial_updated_at).getTime() -
            new Date(item.captured_at).getTime()) /
            3600000) *
            10,
        ) / 10,
      ]
    : [],
)
const statusCounts = Object.fromEntries(
  ['pending', 'processed', 'failed'].map((status) => [
    status,
    news.filter((item) => item.editorial_status === status).length,
  ]),
)
const uniqueCaptureUrls = new Set(
  captures.map((item) => item.canonical_url).filter(Boolean),
)
const actionCounts = activity.reduce((counts, item) => {
  counts[item.action] = (counts[item.action] || 0) + 1
  return counts
}, {})

console.log(
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      period_start: since,
      news: {
        total: news.length,
        ...statusCounts,
        removed: news.filter((item) => item.deleted_at).length,
        median_editorial_turnaround_hours: median(turnaroundHours),
      },
      capture: {
        events: captures.length,
        unique_urls: uniqueCaptureUrls.size,
        duplicate_events: captures.length - uniqueCaptureUrls.size,
      },
      activity: actionCounts,
      editorial_runs: {
        total: runs.length,
        completed: runs.filter((item) => item.status === 'completed').length,
        failed: runs.filter((item) => item.status === 'failed').length,
        running: runs.filter((item) => item.status === 'running').length,
        errors: runs
          .filter((item) => item.error_message)
          .map((item) => item.error_message),
      },
    },
    null,
    2,
  ),
)
