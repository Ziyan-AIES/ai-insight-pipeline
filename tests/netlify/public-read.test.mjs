import { afterEach, describe, expect, it, vi } from 'vitest'
import { handler, publicResources } from '../../netlify/functions/public-read.mjs'
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
describe('public reading boundary', () => {
  it('does not expose privileged tables or wildcard fields', () => {
    for (const [table, fields] of Object.values(publicResources)) {
      expect(fields).not.toContain('*')
      expect(fields).not.toMatch(/email|captured_by|created_by|body/)
      expect(table).not.toMatch(/team_members|contents|jobs|events/)
    }
  })
  it('rejects arbitrary resource paths and offsets', async () => {
    vi.stubEnv('PUBLIC_WORKSPACE_ENABLED', 'true')
    for (const query of [{resource:'team_members'}, {resource:'news',offset:'0&select=*'}, {resource:'__proto__'}]) {
      expect((await handler({httpMethod:'GET',queryStringParameters:query})).statusCode).toBe(400)
    }
  })
  it('uses bounded fixed queries and removes deleted nested links', async () => {
    vi.stubEnv('PUBLIC_WORKSPACE_ENABLED', 'true')
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret')
    const fetch = vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify([{id:'test',topic_news:[{deleted_at:'today',topics:{title:'Removed'}},{topics:{title:'Visible'}}]}])))
    const result = await handler({httpMethod:'GET',queryStringParameters:{resource:'news',offset:'250',select:'*'}})
    expect(result.statusCode).toBe(200)
    expect(result.body).not.toContain('Removed')
    expect(String(fetch.mock.calls[0][0])).toContain('limit=250')
    expect(String(fetch.mock.calls[0][0])).not.toContain('select=*')
    expect(result.headers['cache-control']).toContain('s-maxage=60')
  })
})
