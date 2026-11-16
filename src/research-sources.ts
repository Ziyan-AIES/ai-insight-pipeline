import { supabase, isVisitorAccess } from './supabase'
import { publicRead, visitorWrite } from './visitor'
import type { SourceKind, SourceLanguage } from './research-order'
export interface ResearchSource {
 id: string; topic_id: string; type: Exclude<SourceKind,'news'>; url: string; title: string;
 publisher: string; language: SourceLanguage; description: string; published_at: string | null;
 created_at: string; created_by: string; version: number;
 research_source_summaries?: Array<{source_version:number;english_title:string;summary:string;scope:string;basis:string;key_points:Array<{text:string}>}>;
}
export interface SourceContent { body:string;scope:'full'|'excerpt';visibility:'team'|'restricted' }
export async function loadSourceContent(id:string):Promise<SourceContent|null>{
 if(!supabase)return null
 if(await isVisitorAccess())return null
 const {data,error}=await supabase.from('research_source_contents').select('body,scope,visibility').eq('source_id',id).maybeSingle()
 if(error)throw new Error(error.message)
 return data
}
export async function unlinkResearchSource(topicId:string,id:string){
 if(!supabase)throw new Error('Research database is not connected.')
 const {error}=await supabase.rpc('unlink_research_source',{p_topic_id:topicId,p_source_id:id})
 if(error)throw new Error(error.message)
}
export async function loadResearchSources(topicId: string): Promise<ResearchSource[]> {
 if (!supabase) return []
 if(await isVisitorAccess()){
   const rows=await publicRead<{linked_at:string;research_sources:ResearchSource}>('researchSources',topicId)
   return rows.map(row=>({...row.research_sources,topic_id:topicId,created_at:row.linked_at}))
 }
 const sources:ResearchSource[]=[]
 const pageSize=250
 for(let offset=0;;offset+=pageSize){
  const {data,error}=await supabase.from('research_topic_sources').select('linked_at,research_sources(*,research_source_summaries(*))').eq('topic_id',topicId).is('unlinked_at',null).order('linked_at',{ascending:false}).order('source_id').range(offset,offset+pageSize-1)
  if(error) throw new Error('Research sources could not be loaded. Please retry or check the research database setup.')
  for(const row of data||[]){const item=row.research_sources as unknown as ResearchSource|null;if(item)sources.push({...item,topic_id:topicId,created_at:row.linked_at})}
  if(!data||data.length<pageSize)return sources
 }
}
export async function saveResearchSource(source: Omit<ResearchSource,'created_at'|'created_by'|'version'>,body: string,scope:string,visibility:string,version?:number) {
 if(!supabase) throw new Error('Connect the research database to save this source.')
 if(new TextEncoder().encode(body).length>2097152) throw new Error('Transcript exceeds the 2 MiB limit. Your input has been retained.')
 if(await isVisitorAccess()){
   if(version!==undefined)throw new Error('Editor access is required to edit existing sources.')
   return visitorWrite<{reused:boolean}>({action:'research_source',...source,topicId:source.topic_id,body,scope})
 }
 const {data,error}=await supabase.rpc('save_research_source',{p_source:source,p_body:body,p_scope:scope,p_visibility:visibility,p_expected_version:version ?? null})
 if(error) throw new Error(error.message)
 return {reused:data!==source.id}
}
