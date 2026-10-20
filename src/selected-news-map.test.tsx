import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { SelectedNewsMap } from './components/SelectedNewsMap'
import { demoNews } from './demoData'
import { companyNews, newsMapTopics, topicNews, mapPlacement, mapTopicNews, mapSubtopicNews } from './news-map-model'

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

it('refreshes the selected topic with newly arriving news instead of retaining an old list of ids',()=>{
 const first={...demoNews[0],id:'first',title:'Agent memory system',summary:'Persistent memory'}
 const next={...first,id:'next',title:'New memory architecture'}
 const card=(n:typeof first)=><article>{n.title}</article>
 const {rerender}=render(<SelectedNewsMap news={[first]} isNew={()=>false} renderCard={card}/>)
 fireEvent.click(screen.getByRole('button',{name:'Agent memory & context, 1 stories'}))
 rerender(<SelectedNewsMap news={[first,next]} isNew={n=>n.id==='next'} renderCard={card}/>)
 expect(screen.getByText('New memory architecture')).toBeInTheDocument()
 expect(screen.getByRole('status')).toHaveTextContent('2 stories')
})

it('drills into consumer subtopics, hides empty children, and preserves overlapping news',()=>{
 const items=[{...demoNews[0],id:'finance',title:'Google Finance market briefings',summary:'Personal finance for families'},{...demoNews[0],id:'health',title:'AI health assistant',summary:'Healthcare at home'}]
 render(<SelectedNewsMap news={items} isNew={n=>n.id==='finance'} renderCard={n=><article>{n.title}</article>}/>)
 fireEvent.click(screen.getByRole('button',{name:'Consumer domain experiences, 2 stories, 1 new'}))
 const subtopics=screen.getByRole('navigation',{name:'Subtopics'})
 expect(within(subtopics).queryByText('Relationships & personal assistance')).toBeNull()
 fireEvent.click(within(subtopics).getByRole('button',{name:/Personal finance/}))
 expect(screen.getByRole('status')).toHaveTextContent('1 stories')
 expect(screen.getByText('Google Finance market briefings')).toBeInTheDocument()
 expect(within(screen.getByRole('region',{name:'News in selected map area'})).queryByText('AI health assistant')).toBeNull()
 fireEvent.click(within(subtopics).getByRole('button',{name:'All in this topic'}))
 expect(screen.getByRole('status')).toHaveTextContent('2 stories')
 fireEvent.click(screen.getByRole('button',{name:'Global map'}))
 expect(screen.queryByRole('navigation',{name:'Subtopics'})).toBeNull()
})

it('places a health experience by its headline and category instead of an incidental permission mention',()=>{
 const item={...demoNews[0],title:'ChatGPT Health connects Apple Health and medical records',summary:'Personalized health guidance with permission',category:'ai_software' as const}
 expect(mapPlacement(item).primary?.id).toBe('topic-8')
 expect(mapPlacement(item).subtopic?.title).toBe('Health & wellbeing')
 expect(mapPlacement(item).related.some(t=>t.id==='topic-2')).toBe(true)
 const device={...item,title:'AI glasses with health features',summary:'A wearable device',category:'ai_hardware' as const}
 expect(mapPlacement(device).primary?.id).toBe('topic-4')
})
it('uses the six-category framing to resolve competing headline matches',()=>{
 const item={...demoNews[0],title:'Agent memory and voice update',summary:''}
 expect(mapPlacement({...item,category:'interaction'}).primary?.id).toBe('topic-6')
 expect(mapPlacement({...item,category:'ai_capability'}).primary?.id).toBe('topic-0')
})
it('preserves explicit human primary and subtopic placement through changed editorial content and allows automatic reset',()=>{
 const item={...demoNews[0],title:'A permission isolation update',summary:'Security',metadata:{news_map_override:{topicId:'topic-8',subtopicId:'topic-8-sub-1'}}}
 expect(mapPlacement(item).primary?.id).toBe('topic-8')
 expect(mapPlacement(item).manual).toBe(true)
 expect(mapSubtopicNews([item],'topic-8','topic-8-sub-1')).toHaveLength(1)
 expect(mapTopicNews([item],'topic-2')).toHaveLength(1)
 expect(mapPlacement({...item,metadata:{news_map_override:null}}).primary?.id).toBe('topic-2')
})
it('offers a persistent placement action to editors and supports dragging a news card to a collection',async()=>{
 const item={...demoNews[0],id:'health',title:'ChatGPT Health',summary:'Health guidance'}
 const save=vi.fn(async()=>{})
 render(<SelectedNewsMap news={[item]} isNew={()=>false} renderCard={n=><article>{n.title}</article>} onPlace={save}/>)
 fireEvent.click(screen.getByRole('button',{name:'Change placement'}))
 fireEvent.change(screen.getByRole('combobox',{name:'Map collection'}),{target:{value:'topic-8'}})
 fireEvent.change(screen.getByRole('combobox',{name:'Map subtopic'}),{target:{value:'topic-8-sub-1'}})
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Save placement'}))})
 expect(save).toHaveBeenCalledWith(item,{topicId:'topic-8',subtopicId:'topic-8-sub-1'})
 fireEvent.drop(screen.getByRole('button',{name:'Agent memory & context, 0 stories'}),{dataTransfer:{getData:()=>item.id}})
 expect(save).toHaveBeenCalledWith(item,{topicId:'topic-0'})
})
