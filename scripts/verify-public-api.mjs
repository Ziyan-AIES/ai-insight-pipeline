import {request} from '@playwright/test'
import fs from 'node:fs/promises'
const api=await request.newContext({baseURL:'https://aiinsightpipeline.netlify.app',timeout:60000})
try{
 const checks=[];let news
 for(const resource of ['news','topics','trends','radarSources','radarItems','briefs']){
  const response=await api.get('/api/public-read',{params:{resource}})
  const body=await response.json()
  if(response.status()!==200||!Array.isArray(body.data))throw new Error(`${resource}: ${response.status()} ${JSON.stringify(body)}`)
  if(resource==='news')news=body.data
  checks.push({resource,status:response.status(),rows:body.data.length})
 }
 const denied=await api.post('/api/visitor-write',{data:{action:'delete_trend'}})
 if(denied.status()!==400)throw new Error('Unsupported visitor action was not rejected')
 const extension=await api.post('/api/capture',{data:{url:'https://example.org/unauthorized-check'}})
 if(![401,403].includes(extension.status()))throw new Error(`Extension capture unexpectedly allowed: ${extension.status()}`)
 const item=news?.find(row=>row.canonical_url?.startsWith('https://'))
 if(!item)throw new Error('No existing news available for duplicate-only submission check')
 const duplicate=await api.post('/api/visitor-write',{data:{action:'capture',url:item.canonical_url,title:item.title,contributor:'Verification - must not overwrite'}})
 const result=await duplicate.json()
 if(duplicate.status()!==200||result.result?.id!==item.id||!result.result.alreadyExisted)throw new Error(`Duplicate check failed: ${JSON.stringify(result)}`)
 if(result.result.contributorName==='Verification - must not overwrite')throw new Error('Existing attribution was overwritten')
 const report={checkedAt:new Date().toISOString(),checks,unsupportedAction:denied.status(),extensionAnonymousDenied:extension.status(),duplicatePreserved:true}
 await fs.writeFile('logs/public-api-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await api.dispose()}
