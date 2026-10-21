import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { IndustryRadar } from './IndustryRadar'

vi.mock('../supabase', () => ({
  cloudConfigured: true,
  loadRadarData: async () => ({items: [], sources: [
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
