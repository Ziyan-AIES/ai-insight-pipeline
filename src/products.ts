import { safeUrl } from './analysis'
import type { ResearchProduct } from './types'

export function productImageUrl(value:string):string|null {
  if(/^\/product-media\/[a-z0-9-]+\.(png|svg|jpg|jpeg|webp|ico)$/i.test(value))return value
  return safeUrl(value)
}

export function parseResearchProducts(value: unknown): ResearchProduct[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.slice(0,500).flatMap((item,index) => {
    if (!item || typeof item !== 'object') return []
    const raw=item as Record<string,unknown>
    const name=String(raw.name || '').trim()
    if (!name) return []
    const id=String(raw.id || `product-${index}`)
    if (seen.has(id)) return []
    seen.add(id)
    return [{
      ...(typeof raw.companyDescription==='string'?{companyDescription:raw.companyDescription}:{}),
      ...(typeof raw.foundedDate==='string'?{foundedDate:raw.foundedDate}:{}),
      ...(typeof raw.launchDate==='string'?{launchDate:raw.launchDate}:{}),
      ...(['initial','major_release','public_beta','announcement'].includes(String(raw.launchKind))?{launchKind:raw.launchKind as ResearchProduct['launchKind']}:{}),
      id,name,description:String(raw.description || ''),company:String(raw.company || ''),url:safeUrl(String(raw.url || '')) || '',logoUrl:productImageUrl(String(raw.logoUrl || '')) || '',screenshotUrl:productImageUrl(String(raw.screenshotUrl || '')) || ''}]
  })
}
