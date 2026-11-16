import crypto from 'node:crypto'
import { supabaseRpc } from '../netlify/functions/_supabase.mjs'
import { reasonJson } from './reference-runtime.mjs'
import { summarizeResearch } from './research-synthesis.mjs'
import { enrichProduct } from './research-product-enrichment.mjs'

const owner=crypto.randomUUID(),deadline=Date.now()+20*60000
if(process.argv.includes('--check')){
 const missing=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CURSOR_API_KEY'].filter(k=>!process.env[k])
 console.log(missing.length?'Missing environment: '+missing.join(', '):'Research worker environment is configured. Database migration and model connectivity still require validation.')
 process.exitCode=missing.length?1:0
}else{
 let completed=0,failed=0
 while(Date.now()<deadline){
  const job=await supabaseRpc('claim_research_source',{p_owner:owner})
  if(!job)break
  const heartbeat=async()=>{if(!await supabaseRpc('renew_research_lease',{p_id:job.job_id,p_owner:owner}))throw Error('lease_lost')}
  try{
   if(job.source.version!==job.source_version){await supabaseRpc('finish_research_source',{p_id:job.job_id,p_owner:owner,p_error:'input_changed'});continue}
   const result=await summarizeResearch(job.source,job.content,reasonJson,heartbeat)
   await supabaseRpc('finish_research_source',{p_id:job.job_id,p_owner:owner,p_result:result});completed++
  }catch(error){
   failed++
   const code=error.message==='content_unavailable'?'content_unavailable':'processing_failed'
   try{await supabaseRpc('finish_research_source',{p_id:job.job_id,p_owner:owner,p_error:code})}catch{console.error('Research job could not be finalized; lease recovery will handle it.')}
   console.error('Research item failed: '+code)
   break
  }
 }
 let productsCompleted=0,productsFailed=0
 const productDeadline=Date.now()+10*60000
 while(Date.now()<productDeadline){
  const job=await supabaseRpc('claim_research_product',{p_owner:owner})
  if(!job)break
  try{
   const result=await enrichProduct(job.product,reasonJson)
   await supabaseRpc('finish_research_product',{p_id:job.job_id,p_owner:owner,p_result:result})
   productsCompleted++
  }catch(error){
   const code=['product_url_required','product_content_unavailable'].includes(error.message)?error.message:'processing_failed'
   try{await supabaseRpc('finish_research_product',{p_id:job.job_id,p_owner:owner,p_error:code})}catch{console.error('Product job lease expired or changed.')}
   productsFailed++
   if(code==='processing_failed')break
  }
 }
 console.log(JSON.stringify({completed,failed,productsCompleted,productsFailed}))
 if(failed||productsFailed)process.exitCode=1
}
