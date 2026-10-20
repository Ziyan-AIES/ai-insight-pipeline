import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { NewsItem } from '../types'
import { signalTime } from '../intelligence'
import { companyGroup, companyNews, newsMapCompanies, newsMapTopics, topicNews } from '../news-map-model'
import './SelectedNewsMap.css'

type MapNode = { id: string; title: string; items: NewsItem[]; x: number; y: number }
type Selection = { ids: string[]; nodeIds?: string[]; title: string; kind: 'topic' | 'company' | 'shared' | 'unassigned' } | null
function lines(text: string) {
  const result: string[] = []; let line = ''
  for (const word of text.split(' ')) { if (line && (line+' '+word).length>21) { result.push(line); line=word } else line+=(line?' ':'')+word }
  if(line)result.push(line); return result
}
export function SelectedNewsMap({ news, isNew, renderCard }: { news: NewsItem[]; isNew: (item: NewsItem) => boolean; renderCard: (item: NewsItem) => ReactNode }) {
  const [mode,setMode]=useState<'topics'|'companies'>('topics')
  const [selection,setSelection]=useState<Selection>(null)
  const [group,setGroup]=useState('time')
  const [query,setQuery]=useState('')
  const [active,setActive]=useState('')
  const [transform,setTransform]=useState({x:0,y:0,zoom:1})
  const drag=useRef<{x:number;y:number;panX:number;panY:number}|null>(null)
  const svg=useRef<SVGSVGElement>(null)
  const cards=useRef(new Map<string,HTMLDivElement>())
  const filtered=useMemo(()=>news.filter(n=>!query||[n.title,n.summary,n.source].join(' ').toLowerCase().includes(query.toLowerCase())),[news,query])
  const nodes=useMemo<MapNode[]>(()=> mode==='topics'
    ? newsMapTopics.map((t,i)=>({...t,items:topicNews(filtered,t.pattern),x:150+i%4*300,y:150+Math.floor(i/4)*230}))
    : newsMapCompanies.map(c=>({...c,items:companyNews(filtered,c.aliases)})).filter(c=>c.items.length).map((c,i)=>({...c,x:110+i%6*196,y:100+Math.floor(i/6)*145})),[mode,filtered])
  const selectedItems=filtered.filter(n=>!selection || (selection.nodeIds ? selection.nodeIds.every(id=>nodes.find(node=>node.id===id)?.items.some(item=>item.id===n.id)) : selection.kind==='unassigned' ? !nodes.some(node=>node.items.some(item=>item.id===n.id)) : selection.ids.includes(n.id))).toSorted((a,b)=>signalTime(b).localeCompare(signalTime(a)))
  const unassigned=mode==='topics'?filtered.filter(n=>!nodes.some(t=>t.items.some(x=>x.id===n.id))):[]
  const groups=new Map<string,NewsItem[]>()
  for(const n of selectedItems){const key=group==='company'?companyGroup(n):'';if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(n)}
  function select(node:MapNode){setSelection({ids:node.items.map(n=>n.id),nodeIds:[node.id],title:node.title,kind:mode==='topics'?'topic':'company'});setActive('')}
  function showNews(item:NewsItem){if(!selectedItems.some(n=>n.id===item.id)){setSelection({ids:[item.id],title:'Selected story',kind:'shared'})}setActive(item.id);requestAnimationFrame(()=>cards.current.get(item.id)?.scrollIntoView({block:'nearest',behavior:'smooth'}))}
  function reset(){setSelection(null);setActive('');setTransform({x:0,y:0,zoom:1})}
  function changeMode(value:'topics'|'companies'){setMode(value);reset()}
  function zoom(factor:number){setTransform(t=>{const z=Math.max(.65,Math.min(2.8,t.zoom*factor));return{x:600-(600-t.x)*z/t.zoom,y:425-(425-t.y)*z/t.zoom,zoom:z}})}
  return <div className="selected-news-map">
    <section className="selected-news-map-canvas" aria-label="Selected news map">
      <header><div><span className="eyebrow">Explore the selected news</span><h2>{mode==='topics'?'Topics across the collection':'Companies in the news'}</h2></div><div className="news-map-modes"><button type="button" aria-pressed={mode==='topics'} onClick={()=>changeMode('topics')}>Topics</button><button type="button" aria-pressed={mode==='companies'} onClick={()=>changeMode('companies')}>Companies</button></div></header>
      <div className="news-map-drawing">
        <svg ref={svg} viewBox="0 0 1200 850" role="group" aria-label="Interactive news map" onPointerDown={e=>{if((e.target as Element).closest('[data-map-node]'))return;drag.current={x:e.clientX,y:e.clientY,panX:transform.x,panY:transform.y};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current)return;const ratio=1200/(svg.current?.getBoundingClientRect().width||1200);setTransform(t=>({...t,x:drag.current!.panX+(e.clientX-drag.current!.x)*ratio,y:drag.current!.panY+(e.clientY-drag.current!.y)*ratio}))}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.zoom})`}>
            {nodes.flatMap((a,i)=>nodes.slice(i+1).map(b=>{const shared=a.items.filter(n=>b.items.some(s=>s.id===n.id));if(shared.length<(mode==='topics'?2:1))return null;const on=selection?.kind==='shared'&&selection.title===a.title+' × '+b.title;const choose=()=>{setSelection({ids:shared.map(n=>n.id),nodeIds:[a.id,b.id],title:a.title+' × '+b.title,kind:'shared'});setActive('')};return <g key={a.id+'|'+b.id} data-map-node="edge" className="news-map-edge" role="button" tabIndex={0} aria-label={`${a.title} and ${b.title}: ${shared.length} shared stories`} onClick={choose} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}}}><title>{shared.length} shared stories. Select to read the overlap; not a causal relationship.</title><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on?'#9571ab':'#beaccb'} strokeWidth={on?3:1.6} opacity={on?.9:.3}/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={16}/></g>}))}
            {mode==='topics'&&filtered.map(item=>{const primary=nodes.find(t=>t.items.some(n=>n.id===item.id));let x:number,y:number;if(primary){const cluster=filtered.filter(n=>nodes.find(t=>t.items.some(s=>s.id===n.id))?.id===primary.id);const angle=2*Math.PI*cluster.findIndex(n=>n.id===item.id)/cluster.length-Math.PI/2;x=primary.x+108*Math.cos(angle);y=primary.y+108*Math.sin(angle)}else{x=175+unassigned.findIndex(n=>n.id===item.id)*53;y=755}const lit=!selection||selection.ids.includes(item.id),choose=()=>showNews(item);return <g key={item.id} data-map-node="news" className="news-map-point" role="button" tabIndex={0} aria-label={item.title} onClick={choose} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();choose()}}}><title>{item.title}{isNew(item)?' · New':''}</title><circle cx={x} cy={y} r={13} fill="transparent"/><circle cx={x} cy={y} r={active===item.id?9:6} fill="currentColor" className={`map-cat-${item.category}`} opacity={lit?1:.3} stroke={active===item.id?'#70418c':'#fff'} strokeWidth={active===item.id?3:1}/>{isNew(item)&&<circle cx={x+7} cy={y-7} r={3.5} fill="#815798" stroke="#fff"/>}</g>})}
            {unassigned.length>0&&<g data-map-node="unassigned" role="button" tabIndex={0} className="news-map-node" aria-label={`${unassigned.length} unassigned stories`} onClick={()=>setSelection({ids:unassigned.map(n=>n.id),title:'Not yet assigned',kind:'unassigned'})} onKeyDown={e=>{if(e.key==='Enter')setSelection({ids:unassigned.map(n=>n.id),title:'Not yet assigned',kind:'unassigned'})}}><text x={55} y={760} fontSize={15} fill="#80618f">Unassigned</text></g>}
            {nodes.map(n=>{const chosen=selection?.title===n.title,r=mode==='topics'?54:24+Math.min(15,Math.sqrt(n.items.length)*3),nc=n.items.filter(isNew).length;return <g key={n.id} data-map-node="topic" role="button" tabIndex={0} className="news-map-node" aria-label={`${n.title}, ${n.items.length} stories${nc?', '+nc+' new':''}`} onClick={()=>select(n)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(n)}}}><title>{n.title}: {n.items.length} stories</title><circle cx={n.x} cy={n.y} r={r+8} fill={chosen?'#d8c3e960':'#e8dff050'}/><circle cx={n.x} cy={n.y} r={r} fill={chosen?'#d9c1e8':mode==='topics'?'#e9deef':'#e3e6ee'} stroke={chosen?'#9470a7':'#cbb7d8'} strokeWidth={chosen?2.5:1.2}/>{mode==='topics'?<>{lines(n.title).map((line,i,ls)=><text key={i} x={n.x} y={n.y-15+(i-(ls.length-1)/2)*20} textAnchor="middle" fontSize={17} fill="#5e4471">{line}</text>)}<text x={n.x} y={n.y+30} textAnchor="middle" fontSize={14} fill="#88689b">{n.items.length} stories</text></>:<><text x={n.x} y={n.y+6} textAnchor="middle" fontSize={17} fill="#5e4471">{n.items.length}</text>{lines(n.title).map((line,i)=><text key={i} x={n.x} y={n.y+r+23+i*18} textAnchor="middle" fontSize={16} fill="#5e4471">{line}</text>)}</>}{nc>0&&<><rect x={n.x+r-25} y={n.y-r-9} width={62} height={23} rx={9} fill="#9170a4"/><text x={n.x+r+6} y={n.y-r+7} textAnchor="middle" fontSize={13} fill="#fff">{nc} new</text></>}</g>})}
          </g>
        </svg>
        <div className="news-map-tools"><button type="button" aria-label="Zoom in map" onClick={()=>zoom(1.15)}>＋</button><button type="button" aria-label="Zoom out map" onClick={()=>zoom(1/1.15)}>−</button><button type="button" onClick={reset}>Global map</button></div>
        <span className="news-map-legend">{mode==='topics'?'Circles: stable topics · dots: news · lines: shared stories':'Circles: companies · lines: co-mentioned in a story'}</span>
      </div>
    </section>
    <section className="news-map-reading" aria-label="News in selected map area"><header><span className="eyebrow">Selected sources</span><h2>{selection?.title||'Across the collection'}</h2><p>{selection?.kind==='shared'?'Shared stories, not a causal or business relationship.':mode==='companies'?'Stories mentioning the company.':'Select a circle or a news dot. Only news appears here.'}</p><div className="news-map-reading-controls"><span role="status">{selectedItems.length} stories</span><select aria-label="Group map news" value={group} onChange={e=>setGroup(e.target.value)}><option value="time">Newest first</option><option value="company">By company</option></select><button type="button" onClick={()=>{setSelection(null);setActive('')}}>Clear</button></div><input type="search" aria-label="Search map news" placeholder="Search selected news…" value={query} onChange={e=>setQuery(e.target.value)}/></header><div className="news-map-list">{[...groups].map(([name,items])=><div key={name}>{name&&<h3 className="news-map-company-group">{name} <small>company mentioned</small></h3>}{items.map(item=><div key={item.id} ref={el=>{if(el)cards.current.set(item.id,el);else cards.current.delete(item.id)}} className={active===item.id?'news-map-active-story':''}>{renderCard(item)}</div>)}</div>)}{!selectedItems.length&&<p className="news-map-empty">No sources in this selection. Clear the selection or change the existing time filter.</p>}</div></section>
  </div>
}
