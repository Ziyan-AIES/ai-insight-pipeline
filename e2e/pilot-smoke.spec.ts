import { expect, test } from '@playwright/test'

test('demo dashboard supports the capture entry point', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Demo workspace/)).toBeVisible()
  await page.getByRole('button', { name: '+ Add News' }).click()
  await expect(page.getByRole('dialog', { name: 'Add News' })).toBeVisible()
  await page.getByLabel('URL').fill('https://example.com/news?utm_source=test')
  await page.getByRole('button', { name: 'Add to workspace' }).click()
  await expect(page.getByRole('link', { name: 'example.com' })).toBeVisible()
})

test('intelligence briefing embeds action threads beside emerging trends', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Intelligence Briefing' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Emerging Trends' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Action Threads' })).toBeVisible()
  await page.getByRole('button', { name: '+ New', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'New Action Thread' })).toBeVisible()
})
