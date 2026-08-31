import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  AuthContext,
  type AuthContextValue,
  type TeamIdentity,
  type TeamRole,
} from './auth-context'
import { cloudConfigured, supabase } from './supabase'

const HANDSHAKE_STORAGE_KEY = 'bsw-extension-auth-state'
const HANDSHAKE_TTL_MS = 24 * 60 * 60 * 1000
const EXTENSION_SESSION_REQUEST_EVENT = 'ai-signals:request-dashboard-session'
const DASHBOARD_SIGN_OUT_EVENT = 'ai-signals:dashboard-sign-out'
const EXTENSION_RESTORE_ATTEMPTS = 6
const EXTENSION_RESTORE_INTERVAL_MS = 300

function randomHandshakeState() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function extensionHandshake() {
  if (typeof window === 'undefined') {
    return { enabled: false, state: '' }
  }
  const params = new URLSearchParams(window.location.search)
  let enabled = params.get('extension_auth') === '1'
  let state = params.get('state') || ''
  if (enabled && state) {
    persistHandshakeState(state)
  } else {
    const stored = readHandshakeState()
    if (stored) {
      enabled = true
      state = stored
    }
  }
  return { enabled, state }
}

function dashboardSessionHandshake() {
  if (typeof window === 'undefined') return { enabled: false, state: '' }
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return {
    enabled: params.get('dashboard_auth') === '1',
    state: params.get('state') || '',
  }
}

function clearDashboardSessionHandshake() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (params.get('dashboard_auth') !== '1') return
  params.delete('dashboard_auth')
  params.delete('state')
  const hash = params.toString()
  window.history.replaceState(
    {},
    '',
    `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`,
  )
}

function persistHandshakeState(state: string) {
  try {
    window.localStorage.setItem(
      HANDSHAKE_STORAGE_KEY,
      JSON.stringify({ state, at: Date.now() }),
    )
  } catch {
    // Handshake persistence is best-effort.
  }
}

function readHandshakeState() {
  try {
    const raw = window.localStorage.getItem(HANDSHAKE_STORAGE_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { state?: string; at?: number }
    if (parsed.at && Date.now() - parsed.at > HANDSHAKE_TTL_MS) {
      window.localStorage.removeItem(HANDSHAKE_STORAGE_KEY)
      return ''
    }
    return parsed.state || ''
  } catch {
    return ''
  }
}

function clearHandshakeState() {
  try {
    window.localStorage.removeItem(HANDSHAKE_STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

function AuthCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="brand-mark">SI</span>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const handshake = useMemo(extensionHandshake, [])
  const dashboardHandshake = useMemo(dashboardSessionHandshake, [])
  const [session, setSession] = useState<Session | null>(null)
  const [identity, setIdentity] = useState<TeamIdentity | null>(null)
  const [loading, setLoading] = useState(cloudConfigured)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [checkingExtension, setCheckingExtension] = useState(false)
  const extensionRestoreAttempted = useRef(false)
  const [extensionStatus, setExtensionStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'denied' | 'error'
  >('idle')
  const sessionUserId = session?.user.id

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setIdentity(null)
        setLoading(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (
      !supabase ||
      loading ||
      session ||
      extensionRestoreAttempted.current
    ) {
      return
    }
    extensionRestoreAttempted.current = true
    let cancelled = false
    const state = dashboardHandshake.state || randomHandshakeState()
    setCheckingExtension(true)

    void (async () => {
      for (let attempt = 0; attempt < EXTENSION_RESTORE_ATTEMPTS; attempt += 1) {
        if (cancelled) return
        if (!dashboardHandshake.enabled) {
          window.dispatchEvent(
            new CustomEvent(EXTENSION_SESSION_REQUEST_EVENT, {
              detail: { state },
            }),
          )
        }
        try {
          const result = await fetch('/api/extension-auth', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'claim', state }),
          })
          if (result.ok) {
            const body = (await result.json().catch(() => ({}))) as {
              authorized?: boolean
              access_token?: string
              refresh_token?: string
            }
            if (
              body.authorized !== false &&
              body.access_token &&
              body.refresh_token
            ) {
              const { error } = await supabase.auth.setSession({
                access_token: body.access_token,
                refresh_token: body.refresh_token,
              })
              if (!error || cancelled) {
                clearDashboardSessionHandshake()
                return
              }
            }
          }
        } catch {
          // The extension is optional; work-email sign-in remains available.
        }
        if (attempt < EXTENSION_RESTORE_ATTEMPTS - 1) {
          await wait(EXTENSION_RESTORE_INTERVAL_MS)
        }
      }
    })().finally(() => {
      if (!cancelled) setCheckingExtension(false)
    })

    return () => {
      cancelled = true
    }
  }, [dashboardHandshake.enabled, dashboardHandshake.state, loading, session])

  useEffect(() => {
    if (!supabase || !sessionUserId) return
    let cancelled = false
    setLoading(true)
    void supabase
      .from('team_members')
      .select('user_id,email,display_name,role')
      .eq('user_id', sessionUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setIdentity(null)
          setMessage(
            error
              ? 'Your team membership could not be verified.'
              : 'This account is signed in but has not been approved for this workspace.',
          )
        } else {
          setIdentity({
            userId: data.user_id,
            email: data.email,
            displayName:
              data.display_name || data.email?.split('@')[0] || 'Team member',
            role: data.role as TeamRole,
          })
          setMessage('')
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionUserId])

  useEffect(() => {
    if (extensionStatus !== 'connected') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('extension_auth') !== '1') return
    params.delete('extension_auth')
    params.delete('state')
    const query = params.toString()
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    )
  }, [extensionStatus])

  useEffect(() => {
    if (!handshake.enabled || !handshake.state || !session) return
    let cancelled = false
    setExtensionStatus((current) =>
      current === 'connected' ? current : 'connecting',
    )
    void fetch('/api/extension-auth', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'complete',
        state: handshake.state,
        refresh_token: session.refresh_token,
      }),
    })
      .then(async (result) => {
        if (cancelled) return
        const body = (await result.json().catch(() => ({}))) as {
          authorized?: boolean
          connected?: boolean
          error?: string
        }
        if (!result.ok) {
          setExtensionStatus('error')
          setMessage(
            body.error ||
              'The extension could not be connected. Try Sign in from the extension again.',
          )
          return
        }
        if (body.authorized === false || body.connected === false) {
          setExtensionStatus('denied')
          return
        }
        setExtensionStatus('connected')
        clearHandshakeState()
      })
      .catch(() => {
        if (!cancelled) {
          setExtensionStatus('error')
          setMessage(
            'The extension could not be connected. Try Sign in from the extension again.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [handshake.enabled, handshake.state, session])

  const signOutEverywhere = useCallback(async () => {
    window.dispatchEvent(new CustomEvent(DASHBOARD_SIGN_OUT_EVENT))
    if (supabase) await supabase.auth.signOut()
  }, [])

  const context = useMemo<AuthContextValue>(
    () => ({
      identity,
      canEdit: !cloudConfigured || identity?.role !== 'member',
      canAdmin: !cloudConfigured || identity?.role === 'admin',
      signOut: signOutEverywhere,
    }),
    [identity, signOutEverywhere],
  )

  async function requestLink() {
    if (!supabase || !email.trim()) return
    setMessage('Sending secure sign-in link…')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo:
          handshake.enabled && handshake.state
            ? `${window.location.origin}/?extension_auth=1&state=${encodeURIComponent(handshake.state)}`
            : window.location.origin,
      },
    })
    setMessage(
      error
        ? error.message
        : 'Check your email. The link returns you to this workspace.',
    )
  }

  const signOutButton = (
    <button
      className="secondary-button"
      type="button"
      onClick={() => void signOutEverywhere()}
    >
      Sign out and use another account
    </button>
  )

  if (!cloudConfigured) return children
  if (loading) {
    return <div className="auth-screen">Connecting to the team workspace…</div>
  }

  if (handshake.enabled) {
    if (session && identity) {
      const showBanner =
        extensionStatus === 'connecting' || extensionStatus === 'error'
      return (
        <>
          {showBanner ? (
            <div className="extension-banner">
              <strong>
                {extensionStatus === 'error'
                  ? 'Extension could not connect'
                  : 'Connecting Chrome extension'}
              </strong>
              <span>
                {extensionStatus === 'error'
                  ? message || 'Try Sign in from the extension again.'
                  : `Signed in as ${identity.displayName}. Connecting capture, then this banner will hide.`}
              </span>
            </div>
          ) : null}
          <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
        </>
      )
    }
    if (session && !identity) {
      return (
        <AuthCard eyebrow="Chrome extension" title="Access not enabled">
          <p>
            {session.user.email
              ? `${session.user.email} is signed in but is not on the authorized team list.`
              : message}
            {' '}
            Capture stays blocked until an admin adds this account to
            team_members.
          </p>
          {signOutButton}
        </AuthCard>
      )
    }
    return (
      <AuthCard eyebrow="Chrome extension" title="AI Signals">
        <p>
          Sign in with your work email. The Chrome extension uses the same
          authorized user list as this workspace.
        </p>
        <label>
          Work email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
          />
        </label>
        <button className="primary-button" type="button" onClick={requestLink}>
          Send sign-in link
        </button>
        {message && <small>{message}</small>}
      </AuthCard>
    )
  }

  if (session && identity) {
    return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
  }

  return (
    <AuthCard
      eyebrow="Private team workspace"
      title="Signal Intelligence"
    >
      <p>
        {session
          ? message
          : 'Use your approved team email to access the shared news and thesis pipeline.'}
      </p>
      {session ? (
        signOutButton
      ) : (
        <>
          <label>
            Work email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
            />
          </label>
          <button className="primary-button" type="button" onClick={requestLink}>
            Send sign-in link
          </button>
        </>
      )}
      {!session && message && <small>{message}</small>}
      {!session && checkingExtension && (
        <small>Checking your installed AI Signals extension…</small>
      )}
    </AuthCard>
  )
}
