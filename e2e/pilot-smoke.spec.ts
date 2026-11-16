import { expect, test } from '@playwright/test'

test('demo workspace captures news into Selected Sources',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'})
 await expect(page.getByText('Demo',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'+ New source',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'New source'})
 await dialog.getByRole('textbox',{name:'URL',exact:true}).fill('https://example.com/news?utm_source=test')
 await dialog.getByRole('textbox',{name:'Title',exact:true}).fill('Captured browser evidence')
 await dialog.getByRole('button',{name:'Save source'}).click()
 await expect(dialog).toHaveCount(0)
 await page.getByRole('button',{name:'Selected Sources',exact:true}).click()
 await expect(page.getByRole('link',{name:'Captured browser evidence',exact:true})).toBeVisible()
})

test('workspace navigates between evidence, Trends and Research',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'})
 await page.getByRole('button',{name:'Selected Sources',exact:true}).click()
 await expect(page.locator('article.live-card').first()).toBeVisible()
 await page.getByRole('button',{name:'Trends',exact:true}).click()
 await expect(page.locator('article.trend-card').first()).toBeVisible()
 await page.getByRole('button',{name:'+ New Trend',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Create Trend'})).toBeVisible()
 await page.getByRole('button',{name:'Cancel',exact:true}).click()
 await page.getByRole('button',{name:'Research',exact:true}).click()
 await expect(page.locator('.sonata-topic').first()).toBeVisible()
})
