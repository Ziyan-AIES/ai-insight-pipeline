import { useState } from 'react'
import type { NewsItem } from '../types'
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
 if(!onPlace)return null
 return <div className={`news-map-placement${editing?' is-editing':''}`}>
  {!editing&&<button className="news-map-change-category" type="button" onClick={()=>{setTopicId(placement.primary?.id||'topic-8');setSubtopicId(placement.subtopic?.id||'');setEditing(true)}}><span aria-hidden="true">◉</span> Change Category</button>}
  {editing&&<fieldset aria-label="Change Category" disabled={saving}>
   <label>Collection<select aria-label="Map collection" value={topicId} onChange={e=>{setTopicId(e.target.value);setSubtopicId('')}}>{newsMapTopics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
   <label>Subtopic<select aria-label="Map subtopic" value={subtopicId} onChange={e=>setSubtopicId(e.target.value)}><option value="">Automatic</option>{topic?.subtopics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
   <div className="news-map-placement-actions"><button type="button" onClick={()=>void save({topicId,subtopicId:subtopicId||undefined})}>{saving?'Saving…':'Save'}</button><button type="button" onClick={()=>void save(null)}>Use automatic</button><button type="button" onClick={()=>setEditing(false)}>Cancel</button></div>
  </fieldset>}
  {error&&<p role="alert">{error}</p>}
 </div>
}
