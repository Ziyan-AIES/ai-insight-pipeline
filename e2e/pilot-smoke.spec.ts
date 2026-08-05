import { expect, test } from '@playwright/test'

test('demo dashboard supports the capture entry point', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Demo workspace/)).toBeVisible()
  await page.getByRole('button', { name: '+ Add link' }).click()
  await expect(page.getByRole('dialog', { name: 'Add link' })).toBeVisible()
  await page.getByLabel('URL').fill('https://example.com/news?utm_source=test')
  await page.getByRole('button', { name: 'Add to workspace' }).click()
  await expect(page.getByRole('heading', { name: 'example.com' })).toBeVisible()
})
