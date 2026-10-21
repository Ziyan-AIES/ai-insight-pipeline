import { describe, expect, it, vi } from 'vitest'
import {
  createPinnedLookup,
  isAgentManagedSource,
  parseFeed,
  storySignature,
  titleSimilarity,
  topicSlugsFor,
} from '../../netlify/functions/_radar.mjs'

describe('Industry Radar ingestion helpers', () => {
  it('leaves inbox and weekly website sources untouched by RSS refresh without hiding broken RSS sources', () => {
    expect(isAgentManagedSource({domain:'bvp.com',source_type:'investor',connector_type:'rss',feed_url:''})).toBe(true)
    expect(isAgentManagedSource({domain:'anthropic.com',source_type:'official',connector_type:'rss',feed_url:''})).toBe(true)
    expect(isAgentManagedSource({domain:'bvp.com',source_type:'investor',connector_type:'rss',feed_url:'https://www.bvp.com/feed/'})).toBe(false)
    expect(isAgentManagedSource({domain:'unknown.example',source_type:'investor',connector_type:'rss',feed_url:''})).toBe(false)
    expect(isAgentManagedSource({domain:'producthunt.com',source_type:'product_discovery',connector_type:'producthunt',feed_url:''})).toBe(false)
  })
  it('parses RSS and Atom entries into one normalized contract', () => {
    const rss = `<?xml version="1.0"?><rss><channel><item>
      <title><![CDATA[AI agents move into browsers]]></title>
      <link>https://example.com/agent?utm_source=feed</link>
      <guid>story-1</guid><pubDate>Wed, 02 Sep 2026 08:00:00 GMT</pubDate>
      <description><![CDATA[<p>A useful summary.</p>]]></description>
    </item></channel></rss>`
    expect(parseFeed(rss, 'https://example.com/feed/')).toEqual([
      expect.objectContaining({
        externalId: 'story-1',
        url: 'https://example.com/agent',
        title: 'AI agents move into browsers',
        summary: 'A useful summary.',
      }),
    ])
  })

  it('classifies transparent topic rules and ignores unrelated posts', () => {
    expect(topicSlugsFor('Autonomous coding agents add repository-scale agent evaluation')).toEqual(
      expect.arrayContaining(['autonomous-coding', 'agent-evaluation']),
    )
    expect(topicSlugsFor('Consumer AI products continue to grow')).toEqual([])
    expect(topicSlugsFor('AI Mode adds travel planning to Google Search')).toContain('ai-search-engines')
    expect(topicSlugsFor('Managed Agents help developers build production-ready agents')).toContain('agent-platforms')
    expect(topicSlugsFor('Ten tips for a better vegetable garden')).toEqual([])
  })

  it('gives paraphrased event titles a stable similarity signal', () => {
    expect(titleSimilarity('OpenAI launches a new browser agent', 'OpenAI unveils its browser AI agent')).toBeGreaterThan(0.5)
    expect(storySignature('OpenAI launches a new browser agent')).toHaveLength(24)
  })

  it('returns the DNS shape requested by Undici while keeping the validated address pinned', () => {
    const lookup = createPinnedLookup('203.0.113.10', 4)
    const single = vi.fn()
    const multiple = vi.fn()
    lookup('example.com', { all: false }, single)
    lookup('example.com', { all: true }, multiple)
    expect(single).toHaveBeenCalledWith(null, '203.0.113.10', 4)
    expect(multiple).toHaveBeenCalledWith(null, [{ address: '203.0.113.10', family: 4 }])
  })
})
