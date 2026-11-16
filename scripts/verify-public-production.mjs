import { chromium, expect } from '@playwright/test'
import fs from 'node:fs/promises'
const browser=await chromium.launch({headless:true})
try {
 const context=await browser.newContext()
 const page=await context.newPage()
 const errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto('https://aiinsightpipeline.netlify.app/',{waitUntil:'domcontentloaded'})
 await page.getByRole('button',{name:'Signal Reference',exact:true}).waitFor({timeout:60000})
 await page.getByText('Synced',{exact:true}).waitFor({timeout:60000})
 await page.getByRole('button',{name:'Open profile menu'}).click()
 await page.getByText('Visitor',{exact:true}).waitFor()
 await page.screenshot({path:'logs/public-production-desktop.png',fullPage:true})
 await page.getByRole('button',{name:'Selected Sources',exact:true}).click()
 await expect(page.getByRole('button',{name:'Signal actions'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:/Recommend/})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Add thought',exact:true})).toHaveCount(0)
 await page.screenshot({path:'logs/public-production-sources.png',fullPage:true})
 const result={url:page.url(),errors,checkedAt:new Date().toISOString(),visitor:true}
 await fs.writeFile('logs/public-production-verification.json',JSON.stringify(result,null,2))
 if(errors.length)throw new Error(errors.join('\n'))
 console.log(JSON.stringify(result))
}finally{await browser.close()}
