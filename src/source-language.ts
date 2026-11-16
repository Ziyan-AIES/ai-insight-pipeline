import { useState } from 'react'

const key = 'sonata:source-language'
const choices = ['all', 'en', 'zh', 'mixed', 'other', 'unknown']
export function useSourceLanguage() {
  const [language, setLanguage] = useState(() => {
    try { const value = localStorage.getItem(key); return value && choices.includes(value) ? value : 'all' } catch { return 'all' }
  })
  return [language, (value: string) => {
    setLanguage(value)
    try { localStorage.setItem(key, value) } catch { /* Storage may be disabled. */ }
  }] as const
}

// Use original-source evidence, never the translated display title or summary.
export function sourceLanguage(url: string, metadata?: Record<string, unknown>) {
  try { if (new URL(url).hostname === 'mp.weixin.qq.com') return 'zh' } catch { /* No valid source URL. */ }
  const value = String(metadata?.original_language || metadata?.language || '').toLowerCase()
  if (/^(zh|cn|chinese)(-|$)/.test(value)) return 'zh'
  if (/^(en|english)(-|$)/.test(value)) return 'en'
  return ['mixed', 'other'].includes(value) ? value : 'unknown'
}
