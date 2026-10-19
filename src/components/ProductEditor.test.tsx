import {fireEvent,render,screen,within,waitFor} from '@testing-library/react'
import {expect,it,vi} from 'vitest'
import App from '../App'
import {ProductEditor} from './ProductEditor'
import {ResearchLibrary} from './ResearchLibrary'
import {demoTopics} from '../demoData'
it('keeps product entries available when cloud saving fails',async()=>{
  const close=vi.fn(),save=vi.fn().mockRejectedValue(new Error('This research changed elsewhere. Reload before saving.'))
  render(<ProductEditor onClose={close} onSave={save}/>)
  fireEvent.change(screen.getByRole('textbox',{name:'Name'}),{target:{value:'Siri'}})
  fireEvent.change(screen.getByRole('textbox',{name:'Description'}),{target:{value:'A personal assistant.'}})
  fireEvent.click(screen.getByRole('button',{name:'Save product'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('changed elsewhere')
  expect(screen.getByRole('textbox',{name:'Name'})).toHaveValue('Siri')
  expect(close).not.toHaveBeenCalled()
})
it('adds and edits a name-and-description product within a research topic',async()=>{
  window.localStorage.clear();window.sessionStorage.clear();window.history.replaceState(null,'','/?workspace=threads&reader=1&research=topic-harness')
  render(<App/>)
  fireEvent.click(screen.getByRole('button',{name:'Products'}))
  fireEvent.click(screen.getByRole('button',{name:'+ New product'}))
  const editor=screen.getByRole('dialog',{name:'New product'})
  fireEvent.change(within(editor).getByRole('textbox',{name:'Name'}),{target:{value:'Siri'}})
  fireEvent.change(within(editor).getByRole('textbox',{name:'Description'}),{target:{value:'An assistant for Apple devices.'}})
  fireEvent.click(within(editor).getByRole('button',{name:'Save product'}))
  expect(await screen.findByRole('heading',{name:'Siri'})).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Edit product'}))
  const edit=screen.getByRole('dialog',{name:'Edit product'})
  expect(within(edit).getByRole('textbox',{name:'Description'})).toHaveValue('An assistant for Apple devices.')
  fireEvent.change(within(edit).getByRole('textbox',{name:'Description'}),{target:{value:'Updated description.'}})
  fireEvent.click(within(edit).getByRole('button',{name:'Save product'}))
  expect(await screen.findByText('Updated description.')).toBeInTheDocument()
  expect(screen.getAllByRole('heading',{name:'Siri'})).toHaveLength(1)
})

it('keeps the version captured when a product edit began',async()=>{
  const topic={...demoTopics[0],id:'version-topic',version:4,status:'researching' as const}
  window.history.replaceState(null,'','/?research=version-topic')
  const save=vi.fn().mockResolvedValue(undefined),edit=vi.fn()
  const view=render(<ResearchLibrary topics={[topic]} news={[]} canEdit onEdit={edit} onSaveProduct={save}/>)
  fireEvent.click(screen.getByRole('button',{name:'Products'}))
  fireEvent.click(screen.getByRole('button',{name:'+ New product'}))
  fireEvent.change(screen.getByRole('textbox',{name:'Name'}),{target:{value:'Siri'}})
  view.rerender(<ResearchLibrary topics={[{...topic,version:5}]} news={[]} canEdit onEdit={edit} onSaveProduct={save}/>)
  fireEvent.click(screen.getByRole('button',{name:'Save product'}))
  expect(save).toHaveBeenCalledWith(expect.objectContaining({version:4}),expect.objectContaining({name:'Siri'}))
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
})
