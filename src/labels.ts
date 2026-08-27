import type { NewsCategory, TopicKind } from './types'

export const categoryLabels: Record<NewsCategory, string> = {
  interaction: 'Entry & Interaction',
  ai_hardware: 'AI Devices',
  ai_software: 'AI Experiences',
  ai_capability: 'AI Capability & Technology',
  ecosystem: 'Ecosystem',
  industry_events: 'Industry & Market',
}

export const briefingSections: Array<{
  id: string
  title: string
  category?: NewsCategory
}> = [
  { id: 'highlights', title: "Today's / This Week's Highlights" },
  { id: 'interaction', title: 'Entry & Interaction', category: 'interaction' },
  { id: 'ai_hardware', title: 'AI Devices', category: 'ai_hardware' },
  { id: 'ai_software', title: 'AI Experiences', category: 'ai_software' },
  { id: 'ai_capability', title: 'AI Capability & Technology', category: 'ai_capability' },
  { id: 'ecosystem', title: 'Ecosystem', category: 'ecosystem' },
  { id: 'industry_events', title: 'Industry & Market', category: 'industry_events' },
]

export const topicKindLabels: Record<TopicKind, string> = {
  insight: 'Insight',
  poc: 'POC',
  roadmap: 'Roadmap',
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
