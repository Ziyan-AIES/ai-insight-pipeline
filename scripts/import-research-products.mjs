import fs from 'node:fs/promises'
import {supabase} from '../netlify/functions/_supabase.mjs'

const topicId=process.argv.find(arg=>arg.startsWith('--topic='))?.slice(8)
if(!topicId||!/^[0-9a-f-]{36}$/i.test(topicId))throw Error('Supply the exact research topic ID with --topic=<uuid>. Default is dry-run; --apply writes the reviewed import.')
const config=JSON.parse(await fs.readFile(new URL('../config/personal-agent-products.json',import.meta.url),'utf8'))
const rows=await supabase('topics?select=id,title,analysis,version&deleted_at=is.null&id=eq.'+encodeURIComponent(topicId))
if(rows.length!==1)throw Error('The requested active research topic was not found.')
const topic=rows[0]
if(!/personal\s+agents?/i.test(topic.title))throw Error('Target title does not identify Personal Agents. Import stopped to avoid changing another topic.')
const products=[...(Array.isArray(topic.analysis?.products)?topic.analysis.products:[])]
const key=name=>String(name||'').toLowerCase().replace(/^chatgpt\s+/,'').replace(/[^a-z0-9]/g,'')
const added=[]
for(const seed of config.products){
 const existing=products.find(item=>item.id===seed.id||key(item.name)===key(seed.name))
 if(existing)continue // Preserve all existing editorial fields, even deliberately empty ones.
 const {provenance:_provenance,...product}=seed
 products.push(product)
 added.push(seed.name)
}
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',topic:topic.title,existing:products.length-added.length,adding:added,total:products.length},null,2))
if(process.argv.includes('--apply')&&added.length){
 // Require all schema stages before importing or activating the scheduled worker.
 for(const table of ['research_sources','research_product_enrichment'])await supabase(table+'?select=id&limit=0')
 await fs.mkdir('logs',{recursive:true})
 const backup='logs/research-products-before-import-'+Date.now()+'.json'
 await fs.writeFile(backup,JSON.stringify(topic,null,2),{flag:'wx'})
 const updated=await supabase('topics?id=eq.'+encodeURIComponent(topicId)+'&version=eq.'+encodeURIComponent(topic.version),{method:'PATCH',body:JSON.stringify({analysis:{...topic.analysis,products}})})
 if(updated.length!==1)throw Error('The topic changed during import. No import was written; reload and review again.')
 console.log('Product import saved; previous topic snapshot retained at '+backup)
}
