import { expect, it } from 'vitest'
import { buildAnalysisPdf } from './analysis-pdf'
import type { TopicOutput } from './types'
const article:TopicOutput={id:'a',title:'Research',description:'Summary',kind:'article',link:'',dateLabel:'2026-10-19',content:{format:'article',author:'Research team',revision:1,blocks:[{id:'p',type:'paragraph',text:'Evidence and interpretation. '.repeat(1200)}]}}
it('paginates long articles and keeps slides at 16:9',async()=>{
  const pdf=await buildAnalysisPdf(article,'Topic')
  expect(pdf.getNumberOfPages()).toBeGreaterThan(2)
  const slides=await buildAnalysisPdf({...article,content:{...article.content!,format:'slides',blocks:[{id:'s',type:'slide',text:'A judgment\nSupporting evidence'},{id:'s2',type:'slide',text:'Next question\nA follow-up'}]}},'Topic')
  expect(slides.getNumberOfPages()).toBe(2)
  expect(slides.internal.pageSize.getWidth()/slides.internal.pageSize.getHeight()).toBeCloseTo(16/9)
})
it('rejects overflowing slides instead of cutting off text',async()=>{
  await expect(buildAnalysisPdf({...article,content:{...article.content!,format:'slides',blocks:[{id:'s',type:'slide',text:'Title\n'+('Evidence '.repeat(600))}]}},'Topic')).rejects.toThrow('too much content')
})
