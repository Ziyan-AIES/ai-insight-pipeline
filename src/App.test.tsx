import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App, { NewsWhyItMatters } from './App'

describe('dashboard pilot shell', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('defaults to Live Signals with a 2x3 category layout', () => {
    render(<App />)
    expect(screen.getByText(/Demo workspace/)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Live Signals' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Action Threads' }),
    ).toBeNull()
    expect(screen.getByText('Entry & Interaction')).toBeInTheDocument()
    expect(screen.getByText('Industry & Market')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Discuss/ }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Qira Strategic/)).toBeInTheDocument()
    expect(screen.getByText(/Market Intelligence/)).toBeInTheDocument()
    expect(screen.queryByText('AI Daily Review')).toBeNull()
    expect(screen.getAllByRole('button', { name: /View all/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole('group', { name: 'Time range' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Past week' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /20\d{2}/ })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/What are you noticing/)).toBeNull()
  })

  it('opens Live Signals at the root even if another workspace was stored', () => {
    window.localStorage.setItem('signal-intelligence:workspace-page', 'synthesis')
    render(<App />)
    expect(
      screen.getByRole('region', { name: 'Live Signals' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Discussion Candidates' }),
    ).toBeNull()
  })

  it('keeps Live Signal overview to three cards and a stationary View all footer', () => {
    render(<App />)
    const panel = screen.getByText('Entry & Interaction').closest('section')
    expect(panel).toBeTruthy()
    const scroll = panel!.querySelector('.signal-scroll')
    expect(scroll).toBeTruthy()
    expect(scroll!.querySelectorAll('article.live-card').length).toBeLessThanOrEqual(3)
    expect(scroll!.querySelector('.view-all-link')).toBeNull()
    expect(
      within(panel as HTMLElement).getByRole('button', { name: /View all/ }),
    ).not.toBe(scroll)
  })

  it('scrolls Discussion Candidates instead of compressing cards', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Intelligence Synthesis' }))
    const pane = screen.getByRole('region', { name: 'Discussion Candidates' })
    const list = pane.querySelector('.discussion-list')
    const threads = screen
      .getByRole('region', { name: 'Action Threads' })
      .querySelector('.topic-list')
    expect(list).toBeTruthy()
    expect(threads).toBeTruthy()
    expect(list!.className).toContain('discussion-list')
    expect(list!.querySelectorAll('article.candidate-card').length).toBeGreaterThan(0)
    expect(
      Array.from(list!.querySelectorAll('article.candidate-card')).every((card) =>
        card.classList.contains('candidate-card'),
      ),
    ).toBe(true)
  })

  it('opens a category drawer from View all', () => {
    render(<App />)
    const panel = screen.getByText('Entry & Interaction').closest('section')
    expect(panel).toBeTruthy()
    fireEvent.click(within(panel as HTMLElement).getByRole('button', { name: /View all/ }))
    expect(
      screen.getByRole('dialog', { name: 'Entry & Interaction' }),
    ).toBeInTheDocument()
  })

  it('keeps Action Threads beside Discussion Candidates', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Intelligence Synthesis' }))
    expect(
      screen.getByRole('region', { name: 'Discussion Candidates' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Action Threads' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ New' })).toBeInTheDocument()
    expect(screen.getByText('Harness engineering')).toBeInTheDocument()
    expect(
      screen.getAllByText(
        'DataFlow-Harness turns agent reliability into an engineering discipline',
      ).length,
    ).toBeGreaterThan(1)
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Add signal/i })).toBeNull()
    expect(screen.getByText('+ Drop a signal to create a thread')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Time range' })).toBeInTheDocument()
  })

  it('lets Month open a calendar picker and filters by that month', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /▾/ }))
    expect(screen.getByRole('dialog', { name: 'Select month' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Jul' }))
    expect(screen.getByRole('button', { name: /^Jul / })).toBeInTheDocument()
  })

  it('reassigns a Live Signal category by dragging between modules', () => {
    render(<App />)
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
    fireEvent.click(screen.getByRole('button', { name: 'Intelligence Synthesis' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Open Action Threads dashboard' }),
    )
    expect(screen.queryByText(/Drop a signal/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Add signal/i })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Time range' })).toBeNull()
    expect(
      screen.getByRole('button', { name: '← Intelligence Synthesis' }),
    ).toBeInTheDocument()
  })

  it('redesigns the Action Thread editor into three sections', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Intelligence Synthesis' }))
    fireEvent.click(screen.getByText('Harness engineering'))
    expect(
      screen.getByRole('dialog', { name: 'Edit Action Thread' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Thread basics')).toBeInTheDocument()
    expect(screen.getByText('Linked signals')).toBeInTheDocument()
    expect(screen.getByText('Intelligence framing')).toBeInTheDocument()
    expect(screen.queryByLabelText('Category')).toBeNull()
    expect(screen.queryByLabelText('Description')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('opens an idea popover bound to a signal', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: '+ Add idea' })[0])
    expect(screen.getByRole('dialog', { name: 'Add an idea' })).toBeInTheDocument()
  })

  it('exposes a link capture action', () => {
    render(<App />)
    expect(
      screen.getByRole('button', { name: '+ Add News' }),
    ).toBeInTheDocument()
  })

  it('lets an editor set the article publication date separately', async () => {
    render(<App />)
    const heading = screen.getByRole('link', {
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
