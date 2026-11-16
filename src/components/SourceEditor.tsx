import { useTeamAuth } from '../auth-context'
import { useEffect, useState } from 'react'
import { safeUrl } from '../analysis'
import { saveResearchSource } from '../research-sources'
import type { ResearchSource, SourceContent } from '../research-sources'
import type { SourceKind, SourceLanguage } from '../research-order'
import type { Topic } from '../types'

export interface NewsCaptureInput { url: string; title: string; contributor: string; topicId: string }
type Props = {
 topics: Topic[]; topicId?: string; initial?: ResearchSource; content?: SourceContent;
 initialNews?: {url:string;title:string;contributor:string};
 onDraftChange?: (input:NewsCaptureInput)=>void;
 onNews?: (input:NewsCaptureInput)=>Promise<void>; onClose:()=>void; onSaved?:(message:string)=>void;
}

export function SourceEditor({topics,topicId='',initial,content,initialNews,onNews,onClose,onSaved,onDraftChange}:Props) {
 const {identity,visitorName}=useTeamAuth()
 const [id]=useState(()=>initial?.id || crypto.randomUUID())
 const [type,setType]=useState<SourceKind>(initial?.type || 'news')
 const [url,setUrl]=useState(initial?.url || initialNews?.url || '')
 const [title,setTitle]=useState(initial?.title || initialNews?.title || '')
 const [contributor,setContributor]=useState(initialNews?.contributor || identity?.displayName || (visitorName === 'Anonymous' ? '' : visitorName) || '')
 const [selectedTopic,setSelectedTopic]=useState(topicId)
 const [publisher,setPublisher]=useState(initial?.publisher || '')
 const [language,setLanguage]=useState<SourceLanguage>(initial?.language || 'unknown')
 const [description,setDescription]=useState(initial?.description || '')
 const [published,setPublished]=useState(initial?.published_at || '')
 const [body,setBody]=useState(content?.body || '')
 const [scope,setScope]=useState(content?.scope || 'excerpt')
 const [visibility,setVisibility]=useState(content?.visibility || 'team')
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{if(type==='news')onDraftChange?.({url,title,contributor,topicId:selectedTopic})},[url,title,contributor,selectedTopic,type,onDraftChange])
 async function save(){
  if(!safeUrl(url)){setError('Enter a valid HTTP(S) URL.');return}
  if(type!=='news'&&!selectedTopic){setError('Choose a research topic.');return}
  setBusy(true);setError('')
  try {
   let message='Source saved.'
   if(type==='news') {if(!onNews)throw new Error('News capture is unavailable here.');await onNews({url,title,contributor,topicId:selectedTopic})}
   else {const result=await saveResearchSource({id,topic_id:selectedTopic,type,url:url.trim(),title:title.trim(),publisher,language,description,published_at:published||null},body,scope,visibility,initial?.version);if(result?.reused)message='Existing source linked. Its original description and transcript were preserved.'}
   window.dispatchEvent(new Event('research-sources-changed'));onSaved?.(message);onClose()
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not save. Your input is retained.')}
  finally{setBusy(false)}
 }
 return <div className="modal-backdrop"><section className="analysis-editor source-editor" role="dialog" aria-modal="true" aria-label={initial?'Edit source':'New source'}>
 <header><h2>{initial?'Edit source':'New source'}</h2><button disabled={busy} onClick={onClose}>Close</button></header>
 <fieldset disabled={busy}><label>Type<select value={type} onChange={e=>{setType(e.target.value as SourceKind);if(e.target.value==='document')setVisibility('restricted')}}>{(initial?['podcast','video','document']:['news','podcast','video','document']).map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label>
 <label>URL<input type="url" value={url} onChange={e=>setUrl(e.target.value)} autoFocus/></label>
 <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Optional; use the original title when available"/></label>
 <label>Research topic<select disabled={Boolean(initial)} value={selectedTopic} onChange={e=>setSelectedTopic(e.target.value)}><option value="">{type==='news'?'Selected Sources only':'Choose a topic'}</option>{topics.filter(t=>!t.deletedAt).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
 {type==='news'?<><label>Contributor<input value={contributor} onChange={e=>setContributor(e.target.value)}/></label><p>News enters Selected Sources and the existing editorial review process.</p></>:<>
 <label>Publisher<input value={publisher} onChange={e=>setPublisher(e.target.value)}/></label>
 <label>Original language<select value={language} onChange={e=>setLanguage(e.target.value as SourceLanguage)}>{[['unknown','Unknown'],['en','English'],['zh','Chinese'],['mixed','Mixed'],['other','Other']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>Published date<input type="date" value={published} onChange={e=>setPublished(e.target.value)}/></label>
 <label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label>
 <label>Transcript / Original content<textarea rows={10} value={body} onChange={e=>setBody(e.target.value)}/></label>
 <label>Coverage<select value={scope} onChange={e=>setScope(e.target.value as SourceContent['scope'])}><option value="excerpt">Excerpt</option><option value="full">Complete transcript</option></select></label>
 <label>Original content visibility<select value={visibility} onChange={e=>setVisibility(e.target.value as SourceContent['visibility'])}><option value="team">Approved team members</option><option value="restricted">Author and research editors</option></select></label>
 <p>Saved in this research topic. This material does not enter Selected Sources. Description is visible to members; restricted original content is not.</p>
 </>}</fieldset>
 {error&&<p role="alert">{error}</p>}<footer><button disabled={busy} onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save source'}</button></footer>
 </section></div>
}
