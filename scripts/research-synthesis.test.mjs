import {test} from 'node:test'
import assert from 'node:assert/strict'
import {splitResearchText,summarizeResearch} from './research-synthesis.mjs'
test('long source splitting retains every character',()=>{
 const original='第一段 text.\n'.repeat(10000)
 assert.equal(splitResearchText(original).map(c=>c.text).join(''),original)
})
test('does not invent summaries from titles',async()=>{
 await assert.rejects(()=>summarizeResearch({title:'A great product'},{body:''},()=>{throw Error('must not run')}),/content_unavailable/)
})
test('rejects invented source quotations',async()=>{
 await assert.rejects(()=>summarizeResearch({}, {body:'Actual source'},async()=>({points:[{text:'Claim',quote:'Invented evidence'}]})),/Unsupported segment evidence/)
})
test('maps final key points back to original source segments',async()=>{
 let call=0
 const result=await summarizeResearch({title:'Original title'},{body:'Actual source',scope:'excerpt'},async()=>++call===1?{points:[{text:'Supported claim',quote:'Actual source'}]}:{english_title:'Title',summary:'A short source summary.',key_points:[{text:'Supported claim',evidence_ids:[0]}]})
 assert.equal(result.key_points[0].evidence[0].quote,'Actual source')
 assert.equal(result.key_points[0].evidence[0].chunk_id,1)
})
