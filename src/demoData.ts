import { emptyTopicAnalysis } from './labels'
import type { NewsItem, Thesis, Topic } from './types'

export const demoNews: NewsItem[] = [
  {
    id: 'news-dataflow',
    url: 'https://example.com/dataflow-harness',
    title: 'DataFlow-Harness turns agent reliability into an engineering discipline',
    source: 'Research signal',
    summary:
      'A structured harness combines evaluations, traces, and recovery paths so teams can improve agents without treating every failure as a one-off.',
    takeaway:
      'Reliability work is moving from model quality to repeatable agent engineering.',
    category: 'ai_capability',
    sourceType: 'captured_news',
    capturedAt: '2026-07-29T10:00:00Z',
    capturedBy: 'Ziyan',
    editorialStatus: 'processed',
    voteCount: 2,
    topicLinks: [
      {
        topicId: 'topic-harness',
        topicTitle: 'Harness engineering',
        monthLabel: 'November 2026',
      },
    ],
  },
  {
    id: 'news-granola',
    url: 'https://example.com/granola-watch',
    title: 'Granola brings ambient meeting memory to Apple Watch',
    source: 'Product signal',
    summary:
      'The watch becomes a lightweight capture surface, shifting assistant interaction from deliberate prompting toward ambient context collection.',
    takeaway:
      'Wearables may become a primary AI entry point rather than a companion screen.',
    category: 'ai_hardware',
    sourceType: 'captured_news',
    capturedAt: '2026-07-30T11:30:00Z',
    capturedBy: 'Nicole',
    editorialStatus: 'processed',
    voteCount: 1,
    topicLinks: [],
  },
  {
    id: 'news-pocket',
    url: 'https://techcrunch.com/example-pocket',
    title: 'Meta quietly launches vibe-coded gaming app Pocket',
    source: 'TechCrunch',
    summary:
      'A team capture waiting for editorial review. It may support a broader thesis about software creation becoming an interaction primitive.',
    takeaway: '',
    category: 'ai_software',
    sourceType: 'captured_news',
    capturedAt: '2026-08-03T03:00:00Z',
    capturedBy: 'Team',
    editorialStatus: 'pending',
    voteCount: 0,
    topicLinks: [],
  },
]

export const demoTopics: Topic[] = [
  {
    id: 'topic-harness',
    title: 'Harness engineering',
    thesisId: 'thesis-agent-systems',
    monthKey: '2026-11',
    monthLabel: 'November 2026',
    category: 'ai_capability',
    status: 'scheduled',
    kind: 'insight',
    notes: 'From model quality to repeatable system reliability.',
    analysis: {
      ...emptyTopicAnalysis,
      keyQuestion: 'Can harnesses become a productized reliability layer?',
    },
    outputs: [],
    createdAt: '2026-07-20T09:00:00Z',
    displayOrder: 1,
    supportingNews: ['news-dataflow'],
  },
  {
    id: 'topic-ambient',
    title: 'Ambient capture surfaces',
    thesisId: 'thesis-human-ai',
    monthKey: '2026-10',
    monthLabel: 'October 2026',
    category: 'interaction',
    status: 'researching',
    kind: 'poc',
    notes: 'How wearables reshape memory, consent, and assistant context.',
    analysis: { ...emptyTopicAnalysis },
    outputs: [],
    createdAt: '2026-07-22T09:00:00Z',
    displayOrder: 1,
    supportingNews: [],
  },
  {
    id: 'topic-genui',
    title: 'Generative UI as software',
    thesisId: 'thesis-agent-systems',
    parentTopicId: 'topic-harness',
    monthKey: '2026-12',
    monthLabel: 'December 2026',
    category: 'ai_software',
    status: 'idea',
    kind: 'roadmap',
    notes: 'Interfaces assembled at intent time need new evaluation methods.',
    analysis: { ...emptyTopicAnalysis },
    outputs: [],
    createdAt: '2026-07-24T09:00:00Z',
    displayOrder: 1,
    supportingNews: [],
  },
  {
    id: 'topic-pool-idea',
    title: 'On-device agent privacy tradeoffs',
    monthKey: '',
    monthLabel: 'Topic pool',
    category: 'ecosystem',
    status: 'idea',
    kind: 'insight',
    notes: 'Parked until a launch window or industry event makes timing clear.',
    analysis: { ...emptyTopicAnalysis },
    outputs: [],
    createdAt: '2026-08-01T09:00:00Z',
    displayOrder: 1,
    supportingNews: ['news-granola'],
  },
]

export const demoTheses: Thesis[] = [
  {
    id: 'thesis-agent-systems',
    title: 'Agent systems become a new software layer',
    description:
      'A long-range portfolio connecting harnesses, generative interfaces, and autonomous action.',
    horizon: '2026–2027',
    topicIds: ['topic-harness', 'topic-genui'],
  },
  {
    id: 'thesis-human-ai',
    title: 'Human–AI interaction moves into the environment',
    description:
      'Persistent context and ambient devices change when and how people invoke intelligence.',
    horizon: '2026–2027',
    topicIds: ['topic-ambient'],
  },
]
