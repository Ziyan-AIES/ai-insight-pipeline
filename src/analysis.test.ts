import { describe, expect, it } from 'vitest'
import { moveBlock, parseNativeAnalysis, safeUrl } from './analysis'
import { parseTopicOutputs } from './supabase'

describe('analysis storage and safe rendering', () => {
  it('round-trips native analysis through the existing output parser', () => {
    const output={id:'article',title:'A perspective',content:{format:'article',author:'Researcher',revision:3,blocks:[{id:'one',type:'paragraph',text:'Evidence before conclusions.'}]}}
    expect(parseTopicOutputs([output])[0].content).toMatchObject(output.content)
  })
  it('rejects executable links and preserves text rather than treating it as HTML', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,hello')).toBeNull()
    const data=parseNativeAnalysis({format:'article',blocks:[{type:'image',imageUrl:'javascript:alert(1)',text:'<script>bad</script>'},{type:'unknown'}]})
    expect(data?.blocks).toHaveLength(1);expect(data?.blocks[0].imageUrl).toBeUndefined();expect(data?.blocks[0].text).toBe('<script>bad</script>')
  })
  it('reorders blocks without losing content or mutating the draft', () => {
    const blocks=[{id:'a',type:'paragraph' as const,text:'First'},{id:'b',type:'paragraph' as const,text:'Second'}]
    expect(moveBlock(blocks,'b',-1).map(block=>block.id)).toEqual(['b','a']);expect(blocks[0].id).toBe('a');expect(moveBlock(blocks,'a',-1)).toBe(blocks)
  })
})
