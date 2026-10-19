import { useState } from 'react'
import type { NewsItem, Topic } from '../types'

export function researchTopics(topics: Topic[]) {
  return topics.filter(topic => !topic.deletedAt && (
    topic.status !== 'idea' || topic.outputs.length > 0 || Boolean(topic.outcomeUrl)
  ))
}

function safeLink(value: string) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null }
  catch { return null }
}

export function ResearchLibrary({ topics, news, canEdit, onEdit }: {
  topics: Topic[]; news: NewsItem[]; canEdit: boolean; onEdit: (topic: Topic) => void
}) {
  const [selectedId, select] = useState<string | null>(null)
  const available = researchTopics(topics)
  const topic = available.find(item => item.id === selectedId)
  if (topic) {
    const sources = news.filter(item => !item.deletedAt && topic.supportingNews.includes(item.id))
    return <section className="sonata-research">
      <button className="text-action" onClick={() => select(null)}>← All research</button>
      <header className="sonata-research-heading"><span className="eyebrow">Research / {topic.kind}</span>
        <h1>{topic.title}</h1><p>{topic.analysis.keyQuestion || 'Research question not yet added.'}</p>
        <span className="sonata-status">{topic.status} · {topic.ownerName || 'Team research'}</span>
        {canEdit && <button className="secondary-button" onClick={() => onEdit(topic)}>Open research workspace ↗</button>}
      </header>
      <div className="sonata-research-spread"><article className="sonata-reading">
        {Object.entries({ 'Observed evidence': topic.analysis.observed, 'Current perspective': topic.analysis.currentView, 'Implications': topic.analysis.implications, 'Questions to watch': topic.analysis.watch }).filter(([, text]) => text).map(([label, text]) => <section key={label}><h2>{label}</h2><p>{text}</p></section>)}
        {!Object.values(topic.analysis).some(Boolean) && <p>The research narrative has not been added yet. Existing source links and outputs remain available.</p>}
        <h2>Research outputs</h2>
        {topic.outputs.length === 0 && !topic.outcomeUrl && <p>No output has been linked yet.</p>}
        {topic.outputs.map(output => <article className="sonata-output" key={output.id}><h3>{output.title}</h3><p>{output.description}</p><span>{output.kind} · {output.dateLabel}</span>{safeLink(output.link) && <a href={safeLink(output.link)!} target="_blank" rel="noreferrer">Open output ↗</a>}</article>)}
        {safeLink(topic.outcomeUrl) && <a href={safeLink(topic.outcomeUrl)!} target="_blank" rel="noreferrer">Open linked deliverable ↗</a>}
      </article><aside className="sonata-evidence"><h2>Research trail</h2><h3>Related trends</h3>
        {topic.sourceTrends.map(trend => <p key={trend.trendId}>{trend.trendTitle}</p>)}
        {!topic.sourceTrends.length && <p>No trend linked yet.</p>}
        <h3>Selected sources</h3>{sources.map(source => <article key={source.id}><h3>{source.title}</h3><p>{source.summary || source.takeaway}</p><small>Selected by {source.capturedBy || 'a team member'}</small>{safeLink(source.url) && <a href={safeLink(source.url)!} target="_blank" rel="noreferrer">Original source ↗</a>}</article>)}
        {!sources.length && <p>No sources linked yet.</p>}
      </aside></div>
    </section>
  }
  return <section className="sonata-research"><header className="sonata-research-heading"><span className="eyebrow">Questions into understanding</span><h1>Research.</h1><p>Committed research, connected evidence, and the outputs that bring it together.</p></header>
    <div className="sonata-topic-grid">{available.map(item => <button className="sonata-topic" key={item.id} onClick={() => select(item.id)}><span>{item.kind} · {item.status}</span><h2>{item.title}</h2><p>{item.analysis.keyQuestion || item.analysis.currentView || 'Research framing is being developed.'}</p><small>{item.supportingNews.length} linked sources · {item.outputs.length} outputs</small><strong>Explore research ↗</strong></button>)}</div>
    {!available.length && <div className="sonata-reading"><h2>Research takes shape here</h2><p>Committed topics and existing deliverables will appear here. Uncommitted ideas remain in the workspace; no historical records have been removed.</p></div>}
  </section>
}
