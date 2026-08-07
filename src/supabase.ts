import { createClient } from '@supabase/supabase-js'
import type {
  ActivityEvent,
  EditorialReadout,
  EditorialHealth,
  NewsCategory,
  NewsItem,
  Thesis,
  TeamMemberSummary,
  Topic,
  TopicStatus,
} from './types'

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
  published_at: string | null
  captured_by: string | null
  image_url: string
  editorial_status: 'pending' | 'processed' | 'failed'
  metadata: Record<string, unknown> | null
  updated_at: string
  version?: number
  deleted_at?: string | null
  topic_news?: Array<{
    deleted_at?: string | null
    topics: {
      id: string
      title: string
      scheduled_month: string | null
      deleted_at?: string | null
    } | null
  }>
}

export function topicMonthLabel(monthKey: string) {
  if (!monthKey) return 'Topic pool'
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return 'Topic pool'
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function scheduledMonthValue(monthKey: string) {
  return monthKey ? `${monthKey}-01` : null
}

function sessionUserLabel(user: {
  email?: string
  user_metadata?: Record<string, unknown>
} | null) {
  const metadataName =
    typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : ''
  return metadataName || user?.email?.split('@')[0] || 'Team member'
}

function captureContributorName(
  metadata: Record<string, unknown> | null | undefined,
  capturedById: string | null,
  memberNames: Map<string, string>,
) {
  const capture =
    metadata &&
    typeof metadata.capture === 'object' &&
    metadata.capture &&
    !Array.isArray(metadata.capture)
      ? (metadata.capture as Record<string, unknown>)
      : null
  const candidates = [
    metadata?.contributor_name,
    metadata?.legacy_user,
    capture?.contributor_name,
    capture?.legacy_user,
    capturedById ? memberNames.get(capturedById) : '',
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return 'Imported'
}

export async function loadWorkspace(includeDeleted = false) {
  if (!supabase) return null
  let newsQuery = supabase
    .from('news_items')
    .select(
      'id,canonical_url,title,source,summary,category,captured_at,published_at,captured_by,image_url,editorial_status,metadata,updated_at,version,deleted_at,topic_news(deleted_at,topics(id,title,scheduled_month,deleted_at))',
    )
    .order('captured_at', { ascending: false })
  let topicQuery = supabase
    .from('topics')
    .select('*,topic_news(news_id,deleted_at)')
    .order('scheduled_month', { nullsFirst: false })
    .order('display_order')
  let thesisQuery = supabase.from('theses').select('*').order('display_order')
  if (!includeDeleted) {
    newsQuery = newsQuery.is('deleted_at', null)
    topicQuery = topicQuery.is('deleted_at', null)
    thesisQuery = thesisQuery.is('deleted_at', null)
  }
  const [newsResult, topicResult, thesisResult, memberResult, readoutResult] =
    await Promise.all([
      newsQuery,
      topicQuery,
      thesisQuery,
      supabase.from('team_members').select('user_id,display_name,email'),
      supabase
        .from('editorial_readouts')
        .select('period_type,period_key,lede,bullets,generated_at')
        .order('generated_at', { ascending: false })
        .limit(1),
    ])
  const error =
    newsResult.error ||
    topicResult.error ||
    thesisResult.error ||
    memberResult.error ||
    readoutResult.error
  if (error) throw error

  const memberNames = new Map(
    (memberResult.data || []).map((member) => [
      member.user_id,
      member.display_name || member.email?.split('@')[0] || 'Team member',
    ]),
  )
  const news: NewsItem[] = ((newsResult.data || []) as unknown as NewsRow[]).map(
    (row) => {
      const metadata = row.metadata || {}
      const contributedName = captureContributorName(
        metadata,
        row.captured_by,
        memberNames,
      )
      return {
        id: row.id,
        url: row.canonical_url,
        title: row.title,
        source: row.source,
        summary: row.summary,
        category: row.category,
        capturedAt: row.captured_at,
        publishedAt: row.published_at || undefined,
        capturedBy: contributedName,
        lastEditedBy:
          typeof metadata.last_edited_by === 'string'
            ? metadata.last_edited_by
            : undefined,
        archivedAt:
          typeof metadata.archived_at === 'string'
            ? metadata.archived_at
            : undefined,
        metadata,
        imageUrl: row.image_url,
        editorialStatus:
          row.editorial_status === 'processed' ? 'processed' : 'pending',
        updatedAt: row.updated_at,
        version: row.version,
        deletedAt: row.deleted_at || undefined,
        topicLinks: (row.topic_news || [])
          .filter((link) => !link.deleted_at)
          .map((link) => link.topics)
          .filter(
            (topic): topic is NonNullable<typeof topic> =>
              Boolean(topic && !topic.deleted_at),
          )
          .map((topic) => {
            const monthKey = topic.scheduled_month
              ? String(topic.scheduled_month).slice(0, 7)
              : ''
            return {
              topicId: topic.id,
              topicTitle: topic.title,
              monthLabel: topicMonthLabel(monthKey),
            }
          }),
      }
    },
  )

  const topics: Topic[] = (topicResult.data || []).map((row) => {
    const monthKey = row.scheduled_month
      ? String(row.scheduled_month).slice(0, 7)
      : ''
    return {
      id: row.id,
      title: row.title,
      thesisId: row.thesis_id || undefined,
      parentTopicId: row.parent_topic_id || undefined,
      monthKey,
      monthLabel: topicMonthLabel(monthKey),
      category: row.category,
      status: row.status,
      notes: row.notes,
      displayOrder: row.display_order,
      updatedAt: row.updated_at,
      version: row.version,
      deletedAt: row.deleted_at || undefined,
      supportingNews: (row.topic_news || [])
        .filter((link: { deleted_at?: string | null }) => !link.deleted_at)
        .map((link: { news_id: string }) => link.news_id),
    }
  })

  const theses: Thesis[] = (thesisResult.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    horizon: row.horizon,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at || undefined,
    topicIds: topics
      .filter((topic) => topic.thesisId === row.id)
      .map((topic) => topic.id),
  }))
  const latestReadout = readoutResult.data?.[0]
  const readout: EditorialReadout | null = latestReadout
    ? {
        periodType: latestReadout.period_type as EditorialReadout['periodType'],
        periodKey: latestReadout.period_key,
        lede: latestReadout.lede,
        bullets: Array.isArray(latestReadout.bullets)
          ? latestReadout.bullets.filter(
              (item): item is string => typeof item === 'string',
            )
          : [],
        generatedAt: latestReadout.generated_at,
      }
    : null
  return { news, topics, theses, readout }
}

export async function persistTopicNews(topicId: string, newsId: string) {
  if (!supabase) return
  const session = await supabase.auth.getSession()
  const { error } = await supabase
    .from('topic_news')
    .upsert({
      topic_id: topicId,
      news_id: newsId,
      linked_by: session.data.session?.user.id || null,
      deleted_at: null,
      deleted_by: null,
    })
  if (error) throw error
}

export async function persistTopicMonth(
  topicId: string,
  monthKey: string,
  expectedVersion?: number,
) {
  if (!supabase) return
  let query = supabase
    .from('topics')
    .update({ scheduled_month: scheduledMonthValue(monthKey) })
    .eq('id', topicId)
  if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)
  const { data, error } = await query.select('version').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This topic changed elsewhere. Reload and try again.')
  return data.version as number
}

export function canonicalizeUrl(value: string) {
  const url = new URL(value.trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP(S) URLs are allowed')
  }
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid') {
      url.searchParams.delete(key)
    }
  }
  return url.toString()
}

export async function persistNewsLink(input: {
  url: string
  title: string
  source: string
  contributorName?: string
}) {
  if (!supabase) return null
  const session = await supabase.auth.getSession()
  const user = session.data.session?.user || null
  const contributorName =
    input.contributorName?.trim() || sessionUserLabel(user)
  const canonicalUrl = canonicalizeUrl(input.url)
  const existing = await supabase
    .from('news_items')
    .select('id,metadata,deleted_at')
    .eq('canonical_url', canonicalUrl)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) {
    return {
      id: existing.data.id as string,
      contributorName:
        typeof existing.data.metadata?.contributor_name === 'string'
          ? existing.data.metadata.contributor_name
          : contributorName,
      canonicalUrl,
      alreadyExisted: true,
      removed: Boolean(existing.data.deleted_at),
    }
  }
  const { data, error } = await supabase
    .from('news_items')
    .insert({
      canonical_url: canonicalUrl,
      title: input.title,
      source: input.source,
      captured_by: user?.id || null,
      captured_via: 'dashboard',
      editorial_status: 'pending',
      metadata: { contributor_name: contributorName },
    })
    .select('id')
    .single()
  if (error) throw error
  return {
    id: data.id as string,
    contributorName,
    canonicalUrl,
    alreadyExisted: false,
    removed: false,
  }
}

export async function updateNewsItem(
  id: string,
  patch: {
    title?: string
    summary?: string
    category?: NewsCategory
    published_at?: string | null
    metadata?: Record<string, unknown>
  },
  expectedVersion?: number,
) {
  if (!supabase) return
  const session = await supabase.auth.getSession()
  const user = session.data.session?.user || null
  const editorName = sessionUserLabel(user)
  let query = supabase
    .from('news_items')
    .update({
      ...patch,
      metadata: patch.metadata
        ? {
            ...patch.metadata,
            last_edited_by: editorName,
          }
        : undefined,
    })
    .eq('id', id)
  if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)
  const { data, error } = await query.select('version').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This news item changed elsewhere. Reload and try again.')
  return { editorName, version: data.version as number }
}

export async function deleteNewsItem(id: string) {
  if (!supabase) return
  const session = await supabase.auth.getSession()
  const { error } = await supabase
    .from('news_items')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: session.data.session?.user.id || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function createTopic(input: {
  title: string
  notes: string
  category: NewsCategory
  status: TopicStatus
  monthKey: string
  thesisId?: string
}) {
  if (!supabase) return null
  const session = await supabase.auth.getSession()
  const userId = session.data.session?.user.id || null
  const { data, error } = await supabase
    .from('topics')
    .insert({
      title: input.title,
      notes: input.notes,
      category: input.category,
      status: input.status,
      scheduled_month: scheduledMonthValue(input.monthKey),
      thesis_id: input.thesisId || null,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateTopicItem(
  id: string,
  patch: {
    title?: string
    notes?: string
    category?: NewsCategory
    status?: TopicStatus
    scheduled_month?: string | null
    thesis_id?: string | null
  },
  expectedVersion?: number,
) {
  if (!supabase) return
  const session = await supabase.auth.getSession()
  let query = supabase
    .from('topics')
    .update({
      ...patch,
      updated_by: session.data.session?.user.id || null,
    })
    .eq('id', id)
  if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)
  const { data, error } = await query.select('version').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This topic changed elsewhere. Reload and try again.')
  return data.version as number
}

export async function createThesis(input: {
  title: string
  description: string
  horizon: string
}) {
  if (!supabase) return null
  const session = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('theses')
    .insert({
      title: input.title,
      description: input.description,
      horizon: input.horizon,
      created_by: session.data.session?.user.id || null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateThesisItem(
  id: string,
  patch: {
    title?: string
    description?: string
    horizon?: string
  },
  expectedVersion?: number,
) {
  if (!supabase) return
  let query = supabase.from('theses').update(patch).eq('id', id)
  if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)
  const { data, error } = await query.select('version').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This thesis changed elsewhere. Reload and try again.')
  return data.version as number
}

export async function deleteThesisItem(id: string) {
  if (!supabase) return
  const session = await supabase.auth.getSession()
  const { error } = await supabase
    .from('theses')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: session.data.session?.user.id || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTopicItem(id: string) {
  if (!supabase) return
  const session = await supabase.auth.getSession()
  const { error } = await supabase
    .from('topics')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: session.data.session?.user.id || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function restoreContent(
  table: 'news_items' | 'topics' | 'theses',
  id: string,
) {
  if (!supabase) return
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', id)
  if (error) throw error
}

export async function purgeContent(
  table: 'news_items' | 'topics' | 'theses',
  id: string,
) {
  if (!supabase) return
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .not('deleted_at', 'is', null)
  if (error) throw error
}

export async function purgeRecycleBin(
  items: Array<{ table: 'news_items' | 'topics' | 'theses'; id: string }>,
) {
  if (!supabase || items.length === 0) return
  // Delete theses last? Topics reference theses with ON DELETE SET NULL, so order is flexible.
  // Delete news and topics before theses is fine; topics first if we care about links - cascade handles topic_news.
  const ordered = [
    ...items.filter((item) => item.table === 'news_items'),
    ...items.filter((item) => item.table === 'topics'),
    ...items.filter((item) => item.table === 'theses'),
  ]
  for (const item of ordered) {
    await purgeContent(item.table, item.id)
  }
}

export async function unlinkTopicNews(topicId: string, newsId: string) {
  if (!supabase) return
  const session = await supabase.auth.getSession()
  const { error } = await supabase
    .from('topic_news')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: session.data.session?.user.id || null,
    })
    .eq('topic_id', topicId)
    .eq('news_id', newsId)
  if (error) throw error
}

export async function importLegacyNews() {
  if (!supabase) return 0
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token
  if (!token) throw new Error('Sign in before importing legacy news')
  const result = await fetch('/api/import-legacy', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
  const body = await result.json()
  if (!result.ok) throw new Error(body.error || 'Legacy import failed')
  return Number(body.imported || 0)
}

export function subscribeToWorkspace(
  onChange: () => void,
  onStatus?: (status: 'connecting' | 'synced' | 'error') => void,
) {
  if (!supabase) return () => undefined
  onStatus?.('connecting')
  const channel = supabase.channel('workspace-pilot')
  for (const table of [
    'news_items',
    'topics',
    'theses',
    'topic_news',
    'editorial_readouts',
    'editorial_job_runs',
  ]) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      onChange,
    )
  }
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') onStatus?.('synced')
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      onStatus?.('error')
    }
  })
  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function loadActivityEvents(
  entityType: 'news_items' | 'topics' | 'theses',
  entityId: string,
) {
  if (!supabase) return [] as ActivityEvent[]
  const { data, error } = await supabase
    .from('activity_events')
    .select('id,action,occurred_at,actor_id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('occurred_at', { ascending: false })
    .limit(20)
  if (error) throw error
  const actorIds = [
    ...new Set(
      (data || [])
        .map((item) => item.actor_id)
        .filter((id): id is string => typeof id === 'string'),
    ),
  ]
  const members = actorIds.length
    ? await supabase
        .from('team_members')
        .select('user_id,display_name,email')
        .in('user_id', actorIds)
    : { data: [], error: null }
  if (members.error) throw members.error
  const names = new Map(
    (members.data || []).map((member) => [
      member.user_id,
      member.display_name || member.email?.split('@')[0] || 'Team member',
    ]),
  )
  return (data || []).map((item) => ({
    id: item.id as number,
    action: item.action as string,
    occurredAt: item.occurred_at as string,
    actorName: item.actor_id ? names.get(item.actor_id) || 'Team member' : 'Automation',
  }))
}

export async function loadEditorialHealth() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('editorial_job_runs')
    .select('status,started_at,finished_at,processed_count,error_message')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    status: data.status,
    startedAt: data.started_at,
    finishedAt: data.finished_at || undefined,
    processedCount: data.processed_count,
    errorMessage: data.error_message || undefined,
  } as EditorialHealth
}

export async function loadTeamMembers() {
  if (!supabase) return [] as TeamMemberSummary[]
  const { data, error } = await supabase
    .from('team_members')
    .select('user_id,email,display_name,role')
    .order('display_name')
  if (error) throw error
  return (data || []).map((member) => ({
    userId: member.user_id,
    email: member.email,
    displayName: member.display_name || member.email?.split('@')[0] || 'Team member',
    role: member.role as TeamMemberSummary['role'],
  }))
}

export async function updateTeamMemberRole(
  userId: string,
  role: TeamMemberSummary['role'],
) {
  if (!supabase) return
  const { error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('user_id', userId)
  if (error) throw error
}
