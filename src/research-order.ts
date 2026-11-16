import type { ResearchProduct } from './types'

export function validPartialDate(value: string): boolean {
  if (!/^\d{4}(-\d{2})?(-\d{2})?$/.test(value)) return false
  const [year, month = 1, day = 1] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return year >= 1000 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function sortProducts(products: ResearchProduct[], order: 'newest' | 'oldest') {
  return [...products].sort((a, b) => {
    const da = a.launchDate && validPartialDate(a.launchDate) ? a.launchDate : ''
    const db = b.launchDate && validPartialDate(b.launchDate) ? b.launchDate : ''
    if (!da || !db) return da ? -1 : db ? 1 : a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    const normalize = (value: string) => value.length === 4 ? value + '-01-01' : value.length === 7 ? value + '-01' : value
    return normalize(da).localeCompare(normalize(db)) * (order === 'newest' ? -1 : 1) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  })
}

export type SourceKind = 'news' | 'podcast' | 'video' | 'document'
export type SourceLanguage = 'en' | 'zh' | 'mixed' | 'other' | 'unknown'
export function sourcePriority(type: SourceKind, language: string, url: string) {
  let youtube = false
  try { const host = new URL(url).hostname.toLowerCase(); youtube = host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') } catch { /* Unknown platform. */ }
  if (type === 'video' && youtube) return 10
  if (type === 'podcast' && language === 'en') return 20
  if (type === 'news' && language === 'en') return 30
  if (type === 'podcast' && language === 'zh') return 40
  if (type === 'news' && language === 'zh') return 50
  if (type === 'video') return 60
  return type === 'document' ? 80 : 70
}
