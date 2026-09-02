import { describe, expect, it, vi } from 'vitest'
import {
  createPinnedLookup,
  parseFeed,
  storySignature,
  titleSimilarity,
  topicSlugsFor,
} from '../../netlify/functions/_radar.mjs'

describe('Industry Radar ingestion helpers', () => {
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
