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
  'browser-agents': 'Browser agents',
  'agent-orchestration': 'Multi-agent orchestration',
  'autonomous-coding': 'Autonomous software engineering',
  'agent-evaluation': 'Agent evaluation and reliability',
  'ai-workspaces': 'Collaborative AI workspaces',
  'ai-search-engines': 'AI search and answer engines',
  'browser-model-inference': 'In-browser model inference',
  'voice-agents': 'Real-time voice agents',
  'speech-models': 'Speech and audio models',
  'text-to-video': 'Text-to-video models',
  'image-generation': 'Image generation models',
  'humanoid-robotics': 'Humanoid robotics',
  'robot-learning': 'Robot foundation models',
  'ai-wearables': 'AI wearables and smart glasses',
  'inference-chips': 'AI inference chips',
  'on-device-ai': 'On-device AI',
  'open-weight-models': 'Open-weight models',
  'reasoning-models': 'Reasoning models',
  'multimodal-models': 'Multimodal models',
  'long-context-models': 'Long-context models',
  'model-evaluation': 'Model evaluation and benchmarks',
  'model-observability': 'Model observability and guardrails',
  'content-authenticity': 'AI content authenticity',
  'enterprise-customer-service': 'AI customer-service agents',
  'enterprise-sales-ai': 'AI sales copilots',
  'enterprise-workflow-automation': 'Enterprise AI workflow automation',
  'ai-companions': 'AI companions',
  'ai-shopping-assistants': 'AI shopping assistants',
  'ai-creator-tools': 'AI creator tools',
  'ai-funding-rounds': 'AI funding rounds',
  'ai-acquisitions': 'AI acquisitions',
  'ai-regulation': 'AI regulation',
  'ai-copyright': 'AI copyright disputes',
  'model-safety': 'Frontier-model safety',
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
  demoEvidence('r1', demoRadarSources[0], 'New browser agents coordinate work across tabs', ['browser-agents', 'ai-workspaces'], 3, 'agent-products-1', { votes: 846, comments: 73 }),
  demoEvidence('r2', demoRadarSources[1], 'Browser companies race to turn tabs into agent workspaces', ['browser-agents', 'ai-workspaces'], 8, 'browser-agents-1'),
  demoEvidence('r3', demoRadarSources[2], 'Enterprises move to multi-agent workflow orchestration', ['agent-orchestration', 'enterprise-workflow-automation'], 17, 'enterprise-agents-1'),
  demoEvidence('r4', demoRadarSources[3], 'Ask HN: which coding agents survive real repositories?', ['autonomous-coding', 'agent-evaluation'], 20, 'coding-agents-1', { score: 312, comments: 146 }),
  demoEvidence('r5', demoRadarSources[4], 'The next enterprise layer is multi-agent orchestration', ['agent-orchestration', 'enterprise-workflow-automation'], 31, 'agent-orchestration-1'),
  demoEvidence('r6', demoRadarSources[0], 'A coding agent ships collaborative workspace planning', ['autonomous-coding', 'ai-workspaces'], 13, 'visual-coding-1', { votes: 529, comments: 38 }),
  demoEvidence('r7', demoRadarSources[1], 'Open-weight models close the gap for on-device assistants', ['open-weight-models', 'on-device-ai'], 25, 'open-models-device-1'),
  demoEvidence('r8', demoRadarSources[2], 'Agent evaluation platforms focus on production reliability', ['agent-evaluation', 'model-evaluation'], 40, 'agent-evals-1'),
  demoEvidence('r9', demoRadarSources[0], 'Real-time voice agents find a companion audience', ['voice-agents', 'ai-companions'], 52, 'voice-consumer-1', { votes: 397, comments: 24 }),
  demoEvidence('r10', demoRadarSources[1], 'AI wearables shift toward on-device ambient interfaces', ['ai-wearables', 'on-device-ai'], 70, 'ai-wearables-1'),
  demoEvidence('r11', demoRadarSources[3], 'Show HN: open-weight speech model runs locally', ['speech-models', 'open-weight-models', 'on-device-ai'], 76, 'local-voice-1', { score: 188, comments: 61 }),
  demoEvidence('r12', demoRadarSources[4], 'AI inference chips reshape application economics', ['inference-chips'], 110, 'inference-economics-1'),
  demoEvidence('r13', demoRadarSources[1], 'Regulators focus on disclosure for browser agents', ['ai-regulation', 'browser-agents'], 140, 'agent-policy-1'),
  demoEvidence('r14', demoRadarSources[2], 'AI infrastructure funding rebounds around inference chips', ['ai-funding-rounds', 'inference-chips'], 155, 'infra-funding-1'),
  demoEvidence('r15', demoRadarSources[1], 'Coding agents add repository-scale planning', ['autonomous-coding'], 190, 'coding-planning-old'),
  demoEvidence('r16', demoRadarSources[2], 'Companies test autonomous software engineering teams', ['autonomous-coding', 'agent-orchestration'], 250, 'coding-teams-old'),
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
      if (!radarTopicLabels[slug]) continue
      const bucket = grouped.get(slug) || { current: [], previous: [] }
      if (timestamp >= currentStart) bucket.current.push(item)
      else bucket.previous.push(item)
      grouped.set(slug, bucket)
    }
  }

  return [...grouped.entries()]
    .filter(([, bucket]) => uniqueStoryCount(bucket.current) >= 2)
    .map(([slug, bucket]) => {
      const developmentCount = uniqueStoryCount(bucket.current)
      const previousDevelopments = uniqueStoryCount(bucket.previous)
      const sourceCount = new Set(bucket.current.map((item) => item.sourceId)).size
      const momentumPercent = previousDevelopments
        ? Math.round(((developmentCount - previousDevelopments) / previousDevelopments) * 100)
        : null
      const status: RadarTopic['status'] =
        previousDevelopments === 0
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
        label: radarTopicLabels[slug],
        status,
        mentionCount: bucket.current.length,
        developmentCount,
        sourceCount,
        momentumPercent,
        score: developmentCount * 12 + sourceCount * 14 + momentumLift + engagement,
        sparkline,
        sourceTypes: [...new Set(bucket.current.map((item) => item.sourceType))],
        evidence: diverseEvidence(bucket.current),
      }
    })
    .sort((a, b) => b.score - a.score || b.developmentCount - a.developmentCount)
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
