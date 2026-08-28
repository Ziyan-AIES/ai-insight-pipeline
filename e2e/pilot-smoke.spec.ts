import { expect, test } from '@playwright/test'

test('demo dashboard supports the capture entry point', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Demo workspace/)).toBeVisible()
  await page.getByRole('button', { name: '+ Add News' }).click()
  await expect(page.getByRole('dialog', { name: 'Add News' })).toBeVisible()
  await page.getByLabel('URL').fill('https://example.com/news?utm_source=test')
  await page.getByRole('button', { name: 'Add to workspace' }).click()
  await expect(page.getByRole('heading', { name: 'example.com' })).toBeVisible()
})

test('intelligence synthesis embeds action threads beside candidates', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Intelligence Synthesis' }).click()
  await expect(page.getByRole('region', { name: 'Discussion Candidates' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Action Threads' })).toBeVisible()
  await page.getByRole('button', { name: '+ New' }).click()
  await expect(page.getByRole('dialog', { name: 'New Action Thread' })).toBeVisible()
})
