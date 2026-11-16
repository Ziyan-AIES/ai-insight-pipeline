import { useEffect, useState } from 'react'
import { cloudConfigured, loadReferenceBriefs } from '../supabase'

export type ReferenceBriefData = {
  period: 'daily' | 'weekly'; start: string; end: string; generatedAt: string;
  coverageWarnings: string[]; sampled: boolean; itemCount: number;
  version?: number; reviewedCount?: number; distinctCount?: number; excludedCount?: number; themeCount?: number;
  cards: Array<{ title: string; body: string; bullets?: string[]; sources: Array<{ id: string; title: string; url: string }> }>;
}
const date = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric' })

function TakeawayBody({body,bullets}:{body:string;bullets?:string[]}) {
  const sentences = Array.from(new Intl.Segmenter('en', {granularity:'sentence'}).segment(body), part=>part.segment.trim()).filter(Boolean)
  const points = bullets?.length ? bullets : sentences.slice(1)
  return <><p>{bullets?.length ? body : sentences[0]}</p>{points.length>0&&<ul className="reference-key-points">{points.map((point,index)=><li key={index}>{point}</li>)}</ul>}</>
}

export function ReferenceBrief() {
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')
  const [briefs, setBriefs] = useState<ReferenceBriefData[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(cloudConfigured)
  useEffect(() => {
    if (!cloudConfigured) return
    let active = true
    loadReferenceBriefs().then(data => { if (active) setBriefs(data) })
      .catch(() => { if (active) setError('The latest briefing could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const brief = briefs.find(row => row.period === period)
  return <section className="reference-brief" aria-label="AI Takeaways">
    <header><div><span className="eyebrow">A quick read of the evidence</span><h2>AI Takeaways</h2></div>
      <div className="radar-window" role="group" aria-label="Briefing period">
        <button type="button" className={period === 'daily' ? 'active' : ''} onClick={() => setPeriod('daily')}>Daily Brief</button>
        <button type="button" className={period === 'weekly' ? 'active' : ''} onClick={() => setPeriod('weekly')}>Past week</button>
      </div></header>
    {loading ? <p role="status">Loading briefing…</p> : error ? <p role="status">{error}</p> : !brief ? <p>No briefing published yet. Source collection and the evidence below remain available.</p> : <>
      <p className="reference-brief-meta">Updated {date(brief.generatedAt)} · {brief.reviewedCount ?? brief.itemCount} collected articles reviewed</p>
      {brief.cards.length ? <div className="reference-brief-grid">{brief.cards.map((card, i) => <article key={i} className="reference-takeaway"><span className="reference-card-number">0{i + 1}</span><h3>{card.title}</h3><TakeawayBody body={card.body} bullets={card.bullets}/><details><summary>{card.sources.length} supporting article{card.sources.length === 1 ? '' : 's'}</summary><ul>{card.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} </a></li>)}</ul></details></article>)}</div> : <p>The collected evidence does not yet support a shared theme across multiple developments.</p>}
    </>}
  </section>
}
