import { expect, test } from '@playwright/test'

test('opens every selected source without requiring the extension', async ({
  context,
  page,
}) => {
  await context.route(/^https:\/\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<title>Radar source</title>',
    }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Signal Reference' }).click()

  const radar = page.getByRole('region', { name: 'Signal Reference' })
  const selectedUrls = await radar.locator('.radar-evidence-item').evaluateAll((labels) =>
    labels.flatMap((label) => {
      const input = label.querySelector('input')
      const anchor = label.querySelector('a')
      return input?.checked && anchor?.href ? [anchor.href] : []
    }),
  )
  expect(selectedUrls.length).toBeGreaterThan(1)

  const popupPromise = context.waitForEvent('page')
  await radar.getByRole('button', { name: /Open selected/ }).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')

  expect(popup.url()).toBe(selectedUrls[0])
  await expect.poll(()=>context.pages().length).toBe(selectedUrls.length+1)
  await expect.poll(()=>context.pages().slice(1).map(tab=>tab.url()).sort()).toEqual([...selectedUrls].sort())
  await expect(radar.getByText('Open remaining sources')).toHaveCount(0)
})

test('Research list uses full-width descriptions and bottom-right adjacent actions',async({page})=>{
 await page.goto('/?workspace=threads&reader=1',{waitUntil:'domcontentloaded'})
 await page.getByRole('button',{name:'List',exact:true}).click()
 const card=page.locator('.sonata-topic').first()
 const description=await card.locator(':scope > p').boundingBox()
 const row=await card.boundingBox()
 const explore=await card.getByRole('button',{name:'Explore research'}).boundingBox()
 const edit=await card.getByRole('button',{name:'Edit research'}).boundingBox()
 expect(description!.width/row!.width).toBeGreaterThan(.85)
 expect(Math.abs(explore!.y+explore!.height/2-edit!.y-edit!.height/2)).toBeLessThan(2)
 expect(explore!.y).toBeGreaterThan(description!.y+description!.height)
 expect(edit!.x+edit!.width).toBeGreaterThan(row!.x+row!.width-50)
 await page.screenshot({path:'logs/research-list-layout-editor.png',fullPage:true})
 await card.getByRole('button',{name:'Explore research'}).click()
 const intro=page.locator('.sonata-research-heading > p')
 const heading=page.locator('.sonata-research-heading')
 expect((await intro.boundingBox())!.width/(await heading.boundingBox())!.width).toBeGreaterThan(.9)
 await page.screenshot({path:'logs/research-detail-layout.png',fullPage:true})
})
