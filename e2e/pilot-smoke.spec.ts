import { expect, test } from '@playwright/test'

test('demo dashboard supports the capture entry point', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Demo', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '+ Add News' }).click()
  await expect(page.getByRole('dialog', { name: 'Add News' })).toBeVisible()
  await page.getByLabel('URL').fill('https://example.com/news?utm_source=test')
  await page.getByRole('button', { name: 'Add to workspace' }).click()
  await page.getByRole('button', { name: 'Expand Evidence' }).click()
  await expect(page.getByRole('link', { name: 'example.com' })).toBeVisible()
})

test('Synthesis keeps Evidence, Trends, and Action Threads in one workflow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Expand Evidence' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Trends' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Action Threads' })).toBeVisible()
  await page.getByRole('button', { name: 'Expand Evidence' }).click()
  await expect(page.getByRole('region', { name: 'Evidence' })).toBeVisible()
  await expect(page.locator('.evidence-work-card')).toHaveCount(6)
  await page.getByRole('button', { name: '+ New Action Thread' }).click()
  await expect(page.getByRole('dialog', { name: 'New Action Thread' })).toBeVisible()
})
