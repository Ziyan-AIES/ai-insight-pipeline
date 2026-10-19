import { safeUrl } from './analysis'
import type { ResearchProduct } from './types'

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
    return [{id,name,description:String(raw.description || ''),company:String(raw.company || ''),url:safeUrl(String(raw.url || '')) || '',logoUrl:safeUrl(String(raw.logoUrl || '')) || '',screenshotUrl:safeUrl(String(raw.screenshotUrl || '')) || ''}]
  })
}
