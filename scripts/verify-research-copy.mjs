import fs from 'node:fs'
import assert from 'node:assert/strict'
import {supabase} from '../netlify/functions/_supabase.mjs'
const expected=JSON.parse(fs.readFileSync('config/research-copy-2026-11-16.json','utf8'))
const rows=await supabase('topics?deleted_at=is.null&select=id,title,analysis,version')
for(const [id,version,title,description] of expected){
 const row=rows.find(row=>row.id===id)
 assert.equal(row?.title,title)
 assert.equal(row?.analysis?.description,description)
 assert.ok(row.version>version)
}
console.log(`Verified all ${expected.length} research titles and descriptions, including version advancement.`)
