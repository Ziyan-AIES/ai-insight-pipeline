import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { supabase, canonicalizeUrl } from '../netlify/functions/_supabase.mjs'
import { topicSlugsFor, storySignature } from '../netlify/functions/_radar.mjs'
import { resolveMailSource } from './mail-source.mjs'
import { withLock } from './pipeline-common.mjs'

await withLock('mail-ledger', async () => {
const input = process.argv[2]
if (!input) throw Error('Supply reviewed JSON; --apply writes validated results')
const reviews = JSON.parse(fs.readFileSync(input, 'utf8')).messages
if (!Array.isArray(reviews)) throw Error('messages array required')
const apply = process.argv.includes('--apply')
const dir = path.resolve('logs/agent-mail')
const ledgerPath = path.join(dir, 'processed.json')
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : {}
const sources = reviews.some(review => review.decision === 'import') ? await supabase('radar_sources?deleted_at=is.null&select=*') : []
let added = 0
for (const review of reviews) {
  if (!/^msg_[\w-]+$/.test(review.id)) throw Error('Invalid message ID')
  if (ledger[review.id]) continue
  const message = JSON.parse(fs.readFileSync(path.join(dir, `${review.id}.json`), 'utf8'))
  if (!['import','excluded','pending'].includes(review.decision) || typeof review.reason !== 'string' || review.reason.length < 10) throw Error('Every message needs an explicit decision and reason')
  if (review.decision === 'pending') continue
  const source = resolveMailSource(message.sender, sources)
  if (review.decision === 'import' && !source) throw Error('Sender has no enabled registered source; review registration first')
  const rows = []
  if (review.decision === 'import') {
    if (!Array.isArray(review.items) || !review.items.length) throw Error('Import requires articles')
    for (const item of review.items) {
      const url = canonicalizeUrl(item.url), parsed = new URL(url)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || /unsubscribe|preferences|\/ls\/click/i.test(url)) throw Error('Use a canonical publisher URL without tracking or account actions')
      if (item.urlVerified !== true || !item.urlEvidence || item.urlEvidence.length < 10) throw Error('Verify the canonical URL against the original publisher')
      if (!['full_newsletter','excerpt','analysis'].includes(item.evidenceType)) throw Error('Specify evidence type')
      if (typeof item.support !== 'string' || item.support.length < 40 || !message.text.includes(item.support)) throw Error('Support must quote the retrieved mail body')
      if (!item.dateEvidence || item.dateEvidence.length < 8 || !Number.isFinite(Date.parse(item.publishedAt)) || Date.parse(item.publishedAt) > Date.now()) throw Error('Original publication date and evidence required')
      if (!item.title || item.title.length > 500 || !item.summary || item.summary.length < 60 || item.summary.length > 2000) throw Error('Factual title and summary required')
      const topics = topicSlugsFor(item.title + ' ' + item.summary)
      const existing = await supabase(`radar_items?canonical_url=eq.${encodeURIComponent(url)}&select=id&limit=1`)
      if (existing.length) continue
      const alternate = new URL(url)
      alternate.pathname = alternate.pathname.endsWith('/') ? alternate.pathname.slice(0, -1) || '/' : alternate.pathname + '/'
      if (alternate.href !== url && (await supabase(`radar_items?canonical_url=eq.${encodeURIComponent(alternate.href)}&select=id&limit=1`)).length) continue
      rows.push({ source_id: source.id, external_id: url, canonical_url: url, title: item.title, summary: item.summary,
        published_at: item.publishedAt, story_key: storySignature(item.title), topic_slugs: topics,
        raw_metadata: { acquisition_method: 'email_newsletter', evidence_type: item.evidenceType, received_at: message.receivedAt,
          message_hash: crypto.createHash('sha256').update(review.id).digest('hex'), date_evidence: item.dateEvidence, url_evidence: item.urlEvidence } })
    }
  }
  if (apply) {
    if (rows.length) {
      await supabase('radar_items?on_conflict=source_id,external_id', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(rows) })
      for (const row of rows) {
        const result = await supabase(`radar_items?canonical_url=eq.${encodeURIComponent(row.canonical_url)}&select=id&limit=1`)
        if (!result.length) throw Error('Mail article readback failed')
      }
    }
    ledger[review.id] = { decision: review.decision, reason: review.reason, at: new Date().toISOString(), urls: (review.items || []).map(i => i.url) }
    fs.writeFileSync(ledgerPath + '.tmp', JSON.stringify(ledger, null, 2))
    // OneDrive/antivirus can briefly lock the destination on Windows. Keep the
    // old checkpoint intact and retry the atomic replacement, never delete it.
    for (let attempt = 0; ; attempt++) {
      try { fs.renameSync(ledgerPath + '.tmp', ledgerPath); break }
      catch (error) {
        if (attempt >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error
        await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)))
      }
    }
  }
  added += rows.length
}
console.log(JSON.stringify({ apply, reviewed: reviews.length, newArticles: added }))

})
