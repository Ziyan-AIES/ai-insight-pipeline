import {describe,expect,it,vi} from 'vitest'
vi.mock('../netlify/functions/_supabase.mjs',()=>({canonicalizeUrl:(u:string)=>new URL(u).href,supabase:vi.fn()}))
import {validateAgentItem,officialHost,promoteOfficialItem} from './official-source-store.mjs'
import {supabase} from '../netlify/functions/_supabase.mjs'
import {runRadarIngest} from '../netlify/functions/_radar.mjs'
const source={domain:'anthropic.com',id:'source-1'}
const item={url:'https://www.anthropic.com/news/example',publishedAt:'2026-10-19',articleRead:true,dateEvidence:'Article original date: October 19, 2026',title:'Coding agents gain new evaluation controls',summary:'The new agent evaluation controls let enterprise teams test coding agents against repository tasks before deployment.',promote:false}
const now=new Date('2026-10-20T04:00:00Z')
describe('official Agent intake',()=>{
 it('does not treat a weekly website source as a failed four-hour RSS source',async()=>{
  vi.mocked(supabase).mockReset().mockResolvedValueOnce([{id:'weekly',name:'Anthropic',source_type:'official',feed_url:'',enabled:true}]).mockResolvedValueOnce([])
  expect(await runRadarIngest()).toMatchObject({fetched:0,inserted:0,failed:0,sources:[]})
  expect(supabase).toHaveBeenCalledTimes(2)
 })
 it('accepts only original official-domain articles within the last seven days',()=>{
  expect(validateAgentItem(item,source,now).topics).toContain('agent-evaluation')
  for(const change of [{url:'https://anthropic.com.evil.test/news'},{publishedAt:'2026-10-01'},{publishedAt:'2026-10-21'},{publishedAt:'bad'},{articleRead:false},{dateEvidence:''}])expect(()=>validateAgentItem({...item,...change},source,now)).toThrow()
  expect(officialHost('http://anthropic.com/news','anthropic.com')).toBe(false)
 })
 it('does not promote unrelated stories or unexplained changes',()=>{
  expect(()=>validateAgentItem({...item,title:'New office',summary:'Our new corporate office offers a range of employee amenities and a redesigned cafeteria.'},source,now)).toThrow()
  expect(()=>validateAgentItem({...item,promote:true,category:'ai_capability'},source,now)).toThrow()
 })
 it('keeps existing Selected Sources intact and attributes machine promotion to Agent',async()=>{
  vi.mocked(supabase).mockReset().mockResolvedValueOnce([{id:'existing'}])
  expect(await promoteOfficialItem(item,source)).toEqual({result:'already-exists',id:'existing'})
  expect(supabase).toHaveBeenCalledTimes(1)
  vi.mocked(supabase).mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([{id:'new'}])
  await promoteOfficialItem({...item,category:'ai_capability',importanceReason:'Concrete new controls improve the reliability of enterprise agent deployment.'},source)
  const body=JSON.parse(vi.mocked(supabase).mock.calls[1][1].body)
  expect(body.captured_by).toBeNull()
  expect(body.metadata.contributor_name).toBe('Agent')
  expect(body.editorial_status).toBe('pending')
  expect(body.published_at).toBe('2026-10-19')
  expect(body.captured_at).not.toBe(body.published_at)
 })
})
