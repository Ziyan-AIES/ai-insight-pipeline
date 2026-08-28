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
  loadEditorialHealth,
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
  topicOutputKinds,
} from './labels'
import { discussionPriorityScore, formatRelativeAge } from './intelligence'
import type {
  FocusMode,
  NewsCategory,
  NewsItem,
  Thesis,
  Topic,
  TopicKind,
  ThreadStatus,
  EditorialReadout,
  EditorialHealth,
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
const workspacePageKey = 'signal-intelligence:workspace-page'

function loadWorkspacePage(): WorkspacePage {
  try {
    const stored = window.localStorage.getItem(workspacePageKey)
    if (stored === 'synthesis' || stored === 'weekly') return 'synthesis'
    if (stored === 'threads') return 'threads'
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

function isoWeekKey(value: string) {
  const date = new Date(value)
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  )
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function newsDate(item: NewsItem) {
  return item.publishedAt || item.capturedAt
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
  const [readout, setReadout] = useState<EditorialReadout | null>(null)
  const [editorialHealth, setEditorialHealth] =
    useState<EditorialHealth | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [syncState, setSyncState] = useState<'connecting' | 'synced' | 'error'>(
    cloudConfigured ? 'connecting' : 'synced',
  )
  const [focus, setFocus] = useState<FocusMode>(() =>
    loadWorkspacePage() === 'signals' ? 'news' : 'split',
  )
  const [workspacePage, setWorkspacePage] = useState<WorkspacePage>(
    loadWorkspacePage,
  )
  const [period] = useState('all')
  const [newsScope] = useState<NewsScope>('all')
  const [topicKindFilter, setTopicKindFilter] = useState<TopicKindFilter>('all')
  const [threadStatusFilter, setThreadStatusFilter] =
    useState<ThreadStatusFilter>('all')
  const [threadFrom, setThreadFrom] = useState('')
  const [threadTo, setThreadTo] = useState('')
  const [pendingThreadNewsId, setPendingThreadNewsId] = useState('')
  const [addSignalTopicId, setAddSignalTopicId] = useState('')
  const [addSignalQuery, setAddSignalQuery] = useState('')
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
      setReadout(workspace.readout)
      if (canEdit) {
        setEditorialHealth(await loadEditorialHealth().catch(() => null))
      }
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
  }, [canAdmin, canEdit])

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
    try {
      window.localStorage.setItem(workspacePageKey, workspacePage)
    } catch {
      // Preference persistence is best-effort.
    }
    if (workspacePage === 'signals') {
      setFocus('news')
      return
    }
    setFocus('split')
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
        const matchesPeriod =
          period === 'all' ||
          (period.startsWith('month:') &&
            newsDate(item).slice(0, 7) === period.slice(6)) ||
          (period.startsWith('week:') &&
            isoWeekKey(newsDate(item)) === period.slice(5))
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
  }, [news, newsScope, period, query])

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

  async function unlinkNews(topicId: string, newsId: string) {
    try {
      await unlinkTopicNews(topicId, newsId)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not unlink news')
      return
    }
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
              topicLinks: item.topicLinks.filter(
                (link) => link.topicId !== topicId,
              ),
            }
          : item,
      ),
    )
    setNotice('News returned to the News stream')
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

  function renderNoteCard(
    item: NewsItem,
    options: {
      listIndex?: number
      allowReorder?: boolean
      variant?: 'live' | 'candidate'
    } = {},
  ) {
    const takeaway = noteTakeaway(item)
    const isManual = item.sourceType === 'manual_note'
    const variant = options.variant || 'live'
    const teamView = item.teamSynthesis.trim()
    return (
      <article
        className={`news-card ${variant}-card ${draggedNewsId === item.id ? 'dragging' : ''}`}
        key={item.id}
        draggable
        onDragStart={(event) => {
          setDraggedNewsId(item.id)
          setDraggedNewsSourceTopicId('')
          event.dataTransfer.effectAllowed = 'copyMove'
          event.dataTransfer.setData('application/x-news-id', item.id)
          event.dataTransfer.setData(
            'application/x-news-source-topic-id',
            '',
          )
        }}
        onDragEnd={() => {
          setDraggedNewsId('')
          setDraggedNewsSourceTopicId('')
        }}
        onDragOver={
          options.allowReorder
            ? (event) => {
                event.preventDefault()
              }
            : undefined
        }
        onDrop={
          options.allowReorder
            ? (event) => {
                event.preventDefault()
                const newsId =
                  event.dataTransfer.getData('application/x-news-id') ||
                  draggedNewsId
                if (newsId && options.listIndex !== undefined) {
                  void reorderDiscussionNotes(newsId, options.listIndex)
                }
              }
            : undefined
        }
      >
        <div className="news-meta">
          {variant === 'candidate' ? (
            <span className={`category category-${item.category}`}>
              {categoryLabels[item.category]}
            </span>
          ) : null}
          <span>{isManual ? 'Team note' : item.source}</span>
          <span>
            {formatRelativeAge(item.updatedAt || newsDate(item))}
          </span>
          <div className="card-actions">
            {item.deletedAt ? (
              <button
                type="button"
                onClick={() => void restoreItem('news_items', item.id)}
              >
                Restore
              </button>
            ) : (
              <button type="button" onClick={() => setNewsDraft({ ...item })}>
                Edit
              </button>
            )}
          </div>
        </div>
        <h2>
          {item.url && !isManual ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </h2>
        {takeaway ? <p className="signal-takeaway">{takeaway}</p> : null}
        {variant === 'candidate' && (
          <>
            {item.industryImportance ? (
              <div className="why-it-matters">
                <strong>Industry importance</strong>
                <p>{item.industryImportance}</p>
              </div>
            ) : null}
            {item.qiraRelevance ? (
              <div className="why-it-matters">
                <strong>Why it matters to QIRA</strong>
                <p>{item.qiraRelevance}</p>
              </div>
            ) : null}
            {teamView ? (
              <div className="why-it-matters">
                <strong>Team synthesis</strong>
                <p>{teamView}</p>
              </div>
            ) : null}
          </>
        )}
        <div className="card-footer">
          <button
            className={`vote-button ${item.votedByMe ? 'voted' : ''}`}
            type="button"
            onClick={() => void voteToDiscuss(item)}
          >
            ↑ {item.voteCount || 0} Vote to Discuss
          </button>
          <button
            className="secondary-button idea-button"
            type="button"
            onClick={() => {
              setIdeaNewsId(item.id)
              setNotice('Idea will be linked to this signal. Synthesis stays anonymous.')
            }}
          >
            + Add Idea
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
    return (
      <article
        className={`topic-card kind-${topic.kind} ${
          draggedNewsId ? 'accepting-news' : ''
        }`}
        key={topic.id}
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
          <span className={`topic-kind kind-${topic.kind}`}>
            {topicKindLabels[topic.kind] || topic.kind}
          </span>
          <span className={`thread-status status-${status}`}>
            {threadStatusLabels[status]}
          </span>
        </div>
        <h3>{topic.title}</h3>
        <small>Created {formatShortDate(topic.createdAt || topic.updatedAt || new Date().toISOString())}</small>
        {topic.notes ? <p>{topic.notes}</p> : null}
        <div className="linked-signals">
          <strong>Linked signals</strong>
          {linked.length === 0 ? (
            <p className="linked-empty">No linked signals yet.</p>
          ) : (
            linked.map((item) => (
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
                  onClick={(event) => {
                    event.stopPropagation()
                    void unlinkSignal(topic.id, item.id)
                  }}
                  hidden={!canEdit}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
        <div className="card-footer">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setAddSignalTopicId(topic.id)
              setAddSignalQuery('')
            }}
            hidden={!canEdit}
          >
            + Add Signal
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setCreatingTopic(false)
              setTopicDraft({ ...topic })
            }}
            hidden={!canEdit}
          >
            Open
          </button>
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
        <div className="brand">
          <span className="brand-mark">QIRA</span>
          <div>
            <strong>AI Signals</strong>
            <span>What changed → what matters</span>
          </div>
        </div>
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
                Recycle bin
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
            <span>Search News</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Headline, source, takeaway, category, Action Thread"
            />
          </label>
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
                <span className="eyebrow">What is happening now?</span>
                <h1>Live Signals</h1>
              </div>
            </div>
            {readout ? (
              <div className="daily-review">
                <strong>AI Daily Review</strong>
                <p>{readout.lede}</p>
                {editorialHealth ? (
                  <small>Editorial: {editorialHealth.status}</small>
                ) : null}
              </div>
            ) : null}
            <div className="signals-grid">
              {liveSignalCategories.map((category) => {
                const items = visibleNews.filter(
                  (item) => !item.deletedAt && item.category === category,
                )
                return (
                  <section className="category-panel" key={category}>
                    <header>
                      <h2>
                        {categoryLabels[category]}
                        <span>{items.length}</span>
                      </h2>
                      <span>View All &gt;</span>
                    </header>
                    <div className="news-list">
                      {items.length > 0
                        ? items.map((item) =>
                            renderNoteCard(item, { variant: 'live' }),
                          )
                        : (
                          <div className="month-empty">No signals yet.</div>
                        )}
                    </div>
                  </section>
                )
              })}
            </div>
            <form
              className="idea-composer"
              onSubmit={(event) => {
                event.preventDefault()
                void submitIdea()
              }}
            >
              <input
                value={ideaText}
                onChange={(event) => setIdeaText(event.target.value)}
                placeholder={
                  ideaNewsId
                    ? 'Share an idea for this signal. AI Daily Review stays anonymous.'
                    : 'What are you noticing? Share an idea for AI Daily Review…'
                }
                aria-label="Team idea"
              />
              <button
                className="secondary-button"
                type="button"
                onClick={startVoiceIdea}
              >
                {ideaListening ? 'Listening…' : 'Voice'}
              </button>
              <button className="primary-button" type="submit">
                Submit
              </button>
            </form>
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
                    <span className="eyebrow">What actually matters?</span>
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
                      className="secondary-button"
                      type="button"
                      onClick={() => setWorkspacePage('threads')}
                    >
                      View All
                    </button>
                  )}
                  {workspacePage === 'threads' && (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setWorkspacePage('synthesis')}
                    >
                      Back
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => openCreateThread()}
                    hidden={!canEdit}
                  >
                    + New Action Thread
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
                <div className="thread-filters">
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
                  <label>
                    Created from
                    <input
                      type="date"
                      value={threadFrom}
                      onChange={(event) => setThreadFrom(event.target.value)}
                    />
                  </label>
                  <label>
                    Created to
                    <input
                      type="date"
                      value={threadTo}
                      onChange={(event) => setThreadTo(event.target.value)}
                    />
                  </label>
                </div>
              )}
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
                Drop signal here to create a new Action Thread
              </div>
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


      {addSignalTopicId && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="link-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-signal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Action Thread</span>
                <h2 id="add-signal-title">Add Signal</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setAddSignalTopicId('')}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <label>
              Search existing signals
              <input
                value={addSignalQuery}
                onChange={(event) => setAddSignalQuery(event.target.value)}
                placeholder="Headline or source"
                autoFocus
              />
            </label>
            <div className="news-list">
              {news
                .filter((item) => !item.deletedAt)
                .filter((item) => {
                  const needle = addSignalQuery.trim().toLowerCase()
                  return (
                    !needle ||
                    `${item.title} ${item.source}`.toLowerCase().includes(needle)
                  )
                })
                .slice(0, 12)
                .map((item) => (
                  <button
                    type="button"
                    className="signal-pick"
                    key={item.id}
                    onClick={() => {
                      void moveNewsToTopic(item.id, addSignalTopicId, '')
                      setAddSignalTopicId('')
                    }}
                  >
                    {item.title}
                    <small>
                      {categoryLabels[item.category]} · {item.source}
                    </small>
                  </button>
                ))}
            </div>
          </section>
        </div>
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

      {topicDraft && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="link-modal editor-modal"
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
            <label>
              Thread title
              <input
                value={topicDraft.title}
                onChange={(event) =>
                  setTopicDraft({ ...topicDraft, title: event.target.value })
                }
                autoFocus
              />
            </label>
            <div className="form-grid">
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
              <label>
                Category
                <select
                  value={topicDraft.category}
                  onChange={(event) =>
                    setTopicDraft({
                      ...topicDraft,
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
            </div>
            <label>
              Description
              <textarea
                rows={4}
                value={topicDraft.notes}
                onChange={(event) =>
                  setTopicDraft({ ...topicDraft, notes: event.target.value })
                }
              />
            </label>
            {!creatingTopic && (
              <div className="related-notes">
                <strong>Related notes</strong>
                {topicDraft.supportingNews.map((newsId) => {
                  const supportingItem = news.find((item) => item.id === newsId)
                  if (!supportingItem || supportingItem.deletedAt) return null
                  return (
                    <div className="support-row" key={newsId}>
                      {supportingItem.url &&
                      supportingItem.sourceType !== 'manual_note' ? (
                        <a
                          href={supportingItem.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {supportingItem.title}
                        </a>
                      ) : (
                        <span>{supportingItem.title}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => void unlinkNews(topicDraft.id, newsId)}
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    setTargetTopicId(topicDraft.id)
                    setShowAddLink(true)
                  }}
                >
                  + Add another note
                </button>
              </div>
            )}
            <div className="analysis-grid">
              {(
                [
                  ['keyQuestion', 'Key question'],
                  ['observed', 'What we observed'],
                  ['currentView', 'Current view'],
                  ['implications', 'Implications'],
                  ['watch', 'What to watch'],
                ] as const
              ).map(([field, label]) => (
                <label key={field}>
                  {label}
                  <textarea
                    rows={2}
                    value={topicDraft.analysis[field]}
                    onChange={(event) =>
                      setTopicDraft({
                        ...topicDraft,
                        analysis: {
                          ...topicDraft.analysis,
                          [field]: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="outputs-editor">
              <strong>Outputs</strong>
              {topicDraft.outputs.map((output, index) => (
                <div className="output-row" key={output.id}>
                  <select
                    value={output.kind}
                    onChange={(event) => {
                      const outputs = [...topicDraft.outputs]
                      outputs[index] = {
                        ...output,
                        kind: event.target.value,
                      }
                      setTopicDraft({ ...topicDraft, outputs })
                    }}
                    aria-label="Output type"
                  >
                    {topicOutputKinds.map((kind) => (
                      <option key={kind.value} value={kind.value}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={output.title}
                    placeholder="Title"
                    onChange={(event) => {
                      const outputs = [...topicDraft.outputs]
                      outputs[index] = {
                        ...output,
                        title: event.target.value,
                      }
                      setTopicDraft({ ...topicDraft, outputs })
                    }}
                  />
                  <input
                    value={output.dateLabel}
                    placeholder="Date / month"
                    onChange={(event) => {
                      const outputs = [...topicDraft.outputs]
                      outputs[index] = {
                        ...output,
                        dateLabel: event.target.value,
                      }
                      setTopicDraft({ ...topicDraft, outputs })
                    }}
                  />
                  <input
                    value={output.link}
                    placeholder="Link"
                    onChange={(event) => {
                      const outputs = [...topicDraft.outputs]
                      outputs[index] = {
                        ...output,
                        link: event.target.value,
                      }
                      setTopicDraft({ ...topicDraft, outputs })
                    }}
                  />
                  <input
                    value={output.description}
                    placeholder="Short description"
                    onChange={(event) => {
                      const outputs = [...topicDraft.outputs]
                      outputs[index] = {
                        ...output,
                        description: event.target.value,
                      }
                      setTopicDraft({ ...topicDraft, outputs })
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setTopicDraft({
                    ...topicDraft,
                    outputs: [
                      ...topicDraft.outputs,
                      {
                        id: `output-${Date.now()}`,
                        kind: 'insight_brief',
                        title: '',
                        dateLabel: '',
                        link: '',
                        description: '',
                      },
                    ],
                  })
                }
              >
                + Add output
              </button>
            </div>
            {!creatingTopic && <ActivityHistory events={activity} />}
            <div className="modal-actions split-actions">
              {!creatingTopic ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void removeTopic(topicDraft.id)}
                  hidden={!canAdmin}
                >
                  Remove topic
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
