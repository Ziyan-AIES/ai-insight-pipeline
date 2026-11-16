import { expect,test } from '@playwright/test'

test('Trend editor remains scrollable in a short viewport',async({page})=>{
 await page.setViewportSize({width:900,height:620})
 await page.goto('/?workspace=synthesis',{waitUntil:'domcontentloaded'})
 await page.getByRole('button',{name:'+ New Trend',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Create Trend'})
 await expect(dialog).toBeVisible()
 const save=dialog.getByRole('button',{name:'Create Trend',exact:true})
 await save.scrollIntoViewIfNeeded()
 await expect(save).toBeInViewport()
 const box=await dialog.boundingBox()
 expect(box!.y+box!.height).toBeLessThanOrEqual(621)
})

test('last Radar topic remains reachable across viewport sizes',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'})
 await page.getByRole('button',{name:'Signal Reference',exact:true}).click()
 for(const width of [1847,980,720,540]){
  await page.setViewportSize({width,height:760})
  const last=page.locator('.radar-topic-row').last()
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
  await last.click()
  await expect(last).toHaveClass(/selected/)
 }
})

test('navigation and Research remain usable on desktop and mobile',async({page})=>{
 await page.goto('/?workspace=threads&reader=1',{waitUntil:'domcontentloaded'})
 for(const width of [1440,900,540,390]){
  await page.setViewportSize({width,height:844})
  await expect(page.getByRole('button',{name:'Research',exact:true})).toBeVisible()
  await page.locator('.sonata-topic').first().getByRole('button',{name:'Explore research'}).click()
  await expect(page.getByRole('navigation',{name:'Research sections'})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.getByRole('button',{name:'← All research'}).click()
 }
})
