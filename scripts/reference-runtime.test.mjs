import { describe, expect, it } from 'vitest'
import { briefWindow, validateCards } from './reference-runtime.mjs'
import { topicSlugsFor } from '../netlify/functions/_radar.mjs'
describe('Reference briefing evidence and schedule', () => {
  it('covers the weekend on Monday and does not publish on weekends', () => {
    expect(briefWindow(new Date('2026-11-09T10:00:00Z'))).toEqual({start:'2026-11-06T09:00:00.000Z',end:'2026-11-09T09:00:00.000Z'})
    expect(briefWindow(new Date('2026-11-08T10:00:00Z'))).toBeNull()
  })
  it('catches up from the last success without repeating the same window', () => {
    expect(briefWindow(new Date('2026-11-10T10:00:00Z'),'2026-11-05T09:00:00Z').start).toBe('2026-11-05T09:00:00.000Z')
    expect(briefWindow(new Date('2026-11-10T10:00:00Z'),'2026-11-10T09:00:00Z')).toBeNull()
  })
  it('rejects fabricated references and permits quiet periods', () => {
    expect(validateCards({cards:[]},[])).toEqual([])
    expect(() => validateCards({cards:[{title:'Claim',body:'Some claim',evidenceIds:['invented']}]},[])).toThrow('cite')
  })
  it('separates physical robots, efficiency and coding topics', () => {
    expect(topicSlugsFor('AI-powered robots operate autonomous factories')).toContain('industrial-robotics')
    expect(topicSlugsFor('Small language models use model distillation')).toContain('model-efficiency')
    expect(topicSlugsFor('Law firm considers legal AI agents')).toContain('enterprise-workflow-automation')
    expect(topicSlugsFor('Publishers develop ads for AI agents')).toContain('ai-marketing')
    expect(topicSlugsFor('AI vibe coding weekend')).not.toContain('autonomous-coding')
    expect(topicSlugsFor('Agentic identity and temporary permissions for AI agents')).toContain('agent-access-governance')
  })
})
