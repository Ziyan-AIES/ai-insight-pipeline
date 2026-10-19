import type { AnalysisBlock, NativeAnalysis } from './types'

export function safeUrl(value: string): string | null {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null }
  catch { return null }
}

export function parseNativeAnalysis(value: unknown): NativeAnalysis | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = value as Record<string, unknown>
  if (!['article', 'slides'].includes(String(data.format)) || !Array.isArray(data.blocks)) return undefined
  const blocks: AnalysisBlock[] = data.blocks.slice(0, 200).flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return []
    const block = raw as Record<string, unknown>
    if (!['paragraph','heading','bullets','image','slide'].includes(String(block.type))) return []
    return [{ id: String(block.id || index), type: block.type as AnalysisBlock['type'], text: String(block.text || ''), imageUrl: safeUrl(String(block.imageUrl || '')) || undefined, caption: String(block.caption || '') }]
  })
  return { format: data.format as NativeAnalysis['format'], blocks, author: String(data.author || ''), revision: Math.max(1, Number(data.revision) || 1) }
}

export function moveBlock(blocks: AnalysisBlock[], id: string, offset: number) {
  const from = blocks.findIndex(block => block.id === id), to = from + offset
  if (from < 0 || to < 0 || to >= blocks.length) return blocks
  const next = [...blocks]; [next[from], next[to]] = [next[to], next[from]]; return next
}
