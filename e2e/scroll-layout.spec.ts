import { existsSync, mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const artifactDir = existsSync('/opt/cursor/artifacts')
  ? '/opt/cursor/artifacts'
  : 'test-results'

mkdirSync(artifactDir, { recursive: true })

test('does not compress Live Signal or Discussion Candidate cards', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const panels = page.locator('.category-panel')
  await expect(panels).toHaveCount(6)
  const gridBox = await page.locator('.signals-grid').boundingBox()
  expect(gridBox?.height ?? 0).toBeGreaterThanOrEqual(500)
  const heights = await panels.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
  )
  expect(new Set(heights).size).toBe(1)
  expect(heights[0]).toBeGreaterThanOrEqual(250)

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
  }

  const signalScroll = page.locator('.category-panel .signal-scroll').first()
  await expect(signalScroll).toHaveCSS('overflow-y', /auto|scroll/)

  await page.screenshot({
    path: `${artifactDir}/live_signals_equal_category_modules.png`,
    fullPage: false,
  })

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
