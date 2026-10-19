import { useEffect, useState } from 'react'
import { moveBlock, parseNativeAnalysis, safeUrl } from '../analysis'
import type { AnalysisBlock, TopicOutput } from '../types'

export function AnalysisBody({ item }: { item: TopicOutput }) {
  const [page, setPage] = useState(0)
  const content = item.content
  if (!content) return <>{safeUrl(item.link) ? <a href={safeUrl(item.link)!} target="_blank" rel="noreferrer">Open original {item.kind || 'file'} ↗</a> : <p>No valid file link has been added.</p>}</>
  const slides = content.format === 'slides'
  const activePage = Math.min(page, Math.max(0, content.blocks.length - 1))
  const visible = slides ? content.blocks.slice(activePage, activePage + 1) : content.blocks
  return <><div className={slides ? 'analysis-slide' : 'analysis-article'}>{visible.map(block => <section key={block.id}>
    {block.type === 'heading' ? <h3>{block.text}</h3> : block.type === 'bullets' ? <ul>{block.text.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}</ul> : block.type === 'slide' ? <><h3>{block.text.split('\n')[0]}</h3><ul>{block.text.split('\n').slice(1).filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}</ul></> : block.type !== 'image' ? <p>{block.text}</p> : null}
    {block.type === 'image' && safeUrl(block.imageUrl || '') && <figure><img src={safeUrl(block.imageUrl!)!} alt={block.caption || 'Research illustration'} loading="lazy"/><figcaption>{block.caption}</figcaption></figure>}
  </section>)}</div>{slides && <div className="analysis-controls"><button disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>← Previous</button><span>{content.blocks.length ? activePage + 1 : 0} / {content.blocks.length}</span><button disabled={activePage >= content.blocks.length - 1} onClick={() => setPage(activePage + 1)}>Next →</button></div>}</>
}

export function AnalysisEditor({ initial, onPublish, onClose, draftKey }: {
  initial?: TopicOutput; onPublish: (item: TopicOutput) => Promise<void>; onClose: () => void; draftKey: string
}) {
  const [item, setItem] = useState<TopicOutput>(() => {
    try { const saved = JSON.parse(localStorage.getItem(draftKey) || 'null'); if (saved?.title !== undefined && (!initial || (saved.id === initial.id && saved.content?.revision === initial.content?.revision))) return { ...saved, content: parseNativeAnalysis(saved.content) } } catch { /* A damaged local draft must not block editing. */ }
    if (initial) return structuredClone(initial)
    return { id: crypto.randomUUID(), title: '', description: '', kind: 'link', link: '', dateLabel: new Date().toISOString().slice(0, 10) }
  })
  const [preview, showPreview] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify(item)) } catch { setError('Local draft storage is unavailable. Keep this editor open until publishing.') } }, [item, draftKey])
  function format(value: string) {
    setItem(current => ({ ...current, kind: value, content: value === 'link' ? undefined : { format: value as 'article' | 'slides', blocks: current.content?.blocks || [], author: current.content?.author || '', revision: current.content?.revision || 1 } }))
  }
  function patchBlock(id: string, patch: Partial<AnalysisBlock>) { setItem(current => ({ ...current, content: { ...current.content!, blocks: current.content!.blocks.map(block => block.id === id ? { ...block, ...patch } : block) } })) }
  function add(type: AnalysisBlock['type']) { setItem(current => ({ ...current, content: { ...current.content!, blocks: [...current.content!.blocks, { id: crypto.randomUUID(), type, text: '' }] } })) }
  async function publish() {
    setError(''); if (!item.title.trim()) { setError('Add a title.'); return }
    if (!item.content && !safeUrl(item.link)) { setError('Use a valid http or https link.'); return }
    if (item.content && (!item.content.blocks.length || item.content.blocks.some(block => block.type === 'image' ? !safeUrl(block.imageUrl || '') : !block.text.trim()))) { setError('Complete every content block before publishing.'); return }
    if (item.content?.format === 'slides' && item.content.blocks.some(block => block.text.length > 650)) { setError('Split dense slides into smaller pages before publishing.'); return }
    setBusy(true)
    try { await onPublish({ ...item, title: item.title.trim(), content: item.content ? { ...item.content, revision: (initial?.content?.revision || 0) + 1 } : undefined }); localStorage.removeItem(draftKey); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Publication failed. Your draft is retained.') }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop"><section className="analysis-editor" role="dialog" aria-modal="true" aria-label="Analysis workspace">
    <header><div><span className="eyebrow">Research workspace</span><h2>{initial ? 'Edit analysis' : 'New analysis'}</h2></div><button disabled={busy} onClick={onClose}>Close</button></header>
    <p className="draft-notice">Draft is saved on this browser only. Publish explicitly to share with members.</p>
    <label>Format<select value={item.content?.format || 'link'} disabled={Boolean(initial)} onChange={event => format(event.target.value)}><option value="link">PPT / document link</option><option value="article">Article</option><option value="slides">HTML Slides · 16:9</option></select></label>
    <label>Title<input value={item.title} onChange={event => setItem({ ...item, title: event.target.value })}/></label>
    <label>Summary<textarea value={item.description} onChange={event => setItem({ ...item, description: event.target.value })}/></label>
    <label>Date<input type="date" value={item.dateLabel} onChange={event => setItem({ ...item, dateLabel: event.target.value })}/></label>
    {!item.content ? <label>Original file URL<input value={item.link} onChange={event => setItem({ ...item, link: event.target.value })} placeholder="https://…"/></label> : <>
      <label>Author<input value={item.content.author} onChange={event => setItem({ ...item, content: { ...item.content!, author: event.target.value } })}/></label>
      <button onClick={() => showPreview(!preview)}>{preview ? 'Edit blocks' : 'Preview reader view'}</button>
      {preview ? <AnalysisBody item={item}/> : <>{item.content.blocks.map((block, index) => <section className="analysis-block-editor" key={block.id} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const sourceId=event.dataTransfer.getData('application/x-analysis-block'); if(!sourceId || sourceId===block.id) return; const blocks=[...item.content!.blocks]; const from=blocks.findIndex(candidate=>candidate.id===sourceId); if(from<0)return; const [moved]=blocks.splice(from,1); blocks.splice(blocks.findIndex(candidate=>candidate.id===block.id),0,moved);setItem({...item,content:{...item.content!,blocks}}) }}>
        <div className="analysis-controls"><strong>{index + 1} · {block.type}</strong><button draggable onDragStart={event=>{event.dataTransfer.setData('application/x-analysis-block',block.id);event.dataTransfer.effectAllowed='move'}} aria-label="Drag block to reorder">Drag</button><button disabled={index === 0} onClick={() => setItem({ ...item, content: { ...item.content!, blocks: moveBlock(item.content!.blocks, block.id, -1) } })}>Move up</button><button disabled={index === item.content!.blocks.length - 1} onClick={() => setItem({ ...item, content: { ...item.content!, blocks: moveBlock(item.content!.blocks, block.id, 1) } })}>Move down</button><button onClick={() => setItem({ ...item, content: { ...item.content!, blocks: item.content!.blocks.filter(candidate => candidate.id !== block.id) } })}>Remove block</button></div>
        {block.type === 'image' ? <><label>Image URL<input value={block.imageUrl || ''} onChange={event => patchBlock(block.id, { imageUrl: event.target.value })}/></label><label>Caption / alternative text<input value={block.caption || ''} onChange={event => patchBlock(block.id, { caption: event.target.value })}/></label></> : <label>{block.type === 'slide' ? 'Slide title on first line; one point per following line' : block.type === 'bullets' ? 'One bullet per line' : 'Text'}<textarea value={block.text} onChange={event => patchBlock(block.id, { text: event.target.value })}/></label>}
        {block.type === 'slide' && block.text.length > 650 && <p role="alert">This slide is too dense. Split it into two pages before publishing.</p>}
      </section>)}<div className="analysis-controls">{(item.content.format === 'slides' ? ['slide'] as const : ['heading','paragraph','bullets','image'] as const).map(type => <button key={type} onClick={() => add(type)}>+ {type}</button>)}</div></>}
    </>}
    {error && <p role="alert">{error}</p>}<footer><button disabled={busy} className="primary-button" onClick={() => void publish()}>{busy ? 'Publishing…' : 'Publish to members'}</button></footer>
  </section></div>
}
