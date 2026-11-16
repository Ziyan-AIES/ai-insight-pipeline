import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SourceEditor } from './SourceEditor'
import { saveResearchSource } from '../research-sources'
import { demoTopics } from '../demoData'
vi.mock('../research-sources',()=>({saveResearchSource:vi.fn()}))
beforeEach(()=>vi.clearAllMocks())
it('defaults to news and forwards the current form values',async()=>{
 const save=vi.fn().mockResolvedValue(undefined)
 render(<SourceEditor topics={demoTopics} onNews={save} onClose={()=>{}}/>)
 fireEvent.change(screen.getByLabelText('URL'),{target:{value:'https://example.com/news'}})
 fireEvent.change(screen.getByLabelText('Title'),{target:{value:'A new source'}})
 fireEvent.click(screen.getByRole('button',{name:'Save source'}))
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({url:'https://example.com/news',title:'A new source'})))
 expect(saveResearchSource).not.toHaveBeenCalled()
})
it('requires a topic for non-news and preserves full long transcripts',async()=>{
 const news=vi.fn(),close=vi.fn(),body='Long original text. '.repeat(5000)
 render(<SourceEditor topics={demoTopics} onNews={news} onClose={close}/>)
 fireEvent.change(screen.getByLabelText('Type'),{target:{value:'podcast'}})
 fireEvent.change(screen.getByLabelText('URL'),{target:{value:'https://example.com/podcast'}})
 fireEvent.click(screen.getByRole('button',{name:'Save source'}))
 expect(screen.getByRole('alert')).toHaveTextContent('Choose a research topic')
 fireEvent.change(screen.getByLabelText('Research topic'),{target:{value:demoTopics[0].id}})
 fireEvent.change(screen.getByLabelText('Transcript / Original content'),{target:{value:body}})
 fireEvent.click(screen.getByRole('button',{name:'Save source'}))
 await waitFor(()=>expect(saveResearchSource).toHaveBeenCalledWith(expect.objectContaining({type:'podcast',topic_id:demoTopics[0].id}),body,'excerpt','team',undefined))
 expect(news).not.toHaveBeenCalled()
})
it('retains user input when saving fails',async()=>{
 const save=vi.fn().mockRejectedValue(new Error('Database unavailable')),close=vi.fn()
 render(<SourceEditor topics={demoTopics} onNews={save} onClose={close}/>)
 fireEvent.change(screen.getByLabelText('URL'),{target:{value:'https://example.com/news'}})
 fireEvent.click(screen.getByRole('button',{name:'Save source'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable')
 expect(screen.getByLabelText('URL')).toHaveValue('https://example.com/news')
 expect(close).not.toHaveBeenCalled()
})
