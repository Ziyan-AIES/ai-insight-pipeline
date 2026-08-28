import { existsSync, mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const artifactDir = existsSync('/opt/cursor/artifacts')
  ? '/opt/cursor/artifacts'
  : 'test-results'

mkdirSync(artifactDir, { recursive: true })

test('shows expanded Live Signal previews and scrollable Discussion Candidates', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  for (const [url, title] of [
    ['https://example.com/ecosystem-two', 'Partner marketplace adds agent reviews'],
    ['https://example.com/ecosystem-three', 'Agent runtimes align on audit exports'],
  ]) {
    await page.getByRole('button', { name: '+ Add News' }).click()
    await page.getByLabel('URL').fill(url)
    await page.getByLabel('Title optional').fill(title)
    await page.getByRole('button', { name: 'Add to workspace' }).click()
  }

  const panels = page.locator('.category-panel')
  await expect(panels).toHaveCount(6)
  const gridBox = await page.locator('.signals-grid').boundingBox()
  expect(gridBox?.height ?? 0).toBeGreaterThanOrEqual(500)
  const firstRow = await panels.nth(0).boundingBox()
  const secondRow = await panels.nth(3).boundingBox()
  expect(secondRow?.y ?? 0).toBeGreaterThan(firstRow?.y ?? 0)

  const liveCards = page.locator('.signals-grid article.live-card')
  const liveCount = await liveCards.count()
  expect(liveCount).toBeGreaterThan(0)
  for (let index = 0; index < liveCount; index += 1) {
    const box = await liveCards.nth(index).boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(160)
  }

  for (let index = 0; index < 6; index += 1) {
    const panel = panels.nth(index)
    const panelBox = await panel.boundingBox()
    const firstCardBox = await panel
      .locator('article.live-card')
      .first()
      .boundingBox()
    expect(firstCardBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
      (panelBox?.y ?? 0) + (panelBox?.height ?? 0),
    )
    expect(await panel.locator('article.live-card').count()).toBeLessThanOrEqual(3)
  }

  const ecosystem = page
    .getByRole('heading', { name: 'Ecosystem', exact: true })
    .locator('xpath=ancestor::section[1]')
  await expect(ecosystem.locator('article.live-card')).toHaveCount(3)

  const signalScroll = page.locator('.category-panel .signal-scroll').first()
  await expect(signalScroll).toHaveCSS('overflow-y', 'visible')

  await page.screenshot({
    path: `${artifactDir}/live_signals_expanded_previews.png`,
    fullPage: false,
  })

  await page.getByRole('button', { name: 'View all Ecosystem' }).click()
  const drawerCards = page.locator('.drawer-list article.live-card')
  await expect(drawerCards).toHaveCount(3)
  const drawerRects = await drawerCards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom }
    }),
  )
  for (let index = 1; index < drawerRects.length; index += 1) {
    expect(drawerRects[index].top).toBeGreaterThanOrEqual(
      drawerRects[index - 1].bottom,
    )
  }
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  await page.getByRole('button', { name: 'Intelligence Synthesis' }).click()
  const candidates = page.locator('article.candidate-card')
  await expect(candidates.first()).toBeVisible()
  const candidateCount = await candidates.count()
  expect(candidateCount).toBeGreaterThan(3)
  for (let index = 0; index < candidateCount; index += 1) {
    const box = await candidates.nth(index).boundingBox()
    const height = box?.height ?? 0
    expect(height).toBeGreaterThanOrEqual(160)
  }

  const list = page.locator('.discussion-list')
  await expect(list).toHaveCSS('overflow-y', /auto|scroll/)
  const scrollHeight = await list.evaluate((node) => node.scrollHeight)
  const clientHeight = await list.evaluate((node) => node.clientHeight)
  expect(scrollHeight).toBeGreaterThan(clientHeight)

  await page.screenshot({
    path: `${artifactDir}/synthesis_scrollable_candidate_cards.png`,
    fullPage: false,
  })
})
