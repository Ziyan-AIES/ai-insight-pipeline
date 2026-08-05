import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('dashboard pilot shell', () => {
  it('clearly identifies demo mode and renders both work areas', () => {
    render(<App />)
    expect(screen.getByText(/Demo workspace/)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'News dashboard' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Topic dashboard' }),
    ).toBeInTheDocument()
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

    expect(await screen.findByText('Published Jul 1')).toBeInTheDocument()
  })
})
