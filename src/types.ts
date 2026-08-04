export type NewsCategory =
  | 'interaction'
  | 'ai_software'
  | 'ai_hardware'
  | 'ecosystem'
  | 'ai_capability'
  | 'industry_events'

export type TopicStatus =
  | 'idea'
  | 'researching'
  | 'scheduled'
  | 'published'
  | 'completed'
  | 'archived'

export interface NewsItem {
  id: string
  url: string
  title: string
  source: string
  summary: string
  category: NewsCategory
  capturedAt: string
  capturedBy: string
  imageUrl?: string
  editorialStatus: 'pending' | 'processed'
  topicLinks: Array<{
    topicId: string
    topicTitle: string
    monthLabel: string
  }>
}

export interface Topic {
  id: string
  title: string
  thesisId?: string
  parentTopicId?: string
  monthKey: string
  monthLabel: string
  category: NewsCategory
  status: TopicStatus
  notes: string
  displayOrder: number
  supportingNews: string[]
}

export interface Thesis {
  id: string
  title: string
  description: string
  horizon: string
  topicIds: string[]
}

export type FocusMode = 'split' | 'news' | 'topics'
