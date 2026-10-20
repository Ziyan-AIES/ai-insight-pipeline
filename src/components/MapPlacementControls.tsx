import { useState } from 'react'
import type { NewsItem } from '../types'
import { categoryLabels } from '../labels'
import { mapPlacement, newsMapTopics, type NewsMapOverride } from '../news-map-model'

export function MapPlacementControls({item,onPlace}:{item:NewsItem;onPlace?:(item:NewsItem,value:NewsMapOverride|null)=>Promise<void>}) {
 const placement=mapPlacement(item)
 const [editing,setEditing]=useState(false)
 const [topicId,setTopicId]=useState<string>(placement.primary?.id||'topic-8')
 const [subtopicId,setSubtopicId]=useState(placement.subtopic?.id||'')
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const topic=newsMapTopics.find(t=>t.id===topicId)
 async function save(value:NewsMapOverride|null){
  if(!onPlace || saving)return
  setSaving(true);setError('')
  try{await onPlace(item,value);setEditing(false)}catch(e){setError(e instanceof Error?e.message:'Placement could not be saved.')}finally{setSaving(false)}
 }
 return <div className="news-map-placement">
  <div><strong>Primary</strong> · {placement.primary?.title||'Unassigned'}{placement.subtopic?' / '+placement.subtopic.title:''}<span> · {placement.manual?'Human set':'Automatic'}</span></div>
  <details><summary>Why here?</summary><p>{placement.manual?'A team member set the primary placement.':'Matched news title and summary; title matches rank first, then the existing news category: '+categoryLabels[item.category]+'.'} Related topics reflect additional text matches, not the main placement.</p>{placement.related.length>0&&<p>Related: {placement.related.map(t=>t.title).join(' · ')}</p>}</details>
  {onPlace&&!editing&&<button type="button" onClick={()=>{setTopicId(placement.primary?.id||'topic-8');setSubtopicId(placement.subtopic?.id||'');setEditing(true)}}>Change placement</button>}
  {editing&&<fieldset disabled={saving}><legend>Primary map placement</legend><label>Collection<select aria-label="Map collection" value={topicId} onChange={e=>{setTopicId(e.target.value);setSubtopicId('')}}>{newsMapTopics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label>Subtopic<select aria-label="Map subtopic" value={subtopicId} onChange={e=>setSubtopicId(e.target.value)}><option value="">Automatic within collection</option>{topic?.subtopics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><p>Shared team placement. The original six-category assignment stays unchanged.</p><button type="button" onClick={()=>void save({topicId,subtopicId:subtopicId||undefined})}>{saving?'Saving…':'Save placement'}</button><button type="button" onClick={()=>void save(null)}>Use automatic</button><button type="button" onClick={()=>setEditing(false)}>Cancel</button></fieldset>}
  {error&&<p role="alert">{error}</p>}
 </div>
}
