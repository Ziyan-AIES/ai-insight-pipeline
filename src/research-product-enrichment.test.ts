import {expect,it} from 'vitest'
import {mergeProductSupplement} from './research-product-enrichment'
import type {ProductSupplement} from './research-product-enrichment'
const product={id:'one',name:'Example',description:'My description',url:'https://example.org/',company:'',logoUrl:'',screenshotUrl:''}
const rows:ProductSupplement[]=[{product_id:'one',input:product,result:{fields:{company:'Example Inc.',description:'Generated description',launchDate:'2026-10'},source_url:product.url,evidence:[]}}]
it('fills only missing product fields while preserving user descriptions',()=>{
 expect(mergeProductSupplement(product,rows)).toMatchObject({company:'Example Inc.',description:'My description',launchDate:'2026-10'})
 expect(product.company).toBe('')
})
it('hides supplements once their source product has changed',()=>{
 const edited={...product,url:'https://example.org/new'}
 expect(mergeProductSupplement(edited,rows)).toEqual(edited)
})
