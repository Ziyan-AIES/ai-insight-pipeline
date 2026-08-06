import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./supabase', () => ({
  cloudConfigured: true,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  },
}))

import { AuthGate } from './AuthGate'

const session = {
  user: { id: 'user-1', email: 'person@example.com' },
}

describe('membership gate', () => {
  beforeEach(() => {
    mocks.getSession.mockReset()
    mocks.maybeSingle.mockReset()
    mocks.onAuthStateChange.mockReset()
    mocks.getSession.mockResolvedValue({ data: { session } })
    mocks.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }))
  })

  it('renders the workspace only for a team member', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: 'user-1',
        email: 'person@example.com',
        display_name: 'Pilot Person',
        role: 'member',
      },
      error: null,
    })
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    expect(await screen.findByText('Protected workspace')).toBeInTheDocument()
  })

  it('shows sign-in when there is no active session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    expect(
      await screen.findByRole('button', { name: 'Send sign-in link' }),
    ).toBeInTheDocument()
  })

  it('shows a clear denial instead of demo data to non-members', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    expect(
      await screen.findByText(/has not been approved for this workspace/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Protected workspace')).not.toBeInTheDocument()
  })

  it('keeps the workspace mounted during a same-user token refresh', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: 'user-1',
        email: 'person@example.com',
        display_name: 'Pilot Person',
        role: 'editor',
      },
      error: null,
    })
    render(
      <AuthGate>
        <button type="button">Draft value</button>
      </AuthGate>,
    )
    const draft = await screen.findByRole('button', { name: 'Draft value' })
    fireEvent.click(draft)
    const callback = mocks.onAuthStateChange.mock.calls[0][0]

    act(() => {
      callback('TOKEN_REFRESHED', {
        ...session,
        access_token: 'refreshed-token',
      })
    })

    expect(screen.getByRole('button', { name: 'Draft value' })).toBe(draft)
    expect(screen.queryByText(/Connecting to the team workspace/)).toBeNull()
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1)
  })
})
