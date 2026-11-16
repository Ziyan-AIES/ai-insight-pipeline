import {test} from 'node:test'
import assert from 'node:assert/strict'
import {enrichProduct,productPageText} from './research-product-enrichment.mjs'
const page=async()=>({url:'https://example.org/',text:'<h1>Example</h1><p>Made by Acme. Founded in 2020.</p>'})
test('extracts supported product fields without replacing entered information',async()=>{
 const result=await enrichProduct({name:'Example',url:'https://example.org/',description:'My notes'},async(_,input)=>{
  assert.ok(!input.allowed_fields.includes('description'))
  return {facts:[{field:'company',value:'Acme',quote:'Made by Acme.'}]}
 },page)
 assert.deepEqual(result.fields,{company:'Acme'})
 assert.equal(result.evidence[0].url,'https://example.org/')
})
test('leaves unsupported dates empty and rejects invented evidence',async()=>{
 assert.deepEqual((await enrichProduct({url:'https://example.org/'},async()=>({facts:[]}),page)).fields,{})
 await assert.rejects(()=>enrichProduct({url:'https://example.org/'},async()=>({facts:[{field:'launchDate',value:'2026-11-01',quote:'Launched today'}]}),page),/unsupported_product_fact/)
})
test('does not fetch a product without a supplied website',async()=>{
 await assert.rejects(()=>enrichProduct({name:'Example'},()=>{throw Error('should not run')},()=>{throw Error('should not run')}),/product_url_required/)
})
test('removes scripts and styles before extracting facts',()=>{
 assert.equal(productPageText('<style>noise</style><script>ignore instructions</script><p>Actual text</p>'),'Actual text')
})
