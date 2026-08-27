import {
  useEffect,
  useMemo,
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

function extensionHandshake() {
  if (typeof window === 'undefined') {
    return { enabled: false, state: '' }
  }
  const params = new URLSearchParams(window.location.search)
  return {
    enabled: params.get('extension_auth') === '1',
    state: params.get('state') || '',
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
  const [session, setSession] = useState<Session | null>(null)
  const [identity, setIdentity] = useState<TeamIdentity | null>(null)
  const [loading, setLoading] = useState(cloudConfigured)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
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

  const context = useMemo<AuthContextValue>(
    () => ({
      identity,
      canEdit: !cloudConfigured || identity?.role !== 'member',
      canAdmin: !cloudConfigured || identity?.role === 'admin',
      signOut: async () => {
        if (supabase) await supabase.auth.signOut()
      },
    }),
    [identity],
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
      onClick={() => void supabase?.auth.signOut()}
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
      const connected = extensionStatus === 'connected'
      return (
        <AuthCard
          eyebrow="Chrome extension"
          title={connected ? 'Capture access enabled' : 'Connecting extension'}
        >
          <p>
            Signed in as {identity.displayName} ({identity.email}). The
            extension uses this same authorized account. You can close this tab
            after the extension shows Capture access enabled.
          </p>
          {extensionStatus === 'error' && message ? <small>{message}</small> : null}
        </AuthCard>
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
    </AuthCard>
  )
}
