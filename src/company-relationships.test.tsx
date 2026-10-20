import { expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { companyRelationshipNews, companyRelationships } from './company-relationships'
import { companyNews, newsMapCompanies } from './news-map-model'
import { SelectedNewsMap } from './components/SelectedNewsMap'
import { demoNews } from './demoData'

it('does not turn a co-mention or a competing product comparison into cooperation',()=>{
 const item={...demoNews[0],url:'https://example.com/comparison',title:'OpenAI competes with Perplexity',summary:'Two companies are compared.'}
 expect(companyRelationshipNews([item],'entity:OpenAI','entity:Perplexity')).toHaveLength(0)
})
it('uses an exact source URL and does not infer relationships between all parties in a multi-company article',()=>{
 const item={...demoNews[0],url:'https://www.granola.ai/blog/granola-mcp?utm_source=test',title:'Meeting context connector',summary:''}
 expect(companyRelationshipNews([item],'entity:Granola','entity:OpenAI')).toHaveLength(1)
 expect(companyRelationshipNews([item],'entity:Granola','entity:Anthropic')).toHaveLength(1)
 expect(companyRelationshipNews([item],'entity:OpenAI','entity:Anthropic')).toHaveLength(0)
 expect(companyRelationships({...item,url:'https://example.com/blog/granola-mcp'})).toHaveLength(0)
})
it('accepts reviewed relationship metadata only with matching source evidence',()=>{
 const item={...demoNews[0],url:'https://example.com/news',metadata:{company_relationships:[{from:'entity:HP',to:'entity:Microsoft',kind:'integration',verified:true,evidence_url:'https://example.com/news'}]}}
 expect(companyRelationshipNews([item],'entity:HP','entity:Microsoft')).toHaveLength(1)
 expect(companyRelationships({...item,url:'https://example.com/unrelated'})).toHaveLength(0)
})
it('maps Claude to the Anthropic company without creating a separate company',()=>{
 const c=newsMapCompanies.find(c=>c.id==='entity:Anthropic')!
 expect(companyNews([{...demoNews[0],title:'Claude update',summary:''}],c.aliases)).toHaveLength(1)
 expect(newsMapCompanies.map(c=>c.title)).not.toContain('Claude')
})
it('keeps requested new companies visible and filters cooperation edges separately from shared mentions',()=>{
 const known={...demoNews[0],id:'known',url:'https://openai.com/index/openai-and-apple-announce-partnership/',title:'OpenAI and Apple partner',summary:''}
 const unrelated={...known,id:'comparison',url:'https://example.com/comparison',title:'Apple and OpenAI compared'}
 render(<SelectedNewsMap news={[known,unrelated]} isNew={()=>false} renderCard={n=><article>{n.title}</article>}/>)
 fireEvent.click(screen.getByRole('button',{name:'Companies'}))
 expect(screen.getByRole('button',{name:'HP, 0 stories'})).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Dell, 0 stories'})).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Samsung, 0 stories'})).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'OpenAI and Apple: 1 relationship stories'}))
 expect(screen.getByRole('status')).toHaveTextContent('1 stories')
 expect(screen.queryByText('Apple and OpenAI compared')).toBeNull()
 fireEvent.change(screen.getByRole('combobox',{name:'Company relationship view'}),{target:{value:'shared'}})
 fireEvent.click(screen.getByRole('button',{name:'OpenAI and Apple: 2 shared stories'}))
 expect(screen.getByRole('status')).toHaveTextContent('2 stories')
})
