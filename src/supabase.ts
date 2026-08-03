import { createClient } from '@supabase/supabase-js'
import type { NewsCategory, NewsItem, Thesis, Topic } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const cloudConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = cloudConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

type NewsRow = {
  id: string
  canonical_url: string
  title: string
  source: string
  summary: string
  category: NewsCategory
  captured_at: string
  captured_by: string | null
  image_url: string
  editorial_status: 'pending' | 'processed' | 'failed'
  topic_news?: Array<{
    topics: {
      id: string
      title: string
      scheduled_month: string
    } | null
  }>
}

export async function loadWorkspace() {
  if (!supabase) return null
  const [newsResult, topicResult, thesisResult] = await Promise.all([
    supabase
      .from('news_items')
      .select(
        'id,canonical_url,title,source,summary,category,captured_at,captured_by,image_url,editorial_status,topic_news(topics(id,title,scheduled_month))',
      )
      .order('captured_at', { ascending: false }),
    supabase
      .from('topics')
      .select('*,topic_news(news_id)')
      .order('scheduled_month')
      .order('display_order'),
    supabase.from('theses').select('*').order('display_order'),
  ])
  const error = newsResult.error || topicResult.error || thesisResult.error
  if (error) throw error

  const news: NewsItem[] = ((newsResult.data || []) as unknown as NewsRow[]).map(
    (row) => ({
      id: row.id,
      url: row.canonical_url,
      title: row.title,
      source: row.source,
      summary: row.summary,
      category: row.category,
      capturedAt: row.captured_at,
      capturedBy: row.captured_by || 'Team',
      imageUrl: row.image_url,
      editorialStatus:
        row.editorial_status === 'processed' ? 'processed' : 'pending',
      topicLinks: (row.topic_news || [])
        .map((link) => link.topics)
        .filter((topic): topic is NonNullable<typeof topic> => Boolean(topic))
        .map((topic) => ({
          topicId: topic.id,
          topicTitle: topic.title,
          monthLabel: new Intl.DateTimeFormat('en', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(`${topic.scheduled_month}T00:00:00Z`)),
        })),
    }),
  )

  const topics: Topic[] = (topicResult.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    thesisId: row.thesis_id || undefined,
    parentTopicId: row.parent_topic_id || undefined,
    monthKey: String(row.scheduled_month).slice(0, 7),
    monthLabel: new Intl.DateTimeFormat('en', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${row.scheduled_month}T00:00:00Z`)),
    category: row.category,
    status: row.status,
    notes: row.notes,
    displayOrder: row.display_order,
    supportingNews: (row.topic_news || []).map(
      (link: { news_id: string }) => link.news_id,
    ),
  }))

  const theses: Thesis[] = (thesisResult.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    horizon: row.horizon,
    topicIds: topics
      .filter((topic) => topic.thesisId === row.id)
      .map((topic) => topic.id),
  }))
  return { news, topics, theses }
}

export async function persistTopicNews(topicId: string, newsId: string) {
  if (!supabase) return
  const { error } = await supabase
    .from('topic_news')
    .upsert({ topic_id: topicId, news_id: newsId })
  if (error) throw error
}

export async function persistTopicMonth(topicId: string, monthKey: string) {
  if (!supabase) return
  const { error } = await supabase
    .from('topics')
    .update({ scheduled_month: `${monthKey}-01` })
    .eq('id', topicId)
  if (error) throw error
}

export async function persistNewsLink(input: {
  url: string
  title: string
  source: string
}) {
  if (!supabase) return null
  const session = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('news_items')
    .upsert(
      {
        canonical_url: input.url,
        title: input.title,
        source: input.source,
        captured_by: session.data.session?.user.id || null,
        captured_via: 'dashboard',
        editorial_status: 'pending',
      },
      { onConflict: 'canonical_url' },
    )
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
