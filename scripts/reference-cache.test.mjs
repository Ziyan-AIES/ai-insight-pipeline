import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {afterEach,expect,it} from 'vitest'
import {createCachedReason} from './reference-cache.mjs'
const directories=[]
function directory(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'reference-cache-'));directories.push(d);return d}
afterEach(()=>{for(const d of directories.splice(0))fs.rmSync(d,{recursive:true,force:true})})
it('reuses overlapping windows with different batch boundaries without reclassifying articles',async()=>{
 const seen=[]
 const reason=createCachedReason(async(_,items)=>{seen.push(items.map(x=>x.id));return {items:items.map(x=>({id:x.id,category:'Agent systems',observation:x.summary}))}},{directory:directory(),model:'model-a'})
 const rows=[{id:'a',summary:'A'},{id:'b',summary:'B'},{id:'c',summary:'C'}]
 await reason('classify',rows.slice(0,2));const result=await reason('classify',rows.slice(1));
 expect(seen).toEqual([['a','b'],['c']]);expect(result.items.map(x=>x.id)).toEqual(['b','c'])
 await reason('classify',rows);expect(seen).toHaveLength(2)
})
it('invalidates article caches when content, instructions or model change',async()=>{
 const d=directory();let calls=0;const model=async(_,items)=>{calls++;return{items:items.map(x=>({id:x.id,observation:x.summary}))}}
 const reason=createCachedReason(model,{directory:d,model:'a'});
 await reason('p',[{id:'1',summary:'old'}]);await reason('p',[{id:'1',summary:'new'}]);await reason('changed',[{id:'1',summary:'new'}]);await createCachedReason(model,{directory:d,model:'b'})('p',[{id:'1',summary:'new'}]);expect(calls).toBe(4)
})
it('does not save incomplete or foreign-ID classifications as successful cache entries',async()=>{
 const d=directory();const reason=createCachedReason(async()=>({items:[{id:'other'}]}),{directory:d,model:'a'});
 await expect(reason('p',[{id:'1'}])).rejects.toThrow('exactly once');expect(fs.readdirSync(d)).toHaveLength(0)
})
import crypto from 'node:crypto'
it('regenerates an old cache with foreign IDs instead of replaying a permanent failure',async()=>{
 const d=directory(), input=[{id:'1',summary:'fact'}], model='a', prompt='p'
 const key=crypto.createHash('sha256').update(JSON.stringify([model,prompt,input])).digest('hex')
 fs.writeFileSync(path.join(d,key+'.json'),JSON.stringify({items:[{id:'wrong'}]}))
 let calls=0
 const reason=createCachedReason(async()=>{calls++;return{items:[{id:'1',observation:'fact'}]}},{directory:d,model})
 expect((await reason(prompt,input)).items[0].id).toBe('1');expect(calls).toBe(1)
})
it('rejects an invalid topic cache and validates replacement citations and length',async()=>{
 const d=directory(), input={category:'Agent systems',notes:[{evidenceIds:['1'],observation:'fact'}]}, model='a', prompt='p'
 const key=crypto.createHash('sha256').update(JSON.stringify([model,prompt,input])).digest('hex')
 fs.writeFileSync(path.join(d,key+'.json'),JSON.stringify({summary:'x'.repeat(2401),evidenceIds:['1']}))
 let calls=0
 const reason=createCachedReason(async()=>{calls++;return{summary:'Grounded synthesis.',evidenceIds:['1']}},{directory:d,model})
 expect((await reason(prompt,input)).summary).toBe('Grounded synthesis.');expect(calls).toBe(1)
})
it('repairs an overlong topic once using the failed result without redoing extraction',async()=>{
 const d=directory();let calls=0
 const reason=createCachedReason(async(prompt,input)=>{calls++;if(calls===1)return{summary:'x'.repeat(2500),evidenceIds:['1']};expect(prompt).toContain('CORRECTION REQUIRED');expect(input.previousInvalidResult.summary).toHaveLength(2500);return{summary:'Short supported synthesis.',evidenceIds:['1']}},{directory:d,model:'a'})
 expect((await reason('summarize',{category:'Trust and governance',notes:[{observation:'fact',evidenceIds:['1']}]})).summary).toBe('Short supported synthesis.');expect(calls).toBe(2)
})
