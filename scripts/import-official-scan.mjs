import fs from 'node:fs'
import {supabase} from '../netlify/functions/_supabase.mjs'
import {validateAgentItem,saveRadarCandidates,promoteOfficialItem} from './official-source-store.mjs'
const input=process.argv.find((v,i)=>i>1&&!v.startsWith('--'))
if(!input)throw Error('Provide a reviewed scan JSON file; use --apply to save')
const batch=JSON.parse(fs.readFileSync(input,'utf8'))
if(!Array.isArray(batch.sources)||!batch.sources.length)throw Error('Provide at least one completed source scan')
const registry=JSON.parse(fs.readFileSync(new URL('../config/official-sources.json',import.meta.url)))
const apply=process.argv.includes('--apply')
const sources=await supabase('radar_sources?deleted_at=is.null&select=*')
const seen=new Set()
for(const scan of batch.sources || []){const config=registry.find(c=>c.key===scan.key),source=config&&sources.find(s=>s.domain===config.domain)
  if(!source||seen.has(scan.key))throw Error('Unknown or repeated official source')
  seen.add(scan.key)
  if(!source.enabled){console.log(source.name,'paused; skipped');continue}
  try{
    if(scan.complete!==true)throw Error('Scan incomplete; do not claim success')
    if(!Array.isArray(scan.items))throw Error('Scan items must be an array, including for no results')
    const items=scan.items.map(n=>validateAgentItem(n,config))
    if(!apply){console.log(source.name,'validated',items.length,'items;',items.filter(n=>n.promote).length,'promotions');continue}
    const added=await saveRadarCandidates(source,items,'website_agent')
    const promotions=[];for(const item of items.filter(n=>n.promote))promotions.push(await promoteOfficialItem(item,source))
    await supabase(`radar_sources?id=eq.${source.id}`,{method:'PATCH',body:JSON.stringify({last_fetched_at:new Date().toISOString(),last_success_at:new Date().toISOString(),last_error:''})})
    console.log(source.name,JSON.stringify({added,promotions}))
  }catch(e){if(apply)await supabase(`radar_sources?id=eq.${source.id}`,{method:'PATCH',body:JSON.stringify({last_fetched_at:new Date().toISOString(),last_error:e.message})});console.error(source.name,e.message);process.exitCode=1}
}
