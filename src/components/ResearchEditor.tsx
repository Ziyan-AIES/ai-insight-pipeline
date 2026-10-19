import { useState } from 'react'
import { categoryLabels } from '../labels'
import type { NewsCategory, Topic, TopicStatus } from '../types'

export function ResearchEditor({initial,onSave,onRecycle,onReturn,onClose}:{initial:Topic;onSave?:(topic:Topic)=>Promise<void>;onRecycle?:(topic:Topic)=>Promise<void>;onReturn?:(topic:Topic)=>void;onClose:()=>void}){
  const [draft,setDraft]=useState(()=>structuredClone(initial))
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmDelete,setConfirmDelete]=useState(false)
  const dirty=draft.title!==initial.title||draft.category!==initial.category||draft.monthKey!==initial.monthKey||draft.status!==initial.status||draft.analysis.keyQuestion!==initial.analysis.keyQuestion
  async function save(){if(!draft.title.trim()){setError('Enter a research title.');return}setBusy(true);setError('');try{await onSave?.(draft);onClose()}catch(error){setError(error instanceof Error?error.message:'Could not save research details.')}finally{setBusy(false)}}
  async function recycle(){setBusy(true);setError('');try{await onRecycle?.(initial);onClose()}catch(error){setError(error instanceof Error?error.message:'Could not move research to the recycle bin.')}finally{setBusy(false)}}
  return <div className="modal-backdrop"><section className="analysis-editor research-details-editor" role="dialog" aria-modal="true" aria-labelledby="research-details-title"><header><h2 id="research-details-title">Edit research</h2><button className="unlink-button" aria-label="Close research editor" disabled={busy} onClick={onClose}>×</button></header>
    <label>Title<input value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
    <div className="research-details-fields"><label>Category<select value={draft.category} onChange={event=>setDraft({...draft,category:event.target.value as NewsCategory})}>{Object.entries(categoryLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Research period<input type="month" value={draft.monthKey} onChange={event=>setDraft({...draft,monthKey:event.target.value})}/></label><label>Status<select value={draft.status} onChange={event=>setDraft({...draft,status:event.target.value as TopicStatus})}><option value="scheduled">Planned</option><option value="researching">In progress</option><option value="completed">Completed</option><option value="published">Published</option><option value="archived">Archived</option>{draft.status==='idea'&&<option value="idea">Legacy idea</option>}</select></label></div>
    <label>Research question<textarea value={draft.analysis.keyQuestion} onChange={event=>setDraft({...draft,analysis:{...draft.analysis,keyQuestion:event.target.value}})}/></label>
    <p className="draft-notice">Returning to Trends preserves this research record, products, sources and analysis. You can review the Trend before saving the move.</p>
    {error&&<p role="alert">{error}</p>}
    {confirmDelete&&<div className="research-delete-confirm"><p>Move this research to the recycle bin? Sources and their original records will stay available.</p><button disabled={busy} onClick={()=>setConfirmDelete(false)}>Keep research</button><button disabled={busy} className="danger-button" onClick={()=>void recycle()}>Confirm move to recycle bin</button></div>}
    <footer className="research-details-actions"><div>{onRecycle&&<button className="danger-button" disabled={busy} onClick={()=>setConfirmDelete(true)}>Move to recycle bin</button>}{onReturn&&<button className="secondary-button" disabled={busy} onClick={()=>{if(dirty){setError('Save your research changes before returning to Trends.');return}onReturn(initial);onClose()}}>Return to Trends</button>}</div><div><button disabled={busy} onClick={onClose}>Cancel</button>{onSave&&<button className="primary-button" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save changes'}</button>}</div></footer>
  </section></div>
}
