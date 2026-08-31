import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  setSession: vi.fn(),
  signInWithOtp: vi.fn(),
}))

vi.mock('./supabase', () => ({
  cloudConfigured: true,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
      setSession: mocks.setSession,
      signInWithOtp: mocks.signInWithOtp,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  },
}))

import { AuthGate } from './AuthGate'

function handshakeRequestBody() {
  const init = vi.mocked(fetch).mock.calls[0]?.[1]
  expect(init).toBeTruthy()
  expect(typeof init?.body).toBe('string')
  return JSON.parse(String(init?.body)) as {
    action?: string
    state?: string
    refresh_token?: string
  }
}

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  user: { id: 'user-1', email: 'person@example.com' },
}

const member = {
  user_id: 'user-1',
  email: 'person@example.com',
  display_name: 'Pilot Person',
  role: 'member',
}

describe('membership gate', () => {
  beforeEach(() => {
    mocks.getSession.mockReset()
    mocks.maybeSingle.mockReset()
    mocks.onAuthStateChange.mockReset()
    mocks.signInWithOtp.mockReset()
    mocks.setSession.mockReset()
    mocks.setSession.mockResolvedValue({ data: { session }, error: null })
    mocks.getSession.mockResolvedValue({ data: { session } })
    mocks.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }))
    window.history.replaceState({}, '', '/')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      }),
    )
  })

  it('renders the workspace only for a team member', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: member, error: null })
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

  it('shows the extension handoff error instead of silently dropping it', async () => {
    window.history.replaceState(
      {},
      '',
      '/#extension_auth_error=Extension%20session%20expired.%20Sign%20in%20again.',
    )
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    expect(
      await screen.findByText('Extension session expired. Sign in again.'),
    ).toBeInTheDocument()
  })

  it('restores the dashboard from an already signed-in extension', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          authorized: true,
          access_token: 'extension-access-token',
          refresh_token: 'extension-refresh-token',
        }),
      }),
    )
    const requestListener = vi.fn()
    window.addEventListener(
      'ai-signals:request-dashboard-session',
      requestListener,
    )
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    await waitFor(() => expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: 'extension-access-token',
      refresh_token: 'extension-refresh-token',
    }))
    expect(requestListener).toHaveBeenCalled()
    const body = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as { action?: string; state?: string }
    expect(body.action).toBe('claim')
    expect(body.state).toMatch(/^[a-f0-9]{48}$/)
    window.removeEventListener(
      'ai-signals:request-dashboard-session',
      requestListener,
    )
  })

  it('claims the one-time session created by Open Dashboard', async () => {
    window.history.replaceState(
      {},
      '',
      '/#dashboard_auth=1&state=direct-dashboard-state-1234567890',
    )
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          authorized: true,
          access_token: 'direct-access-token',
          refresh_token: 'direct-refresh-token',
        }),
      }),
    )
    const requestListener = vi.fn()
    window.addEventListener(
      'ai-signals:request-dashboard-session',
      requestListener,
    )
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    await waitFor(() => expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: 'direct-access-token',
      refresh_token: 'direct-refresh-token',
    }))
    const body = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as { action?: string; state?: string }
    expect(body).toEqual({
      action: 'claim',
      state: 'direct-dashboard-state-1234567890',
    })
    expect(requestListener).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('')
    window.removeEventListener(
      'ai-signals:request-dashboard-session',
      requestListener,
    )
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
      data: { ...member, role: 'editor' },
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

describe('extension handshake', () => {
  beforeEach(() => {
    mocks.getSession.mockReset()
    mocks.maybeSingle.mockReset()
    mocks.onAuthStateChange.mockReset()
    mocks.setSession.mockReset()
    mocks.getSession.mockResolvedValue({ data: { session } })
    mocks.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }))
    window.history.replaceState(
      {},
      '',
      '/?extension_auth=1&state=handshake-state-123456',
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, authorized: true, connected: true }),
      }),
    )
  })

  it('completes handshake for an authorized member without opening the dashboard', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: member, error: null })
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    expect(await screen.findByText('Protected workspace')).toBeInTheDocument()
    expect(screen.queryByText('Capture access enabled')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/extension-auth',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            authorization: 'Bearer access-token',
          }),
        }),
      )
    })
    const body = handshakeRequestBody()
    expect(body).toMatchObject({
      action: 'complete',
      state: 'handshake-state-123456',
      refresh_token: 'refresh-token',
    })
  })

  it('blocks capture complete for a signed-in account that is not a team member', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          authorized: false,
          connected: false,
          email: 'person@example.com',
        }),
      }),
    )
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    expect(await screen.findByRole('heading', { name: 'Access not enabled' })).toBeInTheDocument()
    expect(screen.getByText(/person@example.com/)).toBeInTheDocument()
    expect(screen.queryByText('Protected workspace')).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalled()
  })

  it('keeps the magic-link redirect on the handshake URL', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    mocks.signInWithOtp.mockResolvedValue({ error: null })
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    fireEvent.change(await screen.findByPlaceholderText('name@company.com'), {
      target: { value: 'person@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'person@example.com',
      options: {
        emailRedirectTo: `${window.location.origin}/?extension_auth=1&state=handshake-state-123456`,
      },
    })
  })

  it('resumes handshake from storage after a magic-link callback without query params', async () => {
    window.history.replaceState({}, '', '/#access_token=callback')
    window.localStorage.setItem(
      'bsw-extension-auth-state',
      JSON.stringify({ state: 'stored-handshake-state-123456', at: Date.now() }),
    )
    mocks.maybeSingle.mockResolvedValue({ data: member, error: null })
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    expect(await screen.findByText('Protected workspace')).toBeInTheDocument()
    const body = handshakeRequestBody()
    expect(body.state).toBe('stored-handshake-state-123456')
  })

  it('resumes a stored handshake when the magic link returns to the dashboard home URL', async () => {
    window.history.replaceState({}, '', '/')
    window.localStorage.setItem(
      'bsw-extension-auth-state',
      JSON.stringify({ state: 'stored-handshake-state-plain-1', at: Date.now() }),
    )
    mocks.maybeSingle.mockResolvedValue({ data: member, error: null })
    render(
      <AuthGate>
        <div>Protected workspace</div>
      </AuthGate>,
    )
    expect(await screen.findByText('Protected workspace')).toBeInTheDocument()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const body = handshakeRequestBody()
    expect(body.state).toBe('stored-handshake-state-plain-1')
  })
})
