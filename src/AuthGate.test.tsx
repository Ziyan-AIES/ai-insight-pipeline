import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./supabase', () => ({
  cloudConfigured: true,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
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
    mocks.getSession.mockResolvedValue({ data: { session } })
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
})
