import { jsPDF } from 'jspdf'
import { safeUrl } from './analysis'
import type { TopicOutput } from './types'

function latin(text: string) {
  const value = text.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/•/g,'-')
  if (/[^\x09\x0a\x0d\x20-\xff]/.test(value)) throw new Error('PDF export currently supports English text. Non-Latin text needs an embedded font before export.')
  return value
}

export async function buildAnalysisPdf(item: TopicOutput, topic: string) {
  if (!item.content) throw new Error('Open the linked original file to download it.')
  const slides = item.content.format === 'slides'
  const pdf = new jsPDF({ unit:'pt', orientation:slides?'landscape':'portrait', format:slides?[960,540]:'a4' })
  const w=pdf.internal.pageSize.getWidth(), h=pdf.internal.pageSize.getHeight(), margin=48
  let y=margin
  function page() { pdf.addPage(); y=margin }
  function text(value: string,size=12,bold=false) {
    pdf.setFont('helvetica',bold?'bold':'normal'); pdf.setFontSize(size); pdf.setTextColor(bold?'#252338':'#565769')
    const lines=pdf.splitTextToSize(latin(value),w-margin*2) as string[]
    for (const line of lines) { if (y+size*1.5>h-54) { if(slides) throw new Error('A slide has too much content for PDF export. Split it into two slides.'); page() } pdf.text(line,margin,y+size); y+=size*1.5 }
    y+=10
  }
  if(!slides){ text('Sonata / '+topic,10); text(item.title,26,true); text([item.content.author,item.dateLabel].filter(Boolean).join(' | '),10); if(item.description) text(item.description,13); y+=12 }
  for (let i=0;i<item.content.blocks.length;i++) {
    const block=item.content.blocks[i]
    if(slides){ if(i>0) page(); text(topic,11); y+=14 }
    if(block.type==='image') {
      const url=safeUrl(block.imageUrl||''); if(!url) throw new Error('An image URL is missing or invalid.')
      const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(15000)})
      if(!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('An image could not be embedded. Check its URL and cross-origin access before exporting.')
      const bytes=new Uint8Array(await response.arrayBuffer()), props=pdf.getImageProperties(bytes)
      const width=Math.min(w-margin*2,props.width),height=Math.min(300,width*props.height/props.width),actualWidth=height*props.width/props.height
      if(y+height+60>h-54){ if(slides) throw new Error('The image does not fit this slide.'); page() }
      pdf.addImage(bytes,props.fileType,margin,y,actualWidth,height); y+=height+12; if(block.caption) text(block.caption,10)
    } else if(block.type==='slide') { const [title,...points]=block.text.split('\n'); text(title,28,true); for(const point of points.filter(Boolean)) text('- '+point,18) }
    else if(block.type==='bullets') { for(const line of block.text.split('\n').filter(Boolean)) text('- '+line,12) }
    else text(block.text,block.type==='heading'?18:12,block.type==='heading')
  }
  const pages=pdf.getNumberOfPages()
  for(let i=1;i<=pages;i++){ pdf.setPage(i);pdf.setDrawColor('#d7d3e4');pdf.line(margin,h-36,w-margin,h-36);pdf.setFontSize(9);pdf.setTextColor('#656477');pdf.text('Sonata | '+latin(item.dateLabel||''),margin,h-21);pdf.text(`${i} / ${pages}`,w-margin,h-21,{align:'right'}) }
  pdf.setProperties({title:latin(item.title),author:latin(item.content.author),subject:latin(topic)})
  return pdf
}
export async function downloadAnalysisPdf(item: TopicOutput,topic: string) { const pdf=await buildAnalysisPdf(item,topic);pdf.save(item.title.replace(/[^a-z0-9 -]/gi,'').slice(0,80)+'.pdf') }
