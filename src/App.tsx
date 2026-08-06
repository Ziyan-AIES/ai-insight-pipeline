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
  loadNewsSourceText,
  loadTeamMembers,
  loadWorkspace,
  persistNewsLink,
  persistTopicMonth,
  persistTopicNews,
  restoreContent,
  subscribeToWorkspace,
  unlinkTopicNews,
  updateNewsItem,
  updateTeamMemberRole,
  updateThesisItem,
  updateTopicItem,
} from './supabase'
import type {
  FocusMode,
  NewsCategory,
  NewsItem,
  Thesis,
  Topic,
  TopicStatus,
  EditorialReadout,
  EditorialHealth,
  TeamMemberSummary,
  ActivityEvent,
} from './types'

const categoryLabels: Record<NewsCategory, string> = {
  interaction: 'Interaction',
  ai_software: 'AI software',
  ai_hardware: 'AI hardware',
  ecosystem: 'Ecosystem',
  ai_capability: 'AI capability',
  industry_events: 'Industry events',
}

const topicStatusLabels: Record<TopicStatus, string> = {
  idea: 'Idea',
  researching: 'Researching',
  scheduled: 'Scheduled',
  published: 'Published',
  completed: 'Completed',
  archived: 'Archived',
}

type NewsScope = 'all' | 'undecided' | 'pipeline' | 'archived' | 'removed'
type TopicScope = 'current' | 'all'
type AddLinkDraft = {
  open: boolean
  url: string
  title: string
  contributor: string
  targetTopicId: string
}
type NewsReaderState = {
  newsId: string
  status: 'loading' | 'ready' | 'error'
  text: string
}

const addLinkDraftKey = 'signal-intelligence:add-link-draft'

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
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
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

function weekLabel(key: string) {
  const [yearText, weekText] = key.split('-W')
  const year = Number(yearText)
  const week = Number(weekText)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const dateFormat = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return `Week ${week} · ${dateFormat.format(monday)}–${dateFormat.format(sunday)}`
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
  const [focus, setFocus] = useState<FocusMode>('split')
  const [period, setPeriod] = useState('all')
  const [newsScope, setNewsScope] = useState<NewsScope>('all')
  const [topicScope, setTopicScope] = useState<TopicScope>('current')
  const [category, setCategory] = useState<NewsCategory | 'all'>('all')
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
  const [draggedTopicId, setDraggedTopicId] = useState('')
  const [newsDraft, setNewsDraft] = useState<NewsItem | null>(null)
  const [newsReader, setNewsReader] = useState<NewsReaderState | null>(null)
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

  const buildLabel = useMemo(
    () => {
      const buildDate = new Date(
        import.meta.env.VITE_BUILD_DATE || new Date().toISOString(),
      )
      return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai',
      }).format(buildDate)
    },
    [],
  )

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
        const matchesCategory = category === 'all' || item.category === category
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
          `${item.title} ${item.summary} ${item.source}`
            .toLowerCase()
            .includes(needle)
        return matchesCategory && matchesPeriod && matchesScope && matchesQuery
      })
      .sort((a, b) => newsDate(b).localeCompare(newsDate(a)))
  }, [category, news, newsScope, period, query])

  const availableMonths = useMemo(
    () =>
      [...new Set(news.map((item) => newsDate(item).slice(0, 7)))].sort(
        (a, b) => b.localeCompare(a),
      ),
    [news],
  )

  const availableWeeks = useMemo(
    () =>
      [...new Set(news.map((item) => isoWeekKey(newsDate(item))))].sort(
        (a, b) => b.localeCompare(a),
      ),
    [news],
  )

  const monthGroups = useMemo(() => {
    const groups = new Map<string, Topic[]>()
    const currentMonth = new Date().toISOString().slice(0, 7)
    topics
      .filter((topic) => !topic.deletedAt)
      .filter(
        (topic) => topicScope === 'all' || topic.monthKey >= currentMonth,
      )
      .filter(
        (topic) =>
          focus !== 'topics' ||
          !selectedThesisId ||
          topic.thesisId === selectedThesisId,
      )
      .slice()
      .sort(
        (a, b) =>
          a.monthKey.localeCompare(b.monthKey) ||
          a.displayOrder - b.displayOrder,
      )
      .forEach((topic) => {
        const group = groups.get(topic.monthKey) ?? []
        group.push(topic)
        groups.set(topic.monthKey, group)
      })
    return [...groups.entries()]
  }, [focus, selectedThesisId, topicScope, topics])

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

  async function moveTopic(topicId: string, monthKey: string) {
    const existingTopic = topics.find((topic) => topic.id === topicId)
    let version = existingTopic?.version
    try {
      if (cloudConfigured) {
        version = await persistTopicMonth(
          topicId,
          monthKey,
          existingTopic?.version,
        )
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not move topic')
      return
    }
    setTopics((current) =>
      current.map((topic) =>
        topic.id === topicId
          ? { ...topic, monthKey, monthLabel: monthName(monthKey), version }
          : topic,
      ),
    )
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

  function openNewThesis() {
    setCreatingThesis(true)
    setThesisDraft({
      id: '',
      title: '',
      description: '',
      horizon: '12–24 months',
      topicIds: [],
    })
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
      setTopicScope('all')
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
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setCreatingTopic(true)
    setTopicDraft({
      id: '',
      title: '',
      monthKey,
      monthLabel: monthName(monthKey),
      category: 'ai_capability',
      status: 'idea',
      notes: '',
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
            status: topicDraft.status,
            monthKey: topicDraft.monthKey,
            thesisId: topicDraft.thesisId,
          })) || `topic-${Date.now()}`
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not create topic')
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
      setNotice('Topic created')
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
            status: topicDraft.status,
            scheduled_month: `${topicDraft.monthKey}-01`,
            thesis_id: topicDraft.thesisId || null,
          },
          topicDraft.version,
        )
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not save topic')
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
      category: 'ecosystem',
      capturedAt: new Date().toISOString(),
      capturedBy: contributorName,
      metadata: { contributor_name: contributorName },
      editorialStatus: 'pending',
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

  async function toggleNewsReader(item: NewsItem) {
    if (newsReader?.newsId === item.id) {
      setNewsReader(null)
      return
    }
    setNewsReader({
      newsId: item.id,
      status: 'loading',
      text: '',
    })
    try {
      const text = await loadNewsSourceText(item.id)
      setNewsReader((current) =>
        current?.newsId === item.id
          ? { newsId: item.id, status: 'ready', text }
          : current,
      )
    } catch {
      setNewsReader((current) =>
        current?.newsId === item.id
          ? { newsId: item.id, status: 'error', text: '' }
          : current,
      )
    }
  }

  return (
    <div
      className={`app-shell focus-${focus} ${
        headerHidden ? 'banner-hidden' : ''
      }`}
    >
      <header className="topbar" title="Scroll either pane to the top to show this banner">
        <div className="brand">
          <span className="brand-mark">SI</span>
          <div>
            <strong>Signal Intelligence</strong>
            <span>Version {buildLabel} · Beijing time</span>
          </div>
        </div>
        <div className="sync-status">
          <span className={`status-dot ${syncState}`} />
          {cloudConfigured
            ? syncState === 'synced'
              ? 'Private team workspace · synced'
              : syncState === 'error'
                ? 'Sync interrupted · retrying'
                : 'Connecting to team workspace'
            : 'Demo workspace · cloud setup pending'}
        </div>
        <div className="account-actions">
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
                Recycle bin (
                {removedItems.news.length +
                  removedItems.topics.length +
                  removedItems.theses.length}
                )
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

      <main className="dashboard">
        {focus !== 'topics' && (
          <section
            className="news-pane"
            aria-label="News dashboard"
            onScroll={(event) =>
              setHeaderHidden(event.currentTarget.scrollTop > 16)
            }
          >
            <div className="pane-heading">
              <div>
                <span className="eyebrow">Signal stream</span>
                <h1>News</h1>
              </div>
              <div className="heading-actions">
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setFocus(focus === 'news' ? 'split' : 'news')}
                  aria-label={
                    focus === 'news' ? 'Restore split view' : 'Maximize news'
                  }
                >
                  {focus === 'news' ? '↙' : '↗'}
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setShowAddLink(true)}
                >
                  + Add link
                </button>
              </div>
            </div>

            <div className="filters">
              <label className="search-field">
                <span>Search</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search signals"
                />
              </label>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                aria-label="Filter by month or week"
              >
                <option value="all">All dates</option>
                <optgroup label="Weeks">
                  {availableWeeks.map((week) => (
                    <option value={`week:${week}`} key={week}>
                      {weekLabel(week)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Months">
                  {availableMonths.map((month) => (
                    <option value={`month:${month}`} key={month}>
                      {monthName(month)}
                    </option>
                  ))}
                </optgroup>
              </select>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as NewsCategory | 'all')
                }
                aria-label="Filter by category"
              >
                <option value="all">All topics</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={newsScope}
                onChange={(event) =>
                  setNewsScope(event.target.value as NewsScope)
                }
                aria-label="Filter by review status"
              >
                <option value="undecided">Undiscussed</option>
                <option value="pipeline">In pipeline</option>
                <option value="archived">Read & archived</option>
                <option value="all">All news</option>
                {canAdmin && <option value="removed">Removed</option>}
              </select>
            </div>

            <div className="readout">
              <div>
                <span className="eyebrow">Current readout</span>
                <strong>
                  {readout
                    ? `${readout.periodType} · ${readout.periodKey}`
                    : 'From captured signal to scheduled analysis'}
                </strong>
              </div>
              <div>
                <p>
                  {readout?.lede ||
                    'Drag a card into the topic pipeline when it becomes evidence for a new analysis. Its pipeline status remains visible here.'}
                </p>
                {readout && readout.bullets.length > 0 && (
                  <ul>
                    {readout.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
                {canEdit && editorialHealth && (
                  <small className={`editorial-health ${editorialHealth.status}`}>
                    Last editorial run: {editorialHealth.status} ·{' '}
                    {new Intl.DateTimeFormat('en', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(editorialHealth.startedAt))}
                    {editorialHealth.status === 'completed'
                      ? ` · ${editorialHealth.processedCount} processed`
                      : ''}
                  </small>
                )}
              </div>
            </div>

            <div className="news-list">
              {visibleNews.map((item) => (
                <article
                  className="news-card"
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    setDraggedNewsId(item.id)
                    event.dataTransfer.setData('application/x-news-id', item.id)
                  }}
                  onDragEnd={() => setDraggedNewsId('')}
                >
                  <div className="news-meta">
                    <span className={`category category-${item.category}`}>
                      {categoryLabels[item.category]}
                    </span>
                    <span>{item.source}</span>
                    <span>Shared by {item.capturedBy}</span>
                    <span>
                      {item.publishedAt ? 'Published ' : 'Added '}
                      {new Intl.DateTimeFormat('en', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(newsDate(item)))}
                    </span>
                    <div className="card-actions">
                      {item.deletedAt ? (
                        <button
                          type="button"
                          onClick={() =>
                            void restoreItem('news_items', item.id)
                          }
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setNewsDraft({ ...item })}
                          >
                            Edit
                          </button>
                          <button
                            className="danger-action"
                            type="button"
                            onClick={() => void removeNews(item.id)}
                            hidden={!canAdmin}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <h2>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                  </h2>
                  <p>{item.summary}</p>
                  <div className="source-actions">
                    <button
                      type="button"
                      aria-expanded={newsReader?.newsId === item.id}
                      onClick={() => void toggleNewsReader(item)}
                    >
                      {newsReader?.newsId === item.id
                        ? 'Close reader'
                        : 'Read captured text'}
                    </button>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Open source ↗
                    </a>
                  </div>
                  {newsReader?.newsId === item.id && (
                    <section
                      className="source-reader"
                      aria-label={`Captured text for ${item.title}`}
                    >
                      {newsReader.status === 'loading' ? (
                        <p>Loading captured text…</p>
                      ) : newsReader.status === 'error' ? (
                        <p>
                          Captured text could not be loaded. Use Open source to
                          read the original page.
                        </p>
                      ) : newsReader.text ? (
                        <pre>{newsReader.text}</pre>
                      ) : (
                        <p>
                          No captured text is stored for this item. Use Open
                          source to read the original page.
                        </p>
                      )}
                    </section>
                  )}
                  <NewsWhyItMatters metadata={item.metadata} />
                  <div className="card-footer">
                    <span
                      className={`editorial-status ${item.editorialStatus}`}
                    >
                      {item.editorialStatus === 'processed'
                        ? 'AI reviewed'
                        : 'Pending editorial'}
                    </span>
                    {item.archivedAt && (
                      <span className="archive-status">Read & archived</span>
                    )}
                    <div className="pipeline-tags">
                      {item.topicLinks.map((link) => (
                        <span key={link.topicId}>
                          In {link.monthLabel.replace(' 2026', '')} pipeline
                        </span>
                      ))}
                    </div>
                    {item.lastEditedBy && (
                      <span className="edit-attribution">
                        Edited by {item.lastEditedBy}
                      </span>
                    )}
                    <span className="drag-hint">Drag to topic →</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {focus !== 'news' && (
          <section
            className="topic-pane"
            aria-label="Topic dashboard"
            onScroll={(event) =>
              setHeaderHidden(event.currentTarget.scrollTop > 16)
            }
          >
            <div className="pane-heading">
              <div>
                <span className="eyebrow">Analysis pipeline</span>
                <h1>Topics</h1>
              </div>
              <div className="heading-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={openNewTopic}
                  hidden={!canEdit}
                >
                  + New topic
                </button>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() =>
                    setFocus(focus === 'topics' ? 'split' : 'topics')
                  }
                  aria-label={
                    focus === 'topics'
                      ? 'Restore split view'
                      : 'Maximize topic portfolio'
                  }
                >
                  {focus === 'topics' ? '↙' : '↗'}
                </button>
              </div>
            </div>

            <div className="topic-scope-toggle" aria-label="Topic time range">
              <button
                className={topicScope === 'current' ? 'active' : ''}
                type="button"
                onClick={() => setTopicScope('current')}
              >
                Current & upcoming
              </button>
              <button
                className={topicScope === 'all' ? 'active' : ''}
                type="button"
                onClick={() => setTopicScope('all')}
              >
                Full history
              </button>
            </div>

            {focus === 'topics' && selectedThesisId && (
              <div className="thesis-filter">
                <span>
                  Showing continuity for{' '}
                  <strong>
                    {theses.find((item) => item.id === selectedThesisId)?.title}
                  </strong>
                </span>
                <button type="button" onClick={() => setSelectedThesisId('')}>
                  Show all topics
                </button>
              </div>
            )}

            <div className="topic-workspace">
              {focus === 'topics' && (
                <aside className="thesis-portfolio">
                  <div className="portfolio-heading">
                    <div className="section-label">Thesis portfolio</div>
                    <button type="button" onClick={openNewThesis} hidden={!canEdit}>
                      + New thesis
                    </button>
                  </div>
                  <p className="portfolio-intro">
                    Long-term strategic hypotheses that connect related monthly
                    topics into one evolving line of analysis.
                  </p>
                  {theses.map((thesis) => {
                    const linkedTopics = topics
                      .filter((topic) => topic.thesisId === thesis.id)
                      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
                    const continuity =
                      linkedTopics.length > 1
                        ? `${linkedTopics[0].monthLabel} → ${
                            linkedTopics[linkedTopics.length - 1].monthLabel
                          }`
                        : linkedTopics[0]?.monthLabel || 'No monthly topics yet'
                    return (
                      <article
                        key={thesis.id}
                        className={`thesis-card ${
                          selectedThesisId === thesis.id ? 'selected' : ''
                        }`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedThesisId(
                            selectedThesisId === thesis.id ? '' : thesis.id,
                          )
                          setTopicScope('all')
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelectedThesisId(
                              selectedThesisId === thesis.id ? '' : thesis.id,
                            )
                            setTopicScope('all')
                          }
                        }}
                      >
                        <div className="thesis-card-heading">
                          <span>{thesis.horizon}</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setCreatingThesis(false)
                              setThesisDraft({ ...thesis })
                            }}
                            hidden={!canEdit}
                          >
                            Edit
                          </button>
                        </div>
                        <h2>{thesis.title}</h2>
                        <p>{thesis.description}</p>
                        <small>
                          {thesis.topicIds.length} evolving topics · {continuity}
                        </small>
                      </article>
                    )
                  })}
                  {theses.length === 0 && (
                    <div className="portfolio-empty">
                      No thesis has been created yet. Use this area when a
                      recurring topic should continue across several months.
                    </div>
                  )}
                </aside>
              )}

              <div className="month-pipeline">
                {monthGroups.map(([monthKey, monthTopics]) => (
                  <section
                    className="month-group"
                    key={monthKey}
                    onDragOver={(event) => {
                      if (draggedTopicId) event.preventDefault()
                    }}
                    onDrop={(event) => {
                      const topicId =
                        event.dataTransfer.getData('application/x-topic-id') ||
                        draggedTopicId
                      if (topicId) moveTopic(topicId, monthKey)
                    }}
                  >
                    <header>
                      <span className="month-index">
                        {monthKey.split('-')[1]}
                      </span>
                      <div>
                        <h2>{monthName(monthKey)}</h2>
                        <span>{monthTopics.length} topics</span>
                      </div>
                    </header>
                    <div className="topic-list">
                      {monthTopics.map((topic) => (
                        <article
                          className={`topic-card ${
                            draggedNewsId ? 'accepting-news' : ''
                          }`}
                          key={topic.id}
                          draggable
                          onDragStart={(event) => {
                            setDraggedTopicId(topic.id)
                            event.dataTransfer.setData(
                              'application/x-topic-id',
                              topic.id,
                            )
                          }}
                          onDragEnd={() => setDraggedTopicId('')}
                          onDragOver={(event) => {
                            if (draggedNewsId) event.preventDefault()
                          }}
                          onDrop={(event) => {
                            const newsId =
                              event.dataTransfer.getData(
                                'application/x-news-id',
                              ) || draggedNewsId
                            if (newsId) {
                              event.stopPropagation()
                              linkNewsToTopic(newsId, topic.id)
                            }
                          }}
                        >
                          <div className="topic-card-head">
                            <span className={`topic-status ${topic.status}`}>
                              {topicStatusLabels[topic.status]}
                            </span>
                            <div className="card-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  setCreatingTopic(false)
                                  setTopicDraft({ ...topic })
                                }}
                                hidden={!canEdit}
                              >
                                Edit
                              </button>
                              <span className="grip">⋮⋮</span>
                            </div>
                          </div>
                          <h3>{topic.title}</h3>
                          {topic.thesisId && (
                            <span className="topic-thesis-tag">
                              {
                                theses.find(
                                  (thesis) => thesis.id === topic.thesisId,
                                )?.title
                              }
                            </span>
                          )}
                          <p>{topic.notes}</p>
                          <div className="supporting-news">
                            {topic.supportingNews.map((newsId) => {
                              const supportingItem = news.find(
                                (item) => item.id === newsId,
                              )
                              if (!supportingItem || supportingItem.deletedAt) {
                                return null
                              }
                              return (
                                <div className="support-row" key={newsId}>
                                  <a
                                    href={supportingItem.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <span>NEWS</span>
                                    {supportingItem.title}
                                  </a>
                                  <button
                                    type="button"
                                    title="Remove from topic"
                                    aria-label={`Remove ${supportingItem.title} from topic`}
                                    onClick={() =>
                                      void unlinkNews(topic.id, newsId)
                                    }
                                  >
                                    ×
                                  </button>
                                </div>
                              )
                            })}
                            <button
                              type="button"
                              onClick={() => {
                                setTargetTopicId(topic.id)
                                setShowAddLink(true)
                              }}
                            >
                              + Add supporting link
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
                {monthGroups.length === 0 && selectedThesisId && (
                  <div className="portfolio-empty">
                    No monthly topics are linked to this Thesis yet. Edit a
                    Topic to add it.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

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
                rows={7}
                value={newsDraft.summary}
                onChange={(event) =>
                  setNewsDraft({ ...newsDraft, summary: event.target.value })
                }
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
                <span className="eyebrow">Analysis pipeline</span>
                <h2 id="edit-topic-title">
                  {creatingTopic ? 'Create topic' : 'Edit topic'}
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
              Topic title
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
                Month
                <input
                  type="month"
                  value={topicDraft.monthKey}
                  onChange={(event) =>
                    setTopicDraft({
                      ...topicDraft,
                      monthKey: event.target.value,
                      monthLabel: monthName(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={topicDraft.status}
                  onChange={(event) =>
                    setTopicDraft({
                      ...topicDraft,
                      status: event.target.value as TopicStatus,
                    })
                  }
                >
                  {Object.entries(topicStatusLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
            <label>
              Long-term Thesis <span>optional</span>
              <select
                value={topicDraft.thesisId || ''}
                onChange={(event) =>
                  setTopicDraft({
                    ...topicDraft,
                    thesisId: event.target.value || undefined,
                  })
                }
              >
                <option value="">No Thesis</option>
                {theses.map((thesis) => (
                  <option key={thesis.id} value={thesis.id}>
                    {thesis.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Working notes
              <textarea
                rows={5}
                value={topicDraft.notes}
                onChange={(event) =>
                  setTopicDraft({ ...topicDraft, notes: event.target.value })
                }
              />
            </label>
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
                  {creatingTopic ? 'Create topic' : 'Save changes'}
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
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void restoreItem(item.table, item.id)}
                  >
                    Restore
                  </button>
                </div>
              ))}
              {removedItems.news.length +
                removedItems.topics.length +
                removedItems.theses.length ===
                0 && <p className="modal-note">No removed items.</p>}
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
                <h2 id="add-link-title">Add link</h2>
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
