import type {
  RadarItem,
  RadarSource,
  RadarSourceType,
  RadarTopic,
} from './types'

export const radarSourceTypeLabels: Record<RadarSourceType, string> = {
  industry_news: 'Industry News',
  official: 'Official / Company',
  product_discovery: 'Product Discovery',
  investor: 'Investor / Thesis',
  community: 'Community / Discussion',
}

export const radarTopicLabels: Record<string, string> = {
  'ai-agents': 'AI agents and automation',
  'ai-coding': 'AI coding tools',
  'creative-ai': 'Generative media',
  'voice-ai': 'Voice and audio AI',
  'ai-search': 'AI search and browsers',
  'enterprise-ai': 'Enterprise AI adoption',
  'ai-hardware': 'AI hardware and robotics',
  'open-models': 'Open models',
  'model-capabilities': 'Model capabilities',
  'ai-reliability': 'Data, evals and reliability',
  'consumer-ai': 'Consumer AI products',
  'ai-deals': 'AI funding and M&A',
  'ai-policy': 'AI policy and safety',
  'ai-products': 'New AI products',
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

export const demoRadarSources: RadarSource[] = [
  {
    id: 'source-product-hunt',
    name: 'Product Hunt',
    domain: 'producthunt.com',
    homepageUrl: 'https://www.producthunt.com/',
    feedUrl: '',
    sourceType: 'product_discovery',
    connectorType: 'producthunt',
    enabled: true,
    priority: 80,
    displayOrder: 1,
    lastFetchedAt: hoursAgo(1),
    lastSuccessAt: hoursAgo(1),
    itemCount7d: 24,
  },
  {
    id: 'source-techcrunch',
    name: 'TechCrunch',
    domain: 'techcrunch.com',
    homepageUrl: 'https://techcrunch.com/',
    feedUrl: 'https://techcrunch.com/feed/',
    sourceType: 'industry_news',
    connectorType: 'rss',
    enabled: true,
    priority: 90,
    displayOrder: 2,
    lastFetchedAt: hoursAgo(2),
    lastSuccessAt: hoursAgo(2),
    itemCount7d: 18,
  },
  {
    id: 'source-venturebeat',
    name: 'VentureBeat',
    domain: 'venturebeat.com',
    homepageUrl: 'https://venturebeat.com/category/ai/',
    feedUrl: 'https://venturebeat.com/feed/',
    sourceType: 'industry_news',
    connectorType: 'rss',
    enabled: true,
    priority: 85,
    displayOrder: 3,
    lastFetchedAt: hoursAgo(2),
    lastSuccessAt: hoursAgo(2),
    itemCount7d: 15,
  },
  {
    id: 'source-hn',
    name: 'Hacker News',
    domain: 'news.ycombinator.com',
    homepageUrl: 'https://news.ycombinator.com/',
    feedUrl: '',
    sourceType: 'community',
    connectorType: 'hacker_news',
    enabled: true,
    priority: 55,
    displayOrder: 4,
    lastFetchedAt: hoursAgo(1),
    lastSuccessAt: hoursAgo(1),
    itemCount7d: 12,
  },
  {
    id: 'source-a16z',
    name: 'a16z',
    domain: 'a16z.com',
    homepageUrl: 'https://a16z.com/category/ai/',
    feedUrl: 'https://a16z.com/feed/',
    sourceType: 'investor',
    connectorType: 'rss',
    enabled: true,
    priority: 45,
    displayOrder: 5,
    lastFetchedAt: hoursAgo(5),
    lastSuccessAt: hoursAgo(5),
    itemCount7d: 4,
  },
]

const demoEvidence = (
  id: string,
  source: RadarSource,
  title: string,
  topicSlugs: string[],
  age: number,
  storyKey: string,
  engagement: RadarItem['engagement'] = {},
): RadarItem => ({
  id,
  sourceId: source.id,
  sourceName: source.name,
  sourceType: source.sourceType,
  externalId: id,
  url: `https://${source.domain}/radar/${id}`,
  title,
  summary: '',
  author: '',
  publishedAt: hoursAgo(age),
  storyKey,
  topicSlugs,
  engagement,
})

export const demoRadarItems: RadarItem[] = [
  demoEvidence('r1', demoRadarSources[0], 'New agent products coordinate work across browser tabs', ['ai-agents', 'ai-products'], 3, 'agent-products-1', { votes: 846, comments: 73 }),
  demoEvidence('r2', demoRadarSources[1], 'Browser companies race to turn tabs into agent workspaces', ['ai-agents', 'ai-search'], 8, 'browser-agents-1'),
  demoEvidence('r3', demoRadarSources[2], 'Enterprises move from AI copilots to supervised agents', ['ai-agents', 'enterprise-ai'], 17, 'enterprise-agents-1'),
  demoEvidence('r4', demoRadarSources[3], 'Ask HN: which coding agents survive real repositories?', ['ai-agents', 'ai-coding', 'ai-reliability'], 20, 'coding-agents-1', { score: 312, comments: 146 }),
  demoEvidence('r5', demoRadarSources[4], 'The next enterprise software layer is agent orchestration', ['ai-agents', 'enterprise-ai'], 31, 'agent-orchestration-1'),
  demoEvidence('r6', demoRadarSources[0], 'A visual coding assistant ships collaborative planning', ['ai-coding', 'ai-products'], 13, 'visual-coding-1', { votes: 529, comments: 38 }),
  demoEvidence('r7', demoRadarSources[1], 'Open models close the gap for on-device assistants', ['open-models', 'model-capabilities'], 25, 'open-models-device-1'),
  demoEvidence('r8', demoRadarSources[2], 'Evaluation platforms focus on agent reliability in production', ['ai-reliability', 'enterprise-ai'], 40, 'agent-evals-1'),
  demoEvidence('r9', demoRadarSources[0], 'Voice-first AI tools find a new consumer audience', ['voice-ai', 'consumer-ai', 'ai-products'], 52, 'voice-consumer-1', { votes: 397, comments: 24 }),
  demoEvidence('r10', demoRadarSources[1], 'AI wearables shift from assistants to ambient interfaces', ['ai-hardware', 'consumer-ai'], 70, 'ai-wearables-1'),
  demoEvidence('r11', demoRadarSources[3], 'Show HN: open source voice model runs locally', ['voice-ai', 'open-models'], 76, 'local-voice-1', { score: 188, comments: 61 }),
  demoEvidence('r12', demoRadarSources[4], 'Why inference economics will reshape AI applications', ['ai-hardware', 'enterprise-ai'], 110, 'inference-economics-1'),
  demoEvidence('r13', demoRadarSources[1], 'Regulators focus on disclosure for consumer AI agents', ['ai-policy', 'ai-agents'], 140, 'agent-policy-1'),
  demoEvidence('r14', demoRadarSources[2], 'AI infrastructure funding rebounds around inference', ['ai-deals', 'ai-hardware'], 155, 'infra-funding-1'),
  demoEvidence('r15', demoRadarSources[1], 'Coding copilots add repository-scale planning', ['ai-coding'], 190, 'coding-planning-old'),
  demoEvidence('r16', demoRadarSources[2], 'Companies test autonomous software engineering teams', ['ai-coding', 'ai-agents'], 250, 'coding-teams-old'),
]

function uniqueStoryCount(items: RadarItem[]) {
  return new Set(items.map((item) => item.storyKey || item.id)).size
}

function engagementWeight(item: RadarItem) {
  const value =
    (item.engagement.score || 0) +
    (item.engagement.votes || 0) +
    (item.engagement.comments || 0) * 2
  return Math.log10(Math.max(1, value)) * 4
}

function diverseEvidence(items: RadarItem[]) {
  const sorted = [...items].sort((a, b) => {
    const engagement = engagementWeight(b) - engagementWeight(a)
    if (Math.abs(engagement) > 0.2) return engagement
    return b.publishedAt.localeCompare(a.publishedAt)
  }).slice(0, 30)
  const domainFor = (item: RadarItem) => {
    try {
      return new URL(item.url).hostname.replace(/^www\./, '')
    } catch {
      return item.sourceName
    }
  }
  let best: RadarItem[] = []
  let bestWeight = -1
  function search(
    index: number,
    selected: RadarItem[],
    domains: Set<string>,
    stories: Set<string>,
  ) {
    if (selected.length > best.length || (selected.length === best.length && selected.reduce((sum, item) => sum + engagementWeight(item), 0) > bestWeight)) {
      best = [...selected]
      bestWeight = selected.reduce((sum, item) => sum + engagementWeight(item), 0)
    }
    if (selected.length === 5 || index >= sorted.length || selected.length + sorted.length - index < best.length) return
    const item = sorted[index]
    const domain = domainFor(item)
    if (!domains.has(domain) && !stories.has(item.storyKey)) {
      search(
        index + 1,
        [...selected, item],
        new Set([...domains, domain]),
        new Set([...stories, item.storyKey]),
      )
    }
    search(index + 1, selected, domains, stories)
  }
  search(0, [], new Set(), new Set())
  return best
}

export function buildRadarTopics(
  items: RadarItem[],
  windowDays: 7 | 30,
  now = new Date(),
): RadarTopic[] {
  const windowMs = windowDays * 24 * 60 * 60 * 1000
  const currentStart = now.getTime() - windowMs
  const previousStart = currentStart - windowMs
  const grouped = new Map<string, { current: RadarItem[]; previous: RadarItem[] }>()

  for (const item of items) {
    const timestamp = new Date(item.publishedAt).getTime()
    if (!Number.isFinite(timestamp) || timestamp < previousStart) continue
    for (const slug of item.topicSlugs) {
      const bucket = grouped.get(slug) || { current: [], previous: [] }
      if (timestamp >= currentStart) bucket.current.push(item)
      else bucket.previous.push(item)
      grouped.set(slug, bucket)
    }
  }

  return [...grouped.entries()]
    .filter(([, bucket]) => bucket.current.length > 0)
    .map(([slug, bucket]) => {
      const eventCount = uniqueStoryCount(bucket.current)
      const previousEvents = uniqueStoryCount(bucket.previous)
      const sourceCount = new Set(bucket.current.map((item) => item.sourceId)).size
      const momentumPercent = previousEvents
        ? Math.round(((eventCount - previousEvents) / previousEvents) * 100)
        : null
      const status: RadarTopic['status'] =
        previousEvents === 0 && eventCount >= 2
          ? 'emerging'
          : (momentumPercent || 0) >= 50
            ? 'rising'
            : (momentumPercent || 0) < -20
              ? 'cooling'
              : 'sustained'
      const sparkline = Array.from({ length: 7 }, () => 0)
      for (const item of bucket.current) {
        const elapsed = Math.max(0, now.getTime() - new Date(item.publishedAt).getTime())
        const index = Math.min(6, 6 - Math.floor(elapsed / (windowMs / 7)))
        sparkline[index] += 1
      }
      const engagement = bucket.current.reduce(
        (sum, item) => sum + engagementWeight(item),
        0,
      )
      const momentumLift = momentumPercent === null ? 18 : Math.max(-15, Math.min(45, momentumPercent / 5))
      return {
        slug,
        label: radarTopicLabels[slug] || slug.replaceAll('-', ' '),
        status,
        mentionCount: bucket.current.length,
        eventCount,
        sourceCount,
        momentumPercent,
        score: eventCount * 12 + sourceCount * 14 + momentumLift + engagement,
        sparkline,
        sourceTypes: [...new Set(bucket.current.map((item) => item.sourceType))],
        evidence: diverseEvidence(bucket.current),
      }
    })
    .sort((a, b) => b.score - a.score || b.eventCount - a.eventCount)
}

export function googleNewsUrl(topic: RadarTopic) {
  const query = topic.label.replace(/\band\b/gi, ' ').replace(/\s+/g, ' ').trim()
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
}

export function radarSourceHealth(source: RadarSource) {
  if (!source.enabled) return 'paused'
  if (source.lastError) return 'error'
  if (source.lastSuccessAt) return 'healthy'
  return 'pending'
}
