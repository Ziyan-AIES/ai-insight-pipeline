import { expect,it } from 'vitest'
import { parseTopicAnalysis } from './supabase'
import { parseResearchProducts } from './products'
it('retains product records and research framing through the persisted topic format',()=>{
  const raw={keyQuestion:'What changed?',observed:'Evidence',currentView:'Working view',implications:'Implication',watch:'Next',products:[{id:'siri',name:'Siri',description:'A personal assistant.',company:'Apple',url:'https://www.apple.com/siri/',logoUrl:'',screenshotUrl:''}]}
  const loaded=parseTopicAnalysis(JSON.parse(JSON.stringify(raw)))
  expect(loaded).toEqual(raw)
  const edited={...loaded,currentView:'Updated interpretation'}
  expect(parseTopicAnalysis(JSON.parse(JSON.stringify(edited))).products).toEqual(raw.products)
})
it('rejects unsafe product URLs and malformed or duplicate entries',()=>{
  const products=parseResearchProducts([null,{name:''},{id:'a',name:'Siri',url:'javascript:alert(1)',logoUrl:'data:text/html,unsafe',screenshotUrl:'https://example.com/screen.png'},{id:'a',name:'Duplicate'}])
  expect(products).toHaveLength(1)
  expect(products[0]).toMatchObject({name:'Siri',url:'',logoUrl:'',screenshotUrl:'https://example.com/screen.png'})
})
