import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, afterEach, expect, it } from 'vitest'
import { parseArticleEvidence, cleanArticleUrl } from './article-verification.mjs'
import { validateMailExtraction, reviewMail, retryReadyReviews } from './daily-mail.mjs'
import { agentCount, eligibleCandidates, selectDaily } from './daily-selection.mjs'
import { dayWindow, withLock } from './pipeline-common.mjs'
const cwd=process.cwd();let temp
beforeEach(()=>{temp=fs.mkdtempSync(path.join(os.tmpdir(),'daily-pipeline-test-'));process.chdir(temp)})
afterEach(()=>{process.chdir(cwd);if(path.dirname(path.resolve(temp))!==path.resolve(os.tmpdir()))throw Error('Unexpected cleanup path');fs.rmSync(temp,{recursive:true,force:true})})
const now=new Date('2026-11-11T08:00:00Z')
const html=(extra='')=>`<h1>Personal Agent Memory Update</h1><link rel="canonical" href="https://example.com/article"><meta property="article:published_time" content="2026-11-10T20:00:00Z">${extra}`
it('uses original publisher dates, not modified dates or newsletter arrival',()=>{
 const proof=parseArticleEvidence(html('<meta property="article:modified_time" content="2026-11-11T07:00:00Z">'),'https://example.com/article','Personal Agent Memory Update',now)
 expect(proof.publishedAt).toBe('2026-11-10T20:00:00.000Z')
 expect(()=>parseArticleEvidence('<h1>Personal Agent Memory Update</h1><meta property="article:modified_time" content="2026-11-11">','https://example.com/article','Personal Agent Memory Update',now)).toThrow('publication date')
})
it('rejects conflicting dates, mismatched titles and cross-domain canonicals',()=>{
 expect(()=>parseArticleEvidence(html('<meta name="datePublished" content="2026-11-09">'),'https://example.com/article','Personal Agent Memory Update',now)).toThrow('conflicting')
 expect(()=>parseArticleEvidence(html(),'https://example.com/article','Unrelated Robot Factory News',now)).toThrow('title')
 expect(()=>parseArticleEvidence(html().replace('https://example.com/article','https://other.com/article'),'https://example.com/article','Personal Agent Memory Update',now)).toThrow('Cross-domain')
 expect(()=>cleanArticleUrl('https://example.com/unsubscribe?user=1')).toThrow()
})
const message={id:'msg_test',sender:'news@example.com',subject:'Personal Agent Memory Update',text:'A personal assistant now remembers user preferences across conversations, with controls for deleting stored memories.',links:[{url:'https://example.com/article'}]}
const article={title:message.subject,summary:message.text,support:message.text,linkId:'L1',evidenceType:'excerpt'}
it('keeps unknown senders pending without spending a model call',async()=>{
 const result=await reviewMail(message,{sources:[],radar:[],reason:()=>{throw Error('must not run')}})
 expect(result.decision).toBe('pending')
})
it('rejects invented links and unsupported body quotes',()=>{
 expect(()=>validateMailExtraction({decision:'review',reason:'Relevant personal assistant update.',articles:[{...article,linkId:'L2'}]},message,[{id:'L1'}])).toThrow('Invented')
 expect(()=>validateMailExtraction({decision:'review',reason:'Relevant personal assistant update.',articles:[{...article,support:'This invented passage is definitely not in the supplied original newsletter.'}]},message,[{id:'L1'}])).toThrow('quote')
})
it('retains the whole mail as pending if any extracted article fails verification',async()=>{
 const result=await reviewMail(message,{sources:[{id:'s',domain:'example.com',enabled:true}],radar:[],reason:async()=>({decision:'review',reason:'Relevant personal assistant update.',articles:[article,{...article,title:'Second Personal Assistant Update'}]}),verify:async(_,title)=>{if(title.startsWith('Second'))throw Error('date missing');return{url:'https://example.com/article',publishedAt:'2026-11-10T20:00:00Z'}}})
 expect(result.decision).toBe('pending');expect(result.items).toBeUndefined()
})
const sources=[{id:'s',enabled:true}],candidate={id:'r',source_id:'s',title:message.subject,summary:message.text,canonical_url:'https://example.com/article',published_at:'2026-11-10T20:00:00Z'}
it('counts deleted recommendations and excludes deleted URLs with trailing-slash differences',()=>{
 const rows=[{canonical_url:'https://example.com/article/',captured_at:'2026-11-11T03:00:00Z',deleted_at:'2026-11-11T04:00:00Z',metadata:{contributor_name:'Agent'}}]
 expect(agentCount(rows,dayWindow(now))).toBe(1)
 expect(eligibleCandidates([candidate],sources,rows,now)).toEqual([])
 expect(eligibleCandidates([candidate],[{id:'s',enabled:false}],[],now)).toEqual([])
})
it('skips the model once the daily cap is reached, including deleted records',async()=>{
 const result=await selectDaily({radar:[candidate],sources,now,load:async()=>[1,2].map(id=>({id,metadata:{contributor_name:'Agent',agent_selection_day:'2026-11-11'},deleted_at:'2026-11-11'})),reason:()=>{throw Error('must not run')}})
 expect(result.results).toEqual([]);expect(result.existingAgentCount).toBe(2)
})
it('does not promote a newly discovered article whose original publication is old',async()=>{
 let writes=0
 const result=await selectDaily({radar:[candidate],sources,now,load:async()=>[],reason:async()=>({picks:[{id:'r',category:'ai_software',reason:'Directly improves personal assistant memory.'}]}),verify:async()=>({url:candidate.canonical_url,publishedAt:'2026-11-01T00:00:00Z',datePrecision:'timestamp'}),db:async()=>{writes++;return[]}})
 expect(writes).toBe(0);expect(result.results[0].status).toBe('pending')
})
it('prevents overlapping local writers',async()=>{
 await withLock('test',async()=>{await expect(withLock('test',async()=>{})).rejects.toThrow('already running')})
 await expect(withLock('test',async()=>true)).resolves.toBe(true)
})
it('preserves verified original dates and marks paid preview content as excerpt',async()=>{
 const result=await reviewMail(message,{sources:[{id:'s',domain:'example.com',enabled:true}],radar:[],reason:async()=>({decision:'review',reason:'Relevant personal assistant update.',articles:[article]}),verify:async()=>({url:'https://example.com/article',publishedAt:'2026-10-01T00:00:00Z',urlVerified:true})})
 expect(result.decision).toBe('import');expect(result.items[0].summary).toMatch(/^Excerpt:/);expect(result.items[0].publishedAt).toBe('2026-10-01T00:00:00Z')
})
it('excludes matching event titles from another publisher, including deleted selections',()=>{
 expect(eligibleCandidates([candidate],sources,[{title:candidate.title,canonical_url:'https://another.com/report',deleted_at:'2026-11-11'}],now)).toEqual([])
})
it('keeps a verified retry queued until the importer completes its readback',async()=>{
 fs.mkdirSync('logs/agent-mail',{recursive:true})
 const file='logs/agent-mail/verified.json'
 fs.writeFileSync(file,JSON.stringify({messages:[{id:'msg_test',decision:'import'}]}))
 fs.writeFileSync('logs/agent-mail/ready-reviews.json',JSON.stringify({files:[file]}))
 let result=await retryReadyReviews({run:async()=>{}})
 expect(result.failures).toHaveLength(1)
 expect(JSON.parse(fs.readFileSync('logs/agent-mail/ready-reviews.json')).files).toHaveLength(1)
 result=await retryReadyReviews({run:async(_,args)=>{if(args.includes('--apply'))fs.writeFileSync('logs/agent-mail/processed.json',JSON.stringify({msg_test:{decision:'import'}}))}})
 expect(result.completed).toEqual([file]);expect(JSON.parse(fs.readFileSync('logs/agent-mail/ready-reviews.json')).files).toEqual([])
})
