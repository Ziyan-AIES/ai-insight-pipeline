import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { demoNews, demoTheses, demoTopics } from './demoData'
import { useTeamAuth } from './auth-context'
import {
  canonicalizeUrl,
  cloudConfigured,
  createThesis,
  createTopic,
  deleteNewsItem,
  deleteThesisItem,
  deleteTopicItem,
  loadActivityEvents,
  loadTeamMembers,
  loadWorkspace,
  persistDiscussionOrder,
  persistManualNote,
  persistNewsLink,
  persistTeamIdea,
  persistTopicNews,
  restoreContent,
  purgeContent,
  purgeRecycleBin,
  subscribeToWorkspace,
  toggleNewsVote,
  topicMonthLabel,
  unlinkTopicNews,
  updateNewsItem,
  updateTeamMemberRole,
  updateThesisItem,
  updateTopicItem,
} from './supabase'
import {
  categoryLabels,
  emptyTopicAnalysis,
  legacyStatusFromThread,
  liveSignalCategories,
  threadStatusFromLegacy,
  threadStatusLabels,
  topicKindLabels,
} from './labels'
import {
  discussionPriorityScore,
  firstSentences,
  formatRelativeAge,
} from './intelligence'
import type {
  FocusMode,
  NewsCategory,
  NewsItem,
  Thesis,
  Topic,
  TopicKind,
  ThreadStatus,
  TeamMemberSummary,
  ActivityEvent,
  WorkspacePage,
} from './types'

type NewsScope = 'all' | 'undecided' | 'pipeline' | 'archived' | 'removed'
type TopicKindFilter = 'all' | TopicKind
type ThreadStatusFilter = 'all' | ThreadStatus
type AddLinkDraft = {
  open: boolean
  url: string
  title: string
  contributor: string
  targetTopicId: string
}
const addLinkDraftKey = 'signal-intelligence:add-link-draft'

function workspaceFromLocation(): WorkspacePage {
  try {
    const page = new URLSearchParams(window.location.search).get('workspace')
    if (page === 'synthesis' || page === 'weekly') return 'synthesis'
    if (page === 'threads') return 'threads'
    return 'signals'
  } catch {
    return 'signals'
  }
}

function clearStoredAddLinkDraft() {
  try {
    window.sessionStorage.removeItem(addLinkDraftKey)
  } catch {
    // Draft persistence is best-effort when browser storage is unavailable.
  }
}

function loadAddLinkDraft(): AddLinkDraft {
  const emptyDraft = {
    open: false,
    url: '',
    title: '',
    contributor: '',
    targetTopicId: '',
  }
  try {
    if (typeof window === 'undefined') return emptyDraft
    const stored = window.sessionStorage.getItem(addLinkDraftKey)
    if (!stored) return emptyDraft
    const value = JSON.parse(stored) as Partial<AddLinkDraft>
    return {
      open: value.open === true,
      url: typeof value.url === 'string' ? value.url : '',
      title: typeof value.title === 'string' ? value.title : '',
      contributor:
        typeof value.contributor === 'string' ? value.contributor : '',
      targetTopicId:
        typeof value.targetTopicId === 'string' ? value.targetTopicId : '',
    }
  } catch {
    return emptyDraft
  }
}

function monthName(key: string) {
  return topicMonthLabel(key)
}

function newsDate(item: NewsItem) {
  return item.publishedAt || item.capturedAt
}

type TimeRange = 'week' | 'fortnight' | 'month'

function inTimeRange(iso: string, range: TimeRange, now = Date.now()) {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return true
  if (then > now) return true
  const days = range === 'week' ? 7 : range === 'fortnight' ? 14 : 31
  return now - then <= days * 86400000
}

function noteTakeaway(item: NewsItem) {
  if (item.takeaway?.trim()) return item.takeaway.trim()
  return metadataStrings(item.metadata, 'implications')[0] || ''
}

function sortDiscussionNotes(items: NewsItem[]) {
  return [...items].sort((a, b) => {
    const aPinned = typeof a.discussionOrder === 'number'
    const bPinned = typeof b.discussionOrder === 'number'
    if (aPinned && bPinned && a.discussionOrder !== b.discussionOrder) {
      return (a.discussionOrder || 0) - (b.discussionOrder || 0)
    }
    if (aPinned !== bPinned) return aPinned ? -1 : 1
    if ((b.voteCount || 0) !== (a.voteCount || 0)) {
      return (b.voteCount || 0) - (a.voteCount || 0)
    }
    return newsDate(b).localeCompare(newsDate(a))
  })
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function metadataStrings(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function metadataObjects(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key]
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : []
}

export function NewsWhyItMatters({
  metadata,
}: {
  metadata: Record<string, unknown> | undefined
}) {
  const implications = metadataStrings(metadata, 'implications').slice(0, 1)
  if (implications.length === 0) return null
  return (
    <div className="why-it-matters">
      <strong>Why it matters for Qira</strong>
      <p>{implications[0]}</p>
    </div>
  )
}

function NewsAnalysis({
  metadata,
}: {
  metadata: Record<string, unknown> | undefined
}) {
  const evidence = metadataObjects(metadata, 'evidence')
  const implications = metadataStrings(metadata, 'implications').slice(0, 1)
  const audit =
    metadata?.editorial_audit &&
    typeof metadata.editorial_audit === 'object' &&
    !Array.isArray(metadata.editorial_audit)
      ? (metadata.editorial_audit as Record<string, unknown>)
      : null
  if (
    evidence.length === 0 &&
    implications.length === 0
  ) {
    return null
  }

  return (
    <details className="ai-analysis">
      <summary>AI analysis trail</summary>
      {evidence.length > 0 && (
        <section>
          <strong>Source-backed evidence</strong>
          <ul>
            {evidence.map((item, index) => (
              <li key={`${String(item.claim)}-${index}`}>
                {String(item.claim || '')}
                {typeof item.source_url === 'string' && (
                  <a href={item.source_url} target="_blank" rel="noreferrer">
                    Source
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {implications.length > 0 && (
        <section>
          <strong>Why it matters for Qira</strong>
          <ul>
            {implications.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      {audit && (
        <small>
          Reviewed from {String(audit.source_mode || 'source material')} ·{' '}
          {String(audit.evidence_count || evidence.length)} evidence points
        </small>
      )}
    </details>
  )
}

function ActivityHistory({ events }: { events: ActivityEvent[] }) {
  if (!events.length) return null
  return (
    <details className="activity-history">
      <summary>Activity history ({events.length})</summary>
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.action.replaceAll('_', ' ')}</strong>
            <span>
              {event.actorName} ·{' '}
              {new Intl.DateTimeFormat('en', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(event.occurredAt))}
            </span>
          </li>
        ))}
      </ol>
    </details>
  )
}

function App() {
  const { identity, canEdit, canAdmin, signOut } = useTeamAuth()
  const initialAddLinkDraft = useMemo(loadAddLinkDraft, [])
  const [news, setNews] = useState(cloudConfigured ? [] : demoNews)
  const [topics, setTopics] = useState(cloudConfigured ? [] : demoTopics)
  const [theses, setTheses] = useState(cloudConfigured ? [] : demoTheses)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [syncState, setSyncState] = useState<'connecting' | 'synced' | 'error'>(
    cloudConfigured ? 'connecting' : 'synced',
  )
  const [focus, setFocus] = useState<FocusMode>(() =>
    workspaceFromLocation() === 'signals' ? 'news' : 'split',
  )
  const [workspacePage, setWorkspacePage] = useState<WorkspacePage>(
    workspaceFromLocation,
  )
  const [timeRange, setTimeRange] = useState<TimeRange>('month')
  const [newsScope] = useState<NewsScope>('all')
  const [topicKindFilter, setTopicKindFilter] = useState<TopicKindFilter>('all')
  const [threadStatusFilter, setThreadStatusFilter] =
    useState<ThreadStatusFilter>('all')
  const [threadFrom, setThreadFrom] = useState('')
  const [threadTo, setThreadTo] = useState('')
  const [threadCreatedPreset, setThreadCreatedPreset] = useState('any')
  const [pendingThreadNewsId, setPendingThreadNewsId] = useState('')
  const [categoryDrawer, setCategoryDrawer] = useState<NewsCategory | null>(
    null,
  )
  const [openNewsMenuId, setOpenNewsMenuId] = useState('')
  const [ideaText, setIdeaText] = useState('')
  const [ideaNewsId, setIdeaNewsId] = useState('')
  const [ideaListening, setIdeaListening] = useState(false)
  const [query, setQuery] = useState('')
  const [showAddLink, setShowAddLink] = useState(initialAddLinkDraft.open)
  const [showRecycleBin, setShowRecycleBin] = useState(false)
  const [showTeam, setShowTeam] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMemberSummary[]>([])
  const [linkUrl, setLinkUrl] = useState(initialAddLinkDraft.url)
  const [linkTitle, setLinkTitle] = useState(initialAddLinkDraft.title)
  const [linkContributor, setLinkContributor] = useState(
    initialAddLinkDraft.contributor,
  )
  const [targetTopicId, setTargetTopicId] = useState(
    initialAddLinkDraft.targetTopicId,
  )
  const [draggedNewsId, setDraggedNewsId] = useState('')
  const [draggedNewsSourceTopicId, setDraggedNewsSourceTopicId] = useState('')
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [noteTakeawayDraft, setNoteTakeawayDraft] = useState('')
  const [noteCategory, setNoteCategory] = useState<NewsCategory>('interaction')
  const [newsDraft, setNewsDraft] = useState<NewsItem | null>(null)
  const [topicDraft, setTopicDraft] = useState<Topic | null>(null)
  const [thesisDraft, setThesisDraft] = useState<Thesis | null>(null)
  const [creatingTopic, setCreatingTopic] = useState(false)
  const [creatingThesis, setCreatingThesis] = useState(false)
  const [selectedThesisId, setSelectedThesisId] = useState('')
  const [notice, setNotice] = useState('')
  const [headerHidden, setHeaderHidden] = useState(false)
  const selectedActivityType = newsDraft
    ? ('news_items' as const)
    : topicDraft && !creatingTopic
      ? ('topics' as const)
      : thesisDraft && !creatingThesis
        ? ('theses' as const)
        : null
  const selectedActivityId =
    newsDraft?.id ||
    (topicDraft && !creatingTopic ? topicDraft.id : '') ||
    (thesisDraft && !creatingThesis ? thesisDraft.id : '')

  const closeAddLink = useCallback(() => {
    setShowAddLink(false)
    setLinkUrl('')
    setLinkTitle('')
    setLinkContributor('')
    setTargetTopicId('')
    clearStoredAddLinkDraft()
  }, [])

  const reloadWorkspace = useCallback(async (quiet = false) => {
    if (!cloudConfigured) return
    try {
      const workspace = await loadWorkspace(canAdmin)
      if (!workspace) return
      setNews(workspace.news)
      setTopics(workspace.topics)
      setTheses(workspace.theses)
      setSyncState('synced')
    } catch (error: unknown) {
      setSyncState('error')
      if (!quiet) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'Could not load the team workspace.',
        )
      }
    }
  }, [canAdmin])

  useEffect(() => {
    void reloadWorkspace()
    let timeout = 0
    const unsubscribe = subscribeToWorkspace(
      () => {
        window.clearTimeout(timeout)
        timeout = window.setTimeout(() => void reloadWorkspace(true), 180)
      },
      setSyncState,
    )
    return () => {
      window.clearTimeout(timeout)
      unsubscribe()
    }
  }, [reloadWorkspace])

  useEffect(() => {
    if (!selectedActivityType || !selectedActivityId || !cloudConfigured) {
      setActivity([])
      return
    }
    setActivity([])
    void loadActivityEvents(selectedActivityType, selectedActivityId)
      .then(setActivity)
      .catch(() => setActivity([]))
  }, [selectedActivityId, selectedActivityType])

  useEffect(() => {
    const handleWindowScroll = () => setHeaderHidden(window.scrollY > 16)
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleWindowScroll)
  }, [])

  useEffect(() => {
    if (!cloudConfigured) return
    const handleOnline = () => {
      setSyncState('connecting')
      void reloadWorkspace(true)
    }
    const handleOffline = () => setSyncState('error')
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [reloadWorkspace])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (!openNewsMenuId) return
    const close = () => setOpenNewsMenuId('')
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [openNewsMenuId])

  useEffect(() => {
    if (workspacePage === 'signals') setFocus('news')
    else setFocus('split')
    try {
      const url = new URL(window.location.href)
      if (workspacePage === 'signals') url.searchParams.delete('workspace')
      else url.searchParams.set('workspace', workspacePage)
      const next = `${url.pathname}${url.search}${url.hash}`
      if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
        window.history.replaceState(null, '', next)
      }
    } catch {
      // Deep-link sync is best-effort.
    }
  }, [workspacePage])

  useEffect(() => {
    const hasDraft = Boolean(
      showAddLink ||
        linkUrl ||
        linkTitle ||
        linkContributor ||
        targetTopicId,
    )
    if (!hasDraft) {
      clearStoredAddLinkDraft()
      return
    }
    try {
      window.sessionStorage.setItem(
        addLinkDraftKey,
        JSON.stringify({
          open: showAddLink,
          url: linkUrl,
          title: linkTitle,
          contributor: linkContributor,
          targetTopicId,
        } satisfies AddLinkDraft),
      )
    } catch {
      // Keep the form usable even if session storage is blocked or full.
    }
  }, [
    linkContributor,
    linkTitle,
    linkUrl,
    showAddLink,
    targetTopicId,
  ])

  useEffect(() => {
    const closeModal = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setNewsDraft(null)
      setTopicDraft(null)
      setThesisDraft(null)
      closeAddLink()
      setShowRecycleBin(false)
      setShowTeam(false)
      setShowAddNote(false)
      setCreatingTopic(false)
      setCreatingThesis(false)
    }
    window.addEventListener('keydown', closeModal)
    return () => window.removeEventListener('keydown', closeModal)
  }, [closeAddLink])

  const visibleNews = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return news
      .filter((item) => {
        const matchesCategory = true
        const matchesPeriod = inTimeRange(
          item.updatedAt || newsDate(item),
          timeRange,
        )
        const matchesScope =
          (newsScope === 'removed' && Boolean(item.deletedAt)) ||
          (!item.deletedAt &&
            (newsScope === 'all' ||
              (newsScope === 'undecided' &&
                !item.archivedAt &&
                item.topicLinks.length === 0) ||
              (newsScope === 'pipeline' && item.topicLinks.length > 0) ||
              (newsScope === 'archived' && Boolean(item.archivedAt))))
        const matchesQuery =
          !needle ||
          `${item.title} ${item.summary} ${item.takeaway} ${item.source} ${item.category} ${item.topicLinks.map((link) => link.topicTitle).join(' ')}`
            .toLowerCase()
            .includes(needle)
        return matchesCategory && matchesPeriod && matchesScope && matchesQuery
      })
      .sort((a, b) =>
        (b.updatedAt || newsDate(b)).localeCompare(a.updatedAt || newsDate(a)),
      )
  }, [news, newsScope, query, timeRange])

  const discussionNotes = useMemo(
    () =>
      sortDiscussionNotes(
        visibleNews.filter((item) => !item.deletedAt),
      ),
    [visibleNews],
  )

  const discussionCandidates = useMemo(() => {
    return visibleNews
      .filter((item) => !item.deletedAt)
      .slice()
      .sort(
        (a, b) =>
          discussionPriorityScore(b) - discussionPriorityScore(a) ||
          (b.updatedAt || newsDate(b)).localeCompare(a.updatedAt || newsDate(a)),
      )
  }, [visibleNews])

  const visibleTopics = useMemo(
    () =>
      topics
        .filter((topic) => !topic.deletedAt)
        .filter(
          (topic) =>
            topicKindFilter === 'all' || topic.kind === topicKindFilter,
        )
        .filter(
          (topic) =>
            threadStatusFilter === 'all' ||
            (topic.threadStatus || threadStatusFromLegacy(topic.status)) ===
              threadStatusFilter,
        )
        .filter((topic) => {
          const created = (topic.createdAt || '').slice(0, 10)
          if (threadFrom && created && created < threadFrom) return false
          if (threadTo && created && created > threadTo) return false
          return true
        })
        .slice()
        .sort((a, b) => {
          const created = (b.createdAt || '').localeCompare(a.createdAt || '')
          if (created) return created
          return a.title.localeCompare(b.title)
        }),
    [threadFrom, threadStatusFilter, threadTo, topicKindFilter, topics],
  )

  const removedItems = useMemo(
    () => ({
      news: news.filter((item) => item.deletedAt),
      topics: topics.filter((item) => item.deletedAt),
      theses: theses.filter((item) => item.deletedAt),
    }),
    [news, topics, theses],
  )

  async function restoreItem(
    table: 'news_items' | 'topics' | 'theses',
    id: string,
  ) {
    try {
      await restoreContent(table, id)
      await reloadWorkspace(true)
      setNotice('Item restored')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not restore item')
    }
  }

  async function purgeItem(
    table: 'news_items' | 'topics' | 'theses',
    id: string,
    title: string,
  ) {
    if (
      !window.confirm(
        `Permanently delete “${title}”? This cannot be undone.`,
      )
    ) {
      return
    }
    try {
      if (cloudConfigured) {
        await purgeContent(table, id)
      }
      if (table === 'news_items') {
        setNews((current) => current.filter((item) => item.id !== id))
      } else if (table === 'topics') {
        setTopics((current) => current.filter((item) => item.id !== id))
        setNews((current) =>
          current.map((item) => ({
            ...item,
            topicLinks: item.topicLinks.filter((link) => link.topicId !== id),
          })),
        )
      } else {
        setTheses((current) => current.filter((item) => item.id !== id))
        setTopics((current) =>
          current.map((topic) =>
            topic.thesisId === id ? { ...topic, thesisId: undefined } : topic,
          ),
        )
      }
      setNotice('Item permanently deleted')
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Could not permanently delete item',
      )
    }
  }

  async function emptyRecycleBin() {
    const items = [
      ...removedItems.news.map((item) => ({
        table: 'news_items' as const,
        id: item.id,
      })),
      ...removedItems.topics.map((item) => ({
        table: 'topics' as const,
        id: item.id,
      })),
      ...removedItems.theses.map((item) => ({
        table: 'theses' as const,
        id: item.id,
      })),
    ]
    if (items.length === 0) return
    if (
      !window.confirm(
        `Empty recycle bin and permanently delete ${items.length} item${
          items.length === 1 ? '' : 's'
        }? This cannot be undone.`,
      )
    ) {
      return
    }
    try {
      if (cloudConfigured) {
        await purgeRecycleBin(items)
      }
      const removedNews = new Set(removedItems.news.map((item) => item.id))
      const removedTopics = new Set(removedItems.topics.map((item) => item.id))
      const removedTheses = new Set(removedItems.theses.map((item) => item.id))
      setNews((current) =>
        current
          .filter((item) => !removedNews.has(item.id))
          .map((item) => ({
            ...item,
            topicLinks: item.topicLinks.filter(
              (link) => !removedTopics.has(link.topicId),
            ),
          })),
      )
      setTopics((current) =>
        current
          .filter((item) => !removedTopics.has(item.id))
          .map((topic) =>
            topic.thesisId && removedTheses.has(topic.thesisId)
              ? { ...topic, thesisId: undefined }
              : topic,
          ),
      )
      setTheses((current) =>
        current.filter((item) => !removedTheses.has(item.id)),
      )
      setNotice('Recycle bin emptied')
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Could not empty recycle bin',
      )
      await reloadWorkspace(true)
    }
  }

  async function openTeamManagement() {
    setShowTeam(true)
    try {
      setTeamMembers(await loadTeamMembers())
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load team')
    }
  }

  async function changeMemberRole(
    member: TeamMemberSummary,
    role: TeamMemberSummary['role'],
  ) {
    if (
      member.userId === identity?.userId &&
      member.role === 'admin' &&
      role !== 'admin' &&
      !window.confirm('Remove your own admin access?')
    ) {
      return
    }
    try {
      await updateTeamMemberRole(member.userId, role)
      setTeamMembers((current) =>
        current.map((item) =>
          item.userId === member.userId ? { ...item, role } : item,
        ),
      )
      setNotice(`${member.displayName} is now ${role}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update role')
    }
  }

  async function linkNewsToTopic(newsId: string, topicId: string) {
    const topic = topics.find((item) => item.id === topicId)
    if (!topic || !news.some((item) => item.id === newsId)) return
    if (topic.supportingNews.includes(newsId)) return
    try {
      if (cloudConfigured) await persistTopicNews(topicId, newsId)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not link news')
      return
    }
    setTopics((current) =>
      current.map((candidate) =>
        candidate.id === topicId &&
        !candidate.supportingNews.includes(newsId)
          ? {
              ...candidate,
              supportingNews: [...candidate.supportingNews, newsId],
            }
          : candidate,
      ),
    )
    setNews((current) =>
      current.map((candidate) =>
        candidate.id === newsId &&
        !candidate.topicLinks.some((link) => link.topicId === topicId)
          ? {
              ...candidate,
              topicLinks: [
                ...candidate.topicLinks,
                {
                  topicId,
                  topicTitle: topic.title,
                  monthLabel: topic.monthLabel,
                },
              ],
            }
          : candidate,
      ),
    )
  }

  async function moveNewsToTopic(
    newsId: string,
    targetTopicId: string,
    sourceTopicId = '',
  ) {
    if (!newsId || !targetTopicId) return
    if (sourceTopicId && sourceTopicId === targetTopicId) return

    const target = topics.find((item) => item.id === targetTopicId)
    if (!target) return

    if (sourceTopicId) {
      try {
        if (cloudConfigured) {
          if (!target.supportingNews.includes(newsId)) {
            await persistTopicNews(targetTopicId, newsId)
          }
          await unlinkTopicNews(sourceTopicId, newsId)
        }
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : 'Could not move news',
        )
        return
      }

      setTopics((current) =>
        current.map((candidate) => {
          if (candidate.id === sourceTopicId) {
            return {
              ...candidate,
              supportingNews: candidate.supportingNews.filter(
                (id) => id !== newsId,
              ),
            }
          }
          if (
            candidate.id === targetTopicId &&
            !candidate.supportingNews.includes(newsId)
          ) {
            return {
              ...candidate,
              supportingNews: [...candidate.supportingNews, newsId],
            }
          }
          return candidate
        }),
      )
      setNews((current) =>
        current.map((candidate) => {
          if (candidate.id !== newsId) return candidate
          const withoutSource = candidate.topicLinks.filter(
            (link) => link.topicId !== sourceTopicId,
          )
          if (withoutSource.some((link) => link.topicId === targetTopicId)) {
            return { ...candidate, topicLinks: withoutSource }
          }
          return {
            ...candidate,
            topicLinks: [
              ...withoutSource,
              {
                topicId: targetTopicId,
                topicTitle: target.title,
                monthLabel: target.monthLabel,
              },
            ],
          }
        }),
      )
      setNotice(`Moved to ${target.title}`)
      return
    }

    await linkNewsToTopic(newsId, targetTopicId)
  }

  async function voteToDiscuss(item: NewsItem) {
    if (item.deletedAt) return
    try {
      if (cloudConfigured) {
        const result = await toggleNewsVote(item.id)
        if (!result) return
        setNews((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  voteCount: result.voteCount,
                  votedByMe: result.voted,
                }
              : candidate,
          ),
        )
        return
      }
      setNews((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                votedByMe: !candidate.votedByMe,
                voteCount: Math.max(
                  0,
                  (candidate.voteCount || 0) + (candidate.votedByMe ? -1 : 1),
                ),
              }
            : candidate,
        ),
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not record vote')
    }
  }

  async function submitIdea(linkedNewsId = ideaNewsId) {
    const content = ideaText.trim()
    if (!content) return
    try {
      if (cloudConfigured) {
        await persistTeamIdea({
          content,
          newsId: linkedNewsId || undefined,
          inputType: ideaListening ? 'voice' : 'text',
        })
      }
      setIdeaText('')
      setIdeaNewsId('')
      setNotice(
        linkedNewsId
          ? 'Idea captured for AI Daily Review. Synthesis stays anonymous.'
          : 'Idea captured for AI Daily Review. Synthesis stays anonymous.',
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save idea')
    }
  }

  function startVoiceIdea() {
    const SpeechRecognitionApi = (
      window as unknown as {
        SpeechRecognition?: new () => {
          lang: string
          start: () => void
          onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
          onerror: (() => void) | null
          onend: (() => void) | null
        }
        webkitSpeechRecognition?: new () => {
          lang: string
          start: () => void
          onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
          onerror: (() => void) | null
          onend: (() => void) | null
        }
      }
    ).SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => {
            lang: string
            start: () => void
            onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
            onerror: (() => void) | null
            onend: (() => void) | null
          }
        }
      ).webkitSpeechRecognition
    if (!SpeechRecognitionApi) {
      setNotice('Voice input is not available in this browser. Type the idea instead.')
      return
    }
    const recognition = new SpeechRecognitionApi()
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      const spoken = Array.from({ length: event.results.length }, (_, index) => {
        const result = event.results[index]
        return result?.[0]?.transcript || ''
      }).join(' ')
      setIdeaText((current) => `${current} ${spoken}`.trim())
    }
    recognition.onerror = () => setIdeaListening(false)
    recognition.onend = () => setIdeaListening(false)
    setIdeaListening(true)
    recognition.start()
  }

  async function unlinkSignal(topicId: string, newsId: string) {
    try {
      if (cloudConfigured) await unlinkTopicNews(topicId, newsId)
      setTopics((current) =>
        current.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                supportingNews: topic.supportingNews.filter((id) => id !== newsId),
              }
            : topic,
        ),
      )
      setNews((current) =>
        current.map((item) =>
          item.id === newsId
            ? {
                ...item,
                topicLinks: item.topicLinks.filter((link) => link.topicId !== topicId),
              }
            : item,
        ),
      )
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Could not unlink signal',
      )
    }
  }

  function openCreateThread(newsId = '') {
    setPendingThreadNewsId(newsId)
    openNewTopic()
  }


  async function reorderDiscussionNotes(fromId: string, targetIndex: number) {
    const current = discussionNotes.filter((item) => item.id !== fromId)
    const moved = discussionNotes.find((item) => item.id === fromId)
    if (!moved) return
    const next = [
      ...current.slice(0, targetIndex),
      moved,
      ...current.slice(targetIndex),
    ]
    setNews((items) =>
      items.map((item) => {
        const index = next.findIndex((candidate) => candidate.id === item.id)
        return index >= 0 ? { ...item, discussionOrder: index + 1 } : item
      }),
    )
    try {
      await persistDiscussionOrder(next.map((item) => item.id))
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Could not save discussion order',
      )
    }
  }

  async function addManualNote() {
    if (!noteTitle.trim() && !noteBody.trim()) return
    let persisted
    try {
      persisted = await persistManualNote({
        title: noteTitle.trim() || 'Untitled note',
        summary: noteBody.trim(),
        takeaway: noteTakeawayDraft.trim(),
        category: noteCategory,
      })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add note')
      return
    }
    const id = persisted?.id || `note-${Date.now()}`
    const item: NewsItem = {
      id,
      url: persisted?.canonicalUrl || '',
      title: noteTitle.trim() || 'Untitled note',
      source: 'Team note',
      summary: noteBody.trim(),
      takeaway: noteTakeawayDraft.trim(),
      industryImportance: '',
      qiraRelevance: '',
      teamSynthesis: '',
      discussionPriorityScore: 0,
      category: noteCategory,
      sourceType: 'manual_note',
      capturedAt: persisted?.capturedAt || new Date().toISOString(),
      capturedBy: persisted?.contributorName || identity?.displayName || 'Current user',
      editorialStatus: 'processed',
      voteCount: 0,
      version: 1,
      topicLinks: [],
    }
    setNews((current) => [item, ...current])
    setShowAddNote(false)
    setNoteTitle('')
    setNoteBody('')
    setNoteTakeawayDraft('')
    setNotice('Note added to the shared workspace')
  }

  async function saveNewsDraft() {
    if (!newsDraft) return
    const metadata = {
      ...(newsDraft.metadata || {}),
      contributor_name: newsDraft.capturedBy.trim() || 'Team member',
      archived_at: newsDraft.archivedAt || null,
    }
    let result
    try {
      result = await updateNewsItem(
        newsDraft.id,
        {
          title: newsDraft.title,
          summary: newsDraft.summary,
          takeaway: newsDraft.takeaway,
          category: newsDraft.category,
          published_at: newsDraft.publishedAt || null,
          metadata,
        },
        newsDraft.version,
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save news')
      return
    }
    const editorName = result?.editorName
    const updatedDraft = {
      ...newsDraft,
      capturedBy: newsDraft.capturedBy.trim() || 'Team member',
      metadata: {
        ...metadata,
        ...(editorName ? { last_edited_by: editorName } : {}),
      },
      lastEditedBy: editorName || newsDraft.lastEditedBy,
      version: result?.version || newsDraft.version,
    }
    setNews((current) =>
      current.map((item) =>
        item.id === newsDraft.id ? updatedDraft : item,
      ),
    )
    setNewsDraft(null)
    setNotice('News card updated')
  }

  async function reassignNewsCategory(newsId: string, category: NewsCategory) {
    const item = news.find((candidate) => candidate.id === newsId)
    if (!item || item.deletedAt || item.category === category) return
    setNews((current) =>
      current.map((candidate) =>
        candidate.id === newsId ? { ...candidate, category } : candidate,
      ),
    )
    if (!cloudConfigured) return
    try {
      await updateNewsItem(newsId, { category }, item.version)
    } catch (error) {
      setNews((current) =>
        current.map((candidate) =>
          candidate.id === newsId
            ? { ...candidate, category: item.category }
            : candidate,
        ),
      )
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not reassign this signal',
      )
    }
  }

  async function removeNews(id: string) {
    if (!window.confirm('Delete this news card and all of its topic links?')) {
      return
    }
    try {
      await deleteNewsItem(id)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove news')
      return
    }
    setNews((current) => current.filter((item) => item.id !== id))
    setTopics((current) =>
      current.map((topic) => ({
        ...topic,
        supportingNews: topic.supportingNews.filter((newsId) => newsId !== id),
      })),
    )
    setNewsDraft(null)
    setNotice('News card deleted')
  }

  async function saveThesisDraft() {
    if (!thesisDraft || !thesisDraft.title.trim()) return
    if (creatingThesis) {
      let id: string
      try {
        id =
          (await createThesis({
            title: thesisDraft.title.trim(),
            description: thesisDraft.description,
            horizon: thesisDraft.horizon,
          })) || `thesis-${Date.now()}`
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not create Thesis')
        return
      }
      setTheses((current) => [
        ...current,
        { ...thesisDraft, id, title: thesisDraft.title.trim(), version: 1 },
      ])
      setSelectedThesisId(id)
      setNotice('Thesis created')
    } else {
      let version
      try {
        version = await updateThesisItem(
          thesisDraft.id,
          {
            title: thesisDraft.title.trim(),
            description: thesisDraft.description,
            horizon: thesisDraft.horizon,
          },
          thesisDraft.version,
        )
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not save Thesis')
        return
      }
      setTheses((current) =>
        current.map((item) =>
          item.id === thesisDraft.id
            ? { ...thesisDraft, title: thesisDraft.title.trim(), version }
            : item,
        ),
      )
      setNotice('Thesis updated')
    }
    setThesisDraft(null)
    setCreatingThesis(false)
  }

  async function removeThesis(id: string) {
    const thesis = theses.find((item) => item.id === id)
    if (thesis?.topicIds.length) {
      setNotice('Move linked topics out of this Thesis before deleting it')
      return
    }
    if (!window.confirm('Delete this Thesis?')) return
    try {
      await deleteThesisItem(id)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove Thesis')
      return
    }
    setTheses((current) => current.filter((item) => item.id !== id))
    if (selectedThesisId === id) setSelectedThesisId('')
    setThesisDraft(null)
    setCreatingThesis(false)
    setNotice('Thesis deleted')
  }

  function openNewTopic() {
    setCreatingTopic(true)
    setTopicDraft({
      id: '',
      title: '',
      monthKey: '',
      monthLabel: monthName(''),
      category: 'ai_capability',
      status: 'idea',
      threadStatus: 'open',
      kind: 'insight',
      notes: '',
      analysis: { ...emptyTopicAnalysis },
      outputs: [],
      createdAt: new Date().toISOString(),
      displayOrder: 1,
      supportingNews: [],
    })
  }

  async function saveTopicDraft() {
    if (!topicDraft || !topicDraft.title.trim()) return
    if (creatingTopic) {
      let id: string
      try {
        id =
          (await createTopic({
            title: topicDraft.title.trim(),
            notes: topicDraft.notes,
            category: topicDraft.category,
            status: legacyStatusFromThread(
              topicDraft.threadStatus || threadStatusFromLegacy(topicDraft.status),
            ),
            kind: topicDraft.kind,
            threadStatus:
              topicDraft.threadStatus ||
              threadStatusFromLegacy(topicDraft.status),
            monthKey: topicDraft.monthKey,
            thesisId: topicDraft.thesisId,
            analysis: topicDraft.analysis,
            outputs: topicDraft.outputs,
          })) || `topic-${Date.now()}`
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : 'Could not create topic'
        setNotice(
          /null|not-null|scheduled_month/i.test(detail)
            ? 'Topic pool needs the latest database migration. Apply it, then try again.'
            : detail,
        )
        return
      }
      setTopics((current) => [
        ...current,
        { ...topicDraft, id, title: topicDraft.title.trim(), version: 1 },
      ])
      if (topicDraft.thesisId) {
        setTheses((current) =>
          current.map((item) =>
            item.id === topicDraft.thesisId
              ? { ...item, topicIds: [...item.topicIds, id] }
              : item,
          ),
        )
      }
      setNotice('Action Thread created')
      if (pendingThreadNewsId) {
        await moveNewsToTopic(pendingThreadNewsId, id, '')
        setPendingThreadNewsId('')
      }
    } else {
      const previous = topics.find((item) => item.id === topicDraft.id)
      let version
      try {
        version = await updateTopicItem(
          topicDraft.id,
          {
            title: topicDraft.title.trim(),
            notes: topicDraft.notes,
            category: topicDraft.category,
            status: legacyStatusFromThread(
              topicDraft.threadStatus || threadStatusFromLegacy(topicDraft.status),
            ),
            kind: topicDraft.kind,
            thread_status:
              topicDraft.threadStatus ||
              threadStatusFromLegacy(topicDraft.status),
            scheduled_month: topicDraft.monthKey
              ? `${topicDraft.monthKey}-01`
              : null,
            thesis_id: topicDraft.thesisId || null,
            analysis: topicDraft.analysis,
            outputs: topicDraft.outputs,
          },
          topicDraft.version,
        )
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : 'Could not save topic'
        setNotice(
          /null|not-null|scheduled_month/i.test(detail)
            ? 'Topic pool needs the latest database migration. Apply it, then try again.'
            : detail,
        )
        return
      }
      setTopics((current) =>
        current.map((item) =>
          item.id === topicDraft.id
            ? {
                ...topicDraft,
                title: topicDraft.title.trim(),
                monthLabel: monthName(topicDraft.monthKey),
                version,
              }
            : item,
        ),
      )
      setNews((current) =>
        current.map((item) => ({
          ...item,
          topicLinks: item.topicLinks.map((link) =>
            link.topicId === topicDraft.id
              ? {
                  ...link,
                  topicTitle: topicDraft.title.trim(),
                  monthLabel: monthName(topicDraft.monthKey),
                }
              : link,
          ),
        })),
      )
      if (previous?.thesisId !== topicDraft.thesisId) {
        setTheses((current) =>
          current.map((item) => ({
            ...item,
            topicIds:
              item.id === topicDraft.thesisId
                ? [...item.topicIds.filter((id) => id !== topicDraft.id), topicDraft.id]
                : item.topicIds.filter((id) => id !== topicDraft.id),
          })),
        )
      }
      setNotice('Topic updated')
    }
    setTopicDraft(null)
    setCreatingTopic(false)
  }

  async function removeTopic(id: string) {
    if (!window.confirm('Delete this topic? Supporting news will stay in News.')) {
      return
    }
    try {
      await deleteTopicItem(id)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove topic')
      return
    }
    setTopics((current) => current.filter((item) => item.id !== id))
    setTheses((current) =>
      current.map((item) => ({
        ...item,
        topicIds: item.topicIds.filter((topicId) => topicId !== id),
      })),
    )
    setNews((current) =>
      current.map((item) => ({
        ...item,
        topicLinks: item.topicLinks.filter((link) => link.topicId !== id),
      })),
    )
    setTopicDraft(null)
    setNotice('Topic deleted')
  }

  async function addLink() {
    let url = linkUrl.trim()
    if (!url) return
    let hostname = ''
    try {
      url = canonicalizeUrl(url)
      hostname = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      setNotice('Enter a valid http or https URL')
      return
    }
    let persisted
    try {
      persisted = await persistNewsLink({
        url,
        title: linkTitle.trim() || hostname,
        source: hostname,
        contributorName: linkContributor.trim() || undefined,
      })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add link')
      return
    }
    if (persisted?.alreadyExisted) {
      setNotice(
        persisted.removed
          ? 'This link exists in the recycle bin. Ask an admin to restore it.'
          : 'This link already exists. The existing card was preserved.',
      )
      closeAddLink()
      setQuery(linkTitle.trim() || hostname)
      return
    }
    const id = persisted?.id || `news-${Date.now()}`
    const contributorName = persisted?.contributorName || 'Current user'
    const topic = topics.find((candidate) => candidate.id === targetTopicId)
    const item: NewsItem = {
      id,
      url: persisted?.canonicalUrl || url,
      title: linkTitle.trim() || hostname,
      source: hostname,
      summary: 'Pending AI editorial review.',
      takeaway: '',
      industryImportance: '',
      qiraRelevance: '',
      teamSynthesis: '',
      discussionPriorityScore: 0,
      category: 'ecosystem',
      sourceType: 'captured_news',
      capturedAt: new Date().toISOString(),
      capturedBy: contributorName,
      metadata: { contributor_name: contributorName },
      editorialStatus: 'pending',
      voteCount: 0,
      version: 1,
      topicLinks: topic
        ? [
            {
              topicId: topic.id,
              topicTitle: topic.title,
              monthLabel: topic.monthLabel,
            },
          ]
        : [],
    }
    setNews((current) => [item, ...current])
    if (topic) {
      setTopics((current) =>
        current.map((candidate) =>
          candidate.id === topic.id
            ? {
                ...candidate,
                supportingNews: [...candidate.supportingNews, id],
              }
            : candidate,
        ),
      )
      if (cloudConfigured) await persistTopicNews(topic.id, id)
    }
    closeAddLink()
  }

  function renderLinkedSignalRow(
    item: NewsItem,
    topicId: string,
    options: { stopCardClick?: boolean } = {},
  ) {
    return (
      <div className="linked-signal-row" key={item.id}>
        <div>
          <span>{item.title}</span>
          <small>
            {categoryLabels[item.category]} · {formatShortDate(newsDate(item))}
          </small>
        </div>
        <button
          type="button"
          className="unlink-button"
          title="Remove signal from thread"
          aria-label="Remove signal from thread"
          onClick={(event) => {
            if (options.stopCardClick) event.stopPropagation()
            void unlinkSignal(topicId, item.id)
          }}
          hidden={!canEdit}
        >
          ×
        </button>
      </div>
    )
  }

  function renderNoteCard(
    item: NewsItem,
    options: {
      listIndex?: number
      allowReorder?: boolean
      variant?: 'live' | 'candidate'
      dropCategory?: NewsCategory
    } = {},
  ) {
    const takeaway = noteTakeaway(item)
    const isManual = item.sourceType === 'manual_note'
    const variant = options.variant || 'live'
    const teamView = item.teamSynthesis.trim()
    const whyItMatters = firstSentences(item.industryImportance, 1)
    const qiraImplication = firstSentences(item.qiraRelevance, 1)
    const takeawayText =
      variant === 'candidate' ? firstSentences(takeaway, 2) : takeaway
    return (
      <article
        className={`news-card ${variant}-card ${draggedNewsId === item.id ? 'dragging' : ''}`}
        key={item.id}
        draggable
        onDragStart={(event) => {
          setDraggedNewsId(item.id)
          setDraggedNewsSourceTopicId('')
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copyMove'
            event.dataTransfer.setData('application/x-news-id', item.id)
            event.dataTransfer.setData(
              'application/x-news-source-topic-id',
              '',
            )
          }
        }}
        onDragEnd={() => {
          setDraggedNewsId('')
          setDraggedNewsSourceTopicId('')
        }}
        onDragOver={
          options.allowReorder || options.dropCategory
            ? (event) => {
                event.preventDefault()
              }
            : undefined
        }
        onDrop={
          options.allowReorder || options.dropCategory
            ? (event) => {
                event.preventDefault()
                const newsId =
                  event.dataTransfer?.getData('application/x-news-id') ||
                  draggedNewsId
                if (options.allowReorder && newsId && options.listIndex !== undefined) {
                  void reorderDiscussionNotes(newsId, options.listIndex)
                  return
                }
                if (options.dropCategory && newsId) {
                  event.stopPropagation()
                  void reassignNewsCategory(newsId, options.dropCategory)
                  setDraggedNewsId('')
                }
              }
            : undefined
        }
      >
        <div className="news-meta">
          {variant === 'candidate' ? (
            <span className={`chip category category-${item.category}`}>
              {categoryLabels[item.category]}
            </span>
          ) : null}
          <span className="meta-source">
            {isManual ? 'Team note' : item.source}
          </span>
          <span className="meta-time">
            {formatRelativeAge(item.updatedAt || newsDate(item))}
          </span>
          <div className="card-actions">
            {item.deletedAt ? (
              <button
                type="button"
                className="text-action"
                onClick={() => void restoreItem('news_items', item.id)}
              >
                Restore
              </button>
            ) : (
              <div className="overflow-menu">
                <button
                  type="button"
                  className="icon-ellipsis"
                  aria-label="Signal actions"
                  aria-expanded={openNewsMenuId === item.id}
                  onClick={(event) => {
                    event.stopPropagation()
                    setOpenNewsMenuId((current) =>
                      current === item.id ? '' : item.id,
                    )
                  }}
                >
                  •••
                </button>
                {openNewsMenuId === item.id ? (
                  <div className="menu-popover" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenNewsMenuId('')
                        setNewsDraft({ ...item })
                      }}
                    >
                      Edit signal
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="danger-action"
                      onClick={() => {
                        setOpenNewsMenuId('')
                        void removeNews(item.id)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <h2 title={item.title}>
          {item.url && !isManual ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </h2>
        {variant === 'live' || takeawayText ? (
          <div
            className={`ai-takeaway ${takeawayText ? '' : 'pending'}`}
            title={takeawayText || undefined}
          >
            <span className="ai-badge">AI</span>
            <p>{takeawayText || 'Review pending'}</p>
          </div>
        ) : null}
        {variant === 'candidate' && (
          <>
            {whyItMatters ? (
              <div className="intel-block">
                <strong>Why it matters</strong>
                <p>{whyItMatters}</p>
              </div>
            ) : null}
            {qiraImplication ? (
              <div className="intel-block">
                <strong>QIRA implication</strong>
                <p>{qiraImplication}</p>
              </div>
            ) : null}
            {teamView ? (
              <div className="intel-block">
                <strong>Team input</strong>
                <p>{firstSentences(teamView, 1)}</p>
              </div>
            ) : null}
          </>
        )}
        <div className="card-footer">
          <button
            className={`vote-button ${item.votedByMe ? 'voted' : ''}`}
            type="button"
            title="Vote to discuss"
            onClick={() => void voteToDiscuss(item)}
          >
            ↑ {item.voteCount || 0} Discuss
          </button>
          <button
            className="text-action idea-button"
            type="button"
            onClick={() => {
              setIdeaNewsId(item.id)
              setIdeaText('')
            }}
          >
            + Add idea
          </button>
        </div>
      </article>
    )
  }

  function renderTopicCard(topic: Topic) {
    const linked = topic.supportingNews
      .map((id) => news.find((item) => item.id === id && !item.deletedAt))
      .filter((item): item is NewsItem => Boolean(item))
    const status = topic.threadStatus || threadStatusFromLegacy(topic.status)
    const framing = firstSentences(
      topic.analysis.currentView || topic.analysis.keyQuestion || topic.notes,
      1,
    )
    return (
      <article
        className={`topic-card kind-${topic.kind} ${
          draggedNewsId ? 'accepting-news' : ''
        }`}
        key={topic.id}
        onClick={() => {
          if (!canEdit) return
          setCreatingTopic(false)
          setTopicDraft({ ...topic })
        }}
        onDragOver={(event) => {
          if (!draggedNewsId) return
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(event) => {
          const newsId =
            event.dataTransfer.getData('application/x-news-id') ||
            draggedNewsId
          const sourceTopicId =
            event.dataTransfer.getData('application/x-news-source-topic-id') ||
            draggedNewsSourceTopicId
          if (!newsId) return
          event.preventDefault()
          event.stopPropagation()
          void moveNewsToTopic(newsId, topic.id, sourceTopicId)
          setDraggedNewsId('')
          setDraggedNewsSourceTopicId('')
        }}
      >
        <div className="topic-card-head">
          <span className={`chip topic-kind kind-${topic.kind}`}>
            {topicKindLabels[topic.kind] || topic.kind}
          </span>
          <span className={`chip thread-status status-${status}`}>
            {threadStatusLabels[status]}
          </span>
        </div>
        <h3>{topic.title}</h3>
        <p className="thread-created">
          Created {formatShortDate(topic.createdAt || topic.updatedAt || new Date().toISOString())}
        </p>
        {framing ? <p className="thread-framing">{framing}</p> : null}
        <div className="linked-signals">
          <strong>
            {linked.length} linked signal{linked.length === 1 ? '' : 's'}
          </strong>
          {linked.length === 0 ? (
            <p className="linked-empty">No linked signals yet.</p>
          ) : (
            linked.map((item) =>
              renderLinkedSignalRow(item, topic.id, { stopCardClick: true }),
            )
          )}
        </div>
      </article>
    )
  }

  return (
    <div
      className={`app-shell focus-${focus} page-${workspacePage} ${
        headerHidden ? 'banner-hidden' : ''
      }`}
    >
      <aside className="qira-sidebar">
        <p className="brand-title">
          Qira Strategic
          <br />
          Market Intelligence
        </p>
        <nav className="workspace-nav" aria-label="Workspace">
          <button
            className={workspacePage === 'signals' ? 'active' : ''}
            type="button"
            onClick={() => setWorkspacePage('signals')}
          >
            Live Signals
          </button>
          <button
            className={
              workspacePage === 'synthesis' || workspacePage === 'threads'
                ? 'active'
                : ''
            }
            type="button"
            onClick={() => setWorkspacePage('synthesis')}
          >
            Intelligence Synthesis
          </button>
        </nav>
        <div className="sidebar-user">
          <div className="sync-status">
            <span className={`status-dot ${syncState}`} />
            {cloudConfigured
              ? syncState === 'synced'
                ? 'Synced'
                : syncState === 'error'
                  ? 'Sync interrupted'
                  : 'Connecting'
              : 'Demo workspace'}
          </div>
          {canAdmin && cloudConfigured && (
            <>
              <button
                className="recycle-button"
                type="button"
                onClick={() => void openTeamManagement()}
              >
                Team
              </button>
              <button
                className="recycle-button"
                type="button"
                onClick={() => setShowRecycleBin(true)}
              >
                Recycle Bin
              </button>
            </>
          )}
          <button
            className="avatar-button"
            type="button"
            aria-label={`Sign out ${identity?.displayName || ''}`}
            title={`${identity?.displayName || 'Demo user'}${identity ? ` · ${identity.role}` : ''} · click to sign out`}
            onClick={() => void signOut()}
          >
            {(identity?.displayName || 'DU')
              .split(/\s+/)
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </button>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="utility-bar">
          <label className="search-field">
            <span>Search news</span>
            <svg
              className="search-icon"
              viewBox="0 0 20 20"
              width="16"
              height="16"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M8.5 3a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65-1.06 1.06-3.65-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
              />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search news, sources, or takeaways..."
            />
          </label>
          {(workspacePage === 'signals' || workspacePage === 'synthesis') && (
            <div className="time-filter" role="group" aria-label="Time range">
              {(
                [
                  ['week', 'Past week'],
                  ['fortnight', 'Past 2 weeks'],
                  ['month', 'Month'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={timeRange === value ? 'active' : ''}
                  aria-pressed={timeRange === value}
                  onClick={() => setTimeRange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="account-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setShowAddLink(true)}
            >
              + Add News
            </button>
          </div>
        </header>

      {notice && (
        <button
          className="notice"
          type="button"
          onClick={() => setNotice('')}
        >
          {notice} <span>×</span>
        </button>
      )}

      <main
        className={`dashboard ${
          workspacePage === 'signals' ? 'signals-page' : 'synthesis-page'
        }`}
      >
        {workspacePage === 'signals' && (
          <section className="news-pane" aria-label="Live Signals">
            <div className="pane-heading">
              <div>
                <span className="eyebrow">What is happening now</span>
                <h1>Live Signals</h1>
              </div>
            </div>
            <div className="signals-grid">
              {liveSignalCategories.map((category) => {
                const items = visibleNews.filter(
                  (item) => !item.deletedAt && item.category === category,
                )
                const preview = items.slice(0, 3)
                const emptySlots = Math.max(0, 3 - preview.length)
                return (
                  <section
                    className={`category-panel cat-${category} ${
                      draggedNewsId ? 'accepting-signal' : ''
                    }`}
                    key={category}
        onDragOver={(event) => {
          if (!draggedNewsId) return
          event.preventDefault()
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
        }}
                    onDrop={(event) => {
                      const newsId =
                        event.dataTransfer?.getData('application/x-news-id') ||
                        draggedNewsId
                      if (!newsId) return
                      event.preventDefault()
                      void reassignNewsCategory(newsId, category)
                      setDraggedNewsId('')
                    }}
                  >
                    <header>
                      <h2>
                        <span className="cat-dot" aria-hidden="true" />
                        {categoryLabels[category]}
                      </h2>
                      <span className="count-badge">{items.length}</span>
                    </header>
                    <div className="news-list">
                      {preview.map((item) =>
                        renderNoteCard(item, {
                          variant: 'live',
                          dropCategory: category,
                        }),
                      )}
                      {Array.from({ length: emptySlots }, (_, index) => (
                        <div
                          className="live-card live-card-slot"
                          key={`${category}-slot-${index}`}
                        />
                      ))}
                    </div>
                    {items.length > 0 ? (
                      <button
                        type="button"
                        className="view-all-link"
                        onClick={() => setCategoryDrawer(category)}
                      >
                        View all {items.length} →
                      </button>
                    ) : (
                      <span className="view-all-link muted">No signals yet</span>
                    )}
                  </section>
                )
              })}
            </div>
          </section>
        )}

        {(workspacePage === 'synthesis' || workspacePage === 'threads') && (
          <>
            {workspacePage === 'synthesis' && (
              <section
                className="news-pane"
                aria-label="Discussion Candidates"
              >
                <div className="pane-heading">
                  <div>
                    <span className="eyebrow">What actually matters</span>
                    <h1>Discussion Candidates</h1>
                  </div>
                </div>
                <div className="news-list discussion-list">
                  {discussionCandidates.map((item) =>
                    renderNoteCard(item, { variant: 'candidate' }),
                  )}
                  {discussionCandidates.length === 0 && (
                    <div className="month-empty">
                      Vote on Live Signals or wait for AI Daily Review to promote candidates.
                    </div>
                  )}
                </div>
              </section>
            )}
            <section
              className="topic-pane"
              aria-label="Action Threads"
            >
              <div className="pane-heading">
                <div>
                  <span className="eyebrow">What we do with it</span>
                  <h1>Action Threads</h1>
                </div>
                <div className="heading-actions">
                  {workspacePage === 'synthesis' && (
                    <button
                      className="icon-button expand-threads"
                      type="button"
                      title="Open Action Threads dashboard"
                      aria-label="Open Action Threads dashboard"
                      onClick={() => setWorkspacePage('threads')}
                    >
                      ↗
                    </button>
                  )}
                  {workspacePage === 'threads' && (
                    <button
                      className="text-action breadcrumb-link"
                      type="button"
                      onClick={() => setWorkspacePage('synthesis')}
                    >
                      ← Intelligence Synthesis
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    type="button"
                    title="Create Action Thread"
                    onClick={() => openCreateThread()}
                    hidden={!canEdit}
                  >
                    + New
                  </button>
                </div>
              </div>
              <div className="topic-scope-toggle" aria-label="Destination">
                {(['all', 'pov', 'insight', 'strategy', 'roadmap', 'poc'] as TopicKindFilter[]).map(
                  (kind) => (
                    <button
                      key={kind}
                      className={topicKindFilter === kind ? 'active' : ''}
                      type="button"
                      onClick={() => setTopicKindFilter(kind)}
                    >
                      {kind === 'all' ? 'All' : topicKindLabels[kind]}
                    </button>
                  ),
                )}
              </div>
              {workspacePage === 'threads' && (
                <div className="thread-toolbar">
                  <label className="toolbar-field">
                    <span>Status</span>
                    <select
                      aria-label="Status"
                      value={threadStatusFilter}
                      onChange={(event) =>
                        setThreadStatusFilter(
                          event.target.value as ThreadStatusFilter,
                        )
                      }
                    >
                      <option value="all">All statuses</option>
                      {Object.entries(threadStatusLabels).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="toolbar-field">
                    <span>Created</span>
                    <select
                      aria-label="Created"
                      value={threadCreatedPreset}
                      onChange={(event) => {
                        const preset = event.target.value
                        setThreadCreatedPreset(preset)
                        if (preset === 'any') {
                          setThreadFrom('')
                          setThreadTo('')
                          return
                        }
                        const days = Number(preset)
                        const from = new Date()
                        from.setUTCDate(from.getUTCDate() - days)
                        setThreadFrom(from.toISOString().slice(0, 10))
                        setThreadTo('')
                      }}
                    >
                      <option value="any">Any time</option>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                    </select>
                  </label>
                </div>
              )}
              {workspacePage === 'synthesis' && (
              <div
                className={`drop-create ${draggedNewsId ? 'hot' : ''}`}
                onDragOver={(event) => {
                  if (!draggedNewsId) return
                  event.preventDefault()
                }}
                onDrop={(event) => {
                  const newsId =
                    event.dataTransfer.getData('application/x-news-id') ||
                    draggedNewsId
                  if (!newsId) return
                  event.preventDefault()
                  openCreateThread(newsId)
                  setDraggedNewsId('')
                }}
              >
                + Drop a signal to create a thread
              </div>
              )}
              <div className="topic-list kind-pipeline">
                {visibleTopics.map((topic) => renderTopicCard(topic))}
                {visibleTopics.length === 0 && (
                  <div className="month-empty">
                    No Action Threads in this filter yet.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      </div>


      {categoryDrawer && (
        <>
          <button
            type="button"
            className="drawer-backdrop"
            aria-label="Close category"
            onClick={() => setCategoryDrawer(null)}
          />
          <aside
            className={`category-drawer cat-${categoryDrawer}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-drawer-title"
          >
            <header>
              <div>
                <h2 id="category-drawer-title">
                  {categoryLabels[categoryDrawer]}
                </h2>
                <p>
                  {
                    visibleNews.filter(
                      (item) =>
                        !item.deletedAt && item.category === categoryDrawer,
                    ).length
                  }{' '}
                  signals
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setCategoryDrawer(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="drawer-list">
              {visibleNews
                .filter(
                  (item) =>
                    !item.deletedAt && item.category === categoryDrawer,
                )
                .map((item) =>
                  renderNoteCard(item, {
                    variant: 'live',
                    dropCategory: categoryDrawer,
                  }),
                )}
            </div>
          </aside>
        </>
      )}

      {newsDraft && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="link-modal editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-news-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">News management</span>
                <h2 id="edit-news-title">Edit news card</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setNewsDraft(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <label>
              Title
              <input
                value={newsDraft.title}
                onChange={(event) =>
                  setNewsDraft({ ...newsDraft, title: event.target.value })
                }
              />
            </label>
            <label>
              Category
              <select
                value={newsDraft.category}
                onChange={(event) =>
                  setNewsDraft({
                    ...newsDraft,
                    category: event.target.value as NewsCategory,
                  })
                }
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Contributor
              <input
                value={newsDraft.capturedBy}
                onChange={(event) =>
                  setNewsDraft({
                    ...newsDraft,
                    capturedBy: event.target.value,
                  })
                }
                placeholder="Name of the person who shared this"
              />
              {newsDraft.lastEditedBy && (
                <small>Last edited by {newsDraft.lastEditedBy}</small>
              )}
            </label>
            <label>
              Publication date
              <input
                type="date"
                value={newsDraft.publishedAt?.slice(0, 10) || ''}
                onChange={(event) =>
                  setNewsDraft({
                    ...newsDraft,
                    publishedAt: event.target.value || undefined,
                  })
                }
              />
              <small>
                Use the article&apos;s publication date. Leave blank to show
                the date it was added (
                {new Intl.DateTimeFormat('en', {
                  dateStyle: 'medium',
                  timeZone: 'UTC',
                }).format(new Date(newsDraft.capturedAt))}
                ).
              </small>
            </label>
            <label>
              Summary
              <textarea
                rows={5}
                value={newsDraft.summary}
                onChange={(event) =>
                  setNewsDraft({ ...newsDraft, summary: event.target.value })
                }
              />
            </label>
            <label>
              Takeaway
              <textarea
                rows={3}
                value={newsDraft.takeaway}
                onChange={(event) =>
                  setNewsDraft({ ...newsDraft, takeaway: event.target.value })
                }
                placeholder="One sentence for weekly discussion"
              />
            </label>
            <NewsAnalysis metadata={newsDraft.metadata} />
            <ActivityHistory events={activity} />
            <label className="archive-control">
              <input
                type="checkbox"
                checked={Boolean(newsDraft.archivedAt)}
                disabled={!canEdit}
                onChange={(event) =>
                  setNewsDraft({
                    ...newsDraft,
                    archivedAt: event.target.checked
                      ? new Date().toISOString()
                      : undefined,
                  })
                }
              />
              <span>
                <strong>Read and archive</strong>
                <small>
                  Remove this item from the default Undiscussed review queue.
                </small>
              </span>
            </label>
            <div className="modal-actions split-actions">
              <button
                className="danger-button"
                type="button"
                onClick={() => void removeNews(newsDraft.id)}
                hidden={!canAdmin}
              >
                Remove news
              </button>
              <div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setNewsDraft(null)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void saveNewsDraft()}
                >
                  Save changes
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {thesisDraft && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="link-modal editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-thesis-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Long-range portfolio</span>
                <h2 id="edit-thesis-title">
                  {creatingThesis ? 'Create Thesis' : 'Edit Thesis'}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => {
                  setThesisDraft(null)
                  setCreatingThesis(false)
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <label>
              Thesis title
              <input
                value={thesisDraft.title}
                onChange={(event) =>
                  setThesisDraft({
                    ...thesisDraft,
                    title: event.target.value,
                  })
                }
                placeholder="A durable strategic hypothesis"
                autoFocus
              />
            </label>
            <label>
              Horizon
              <input
                value={thesisDraft.horizon}
                onChange={(event) =>
                  setThesisDraft({
                    ...thesisDraft,
                    horizon: event.target.value,
                  })
                }
                placeholder="12–24 months"
              />
            </label>
            <label>
              Description
              <textarea
                rows={6}
                value={thesisDraft.description}
                onChange={(event) =>
                  setThesisDraft({
                    ...thesisDraft,
                    description: event.target.value,
                  })
                }
                placeholder="What are we testing across multiple months?"
              />
            </label>
            <p className="modal-note">
              Link Monthly Topics to this Thesis from each Topic editor. When
              selected, the portfolio filters the timeline to show continuity.
            </p>
            {!creatingThesis && <ActivityHistory events={activity} />}
            <div className="modal-actions split-actions">
              {!creatingThesis ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void removeThesis(thesisDraft.id)}
                  hidden={!canAdmin}
                >
                  Remove Thesis
                </button>
              ) : (
                <span />
              )}
              <div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setThesisDraft(null)
                    setCreatingThesis(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void saveThesisDraft()}
                >
                  {creatingThesis ? 'Create Thesis' : 'Save changes'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {ideaNewsId && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setIdeaNewsId('')
            setIdeaText('')
          }}
        >
          <form
            className="idea-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-idea-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void submitIdea(ideaNewsId)
            }}
          >
            <div className="modal-heading">
              <h2 id="add-idea-title">Add an idea</h2>
              <button
                className="icon-button"
                type="button"
                onClick={() => {
                  setIdeaNewsId('')
                  setIdeaText('')
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <label>
              <span className="sr-only">Idea</span>
              <textarea
                rows={4}
                value={ideaText}
                onChange={(event) => setIdeaText(event.target.value)}
                placeholder="What should AI Daily Review notice about this signal?"
                autoFocus
              />
            </label>
            <div className="modal-actions split-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={startVoiceIdea}
              >
                {ideaListening ? 'Listening…' : '🎙 Voice'}
              </button>
              <button className="primary-button" type="submit">
                Submit
              </button>
            </div>
          </form>
        </div>
      )}

      {topicDraft && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="link-modal editor-modal thread-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-topic-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Action Thread</span>
                <h2 id="edit-topic-title">
                  {creatingTopic ? 'New Action Thread' : 'Edit Action Thread'}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => {
                  setTopicDraft(null)
                  setCreatingTopic(false)
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <section className="modal-section">
                <h3>Thread basics</h3>
                <label>
                  Thread title
                  <input
                    value={topicDraft.title}
                    onChange={(event) =>
                      setTopicDraft({ ...topicDraft, title: event.target.value })
                    }
                    placeholder="What decision or direction does this thread hold?"
                    autoFocus
                  />
                </label>
                <div className="form-grid two-col">
                  <label>
                    Destination
                    <select
                      value={topicDraft.kind}
                      onChange={(event) =>
                        setTopicDraft({
                          ...topicDraft,
                          kind: event.target.value as TopicKind,
                        })
                      }
                    >
                      {Object.entries(topicKindLabels).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={
                        topicDraft.threadStatus ||
                        threadStatusFromLegacy(topicDraft.status)
                      }
                      onChange={(event) => {
                        const threadStatus = event.target.value as ThreadStatus
                        setTopicDraft({
                          ...topicDraft,
                          threadStatus,
                          status: legacyStatusFromThread(threadStatus),
                        })
                      }}
                    >
                      {Object.entries(threadStatusLabels).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <section className="modal-section">
                <h3>Linked signals</h3>
                <div className="linked-signals modal-linked">
                  {topicDraft.supportingNews
                    .map((newsId) => news.find((item) => item.id === newsId))
                    .filter(
                      (item): item is NewsItem =>
                        item != null && !item.deletedAt,
                    )
                    .map((item) =>
                      renderLinkedSignalRow(item, topicDraft.id),
                    )}
                  {topicDraft.supportingNews.length === 0 ? (
                    <p className="linked-empty">No linked signals yet.</p>
                  ) : null}
                </div>
              </section>
              <section className="modal-section">
                <h3>Intelligence framing</h3>
                <label>
                  Key question
                  <textarea
                    rows={3}
                    value={topicDraft.analysis.keyQuestion}
                    onChange={(event) =>
                      setTopicDraft({
                        ...topicDraft,
                        analysis: {
                          ...topicDraft.analysis,
                          keyQuestion: event.target.value,
                        },
                      })
                    }
                    placeholder="What strategic question are we trying to answer?"
                  />
                </label>
                <label>
                  What we observed
                  <textarea
                    rows={3}
                    value={topicDraft.analysis.observed}
                    onChange={(event) =>
                      setTopicDraft({
                        ...topicDraft,
                        analysis: {
                          ...topicDraft.analysis,
                          observed: event.target.value,
                        },
                      })
                    }
                    placeholder="What does the linked evidence currently point to?"
                  />
                </label>
                <label>
                  Current POV / implication
                  <textarea
                    rows={3}
                    value={topicDraft.analysis.currentView}
                    onChange={(event) =>
                      setTopicDraft({
                        ...topicDraft,
                        analysis: {
                          ...topicDraft.analysis,
                          currentView: event.target.value,
                        },
                      })
                    }
                    placeholder="What is the team’s current judgment or direction?"
                  />
                </label>
              </section>
              {!creatingTopic && <ActivityHistory events={activity} />}
            </div>
            <div className="modal-actions split-actions sticky-footer">
              {!creatingTopic ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void removeTopic(topicDraft.id)}
                  hidden={!canAdmin}
                >
                  Delete thread
                </button>
              ) : (
                <span />
              )}
              <div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setTopicDraft(null)
                    setCreatingTopic(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void saveTopicDraft()}
                >
                  {creatingTopic ? 'Create Action Thread' : 'Save changes'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {showTeam && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="link-modal editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-management-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Admin access</span>
                <h2 id="team-management-title">Team roles</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setShowTeam(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="modal-note">
              Create or invite authentication users in Supabase first, then add
              their user ID to <code>team_members</code>. Roles can be maintained
              here after membership is provisioned.
            </p>
            <div className="team-list">
              {teamMembers.map((member) => (
                <div key={member.userId}>
                  <span>
                    <strong>{member.displayName}</strong>
                    <small>{member.email}</small>
                  </span>
                  <select
                    aria-label={`Role for ${member.displayName}`}
                    value={member.role}
                    onChange={(event) =>
                      void changeMemberRole(
                        member,
                        event.target.value as TeamMemberSummary['role'],
                      )
                    }
                  >
                    <option value="member">Member</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {showRecycleBin && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="link-modal editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recycle-bin-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Admin recovery</span>
                <h2 id="recycle-bin-title">Recycle bin</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setShowRecycleBin(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="recycle-list">
              {[
                ...removedItems.news.map((item) => ({
                  table: 'news_items' as const,
                  id: item.id,
                  kind: 'News',
                  title: item.title,
                })),
                ...removedItems.topics.map((item) => ({
                  table: 'topics' as const,
                  id: item.id,
                  kind: 'Topic',
                  title: item.title,
                })),
                ...removedItems.theses.map((item) => ({
                  table: 'theses' as const,
                  id: item.id,
                  kind: 'Thesis',
                  title: item.title,
                })),
              ].map((item) => (
                <div key={`${item.table}-${item.id}`}>
                  <span>
                    <small>{item.kind}</small>
                    <strong>{item.title}</strong>
                  </span>
                  <div className="recycle-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void restoreItem(item.table, item.id)}
                    >
                      Restore
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() =>
                        void purgeItem(item.table, item.id, item.title)
                      }
                    >
                      Delete forever
                    </button>
                  </div>
                </div>
              ))}
              {removedItems.news.length +
                removedItems.topics.length +
                removedItems.theses.length ===
                0 && <p className="modal-note">No removed items.</p>}
            </div>
            {removedItems.news.length +
              removedItems.topics.length +
              removedItems.theses.length >
              0 && (
              <div className="modal-actions split-actions">
                <span className="modal-note">
                  Permanent delete cannot be undone.
                </span>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void emptyRecycleBin()}
                >
                  Empty recycle bin
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {showAddNote && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowAddNote(false)}
        >
          <section
            className="link-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-note-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Weekly discussion</span>
                <h2 id="add-note-title">Add Note</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setShowAddNote(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <label>
              Title
              <input
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                placeholder="Should AI entry points become a formal experience layer?"
                autoFocus
              />
            </label>
            <label>
              Note
              <textarea
                rows={5}
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                placeholder="Recent browser, voice and wearable moves suggest invocation may become a strategic layer."
              />
            </label>
            <label>
              Takeaway <span>optional</span>
              <input
                value={noteTakeawayDraft}
                onChange={(event) => setNoteTakeawayDraft(event.target.value)}
              />
            </label>
            <label>
              Category
              <select
                value={noteCategory}
                onChange={(event) =>
                  setNoteCategory(event.target.value as NewsCategory)
                }
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p className="modal-note">
              Manual notes share the same dataset as captured news. They can be
              voted, reordered, and dragged into Topics.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAddNote(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => void addManualNote()}
              >
                Add note
              </button>
            </div>
          </section>
        </div>
      )}

      {showAddLink && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={closeAddLink}
        >
          <section
            className="link-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-link-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Capture a signal</span>
                <h2 id="add-link-title">Add News</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={closeAddLink}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <label>
              URL
              <input
                type="url"
                required
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://"
                autoFocus
              />
            </label>
            <label>
              Title <span>optional</span>
              <input
                value={linkTitle}
                onChange={(event) => setLinkTitle(event.target.value)}
                placeholder="Use the page title when available"
              />
            </label>
            <label>
              Contributor <span>optional</span>
              <input
                value={linkContributor}
                onChange={(event) => setLinkContributor(event.target.value)}
                placeholder="Defaults to your signed-in name"
              />
            </label>
            <label>
              Add directly to topic <span>optional</span>
              <select
                value={targetTopicId}
                onChange={(event) => setTargetTopicId(event.target.value)}
              >
                <option value="">News inbox only</option>
                {topics.map((topic) => (
                  <option value={topic.id} key={topic.id}>
                    {topic.monthLabel} · {topic.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="modal-note">
              The link enters News immediately. AI extraction and editorial
              review can enrich it asynchronously.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={closeAddLink}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => void addLink()}
              >
                Add to workspace
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
