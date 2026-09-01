import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { CategoryLabel } from './components/CategoryLabel'
import { demoNews, demoTheses, demoTopics, demoTrends } from './demoData'
import { useTeamAuth } from './auth-context'
import {
  canonicalizeUrl,
  cloudConfigured,
  createThesis,
  createTopic,
  createTrend,
  deleteTrendItem,
  deleteNewsItem,
  deleteThesisItem,
  deleteTopicItem,
  loadActivityEvents,
  loadTeamMembers,
  loadWorkspace,
  loadLastWorkspacePage,
  persistDiscussionOrder,
  persistManualNote,
  persistNewsLink,
  persistTeamIdea,
  persistTopicNews,
  persistTrendNews,
  persistTrendTopic,
  recordWorkspaceView,
  saveLastWorkspacePage,
  restoreContent,
  purgeContent,
  purgeRecycleBin,
  subscribeToWorkspace,
  toggleNewsVote,
  topicMonthLabel,
  unlinkTopicNews,
  unlinkTrendNews,
  unlinkTrendTopic,
  updateNewsItem,
  updateNewsCategory,
  updateTeamMemberRole,
  updateThesisItem,
  updateTopicItem,
  updateTrendItem,
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
  formatMonthFilterLabel,
  formatRelativeAge,
  isInDashboardTimeRange,
  signalTime,
  type DashboardTimeMode,
} from './intelligence'
import type {
  FocusMode,
  DiscussionStatus,
  NewsCategory,
  NewsItem,
  Thesis,
  Topic,
  TopicKind,
  ThreadStatus,
  TeamMemberSummary,
  ActivityEvent,
  Trend,
  WorkspacePage,
} from './types'

type TopicKindFilter = 'all' | TopicKind
type ThreadStatusFilter = 'all' | ThreadStatus
type ThreadGroupMode = 'timeline' | 'category' | 'recent'
type EvidenceScope = 'all' | 'unassigned'
type AddLinkDraft = {
  open: boolean
  url: string
  title: string
  contributor: string
  targetTopicId: string
}
const addLinkDraftKey = 'signal-intelligence:add-link-draft'
const liveSignalsViewStoragePrefix =
  'signal-intelligence:last-viewed:live-signals'
const workspacePageStoragePrefix = 'signal-intelligence:workspace-page'

function explicitWorkspaceFromLocation(): WorkspacePage | null {
  try {
    const page = new URLSearchParams(window.location.search).get('workspace')
    if (page === 'synthesis' || page === 'weekly') return 'synthesis'
    if (page === 'threads') return 'threads'
    if (page === 'signals') return 'signals'
    return null
  } catch {
    return null
  }
}

function workspaceFromLocation(): WorkspacePage {
  return explicitWorkspaceFromLocation() || 'synthesis'
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

function hasMeetingReason(item: NewsItem) {
  return Boolean(
    item.voteCount > 0 ||
      item.ideaCount > 0 ||
      item.meetingNominatedAt ||
      item.topicLinks.length > 0,
  )
}

function isToDiscuss(item: NewsItem) {
  return item.discussionStatus === 'not_discussed' && hasMeetingReason(item)
}

function trendNewEvidenceCount(trend: Trend) {
  if (!trend.lastDiscussedAt) return trend.evidence.length
  return trend.evidence.filter(
    (evidence) => evidence.linkedAt > (trend.lastDiscussedAt || ''),
  ).length
}

function isTrendToDiscuss(trend: Trend) {
  if (
    trend.status !== 'active' ||
    trend.discussionStatus === 'dismissed' ||
    trend.evidence.length === 0 ||
    trend.actionThreadIds.length > 0
  ) {
    return false
  }
  return Boolean(
    trend.discussionStatus === 'not_discussed' ||
      trend.meetingNominatedAt ||
      trendNewEvidenceCount(trend) > 0,
  )
}

function compactWords(value: string, limit = 24) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length <= limit) return value.trim()
  return `${words.slice(0, limit).join(' ').replace(/[.,;:!?—-]+$/, '')}…`
}

function formatThreadMonth(monthKey: string) {
  if (!monthKey) return 'Unscheduled'
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return 'Unscheduled'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
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
  const [trends, setTrends] = useState(cloudConfigured ? [] : demoTrends)
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
  const [workspacePreferenceReady, setWorkspacePreferenceReady] = useState(false)
  const [timeMode, setTimeMode] = useState<DashboardTimeMode>('all')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() }
  })
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => new Date().getUTCFullYear())
  const [dropHighlight, setDropHighlight] = useState<NewsCategory | ''>('')
  const [trendCategory, setTrendCategory] =
    useState<NewsCategory | 'all'>('all')
  const [evidenceCategory, setEvidenceCategory] =
    useState<NewsCategory | 'all'>('all')
  const [evidenceScope, setEvidenceScope] = useState<EvidenceScope>('all')
  const [evidenceTrendFilterId, setEvidenceTrendFilterId] = useState('')
  const [archivedEvidenceOpen, setArchivedEvidenceOpen] = useState(false)
  const [archivedTrendsOpen, setArchivedTrendsOpen] = useState(false)
  const [evidenceInboxOpen, setEvidenceInboxOpen] = useState(false)
  const [topicKindFilter, setTopicKindFilter] = useState<TopicKindFilter>('all')
  const [threadStatusFilter, setThreadStatusFilter] =
    useState<ThreadStatusFilter>('all')
  const [threadFrom, setThreadFrom] = useState('')
  const [threadTo, setThreadTo] = useState('')
  const [threadCreatedPreset, setThreadCreatedPreset] = useState('any')
  const [threadGroupMode, setThreadGroupMode] =
    useState<ThreadGroupMode>('timeline')
  const [signalViewBaseline, setSignalViewBaseline] = useState('')
  const [pendingThreadNewsId, setPendingThreadNewsId] = useState('')
  const [categoryDrawer, setCategoryDrawer] = useState<NewsCategory | null>(
    null,
  )
  const [openNewsMenuId, setOpenNewsMenuId] = useState('')
  const [ideaText, setIdeaText] = useState('')
  const [ideaNewsId, setIdeaNewsId] = useState('')
  const [ideaListening, setIdeaListening] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [searchCategory, setSearchCategory] = useState<NewsCategory | 'all'>('all')
  const [searchContributor, setSearchContributor] = useState('all')
  const [meetingMode, setMeetingMode] = useState(false)
  const [meetingIndex, setMeetingIndex] = useState(0)
  const [meetingThreadNewsId, setMeetingThreadNewsId] = useState('')
  const [trendMeetingMode, setTrendMeetingMode] = useState(false)
  const [trendMeetingIndex, setTrendMeetingIndex] = useState(0)
  const [pendingThreadTrendId, setPendingThreadTrendId] = useState('')
  const [meetingThreadTrendId, setMeetingThreadTrendId] = useState('')
  const [pendingTrendNewsId, setPendingTrendNewsId] = useState('')
  const [pendingTrendTopicId, setPendingTrendTopicId] = useState('')
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
  const [draggedTopicId, setDraggedTopicId] = useState('')
  const [draggedTrendId, setDraggedTrendId] = useState('')
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [noteTakeawayDraft, setNoteTakeawayDraft] = useState('')
  const [noteCategory, setNoteCategory] = useState<NewsCategory>('interaction')
  const [newsDraft, setNewsDraft] = useState<NewsItem | null>(null)
  const [topicDraft, setTopicDraft] = useState<Topic | null>(null)
  const [trendDraft, setTrendDraft] = useState<Trend | null>(null)
  const [thesisDraft, setThesisDraft] = useState<Thesis | null>(null)
  const [creatingTopic, setCreatingTopic] = useState(false)
  const [creatingTrend, setCreatingTrend] = useState(false)
  const [creatingThesis, setCreatingThesis] = useState(false)
  const [selectedThesisId, setSelectedThesisId] = useState('')
  const [notice, setNotice] = useState('')
  const [headerHidden, setHeaderHidden] = useState(false)
  const recordedSignalViewFor = useRef('')
  const restoredWorkspaceFor = useRef('')
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
      setTrends(workspace.trends)
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
    if (!topicDraft || !cloudConfigured || teamMembers.length > 0) return
    void loadTeamMembers().then(setTeamMembers).catch(() => undefined)
  }, [teamMembers.length, topicDraft])

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
    if (!monthPickerOpen) return
    const close = () => setMonthPickerOpen(false)
    const timeout = window.setTimeout(
      () => window.addEventListener('click', close),
      0,
    )
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('click', close)
    }
  }, [monthPickerOpen])

  useEffect(() => {
    if (!openNewsMenuId) return
    const close = () => setOpenNewsMenuId('')
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [openNewsMenuId])

  useEffect(() => {
    if (!searchOpen && !profileMenuOpen) return
    const closeFloatingMenus = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (searchOpen && !target?.closest('.top-search-shell')) setSearchOpen(false)
      if (profileMenuOpen && !target?.closest('.profile-shell')) setProfileMenuOpen(false)
    }
    window.addEventListener('mousedown', closeFloatingMenus)
    return () => window.removeEventListener('mousedown', closeFloatingMenus)
  }, [profileMenuOpen, searchOpen])

  useEffect(() => {
    const viewerKey = identity?.userId || 'demo'
    if (restoredWorkspaceFor.current === viewerKey) return
    restoredWorkspaceFor.current = viewerKey
    const explicitPage = explicitWorkspaceFromLocation()
    const storageKey = `${workspacePageStoragePrefix}:${viewerKey}`
    const localPage = (() => {
      try {
        const stored = window.localStorage.getItem(storageKey)
        return stored === 'signals' || stored === 'synthesis' || stored === 'threads'
          ? stored
          : null
      } catch {
        return null
      }
    })()

    if (explicitPage) {
      setWorkspacePage(explicitPage)
      setWorkspacePreferenceReady(true)
      return
    }
    if (!cloudConfigured || !identity?.userId) {
      setWorkspacePage(localPage || 'synthesis')
      setWorkspacePreferenceReady(true)
      return
    }

    void loadLastWorkspacePage()
      .then((remotePage) => setWorkspacePage(remotePage || localPage || 'synthesis'))
      .catch(() => setWorkspacePage(localPage || 'synthesis'))
      .finally(() => setWorkspacePreferenceReady(true))
  }, [identity?.userId])

  useEffect(() => {
    if (!workspacePreferenceReady) return
    const viewerKey = identity?.userId || 'demo'
    try {
      window.localStorage.setItem(
        `${workspacePageStoragePrefix}:${viewerKey}`,
        workspacePage,
      )
    } catch {
      // Local preference persistence is best-effort.
    }
    if (cloudConfigured && identity?.userId) {
      void saveLastWorkspacePage(workspacePage).catch(() => undefined)
    }
  }, [identity?.userId, workspacePage, workspacePreferenceReady])

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
    if (workspacePage !== 'signals') return
    const viewerKey = identity?.userId || 'demo'
    if (recordedSignalViewFor.current === viewerKey) return
    recordedSignalViewFor.current = viewerKey
    const viewedAt = new Date().toISOString()
    const storageKey = `${liveSignalsViewStoragePrefix}:${viewerKey}`

    const recordLocalCursor = () => {
      try {
        const previous = window.localStorage.getItem(storageKey)
        setSignalViewBaseline(previous || viewedAt)
        window.localStorage.setItem(storageKey, viewedAt)
      } catch {
        setSignalViewBaseline(viewedAt)
      }
    }

    if (!cloudConfigured || !identity?.userId) {
      recordLocalCursor()
      return
    }

    void recordWorkspaceView('live_signals', viewedAt)
      .then((previous) => setSignalViewBaseline(previous || viewedAt))
      .catch(recordLocalCursor)
  }, [identity?.userId, workspacePage])

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
      setSearchOpen(false)
      setProfileMenuOpen(false)
      setCreatingTopic(false)
      setCreatingThesis(false)
    }
    window.addEventListener('keydown', closeModal)
    return () => window.removeEventListener('keydown', closeModal)
  }, [closeAddLink])

  const visibleNews = useMemo(() => {
    return news
      .filter((item) => {
        const matchesPeriod = isInDashboardTimeRange(
          signalTime(item),
          timeMode,
          selectedMonth,
        )
        const matchesScope = !item.deletedAt && !item.archivedAt
        return matchesPeriod && matchesScope
      })
      .sort((a, b) => signalTime(b).localeCompare(signalTime(a)))
  }, [news, selectedMonth, timeMode])

  const searchContributors = useMemo(
    () =>
      Array.from(
        new Set(news.map((item) => item.capturedBy).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [news],
  )

  const globalNewsResults = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return news
      .filter((item) => !item.deletedAt)
      .filter(
        (item) =>
          searchCategory === 'all' || item.category === searchCategory,
      )
      .filter(
        (item) =>
          searchContributor === 'all' || item.capturedBy === searchContributor,
      )
      .filter((item) =>
        `${item.title} ${item.summary} ${item.takeaway} ${item.teamSynthesis} ${item.capturedBy} ${categoryLabels[item.category]}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 8)
  }, [news, query, searchCategory, searchContributor])

  const globalTopicResults = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return topics
      .filter((topic) => !topic.deletedAt)
      .filter(
        (topic) =>
          searchCategory === 'all' || topic.category === searchCategory,
      )
      .filter((topic) =>
        `${topic.title} ${topic.notes} ${topic.decisionSummary} ${topic.nextStep} ${topic.ownerName || ''} ${categoryLabels[topic.category]}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 6)
  }, [query, searchCategory, topics])

  const globalTrendResults = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return trends
      .filter(
        (trend) =>
          !trend.deletedAt && trend.actionThreadIds.length === 0,
      )
      .filter(
        (trend) =>
          searchCategory === 'all' || trend.category === searchCategory,
      )
      .filter((trend) =>
        `${trend.title} ${trend.observation} ${trend.initialRead} ${trend.discussionQuestion} ${categoryLabels[trend.category]}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 6)
  }, [query, searchCategory, trends])

  const briefingTrends = useMemo(() => {
    return trends
      .filter(
        (trend) =>
          !trend.deletedAt &&
          trend.status !== 'archived' &&
          trend.actionThreadIds.length === 0,
      )
      .filter(
        (trend) => trendCategory === 'all' || trend.category === trendCategory,
      )
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [trendCategory, trends])

  const archivedTrends = useMemo(
    () =>
      trendCategory === 'all'
        ? trends
            .filter(
              (trend) =>
                !trend.deletedAt &&
                trend.status === 'archived' &&
                trend.actionThreadIds.length === 0,
            )
            .slice()
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        : [],
    [trendCategory, trends],
  )

  const synthesisEvidence = useMemo(
    () =>
      news
        .filter(
          (item) =>
            !item.deletedAt &&
            !item.archivedAt &&
            (evidenceCategory === 'all' || item.category === evidenceCategory) &&
            (evidenceScope === 'all' ||
              (item.trendLinks.length === 0 && item.topicLinks.length === 0)) &&
            (!evidenceTrendFilterId ||
              item.trendLinks.some((link) => link.trendId === evidenceTrendFilterId)),
        )
        .slice()
        .sort((a, b) => signalTime(b).localeCompare(signalTime(a))),
    [evidenceCategory, evidenceScope, evidenceTrendFilterId, news],
  )

  const archivedEvidence = useMemo(
    () =>
      evidenceScope === 'all' && !evidenceTrendFilterId
        ? news
            .filter(
              (item) =>
                !item.deletedAt &&
                Boolean(item.archivedAt) &&
                (evidenceCategory === 'all' || item.category === evidenceCategory),
            )
            .slice()
            .sort((a, b) => signalTime(b).localeCompare(signalTime(a)))
        : [],
    [evidenceCategory, evidenceScope, evidenceTrendFilterId, news],
  )

  const meetingEligibleTrends = useMemo(
    () =>
      trends
        .filter(
          (trend) =>
            !trend.deletedAt &&
            trend.status !== 'archived' &&
            trend.actionThreadIds.length === 0,
        )
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [trends],
  )

  const trendMeetingQueue = useMemo(
    () => meetingEligibleTrends.filter(isTrendToDiscuss),
    [meetingEligibleTrends],
  )
  const trendMeetingItem =
    trendMeetingQueue[
      Math.min(trendMeetingIndex, trendMeetingQueue.length - 1)
    ]

  const discussionNotes = useMemo(
    () =>
      sortDiscussionNotes(
        visibleNews.filter((item) => !item.deletedAt),
      ),
    [visibleNews],
  )

  const pickerMonthCounts = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => 0)
    news.forEach((item) => {
      if (item.deletedAt) return
      const displayedDate = new Date(signalTime(item))
      if (displayedDate.getUTCFullYear() !== pickerYear) return
      counts[displayedDate.getUTCMonth()] += 1
    })
    return counts
  }, [news, pickerYear])

  const pickerMonthMax = Math.max(...pickerMonthCounts, 1)

  const isNewSignal = useCallback(
    (item: NewsItem) =>
      Boolean(signalViewBaseline && item.capturedAt > signalViewBaseline),
    [signalViewBaseline],
  )

  const meetingQueue = useMemo(
    () =>
      visibleNews
        .filter(
          (item) =>
            isToDiscuss(item),
        )
        .slice()
        .sort(
          (a, b) =>
            discussionPriorityScore(b) - discussionPriorityScore(a) ||
            signalTime(b).localeCompare(signalTime(a)),
        ),
    [visibleNews],
  )
  const meetingItem = meetingQueue[Math.min(meetingIndex, meetingQueue.length - 1)]

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

  const timelineTopicGroups = useMemo(() => {
    const byMonth = new Map<string, Topic[]>()
    const unscheduled: Topic[] = []
    const currentMonthKey = new Date().toISOString().slice(0, 7)
    visibleTopics.forEach((topic) => {
      if (!topic.monthKey) {
        unscheduled.push(topic)
        return
      }
      const group = byMonth.get(topic.monthKey) || []
      group.push(topic)
      byMonth.set(topic.monthKey, group)
    })
    return {
      months: Array.from(byMonth.entries())
        .sort(([a], [b]) => {
          const aCurrentOrFuture = a >= currentMonthKey
          const bCurrentOrFuture = b >= currentMonthKey
          if (aCurrentOrFuture !== bCurrentOrFuture) {
            return aCurrentOrFuture ? -1 : 1
          }
          return aCurrentOrFuture
            ? a.localeCompare(b)
            : b.localeCompare(a)
        })
        .map(([monthKey, monthTopics]) => ({ monthKey, topics: monthTopics })),
      unscheduled,
    }
  }, [visibleTopics])

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

  async function linkNewsToTopic(
    newsId: string,
    topicId: string,
    topicOverride?: Topic,
  ) {
    const topic = topicOverride || topics.find((item) => item.id === topicId)
    if (!topic || !news.some((item) => item.id === newsId)) return false
    const persistedTopicAlreadyHasNews =
      topics.some((item) => item.id === topicId) &&
      topic.supportingNews.includes(newsId)
    if (persistedTopicAlreadyHasNews) return true
    try {
      if (cloudConfigured) await persistTopicNews(topicId, newsId)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not link news')
      return false
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
            return {
              ...candidate,
              topicLinks: withoutSource,
            }
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
      if (linkedNewsId) {
        setNews((current) =>
          current.map((item) =>
            item.id === linkedNewsId
              ? {
                  ...item,
                  ideaCount: item.ideaCount + 1,
                }
              : item,
          ),
        )
      }
      setNotice(
        'Thought saved and added to the discussion queue.',
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
    const sourceCategory = news.find((item) => item.id === newsId)?.category
    openNewTopic(sourceCategory)
  }

  function closeTopicEditor() {
    const shouldResumeMeeting = Boolean(meetingThreadNewsId)
    const shouldResumeTrendMeeting = Boolean(meetingThreadTrendId)
    setTopicDraft(null)
    setCreatingTopic(false)
    setPendingThreadNewsId('')
    setPendingThreadTrendId('')
    setMeetingThreadNewsId('')
    setMeetingThreadTrendId('')
    if (shouldResumeMeeting) setMeetingMode(true)
    if (shouldResumeTrendMeeting) setTrendMeetingMode(true)
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
      ideaCount: 0,
      discussionStatus: 'not_discussed',
      voteCount: 0,
      version: 1,
      topicLinks: [],
      trendLinks: [],
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
    setDropHighlight(category)
    window.setTimeout(() => setDropHighlight(''), 400)
    if (!cloudConfigured) return
    try {
      const result = await updateNewsCategory(newsId, category)
      setNews((current) =>
        current.map((candidate) =>
          candidate.id === newsId
            ? {
                ...candidate,
                category: result.category,
                version: result.version ?? candidate.version,
                updatedAt: result.updatedAt || candidate.updatedAt,
              }
            : candidate,
        ),
      )
      void reloadWorkspace(true)
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

  async function setDiscussionOutcome(
    item: NewsItem,
    discussionStatus: DiscussionStatus,
  ) {
    const discussedAt =
      discussionStatus === 'discussed' ? new Date().toISOString() : undefined
    try {
      let version = item.version
      if (cloudConfigured) {
        const result = await updateNewsItem(
          item.id,
          {
            discussion_status: discussionStatus,
            discussed_at: discussedAt || null,
            discussed_by:
              discussionStatus === 'discussed'
                ? identity?.userId || null
                : null,
          },
          item.version,
        )
        version = result?.version || version
      }
      setNews((current) =>
        current.map((candidate) =>
          candidate.id === item.id
              ? {
                ...candidate,
                discussionStatus,
                discussedAt,
                discussedBy:
                  discussionStatus === 'discussed'
                    ? identity?.displayName
                    : undefined,
                version,
              }
            : candidate,
        ),
      )
      setNotice(
        discussionStatus === 'discussed'
          ? 'Marked as discussed.'
          : discussionStatus === 'dismissed'
            ? 'Dismissed from team discussion.'
            : 'Reopened for discussion.',
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update discussion state')
    }
  }

  async function toggleMeetingNomination(item: NewsItem) {
    const nominatedAt = item.meetingNominatedAt
      ? undefined
      : new Date().toISOString()
    try {
      let version = item.version
      if (cloudConfigured) {
        const result = await updateNewsItem(
          item.id,
          {
            meeting_nominated_at: nominatedAt || null,
            meeting_nominated_by: nominatedAt
              ? identity?.userId || null
              : null,
          },
          item.version,
        )
        version = result?.version || version
      }
      setNews((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                meetingNominatedAt: nominatedAt,
                meetingNominatedBy: nominatedAt
                  ? identity?.displayName
                  : undefined,
                version,
              }
            : candidate,
        ),
      )
      setNotice(
        nominatedAt
          ? 'Added to To discuss.'
          : hasMeetingReason({ ...item, meetingNominatedAt: undefined })
            ? 'Manual nomination removed; other team signals keep this in To discuss.'
            : 'Removed from To discuss.',
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update meeting queue')
    }
  }

  function openNewTrend(newsId = '') {
    const source = news.find((item) => item.id === newsId)
    const now = new Date().toISOString()
    setPendingTrendNewsId(newsId)
    setCreatingTrend(true)
    setTrendDraft({
      id: '',
      title: '',
      category: source?.category || 'interaction',
      observation: source ? firstSentences(noteTakeaway(source) || source.summary, 1) : '',
      initialRead: '',
      discussionQuestion: '',
      status: 'active',
      discussionStatus: 'not_discussed',
      createdBy: identity?.displayName,
      createdAt: now,
      updatedAt: now,
      version: 1,
      evidence: [],
      actionThreadIds: [],
    })
  }

  async function completeTopicDowngrade(sourceTopic: Topic) {
    if (cloudConfigured) {
      for (const source of sourceTopic.sourceTrends) {
        await unlinkTrendTopic(source.trendId, sourceTopic.id)
      }
      await deleteTopicItem(sourceTopic.id)
    }
    setTopics((current) => current.filter((topic) => topic.id !== sourceTopic.id))
    setTrends((current) =>
      current.map((trend) => ({
        ...trend,
        actionThreadIds: trend.actionThreadIds.filter(
          (topicId) => topicId !== sourceTopic.id,
        ),
      })),
    )
    setNews((current) =>
      current.map((item) => ({
        ...item,
        topicLinks: item.topicLinks.filter((link) => link.topicId !== sourceTopic.id),
      })),
    )
  }

  async function saveTrendDraft() {
    if (!trendDraft || !trendDraft.title.trim()) return
    if (creatingTrend) {
      let saved = {
        id: `trend-${Date.now()}`,
        created_at: trendDraft.createdAt,
        updated_at: trendDraft.updatedAt,
        version: 1,
      }
      try {
        if (cloudConfigured) {
          const result = await createTrend({
            title: trendDraft.title,
            category: trendDraft.category,
            observation: trendDraft.observation,
            initialRead: trendDraft.initialRead,
            discussionQuestion: trendDraft.discussionQuestion,
            status: trendDraft.status,
          })
          if (result) saved = result
        }
        const sourceTopic = topics.find((topic) => topic.id === pendingTrendTopicId)
        const evidenceNewsIds = sourceTopic
          ? sourceTopic.supportingNews
          : pendingTrendNewsId
            ? [pendingTrendNewsId]
            : []
        const evidence = evidenceNewsIds.map((newsId, index) => ({
          newsId,
          role: 'supporting' as const,
          displayOrder: index + 1,
          linkedAt: new Date().toISOString(),
        }))
        if (cloudConfigured) {
          for (const [index, newsId] of evidenceNewsIds.entries()) {
            await persistTrendNews(saved.id, newsId, 'supporting', index + 1)
          }
        }
        const created: Trend = {
          ...trendDraft,
          id: saved.id,
          title: trendDraft.title.trim(),
          createdAt: saved.created_at,
          updatedAt: saved.updated_at,
          version: saved.version,
          evidence,
        }
        setTrends((current) => [created, ...current])
        if (evidenceNewsIds.length > 0) {
          setNews((current) =>
            current.map((item) =>
              evidenceNewsIds.includes(item.id)
                ? {
                    ...item,
                    trendLinks: [
                      ...item.trendLinks,
                      {
                        trendId: created.id,
                        trendTitle: created.title,
                        role: 'supporting',
                      },
                    ],
                  }
                : item,
            ),
          )
        }
        if (sourceTopic) {
          await completeTopicDowngrade(sourceTopic)
        }
        setNotice('Trend created')
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'Could not create Trend. Apply the latest database migration.',
        )
        return
      }
    } else {
      try {
        const previousTrend = trends.find((trend) => trend.id === trendDraft.id)
        let version = trendDraft.version
        let updatedAt = trendDraft.updatedAt
        if (cloudConfigured) {
          const result = await updateTrendItem(
            trendDraft.id,
            {
              title: trendDraft.title.trim(),
              category: trendDraft.category,
              observation: trendDraft.observation,
              initial_read: trendDraft.initialRead,
              discussion_question: trendDraft.discussionQuestion,
              status: trendDraft.status,
            },
            trendDraft.version,
          )
          version = result?.version || version
          updatedAt = result?.updatedAt || updatedAt
        }
        const saved = {
          ...trendDraft,
          title: trendDraft.title.trim(),
          version,
          updatedAt,
        }
        setTrends((current) =>
          current.map((trend) => (trend.id === saved.id ? saved : trend)),
        )
        const addedEvidence = trendDraft.evidence.filter(
          (evidence) =>
            !previousTrend?.evidence.some(
              (existing) => existing.newsId === evidence.newsId,
            ),
        )
        if (cloudConfigured) {
          for (const evidence of addedEvidence) {
            await persistTrendNews(
              saved.id,
              evidence.newsId,
              'supporting',
              evidence.displayOrder,
            )
          }
        }
        setNews((current) =>
          current.map((item) => {
            const linked = trendDraft.evidence.some(
              (evidence) => evidence.newsId === item.id,
            )
            const hasLink = item.trendLinks.some((link) => link.trendId === saved.id)
            return {
              ...item,
              trendLinks: [
                ...item.trendLinks.map((link) =>
                  link.trendId === saved.id
                    ? { ...link, trendTitle: saved.title }
                    : link,
                ),
                ...(linked && !hasLink
                  ? [
                      {
                        trendId: saved.id,
                        trendTitle: saved.title,
                        role: 'supporting' as const,
                      },
                    ]
                  : []),
              ],
            }
          }),
        )
        const sourceTopic = topics.find((topic) => topic.id === pendingTrendTopicId)
        if (sourceTopic) await completeTopicDowngrade(sourceTopic)
        setNotice('Trend updated')
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not update Trend')
        return
      }
    }
    setTrendDraft(null)
    setCreatingTrend(false)
    setPendingTrendNewsId('')
    setPendingTrendTopicId('')
  }

  async function setEvidenceArchived(newsIds: string[], archived: boolean) {
    const changedAt = new Date().toISOString()
    const versions = new Map<string, number | undefined>()
    for (const newsId of newsIds) {
      const item = news.find((candidate) => candidate.id === newsId)
      if (!item) continue
      const metadata = {
        ...item.metadata,
        archived_at: archived ? changedAt : null,
      }
      if (cloudConfigured) {
        const result = await updateNewsItem(
          newsId,
          { metadata },
          item.version,
        )
        versions.set(newsId, result?.version)
      }
    }
    setNews((current) =>
      current.map((item) =>
        newsIds.includes(item.id)
          ? {
              ...item,
              archivedAt: archived ? changedAt : undefined,
              metadata: {
                ...item.metadata,
                archived_at: archived ? changedAt : null,
              },
              version: versions.get(item.id) || item.version,
            }
          : item,
      ),
    )
  }

  async function setTrendArchived(
    id: string,
    archived: boolean,
    skipConfirmation = false,
  ) {
    const trend = trends.find((candidate) => candidate.id === id)
    if (!trend) return
    if (
      archived &&
      !skipConfirmation &&
      !window.confirm('Archive this Trend and all of its Evidence? You can restore both later.')
    ) {
      return
    }
    try {
      let version = trend.version
      if (cloudConfigured) {
        const result = await updateTrendItem(
          id,
          {
            status: archived ? 'archived' : 'active',
            discussion_status: archived ? 'dismissed' : 'not_discussed',
            meeting_nominated_at: null,
            meeting_nominated_by: null,
          },
          trend.version,
        )
        version = result?.version || version
      }
      await setEvidenceArchived(
        trend.evidence.map((evidence) => evidence.newsId),
        archived,
      )
      setTrends((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                status: archived ? 'archived' : 'active',
                discussionStatus: archived ? 'dismissed' : 'not_discussed',
                meetingNominatedAt: undefined,
                meetingNominatedBy: undefined,
                version,
              }
            : candidate,
        ),
      )
      setTrendDraft(null)
      setCreatingTrend(false)
      setNotice(
        archived
          ? 'Trend and its Evidence archived'
          : 'Trend and its Evidence restored',
      )
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : archived
            ? 'Could not archive Trend'
            : 'Could not restore Trend',
      )
    }
  }

  async function deleteTrend(id: string) {
    const trend = trends.find((candidate) => candidate.id === id)
    if (!trend || !window.confirm('Delete this Trend? Its Evidence will remain available.')) {
      return
    }
    try {
      if (cloudConfigured) await deleteTrendItem(id)
      setTrends((current) => current.filter((candidate) => candidate.id !== id))
      setNews((current) =>
        current.map((item) => ({
          ...item,
          trendLinks: item.trendLinks.filter((link) => link.trendId !== id),
        })),
      )
      setTrendDraft(null)
      setCreatingTrend(false)
      setNotice('Trend deleted')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete Trend')
    }
  }

  async function linkNewsToTrend(trendId: string, newsId: string) {
    const trend = trends.find((candidate) => candidate.id === trendId)
    const item = news.find((candidate) => candidate.id === newsId)
    if (!trend || !item || trend.evidence.some((link) => link.newsId === newsId)) {
      return
    }
    const role = 'supporting' as const
    const linkedAt = new Date().toISOString()
    try {
      if (cloudConfigured) {
        await persistTrendNews(
          trendId,
          newsId,
          role,
          trend.evidence.length + 1,
        )
      }
      setTrends((current) =>
        current.map((candidate) =>
          candidate.id === trendId
            ? {
                ...candidate,
                updatedAt: linkedAt,
                evidence: [
                  ...candidate.evidence,
                  {
                    newsId,
                    role,
                    displayOrder: candidate.evidence.length + 1,
                    linkedAt,
                  },
                ],
              }
            : candidate,
        ),
      )
      setNews((current) =>
        current.map((candidate) =>
          candidate.id === newsId
            ? {
                ...candidate,
                trendLinks: [
                  ...candidate.trendLinks,
                  { trendId, trendTitle: trend.title, role },
                ],
              }
            : candidate,
        ),
      )
      setNotice(`Added as evidence to “${trend.title}”.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add evidence')
    }
  }

  async function unlinkSignalFromTrend(trendId: string, newsId: string) {
    try {
      if (cloudConfigured) await unlinkTrendNews(trendId, newsId)
      setTrends((current) =>
        current.map((trend) =>
          trend.id === trendId
            ? {
                ...trend,
                evidence: trend.evidence.filter((link) => link.newsId !== newsId),
              }
            : trend,
        ),
      )
      setNews((current) =>
        current.map((item) =>
          item.id === newsId
            ? {
                ...item,
                trendLinks: item.trendLinks.filter(
                  (link) => link.trendId !== trendId,
                ),
              }
            : item,
        ),
      )
      setTrendDraft((current) =>
        current?.id === trendId
          ? {
              ...current,
              evidence: current.evidence.filter((link) => link.newsId !== newsId),
            }
          : current,
      )
      setNotice('Evidence removed from Trend')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove evidence')
    }
  }

  async function setTrendDiscussionOutcome(
    trend: Trend,
    discussionStatus: DiscussionStatus,
  ) {
    const discussedAt =
      discussionStatus === 'discussed' ? new Date().toISOString() : undefined
    try {
      let version = trend.version
      let updatedAt = trend.updatedAt
      if (cloudConfigured) {
        const result = await updateTrendItem(
          trend.id,
          {
            discussion_status: discussionStatus,
            last_discussed_at: discussedAt || null,
            last_discussed_by:
              discussionStatus === 'discussed' ? identity?.userId || null : null,
          },
          trend.version,
        )
        version = result?.version || version
        updatedAt = result?.updatedAt || updatedAt
      }
      setTrends((current) =>
        current.map((candidate) =>
          candidate.id === trend.id
            ? {
                ...candidate,
                discussionStatus,
                lastDiscussedAt: discussedAt,
                lastDiscussedBy:
                  discussionStatus === 'discussed'
                    ? identity?.displayName
                    : undefined,
                version,
                updatedAt,
              }
            : candidate,
        ),
      )
      setNotice(
        discussionStatus === 'discussed'
          ? 'Trend discussion recorded.'
          : discussionStatus === 'dismissed'
            ? 'Trend dismissed from discussion.'
            : 'Trend reopened for discussion.',
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update Trend')
    }
  }

  async function setTrendMeetingIncluded(trend: Trend, included: boolean) {
    const nominatedAt = included ? new Date().toISOString() : undefined
    const discussedAt = included ? undefined : new Date().toISOString()
    try {
      let version = trend.version
      if (cloudConfigured) {
        const result = await updateTrendItem(
          trend.id,
          {
            discussion_status: included ? 'not_discussed' : 'discussed',
            meeting_nominated_at: nominatedAt || null,
            meeting_nominated_by: included ? identity?.userId || null : null,
            last_discussed_at: discussedAt || null,
            last_discussed_by: included ? null : identity?.userId || null,
          },
          trend.version,
        )
        version = result?.version || version
      }
      const updated: Trend = {
        ...trend,
        discussionStatus: included ? 'not_discussed' : 'discussed',
        meetingNominatedAt: nominatedAt,
        meetingNominatedBy: included ? identity?.displayName : undefined,
        lastDiscussedAt: discussedAt,
        lastDiscussedBy: included ? undefined : identity?.displayName,
        version,
      }
      setTrends((current) =>
        current.map((candidate) => (candidate.id === trend.id ? updated : candidate)),
      )
      setTrendDraft((current) => (current?.id === trend.id ? updated : current))
      setNotice(included ? 'Added to Trend meeting' : 'Removed from Trend meeting')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update Trend meeting')
    }
  }

  async function linkTrendToTopic(
    trend: Trend,
    topic: Topic,
  ) {
    try {
      if (cloudConfigured && !trend.actionThreadIds.includes(topic.id)) {
        await persistTrendTopic(trend.id, topic.id)
      }
      for (const evidence of trend.evidence) {
        await linkNewsToTopic(evidence.newsId, topic.id, topic)
      }
      setTrends((current) =>
        current.map((candidate) =>
          candidate.id === trend.id
            ? {
                ...candidate,
                actionThreadIds: candidate.actionThreadIds.includes(topic.id)
                  ? candidate.actionThreadIds
                  : [...candidate.actionThreadIds, topic.id],
              }
            : candidate,
        ),
      )
      setTopics((current) =>
        current.map((candidate) =>
          candidate.id === topic.id &&
          !candidate.sourceTrends.some((source) => source.trendId === trend.id)
            ? {
                ...candidate,
                sourceTrends: [
                  ...candidate.sourceTrends,
                  { trendId: trend.id, trendTitle: trend.title },
                ],
              }
            : candidate,
        ),
      )
      await setTrendDiscussionOutcome(trend, 'discussed')
      setNotice(`“${trend.title}” is now part of “${topic.title}”.`)
      return true
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not upgrade this Trend to an Action Thread.',
      )
      return false
    }
  }

  function openCreateThreadFromTrend(trend: Trend, resumeMeeting = false) {
    setPendingThreadTrendId(trend.id)
    setMeetingThreadTrendId(resumeMeeting ? trend.id : '')
    openNewTopic(trend.category, {
      title: trend.title,
      notes: trend.initialRead || trend.observation,
      analysis: {
        ...emptyTopicAnalysis,
        keyQuestion: trend.discussionQuestion,
        observed: trend.observation,
        currentView: trend.initialRead,
      },
    })
    setTopicDraft((current) =>
      current
        ? {
            ...current,
            supportingNews: trend.evidence.map((evidence) => evidence.newsId),
            decisionSummary: [
              trend.observation ? `• What's changed: ${trend.observation}` : '',
              trend.initialRead ? `• Initial read: ${trend.initialRead}` : '',
              trend.discussionQuestion
                ? `• Discussion question: ${trend.discussionQuestion}`
                : '',
            ]
              .filter(Boolean)
              .join('\n'),
          }
        : current,
    )
  }

  function openCreateTrendFromTopic(topic: Topic) {
    const now = new Date().toISOString()
    const sourceTrend = topic.sourceTrends
      .map((source) => trends.find((trend) => trend.id === source.trendId))
      .find((trend): trend is Trend => Boolean(trend && !trend.deletedAt))
    setTopicDraft(null)
    setCreatingTopic(false)
    setPendingTrendTopicId(topic.id)
    setPendingTrendNewsId('')
    setCreatingTrend(!sourceTrend)
    setTrendDraft({
      ...(sourceTrend || {}),
      id: sourceTrend?.id || '',
      title: topic.title,
      category: topic.category,
      observation: topic.analysis.observed || topic.notes,
      initialRead: topic.analysis.currentView || topic.decisionSummary,
      discussionQuestion: topic.analysis.keyQuestion,
      status: 'active',
      discussionStatus: 'not_discussed',
      createdBy: sourceTrend?.createdBy || identity?.displayName,
      createdAt: sourceTrend?.createdAt || now,
      updatedAt: now,
      version: sourceTrend?.version || 1,
      evidence: topic.supportingNews.map((newsId, index) => ({
        newsId,
        role: 'supporting',
        displayOrder: index + 1,
        linkedAt: now,
      })),
      actionThreadIds: (sourceTrend?.actionThreadIds || []).filter(
        (topicId) => topicId !== topic.id,
      ),
    })
  }

  async function reassignTopicCategory(
    topicId: string,
    category: NewsCategory,
  ) {
    const topic = topics.find((candidate) => candidate.id === topicId)
    if (!topic || topic.deletedAt || topic.category === category) return
    setTopics((current) =>
      current.map((candidate) =>
        candidate.id === topicId ? { ...candidate, category } : candidate,
      ),
    )
    if (!cloudConfigured) return
    try {
      const version = await updateTopicItem(
        topicId,
        { category },
        topic.version,
      )
      setTopics((current) =>
        current.map((candidate) =>
          candidate.id === topicId
            ? { ...candidate, category, version: version ?? candidate.version }
            : candidate,
        ),
      )
    } catch (error) {
      setTopics((current) =>
        current.map((candidate) =>
          candidate.id === topicId
            ? { ...candidate, category: topic.category }
            : candidate,
        ),
      )
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not move this Action Thread',
      )
    }
  }

  async function reassignTopicMonth(topicId: string, monthKey: string) {
    const topic = topics.find((candidate) => candidate.id === topicId)
    if (!topic || topic.deletedAt || topic.monthKey === monthKey) return
    const nextMonthLabel = monthName(monthKey)
    setTopics((current) =>
      current.map((candidate) =>
        candidate.id === topicId
          ? { ...candidate, monthKey, monthLabel: nextMonthLabel }
          : candidate,
      ),
    )
    if (!cloudConfigured) return
    try {
      const version = await updateTopicItem(
        topicId,
        { scheduled_month: monthKey ? `${monthKey}-01` : null },
        topic.version,
      )
      setTopics((current) =>
        current.map((candidate) =>
          candidate.id === topicId
            ? {
                ...candidate,
                monthKey,
                monthLabel: nextMonthLabel,
                version: version ?? candidate.version,
              }
            : candidate,
        ),
      )
    } catch (error) {
      setTopics((current) =>
        current.map((candidate) =>
          candidate.id === topicId
            ? {
                ...candidate,
                monthKey: topic.monthKey,
                monthLabel: topic.monthLabel,
              }
            : candidate,
        ),
      )
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not move this Action Thread',
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
    setTrends((current) =>
      current.map((trend) => ({
        ...trend,
        actionThreadIds: trend.actionThreadIds.filter((topicId) => topicId !== id),
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

  function openNewTopic(
    category: NewsCategory = 'ai_capability',
    seed: Partial<Pick<Topic, 'title' | 'notes' | 'analysis'>> = {},
  ) {
    setCreatingTopic(true)
    setTopicDraft({
      id: '',
      title: seed.title || '',
      monthKey: '',
      monthLabel: monthName(''),
      category,
      status: 'idea',
      threadStatus: 'open',
      kind: 'insight',
      notes: seed.notes || '',
      analysis: seed.analysis || { ...emptyTopicAnalysis },
      outputs: [],
      ownerId: identity?.userId || (!cloudConfigured ? 'demo-user' : undefined),
      ownerName: identity?.displayName || (!cloudConfigured ? 'Demo user' : undefined),
      decisionSummary: '',
      nextStep: '',
      outcomeUrl: '',
      createdAt: new Date().toISOString(),
      displayOrder: 1,
      supportingNews: [],
      sourceTrends: [],
    })
  }

  async function saveTopicDraft() {
    if (!topicDraft || !topicDraft.title.trim()) return
    if (creatingTopic && !topicDraft.ownerId) {
      setNotice('Choose an owner before creating this Action Thread.')
      return
    }
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
            ownerId: topicDraft.ownerId,
            decisionSummary: topicDraft.decisionSummary,
            nextStep: topicDraft.nextStep,
            outcomeUrl: topicDraft.outcomeUrl,
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
        const meetingSource = news.find(
          (item) => item.id === meetingThreadNewsId,
        )
        await linkNewsToTopic(pendingThreadNewsId, id, {
          ...topicDraft,
          id,
          title: topicDraft.title.trim(),
        })
        if (meetingSource) {
          await setDiscussionOutcome(meetingSource, 'discussed')
        }
        setPendingThreadNewsId('')
      }
      if (pendingThreadTrendId) {
        const sourceTrend = trends.find(
          (trend) => trend.id === pendingThreadTrendId,
        )
        if (sourceTrend) {
          await linkTrendToTopic(sourceTrend, {
            ...topicDraft,
            id,
            title: topicDraft.title.trim(),
          })
        }
        setPendingThreadTrendId('')
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
            owner_id: topicDraft.ownerId || null,
            decision_summary: topicDraft.decisionSummary,
            next_step: topicDraft.nextStep,
            outcome_url: topicDraft.outcomeUrl,
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
    const shouldResumeMeeting = Boolean(meetingThreadNewsId)
    const shouldResumeTrendMeeting = Boolean(meetingThreadTrendId)
    setTopicDraft(null)
    setCreatingTopic(false)
    setMeetingThreadNewsId('')
    setMeetingThreadTrendId('')
    if (shouldResumeMeeting) setMeetingMode(true)
    if (shouldResumeTrendMeeting) setTrendMeetingMode(true)
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
      ideaCount: 0,
      discussionStatus: 'not_discussed',
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
      trendLinks: [],
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
          {item.url && item.sourceType !== 'manual_note' ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              title="Open original article"
            >
              {item.title}
            </a>
          ) : (
            <span>{item.title}</span>
          )}
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
    const takeawayText = compactWords(
      variant === 'candidate' ? firstSentences(takeaway, 2) : takeaway,
      variant === 'candidate' ? 30 : 24,
    )
    const synthesisText = teamView || qiraImplication || takeawayText
    const synthesisLabel = teamView ? 'Team synthesis' : 'Editorial takeaway'
    const toDiscuss = isToDiscuss(item)
    const linkedThread = item.topicLinks[0]
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
            <CategoryLabel category={item.category} className="category-token" />
          ) : null}
          {variant === 'live' && isNewSignal(item) ? (
            <span className="new-signal-badge">New</span>
          ) : null}
          {isManual ? <span className="meta-source">Team note</span> : null}
          <span className="meta-time">
            {formatRelativeAge(signalTime(item))}
          </span>
          {item.capturedBy ? (
            <span className="meta-contributor">· {item.capturedBy}</span>
          ) : null}
          {variant === 'candidate' ? (
            <>
              {toDiscuss ? (
                <span className="pipeline-state state-to-discuss">To discuss</span>
              ) : item.discussionStatus === 'discussed' ? (
                <span className="pipeline-state state-discussed">Discussed</span>
              ) : item.discussionStatus === 'dismissed' ? (
                <span className="pipeline-state state-dismissed">Dismissed</span>
              ) : null}
              {linkedThread ? (
                <span className="thread-relation" title={linkedThread.topicTitle}>
                  In thread · {linkedThread.topicTitle}
                </span>
              ) : null}
            </>
          ) : null}
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
        {variant === 'live' && takeawayText ? (
          <div
            className="ai-takeaway"
            title={takeawayText}
          >
            <p>{takeawayText}</p>
          </div>
        ) : null}
        {variant === 'candidate' && (
          <>
            {synthesisText ? (
              <div
                className={`candidate-synthesis ${teamView ? 'team-informed' : ''}`}
                title={synthesisText}
              >
                <div className="synthesis-heading">
                  <strong>{synthesisLabel}</strong>
                  {teamView ? <span>Team-informed</span> : null}
                </div>
                <p>{firstSentences(synthesisText, 2)}</p>
              </div>
            ) : null}
            {whyItMatters ? (
              <div className="intel-block">
                <strong>Why it matters</strong>
                <p>{whyItMatters}</p>
              </div>
            ) : null}
            {qiraImplication && qiraImplication !== synthesisText ? (
              <div className="intel-block">
                <strong>QIRA implication</strong>
                <p>{qiraImplication}</p>
              </div>
            ) : null}
          </>
        )}
        {variant === 'candidate' && hasMeetingReason(item) ? (
          <div className="meeting-reasons" aria-label="Discussion reasons">
            {item.voteCount > 0 ? (
              <span>{item.voteCount} recommend{item.voteCount === 1 ? '' : 's'}</span>
            ) : null}
            {item.ideaCount > 0 ? (
              <span>{item.ideaCount} thought{item.ideaCount === 1 ? '' : 's'}</span>
            ) : null}
            {item.meetingNominatedAt ? (
              <span>Added by {item.meetingNominatedBy || 'editor'}</span>
            ) : null}
          </div>
        ) : null}
        <div className="card-footer">
          <div className="signal-actions">
              <button
                className={`vote-button ${item.votedByMe ? 'voted' : ''}`}
                type="button"
                title="Recommend for team discussion"
                onClick={() => void voteToDiscuss(item)}
              >
                ↑ {item.voteCount || 0} Recommend
              </button>
              <button
                className="text-action idea-button"
                type="button"
                onClick={() => {
                  setIdeaNewsId(item.id)
                  setIdeaText('')
                }}
              >
                Add thought
              </button>
              {item.ideaCount > 0 ? (
                <span className="thought-count">
                  {item.ideaCount} team thought{item.ideaCount === 1 ? '' : 's'}
                </span>
              ) : null}
          </div>
          {variant === 'candidate' ? (
            <div className="candidate-workflow-actions">
              {item.discussionStatus !== 'not_discussed' ? (
                <button
                  className="secondary-button discussion-state-action"
                  type="button"
                  onClick={() => void setDiscussionOutcome(item, 'not_discussed')}
                >
                  Reopen discussion
                </button>
              ) : (
                <>
                  {!toDiscuss || item.meetingNominatedAt ? (
                    <button
                      className="text-action"
                      type="button"
                      onClick={() => void toggleMeetingNomination(item)}
                    >
                      {item.meetingNominatedAt
                        ? 'Remove manual nomination'
                        : 'Add to meeting'}
                    </button>
                  ) : null}
                  {toDiscuss ? (
                    <>
                      <button
                        className="secondary-button discussion-state-action"
                        type="button"
                        onClick={() => void setDiscussionOutcome(item, 'dismissed')}
                      >
                        Dismiss
                      </button>
                      <button
                        className="primary-button discussion-state-action"
                        type="button"
                        onClick={() => void setDiscussionOutcome(item, 'discussed')}
                      >
                        Mark discussed
                      </button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </article>
    )
  }

  function renderTrendCard(trend: Trend) {
    const evidence = trend.evidence
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((link) => ({
        link,
        item: news.find((candidate) => candidate.id === link.newsId),
      }))
      .filter(
        (entry): entry is { link: Trend['evidence'][number]; item: NewsItem } =>
          Boolean(entry.item && !entry.item.deletedAt),
      )
    const newEvidence = trendNewEvidenceCount(trend)
    const needsReview = isTrendToDiscuss(trend)
    return (
      <article
        className={`trend-card cat-${trend.category} ${
          draggedNewsId ? 'accepting-news' : ''
        } ${trend.status === 'archived' ? 'is-archived' : ''}`}
        key={trend.id}
        draggable={canEdit}
        onDragStart={(event) => {
          if (draggedNewsId) return
          setDraggedTrendId(trend.id)
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('application/x-trend-id', trend.id)
        }}
        onDragEnd={() => setDraggedTrendId('')}
        onDragOver={(event) => {
          if (!draggedNewsId) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(event) => {
          const newsId =
            event.dataTransfer.getData('application/x-news-id') || draggedNewsId
          if (!newsId) return
          event.preventDefault()
          void linkNewsToTrend(trend.id, newsId)
          setDraggedNewsId('')
        }}
      >
        <header className="trend-card-head">
          <CategoryLabel category={trend.category} className="category-token" />
          <div className="trend-card-state">
            <span className={`trend-review-state ${needsReview ? 'needs-review' : ''}`}>
              {trend.status === 'archived'
                ? 'Archived'
                : newEvidence > 0 && trend.lastDiscussedAt
                ? `${newEvidence} new`
                : needsReview
                  ? 'Needs review'
                  : `Reviewed ${formatShortDate(trend.lastDiscussedAt || trend.updatedAt)}`}
            </span>
            <span className="trend-signal-count">
              {evidence.length} signal{evidence.length === 1 ? '' : 's'}
            </span>
          </div>
        </header>
        <button
          className="trend-title-button"
          type="button"
          onClick={() => {
            setCreatingTrend(false)
            setTrendDraft({ ...trend })
          }}
        >
          {trend.title}
        </button>
        {trend.observation ? (
          <p className="trend-observation">{trend.observation}</p>
        ) : null}
        {trend.initialRead ? (
          <div className="trend-initial-read">
            <strong>Initial read</strong>
            <p>{trend.initialRead}</p>
          </div>
        ) : null}
        {trend.discussionQuestion ? (
          <p className="trend-question">
            <strong>Question</strong> {trend.discussionQuestion}
          </p>
        ) : null}
        {newEvidence > 0 && trend.lastDiscussedAt ? (
          <p className="trend-new-evidence">
            {newEvidence} new since last discussion
          </p>
        ) : null}
        <div className="trend-evidence" aria-label="Supporting signals">
          {evidence.slice(0, 3).map(({ item }) => (
            <div
              className="trend-evidence-row"
              key={item.id}
              draggable={canEdit}
              onDragStart={(event) => {
                event.stopPropagation()
                setDraggedNewsId(item.id)
                event.dataTransfer.setData('application/x-news-id', item.id)
              }}
              onDragEnd={(event) => {
                event.stopPropagation()
                setDraggedNewsId('')
              }}
            >
              {item.url && item.sourceType !== 'manual_note' ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {item.title}
                </a>
              ) : (
                <span>{item.title}</span>
              )}
              <button
                className="unlink-button"
                type="button"
                title="Remove signal from Trend"
                aria-label="Remove signal from Trend"
                onClick={(event) => {
                  event.stopPropagation()
                  void unlinkSignalFromTrend(trend.id, item.id)
                }}
                hidden={!canEdit}
              >
                ×
              </button>
            </div>
          ))}
          {evidence.length === 0 ? (
            <p className="trend-empty-evidence">
              Add reviewed signals before taking this Trend into discussion.
            </p>
          ) : null}
        </div>
        <footer className="trend-card-actions">
          <button
            className="text-action"
            type="button"
            onClick={() => {
              setCreatingTrend(false)
              setTrendDraft({ ...trend })
            }}
          >
            Edit
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setEvidenceInboxOpen(true)
              setEvidenceScope('all')
              if (trend.evidence.length > 0) {
                setEvidenceCategory('all')
                setEvidenceTrendFilterId(trend.id)
              } else {
                setEvidenceTrendFilterId('')
                setEvidenceCategory(trend.category)
              }
            }}
            hidden={!canEdit}
          >
            Show evidence
          </button>
          {trend.status === 'archived' ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => void setTrendArchived(trend.id, false)}
            >
              Unarchive
            </button>
          ) : needsReview ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                const index = trendMeetingQueue.findIndex(
                  (candidate) => candidate.id === trend.id,
                )
                setTrendMeetingIndex(Math.max(0, index))
                setTrendMeetingMode(true)
              }}
            >
              Review
            </button>
          ) : null}
        </footer>
      </article>
    )
  }

  function renderEvidenceWorkCard(item: NewsItem, archived = false) {
    const homeCount = item.trendLinks.length + item.topicLinks.length
    return (
      <article
        className={`evidence-work-card ${archived ? 'is-archived' : ''}`}
        key={item.id}
        draggable={canEdit && !archived}
        onDragStart={(event) => {
          if (archived) return
          setDraggedNewsId(item.id)
          event.dataTransfer.effectAllowed = 'copy'
          event.dataTransfer.setData('application/x-news-id', item.id)
        }}
        onDragEnd={() => setDraggedNewsId('')}
      >
        <div className="evidence-work-meta">
          <CategoryLabel category={item.category} />
          <span>{formatShortDate(signalTime(item))}</span>
          {archived ? <span className="archived-label">Archived</span> : null}
          <button
            className="text-action"
            type="button"
            onClick={() => setNewsDraft({ ...item })}
            hidden={!canEdit}
          >
            Edit
          </button>
        </div>
        {item.url && item.sourceType !== 'manual_note' ? (
          <a href={item.url} target="_blank" rel="noreferrer">
            {item.title}
          </a>
        ) : (
          <strong>{item.title}</strong>
        )}
        {noteTakeaway(item) ? <p>{compactWords(noteTakeaway(item), 18)}</p> : null}
        <div className="evidence-homes">
          {item.trendLinks.map((link) => (
            <span key={`trend-${link.trendId}`}>Trend · {link.trendTitle}</span>
          ))}
          {item.topicLinks.map((link) => (
            <span key={`topic-${link.topicId}`}>Thread · {link.topicTitle}</span>
          ))}
          {homeCount === 0 ? <span className="unassigned">Unassigned</span> : null}
        </div>
      </article>
    )
  }

  function renderEvidenceColumn() {
    return (
      <section className="evidence-pane workflow-column" aria-label="Evidence">
        <div className="workflow-column-heading">
          <h1>Evidence</h1>
          <div className="heading-actions">
            <span className="column-count">{synthesisEvidence.length}</span>
            <div className="compact-toggle" role="group" aria-label="Evidence state">
              {(['all', 'unassigned'] as EvidenceScope[]).map((scope) => (
                <button
                  type="button"
                  key={scope}
                  className={evidenceScope === scope ? 'active' : ''}
                  aria-pressed={evidenceScope === scope}
                  onClick={() => {
                    setEvidenceScope(scope)
                    setEvidenceTrendFilterId('')
                  }}
                >
                  {scope === 'all' ? 'All' : 'Unassigned'}
                </button>
              ))}
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Collapse Evidence"
              title="Collapse Evidence"
              onClick={() => setEvidenceInboxOpen(false)}
            >
              ‹
            </button>
          </div>
        </div>
        <div className="column-filter" role="group" aria-label="Evidence category">
          <button
            type="button"
            className={evidenceCategory === 'all' ? 'active' : ''}
            aria-pressed={evidenceCategory === 'all'}
            onClick={() => setEvidenceCategory('all')}
          >
            All
          </button>
          {liveSignalCategories.map((category) => (
            <button
              type="button"
              key={category}
              className={evidenceCategory === category ? 'active' : ''}
              aria-pressed={evidenceCategory === category}
              onClick={() => setEvidenceCategory(category)}
            >
              {categoryLabels[category]}
            </button>
          ))}
        </div>
        {evidenceTrendFilterId ? (
          <button
            className="active-filter-chip"
            type="button"
            onClick={() => setEvidenceTrendFilterId('')}
          >
            {trends.find((trend) => trend.id === evidenceTrendFilterId)?.title || 'Trend evidence'} ×
          </button>
        ) : null}
        <div className="evidence-column-list">
          {synthesisEvidence.map((item) => renderEvidenceWorkCard(item))}
          {synthesisEvidence.length === 0 ? (
            <div className="column-empty">No evidence in this category.</div>
          ) : null}
          {archivedEvidence.length > 0 ? (
            <details
              className="archived-collection"
              open={archivedEvidenceOpen}
              onToggle={(event) => setArchivedEvidenceOpen(event.currentTarget.open)}
            >
              <summary>Archived · {archivedEvidence.length}</summary>
              <div className="archived-card-list">
                {archivedEvidence.map((item) => renderEvidenceWorkCard(item, true))}
              </div>
            </details>
          ) : null}
        </div>
      </section>
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
        } ${draggedTopicId === topic.id ? 'dragging-topic' : ''}`}
        key={topic.id}
        draggable={canEdit}
        onDragStart={(event) => {
          if (!canEdit) return
          setDraggedTopicId(topic.id)
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('application/x-topic-id', topic.id)
          }
        }}
        onDragEnd={() => setDraggedTopicId('')}
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
          <CategoryLabel category={topic.category} className="thread-card-category" />
          <span className={`chip thread-status status-${status}`}>
            {threadStatusLabels[status]}
          </span>
        </div>
        <h3>{topic.title}</h3>
        {!(workspacePage === 'threads' && threadGroupMode === 'timeline') ? (
          <div className="thread-card-meta">
            <span className="thread-timeline">
              {formatThreadMonth(topic.monthKey)}
            </span>
          </div>
        ) : null}
        {framing ? <p className="thread-framing">{framing}</p> : null}
        {topic.ownerName || topic.nextStep ? (
          <div className="thread-accountability">
            {topic.ownerName ? <span>Owner · {topic.ownerName}</span> : null}
            {topic.nextStep ? <span>Next · {firstSentences(topic.nextStep, 1)}</span> : null}
          </div>
        ) : null}
        {topic.decisionSummary ? (
          <p className="thread-decision">Decision · {topic.decisionSummary}</p>
        ) : null}
        {topic.sourceTrends.length > 0 ? (
          <div className="thread-source-trends">
            {topic.sourceTrends.map((source) => (
              <button
                type="button"
                key={source.trendId}
                onClick={(event) => {
                  event.stopPropagation()
                  const trend = trends.find((item) => item.id === source.trendId)
                  if (trend) {
                    setWorkspacePage('synthesis')
                    setCreatingTrend(false)
                    setTrendDraft({ ...trend })
                  }
                }}
              >
                From trend · {source.trendTitle}
              </button>
            ))}
          </div>
        ) : null}
        {linked.length > 0 ? (
          <div className="linked-signals" aria-label="Linked signals">
            {linked.map((item) =>
              renderLinkedSignalRow(item, topic.id, { stopCardClick: true }),
            )}
          </div>
        ) : null}
      </article>
    )
  }

  function renderGlobalSearch() {
    return (
      <div className="top-search-shell">
        <label className="top-search-field">
          <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8.5 3a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65-1.06 1.06-3.65-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
            />
          </svg>
          <span className="sr-only">Search by keywords</span>
          <input
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value)
              setSearchOpen(true)
            }}
            placeholder="Keywords"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                setSearchOpen(false)
              }}
            >
              ×
            </button>
          ) : null}
        </label>
        {searchOpen && query.trim() ? (
          <div className="global-search-results top-search-results" role="dialog" aria-label="Search results">
            <div className="search-result-filters">
              <select
                aria-label="Search category"
                value={searchCategory}
                onChange={(event) =>
                  setSearchCategory(event.target.value as NewsCategory | 'all')
                }
              >
                <option value="all">All categories</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
              <select
                aria-label="Search contributor"
                value={searchContributor}
                onChange={(event) => setSearchContributor(event.target.value)}
              >
                <option value="all">All contributors</option>
                {searchContributors.map((name) => (
                  <option value={name} key={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="search-result-section">
              <strong>News</strong>
              {globalNewsResults.map((item) => (
                <a
                  href={item.url || undefined}
                  target={item.url ? '_blank' : undefined}
                  rel={item.url ? 'noreferrer' : undefined}
                  key={item.id}
                  onClick={() => setSearchOpen(false)}
                >
                  <span>{item.title}</span>
                  <small>
                    {categoryLabels[item.category]} · {item.capturedBy}
                    {item.archivedAt ? ' · Archived' : ''}
                  </small>
                </a>
              ))}
            </div>
            <div className="search-result-section">
              <strong>Trends</strong>
              {globalTrendResults.map((trend) => (
                <button
                  type="button"
                  key={trend.id}
                  onClick={() => {
                    setWorkspacePage('synthesis')
                    setCreatingTrend(false)
                    setTrendDraft({ ...trend })
                    setSearchOpen(false)
                  }}
                >
                  <span>{trend.title}</span>
                  <small>
                    {categoryLabels[trend.category]} · {trend.evidence.length} signals
                    {trend.status === 'archived' ? ' · Archived' : ''}
                  </small>
                </button>
              ))}
            </div>
            <div className="search-result-section">
              <strong>Action Threads</strong>
              {globalTopicResults.map((topic) => (
                <button
                  type="button"
                  key={topic.id}
                  onClick={() => {
                    setCreatingTopic(false)
                    setTopicDraft({ ...topic })
                    setSearchOpen(false)
                  }}
                >
                  <span>{topic.title}</span>
                  <small>{topicKindLabels[topic.kind]} · {topic.ownerName || 'Unassigned'}</small>
                </button>
              ))}
            </div>
            {globalNewsResults.length + globalTrendResults.length + globalTopicResults.length === 0 ? (
              <p className="search-empty">No matching results.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  function renderTimeFilter() {
    const monthLabel = formatMonthFilterLabel(
      selectedMonth.year,
      selectedMonth.month,
    )
    return (
      <div className="page-toolbar">
        <div className="time-filter" role="group" aria-label="Time range">
          <button
            type="button"
            className={timeMode === 'all' ? 'active' : ''}
            aria-pressed={timeMode === 'all'}
            onClick={() => {
              setTimeMode('all')
              setMonthPickerOpen(false)
            }}
          >
            All
          </button>
          <button
            type="button"
            className={timeMode === 'week' ? 'active' : ''}
            aria-pressed={timeMode === 'week'}
            onClick={() => {
              setTimeMode('week')
              setMonthPickerOpen(false)
            }}
          >
            Past week
          </button>
          <button
            type="button"
            className={timeMode === 'fortnight' ? 'active' : ''}
            aria-pressed={timeMode === 'fortnight'}
            onClick={() => {
              setTimeMode('fortnight')
              setMonthPickerOpen(false)
            }}
          >
            Past 2 weeks
          </button>
          <button
            type="button"
            className={timeMode === 'month' ? 'active' : ''}
            aria-pressed={timeMode === 'month'}
            aria-expanded={monthPickerOpen}
            onClick={(event) => {
              event.stopPropagation()
              setPickerYear(selectedMonth.year)
              setMonthPickerOpen((open) => !open)
            }}
          >
            {timeMode === 'month' ? `${monthLabel} ▾` : 'Month ▾'}
          </button>
        </div>
        {monthPickerOpen ? (
          <div
            className="month-picker"
            role="dialog"
            aria-label="Select month"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="month-picker-year">
              <button
                type="button"
                onClick={() => setPickerYear((year) => year - 1)}
                aria-label="Previous year"
              >
                ‹
              </button>
              <strong>{pickerYear}</strong>
              <button
                type="button"
                onClick={() => setPickerYear((year) => year + 1)}
                aria-label="Next year"
              >
                ›
              </button>
            </div>
            <div className="month-picker-grid">
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(
                (label, month) => {
                  const count = pickerMonthCounts[month]
                  const heatLevel =
                    count === 0
                      ? 0
                      : Math.max(1, Math.ceil((count / pickerMonthMax) * 4))
                  const selected =
                    selectedMonth.year === pickerYear &&
                    selectedMonth.month === month &&
                    timeMode === 'month'
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`month-heat-${heatLevel} ${
                        selected ? 'active' : ''
                      }`}
                      aria-label={`${label} ${pickerYear}: ${count} signals`}
                      title={`${count} signal${count === 1 ? '' : 's'}`}
                      onClick={() => {
                        setSelectedMonth({ year: pickerYear, month })
                        setTimeMode('month')
                        setMonthPickerOpen(false)
                      }}
                    >
                      <span>{label}</span>
                      <small>{count}</small>
                    </button>
                  )
                },
              )}
            </div>
            <div className="month-picker-legend" aria-hidden="true">
              <span>Fewer</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <i className={`month-heat-${level}`} key={level} />
              ))}
              <span>More</span>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={`app-shell focus-${focus} page-${workspacePage} ${
        headerHidden ? 'banner-hidden' : ''
      }`}
    >
      <header className="top-navigation">
        <p className="brand-title">Qira Strategic Market Intelligence</p>
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
            Synthesis
          </button>
        </nav>
        {renderGlobalSearch()}
        <button
          className="top-add-news"
          type="button"
          onClick={() => setShowAddLink(true)}
        >
          + Add News
        </button>
        <div className="sync-status top-sync-status">
          <span className={`status-dot ${syncState}`} />
          {cloudConfigured
            ? syncState === 'synced'
              ? 'Synced'
              : syncState === 'error'
                ? 'Sync interrupted'
                : 'Connecting'
            : 'Demo'}
        </div>
        <div className="profile-shell">
          <button
            className="avatar-button"
            type="button"
            aria-label="Open profile menu"
            aria-expanded={profileMenuOpen}
            title={identity?.displayName || 'Demo user'}
            onClick={() => setProfileMenuOpen((open) => !open)}
          >
            {(identity?.displayName || 'DU')
              .split(/\s+/)
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </button>
          {profileMenuOpen ? (
            <div className="profile-menu" role="menu">
              <div className="profile-summary">
                <strong>{identity?.displayName || 'Demo user'}</strong>
                <span>{identity?.email || 'Local demo workspace'}</span>
              </div>
              {canAdmin && cloudConfigured ? (
                <>
                  <button type="button" role="menuitem" onClick={() => void openTeamManagement()}>
                    Team
                  </button>
                  <button type="button" role="menuitem" onClick={() => setShowRecycleBin(true)}>
                    Recycle Bin
                  </button>
                </>
              ) : null}
              <button type="button" role="menuitem" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="workspace-main">
        {workspacePage === 'signals' ? (
          <header className="page-context-bar">{renderTimeFilter()}</header>
        ) : null}

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
                const newCount = items.filter(isNewSignal).length
                return (
                  <section
                    className={`category-panel cat-${category} ${
                      draggedNewsId ? 'accepting-signal' : ''
                    } ${dropHighlight === category ? 'drop-highlight' : ''}`}
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
                      {newCount > 0 ? (
                        <span className="new-count-badge">{newCount} new</span>
                      ) : null}
                    </header>
                    <div className="news-list signal-scroll">
                      {preview.map((item) =>
                        renderNoteCard(item, {
                          variant: 'live',
                          dropCategory: category,
                        }),
                      )}
                    </div>
                    {items.length > 0 ? (
                      <button
                        type="button"
                        className="view-all-link"
                        aria-label={`View all ${categoryLabels[category]}`}
                        onClick={() => setCategoryDrawer(category)}
                      >
                        View all →
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
          <div
            className={`synthesis-workbench ${
              workspacePage === 'threads'
                ? 'threads-expanded'
                : evidenceInboxOpen
                  ? 'evidence-expanded'
                  : 'evidence-collapsed'
            }`}
          >
            {workspacePage === 'synthesis' &&
              (evidenceInboxOpen ? (
                renderEvidenceColumn()
              ) : (
                <button
                  className="evidence-collapsed-rail"
                  type="button"
                  aria-label="Expand Evidence"
                  onClick={() => setEvidenceInboxOpen(true)}
                >
                  <span>Evidence</span>
                  <strong>{news.filter((item) => !item.deletedAt && !item.archivedAt).length}</strong>
                  <i aria-hidden="true">›</i>
                </button>
              ))}
            {workspacePage === 'synthesis' && (
              <section
                className="news-pane trend-briefing-pane workflow-column"
                aria-label="Trends"
              >
                <div className="workflow-column-heading">
                  <h1>Trends</h1>
                  <div className="heading-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => openNewTrend()}
                      hidden={!canEdit}
                    >
                      + New Trend
                    </button>
                    <button
                      className="primary-button meeting-start"
                      type="button"
                      onClick={() => {
                        setQuery('')
                        setTrendMeetingIndex(0)
                        setTrendMeetingMode(true)
                      }}
                    >
                      Start trend meeting · {trendMeetingQueue.length}
                    </button>
                  </div>
                </div>
                <div className="column-filter" role="group" aria-label="Trend category">
                  <button
                    type="button"
                    className={trendCategory === 'all' ? 'active' : ''}
                    aria-pressed={trendCategory === 'all'}
                    onClick={() => setTrendCategory('all')}
                  >
                    All
                  </button>
                  {liveSignalCategories.map((category) => (
                    <button
                      type="button"
                      key={category}
                      className={trendCategory === category ? 'active' : ''}
                      aria-pressed={trendCategory === category}
                      onClick={() => setTrendCategory(category)}
                    >
                      {categoryLabels[category]}
                    </button>
                  ))}
                </div>
                <div
                  className={`column-drop-zone ${draggedNewsId || draggedTopicId ? 'active' : ''}`}
                  onDragOver={(event) => {
                    if (!draggedNewsId && !draggedTopicId) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = draggedTopicId ? 'move' : 'copy'
                  }}
                  onDrop={(event) => {
                    const topicId =
                      event.dataTransfer.getData('application/x-topic-id') || draggedTopicId
                    if (topicId) {
                      const topic = topics.find((candidate) => candidate.id === topicId)
                      event.preventDefault()
                      if (topic) openCreateTrendFromTopic(topic)
                      setDraggedTopicId('')
                      return
                    }
                    const newsId =
                      event.dataTransfer.getData('application/x-news-id') || draggedNewsId
                    if (!newsId) return
                    event.preventDefault()
                    openNewTrend(newsId)
                    setDraggedNewsId('')
                  }}
                >
                  Drop evidence to create a Trend
                </div>
                <div
                  className="trend-grid"
                  onDragOver={(event) => {
                    const trend = trends.find((candidate) => candidate.id === draggedTrendId)
                    if (trend?.status !== 'archived') return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(event) => {
                    const trendId =
                      event.dataTransfer.getData('application/x-trend-id') || draggedTrendId
                    const trend = trends.find((candidate) => candidate.id === trendId)
                    if (trend?.status !== 'archived') return
                    event.preventDefault()
                    void setTrendArchived(trend.id, false, true)
                    setDraggedTrendId('')
                  }}
                >
                  {briefingTrends.map((trend) => renderTrendCard(trend))}
                  {briefingTrends.length === 0 && (
                    <div className="month-empty">
                      <strong>No Trends in this view yet.</strong>
                      <p>Expand Evidence and drag a signal here to create one.</p>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => setEvidenceInboxOpen(true)}
                      >
                        Expand Evidence
                      </button>
                    </div>
                  )}
                  {archivedTrends.length > 0 ? (
                    <details
                      className="archived-collection archived-trends"
                      open={archivedTrendsOpen}
                      onToggle={(event) => setArchivedTrendsOpen(event.currentTarget.open)}
                    >
                      <summary>Archived Trends · {archivedTrends.length}</summary>
                      <div className="archived-card-list">
                        {archivedTrends.map((trend) => renderTrendCard(trend))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </section>
            )}
            <section
              className="topic-pane workflow-column"
              aria-label="Action Threads"
            >
              <div className="workflow-column-heading">
                <h1>Action Threads</h1>
                <div className="heading-actions">
                  {workspacePage === 'synthesis' && (
                    <button
                      className="icon-button expand-threads"
                      type="button"
                      title="Open Action Threads dashboard"
                      aria-label="Open Action Threads dashboard"
                      onClick={() => setWorkspacePage('threads')}
                    >
                      View all
                    </button>
                  )}
                  {workspacePage === 'threads' && (
                    <button
                      className="text-action breadcrumb-link"
                      type="button"
                      onClick={() => setWorkspacePage('synthesis')}
                    >
                      ← Synthesis
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    type="button"
                    title="Create Action Thread"
                    onClick={() => openCreateThread()}
                    hidden={!canEdit}
                  >
                    + New Action Thread
                  </button>
                </div>
              </div>
              <div className="topic-scope-toggle column-filter" aria-label="Destination">
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
                  <div className="toolbar-field status-toolbar-field">
                    <span>Status</span>
                    <div
                      className="status-filter"
                      role="group"
                      aria-label="Status"
                    >
                      {(
                        [
                          ['all', 'All'],
                          ...Object.entries(threadStatusLabels),
                        ] as Array<[ThreadStatusFilter, string]>
                      ).map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={
                            threadStatusFilter === value ? 'active' : ''
                          }
                          aria-pressed={threadStatusFilter === value}
                          onClick={() => setThreadStatusFilter(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
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
                  <div className="toolbar-field group-toolbar-field">
                    <span>View</span>
                    <div
                      className="group-view-filter"
                      role="group"
                      aria-label="Thread view"
                    >
                      <button
                        type="button"
                        className={threadGroupMode === 'timeline' ? 'active' : ''}
                        aria-pressed={threadGroupMode === 'timeline'}
                        onClick={() => setThreadGroupMode('timeline')}
                      >
                        By month
                      </button>
                      <button
                        type="button"
                        className={threadGroupMode === 'category' ? 'active' : ''}
                        aria-pressed={threadGroupMode === 'category'}
                        onClick={() => setThreadGroupMode('category')}
                      >
                        By category
                      </button>
                      <button
                        type="button"
                        className={threadGroupMode === 'recent' ? 'active' : ''}
                        aria-pressed={threadGroupMode === 'recent'}
                        onClick={() => setThreadGroupMode('recent')}
                      >
                        Most recent
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {workspacePage === 'synthesis' && (
                <div
                  className={`column-drop-zone ${draggedNewsId || draggedTrendId ? 'active' : ''}`}
                  onDragOver={(event) => {
                    if (!draggedNewsId && !draggedTrendId) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = draggedTrendId ? 'move' : 'copy'
                  }}
                  onDrop={(event) => {
                    const trendId =
                      event.dataTransfer.getData('application/x-trend-id') || draggedTrendId
                    if (trendId) {
                      const trend = trends.find((candidate) => candidate.id === trendId)
                      event.preventDefault()
                      if (trend && trend.status !== 'archived') {
                        openCreateThreadFromTrend(trend)
                      }
                      setDraggedTrendId('')
                      return
                    }
                    const newsId =
                      event.dataTransfer.getData('application/x-news-id') || draggedNewsId
                    if (!newsId) return
                    event.preventDefault()
                    openCreateThread(newsId)
                    setDraggedNewsId('')
                  }}
                >
                  Drop evidence to create an Action Thread
                </div>
              )}
              {workspacePage === 'threads' && threadGroupMode === 'timeline' ? (
                <div
                  className="thread-timeline-board"
                  aria-label="Action Threads grouped by work month"
                >
                  <section className="timeline-scheduled-column">
                    <header className="timeline-column-heading">
                      <div>
                        <h2>Work by month</h2>
                        <p>
                          Active threads use a focus month; closed threads use
                          their completion month. It is not a deadline.
                        </p>
                      </div>
                      <span className="count-badge">
                        {visibleTopics.length - timelineTopicGroups.unscheduled.length}
                      </span>
                    </header>
                    <div className="timeline-month-stack">
                      {timelineTopicGroups.months.map(({ monthKey, topics: monthTopics }) => (
                        <section
                          className={`timeline-month-lane ${
                            draggedTopicId ? 'accepting-topic' : ''
                          }`}
                          key={monthKey}
                          onDragOver={(event) => {
                            if (!draggedTopicId) return
                            event.preventDefault()
                            event.dataTransfer.dropEffect = 'move'
                          }}
                          onDrop={(event) => {
                            const topicId =
                              event.dataTransfer?.getData(
                                'application/x-topic-id',
                              ) || draggedTopicId
                            if (!topicId) return
                            event.preventDefault()
                            event.stopPropagation()
                            void reassignTopicMonth(topicId, monthKey)
                            setDraggedTopicId('')
                          }}
                        >
                          <header>
                            <h3>{formatThreadMonth(monthKey)}</h3>
                            <span>{monthTopics.length}</span>
                          </header>
                          <div className="timeline-month-grid">
                            {monthTopics.map((topic) => renderTopicCard(topic))}
                          </div>
                        </section>
                      ))}
                      {timelineTopicGroups.months.length === 0 ? (
                        <div className="timeline-empty">
                          Assign a work month to move a thread out of the backlog.
                        </div>
                      ) : null}
                    </div>
                  </section>
                  <section
                    className={`timeline-unscheduled-column ${
                      draggedTopicId ? 'accepting-topic' : ''
                    }`}
                    onDragOver={(event) => {
                      if (!draggedTopicId) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(event) => {
                      const topicId =
                        event.dataTransfer?.getData(
                          'application/x-topic-id',
                        ) || draggedTopicId
                      if (!topicId) return
                      event.preventDefault()
                      event.stopPropagation()
                      void reassignTopicMonth(topicId, '')
                      setDraggedTopicId('')
                    }}
                  >
                    <header className="timeline-column-heading">
                      <div>
                        <h2>Unscheduled</h2>
                        <p>Backlog threads without a chosen focus month.</p>
                      </div>
                      <span className="count-badge">
                        {timelineTopicGroups.unscheduled.length}
                      </span>
                    </header>
                    <div className="timeline-unscheduled-list">
                      {timelineTopicGroups.unscheduled.map((topic) =>
                        renderTopicCard(topic),
                      )}
                      {timelineTopicGroups.unscheduled.length === 0 ? (
                        <div className="timeline-empty">
                          Drop a thread here to remove its month.
                        </div>
                      ) : null}
                    </div>
                  </section>
                </div>
              ) : workspacePage === 'threads' && threadGroupMode === 'category' ? (
                <div
                  className="thread-groups"
                  aria-label="Action Threads grouped by category"
                >
                  {liveSignalCategories.map((category) => {
                    const categoryTopics = visibleTopics.filter(
                      (topic) => topic.category === category,
                    )
                    if (categoryTopics.length === 0) return null
                    return (
                      <section
                        className={`thread-category-group cat-${category} ${
                          draggedTopicId ? 'accepting-topic' : ''
                        }`}
                        key={category}
                        onDragOver={(event) => {
                          if (!draggedTopicId) return
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(event) => {
                          const topicId =
                            event.dataTransfer?.getData(
                              'application/x-topic-id',
                            ) || draggedTopicId
                          if (!topicId) return
                          event.preventDefault()
                          event.stopPropagation()
                          void reassignTopicCategory(topicId, category)
                          setDraggedTopicId('')
                        }}
                      >
                        <header>
                          <h2>
                            <span className="cat-dot" aria-hidden="true" />
                            {categoryLabels[category]}
                          </h2>
                          <span className="count-badge">
                            {categoryTopics.length}
                          </span>
                        </header>
                        <div className="thread-category-grid">
                          {categoryTopics.map((topic) => renderTopicCard(topic))}
                        </div>
                      </section>
                    )
                  })}
                  {visibleTopics.length === 0 && (
                    <div className="month-empty">
                      No Action Threads in this filter yet.
                    </div>
                  )}
                </div>
              ) : (
                <div className="topic-list kind-pipeline">
                  {visibleTopics.map((topic) => renderTopicCard(topic))}
                  {visibleTopics.length === 0 && (
                    <div className="month-empty">
                      No Action Threads in this filter yet.
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
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
            <div className="modal-body">
              <section className="modal-section">
                <h3>Signal basics</h3>
                <div className="signal-provenance">
                  <span className={`review-state review-${newsDraft.editorialStatus}`}>
                    {newsDraft.editorialStatus === 'processed'
                      ? 'AI reviewed'
                      : newsDraft.editorialStatus === 'failed'
                        ? 'AI review failed'
                        : 'Awaiting AI review'}
                  </span>
                  <span>Added {formatShortDate(newsDraft.capturedAt)}</span>
                  {newsDraft.source ? <span>{newsDraft.source}</span> : null}
                  {newsDraft.topicLinks.length > 0 ? (
                    <span>{newsDraft.topicLinks.length} linked thread{newsDraft.topicLinks.length === 1 ? '' : 's'}</span>
                  ) : null}
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
                <div className="form-grid two-col">
                  <label>
                    Category
                    <select
                      value={newsDraft.category}
                      onChange={(event) =>
                        setNewsDraft({ ...newsDraft, category: event.target.value as NewsCategory })
                      }
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Contributor
                    <input
                      value={newsDraft.capturedBy}
                      onChange={(event) => setNewsDraft({ ...newsDraft, capturedBy: event.target.value })}
                      placeholder="Who shared this?"
                    />
                  </label>
                </div>
                <label className="compact-field">
                  Publication date <span className="optional-label">optional</span>
                  <input
                    type="date"
                    value={newsDraft.publishedAt?.slice(0, 10) || ''}
                    onChange={(event) => setNewsDraft({ ...newsDraft, publishedAt: event.target.value || undefined })}
                  />
                </label>
              </section>
              <section className="modal-section">
                <h3>Editorial review</h3>
                <p className="section-hint">Edit the source summary and the short takeaway shown on cards. System fields and raw article text stay hidden.</p>
                <label>
                  Source summary
                  <textarea rows={4} value={newsDraft.summary} onChange={(event) => setNewsDraft({ ...newsDraft, summary: event.target.value })} />
                </label>
                <label>
                  Editorial takeaway
                  <textarea rows={3} value={newsDraft.takeaway} onChange={(event) => setNewsDraft({ ...newsDraft, takeaway: event.target.value })} placeholder="15–20 words: the consequence or strongest highlighted point" />
                </label>
                <NewsAnalysis metadata={newsDraft.metadata} />
              </section>
              <section className="modal-section workspace-section">
                <h3>Workspace</h3>
                {newsDraft.topicLinks.length > 0 ? (
                  <div className="linked-topic-summary">
                    {newsDraft.topicLinks.map((link) => <span key={link.topicId}>{link.topicTitle}</span>)}
                  </div>
                ) : <p className="section-hint">Not linked to an action thread yet.</p>}
                <ActivityHistory events={activity} />
              </section>
            </div>
            <div className="modal-actions split-actions sticky-footer news-editor-footer">
              <label className="archive-control compact-archive">
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
                <strong>Archive</strong>
              </span>
              </label>
              <div className="editor-button-group">
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

      {trendDraft && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="link-modal editor-modal trend-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-trend-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Intelligence layer</span>
                <h2 id="edit-trend-title">
                  {creatingTrend ? 'Create Trend' : 'Edit Trend'}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close"
                onClick={() => {
                  setTrendDraft(null)
                  setCreatingTrend(false)
                  setPendingTrendNewsId('')
                  setPendingTrendTopicId('')
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <section className="modal-section">
                <h3>Trend framing</h3>
                <label>
                  <span>
                    Trend title <span className="required-mark" aria-hidden="true">*</span>
                  </span>
                  <input
                    value={trendDraft.title}
                    onChange={(event) =>
                      setTrendDraft({ ...trendDraft, title: event.target.value })
                    }
                    placeholder="Name the emerging change, not an individual article"
                    autoFocus
                    required
                  />
                  <small className="field-hint">
                    Required. Write the pattern the team should recognize.
                  </small>
                </label>
                <div className="form-grid one-col">
                  <label>
                    Primary category
                    <select
                      value={trendDraft.category}
                      onChange={(event) =>
                        setTrendDraft({
                          ...trendDraft,
                          category: event.target.value as NewsCategory,
                        })
                      }
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="workflow-note">
                  A Trend stays in Watching until it is upgraded to an Action Thread or dismissed.
                </p>
                {!creatingTrend && trendDraft.status !== 'archived' ? (
                  <div className="trend-editor-lifecycle">
                    <span>
                      {isTrendToDiscuss(trendDraft)
                        ? 'Included in Trend meeting'
                        : 'Not in Trend meeting'}
                    </span>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        void setTrendMeetingIncluded(
                          trendDraft,
                          !isTrendToDiscuss(trendDraft),
                        )
                      }
                    >
                      {isTrendToDiscuss(trendDraft)
                        ? 'Remove from meeting'
                        : 'Add to meeting'}
                    </button>
                  </div>
                ) : null}
                <label>
                  What changed
                  <textarea
                    rows={3}
                    value={trendDraft.observation}
                    onChange={(event) =>
                      setTrendDraft({ ...trendDraft, observation: event.target.value })
                    }
                    placeholder="Describe the repeated market or product movement supported by the evidence."
                  />
                </label>
                <label>
                  Initial read
                  <textarea
                    rows={3}
                    value={trendDraft.initialRead}
                    onChange={(event) =>
                      setTrendDraft({ ...trendDraft, initialRead: event.target.value })
                    }
                    placeholder="What might this mean? Keep it provisional until the team discusses it."
                  />
                </label>
                <label>
                  Discussion question
                  <textarea
                    rows={2}
                    value={trendDraft.discussionQuestion}
                    onChange={(event) =>
                      setTrendDraft({
                        ...trendDraft,
                        discussionQuestion: event.target.value,
                      })
                    }
                    placeholder="What judgment or decision should the team make?"
                  />
                </label>
              </section>
              <section className="modal-section">
                <h3>Supporting evidence</h3>
                <p className="modal-note">
                  Article titles open the original source. Evidence can also be curated from the Evidence Inbox.
                </p>
                <div className="trend-editor-evidence">
                  {trendDraft.evidence
                    .slice()
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((link) => {
                      const item = news.find((candidate) => candidate.id === link.newsId)
                      if (!item || item.deletedAt) return null
                      return (
                        <div key={item.id}>
                          {item.url && item.sourceType !== 'manual_note' ? (
                            <a href={item.url} target="_blank" rel="noreferrer">
                              {item.title}
                            </a>
                          ) : (
                            <span>{item.title}</span>
                          )}
                          <button
                            className="text-action"
                            type="button"
                            onClick={() => void unlinkSignalFromTrend(trendDraft.id, item.id)}
                            hidden={!canEdit || creatingTrend}
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  {pendingTrendNewsId ? (
                    <p className="pending-evidence-note">
                      This Trend will start with the selected signal as evidence.
                    </p>
                  ) : null}
                  {trendDraft.evidence.length === 0 && !pendingTrendNewsId ? (
                    <p className="linked-empty">No evidence linked yet.</p>
                  ) : null}
                </div>
              </section>
            </div>
            <div className="modal-actions split-actions sticky-footer">
              {!creatingTrend ? (
                <div className="destructive-actions">
                  <button
                    className={trendDraft.status === 'archived' ? 'secondary-button' : 'danger-button'}
                    type="button"
                    onClick={() =>
                      void setTrendArchived(
                        trendDraft.id,
                        trendDraft.status !== 'archived',
                      )
                    }
                    hidden={!canEdit}
                  >
                    {trendDraft.status === 'archived' ? 'Unarchive Trend' : 'Archive Trend'}
                  </button>
                  <button
                    className="text-danger-button"
                    type="button"
                    onClick={() => void deleteTrend(trendDraft.id)}
                    hidden={!canEdit}
                  >
                    Delete Trend
                  </button>
                </div>
              ) : (
                <span />
              )}
              <div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setTrendDraft(null)
                    setCreatingTrend(false)
                    setPendingTrendNewsId('')
                    setPendingTrendTopicId('')
                  }}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void saveTrendDraft()}
                  disabled={!trendDraft.title.trim()}
                >
                  {creatingTrend ? 'Create Trend' : 'Save changes'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {trendMeetingMode && (
        <div className="modal-backdrop meeting-backdrop" role="presentation">
          <section
            className="meeting-modal trend-meeting-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trend-meeting-title"
          >
            <header className="meeting-header">
              <div>
                <span className="eyebrow">Team discussion</span>
                <h2 id="trend-meeting-title">Trend review</h2>
              </div>
              <div className="meeting-progress">
                {trendMeetingQueue.length > 0
                  ? `${Math.min(trendMeetingIndex + 1, trendMeetingQueue.length)} of ${trendMeetingQueue.length}`
                  : 'Complete'}
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close meeting"
                onClick={() => setTrendMeetingMode(false)}
              >
                ×
              </button>
            </header>
            {trendMeetingItem ? (
              <div className="meeting-content trend-meeting-content">
                <div className="meeting-signal-meta">
                  <CategoryLabel category={trendMeetingItem.category} />
                  <span>{trendMeetingItem.evidence.length} supporting signals</span>
                  {trendMeetingItem.actionThreadIds.length > 0 ? (
                    <span className="state-in-thread">
                      Already in {trendMeetingItem.actionThreadIds.length} Action Thread{trendMeetingItem.actionThreadIds.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>
                <h3>{trendMeetingItem.title}</h3>
                <div className="trend-meeting-framing">
                  <div>
                    <strong>What changed</strong>
                    <p>{trendMeetingItem.observation || 'No observation recorded yet.'}</p>
                  </div>
                  <div>
                    <strong>Initial read</strong>
                    <p>{trendMeetingItem.initialRead || 'No initial read recorded yet.'}</p>
                  </div>
                  <div>
                    <strong>Question for the team</strong>
                    <p>{trendMeetingItem.discussionQuestion || 'What should the team conclude or do next?'}</p>
                  </div>
                </div>
                <div className="trend-meeting-evidence">
                  <strong>Supporting evidence</strong>
                  {trendMeetingItem.evidence
                    .slice()
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((link) => news.find((item) => item.id === link.newsId))
                    .filter((item): item is NewsItem => Boolean(item && !item.deletedAt))
                    .map((item) =>
                      item.url && item.sourceType !== 'manual_note' ? (
                        <a href={item.url} target="_blank" rel="noreferrer" key={item.id}>
                          {item.title}
                        </a>
                      ) : (
                        <span key={item.id}>{item.title}</span>
                      ),
                    )}
                </div>
              </div>
            ) : (
              <div className="meeting-complete">
                <span aria-hidden="true">✓</span>
                <h3>Trend discussion complete</h3>
                <p>Every visible Trend has a recorded discussion outcome.</p>
              </div>
            )}
            <footer className="meeting-actions">
              {trendMeetingIndex > 0 && trendMeetingQueue.length > 0 ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setTrendMeetingIndex((index) => Math.max(0, index - 1))}
                >
                  Back
                </button>
              ) : (
                <span className="meeting-queue-note">Trend discussion queue</span>
              )}
              <div>
                {trendMeetingItem ? (
                  <>
                    {trendMeetingItem.actionThreadIds.length > 0 ? (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          const topic = topics.find(
                            (candidate) =>
                              candidate.id === trendMeetingItem.actionThreadIds[0],
                          )
                          if (!topic) return
                          setMeetingThreadTrendId(trendMeetingItem.id)
                          setTrendMeetingMode(false)
                          setCreatingTopic(false)
                          setTopicDraft({ ...topic })
                        }}
                      >
                        Open Action Thread
                      </button>
                    ) : (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setTrendMeetingMode(false)
                          openCreateThreadFromTrend(trendMeetingItem, true)
                        }}
                      >
                        Create Action Thread
                      </button>
                    )}
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        void setTrendArchived(trendMeetingItem.id, true, true)
                      }
                    >
                      Archive Trend
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() =>
                        void setTrendDiscussionOutcome(trendMeetingItem, 'discussed')
                      }
                    >
                      Keep watching
                    </button>
                  </>
                ) : (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setTrendMeetingMode(false)}
                  >
                    Done
                  </button>
                )}
              </div>
            </footer>
          </section>
        </div>
      )}

      {meetingMode && (
        <div className="modal-backdrop meeting-backdrop" role="presentation">
          <section
            className="meeting-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-title"
          >
            <header className="meeting-header">
              <div>
                <span className="eyebrow">Team discussion</span>
                <h2 id="meeting-title">Signal review</h2>
              </div>
              <div className="meeting-progress">
                {meetingQueue.length > 0
                  ? `${Math.min(meetingIndex + 1, meetingQueue.length)} of ${meetingQueue.length}`
                  : 'Complete'}
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close meeting"
                onClick={() => setMeetingMode(false)}
              >
                ×
              </button>
            </header>
            {meetingItem ? (
              <div className="meeting-content">
                <div className="meeting-signal-meta">
                  <CategoryLabel category={meetingItem.category} />
                  <span>{meetingItem.capturedBy}</span>
                  {meetingItem.voteCount > 0 ? (
                    <span>↑ {meetingItem.voteCount} recommend{meetingItem.voteCount === 1 ? '' : 's'}</span>
                  ) : null}
                  {meetingItem.ideaCount > 0 ? (
                    <span>{meetingItem.ideaCount} team thought{meetingItem.ideaCount === 1 ? '' : 's'}</span>
                  ) : null}
                  {meetingItem.topicLinks.length > 0 ? (
                    <span className="state-in-thread">
                      In Action Thread · {meetingItem.topicLinks[0].topicTitle}
                    </span>
                  ) : null}
                  {meetingItem.meetingNominatedAt ? (
                    <span>
                      Added by {meetingItem.meetingNominatedBy || 'editor'}
                    </span>
                  ) : null}
                </div>
                <h3>
                  {meetingItem.url && meetingItem.sourceType !== 'manual_note' ? (
                    <a href={meetingItem.url} target="_blank" rel="noreferrer">
                      {meetingItem.title}
                    </a>
                  ) : (
                    meetingItem.title
                  )}
                </h3>
                {meetingItem.teamSynthesis ? (
                  <div className="meeting-takeaway team">
                    <strong>Team synthesis</strong>
                    <p>{meetingItem.teamSynthesis}</p>
                  </div>
                ) : meetingItem.takeaway ? (
                  <div className="meeting-takeaway">
                    <strong>Editorial takeaway</strong>
                    <p>{meetingItem.takeaway}</p>
                  </div>
                ) : null}
                {meetingItem.industryImportance ? (
                  <div className="meeting-why">
                    <strong>Why it matters</strong>
                    <p>{meetingItem.industryImportance}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="meeting-complete">
                <span aria-hidden="true">✓</span>
                <h3>Discussion queue complete</h3>
                <p>Every visible signal has a recorded discussion outcome.</p>
              </div>
            )}
            <footer className="meeting-actions">
              {meetingIndex > 0 && meetingQueue.length > 0 ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setMeetingIndex((index) => Math.max(0, index - 1))}
                >
                  Back
                </button>
              ) : (
                <span className="meeting-queue-note">Team discussion queue</span>
              )}
              <div>
                {meetingItem ? (
                  <>
                    <button
                      className="text-action"
                      type="button"
                      onClick={() =>
                        setMeetingIndex((index) =>
                          meetingQueue.length ? (index + 1) % meetingQueue.length : 0,
                        )
                      }
                    >
                      Defer
                    </button>
                    {meetingItem.topicLinks.length > 0 ? (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          const topic = topics.find(
                            (candidate) =>
                              candidate.id === meetingItem.topicLinks[0].topicId,
                          )
                          if (!topic) return
                          setMeetingThreadNewsId(meetingItem.id)
                          setMeetingMode(false)
                          setCreatingTopic(false)
                          setTopicDraft({ ...topic })
                        }}
                      >
                        Open Action Thread
                      </button>
                    ) : (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setMeetingThreadNewsId(meetingItem.id)
                          setMeetingMode(false)
                          openCreateThread(meetingItem.id)
                        }}
                      >
                        Create Action Thread
                      </button>
                    )}
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void setDiscussionOutcome(meetingItem, 'dismissed')}
                    >
                      Dismiss from discussion
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void setDiscussionOutcome(meetingItem, 'discussed')}
                    >
                      {meetingItem.topicLinks.length > 0
                        ? 'Discussed · keep linked'
                        : 'Discussed · no Action Thread'}
                    </button>
                  </>
                ) : (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setMeetingMode(false)}
                  >
                    Done
                  </button>
                )}
              </div>
            </footer>
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
              <h2 id="add-idea-title">Add a thought</h2>
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
                <span className="sr-only">Thought</span>
              <textarea
                rows={4}
                value={ideaText}
                onChange={(event) => setIdeaText(event.target.value)}
                placeholder="What should the team notice or discuss about this signal?"
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
                onClick={closeTopicEditor}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <section className="modal-section">
                <h3>Thread basics</h3>
                <label>
                  <span>
                    Thread title <span className="required-mark" aria-hidden="true">*</span>
                  </span>
                  <input
                    value={topicDraft.title}
                    onChange={(event) =>
                      setTopicDraft({ ...topicDraft, title: event.target.value })
                    }
                    placeholder="What decision or direction does this thread hold?"
                    autoFocus
                    required
                    aria-required="true"
                  />
                  {creatingTopic ? (
                    <small className="field-hint">Title, destination, and owner are required.</small>
                  ) : null}
                </label>
                <div className="thread-classification-grid">
                  <fieldset className="choice-field">
                    <legend>
                      Destination <span className="required-mark" aria-hidden="true">*</span>
                    </legend>
                    <div className="option-pills" aria-label="Destination">
                      {Object.entries(topicKindLabels).map(([value, label]) => (
                        <button
                          type="button"
                          className={topicDraft.kind === value ? 'active' : ''}
                          aria-pressed={topicDraft.kind === value}
                          key={value}
                          onClick={() =>
                            setTopicDraft({ ...topicDraft, kind: value as TopicKind })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="choice-field">
                    <legend>Category</legend>
                    <div className="option-pills category-option-pills" aria-label="Category">
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <button
                          type="button"
                          className={`cat-${value} ${topicDraft.category === value ? 'active' : ''}`}
                          aria-pressed={topicDraft.category === value}
                          key={value}
                          onClick={() =>
                            setTopicDraft({
                              ...topicDraft,
                              category: value as NewsCategory,
                            })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className="form-grid two-col thread-schedule-grid">
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
                    {topicDraft.threadStatus === 'closed'
                      ? 'Completed month'
                      : 'Work month'}
                    <input
                      aria-label={
                        topicDraft.threadStatus === 'closed'
                          ? 'Completed month'
                          : 'Work month'
                      }
                      type="month"
                      value={topicDraft.monthKey}
                      onClick={(event) => event.currentTarget.showPicker?.()}
                      onFocus={(event) => event.currentTarget.showPicker?.()}
                      onChange={(event) =>
                        setTopicDraft({
                          ...topicDraft,
                          monthKey: event.target.value,
                          monthLabel: monthName(event.target.value),
                        })
                      }
                    />
                    <small className="field-hint">
                      {topicDraft.threadStatus === 'closed'
                        ? 'When this thread was completed.'
                        : 'When the team expects to focus on it—not a deadline.'}
                    </small>
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
              <section className="modal-section collaboration-section">
                <h3>Ownership and decision</h3>
                <div className="form-grid two-col">
                  <label>
                    <span>
                      Owner <span className="required-mark" aria-hidden="true">*</span>
                    </span>
                    <select
                      value={topicDraft.ownerId || ''}
                      onChange={(event) => {
                        const owner = teamMembers.find(
                          (member) => member.userId === event.target.value,
                        )
                        setTopicDraft({
                          ...topicDraft,
                          ownerId: event.target.value || undefined,
                          ownerName: owner?.displayName,
                        })
                      }}
                    >
                      <option value="">Unassigned</option>
                      {topicDraft.ownerId &&
                      !teamMembers.some((member) => member.userId === topicDraft.ownerId) ? (
                        <option value={topicDraft.ownerId}>
                          {topicDraft.ownerName || 'Current owner'}
                        </option>
                      ) : null}
                      {teamMembers.map((member) => (
                        <option value={member.userId} key={member.userId}>
                          {member.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Outcome link
                    <input
                      type="url"
                      value={topicDraft.outcomeUrl}
                      onChange={(event) =>
                        setTopicDraft({ ...topicDraft, outcomeUrl: event.target.value })
                      }
                      placeholder="https://…"
                    />
                  </label>
                </div>
                <label>
                  Team decision
                  <textarea
                    rows={2}
                    value={topicDraft.decisionSummary}
                    onChange={(event) =>
                      setTopicDraft({
                        ...topicDraft,
                        decisionSummary: event.target.value,
                      })
                    }
                    placeholder="What did the team agree, reject, or decide?"
                  />
                </label>
                <label>
                  Next step
                  <textarea
                    rows={2}
                    value={topicDraft.nextStep}
                    onChange={(event) =>
                      setTopicDraft({ ...topicDraft, nextStep: event.target.value })
                    }
                    placeholder="What happens next, and what should the owner produce?"
                  />
                </label>
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
                <div className="destructive-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => openCreateTrendFromTopic(topicDraft)}
                    hidden={!canEdit}
                  >
                    Move to Trend
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => void removeTopic(topicDraft.id)}
                    hidden={!canAdmin}
                  >
                    Delete thread
                  </button>
                </div>
              ) : (
                <span />
              )}
              <div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={closeTopicEditor}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void saveTopicDraft()}
                  disabled={
                    !topicDraft.title.trim() ||
                    (creatingTopic && !topicDraft.ownerId)
                  }
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
