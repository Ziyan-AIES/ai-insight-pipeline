import { describe, expect, it } from 'vitest'
import {
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
    expect(topicSlugsFor('Enterprise AI coding agents add repository evals')).toEqual(
      expect.arrayContaining(['ai-agents', 'ai-coding', 'enterprise-ai', 'ai-reliability']),
    )
    expect(topicSlugsFor('Ten tips for a better vegetable garden')).toEqual([])
  })

  it('gives paraphrased event titles a stable similarity signal', () => {
    expect(titleSimilarity('OpenAI launches a new browser agent', 'OpenAI unveils its browser AI agent')).toBeGreaterThan(0.5)
    expect(storySignature('OpenAI launches a new browser agent')).toHaveLength(24)
  })
})
