import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { IndustryRadar } from './IndustryRadar'

vi.mock('../supabase', () => ({
  cloudConfigured: true,
  loadReferenceBriefs: async () => [],
  loadRadarData: async () => ({items: [
    {id:'unmatched',sourceId:'rss',sourceName:'Menlo Ventures',sourceType:'investor',url:'https://menlovc.com/report',title:'Enterprise adoption survey',publishedAt:new Date().toISOString(),storyKey:'survey',topicSlugs:[],engagement:{}},
    {id:'single',sourceId:'rss',sourceName:'Menlo Ventures',sourceType:'investor',url:'https://menlovc.com/agents',title:'New coding agent investment',publishedAt:new Date().toISOString(),storyKey:'investment',topicSlugs:['autonomous-coding'],engagement:{}},
  ], sources: [
    {id:'mail',name:'Bessemer — Atlas',domain:'bvp.com',homepageUrl:'https://www.bvp.com/atlas',feedUrl:'',sourceType:'investor',connectorType:'agent_email',enabled:true,priority:60,displayOrder:1,itemCount7d:0},
    {id:'rss',name:'Menlo Ventures',domain:'menlovc.com',homepageUrl:'https://menlovc.com/perspective/',feedUrl:'https://menlovc.com/feed/',sourceType:'investor',connectorType:'rss',enabled:true,priority:60,displayOrder:2,itemCount7d:0},
  ]}),
}))

it('shows email provenance and setup verification separately from actual inbox checks', async () => {
  render(<IndustryRadar canAdmin={false} canEdit={false} onNotice={() => {}} />)
  fireEvent.click(await screen.findByRole('button', {name:/Sources · 2/}))
  const dialog = screen.getByRole('dialog', {name:'Sources'})
  const mail = within(dialog).getByRole('link', {name:'Bessemer — Atlas'}).closest('article')!
  expect(within(mail).getByText(/Agent email subscription/)).toBeInTheDocument()
  expect(within(mail).getByText(/Setup checked/)).toBeInTheDocument()
  expect(within(mail).getByText(/Inbox checked Not checked yet/)).toBeInTheDocument()
  expect(within(mail).queryByRole('link', {name:/RSS/})).not.toBeInTheDocument()
  expect(within(dialog).getByRole('link', {name:/RSS/})).toHaveAttribute('href','https://menlovc.com/feed/')
})

it('shows collected investor articles even when no recurring topic qualifies', async () => {
  render(<IndustryRadar canAdmin={false} canEdit={false} onNotice={() => {}} />)
  const count = await screen.findByText('2 articles collected in 7 days · 1 matched to dictionary topics · 0 recurring topics')
  fireEvent.click(screen.getByRole('button', {name:'Investor / Thesis'}))
  fireEvent.click(count)
  expect(screen.getByRole('link', {name:'Enterprise adoption survey'})).toHaveAttribute('href','https://menlovc.com/report')
  expect(screen.getByRole('link', {name:'New coding agent investment'})).toBeInTheDocument()
  expect(screen.getByText('No recurring topics in this window yet.')).toBeInTheDocument()
})
