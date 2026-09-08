import { expect, test } from '@playwright/test'

test('keeps every selected Radar source reachable without a batch-capable extension', async ({
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
  await page.getByRole('button', { name: 'Industry Radar' }).click()

  const radar = page.getByRole('region', { name: 'Industry Radar' })
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
  await expect(radar.getByText('Open remaining sources')).toBeVisible()
  const fallbackLinks = radar.locator('.radar-open-fallback-links a')
  await expect(fallbackLinks).toHaveCount(selectedUrls.length - 1)
  await expect(fallbackLinks.first()).toHaveAttribute('href', selectedUrls[1])
})
