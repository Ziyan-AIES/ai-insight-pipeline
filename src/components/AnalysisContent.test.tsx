import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AnalysisEditor } from './AnalysisContent'

describe('explicit analysis publication', () => {
  beforeEach(()=>localStorage.clear())
  it('keeps edits private until publication and retains the draft on a failed save', async () => {
    const publish=vi.fn().mockRejectedValue(new Error('Version conflict'))
    render(<AnalysisEditor draftKey="test-draft" onClose={()=>{}} onPublish={publish}/>)
    fireEvent.change(screen.getByLabelText('Title'),{target:{value:'My analysis'}})
    fireEvent.change(screen.getByLabelText('Original file URL'),{target:{value:'https://example.com/deck'}})
    expect(publish).not.toHaveBeenCalled();expect(localStorage.getItem('test-draft')).toContain('My analysis')
    fireEvent.click(screen.getByRole('button',{name:'Publish to members'}))
    await screen.findByRole('alert');expect(screen.getByRole('alert')).toHaveTextContent('Version conflict');expect(localStorage.getItem('test-draft')).toContain('My analysis')
  })
  it('publishes a structured article only after its blocks are complete',async()=>{
    const publish=vi.fn().mockResolvedValue(undefined)
    render(<AnalysisEditor draftKey="article-draft" onClose={()=>{}} onPublish={publish}/>)
    fireEvent.change(screen.getByLabelText('Format'),{target:{value:'article'}})
    fireEvent.change(screen.getByLabelText('Title'),{target:{value:'A research question'}})
    fireEvent.click(screen.getByRole('button',{name:'+ paragraph'}))
    fireEvent.change(screen.getByLabelText('Text'),{target:{value:'Ground the judgment in source evidence.'}})
    fireEvent.click(screen.getByRole('button',{name:'Publish to members'}))
    await waitFor(()=>expect(publish).toHaveBeenCalledOnce());expect(publish.mock.calls[0][0].content.blocks[0].text).toContain('source evidence')
    expect(localStorage.getItem('article-draft')).toBeNull()
  })
})
