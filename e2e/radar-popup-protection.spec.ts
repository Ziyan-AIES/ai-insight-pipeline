import { expect, test } from '@playwright/test'
  test.use({launchOptions:{ignoreDefaultArgs:['--disable-popup-blocking']}})
  test('retains blocked articles and retries only remaining URLs when window.open returns null',async({context,page})=>{
    await page.addInitScript(()=>{
      const open=window.open.bind(window)
      let permitted=true
      window.open=(...args)=>{
        if(!permitted)return null
        permitted=false
        setTimeout(()=>{permitted=true},0)
        return open(...args)
      }
    })
    await context.route(/^https:\/\//,route=>route.fulfill({contentType:'text/html',body:'<title>Evidence</title>'}))
    await page.goto('/')
    await page.getByRole('button',{name:'Signal Reference',exact:true}).click()
    const selected=await page.locator('.radar-evidence-item input:checked').count()
    expect(selected).toBeGreaterThan(1)
    await page.getByRole('button',{name:/Open selected/}).click()
    await expect(page.locator('.radar-open-fallback-links a')).toHaveCount(selected-1)
    expect(context.pages()).toHaveLength(2)
    await page.getByRole('button',{name:/Retry remaining/}).click()
    await expect(page.locator('.radar-open-fallback-links a')).toHaveCount(selected-2)
    expect(context.pages()).toHaveLength(3)
  })
