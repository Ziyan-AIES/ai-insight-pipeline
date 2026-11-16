import { describe, expect, it } from 'vitest'
import { deduplicateEvidence, synthesizeReference } from './reference-synthesis.mjs'
import { normalizeCandidate } from '../netlify/functions/_radar.mjs'
import { resolveMailSource } from './mail-source.mjs'

const rows = n => Array.from({ length: n }, (_, i) => ({ id: String(i), source_id: 's', title: `Independent development ${i}`, summary: 'Factual collected material', canonical_url: `https://example.com/${i}`, story_key: `story-${i}` }))
function reasoner({ singleCard = false, omit = false, seen = [] } = {}) {
  return async (prompt, input) => {
    if (Array.isArray(input)) {
      seen.push(...input.map(i => i.id))
      return { items: input.slice(omit ? 1 : 0).map(r => ({ id: r.id, category: 'Agent systems', observation: 'A factual observation.' })) }
    }
    if (input.notes) return { summary: 'Several developments show a shared change, with limits.', evidenceIds: input.notes.flatMap(n => n.evidenceIds).slice(0, 8) }
    return { cards: [{ title: 'Shared change across deployments', body: 'A synthesis connecting separate developments and their limits.', evidenceIds: input.citations.slice(0, singleCard ? 1 : 2).map(i => i.id) }] }
  }
}
describe('period-wide reference synthesis', () => {
  it('reviews all articles beyond the old 250-item cap before reducing topics', async () => {
    const seen = []
    const result = await synthesizeReference(rows(281), [], reasoner({ seen }))
    expect(new Set(seen).size).toBe(281)
    expect(result.audit.reviewedCount).toBe(281)
    expect(result.audit.themes[0].consideredIds).toHaveLength(281)
    expect(result.cards[0].sources).toHaveLength(2)
  })
  it('bounds parallel extraction and preserves input order despite completion order', async () => {
    let active = 0, peak = 0
    const base = reasoner()
    const reason = async (prompt, input) => {
      if (!Array.isArray(input)) return base(prompt, input)
      active++; peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, input[0].id === '0' ? 20 : 1))
      const result = await base(prompt, input)
      active--
      return result
    }
    const result = await synthesizeReference(rows(161), [], reason)
    expect(peak).toBe(3)
    expect(result.audit.classifications.map(item => item.id)).toEqual(rows(161).map(item => item.id))
  })
  it('normalizes the explicit exclusion label echoed with its description', async () => {
    const result = await synthesizeReference(rows(1), [], async () => ({items:[{id:'0',category:'excluded for unrelated material, promotions or content too thin to support an observation',observation:'Unrelated corporate news.'}]}))
    expect(result.audit.excludedCount).toBe(1)
    expect(result.cards).toEqual([])
  })
  it('rejects a single-news recap and fails if a batch silently drops articles', async () => {
    await expect(synthesizeReference(rows(3), [], reasoner({ singleCard: true }))).rejects.toThrow('two distinct')
    await expect(synthesizeReference(rows(3), [], reasoner({ omit: true }))).rejects.toThrow('Every collected')
  })
  it('does not count duplicate coverage or URLs as independent developments', () => {
    const input = rows(3)
    input[1].story_key = input[0].story_key
    input[2].canonical_url = input[0].canonical_url
    expect(deduplicateEvidence(input)).toHaveLength(1)
  })
  it('reads both reports but rejects a card citing only repeated coverage of one event', async () => {
    const input = rows(2), seen = []
    input[1].story_key = input[0].story_key
    await expect(synthesizeReference(input, [], reasoner({ seen }))).rejects.toThrow('two distinct')
    expect(seen).toEqual(['0','1'])
  })
  it('retains collected investor articles without inventing dictionary matches', () => {
    const row = normalizeCandidate({ id: 'investor', source_type: 'investor' }, { title: 'Enterprise AI adoption survey', summary: 'Survey findings on organizational adoption.', url: 'https://example.com/survey', publishedAt: '2026-11-04T00:00:00Z' })
    expect(row.topic_slugs).toEqual([])
    expect(row.title).toBe('Enterprise AI adoption survey')
  })
  it('maps only the verified Lightspeed sender on a shared mail platform', () => {
    const sources = [{ id: 'lsvp', enabled: true, domain: 'newsletter.lsvp.com' }]
    expect(resolveMailSource('lsvp@mail.beehiiv.com', sources)?.id).toBe('lsvp')
    expect(resolveMailSource('other@mail.beehiiv.com', sources)).toBeUndefined()
    expect(resolveMailSource('lsvp@mail.beehiiv.com', [{ ...sources[0], enabled: false }])).toBeUndefined()
  })
})
