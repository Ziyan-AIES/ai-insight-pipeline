import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SharedSources } from './SharedSources'
import { ResearchLibrary } from './ResearchLibrary'
import { demoNews, demoTopics } from '../demoData'
it('filters the shared library by missing Trend and Research relationships',()=>{
  const items=[{...demoNews[0],id:'free',title:'Unassigned',trendLinks:[],topicLinks:[]},{...demoNews[0],id:'used',title:'Assigned',trendLinks:[{trendId:'t',trendTitle:'Trend',role:'supporting' as const}],topicLinks:[]}]
  render(<SharedSources news={items} canLink={false}/>)
  fireEvent.change(screen.getByRole('combobox',{name:'Relationship'}),{target:{value:'unassigned'}})
  expect(screen.getByRole('heading',{name:'Unassigned'})).toBeInTheDocument()
  expect(screen.queryByRole('heading',{name:'Assigned'})).toBeNull()
  fireEvent.change(screen.getByRole('combobox',{name:'Relationship'}),{target:{value:'no-research'}})
  expect(screen.getByRole('heading',{name:'Assigned'})).toBeInTheDocument()
})
it('links a source dropped onto an open research topic and reuses the cross removal action',()=>{
  const topic={...demoTopics[0],status:'researching' as const,supportingNews:[demoNews[0].id]}
  window.history.replaceState(null,'','/?workspace=threads&reader=1&research='+topic.id)
  const onLink=vi.fn(),onUnlink=vi.fn()
  render(<ResearchLibrary topics={[topic]} news={demoNews} canEdit canLink onEdit={vi.fn()} onLink={onLink} onUnlink={onUnlink}/>)
  const panel=screen.getByRole('heading',{name:topic.title}).closest('.sonata-research')!
  fireEvent.drop(panel,{dataTransfer:{getData:()=>demoNews[1].id}})
  expect(onLink).toHaveBeenCalledWith(topic,demoNews[1].id)
  fireEvent.click(screen.getByRole('button',{name:'Sources'}))
  fireEvent.click(screen.getByRole('button',{name:'Remove source from Research'}))
  expect(onUnlink).toHaveBeenCalledWith(topic,demoNews[0].id)
  expect(screen.getByRole('link',{name:'Open private workspace'})).toHaveAttribute('href','https://personal-agent-research-studio.ziyan-li-pku.chatgpt.site/')
})
