import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App, { NewsWhyItMatters } from './App'

describe('dashboard pilot shell', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('defaults to Daily briefing over the shared note dataset', () => {
    render(<App />)
    expect(screen.getByText(/Demo workspace/)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Daily briefing' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Topic dashboard' }),
    ).toBeNull()
    expect(screen.getByText('Entry & Interaction')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Vote to discuss' }).length).toBeGreaterThan(0)
  })

  it('keeps Topics on the Weekly Discussion page', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Weekly Discussion' }))
    expect(
      screen.getByRole('region', { name: 'Discussion notes' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Topic dashboard' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add Note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Insight' })).toBeInTheDocument()
  })

  it('exposes a link capture action', () => {
    render(<App />)
    expect(
      screen.getByRole('button', { name: '+ Add link' }),
    ).toBeInTheDocument()
  })

  it('lets an editor set the article publication date separately', async () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])

    const publicationDate = screen.getByLabelText(/Publication date/)
    fireEvent.change(publicationDate, { target: { value: '2026-07-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findAllByText('Published Jul 1')).not.toHaveLength(0)
  })

  it('restores an unfinished Add link draft after a remount', () => {
    const firstRender = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add link' }))
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/unfinished' },
    })
    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: 'Unfinished signal' },
    })
    firstRender.unmount()

    render(<App />)

    expect(screen.getByRole('dialog', { name: 'Add link' })).toBeInTheDocument()
    expect(screen.getByLabelText('URL')).toHaveValue(
      'https://example.com/unfinished',
    )
    expect(screen.getByLabelText(/Title/)).toHaveValue('Unfinished signal')
  })

  it('clears the Add link draft when the user cancels it', () => {
    const firstRender = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add link' }))
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/cancelled' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    firstRender.unmount()

    render(<App />)

    expect(screen.queryByRole('dialog', { name: 'Add link' })).toBeNull()
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
