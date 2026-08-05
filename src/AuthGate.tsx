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

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [identity, setIdentity] = useState<TeamIdentity | null>(null)
  const [loading, setLoading] = useState(cloudConfigured)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

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
    if (!supabase || !session) return
    let cancelled = false
    setLoading(true)
    void supabase
      .from('team_members')
      .select('user_id,email,display_name,role')
      .eq('user_id', session.user.id)
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
  }, [session])

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

  if (!cloudConfigured) return children
  if (loading) {
    return <div className="auth-screen">Connecting to the team workspace…</div>
  }
  if (session && identity) {
    return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
  }

  async function requestLink() {
    if (!supabase || !email.trim()) return
    setMessage('Sending secure sign-in link…')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setMessage(
      error
        ? error.message
        : 'Check your email. The link returns you to this workspace.',
    )
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="brand-mark">SI</span>
        <span className="eyebrow">Private team workspace</span>
        <h1>Signal Intelligence</h1>
        <p>{session ? message : 'Use your approved team email to access the shared news and thesis pipeline.'}</p>
        {session ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => void supabase?.auth.signOut()}
          >
            Sign out and use another account
          </button>
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
      </section>
    </main>
  )
}
