import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { handler } from '../../netlify/functions/research-workspace-access.mjs'
const originalEnv = { ...process.env }
beforeEach(() => { process.env.SUPABASE_URL='https://project.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY='test-key' })
afterEach(() => { process.env={...originalEnv}; vi.restoreAllMocks() })
it.each([
  ['lizy76@lenovo.com','admin',true],
  ['lizy76@lenovo.com','editor',true],
  ['other@example.com','admin',false],
  ['lizy76@lenovo.com','member',false],
  ['other@example.com','editor',false],
])('checks authenticated identity %s and role %s', async (email,role,allowed) => {
  vi.spyOn(globalThis,'fetch').mockImplementation(async url => new Response(JSON.stringify(String(url).includes('/auth/v1/user') ? {id:'user',email} : [{user_id:'user',email:'lizy76@lenovo.com',role}]),{status:200}))
  const result=await handler({httpMethod:'GET',headers:{authorization:'Bearer session'}})
  expect(result.statusCode).toBe(200)
  expect(JSON.parse(result.body)).toEqual({allowed})
})
it('does not accept an extension capture token', async () => {
  const fetch=vi.spyOn(globalThis,'fetch')
  const result=await handler({httpMethod:'GET',headers:{'x-capture-token':'capture-token'}})
  expect(result.statusCode).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})
it('fails closed for invalid sessions', async () => {
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status:401}))
  expect((await handler({httpMethod:'GET',headers:{authorization:'Bearer expired'}})).statusCode).toBe(401)
})
