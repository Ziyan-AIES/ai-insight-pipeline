import type { NewsItem, Thesis, Topic } from './types'

export const demoNews: NewsItem[] = [
  {
    id: 'news-dataflow',
    url: 'https://example.com/dataflow-harness',
    title: 'DataFlow-Harness turns agent reliability into an engineering discipline',
    source: 'Research signal',
    summary:
      'A structured harness combines evaluations, traces, and recovery paths so teams can improve agents without treating every failure as a one-off.',
    category: 'ai_capability',
    capturedAt: '2026-07-29T10:00:00Z',
    capturedBy: 'Ziyan',
    editorialStatus: 'processed',
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
    category: 'ai_hardware',
    capturedAt: '2026-07-30T11:30:00Z',
    capturedBy: 'Nicole',
    editorialStatus: 'processed',
    topicLinks: [],
  },
  {
    id: 'news-pocket',
    url: 'https://techcrunch.com/example-pocket',
    title: 'Meta quietly launches vibe-coded gaming app Pocket',
    source: 'TechCrunch',
    summary:
      'A team capture waiting for editorial review. It may support a broader thesis about software creation becoming an interaction primitive.',
    category: 'ai_software',
    capturedAt: '2026-08-03T03:00:00Z',
    capturedBy: 'Team',
    editorialStatus: 'pending',
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
    notes: 'From model quality to repeatable system reliability.',
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
    notes: 'How wearables reshape memory, consent, and assistant context.',
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
    notes: 'Interfaces assembled at intent time need new evaluation methods.',
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
    notes: 'Parked until a launch window or industry event makes timing clear.',
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
