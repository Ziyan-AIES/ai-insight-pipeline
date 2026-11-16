import { describe, expect, it } from 'vitest'
import { sortProducts, sourcePriority, validPartialDate } from './research-order'
import type { ResearchProduct } from './types'
const product = (id: string, launchDate = ''): ResearchProduct => ({ id, name: id, launchDate, description: '', company: '', url: '', logoUrl: '', screenshotUrl: '' })
describe('research ordering', () => {
  it('validates partial dates without accepting overflow', () => {
    for (const date of ['2026', '2026-11', '2024-02-29']) expect(validPartialDate(date)).toBe(true)
    for (const date of ['2026-02-29', '2026-13', '2026-00', '2026-11-31', '26']) expect(validPartialDate(date)).toBe(false)
  })
  it('keeps unknown dates last in both directions without mutating the input', () => {
    const input = [product('unknown'), product('old', '2025'), product('new', '2026-10')]
    expect(sortProducts(input, 'newest').map(p => p.id)).toEqual(['new', 'old', 'unknown'])
    expect(sortProducts(input, 'oldest').map(p => p.id)).toEqual(['old', 'new', 'unknown'])
    expect(input[0].id).toBe('unknown')
  })
  it('prioritizes real YouTube URLs without matching lookalike domains', () => {
    expect(sourcePriority('video', 'zh', 'https://www.youtube.com/watch?v=a')).toBe(10)
    expect(sourcePriority('video', 'en', 'https://youtube.com.example.org')).toBe(60)
    expect(sourcePriority('podcast', 'en', '')).toBeLessThan(sourcePriority('news', 'en', ''))
    expect(sourcePriority('news', 'zh', '')).toBeLessThan(sourcePriority('document', 'en', ''))
  })
})
