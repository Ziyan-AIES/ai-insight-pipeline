import fs from 'node:fs'
import { supabase } from '../netlify/functions/_supabase.mjs'
import { parseFeed, topicSlugsFor } from '../netlify/functions/_radar.mjs'
import { saveRadarCandidates } from './official-source-store.mjs'
import investors from '../config/investor-sources.json' with { type: 'json' }
import officials from '../config/official-sources.json' with { type: 'json' }
const apply = process.argv.includes('--apply')
const registered = new Set([...investors, ...officials].map(s => s.feedUrl).filter(Boolean))
const sources = (await supabase('radar_sources?enabled=eq.true&deleted_at=is.null&select=*')).filter(s => registered.has(s.feed_url))
const results = []
for (let offset = 0; offset < sources.length; offset += 3) {
  await Promise.all(sources.slice(offset, offset + 3).map(async source => {
    try {
      const response = await fetch(source.feed_url, { signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw Error(`HTTP ${response.status}`)
      const xml = await response.text()
      if (xml.length > 6 * 1024 * 1024) throw Error('Feed exceeds local backfill limit')
      const items = parseFeed(xml, response.url)
      if (!items.length) throw Error('No parseable feed entries')
      const recent = items.filter(item => +new Date(item.publishedAt) >= Date.now() - 30 * 86400000 && +new Date(item.publishedAt) <= Date.now())
      const latest = items.map(item => item.publishedAt).sort().at(-1)
      const warning = +new Date(latest) < Date.now() - 30 * 86400000 ? `Feed retrieved but latest article is ${latest.slice(0, 10)}; recent website coverage is unverified` : ''
      const added = apply ? await saveRadarCandidates(source, recent, 'rss') : null
      if (apply) await supabase(`radar_sources?id=eq.${source.id}`, { method: 'PATCH', body: JSON.stringify({ last_fetched_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: warning }) })
      results.push({ name: source.name, type: source.source_type, feedEntries: items.length, in30d: recent.length, matched: recent.filter(item => topicSlugsFor(item.title + ' ' + item.summary).length).length, added, latest, warning })
    } catch (error) {
      results.push({ name: source.name, type: source.source_type, error: error.message })
      if (apply) await supabase(`radar_sources?id=eq.${source.id}`, { method: 'PATCH', body: JSON.stringify({ last_fetched_at: new Date().toISOString(), last_error: error.message }) }).catch(() => {})
    }
  }))
}
fs.mkdirSync('logs', { recursive: true })
fs.writeFileSync('logs/reference-feed-backfill.json', JSON.stringify({ checkedAt: new Date().toISOString(), apply, results }, null, 2))
console.log(JSON.stringify(results))
