import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App, { NewsWhyItMatters } from './App'

function selectJuly2026() {
  fireEvent.click(screen.getByRole('button', { name: /▾/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Jul 2026:/ }))
}

function openLiveSignals() {
  fireEvent.click(screen.getByRole('button', { name: 'Live Signals' }))
}

function openBriefing() {
  fireEvent.click(screen.getByRole('button', { name: 'Synthesis' }))
}

describe('dashboard pilot shell', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.sessionStorage.clear()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('defaults a first-time user to the three-column Synthesis workspace', () => {
    render(<App />)
    expect(screen.getByText('Demo')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Trends' })).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Action Threads' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trends' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand Evidence' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open dashboard home' }),
    ).toHaveAttribute('href', '/?workspace=synthesis')
    const navigation = screen.getByRole('navigation', { name: 'Workspace' })
    expect(within(navigation).getAllByRole('button')).toHaveLength(2)
    expect(within(navigation).getByRole('button', { name: 'Live Signals' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Synthesis' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Time range' })).toBeNull()
  })

  it('uses a closable keyword search and opens profile actions without signing out', () => {
    render(<App />)
    const search = screen.getByPlaceholderText('Keywords')
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: 'Granola' } })
    expect(screen.getByRole('dialog', { name: 'Search results' })).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'Search results' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }))
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('filters Evidence to unassigned signals and scopes Show evidence to one Trend', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand Evidence' })[0])
    const evidence = screen.getByRole('region', { name: 'Evidence' })
    fireEvent.click(within(evidence).getByRole('button', { name: 'Unassigned' }))
    expect(
      within(evidence).getByRole('link', {
        name: /Earnings calls treat AI attach rate/,
      }),
    ).toBeInTheDocument()
    expect(
      within(evidence).queryByRole('link', {
        name: /Granola brings ambient meeting memory/,
      }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Evidence' }))
    const trend = screen
      .getByRole('button', { name: 'Wearables are becoming ambient control layers' })
      .closest('article')
    fireEvent.click(within(trend as HTMLElement).getByRole('button', { name: 'Show evidence' }))
    const scoped = screen.getByRole('region', { name: 'Evidence' })
    expect(
      within(scoped).getByRole('link', {
        name: /Granola brings ambient meeting memory/,
      }),
    ).toBeInTheDocument()
    expect(
      within(scoped).queryByRole('link', {
        name: /Earnings calls treat AI attach rate/,
      }),
    ).toBeNull()
  })

  it('archives a Trend with its Evidence and keeps both recoverable', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Wearables are becoming ambient control layers' }),
    )
    const editor = screen.getByRole('dialog', { name: 'Edit Trend' })
    fireEvent.click(within(editor).getByRole('button', { name: 'Archive Trend' }))
    await waitFor(() =>
      expect(screen.getByText('Archived Trends · 1')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand Evidence' })[0])
    expect(screen.getByText('Archived · 1')).toBeInTheDocument()
  })

  it('drags a Trend into a new Action Thread with inherited framing and Evidence', () => {
    render(<App />)
    const trend = screen
      .getByRole('button', { name: 'Wearables are becoming ambient control layers' })
      .closest('article')
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: () => undefined,
      getData: () => '',
    }
    fireEvent.dragStart(trend as HTMLElement, { dataTransfer })
    fireEvent.drop(screen.getByText('Drop here to create an Action Thread'), {
      dataTransfer,
    })
    const editor = screen.getByRole('dialog', { name: 'New Action Thread' })
    expect(within(editor).getByDisplayValue('Wearables are becoming ambient control layers')).toBeInTheDocument()
    expect(
      (within(editor).getByLabelText('Team decision') as HTMLTextAreaElement).value,
    ).toContain("• What's changed:")
    expect(
      within(editor).getByRole('link', {
        name: /Granola brings ambient meeting memory/,
      }),
    ).toBeInTheDocument()
  })

  it('drags an Action Thread back into an editable Trend and removes thread-only fields', async () => {
    render(<App />)
    const thread = screen
      .getByRole('heading', { name: 'Harness engineering' })
      .closest('article')
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: () => undefined,
      getData: () => '',
    }
    fireEvent.dragStart(thread as HTMLElement, { dataTransfer })
    fireEvent.drop(screen.getByText('Drop here to create a Trend'), {
      dataTransfer,
    })
    const editor = screen.getByRole('dialog', { name: 'Edit Trend' })
    expect(within(editor).getByDisplayValue('Harness engineering')).toBeInTheDocument()
    expect(within(editor).queryByLabelText('Owner')).toBeNull()
    expect(
      within(editor).getByRole('link', {
        name: /DataFlow-Harness turns agent reliability/,
      }),
    ).toBeInTheDocument()
    fireEvent.click(within(editor).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Harness engineering' })).toBeNull(),
    )
    expect(
      screen.getByRole('button', { name: 'Harness engineering' }),
    ).toBeInTheDocument()
  })

  it('adds a no-evidence Trend to the Trend meeting explicitly', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ New Trend' }))
    const createEditor = screen.getByRole('dialog', { name: 'Create Trend' })
    fireEvent.change(within(createEditor).getByPlaceholderText(/Name the emerging change/), {
      target: { value: 'New interaction pattern' },
    })
    fireEvent.click(within(createEditor).getByRole('button', { name: 'Create Trend' }))
    fireEvent.click(await screen.findByRole('button', { name: 'New interaction pattern' }))
    const editEditor = screen.getByRole('dialog', { name: 'Edit Trend' })
    fireEvent.click(within(editEditor).getByRole('button', { name: 'Add to meeting' }))
    expect(await within(editEditor).findByText('Included in Trend meeting')).toBeInTheDocument()
    expect(within(editEditor).getByRole('button', { name: 'Remove from meeting' })).toBeInTheDocument()
  })

  it('drags a linked Thread signal into an existing Trend', async () => {
    render(<App />)
    const thread = screen
      .getByRole('heading', { name: 'Harness engineering' })
      .closest('article')
    const linkedSignal = within(thread as HTMLElement)
      .getByRole('link', { name: /DataFlow-Harness turns agent reliability/ })
      .closest('.linked-signal-row')
    expect(
      within(linkedSignal as HTMLElement).getByRole('link', {
        name: /DataFlow-Harness turns agent reliability/,
      }),
    ).toHaveAttribute('draggable', 'false')
    const trend = screen
      .getByRole('button', { name: 'Wearables are becoming ambient control layers' })
      .closest('article')
    const dataTransfer = {
      effectAllowed: 'copyMove',
      dropEffect: 'copy',
      setData: () => undefined,
      getData: () => '',
    }
    fireEvent.dragStart(linkedSignal as HTMLElement, { dataTransfer })
    fireEvent.drop(trend as HTMLElement, { dataTransfer })
    expect(
      await within(trend as HTMLElement).findByRole('link', {
        name: /DataFlow-Harness turns agent reliability/,
      }),
    ).toBeInTheDocument()
  })

  it('folds closed Action Threads below active work in the recent view', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('heading', { name: 'Generative UI as software' }))
    const editor = screen.getByRole('dialog', { name: 'Edit Action Thread' })
    fireEvent.change(within(editor).getByLabelText('Status'), {
      target: { value: 'closed' },
    })
    fireEvent.click(within(editor).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Edit Action Thread' })).toBeNull(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open Action Threads dashboard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Most recent' }))
    const activeTitles = Array.from(
      document.querySelectorAll('.topic-list.kind-pipeline > .topic-card h3'),
    ).map((element) => element.textContent)
    expect(activeTitles).not.toContain('Generative UI as software')
    const closed = screen.getByText('Closed · 1').closest('details')
    expect(closed).not.toHaveAttribute('open')
    fireEvent.click(within(closed as HTMLElement).getByText('Closed · 1'))
    expect(closed).toHaveAttribute('open')
    expect(
      within(closed as HTMLElement).getByRole('heading', {
        name: 'Generative UI as software',
      }),
    ).toBeInTheDocument()
  })

  it('collapses Action Threads so Trends owns the remaining workspace', () => {
    render(<App />)
    expect(screen.getByRole('region', { name: 'Action Threads' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Action Threads' }))
    expect(screen.queryByRole('region', { name: 'Action Threads' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Trends' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand Action Threads' }))
    expect(screen.getByRole('region', { name: 'Action Threads' })).toBeInTheDocument()
  })

  it('reorders active Trend cards by dragging one card onto another', async () => {
    render(<App />)
    for (const title of ['Trend Alpha', 'Trend Beta']) {
      fireEvent.click(screen.getByRole('button', { name: '+ New Trend' }))
      const editor = screen.getByRole('dialog', { name: 'Create Trend' })
      fireEvent.change(within(editor).getByPlaceholderText(/Name the emerging change/), {
        target: { value: title },
      })
      fireEvent.click(within(editor).getByRole('button', { name: 'Create Trend' }))
      await screen.findByRole('button', { name: title })
    }

    const alpha = screen.getByRole('button', { name: 'Trend Alpha' }).closest('article')
    const beta = screen.getByRole('button', { name: 'Trend Beta' }).closest('article')
    const transfer = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      types: ['application/x-trend-id'],
      setData: (type: string, value: string) => transfer.set(type, value),
      getData: (type: string) => transfer.get(type) || '',
    }
    fireEvent.dragStart(alpha as HTMLElement, { dataTransfer })
    fireEvent.dragOver(beta as HTMLElement, { dataTransfer })
    fireEvent.drop(beta as HTMLElement, { dataTransfer })

    await waitFor(() => {
      const titles = Array.from(
        document.querySelectorAll('.trend-grid > .trend-card .trend-title-button'),
      ).map((element) => element.textContent)
      expect(titles.indexOf('Trend Alpha')).toBeLessThan(titles.indexOf('Trend Beta'))
    })
    expect(
      window.localStorage.getItem('signal-intelligence:trend-card-order:demo'),
    ).toBeNull()
  })

  it('restores the last workspace separately for this viewer', async () => {
    window.localStorage.setItem('signal-intelligence:workspace-page:demo', 'signals')
    render(<App />)
    expect(await screen.findByRole('region', { name: 'Live Signals' })).toBeInTheDocument()
  })

  it('shows up to three Live Signals per category with a stationary View all footer', () => {
    render(<App />)
    openLiveSignals()
    const live = screen.getByRole('region', { name: 'Live Signals' })
    const panel = within(live).getByText('Entry & Interaction').closest('section')
    expect(panel).toBeTruthy()
    const scroll = panel!.querySelector('.signal-scroll')
    expect(scroll).toBeTruthy()
    expect(scroll!.querySelectorAll('article.live-card').length).toBeLessThanOrEqual(3)
    expect(scroll!.querySelector('.view-all-link')).toBeNull()
    expect(
      within(panel as HTMLElement).getByRole('button', { name: /View all/ }),
    ).not.toBe(scroll)
  })

  it('shows evidence-backed Trend cards beside a collapsed Evidence rail', () => {
    render(<App />)
    const pane = screen.getByRole('region', { name: 'Trends' })
    expect(pane.querySelectorAll('article.trend-card').length).toBeGreaterThan(0)
    expect(within(pane).getByText('Initial read')).toBeInTheDocument()
    expect(within(pane).getByText('Question')).toBeInTheDocument()
    expect(
      within(pane).getByRole('link', {
        name: /Granola brings ambient meeting memory to Apple Watch/,
      }),
    ).toHaveAttribute('href', 'https://example.com/granola-watch')
    expect(within(pane).queryByText('AI')).toBeNull()
  })

  it('opens a category drawer from View all', () => {
    render(<App />)
    openLiveSignals()
    const live = screen.getByRole('region', { name: 'Live Signals' })
    const panel = within(live).getByText('Entry & Interaction').closest('section')
    expect(panel).toBeTruthy()
    fireEvent.click(within(panel as HTMLElement).getByRole('button', { name: /View all/ }))
    expect(
      screen.getByRole('dialog', { name: 'Entry & Interaction' }),
    ).toBeInTheDocument()
  })

  it('keeps Action Threads beside Trends with aligned workflow controls', () => {
    render(<App />)
    expect(screen.getByRole('region', { name: 'Trends' })).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Action Threads' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ New Action Thread' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Harness engineering' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Show evidence' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Drop here to create a Trend')).toBeInTheDocument()
    expect(screen.getByText('Drop here to create an Action Thread')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Time range' })).toBeNull()
  })

  it('lets Month open a calendar picker and filters by that month', () => {
    render(<App />)
    openLiveSignals()
    fireEvent.click(screen.getByRole('button', { name: /▾/ }))
    expect(screen.getByRole('dialog', { name: 'Select month' })).toBeInTheDocument()
    const july = screen.getByRole('button', { name: /^Jul 2026:/ })
    expect(july.className).toMatch(/month-heat-[1-4]/)
    fireEvent.click(july)
    expect(screen.getByRole('button', { name: /^Jul / })).toBeInTheDocument()
  })

  it('lets All show historical signals in the page and View all drawer', () => {
    render(<App />)
    openLiveSignals()
    selectJuly2026()
    expect(
      screen.queryByRole('link', { name: /Browser agents turn the address bar/ }),
    ).toBeNull()

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Time range' })).getByRole('button', {
        name: 'All',
      }),
    )
    const live = screen.getByRole('region', { name: 'Live Signals' })
    const panel = within(live)
      .getByText('Entry & Interaction')
      .closest('section')
    expect(panel).toBeTruthy()
    fireEvent.click(
      within(panel as HTMLElement).getByRole('button', { name: /View all/ }),
    )

    expect(
      within(
        screen.getByRole('dialog', { name: 'Entry & Interaction' }),
      ).getByRole('link', {
        name: /Browser agents turn the address bar/,
      }),
    ).toBeInTheDocument()
  })

  it('marks signals added since this viewer last opened Live Signals', () => {
    window.localStorage.setItem(
      'signal-intelligence:last-viewed:live-signals:demo',
      '2026-01-01T00:00:00.000Z',
    )
    render(<App />)
    openLiveSignals()
    const live = screen.getByRole('region', { name: 'Live Signals' })
    expect(within(live).getAllByText('New').length).toBeGreaterThan(0)
  })

  it('reassigns a Live Signal category by dragging between modules', () => {
    render(<App />)
    openLiveSignals()
    selectJuly2026()
    const heading = screen.getByRole('link', {
      name: /Granola brings ambient meeting memory/,
    })
    const card = heading.closest('article')
    const target = screen.getByText('AI Experiences').closest('section')
    expect(card).toBeTruthy()
    expect(target).toBeTruthy()
    fireEvent.dragStart(card!)
    fireEvent.drop(target!)
    expect(
      within(target as HTMLElement).getByRole('link', {
        name: /Granola brings ambient meeting memory/,
      }),
    ).toBeInTheDocument()
  })

  it('removes drag chrome from the full Action Threads dashboard', () => {
    render(<App />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Open Action Threads dashboard' }),
    )
    expect(screen.queryByText(/Drop a signal/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Add signal/i })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Time range' })).toBeNull()
    expect(screen.getByRole('button', { name: '← Synthesis' })).toBeInTheDocument()
  })

  it('defaults full Action Threads to a clear month and backlog board', () => {
    render(<App />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Open Action Threads dashboard' }),
    )

    const status = screen.getByRole('group', { name: 'Status' })
    expect(
      within(status).getByRole('button', { name: 'All' }),
    ).toBeInTheDocument()
    expect(
      within(status).getByRole('button', { name: 'Open' }),
    ).toBeInTheDocument()
    expect(
      within(status).getByRole('button', { name: 'In Progress' }),
    ).toBeInTheDocument()
    expect(
      within(status).getByRole('button', { name: 'Parked' }),
    ).toBeInTheDocument()
    expect(
      within(status).getByRole('button', { name: 'Closed' }),
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText('Action Threads grouped by work month'),
    ).toBeInTheDocument()
    expect(screen.getByText('Work by month')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Unscheduled' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Oct 2026' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Timeline ·/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'By category' }))
    expect(
      screen.getByLabelText('Action Threads grouped by category'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Most recent' }))
    expect(
      screen.queryByLabelText('Action Threads grouped by category'),
    ).toBeNull()
  })

  it('moves an Action Thread to another category by drag and drop', async () => {
    render(<App />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Open Action Threads dashboard' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'By category' }))

    const card = screen.getByText('Harness engineering').closest('article')
    const target = screen
      .getByRole('heading', { name: 'Entry & Interaction' })
      .closest('section')
    expect(card).toBeTruthy()
    expect(target).toBeTruthy()
    fireEvent.dragStart(card!)
    fireEvent.drop(target!)
    expect(
      await within(target as HTMLElement).findByText('Harness engineering'),
    ).toBeInTheDocument()
  })

  it('moves Action Threads between a month and the Unscheduled backlog', async () => {
    render(<App />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Open Action Threads dashboard' }),
    )

    const unscheduledCard = screen
      .getByText('On-device agent privacy tradeoffs')
      .closest('article')
    const october = screen.getByRole('heading', { name: 'Oct 2026' }).closest('section')
    expect(unscheduledCard).toBeTruthy()
    expect(october).toBeTruthy()
    fireEvent.dragStart(unscheduledCard!)
    fireEvent.drop(october!)
    expect(
      await within(october as HTMLElement).findByText(
        'On-device agent privacy tradeoffs',
      ),
    ).toBeInTheDocument()

    const scheduledCard = screen.getByText('Harness engineering').closest('article')
    const backlog = screen.getByRole('heading', { name: 'Unscheduled' }).closest('section')
    expect(scheduledCard).toBeTruthy()
    expect(backlog).toBeTruthy()
    fireEvent.dragStart(scheduledCard!)
    fireEvent.drop(backlog!)
    expect(
      await within(backlog as HTMLElement).findByText('Harness engineering'),
    ).toBeInTheDocument()
  })

  it('redesigns the Action Thread editor into three sections', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('heading', { name: 'Harness engineering' }))
    expect(
      screen.getByRole('dialog', { name: 'Edit Action Thread' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Thread basics')).toBeInTheDocument()
    expect(screen.getByText('Linked signals')).toBeInTheDocument()
    expect(screen.getByText('Intelligence framing')).toBeInTheDocument()
    expect(screen.getByLabelText('Work month')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'closed' },
    })
    expect(screen.getByLabelText('Completed month')).toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'Category' })).getByRole('button', {
        name: 'AI Capability & Tech',
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Category' })).getByRole('button', {
        name: 'Entry & Interaction',
      }),
    )
    expect(
      within(screen.getByRole('group', { name: 'Category' })).getByRole('button', {
        name: 'Entry & Interaction',
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByLabelText('Description')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('opens a team thought popover bound to a signal', () => {
    render(<App />)
    openLiveSignals()
    fireEvent.click(screen.getAllByRole('button', { name: /Add thought/ })[0])
    expect(screen.getByRole('dialog', { name: 'Add a thought' })).toBeInTheDocument()
  })

  it('adds a thought to the discussion queue automatically', async () => {
    render(<App />)
    openLiveSignals()
    const heading = screen.getByRole('link', {
      name: /Meta quietly launches vibe-coded gaming app Pocket/,
    })
    const card = heading.closest('article')
    expect(card).toBeTruthy()
    expect(within(card as HTMLElement).getByRole('button', { name: '↑ 0 Recommend' })).toBeInTheDocument()
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Add thought' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Thought' }), {
      target: { value: 'Discuss the product implications with the team.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => {
      expect(within(card as HTMLElement).getByRole('button', { name: '↑ 0 Recommend' })).toBeInTheDocument()
      expect(within(card as HTMLElement).getByText('1 team thought')).toBeInTheDocument()
    })
  })

  it('keeps Trend meeting tied to the Trend review state', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Start trend meeting/ }))
    const meeting = screen.getByRole('dialog', { name: 'Trend review' })
    expect(within(meeting).queryByText(/Already in/)).toBeNull()
    expect(within(meeting).getByRole('button', { name: 'Create Action Thread' })).toBeInTheDocument()
    expect(within(meeting).getByRole('link', {
      name: /Granola brings ambient meeting memory/,
    })).toHaveAttribute('href', 'https://example.com/granola-watch')
    fireEvent.click(within(meeting).getByRole('button', { name: 'Keep watching' }))
    await waitFor(() =>
      expect(screen.getByText('Trend discussion complete')).toBeInTheDocument(),
    )
  })

  it('keeps every signal visible in the expandable Evidence column', () => {
    render(<App />)
    openLiveSignals()
    const live = screen.getByRole('region', { name: 'Live Signals' })
    expect(within(live).queryByRole('group', { name: 'Discussion state' })).toBeNull()
    expect(within(live).queryByText('Awaiting review')).toBeNull()
    expect(within(live).queryByText('Reviewed')).toBeNull()

    openBriefing()
    fireEvent.click(screen.getByRole('button', { name: 'Expand Evidence' }))
    const evidence = screen.getByRole('region', { name: 'Evidence' })
    expect(within(evidence).getByText('Earnings calls treat AI attach rate as a core KPI')).toBeInTheDocument()
    expect(within(evidence).getAllByText(/Trend ·/).length).toBeGreaterThan(0)
    expect(within(evidence).getAllByText(/Thread ·/).length).toBeGreaterThan(0)
  })

  it('drags Evidence directly into an existing Action Thread without removing it', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand Evidence' }))
    const evidence = screen.getByRole('region', { name: 'Evidence' })
    const signal = within(evidence).getByText(
      'Earnings calls treat AI attach rate as a core KPI',
    )
    const thread = screen.getByRole('heading', { name: 'Harness engineering' }).closest('article')
    expect(thread).toBeTruthy()
    const dataTransfer = {
      effectAllowed: 'copy',
      dropEffect: 'copy',
      setData: () => undefined,
      getData: () => '',
    }
    fireEvent.dragStart(signal.closest('article') as HTMLElement, { dataTransfer })
    fireEvent.drop(thread as HTMLElement, { dataTransfer })
    expect(await within(thread as HTMLElement).findByText(
      'Earnings calls treat AI attach rate as a core KPI',
    )).toBeInTheDocument()
    expect(within(evidence).getByText('Earnings calls treat AI attach rate as a core KPI')).toBeInTheDocument()
  })

  it('uses plain linked article titles without decorative arrows', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand Evidence' }))
    const article = within(screen.getByRole('region', { name: 'Evidence' })).getByRole('link', {
      name: 'Browser agents turn the address bar into an invocation layer',
    })
    expect(article).toHaveTextContent(
      'Browser agents turn the address bar into an invocation layer',
    )
    expect(article).not.toHaveTextContent('↗')
  })

  it('exposes a link capture action', () => {
    render(<App />)
    expect(
      screen.getByRole('button', { name: '+ Add News' }),
    ).toBeInTheDocument()
  })

  it('lets an editor set the article publication date separately', async () => {
    render(<App />)
    openLiveSignals()
    selectJuly2026()
    const live = screen.getByRole('region', { name: 'Live Signals' })
    const heading = within(live).getByRole('link', {
      name: /Granola brings ambient meeting memory/,
    })
    const card = heading.closest('article')
    expect(card).toBeTruthy()
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: 'Signal actions' }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit signal' }))

    const publicationDate = screen.getByLabelText(/Publication date/)
    fireEvent.change(publicationDate, { target: { value: '2026-07-01' } })
    expect(publicationDate).toHaveValue('2026-07-01')
  })

  it('restores an unfinished Add News draft after a remount', () => {
    const firstRender = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add News' }))
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/unfinished' },
    })
    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: 'Unfinished signal' },
    })
    firstRender.unmount()

    render(<App />)

    expect(screen.getByRole('dialog', { name: 'Add News' })).toBeInTheDocument()
    expect(screen.getByLabelText('URL')).toHaveValue(
      'https://example.com/unfinished',
    )
    expect(screen.getByLabelText(/Title/)).toHaveValue('Unfinished signal')
  })

  it('clears the Add News draft when the user cancels it', () => {
    const firstRender = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add News' }))
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/cancelled' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    firstRender.unmount()

    render(<App />)
    expect(screen.queryByRole('dialog', { name: 'Add News' })).toBeNull()
  })

  it('shows one merged Qira implication', () => {
    render(
      <NewsWhyItMatters
        metadata={{
          implications: [
            'This could change Qira integration priorities; watch for a permission-aware API.',
            'This second implication should not be shown.',
          ],
        }}
      />,
    )

    expect(screen.getByText('Why it matters for Qira')).toBeInTheDocument()
    expect(screen.queryByText(/second implication/)).toBeNull()
  })
})
