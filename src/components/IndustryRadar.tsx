import { useEffect, useMemo, useState } from 'react'
import {
  archiveRadarSource,
  cloudConfigured,
  createRadarSource,
  loadRadarData,
  probeRadarSource,
  reorderRadarSources,
  triggerRadarIngest,
  updateRadarSource,
} from '../supabase'
import {
  buildRadarTopics,
  demoRadarItems,
  demoRadarSources,
  googleNewsUrl,
  radarSourceHealth,
  radarSourceTypeLabels,
} from '../radar'
import type {
  RadarItem,
  RadarSource,
  RadarSourceType,
  RadarTopic,
} from '../types'

type IndustryRadarProps = {
  canAdmin: boolean
  canEdit: boolean
  onNotice: (message: string) => void
}

const sourceTypes = Object.keys(radarSourceTypeLabels) as RadarSourceType[]

function ageLabel(value?: string) {
  if (!value) return 'Not checked yet'
  const hours = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 3_600_000))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function engagementLabel(item: RadarItem) {
  const parts = []
  if (item.engagement.score) parts.push(`${item.engagement.score} points`)
  if (item.engagement.votes) parts.push(`${item.engagement.votes} votes`)
  if (item.engagement.comments) parts.push(`${item.engagement.comments} comments`)
  return parts.join(' · ')
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  return (
    <span className="radar-sparkline" aria-label={`Activity ${values.join(', ')}`}>
      {values.map((value, index) => (
        <i key={index} style={{ height: `${Math.max(14, (value / max) * 100)}%` }} />
      ))}
    </span>
  )
}

function SourceManager({
  sources,
  canAdmin,
  onClose,
  onSourcesChange,
  onNotice,
}: {
  sources: RadarSource[]
  canAdmin: boolean
  onClose: () => void
  onSourcesChange: (sources: RadarSource[]) => void
  onNotice: (message: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [probing, setProbing] = useState(false)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [feedUrl, setFeedUrl] = useState('')
  const [sourceType, setSourceType] = useState<RadarSourceType>('industry_news')
  const [preview, setPreview] = useState<Array<{ title: string; url: string; publishedAt: string }>>([])

  async function updateSource(source: RadarSource, patch: Partial<RadarSource>) {
    const next = sources.map((candidate) =>
      candidate.id === source.id ? { ...candidate, ...patch } : candidate,
    )
    onSourcesChange(next)
    if (!cloudConfigured) return
    try {
      await updateRadarSource(source.id, patch)
    } catch (error) {
      onSourcesChange(sources)
      onNotice(error instanceof Error ? error.message : 'Could not update source')
    }
  }

  async function moveSource(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sources.length) return
    const next = [...sources]
    ;[next[index], next[target]] = [next[target], next[index]]
    const ordered = next.map((source, position) => ({ ...source, displayOrder: position + 1 }))
    onSourcesChange(ordered)
    if (!cloudConfigured) return
    try {
      await reorderRadarSources(ordered.map((source) => source.id))
    } catch (error) {
      onSourcesChange(sources)
      onNotice(error instanceof Error ? error.message : 'Could not reorder sources')
    }
  }

  async function removeSource(source: RadarSource) {
    if (!window.confirm(`Remove ${source.name}? Historical radar evidence will be kept.`)) return
    onSourcesChange(sources.filter((candidate) => candidate.id !== source.id))
    if (!cloudConfigured) return
    try {
      await archiveRadarSource(source.id)
    } catch (error) {
      onSourcesChange(sources)
      onNotice(error instanceof Error ? error.message : 'Could not remove source')
    }
  }

  async function probe() {
    if (!url.trim()) return
    setProbing(true)
    setPreview([])
    try {
      if (!cloudConfigured) {
        const parsed = new URL(url)
        setName(parsed.hostname.replace(/^www\./, '').split('.')[0])
        setFeedUrl(new URL('/feed/', parsed.origin).toString())
        setPreview([
          { title: 'Feed preview becomes available after cloud connection', url, publishedAt: new Date().toISOString() },
        ])
      } else {
        const result = await probeRadarSource(url)
        setName(result.name)
        setUrl(result.homepageUrl)
        setFeedUrl(result.feedUrl)
        setPreview(result.preview)
      }
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not find a feed')
    } finally {
      setProbing(false)
    }
  }

  async function saveSource() {
    if (!name.trim() || !url.trim() || !feedUrl.trim()) {
      onNotice('Add a website and verify its RSS feed first')
      return
    }
    try {
      let created: RadarSource
      if (cloudConfigured) {
        const result = await createRadarSource({
          name,
          homepageUrl: url,
          feedUrl,
          sourceType,
        })
        if (!result) return
        created = result
      } else {
        const parsed = new URL(url)
        created = {
          id: `source-${Date.now()}`,
          name: name.trim(),
          domain: parsed.hostname.replace(/^www\./, ''),
          homepageUrl: parsed.toString(),
          feedUrl,
          sourceType,
          connectorType: 'rss',
          enabled: true,
          priority: 50,
          displayOrder: sources.length + 1,
          itemCount7d: 0,
        }
      }
      onSourcesChange([...sources, created])
      setAdding(false)
      setUrl('')
      setName('')
      setFeedUrl('')
      setPreview([])
      onNotice(`${created.name} added to Industry Radar`)
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not add source')
    }
  }

  return (
    <>
      <button className="drawer-backdrop" type="button" aria-label="Close sources" onClick={onClose} />
      <aside className="radar-source-drawer" role="dialog" aria-modal="true" aria-labelledby="radar-sources-title">
        <header>
          <div>
            <span className="eyebrow">Coverage and collection health</span>
            <h2 id="radar-sources-title">Sources</h2>
            <p>{sources.filter((source) => source.enabled).length} active · historical evidence remains when a source is removed</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>×</button>
        </header>

        {adding ? (
          <section className="radar-source-add" aria-label="Add source">
            <div className="radar-source-add-row">
              <label>
                Website or RSS URL
                <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" autoFocus />
              </label>
              <button className="secondary-button" type="button" disabled={probing || !url.trim()} onClick={() => void probe()}>
                {probing ? 'Checking…' : 'Find feed'}
              </button>
            </div>
            {feedUrl ? (
              <div className="radar-source-fields">
                <label>
                  Name
                  <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label>
                  Source type
                  <select value={sourceType} onChange={(event) => setSourceType(event.target.value as RadarSourceType)}>
                    {sourceTypes.map((type) => <option value={type} key={type}>{radarSourceTypeLabels[type]}</option>)}
                  </select>
                </label>
                <label className="radar-feed-field">
                  Feed URL
                  <input value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} />
                </label>
              </div>
            ) : null}
            {preview.length ? (
              <div className="radar-feed-preview">
                <strong>Feed preview</strong>
                {preview.slice(0, 3).map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.url}>{item.title}</a>)}
              </div>
            ) : null}
            <div className="modal-actions">
              <button className="text-action" type="button" onClick={() => setAdding(false)}>Cancel</button>
              <button className="primary-button" type="button" disabled={!feedUrl} onClick={() => void saveSource()}>Add source</button>
            </div>
          </section>
        ) : null}

        <div className="radar-source-list">
          {sources.map((source, index) => {
            const health = radarSourceHealth(source)
            return (
              <article className={`radar-source-row health-${health}`} key={source.id}>
                <div className="radar-source-order">
                  <button type="button" aria-label={`Move ${source.name} up`} disabled={!canAdmin || index === 0} onClick={() => void moveSource(index, -1)}>↑</button>
                  <button type="button" aria-label={`Move ${source.name} down`} disabled={!canAdmin || index === sources.length - 1} onClick={() => void moveSource(index, 1)}>↓</button>
                </div>
                <span className={`radar-health-dot ${health}`} title={health} />
                <div className="radar-source-main">
                  <strong>{source.name}</strong>
                  <span>{source.domain} · {radarSourceTypeLabels[source.sourceType]}</span>
                  {source.lastError ? <small>{source.lastError}</small> : <small>Checked {ageLabel(source.lastFetchedAt)}</small>}
                </div>
                <div className="radar-source-volume"><strong>{source.itemCount7d}</strong><span>7d items</span></div>
                <label className="radar-source-toggle">
                  <input type="checkbox" checked={source.enabled} disabled={!canAdmin} onChange={(event) => void updateSource(source, { enabled: event.target.checked })} />
                  <span>{source.enabled ? 'On' : 'Paused'}</span>
                </label>
                {canAdmin ? <button className="text-action danger-text" type="button" onClick={() => void removeSource(source)}>Remove</button> : null}
              </article>
            )
          })}
        </div>
        {canAdmin && !adding ? <button className="radar-add-source" type="button" onClick={() => setAdding(true)}>+ Add source</button> : null}
      </aside>
    </>
  )
}

export function IndustryRadar({ canAdmin, canEdit, onNotice }: IndustryRadarProps) {
  const [sources, setSources] = useState<RadarSource[]>(cloudConfigured ? [] : demoRadarSources)
  const [items, setItems] = useState<RadarItem[]>(cloudConfigured ? [] : demoRadarItems)
  const [windowDays, setWindowDays] = useState<7 | 30>(7)
  const [sourceFilter, setSourceFilter] = useState<RadarSourceType | 'all'>('all')
  const [selectedSlug, setSelectedSlug] = useState('')
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([])
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [loading, setLoading] = useState(cloudConfigured)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')

  async function reload() {
    if (!cloudConfigured) return
    setLoading(true)
    try {
      const data = await loadRadarData()
      if (data) {
        setSources(data.sources)
        setItems(data.items)
      }
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load Industry Radar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const filteredItems = useMemo(
    () => items.filter((item) => sourceFilter === 'all' || item.sourceType === sourceFilter),
    [items, sourceFilter],
  )
  const topics = useMemo(
    () => buildRadarTopics(filteredItems, windowDays),
    [filteredItems, windowDays],
  )
  const selectedTopic = topics.find((topic) => topic.slug === selectedSlug) || topics[0]

  useEffect(() => {
    if (!selectedTopic) {
      setSelectedEvidence([])
      return
    }
    if (selectedTopic.slug !== selectedSlug) setSelectedSlug(selectedTopic.slug)
    setSelectedEvidence(selectedTopic.evidence.slice(0, 4).map((item) => item.id))
  }, [selectedTopic, selectedSlug])

  function openEvidence(topic: RadarTopic) {
    const urls = topic.evidence
      .filter((item) => selectedEvidence.includes(item.id))
      .slice(0, 5)
      .map((item) => item.url)
    if (!urls.length) {
      onNotice('Select at least one article')
      return
    }
    for (const url of urls) window.open(url, '_blank', 'noopener,noreferrer')
    onNotice(`Opened ${urls.length} diversified sources`)
  }

  async function refreshRadar() {
    if (!cloudConfigured) {
      onNotice('Demo radar refreshed')
      return
    }
    setRefreshing(true)
    try {
      const result = await triggerRadarIngest()
      await reload()
      onNotice(`Radar refreshed · ${result.inserted} items saved, ${result.failed} sources need attention`)
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Radar refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const healthySources = sources.filter((source) => radarSourceHealth(source) === 'healthy').length
  const latestFetch = sources
    .map((source) => source.lastFetchedAt || '')
    .sort()
    .at(-1)

  return (
    <section className="industry-radar" aria-label="Industry Radar">
      <header className="radar-hero">
        <div>
          <span className="eyebrow">External market sensing</span>
          <h1>Industry Radar</h1>
          <p>Signals that are accelerating across independent news, product, company and market sources.</p>
        </div>
        <div className="radar-hero-actions">
          {canEdit ? <button className="secondary-button" type="button" disabled={refreshing} onClick={() => void refreshRadar()}>{refreshing ? 'Refreshing…' : 'Refresh now'}</button> : null}
          <button className="secondary-button" type="button" onClick={() => setSourcesOpen(true)}>Sources · {sources.filter((source) => source.enabled).length}</button>
        </div>
      </header>

      <div className="radar-control-bar">
        <div className="radar-window" role="group" aria-label="Radar period">
          <button type="button" className={windowDays === 7 ? 'active' : ''} onClick={() => setWindowDays(7)}>7 days</button>
          <button type="button" className={windowDays === 30 ? 'active' : ''} onClick={() => setWindowDays(30)}>30 days</button>
        </div>
        <div className="radar-source-filters" role="group" aria-label="Radar source type">
          <button type="button" className={sourceFilter === 'all' ? 'active' : ''} onClick={() => setSourceFilter('all')}>All signals</button>
          {sourceTypes.map((type) => <button type="button" className={sourceFilter === type ? 'active' : ''} onClick={() => setSourceFilter(type)} key={type}>{radarSourceTypeLabels[type]}</button>)}
        </div>
        <span className="radar-freshness"><i className={healthySources ? 'healthy' : 'pending'} />{healthySources}/{sources.length} healthy · checked {ageLabel(latestFetch)}</span>
      </div>

      {loadError ? (
        <div className="radar-setup-state">
          <strong>Industry Radar needs its database migration.</strong>
          <p>{loadError}</p>
        </div>
      ) : loading ? (
        <div className="radar-setup-state">Loading market signals…</div>
      ) : topics.length === 0 ? (
        <div className="radar-setup-state">
          <strong>No radar topics in this window yet.</strong>
          <p>Open Sources to review coverage, then run the first refresh.</p>
        </div>
      ) : (
        <div className="radar-workbench">
          <div className="radar-topic-list" aria-label="Rising topics">
            <div className="radar-list-heading">
              <span>Topic</span><span>Momentum</span><span>Evidence</span><span>Activity</span>
            </div>
            {topics.map((topic, index) => (
              <button type="button" className={`radar-topic-row ${selectedTopic?.slug === topic.slug ? 'selected' : ''}`} onClick={() => setSelectedSlug(topic.slug)} key={topic.slug}>
                <span className="radar-topic-identity"><small>#{index + 1}</small><span><strong>{topic.label}</strong><em className={`radar-state ${topic.status}`}>{topic.status}</em></span></span>
                <span className={`radar-momentum ${topic.momentumPercent !== null && topic.momentumPercent < 0 ? 'negative' : ''}`}>{topic.momentumPercent === null ? 'New' : `${topic.momentumPercent > 0 ? '+' : ''}${topic.momentumPercent}%`}</span>
                <span className="radar-evidence-count"><strong>{topic.eventCount}</strong> events · {topic.sourceCount} sources</span>
                <Sparkline values={topic.sparkline} />
              </button>
            ))}
          </div>

          {selectedTopic ? (
            <aside className="radar-topic-detail" aria-label="Radar topic detail">
              <header>
                <div>
                  <span className={`radar-state ${selectedTopic.status}`}>{selectedTopic.status}</span>
                  <h2>{selectedTopic.label}</h2>
                </div>
                <a className="secondary-button" href={googleNewsUrl(selectedTopic)} target="_blank" rel="noreferrer">Google News ↗</a>
              </header>
              <p className="radar-topic-readout">
                {selectedTopic.eventCount} distinct developments across {selectedTopic.sourceCount} independent sources in the last {windowDays} days. {selectedTopic.mentionCount - selectedTopic.eventCount > 0 ? `${selectedTopic.mentionCount - selectedTopic.eventCount} near-duplicate reports were consolidated.` : 'No duplicate reporting inflated this count.'}
              </p>
              <div className="radar-type-mix">
                {selectedTopic.sourceTypes.map((type) => <span key={type}>{radarSourceTypeLabels[type]}</span>)}
              </div>
              <div className="radar-reading-heading">
                <div><strong>Diversified reading set</strong><span>One link per source and underlying story</span></div>
                <button className="primary-button" type="button" onClick={() => openEvidence(selectedTopic)}>Open selected · {selectedEvidence.length}</button>
              </div>
              <div className="radar-evidence-list">
                {selectedTopic.evidence.map((item) => {
                  const engagement = engagementLabel(item)
                  return (
                    <label className="radar-evidence-item" key={item.id}>
                      <input type="checkbox" checked={selectedEvidence.includes(item.id)} onChange={(event) => setSelectedEvidence((current) => event.target.checked ? [...current, item.id].slice(0, 5) : current.filter((id) => id !== item.id))} />
                      <span>
                        <span className="radar-evidence-meta"><strong>{item.sourceName}</strong><em>{radarSourceTypeLabels[item.sourceType]}</em><time>{ageLabel(item.publishedAt)}</time></span>
                        <a href={item.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{item.title}</a>
                        {engagement ? <small>{engagement}</small> : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            </aside>
          ) : null}
        </div>
      )}

      {sourcesOpen ? <SourceManager sources={sources} canAdmin={canAdmin} onClose={() => setSourcesOpen(false)} onSourcesChange={setSources} onNotice={onNotice} /> : null}
    </section>
  )
}
