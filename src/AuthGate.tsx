import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { cloudConfigured, supabase } from './supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(cloudConfigured)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!cloudConfigured) return children
  if (loading) {
    return <div className="auth-screen">Connecting to the team workspace…</div>
  }
  if (session) return children

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
        <p>
          Use your approved team email to access the shared news and thesis
          pipeline.
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
      </section>
    </main>
  )
}
