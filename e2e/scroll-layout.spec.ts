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

test('keeps workspace content visible in non-maximized and mobile windows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 760 })
  await page.goto('/')

  const mediumSidebar = await page.locator('.qira-sidebar').boundingBox()
  const mediumMain = await page.locator('.workspace-main').boundingBox()
  const liveHeading = await page
    .getByRole('heading', { name: 'Live Signals' })
    .boundingBox()
  expect(mediumSidebar?.width ?? 0).toBeLessThanOrEqual(170)
  expect(mediumMain?.x ?? 0).toBeGreaterThanOrEqual(
    (mediumSidebar?.x ?? 0) + (mediumSidebar?.width ?? 0) - 1,
  )
  expect(liveHeading?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(150)

  await page.getByRole('button', { name: 'Intelligence Synthesis' }).click()
  await page
    .getByRole('button', { name: 'Open Action Threads dashboard' })
    .click()
  await expect(page.getByRole('heading', { name: 'Action Threads' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'By month' })).toBeVisible()

  await page.setViewportSize({ width: 540, height: 760 })
  const mobileSidebar = await page.locator('.qira-sidebar').boundingBox()
  const mobileMain = await page.locator('.workspace-main').boundingBox()
  const threadHeading = await page
    .getByRole('heading', { name: 'Action Threads' })
    .boundingBox()
  expect(mobileSidebar?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(110)
  expect(mobileMain?.y ?? 0).toBeGreaterThanOrEqual(
    (mobileSidebar?.y ?? 0) + (mobileSidebar?.height ?? 0) - 1,
  )
  expect(threadHeading?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(230)
})
