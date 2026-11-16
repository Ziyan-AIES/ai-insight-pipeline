import { supabase, isVisitorAccess } from './supabase'
import { parseResearchProducts } from './products'
import type { ResearchProduct } from './types'
export interface ProductSupplement { product_id:string;input:ResearchProduct;result:{fields:Partial<ResearchProduct>;source_url:string; evidence:Array<{field:string;quote:string;url:string}>} }
export function mergeProductSupplement(product:ResearchProduct,rows:ProductSupplement[]):ResearchProduct {
 const row=rows.find(row=>row.product_id===product.id&&JSON.stringify(parseResearchProducts([row.input])[0])===JSON.stringify(parseResearchProducts([product])[0]))
 if(!row)return product
 const result={...product}
 for(const field of ['description','company','companyDescription','foundedDate','launchDate'] as const){
  if(!result[field]?.trim()&&typeof row.result.fields[field]==='string')result[field]=row.result.fields[field]
 }
 return result
}
export async function loadProductSupplements(topicId:string):Promise<ProductSupplement[]>{
 if(!supabase)return []
 if(await isVisitorAccess())return []
 const {data,error}=await supabase.from('research_product_enrichment').select('product_id,input,result').eq('topic_id',topicId).eq('status','succeeded')
 if(error)throw new Error('Product enrichment is not available yet.')
 return data||[]
}
