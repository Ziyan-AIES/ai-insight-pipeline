import fs from 'node:fs'
import {supabase} from '../netlify/functions/_supabase.mjs'
import {parseFeed} from '../netlify/functions/_radar.mjs'
import {saveRadarCandidates} from './official-source-store.mjs'
const config=JSON.parse(fs.readFileSync(new URL('../config/official-sources.json',import.meta.url)))
const apply=process.argv.includes('--apply'),refresh=process.argv.includes('--refresh')
const existing=await supabase('radar_sources?deleted_at=is.null&select=*')
let order=Math.max(0,...existing.map(n=>n.display_order))
for(const entry of config){
  let row=existing.find(n=>n.domain.replace(/^www\./,'')===entry.domain)
  if(!apply){console.log(entry.name,row?'update':'add',entry.method);continue}
  const values={name:entry.name,domain:entry.domain,homepage_url:entry.homepageUrl,feed_url:entry.feedUrl,source_type:'official',connector_type:'rss'}
  if(row){const updated=await supabase(`radar_sources?id=eq.${row.id}`,{method:'PATCH',headers:{prefer:'return=representation'},body:JSON.stringify(values)});row=updated[0]}
  else {const added=await supabase('radar_sources',{method:'POST',headers:{prefer:'return=representation'},body:JSON.stringify({...values,enabled:true,priority:80,display_order:++order})});row=added[0]}
  if(refresh&&entry.feedUrl&&row.enabled){try{
    // Only the fixed, reviewed registry can be fetched here. Production's public-input SSRF guard is unchanged.
    const response=await fetch(entry.feedUrl,{signal:AbortSignal.timeout(20000)})
    if(!response.ok)throw Error('HTTP '+response.status)
    if(new URL(response.url).hostname!==new URL(entry.feedUrl).hostname)throw Error('Unexpected feed redirect domain')
    const xml=await response.text();if(Buffer.byteLength(xml)>2*1024*1024)throw Error('Feed too large')
    const now=Date.now(),items=parseFeed(xml,response.url).filter(n=>+new Date(n.publishedAt)>=now-7*86400000&&+new Date(n.publishedAt)<=now)
    const saved=await saveRadarCandidates(row,items,'rss')
    await supabase(`radar_sources?id=eq.${row.id}`,{method:'PATCH',body:JSON.stringify({last_fetched_at:new Date().toISOString(),last_success_at:new Date().toISOString(),last_error:''})})
    console.log(entry.name,'RSS ready;',saved,'new relevant items')
  }catch(e){await supabase(`radar_sources?id=eq.${row.id}`,{method:'PATCH',body:JSON.stringify({last_fetched_at:new Date().toISOString(),last_error:e.message})});console.log(entry.name,'needs attention:',e.message);process.exitCode=1}}
  else console.log(entry.name,entry.method==='website_agent'?'weekly Agent ready':'RSS configured')
}
