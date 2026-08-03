import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { demoNews, demoTheses, demoTopics } from './demoData'
import {
  cloudConfigured,
  loadWorkspace,
  persistNewsLink,
  persistTopicMonth,
  persistTopicNews,
} from './supabase'
import type { FocusMode, NewsCategory, NewsItem, Topic } from './types'

const categoryLabels: Record<NewsCategory, string> = {
  interaction: 'Interaction',
  ai_software: 'AI software',
  ai_hardware: 'AI hardware',
  ecosystem: 'Ecosystem',
  ai_capability: 'AI capability',
  industry_events: 'Industry events',
}

function monthName(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function App() {
  const [news, setNews] = useState(demoNews)
  const [topics, setTopics] = useState(demoTopics)
  const [theses, setTheses] = useState(demoTheses)
  const [focus, setFocus] = useState<FocusMode>('split')
  const [period, setPeriod] = useState('all')
  const [category, setCategory] = useState<NewsCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [showAddLink, setShowAddLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [targetTopicId, setTargetTopicId] = useState('')
  const [draggedNewsId, setDraggedNewsId] = useState('')
  const [draggedTopicId, setDraggedTopicId] = useState('')

  useEffect(() => {
    if (!cloudConfigured) return
    void loadWorkspace().then((workspace) => {
      if (!workspace) return
      setNews(workspace.news)
      setTopics(workspace.topics)
      setTheses(workspace.theses)
    })
  }, [])

  const visibleNews = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return news.filter((item) => {
      const matchesCategory = category === 'all' || item.category === category
      const matchesPeriod =
        period === 'all' || item.capturedAt.slice(0, 7) === period
      const matchesQuery =
        !needle ||
        `${item.title} ${item.summary} ${item.source}`
          .toLowerCase()
          .includes(needle)
      return matchesCategory && matchesPeriod && matchesQuery
    })
  }, [category, news, period, query])

  const monthGroups = useMemo(() => {
    const groups = new Map<string, Topic[]>()
    topics
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
  }, [topics])

  function linkNewsToTopic(newsId: string, topicId: string) {
    const topic = topics.find((item) => item.id === topicId)
    if (!topic || !news.some((item) => item.id === newsId)) return
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
    if (cloudConfigured) void persistTopicNews(topicId, newsId)
  }

  function moveTopic(topicId: string, monthKey: string) {
    setTopics((current) =>
      current.map((topic) =>
        topic.id === topicId
          ? { ...topic, monthKey, monthLabel: monthName(monthKey) }
          : topic,
      ),
    )
    if (cloudConfigured) void persistTopicMonth(topicId, monthKey)
  }

  async function addLink() {
    const url = linkUrl.trim()
    if (!url) return
    let hostname = ''
    try {
      hostname = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return
    }
    const id =
      (await persistNewsLink({
        url,
        title: linkTitle.trim() || hostname,
        source: hostname,
      })) || `news-${Date.now()}`
    const topic = topics.find((candidate) => candidate.id === targetTopicId)
    const item: NewsItem = {
      id,
      url,
      title: linkTitle.trim() || hostname,
      source: hostname,
      summary: 'Pending AI editorial review.',
      category: 'ecosystem',
      capturedAt: new Date().toISOString(),
      capturedBy: 'Current user',
      editorialStatus: 'pending',
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
    setLinkUrl('')
    setLinkTitle('')
    setTargetTopicId('')
    setShowAddLink(false)
  }

  return (
    <div className={`app-shell focus-${focus}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">SI</span>
          <div>
            <strong>Signal Intelligence</strong>
            <span>News discovery to thesis portfolio</span>
          </div>
        </div>
        <div className="sync-status">
          <span className="status-dot" />
          {cloudConfigured
            ? 'Private team workspace · live sync'
            : 'Demo workspace · cloud setup pending'}
        </div>
        <button className="avatar-button" type="button" aria-label="Account">
          ZL
        </button>
      </header>

      <main className="dashboard">
        {focus !== 'topics' && (
          <section className="news-pane" aria-label="News dashboard">
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
                aria-label="Filter by month"
              >
                <option value="all">All months</option>
                <option value="2026-08">August 2026</option>
                <option value="2026-07">July 2026</option>
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
            </div>

            <div className="readout">
              <div>
                <span className="eyebrow">Current readout</span>
                <strong>From captured signal to scheduled analysis</strong>
              </div>
              <p>
                Drag a card into the topic pipeline when it becomes evidence for
                a new analysis. Its pipeline status remains visible here.
              </p>
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
                    <span>
                      {new Intl.DateTimeFormat('en', {
                        month: 'short',
                        day: 'numeric',
                      }).format(new Date(item.capturedAt))}
                    </span>
                  </div>
                  <h2>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                  </h2>
                  <p>{item.summary}</p>
                  <div className="card-footer">
                    <span
                      className={`editorial-status ${item.editorialStatus}`}
                    >
                      {item.editorialStatus === 'processed'
                        ? 'AI reviewed'
                        : 'Pending editorial'}
                    </span>
                    <div className="pipeline-tags">
                      {item.topicLinks.map((link) => (
                        <span key={link.topicId}>
                          In {link.monthLabel.replace(' 2026', '')} pipeline
                        </span>
                      ))}
                    </div>
                    <span className="drag-hint">Drag to topic →</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {focus !== 'news' && (
          <section className="topic-pane" aria-label="Topic dashboard">
            <div className="pane-heading">
              <div>
                <span className="eyebrow">Analysis pipeline</span>
                <h1>Topics</h1>
              </div>
              <div className="heading-actions">
                <button className="secondary-button" type="button">
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

            <div className="topic-workspace">
              {focus === 'topics' && (
                <aside className="thesis-portfolio">
                  <div className="section-label">Thesis portfolio</div>
                  {theses.map((thesis) => (
                    <article key={thesis.id} className="thesis-card">
                      <span>{thesis.horizon}</span>
                      <h2>{thesis.title}</h2>
                      <p>{thesis.description}</p>
                      <small>{thesis.topicIds.length} evolving topics</small>
                    </article>
                  ))}
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
                              {topic.status}
                            </span>
                            <span className="grip">⋮⋮</span>
                          </div>
                          <h3>{topic.title}</h3>
                          <p>{topic.notes}</p>
                          <div className="supporting-news">
                            {topic.supportingNews.map((newsId) => {
                              const supportingItem = news.find(
                                (item) => item.id === newsId,
                              )
                              if (!supportingItem) return null
                              return (
                                <a
                                  href={supportingItem.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  key={newsId}
                                >
                                  <span>NEWS</span>
                                  {supportingItem.title}
                                </a>
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
              </div>
            </div>
          </section>
        )}
      </main>

      {showAddLink && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowAddLink(false)}
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
                onClick={() => setShowAddLink(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <label>
              URL
              <input
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
                onClick={() => setShowAddLink(false)}
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
