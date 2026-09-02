import { describe, expect, it } from 'vitest'
import { buildRadarTopics, googleNewsUrl } from './radar'
import type { RadarItem } from './types'

function item(
  id: string,
  title: string,
  sourceId: string,
  storyKey: string,
  hoursAgo: number,
): RadarItem {
  return {
    id,
    sourceId,
    sourceName: sourceId,
    sourceType: 'industry_news',
    externalId: id,
    url: `https://${sourceId}.example/${id}`,
    title,
    summary: '',
    author: '',
    publishedAt: new Date(Date.UTC(2026, 8, 2) - hoursAgo * 3_600_000).toISOString(),
    storyKey,
    topicSlugs: ['ai-agents'],
    engagement: {},
  }
}

describe('Industry Radar topic metrics', () => {
  it('counts syndicated articles as one event while preserving mention count', () => {
    const topics = buildRadarTopics(
      [
        item('1', 'Company launches an agent', 'source-a', 'same-event', 2),
        item('2', 'Company launches an agent', 'source-b', 'same-event', 3),
        item('3', 'Enterprises adopt supervised agents', 'source-c', 'other-event', 5),
      ],
      7,
      new Date(Date.UTC(2026, 8, 2)),
    )
    expect(topics[0]).toMatchObject({
      slug: 'ai-agents',
      mentionCount: 3,
      eventCount: 2,
      sourceCount: 3,
      status: 'emerging',
    })
  })

  it('selects one reading link per source and event', () => {
    const topics = buildRadarTopics(
      [
        item('1', 'Agent announcement', 'source-a', 'same-event', 2),
        item('2', 'Agent announcement follow-up', 'source-a', 'other-event', 3),
        item('3', 'Independent agent analysis', 'source-b', 'same-event', 4),
        item('4', 'Enterprise agent deployment', 'source-c', 'third-event', 5),
      ],
      7,
      new Date(Date.UTC(2026, 8, 2)),
    )
    expect(topics[0].evidence).toHaveLength(3)
    expect(new Set(topics[0].evidence.map((entry) => entry.sourceId)).size).toBe(3)
    expect(new Set(topics[0].evidence.map((entry) => entry.storyKey)).size).toBe(3)
    expect(googleNewsUrl(topics[0])).toContain('news.google.com/search')
  })
})
