import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { demoTopics } from '../demoData'
import { ResearchLibrary, researchTopics } from './ResearchLibrary'

describe('research library preserves historical knowledge', () => {
  it('shows output titles as safe links and routes native analysis to its reader',()=>{
    window.history.replaceState(null,'','/?workspace=threads&reader=1')
    const topic={...demoTopics[0],status:'completed' as const,outputs:[
      {id:'slides',title:'Agent study deck',kind:'PPT',dateLabel:'2026',description:'',link:'https://example.com/deck'},
      {id:'native',title:'Research findings',kind:'analysis',dateLabel:'2026',description:'',link:''},
    ]}
    render(<ResearchLibrary topics={[topic]} news={[]} canEdit={false} onEdit={()=>{}}/>)
    expect(screen.getByRole('link',{name:'Agent study deck'})).toHaveAttribute('href','https://example.com/deck')
    const link=new URL(screen.getByRole('link',{name:'Research findings'}).getAttribute('href')!)
    expect(link.searchParams.get('research')).toBe(topic.id)
    expect(link.searchParams.get('analysis')).toBe('native')
    expect(screen.queryByText('2 outputs')).toBeNull()
  })
  it('keeps completed and archived research while leaving uncommitted ideas in the workspace', () => {
    const base = demoTopics[0]
    const topics = [
      { ...base, id: 'idea', status: 'idea' as const, outputs: [], outcomeUrl: '' },
      { ...base, id: 'history', status: 'archived' as const },
      { ...base, id: 'deleted', deletedAt: '2026-01-01' },
      { ...base, id: 'legacy-output', status: 'idea' as const, outcomeUrl: 'https://example.com/deck' },
    ]
    expect(researchTopics(topics).map(topic => topic.id)).toEqual(['history', 'legacy-output'])
    expect(topics).toHaveLength(4)
  })
  it('shows existing outputs without rendering unsafe link schemes', () => {
    const topic = { ...demoTopics[0], status: 'completed' as const, outcomeUrl: '', outputs: [{ id: 'old', title: 'Historical deck', kind: 'PPT', dateLabel: '2025', description: 'Preserved output', link: 'javascript:alert(1)' }] }
    render(<ResearchLibrary topics={[topic]} news={[]} canEdit={false} onEdit={() => { throw new Error('must not edit') }} />)
    fireEvent.click(screen.getByRole('button', { name: /Explore research/ }))
    fireEvent.click(screen.getByRole('button', {name: 'Analysis'}))
    expect(screen.getByText('Historical deck')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open output/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /workspace/ })).not.toBeInTheDocument()
  })
})
