import {test,expect} from '@playwright/test'
test('Visitor opens public workspace, retains name, and requests editor login',async({page})=>{
 const protectedRequests:string[]=[]
 await page.route('https://public-fixture.supabase.co/**',async route=>{protectedRequests.push(route.request().url());await route.fulfill({status:403,json:{message:'Protected'}})})
 await page.route('**/api/public-read?**',route=>route.fulfill({json:{data:[]}}))
 await page.route('**/api/extension-auth',route=>route.fulfill({status:404,json:{}}))
 await page.goto('/')
 await expect(page.getByRole('button',{name:'Signal Reference',exact:true})).toHaveClass(/active/)
 await page.getByRole('button',{name:'Open profile menu'}).click()
 await expect(page.getByText('Visitor',{exact:true})).toBeVisible()
 await page.getByRole('menuitem',{name:'Edit name'}).click()
 await page.getByRole('textbox',{name:'Name',exact:true}).fill('Browser Reader')
 await page.getByRole('button',{name:'Save',exact:true}).click()
 await page.reload()
 await page.getByRole('button',{name:'Open profile menu'}).click()
 await expect(page.getByText('Browser Reader',{exact:true})).toBeVisible()
 await expect(page.getByRole('menuitem',{name:'Team',exact:true})).toHaveCount(0)
 await page.getByRole('menuitem',{name:'Editor sign in'}).click()
 await expect(page.getByRole('dialog',{name:'Editor sign in'})).toContainText('lizy76')
 await page.screenshot({path:'logs/public-visitor-desktop.png',fullPage:true})
 expect(protectedRequests).toEqual([])
 await page.getByRole('dialog',{name:'Editor sign in'}).getByRole('button',{name:'Close'}).click()
 await page.setViewportSize({width:390,height:844})
 await page.screenshot({path:'logs/public-visitor-mobile.png',fullPage:true})
})

test('Visitor explores Research and contributes a document without edit controls',async({page})=>{
 const topicId='00000000-0000-4000-8000-000000000003'
 const writes:Record<string,unknown>[]=[]
 const topic={id:topicId,title:'Public research fixture',category:'ecosystem',status:'active',kind:'insight',thread_status:'active',display_order:1,analysis:{workflowStage:'research',keyQuestion:'A public question',products:[{id:'product',name:'Example product',url:'https://example.org/product',company:'Example',description:'Public product'}]},outputs:[],topic_news:[]}
 await page.route('**/api/extension-auth',route=>route.fulfill({status:404,json:{}}))
 await page.route('**/api/public-read?**',route=>route.fulfill({json:{data:new URL(route.request().url()).searchParams.get('resource')==='topics'?[topic]:[]}}))
 await page.route('**/api/visitor-write',async route=>{writes.push(route.request().postDataJSON());await route.fulfill({json:{result:{reused:false}}})})
 await page.goto('/?workspace=threads')
 await page.getByRole('button',{name:'Explore research'}).click()
 await expect(page.getByRole('button',{name:'Edit research',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'+ New product',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'+ New source',exact:true}).last().click()
 const dialog=page.getByRole('dialog',{name:'New source'})
 await dialog.getByRole('combobox',{name:'Type',exact:true}).selectOption('document')
 await dialog.getByRole('textbox',{name:'URL',exact:true}).fill('https://example.org/document')
 await dialog.getByRole('textbox',{name:'Title',exact:true}).fill('Visitor document')
 await dialog.getByRole('button',{name:'Save source'}).click()
 await expect.poll(()=>writes.some(w=>w.action==='research_source'&&w.topicId===topicId)).toBe(true)
})

test('Visitor submits news, links and unlinks evidence, and cannot edit an existing Trend',async({page})=>{
 const newsId='00000000-0000-4000-8000-000000000001',trendId='00000000-0000-4000-8000-000000000002'
 const writes:Record<string,unknown>[]=[]
 const news={id:newsId,canonical_url:'https://example.org/story',title:'Public source fixture',source:'Example',summary:'Public evidence',category:'ecosystem',captured_at:'2026-11-13T00:00:00Z',updated_at:'2026-11-13T00:00:00Z',editorial_status:'processed',metadata:{contributor_name:'Reader'},topic_news:[]}
 const trend={id:trendId,title:'Public trend fixture',category:'ecosystem',observation:'Observed change',status:'active',created_at:'2026-11-13T00:00:00Z',version:1,trend_news:[],trend_topics:[]}
 await page.route('**/api/extension-auth',route=>route.fulfill({status:404,json:{}}))
 await page.route('**/api/public-read?**',route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource')
  return route.fulfill({json:{data:resource==='news'?[news]:resource==='trends'?[trend]:[]}})
 })
 await page.route('**/api/visitor-write',async route=>{
  const input=route.request().postDataJSON();writes.push(input)
  await route.fulfill({json:{result:input.action==='capture'?{id:newsId,canonicalUrl:input.url,alreadyExisted:true,removed:false,contributorName:input.contributor}:{}}})
 })
 await page.goto('/?workspace=synthesis')
 await page.getByRole('button',{name:'Public trend fixture',exact:true}).click()
 await expect(page.getByRole('button',{name:'Save changes',exact:true})).toBeHidden()
 await expect(page.getByRole('button',{name:'Delete Trend',exact:true})).toBeHidden()
 await page.getByRole('button',{name:'Cancel',exact:true}).click()
 await page.getByRole('button',{name:'View linked sources',exact:true}).click()
 await page.getByRole('combobox',{name:'Relationship'}).selectOption('all')
 await page.getByRole('button',{name:'Link source',exact:true}).click()
 await expect.poll(()=>writes.some(w=>w.action==='link_trend_source')).toBe(true)
 await page.getByRole('button',{name:'Remove signal from Trend'}).click()
 await expect.poll(()=>writes.some(w=>w.action==='unlink_trend_source')).toBe(true)
 await page.getByRole('button',{name:'+ New source',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'New source'})
 await dialog.getByRole('textbox',{name:'URL',exact:true}).fill('https://example.org/submission')
 await dialog.getByRole('textbox',{name:'Contributor',exact:true}).fill('Test Visitor')
 await dialog.getByRole('button',{name:'Save source'}).click()
 await expect.poll(()=>writes.some(w=>w.action==='capture'&&w.contributor==='Test Visitor')).toBe(true)
 await page.getByRole('button',{name:'Selected Sources',exact:true}).click()
 await expect(page.getByRole('button',{name:'Signal actions'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:/Recommend/})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Add thought',exact:true})).toHaveCount(0)
})
