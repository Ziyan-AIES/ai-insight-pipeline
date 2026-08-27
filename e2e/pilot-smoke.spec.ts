import { expect, test } from '@playwright/test'

test('demo dashboard supports the capture entry point', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Demo workspace/)).toBeVisible()
  await page.getByRole('button', { name: '+ Add link' }).click()
  await expect(page.getByRole('dialog', { name: 'Add link' })).toBeVisible()
  await page.getByLabel('URL').fill('https://example.com/news?utm_source=test')
  await page.getByRole('button', { name: 'Add to workspace' }).click()
  await expect(page.getByRole('heading', { name: 'example.com' })).toHaveCount(2)
})

test('weekly discussion embeds topics beside shared notes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Weekly Discussion' }).click()
  await expect(page.getByRole('region', { name: 'Discussion notes' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Topic dashboard' })).toBeVisible()
  await page.getByRole('button', { name: '+ Add Note' }).click()
  await expect(page.getByRole('dialog', { name: 'Add Note' })).toBeVisible()
})
