import { weeklyBriefWindow } from './weekly-brief-window.mjs'
import { supabase } from '../netlify/functions/_supabase.mjs'
import fs from 'node:fs'
import { createCachedReason } from './reference-cache.mjs'
import { allRows, briefWindow, reasonJson } from './reference-runtime.mjs'
import { synthesizeReference } from './reference-synthesis.mjs'

// Retain completed, private intermediate work so a transient model/network
// failure does not force the entire period to be reprocessed on retry.
const cachedReason = createCachedReason(reasonJson)

const replay = process.argv.includes('--replay-inputs')
const savedInputs = replay ? Object.fromEntries(['daily', 'weekly'].map(period => [period, JSON.parse(fs.readFileSync(`logs/reference-briefs/input-${period}.json`, 'utf8'))])) : null
if (replay && (Date.parse(savedInputs.weekly.end) - Date.parse(savedInputs.weekly.start) !== 7 * 86400000 || Date.parse(savedInputs.daily.end) > Date.now())) throw Error('Invalid replay input windows')
const previous = replay ? [] : await supabase('editorial_readouts?generated_by=eq.signal-reference-v1&order=generated_at.desc&limit=10')
const prior = previous.map(row => JSON.parse(row.lede)).filter(meta => meta.period === 'daily').sort((a, b) => Date.parse(b.end) - Date.parse(a.end))[0] || null
const rebuild = process.argv.includes('--rebuild-latest')
const window = process.argv.includes('--weekly-only') ? null : replay ? { start: savedInputs.daily.start, end: savedInputs.daily.end } : rebuild && prior ? { start: prior.start, end: prior.end } : briefWindow(new Date(), prior?.end)
const weekly = replay ? {start:savedInputs.weekly.start,end:savedInputs.weekly.end} : weeklyBriefWindow(new Date(), previous.map(row=>JSON.parse(row.lede)))
if (!window && !weekly) { console.log('No new briefing window.'); process.exit(0) }
const sources = replay ? savedInputs.daily.sources : await supabase('radar_sources?deleted_at=is.null&enabled=eq.true&select=id,name,last_success_at,last_error,feed_url,source_type')
const sourceIds = new Set(sources.map(s => s.id))
const coverage = sources.filter(s => s.last_error || !s.last_success_at || +new Date(s.last_success_at) < +new Date(window?.end || weekly.end) - (s.source_type === 'official' && !s.feed_url ? 8 : 1) * 86400000).map(s => s.name)
const snapshots = []
for (const period of ['daily', 'weekly']) {
  const periodWindow = period === 'daily' ? window : weekly
  if (!periodWindow) continue
  const {start,end} = periodWindow
  // Discovery time includes late-arriving evidence without rewriting its publication date.
  const discovery = `and(discovered_at.gte.${start},discovered_at.lt.${end})`
  const publication = `and(published_at.gte.${start},published_at.lt.${end})`
  const filter = period === 'daily' ? `or=(${discovery},${publication})${rebuild ? '' : `&discovered_at=lt.${end}`}` : `published_at=gte.${start}&published_at=lt.${end}${rebuild ? '' : `&discovered_at=lt.${end}`}`
  const rows = (replay ? savedInputs[period].rows : await allRows(`radar_items?${filter}&select=id,source_id,title,summary,canonical_url,published_at,discovered_at,story_key,raw_metadata&order=published_at.desc,id.asc`)).filter(r => sourceIds.has(r.source_id))
  console.log(`Synthesizing ${period}: ${rows.length} collected articles; every batch will be reviewed.`)
  fs.mkdirSync('logs/reference-briefs', { recursive: true })
  fs.writeFileSync(`logs/reference-briefs/input-${period}.json`, JSON.stringify({ start, end: end, sources, rows }))
  const { cards, audit } = await synthesizeReference(rows, sources, cachedReason)
  fs.mkdirSync('logs/reference-briefs', { recursive: true })
  fs.writeFileSync(`logs/reference-briefs/${period}-${end.slice(0, 10)}.json`, JSON.stringify({ start, end: end, generatedAt: new Date().toISOString(), audit, cards }, null, 2))
  snapshots.push({ period_type: 'week', period_key: `radar-${period}:${end.slice(0, 10)}`, generated_by: 'signal-reference-v1', generated_at: new Date().toISOString(),
    lede: JSON.stringify({ version: 2, period, start, end: end, coverageWarnings: coverage, sampled: false, itemCount: rows.length,
      reviewedCount: audit.reviewedCount, distinctCount: audit.distinctCount, excludedCount: audit.excludedCount, themeCount: audit.themes.length }), bullets: cards })
}
// Publish completed periods together; failed synthesis never advances the cutoff.
await supabase('editorial_readouts?on_conflict=period_type,period_key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(snapshots) })
for (const row of snapshots) {
  const saved = await supabase(`editorial_readouts?period_key=eq.${encodeURIComponent(row.period_key)}&select=id`)
  if (saved.length !== 1) throw Error('Briefing readback failed')
}
console.log('Published ' + snapshots.map(row=>JSON.parse(row.lede).period).join(', ') + ' with validated source references.')
