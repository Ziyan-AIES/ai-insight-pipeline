import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App, { NewsWhyItMatters } from './App'

function selectJuly2026() {
  fireEvent.click(screen.getByRole('button', { name: /▾/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Jul 2026:/ }))
}

function openLiveSignals() {
  fireEvent.click(screen.getByRole('button', { name: 'Live Signals' }))
}

function openBriefing() {
  fireEvent.click(screen.getByRole('button', { name: 'Intelligence Briefing' }))
}

describe('dashboard pilot shell', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('defaults a first-time user to the Intelligence Briefing', () => {
    render(<App />)
    expect(screen.getByText(/Demo workspace/)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Intelligence Briefing' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Action Threads' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Emerging Trends' })).toBeInTheDocument()
    expect(screen.getByText(/Evidence Inbox · \d+/)).toBeInTheDocument()
    expect(screen.getByText(/Qira Strategic/)).toBeInTheDocument()
    expect(screen.getByText(/Market Intelligence/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Time range' })).toBeInTheDocument()
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

  it('shows evidence-backed Trend cards instead of a news-first synthesis list', () => {
    render(<App />)
    const pane = screen.getByRole('region', { name: 'Intelligence Briefing' })
    expect(pane.querySelectorAll('article.trend-card').length).toBeGreaterThan(0)
    expect(within(pane).getByText('Initial read')).toBeInTheDocument()
    expect(within(pane).getByText('Question')).toBeInTheDocument()
    expect(
      within(pane).getByRole('link', {
        name: /Browser agents turn the address bar into an invocation layer/,
      }),
    ).toHaveAttribute('href', 'https://example.com/browser-agent-entry')
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

  it('keeps Action Threads beside the Intelligence Briefing', () => {
    render(<App />)
    selectJuly2026()
    expect(
      screen.getByRole('region', { name: 'Intelligence Briefing' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Action Threads' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ New' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Harness engineering' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Add signals' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Drop a Trend here to upgrade it/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Time range' })).toBeInTheDocument()
  })

  it('lets Month open a calendar picker and filters by that month', () => {
    render(<App />)
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
    expect(
      screen.queryByRole('link', { name: /DataFlow-Harness turns agent reliability/ }),
    ).toBeNull()

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Time range' })).getByRole('button', {
        name: 'All',
      }),
    )
    const live = screen.getByRole('region', { name: 'Live Signals' })
    const panel = within(live)
      .getByText('AI Capability & Tech')
      .closest('section')
    expect(panel).toBeTruthy()
    fireEvent.click(
      within(panel as HTMLElement).getByRole('button', { name: /View all/ }),
    )

    expect(
      within(
        screen.getByRole('dialog', { name: 'AI Capability & Tech' }),
      ).getByRole('link', {
        name: /DataFlow-Harness turns agent reliability/,
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
    expect(
      screen.getByRole('button', { name: '← Intelligence Briefing' }),
    ).toBeInTheDocument()
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

  it('recognizes an existing Action Thread during Trend meeting and resumes after editing it', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Start trend meeting/ }))
    const meeting = screen.getByRole('dialog', { name: 'Trend review' })
    expect(within(meeting).getByText(/Already in 1 Action Thread/)).toBeInTheDocument()
    expect(within(meeting).getByRole('button', { name: 'Open Action Thread' })).toBeInTheDocument()
    expect(within(meeting).queryByRole('button', { name: 'Create Action Thread' })).toBeNull()
    expect(within(meeting).getByRole('link', {
      name: /Browser agents turn the address bar into an invocation layer/,
    })).toHaveAttribute('href', 'https://example.com/browser-agent-entry')

    fireEvent.click(within(meeting).getByRole('button', { name: 'Open Action Thread' }))
    expect(screen.getByRole('dialog', { name: 'Edit Action Thread' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('dialog', { name: 'Trend review' })).toBeInTheDocument()
  })

  it('keeps editorial review state off Live Signals and exposes reviewed unassigned evidence in the Briefing', () => {
    render(<App />)
    openLiveSignals()
    const live = screen.getByRole('region', { name: 'Live Signals' })
    expect(within(live).queryByRole('group', { name: 'Discussion state' })).toBeNull()
    expect(within(live).queryByText('Awaiting review')).toBeNull()
    expect(within(live).queryByText('Reviewed')).toBeNull()

    openBriefing()
    expect(screen.getByLabelText('Evidence destination')).toBeInTheDocument()
    expect(screen.getByText('Earnings calls treat AI attach rate as a core KPI')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Keep watching' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'New Action Thread' }).length).toBeGreaterThan(0)
  })

  it('triages Inbox evidence directly into an existing Action Thread', async () => {
    render(<App />)
    const inbox = document.querySelector('.evidence-inbox-list') as HTMLElement
    const signal = within(inbox).getByText(
      'Earnings calls treat AI attach rate as a core KPI',
    )
    fireEvent.change(screen.getByLabelText('Evidence destination'), {
      target: { value: 'topic:topic-harness' },
    })
    fireEvent.click(
      within(signal.closest('article') as HTMLElement).getByRole('button', {
        name: /Add to Harness engineering/,
      }),
    )
    expect(
      await within(inbox).queryByText('Earnings calls treat AI attach rate as a core KPI'),
    ).toBeNull()
  })

  it('uses plain linked article titles without decorative arrows', () => {
    render(<App />)
    const article = screen.getByRole('link', {
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
