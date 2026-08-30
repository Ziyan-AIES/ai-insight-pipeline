import type { NewsCategory, ThreadStatus, TopicKind, TopicStatus } from './types'

export const categoryLabels: Record<NewsCategory, string> = {
  interaction: 'Entry & Interaction',
  ai_hardware: 'AI Devices',
  ai_software: 'AI Experiences',
  ai_capability: 'AI Capability & Tech',
  ecosystem: 'Ecosystem',
  industry_events: 'Industry & Market',
}

export const liveSignalCategories: NewsCategory[] = [
  'interaction',
  'ai_hardware',
  'ai_software',
  'ai_capability',
  'ecosystem',
  'industry_events',
]

export const briefingSections: Array<{
  id: string
  title: string
  category?: NewsCategory
}> = liveSignalCategories.map((category) => ({
  id: category,
  title: categoryLabels[category],
  category,
}))

export const topicKindLabels: Record<TopicKind, string> = {
  pov: 'POV',
  insight: 'Insight',
  strategy: 'Strategy',
  roadmap: 'Roadmap',
  poc: 'POC',
}

export const threadStatusLabels: Record<ThreadStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  parked: 'Parked',
  closed: 'Closed',
}

export function threadStatusFromLegacy(status: TopicStatus): ThreadStatus {
  if (status === 'completed') return 'closed'
  if (status === 'archived') return 'parked'
  if (status === 'researching' || status === 'published') return 'in_progress'
  return 'open'
}

export function legacyStatusFromThread(status: ThreadStatus): TopicStatus {
  if (status === 'closed') return 'completed'
  if (status === 'parked') return 'archived'
  if (status === 'in_progress') return 'researching'
  return 'idea'
}

export const emptyTopicAnalysis = {
  keyQuestion: '',
  observed: '',
  currentView: '',
  implications: '',
  watch: '',
}

export const topicOutputKinds = [
  { value: 'insight_brief', label: 'Insight brief' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'poc_recommendation', label: 'POC recommendation' },
  { value: 'roadmap_recommendation', label: 'Roadmap recommendation' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'external_link', label: 'External link' },
] as const
