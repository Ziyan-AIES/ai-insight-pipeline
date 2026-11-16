import { canonicalizeUrl } from '../netlify/functions/_supabase.mjs'
import { validateCards } from './reference-runtime.mjs'

export const categories = ['Agent systems', 'Models and media', 'Infrastructure and devices', 'Robotics and physical AI', 'Products and workflows', 'Trust and governance', 'Capital and market structure']
const batchSize = 40
const chunks = (rows, size = batchSize) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))
const unique = values => [...new Set(values)]

export function deduplicateEvidence(rows) {
  const seen = new Set()
  return rows.filter(row => {
    const url = canonicalizeUrl(row.canonical_url)
    const key = row.story_key || row.id
    if (seen.has(key) || seen.has(url)) return false
    seen.add(key)
    seen.add(url)
    return true
  })
}

function validateAssignments(result, batch) {
  if (!Array.isArray(result.items) || result.items.length !== batch.length) throw Error('Every collected article must be classified')
  const ids = new Set(batch.map(r => r.id)), seen = new Set()
  for (const item of result.items) {
    if (!ids.has(item.id) || seen.has(item.id)) throw Error('Invalid or duplicate classified article')
    seen.add(item.id)
    // Some providers echo the exclusion label with its explanatory suffix.
    if (item.category === 'excluded for unrelated material, promotions or content too thin to support an observation') item.category = 'excluded'
    if (![...categories, 'excluded'].includes(item.category) || typeof item.observation !== 'string' || !item.observation.trim() || item.observation.length > 900) throw Error('Article needs a category and factual observation or exclusion reason')
  }
  return result.items
}

// The bounded reduction visits every note. It never truncates a period to its
// newest N articles; the audit preserves the complete classified input list.
async function reduceCategory(category, notes, reason) {
  if (notes.length === 1) return { category, ...notes[0] }
  let level = notes
  do {
    const next = []
    for (const batch of chunks(level)) {
      const allowedIds = new Set(batch.flatMap(n => n.evidenceIds))
      const result = await reason('Summarize the supplied observations within this topic in English. Identify recurring changes, contrasts, adoption constraints and counterexamples across companies; do not write a list of article recaps. Include a distinct observation only as qualified supporting evidence. Do not infer consensus from repeated coverage or investor opinion. Return {"summary":"up to 1800 characters","evidenceIds":["up to 8 representative supplied ids"]}. Preserve uncertainty and original dates. This is an intermediate synthesis, not a team decision.', { category, notes: batch })
      if (typeof result.summary !== 'string' || !result.summary.trim() || result.summary.length > 2400 || !Array.isArray(result.evidenceIds) || !result.evidenceIds.length || result.evidenceIds.length > 8 || result.evidenceIds.some(id => !allowedIds.has(id))) throw Error('Invalid topic synthesis')
      next.push({ observation: result.summary, evidenceIds: unique(result.evidenceIds), consideredIds: unique(batch.flatMap(n => n.consideredIds)) })
    }
    level = next
  } while (level.length > 1)
  return { category, ...level[0] }
}

export async function synthesizeReference(rows, sources, reason) {
  // Review every source's account, including alternate coverage of one event.
  // Deduplication limits claims of breadth, not access to the source material.
  const evidence = rows
  const bySource = new Map(sources.map(s => [s.id, s]))
  const batches = chunks(evidence), results = new Array(batches.length)
  let nextBatch = 0
  // Bounded independent extraction; preserve input order for deterministic reductions/cache.
  async function classifyWorker() {
    while (nextBatch < batches.length) {
      const index = nextBatch++, batch = batches[index]
    const result = await reason(`Read EVERY supplied article, including articles without dictionary tags. Include only explicit AI developments or infrastructure with a stated AI connection; exclude ordinary cloud migrations, unrelated finance and generic corporate news without that connection. Classify its main observation into exactly one category: ${categories.join('; ')}; or excluded for unrelated material, promotions or content too thin to support an observation. Return {"items":[{"id":"exact supplied id","category":"one allowed category","observation":"concise factual extraction, or specific exclusion reason; at most 900 characters"}]}. Exactly one item per input. Preserve original dates, announcement versus availability, and investor thesis versus demonstrated adoption. Feed excerpts may be partial: never imply the full article was read. Ignore sponsors, navigation and recommendations. Do not rank articles or pick winners.`, batch.map(r => ({ id: r.id, title: r.title, summary: r.raw_metadata?.feed_text || r.summary, publishedAt: r.published_at, storyKey: r.story_key, source: bySource.get(r.source_id)?.name, sourceType: bySource.get(r.source_id)?.source_type })))
      results[index] = validateAssignments(result, batch)
    }
  }
  const completed = await Promise.allSettled(Array.from({ length: Math.min(3, batches.length) }, classifyWorker))
  const failed = completed.find(result => result.status === 'rejected')
  if (failed) throw failed.reason
  const assignments = results.flat()
  const activeCategories = categories.filter(category => assignments.some(a => a.category === category))
  const themes = new Array(activeCategories.length)
  let nextCategory = 0
  async function themeWorker() {
    while (nextCategory < activeCategories.length) {
      const index = nextCategory++, category = activeCategories[index]
      const items = assignments.filter(a => a.category === category)
      themes[index] = await reduceCategory(category, items.map(a => ({ observation: a.observation, evidenceIds: [a.id], consideredIds: [a.id], storyKey: rows.find(r => r.id === a.id)?.story_key })), reason)
    }
  }
  const reductions = await Promise.allSettled(Array.from({ length: Math.min(3, activeCategories.length) }, themeWorker))
  const failedReduction = reductions.find(result => result.status === 'rejected')
  if (failedReduction) throw failedReduction.reason
  const candidateIds = new Set(themes.flatMap(t => t.evidenceIds))
  const candidates = evidence.filter(r => candidateIds.has(r.id))
  const citations = candidates.map(r => ({ id: r.id, title: r.title, summary: r.summary, publishedAt: r.published_at, source: bySource.get(r.source_id)?.name }))
  let payload = themes.length ? await reason('Create the period-wide AI Takeaways from ALL topic syntheses. This is a thematic synthesis across the collected news, NOT three selected news summaries. Return {"cards":[{"title":"a topic-level change, not a company headline","body":"one concise introductory paragraph connecting at least TWO distinct developments, maximum 400 characters","bullets":["2-3 concise supporting observations or limitations, maximum 200 characters each"],"evidenceIds":["2-5 supplied representative ids from DISTINCT developments"]}]}. Produce at most three materially different themes. Prefer evidence across companies and independent publishers where available; qualify a single-publisher or investor-only view. Never inflate a lone Apple release (or any one article) into a takeaway; return fewer cards or none if the evidence cannot support synthesis. Do not force commonalities or claim an exhaustive market consensus. Do not use generic cloud migrations or ordinary corporate news as evidence of AI adoption or AI cost savings. Use plain English rather than abstract jargon. Lead with what the developments collectively suggest, support it with at most two named examples, and state the main limitation. Avoid catalogues of company news and dense lists of names. A single company anecdote must not become a market-wide claim. Citations must directly support the specific synthesis.', { themes, citations }) : { cards: [] }
  let cards
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      cards = validateCards(payload, candidates)
      for (const card of cards) {
        if (deduplicateEvidence(card.sources.map(s => evidence.find(r => r.id === s.id))).length < 2) throw Error('A takeaway must synthesize at least two distinct developments, not recap one article')
      }
      break
    } catch (error) {
      if (attempt) throw error
      payload = await reason('Correct the candidate briefing using only the supplied evidence. Validation failure: ' + error.message + '. Return {"cards":[{"title":"topic-level synthesis, at most 120 characters","body":"one concise cross-article introduction, maximum 400 characters","bullets":["2-3 concise evidence-based observations or limitations"],"evidenceIds":["2 to 5 valid ids for distinct developments"]}]}. At most three cards. Remove unsupported themes instead of inventing support. Preserve uncertainty; do not return single-news recaps.', { themes, citations, candidate: payload })
    }
  }
  return { cards, audit: { collectedCount: rows.length, distinctCount: deduplicateEvidence(evidence).length, reviewedCount: assignments.length, excludedCount: assignments.filter(a => a.category === 'excluded').length, classifications: assignments, themes } }
}
