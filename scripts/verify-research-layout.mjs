import {chromium,expect} from '@playwright/test'
import fs from 'node:fs/promises'
const browser=await chromium.launch({headless:true})
try {
 const page=await browser.newPage()
 const errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto('https://aiinsightpipeline.netlify.app/?workspace=threads&reader=1',{waitUntil:'domcontentloaded'})
 await expect(page.getByText('Synced',{exact:true})).toBeVisible({timeout:60000})
 await page.getByRole('button',{name:'List',exact:true}).click()
 const card=page.locator('.sonata-topic').filter({has:page.getByRole('heading',{name:'Personalization | The Next Wave of Personal Agents',exact:true})})
 await card.scrollIntoViewIfNeeded()
 const width=await card.evaluate(el=>el.querySelector('p').getBoundingClientRect().width/el.getBoundingClientRect().width)
 expect(width).toBeGreaterThan(.85)
 const actions=await card.locator('.research-topic-actions').boundingBox()
 const description=await card.locator(':scope > p').boundingBox()
 expect(actions.y).toBeGreaterThan(description.y+description.height)
 await page.screenshot({path:'logs/research-layout-live-list.png'})
 await card.getByRole('button',{name:'Explore research'}).click()
 const introRatio=await page.locator('.sonata-research-heading').evaluate(el=>el.querySelector('p').getBoundingClientRect().width/el.getBoundingClientRect().width)
 expect(introRatio).toBeGreaterThan(.9)
 await page.screenshot({path:'logs/research-layout-live-detail.png'})
 await page.setViewportSize({width:390,height:844})
 await page.screenshot({path:'logs/research-layout-live-mobile.png'})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
 expect(errors).toEqual([])
 const receipt={checkedAt:new Date().toISOString(),listDescriptionRatio:width,detailDescriptionRatio:introRatio,errors}
 await fs.writeFile('logs/research-layout-live.json',JSON.stringify(receipt,null,2))
 console.log(JSON.stringify(receipt))
}finally{await browser.close()}
