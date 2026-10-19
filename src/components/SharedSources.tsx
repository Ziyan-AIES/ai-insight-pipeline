import { useState } from 'react'
import { categoryLabels } from '../labels'
import { safeUrl } from '../analysis'
import type { NewsCategory, NewsItem } from '../types'

export function SharedSources({ news, canLink, onLink, targetTitle, linkedIds = [], onClose, initialLinked = false }: {
  news: NewsItem[]; canLink: boolean; onLink?: (id: string) => void; targetTitle?: string; linkedIds?: string[]; onClose?: () => void; initialLinked?: boolean
}) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [type, setType] = useState('all'), [language, setLanguage] = useState('all'), [scope, setScope] = useState(initialLinked ? 'linked' : 'all')
  const kind = (item: NewsItem) => String(item.metadata?.content_type || (item.sourceType === 'manual_note' ? 'idea' : /youtu\.be|youtube\.com/.test(item.url) ? 'video' : /xiaoyuzhou|podcast|spotify/.test(item.url) ? 'podcast' : 'article'))
  const lang = (item: NewsItem) => String(item.metadata?.language || 'unknown')
  const visible = news.filter(item => !item.deletedAt && !item.archivedAt && (category === 'all' || item.category === category) && (type === 'all' || kind(item) === type) && (language === 'all' || lang(item) === language) && (scope !== 'linked' || linkedIds.includes(item.id)) && `${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase()))
  return <aside className="shared-sources" aria-label="Selected Sources panel"><header><h2>Selected Sources</h2>{onClose && <button onClick={onClose}>Close sources</button>}</header>
    {targetTitle && <p>Link to: <strong>{targetTitle}</strong></p>}
    <label>Search sources<input value={query} onChange={event => setQuery(event.target.value)}/></label>
    <div className="source-filters"><label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{Object.entries(categoryLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Type<select value={type} onChange={event => setType(event.target.value)}><option value="all">All types</option>{['article','podcast','video','idea'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Language<select value={language} onChange={event => setLanguage(event.target.value)}><option value="all">All languages</option><option value="en">English</option><option value="zh">Chinese</option><option value="unknown">Not specified</option></select></label>{targetTitle && <label>Relationship<select value={scope} onChange={event => setScope(event.target.value)}><option value="all">All sources</option><option value="linked">Linked to this item</option></select></label>}</div>
    <p className="source-result-count">{visible.length} sources</p>{visible.map(item => <article className="shared-source" key={item.id} draggable={canLink} onDragStart={event => { event.dataTransfer.setData('application/x-news-id',item.id); event.dataTransfer.effectAllowed='copy' }}>
      <small>{categoryLabels[item.category as NewsCategory]} · {kind(item)} · {lang(item)}{item.capturedAt ? ' · '+item.capturedAt.slice(0,10) : ''}</small><h3>{item.title}</h3><p>{item.summary || item.takeaway || 'No summary added yet.'}</p><small>Selected by {item.capturedBy || 'a team member'} · {item.trendLinks.length} trends · {item.topicLinks.length} research links</small>
      <div className="analysis-controls">{safeUrl(item.url) && <a href={safeUrl(item.url)!} target="_blank" rel="noreferrer">Original ↗</a>}{onLink && canLink && <button disabled={linkedIds.includes(item.id)} onClick={() => onLink(item.id)}>{linkedIds.includes(item.id) ? 'Linked' : 'Link source'}</button>}</div>
    </article>)}{!visible.length && <p>No matching selected sources.</p>}
  </aside>
}
