import fs from 'node:fs'
import { supabase } from '../netlify/functions/_supabase.mjs'
import { parseFeed } from '../netlify/functions/_radar.mjs'
import { saveRadarCandidates } from './official-source-store.mjs'
const registry = JSON.parse(fs.readFileSync(new URL('../config/investor-sources.json', import.meta.url)))
const apply = process.argv.includes('--apply')
const refresh = process.argv.includes('--refresh')
const existing = await supabase('radar_sources?deleted_at=is.null&select=*')
if (apply) {
  fs.mkdirSync('logs', {recursive:true})
  fs.writeFileSync(`logs/investor-sources-before-${Date.now()}.json`, JSON.stringify(existing,null,2))
}
let order = Math.max(0, ...existing.map(row => row.display_order))
for (const entry of registry) {
  const matches = existing.filter(row => row.domain === entry.domain || (entry.legacyDomain && row.domain === entry.legacyDomain) || (entry.feedUrl && row.feed_url === entry.feedUrl))
  if (matches.length > 1) throw Error(`Ambiguous existing source: ${entry.key}`)
  let row = matches[0]
  const action = row ? 'update (preserve pause and collection history)' : 'add'
  const values = {name:entry.name,domain:entry.domain,homepage_url:entry.homepageUrl,feed_url:entry.feedUrl,source_type:entry.sourceType || 'investor',connector_type:'rss'}
  // Empty feed uses the same legacy storage convention as Website Agent. The
  // shared registry supplies email method/setup info to UI and ingest exclusion.
  // Never overwrite collection timestamps with subscription or setup checks.
  if (apply) {
    if (row) row = (await supabase(`radar_sources?id=eq.${row.id}`, {method:'PATCH',headers:{prefer:'return=representation'},body:JSON.stringify(values)}))[0]
    else row = (await supabase('radar_sources', {method:'POST',headers:{prefer:'return=representation'},body:JSON.stringify({...values,enabled:!entry.pending,priority:60,display_order:++order})}))[0]
  }
  console.log(`${entry.key}: ${action} · ${entry.method}${entry.pending ? ' · pending, paused' : ''}${apply ? ' · saved' : ''}`)
  if (apply && refresh && row.enabled && entry.feedUrl) {
    const checkedAt = new Date().toISOString()
    try {
      const response = await fetch(entry.feedUrl, {signal:AbortSignal.timeout(20000)})
      if (!response.ok) throw Error(`HTTP ${response.status}`)
      if (new URL(response.url).hostname !== new URL(entry.feedUrl).hostname) throw Error('Unexpected feed redirect')
      const xml = await response.text()
      if (Buffer.byteLength(xml) > 2*1024*1024) throw Error('Feed too large')
      const parsed = parseFeed(xml, response.url)
      if (!parsed.length) throw Error('No parseable feed entries')
      const now = Date.now()
      const saved = await saveRadarCandidates(row, parsed.filter(item => +new Date(item.publishedAt) >= now - 7*86400000 && +new Date(item.publishedAt) <= now), 'rss')
      await supabase(`radar_sources?id=eq.${row.id}`, {method:'PATCH',body:JSON.stringify({last_fetched_at:checkedAt,last_success_at:checkedAt,last_error:''})})
      console.log(`${entry.key}: RSS checked, ${saved} new relevant items`)
    } catch (error) {
      await supabase(`radar_sources?id=eq.${row.id}`, {method:'PATCH',body:JSON.stringify({last_fetched_at:checkedAt,last_error:error.message})})
      console.log(`${entry.key}: RSS check failed: ${error.message}`)
    }
  }
}
