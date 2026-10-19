import {beforeEach,expect,it} from 'vitest'
import {fireEvent,render,screen,within,waitFor} from '@testing-library/react'
import App from './App'
import {researchTopics,ResearchLibrary} from './components/ResearchLibrary'
import {demoTopics} from './demoData'
import {parseTopicAnalysis} from './supabase'
beforeEach(()=>{localStorage.clear();sessionStorage.clear();window.history.replaceState(null,'','/?workspace=threads&reader=1')})
function card(){return screen.getByRole('heading',{name:'Harness engineering'}).closest('article')!}
it('remembers List through panel changes and navigation',()=>{
 render(<App/>);fireEvent.click(screen.getByRole('button',{name:'List'}));fireEvent.click(screen.getByRole('button',{name:'Sources panel'}));
 expect(screen.getByRole('button',{name:'List'})).toHaveAttribute('aria-pressed','true')
 fireEvent.click(screen.getByRole('button',{name:'Trends'}));fireEvent.click(screen.getByRole('button',{name:'Research'}))
 expect(screen.getByRole('button',{name:'List'})).toHaveAttribute('aria-pressed','true')
})
it('isolates saved view preference by viewer',()=>{
 const props={topics:demoTopics,news:[],canEdit:false,onEdit:()=>{}}
 localStorage.setItem('sonata:research-view:alice','list')
 const view=render(<ResearchLibrary {...props} viewerId="alice"/>);
 expect(screen.getByRole('button',{name:'List'})).toHaveAttribute('aria-pressed','true')
 view.rerender(<ResearchLibrary {...props} viewerId="bob"/>)
 expect(screen.getByRole('button',{name:'Cards'})).toHaveAttribute('aria-pressed','true')
 view.rerender(<ResearchLibrary {...props} viewerId="alice"/>)
 expect(screen.getByRole('button',{name:'List'})).toHaveAttribute('aria-pressed','true')
})
it('edits metadata and moves research to the recycle bin without deleting sources',async()=>{
 render(<App/>);fireEvent.click(within(card()).getByRole('button',{name:'Edit research'}))
 let editor=screen.getByRole('dialog',{name:'Edit research'})
 fireEvent.change(within(editor).getByRole('textbox',{name:'Title'}),{target:{value:'Scale POC'}})
 fireEvent.click(within(editor).getByRole('button',{name:'Save changes'}))
 const renamed=await screen.findByRole('heading',{name:'Scale POC'})
 fireEvent.click(within(renamed.closest('article')!).getByRole('button',{name:'Edit research'}))
 editor=screen.getByRole('dialog',{name:'Edit research'})
 fireEvent.click(within(editor).getByRole('button',{name:'Move to recycle bin'}))
 fireEvent.click(within(editor).getByRole('button',{name:'Confirm move to recycle bin'}))
 await waitFor(()=>expect(screen.queryByRole('heading',{name:'Scale POC'})).toBeNull())
 fireEvent.click(screen.getByRole('button',{name:'Selected Sources'}))
 expect(screen.getByRole('link',{name:'DataFlow-Harness turns agent reliability into an engineering discipline'})).toBeInTheDocument()
})
it('returns to the originating Trend and restores the same research with its products',async()=>{
 render(<App/>);fireEvent.click(within(card()).getByRole('button',{name:'Explore research ↗'}))
 fireEvent.click(screen.getByRole('button',{name:'Products'}));fireEvent.click(screen.getByRole('button',{name:'+ New product'}))
 let editor=screen.getByRole('dialog',{name:'New product'})
 fireEvent.change(within(editor).getByRole('textbox',{name:'Name'}),{target:{value:'Preserved product'}})
 fireEvent.click(within(editor).getByRole('button',{name:'Save product'}));await screen.findByRole('heading',{name:'Preserved product'})
 fireEvent.click(screen.getByRole('button',{name:'← All research'}));fireEvent.click(within(card()).getByRole('button',{name:'Edit research'}))
 fireEvent.click(screen.getByRole('button',{name:'Return to Trends'}))
 editor=screen.getByRole('dialog',{name:'Edit Trend'})
 expect(within(editor).getByRole('textbox',{name:/Trend title/})).toHaveValue('Agent reliability is becoming a product layer')
 fireEvent.click(within(editor).getByRole('button',{name:'Save changes'}))
 await waitFor(()=>expect(screen.queryByRole('heading',{name:'Harness engineering'})).toBeNull())
 fireEvent.click(screen.getByRole('button',{name:'Trends'}));fireEvent.click(screen.getByRole('button',{name:'Agent reliability is becoming a product layer'}))
 editor=screen.getByRole('dialog',{name:'Edit Trend'})
 fireEvent.click(within(editor).getByRole('button',{name:'Promote to Research'}))
 editor=screen.getByRole('dialog')
 expect(within(editor).getByDisplayValue('Harness engineering')).toBeInTheDocument()
 fireEvent.click(within(editor).getByRole('button',{name:'Save changes'}))
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
 fireEvent.click(screen.getByRole('button',{name:'Research'}))
 expect(screen.getAllByRole('heading',{name:'Harness engineering'})).toHaveLength(1)
 expect(within(card()).getByText(/2026-11/)).toBeInTheDocument()
 fireEvent.click(within(card()).getByRole('button',{name:'Explore research ↗'}));fireEvent.click(screen.getByRole('button',{name:'Products'}))
 expect(screen.getByRole('heading',{name:'Preserved product'})).toBeInTheDocument()
})
it('excludes explicitly returned records despite retained outputs and preserves the marker on reload',()=>{
 const returned={...demoTopics[0],analysis:parseTopicAnalysis({...demoTopics[0].analysis,workflowStage:'trend'}),outputs:[{id:'deck',kind:'ppt',title:'Old deck',dateLabel:'2026',link:'https://example.com/deck',description:''}]}
 expect(researchTopics([returned])).toEqual([])
 expect(returned.outputs).toHaveLength(1)
 expect(returned.analysis.workflowStage).toBe('trend')
})
