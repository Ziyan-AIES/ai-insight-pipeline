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

export type ThreadStatus = 'open' | 'in_progress' | 'parked' | 'closed'

export type DiscussionStatus = 'not_discussed' | 'discussed' | 'dismissed'

export type TopicKind = 'pov' | 'insight' | 'strategy' | 'roadmap' | 'poc'

export type NoteSourceType = 'captured_news' | 'manual_note'

export type WorkspacePage = 'signals' | 'synthesis' | 'threads'

export interface TopicAnalysis {
  keyQuestion: string
  observed: string
  currentView: string
  implications: string
  watch: string
}

export interface TopicOutput {
  id: string
  kind: string
  title: string
  dateLabel: string
  link: string
  description: string
}

export interface NewsItem {
  id: string
  url: string
  title: string
  source: string
  summary: string
  takeaway: string
  industryImportance: string
  qiraRelevance: string
  teamSynthesis: string
  discussionPriorityScore: number
  category: NewsCategory
  sourceType: NoteSourceType
  capturedAt: string
  publishedAt?: string
  capturedBy: string
  lastEditedBy?: string
  archivedAt?: string
  metadata?: Record<string, unknown>
  imageUrl?: string
  editorialStatus: 'pending' | 'processed' | 'failed'
  lastReviewedAt?: string
  ideaCount: number
  discussionStatus: DiscussionStatus
  discussedAt?: string
  discussedBy?: string
  meetingNominatedAt?: string
  meetingNominatedBy?: string
  voteCount: number
  votedByMe?: boolean
  discussionOrder?: number
  updatedAt?: string
  version?: number
  deletedAt?: string
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
  /** YYYY-MM when scheduled; empty string means Topic Pool (unscheduled). */
  monthKey: string
  monthLabel: string
  category: NewsCategory
  status: TopicStatus
  threadStatus: ThreadStatus
  kind: TopicKind
  notes: string
  analysis: TopicAnalysis
  outputs: TopicOutput[]
  ownerId?: string
  ownerName?: string
  decisionSummary: string
  nextStep: string
  outcomeUrl: string
  createdAt?: string
  displayOrder: number
  updatedAt?: string
  version?: number
  deletedAt?: string
  supportingNews: string[]
}

export interface Thesis {
  id: string
  title: string
  description: string
  horizon: string
  updatedAt?: string
  version?: number
  deletedAt?: string
  topicIds: string[]
}

export interface EditorialReadout {
  periodType: 'week' | 'month' | 'quarter'
  periodKey: string
  lede: string
  bullets: string[]
  generatedAt: string
}

export interface ActivityEvent {
  id: number
  action: string
  occurredAt: string
  actorName: string
}

export interface EditorialHealth {
  status: 'running' | 'completed' | 'failed' | 'abandoned'
  startedAt: string
  finishedAt?: string
  processedCount: number
  errorMessage?: string
}

export interface TeamMemberSummary {
  userId: string
  email: string
  displayName: string
  role: 'admin' | 'editor' | 'member'
}

export type FocusMode = 'split' | 'news' | 'topics'
