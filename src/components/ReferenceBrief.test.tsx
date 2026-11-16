import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ReferenceBrief } from './ReferenceBrief'
const load = vi.fn()
vi.mock('../supabase', () => ({ cloudConfigured: true, loadReferenceBriefs: (...args: unknown[]) => load(...args) }))
it('switches briefing periods and keeps evidence with concise metadata', async () => {
  const common = { start:'2026-11-06T09:00:00Z', end:'2026-11-09T09:00:00Z', generatedAt:'2026-11-09T10:00:00Z', sampled:false, itemCount:3 }
  load.mockResolvedValue([
    {...common, period:'daily', coverageWarnings:['Delayed publisher'], cards:[{title:'Agent permissions change',body:'An observed change.',sources:[{id:'a',title:'Original article',url:'https://example.com/article'}]}]},
    {...common, period:'weekly', coverageWarnings:[], cards:[{title:'Week in review',body:'A different observation.',sources:[{id:'b',title:'Weekly evidence',url:'https://example.com/week'}]}]},
  ])
  render(<ReferenceBrief />)
  expect(await screen.findByText('Agent permissions change')).toBeInTheDocument()
  expect(screen.getByText('Updated 9 Nov · 3 collected articles reviewed')).toBeInTheDocument()
  expect(screen.queryByText('Delayed publisher')).not.toBeInTheDocument()
  expect(screen.getByRole('link', {name:/Original article/,hidden:true})).toHaveAttribute('href','https://example.com/article')
  fireEvent.click(screen.getByRole('button',{name:'Past week'}))
  expect(screen.getByText('Week in review')).toBeInTheDocument()
  expect(screen.queryByText('Agent permissions change')).not.toBeInTheDocument()
})
it('preserves decimal values and complete text when laying out older paragraph summaries', async()=>{
 load.mockResolvedValue([{period:'daily',start:'2026-11-12',end:'2026-11-13',generatedAt:'2026-11-13',coverageWarnings:[],itemCount:163,cards:[{title:'Reliable execution',body:'Models reach version 4.6 with better tools. Evidence remains limited. More testing is needed.',sources:[]}]}])
 render(<ReferenceBrief/>)
 expect(await screen.findByText('Models reach version 4.6 with better tools.')).toBeInTheDocument()
 expect(screen.getByText('Evidence remains limited.').tagName).toBe('LI')
 expect(screen.getByText('More testing is needed.').tagName).toBe('LI')
})
it('shows retrieval failure instead of fabricating an empty successful briefing', async () => {
  load.mockRejectedValue(new Error('offline'))
  render(<ReferenceBrief />)
  expect(await screen.findByRole('status')).toHaveTextContent('The latest briefing could not be loaded.')
})
