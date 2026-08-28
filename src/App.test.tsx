import { fireEvent, render, screen } from '@testing-library/react'
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
    expect(screen.getAllByRole('button', { name: /Vote to Discuss/ }).length).toBeGreaterThan(0)
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
    expect(screen.getByRole('button', { name: '+ New Action Thread' })).toBeInTheDocument()
    expect(screen.getByText('Harness engineering')).toBeInTheDocument()
    expect(
      screen.getAllByText(
        'DataFlow-Harness turns agent reliability into an engineering discipline',
      ).length,
    ).toBeGreaterThan(1)
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
      screen.getAllByRole('button', { name: 'Edit' }).find((button) =>
        card?.contains(button),
      )!,
    )

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
