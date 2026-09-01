import { existsSync, mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const artifactDir = existsSync('/opt/cursor/artifacts')
  ? '/opt/cursor/artifacts'
  : 'test-results'

mkdirSync(artifactDir, { recursive: true })

test('shows expanded Live Signal previews and a scrollable Trend editor', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Live Signals' }).click()

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
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(110)
  }

  for (let index = 0; index < 6; index += 1) {
    const panel = panels.nth(index)
    const panelBox = await panel.boundingBox()
    const cardCount = await panel.locator('article.live-card').count()
    expect(cardCount).toBeLessThanOrEqual(3)
    if (cardCount === 0) continue
    const firstCardBox = await panel
      .locator('article.live-card')
      .first()
      .boundingBox()
    expect(firstCardBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
      (panelBox?.y ?? 0) + (panelBox?.height ?? 0),
    )
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

  await page.getByRole('button', { name: 'Synthesis' }).click()
  await expect(page.locator('article.trend-card').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expand Evidence' })).toBeVisible()

  await page.setViewportSize({ width: 900, height: 620 })
  await page.getByRole('button', { name: '+ New Trend' }).click()
  const trendDialog = page.getByRole('dialog', { name: 'Create Trend' })
  await expect(trendDialog).toBeVisible()
  await expect(trendDialog.locator('.modal-body')).toHaveCSS('overflow-y', 'auto')
  await expect(trendDialog.getByRole('button', { name: 'Create Trend' })).toBeVisible()
  const dialogBox = await trendDialog.boundingBox()
  expect((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)).toBeLessThanOrEqual(620)

  await page.screenshot({
    path: `${artifactDir}/briefing_scrollable_trend_editor.png`,
    fullPage: false,
  })
})

test('keeps the top navigation and three-column workflow usable in narrow windows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 760 })
  await page.goto('/')
  const desktopHeader = await page.locator('.top-navigation').boundingBox()
  const desktopWorkspaceNav = await page.locator('.workspace-nav').boundingBox()
  expect(
    Math.abs(
      ((desktopWorkspaceNav?.x ?? 0) + (desktopWorkspaceNav?.width ?? 0) / 2) -
        ((desktopHeader?.x ?? 0) + (desktopHeader?.width ?? 0) / 2),
    ),
  ).toBeLessThan(3)

  await page.setViewportSize({ width: 900, height: 760 })

  const mediumNavigation = await page.locator('.top-navigation').boundingBox()
  const mediumMain = await page.locator('.workspace-main').boundingBox()
  const briefingHeading = await page
    .getByRole('heading', { name: 'Trends' })
    .boundingBox()
  expect(mediumNavigation?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(90)
  expect(mediumMain?.y ?? 0).toBeGreaterThanOrEqual(
    (mediumNavigation?.y ?? 0) + (mediumNavigation?.height ?? 0) - 1,
  )
  expect(briefingHeading?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(240)
  const workspaceNavBox = await page.locator('.workspace-nav').boundingBox()
  const searchBox = await page.locator('.top-search-shell').boundingBox()
  const addNewsBox = await page.locator('.top-add-news').boundingBox()
  const profileBox = await page.locator('.profile-shell').boundingBox()
  expect(workspaceNavBox?.width ?? 0).toBeGreaterThan(searchBox?.width ?? 0)
  expect(searchBox?.x ?? 0).toBeGreaterThan(workspaceNavBox?.x ?? 0)
  expect(addNewsBox?.x ?? 0).toBeGreaterThan(searchBox?.x ?? 0)
  expect(profileBox?.x ?? 0).toBeGreaterThan(addNewsBox?.x ?? 0)

  await page.getByRole('button', { name: 'Collapse Action Threads' }).click()
  await expect(page.getByRole('button', { name: 'Expand Action Threads' })).toBeVisible()
  await expect(page.locator('.synthesis-workbench')).toHaveClass(/threads-collapsed/)
  await page.getByRole('button', { name: 'Expand Action Threads' }).click()

  await page.getByRole('button', { name: 'Expand Evidence' }).click()
  const columns = page.locator('.synthesis-workbench > .workflow-column')
  await expect(columns).toHaveCount(3)
  const columnRects = await columns.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { width: rect.width, x: rect.x }
    }),
  )
  expect(Math.max(...columnRects.map((rect) => rect.width)) - Math.min(...columnRects.map((rect) => rect.width))).toBeLessThan(3)
  expect(columnRects[1].x).toBeGreaterThan(columnRects[0].x)
  expect(columnRects[2].x).toBeGreaterThan(columnRects[1].x)
  const destinationButtons = page
    .getByRole('region', { name: 'Action Threads' })
    .locator('.topic-scope-toggle button')
  const destinationRects = await destinationButtons.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().y),
  )
  expect(Math.max(...destinationRects) - Math.min(...destinationRects)).toBeLessThan(3)

  await page
    .getByRole('button', { name: 'Open Action Threads dashboard' })
    .click()
  await expect(page.getByRole('heading', { name: 'Action Threads' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'By month' })).toBeVisible()

  await page.setViewportSize({ width: 1440, height: 760 })
  const timelineColumns = page.locator(
    '.timeline-scheduled-column, .timeline-unscheduled-column',
  )
  await expect(timelineColumns).toHaveCount(2)
  await expect(timelineColumns.nth(0)).toHaveCSS('overflow-y', 'auto')
  await expect(timelineColumns.nth(1)).toHaveCSS('overflow-y', 'auto')
  const timelineRects = await timelineColumns.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().x),
  )
  expect(timelineRects[1]).toBeGreaterThan(timelineRects[0])

  await page.setViewportSize({ width: 540, height: 760 })
  const mobileNavigation = await page.locator('.top-navigation').boundingBox()
  const mobileMain = await page.locator('.workspace-main').boundingBox()
  const threadHeading = await page
    .getByRole('heading', { name: 'Action Threads' })
    .boundingBox()
  expect(mobileNavigation?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(150)
  expect(mobileMain?.y ?? 0).toBeGreaterThanOrEqual(
    (mobileNavigation?.y ?? 0) + (mobileNavigation?.height ?? 0) - 1,
  )
  expect(threadHeading?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(230)
})
