import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import App from './App'
import { demoNews } from './demoData'
import { companyNews, newsMapTopics, topicNews } from './news-map-model'

beforeEach(()=>{window.localStorage.clear();window.sessionStorage.clear();window.history.replaceState(null,'','/?workspace=signals')})
it('keeps Categories as the default and reuses the same session New cursor across map switches',()=>{
  localStorage.setItem('signal-intelligence:last-viewed:live-signals:demo','2026-01-01T00:00:00.000Z')
  render(<App />)
  const sourcePage=screen.getByRole('region',{name:'Selected Sources'})
  const controls=within(sourcePage).getByRole('group',{name:'Selected Sources view'})
  expect(within(controls).getByRole('button',{name:'Categories'})).toHaveAttribute('aria-pressed','true')
  const cursor=localStorage.getItem('signal-intelligence:last-viewed:live-signals:demo')
  fireEvent.click(within(controls).getByRole('button',{name:'Map'}))
  expect(screen.getByRole('region',{name:'Selected news map'})).toBeInTheDocument()
  expect(localStorage.getItem('signal-intelligence:last-viewed:live-signals:demo')).toBe(cursor)
  expect(screen.queryByRole('checkbox',{name:/New/})).toBeNull()
  fireEvent.click(within(controls).getByRole('button',{name:'Categories'}))
  expect(screen.queryByRole('region',{name:'Selected news map'})).toBeNull()
  expect(localStorage.getItem('signal-intelligence:last-viewed:live-signals:demo')).toBe(cursor)
  expect(sourcePage.querySelectorAll('.category-panel')).toHaveLength(6)
})
it('does not put memory-glasses stories into agent memory by a generic memory match',()=>{
  const item={...demoNews[0],title:'WorkBuddy memory glasses',summary:'Real-world office capture'}
  const memory=newsMapTopics.find(t=>t.title==='Agent memory & context')!
  expect(topicNews([item],memory.pattern)).toHaveLength(0)
  expect(topicNews([{...item,title:'Durable agent memory',summary:'Shared context'}],memory.pattern)).toHaveLength(1)
})
it('uses bounded company mentions and current item data rather than a stored experiment snapshot',()=>{
  const items=[{...demoNews[0],id:'current',title:'OpenAI update',summary:'Today'},{...demoNews[0],id:'unrelated',title:'NotOpenAIproduct',summary:''}]
  expect(companyNews(items,'OpenAI').map(n=>n.id)).toEqual(['current'])
})
