import { afterEach, describe, expect, it, vi } from 'vitest'
import { handler, validateVisitorWrite } from '../../netlify/functions/visitor-write.mjs'

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
describe('visitor write boundary', () => {
  it('fails closed until explicitly enabled', async () => {
    vi.stubEnv('PUBLIC_WORKSPACE_ENABLED', '')
    expect((await handler({ httpMethod: 'POST', body: '{}' })).statusCode).toBe(503)
  })
  it('does not accept arbitrary edits, archives, or roles', () => {
    expect(() => validateVisitorWrite({ action: 'delete_trend' })).toThrow()
    expect(() => validateVisitorWrite({ action: 'update_news' })).toThrow()
    const input = validateVisitorWrite({ action: 'capture', url: 'https://example.com/news', role: 'admin', editorial_status: 'processed', contributor: '  ' })
    expect(input.contributor).toBe('Anonymous')
    expect(input).not.toHaveProperty('role')
    expect(input).not.toHaveProperty('editorial_status')
  })
  it('rejects credential URLs and unsafe protocols', () => {
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:password@example.com']) {
      expect(() => validateVisitorWrite({ action: 'capture', url })).toThrow()
    }
  })
  it('bounds text and validates association IDs', () => {
    expect(() => validateVisitorWrite({ action: 'capture', url: 'https://example.com', contributor: 'x'.repeat(81) })).toThrow()
    expect(() => validateVisitorWrite({ action: 'unlink_trend_source', trendId: '../news', newsId: 'invalid' })).toThrow()
    const id = '00000000-0000-4000-8000-000000000001'
    expect(validateVisitorWrite({ action: 'unlink_trend_source', trendId: id, newsId: id })).toEqual({ action: 'unlink_trend_source', trendId: id, newsId: id })
  })
  it('does not expose backend error details', async () => {
    vi.stubEnv('PUBLIC_WORKSPACE_ENABLED', 'true')
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'private-test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('private database error', { status: 500 }))
    const result = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'capture', url: 'https://example.com' }) })
    expect(result.statusCode).toBe(409)
    expect(result.body).not.toContain('private database error')
  })
})
