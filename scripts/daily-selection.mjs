import { supabase } from '../netlify/functions/_supabase.mjs'
import { allRows } from './reference-runtime.mjs'
import { config, dayWindow, beijingDay, cachedModel, writeJson } from './pipeline-common.mjs'
import { urlKey, matchingTitle, verifyArticle } from './article-verification.mjs'

export function agentCount(rows, window) {
  return rows.filter(row => (row.metadata?.contributor_name === 'Agent' || row.metadata?.imported_from === 'daily-agent-selection') &&
    (row.metadata?.agent_selection_day === window.day || (Date.parse(row.captured_at) >= Date.parse(window.start) && Date.parse(row.captured_at) < Date.parse(window.end)))).length
}
export function eligibleCandidates(radar, sources, existing, now = new Date()) {
  const window = dayWindow(now), active = new Set(sources.filter(s => s.enabled && !s.deleted_at).map(s => s.id))
  const urls = new Set(existing.flatMap(row => { try { return [urlKey(row.canonical_url)] } catch { return [] } }))
  return radar.filter(row => {
    try { return active.has(row.source_id) && Date.parse(row.published_at) >= Date.parse(window.start) && Date.parse(row.published_at) < Date.parse(window.end) && Date.parse(row.published_at) <= +now && row.summary?.length >= 40 && !urls.has(urlKey(row.canonical_url)) && !existing.some(saved => matchingTitle(row.title, saved.title) && matchingTitle(saved.title, row.title)) } catch { return false }
  })
}
export async function selectDaily({ radar, sources, reason, apply = true, now = new Date(), verify = verifyArticle, db = supabase, load = allRows }) {
  const window = dayWindow(now)
  const newsQuery = 'news_items?select=id,title,summary,canonical_url,captured_at,published_at,deleted_at,metadata&order=id.asc'
  const existing = await load(newsQuery)
  const remaining = Math.max(0, config.maxRecommendationsPerDay - agentCount(existing, window))
  const candidates = eligibleCandidates(radar, sources, existing, now)
  const report = { day: window.day, existingAgentCount: agentCount(existing, window), candidates: candidates.length, results: [] }
  if (remaining && candidates.length) {
    const categories = ['interaction','ai_software','ai_hardware','ecosystem','ai_capability','industry_events']
    const validate = output => {
      if (!Array.isArray(output.picks) || output.picks.length > remaining || new Set(output.picks.map(p => p.id)).size !== output.picks.length || output.picks.some(p => !candidates.some(r => r.id === p.id) || !categories.includes(p.category) || typeof p.reason !== 'string' || p.reason.length < 15)) throw Error('Invalid daily recommendations')
      return output
    }
    // One small ranking request for the day, not a model call per article.
    const output = await cachedModel('selection', `Select zero to ${remaining} genuinely relevant news items. ${config.recommendationPreference} Return {"picks":[{"id":"exact supplied ID","reason":"one factual relevance sentence","category":"interaction|ai_software|ai_hardware|ecosystem|ai_capability|industry_events"}]}. Compare against existingSelected, INCLUDING deleted items. Never recommend another publisher's report of the same development, or two picks about the same announcement. Use only supplied facts. Do not rewrite news, invent availability or fill a quota.`, { existingSelected: existing.filter(row => row.metadata?.agent_selection_day === window.day || Date.parse(row.captured_at) >= Date.parse(window.start) - 7 * 86400000).map(row => ({ title: row.title, summary: row.summary, deleted: Boolean(row.deleted_at) })), candidates: candidates.map(row => ({ id: row.id, title: row.title, summary: row.summary, publishedAt: row.published_at })) }, reason, validate)
    for (const pick of output.picks) {
      const item = candidates.find(row => row.id === pick.id)
      try {
        const proof = await verify(item.canonical_url, item.title)
        if (proof.datePrecision !== 'timestamp' || Date.parse(proof.publishedAt) < Date.parse(window.start) || Date.parse(proof.publishedAt) >= Date.parse(window.end)) throw Error('Original publisher timestamp is not verified as today in Beijing')
        const current = await load(newsQuery)
        if (agentCount(current, window) >= config.maxRecommendationsPerDay) break
        if (current.some(row => { try { return urlKey(row.canonical_url) === urlKey(proof.url) || urlKey(row.canonical_url) === urlKey(item.canonical_url) } catch { return false } })) { report.results.push({ id: item.id, status: 'already-exists-or-deleted' }); continue }
        if (!apply) { report.results.push({ id: item.id, title: item.title, status: 'validated-preview' }); continue }
        if (beijingDay() !== window.day) throw Error('Beijing date changed; rerun selection for the new day')
        const row = { canonical_url: proof.url, title: item.title, summary: item.summary, raw_text: item.summary, source: new URL(proof.url).hostname, category: pick.category, published_at: proof.publishedAt, captured_at: new Date().toISOString(), captured_by: null, captured_via: 'automation', source_type: 'captured_news', editorial_status: 'pending', metadata: { contributor_name: 'Agent', imported_from: 'daily-agent-selection', agent_selection_day: window.day, radar_source_id: item.source_id, radar_item_id: item.id, acquisition_method: item.raw_metadata?.acquisition_method || sources.find(s => s.id === item.source_id)?.connector_type, publication_date_basis: proof.dateEvidence, publication_date_precision: proof.datePrecision, selection_reason: pick.reason, news_facts: [item.summary] } }
        const inserted = await db('news_items?on_conflict=canonical_url', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(row) })
        if (!inserted.length) { report.results.push({ id: item.id, status: 'concurrent-duplicate' }); continue }
        const [saved] = await db(`news_items?id=eq.${inserted[0].id}&select=id,metadata`)
        if (saved?.metadata?.agent_selection_day !== window.day) throw Error('Recommendation readback failed')
        report.results.push({ id: saved.id, title: item.title, status: 'inserted' })
      } catch (error) { report.results.push({ id: item.id, status: 'pending', error: error.message }) }
    }
  }
  writeJson(`logs/pipeline/selection-${window.day}.json`, report)
  return report
}
