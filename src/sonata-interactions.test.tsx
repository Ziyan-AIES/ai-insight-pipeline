import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'
it('accepts native source payloads from the shared library at the new Trend drop zone',async()=>{
  window.localStorage.clear();window.sessionStorage.clear();window.history.replaceState(null,'','/?workspace=synthesis')
  render(<App/>);
  const source=screen.getByRole('heading',{name:'DataFlow-Harness turns agent reliability into an engineering discipline'}).closest('article')!
  const payload=new Map<string,string>()
  const dataTransfer={types:['application/x-news-id'],effectAllowed:'copy',dropEffect:'copy',setData:(type:string,value:string)=>payload.set(type,value),getData:(type:string)=>payload.get(type)||''}
  fireEvent.dragStart(source,{dataTransfer})
  const zone=screen.getByText('Drop here to create a Trend')
  expect(fireEvent.dragEnter(zone,{dataTransfer})).toBe(false)
  expect(fireEvent.dragOver(zone,{dataTransfer})).toBe(false)
  fireEvent.drop(zone,{dataTransfer})
  const editor=screen.getByRole('dialog',{name:'Create Trend'})
  fireEvent.change(within(editor).getByRole('textbox',{name:/Trend title/}),{target:{value:'Native source drop trend'}})
  fireEvent.click(within(editor).getByRole('button',{name:'Create Trend'}))
  const created=await screen.findByRole('button',{name:'Native source drop trend'})
  expect(within(created.closest('article')!).getByRole('link',{name:'DataFlow-Harness turns agent reliability into an engineering discipline'})).toBeInTheDocument()
  expect(screen.queryByText('Needs review')).toBeNull()
})
it('keeps source dates in the Selected Sources heading row and links to the private workspace',()=>{
  window.localStorage.clear();window.sessionStorage.clear();window.history.replaceState(null,'','/?workspace=signals')
  render(<App/>);
  const heading=screen.getByRole('heading',{name:'Selected Sources'}).closest('.pane-heading')!
  expect(within(heading as HTMLElement).getByRole('group',{name:'Time range'})).toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Workspace'})).toHaveAttribute('href','https://personal-agent-research-studio.ziyan-li-pku.chatgpt.site/')
})
