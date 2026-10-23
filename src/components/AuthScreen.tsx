import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

const INVITE_CODE = 'ACES'

type Mode = 'signin' | 'signup'

function friendlyError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  if (/invalid invite/i.test(msg)) {
    return "That invite code isn't valid. The code is ACES."
  }
  if (/database error saving new user/i.test(msg)) {
    return 'Sign-up failed on the server (database error). Run supabase/invite-aces.sql in Supabase, then try again.'
  }
  if (/invalid login credentials/i.test(msg)) return 'Email or password is incorrect.'
  if (/email not confirmed/i.test(msg)) {
    return 'Confirm your email first. Check your inbox for the link we sent.'
  }
  if (/already registered/i.test(msg)) return 'That email already has an account. Try signing in.'
  if (/rate limit/i.test(msg)) return 'Too many emails sent. Wait a few minutes and try again.'
  return msg
}

export function AuthScreen() {
  const { signIn, signUp, sendMagicLink } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        if (invite.trim().toUpperCase() !== INVITE_CODE) {
          throw new Error('Invalid invite code')
        }
        const needsConfirm = await signUp({
          email,
          password,
          displayName: name,
          inviteCode: invite,
        })
        if (needsConfirm) {
          setNotice(`We sent a confirmation link to ${email}. Open it, then sign in.`)
          setMode('signin')
        }
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function magic() {
    if (!email) {
      setError('Enter your email first, then ask for a sign-in link.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await sendMagicLink(email)
      setNotice(`Sign-in link sent to ${email}.`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <section className="auth-hero">
        <img className="auth-logo" src="/logo.png" alt="ACES, FEU Roosevelt BSIT crest" />
        <h1>Alliance of Computing Education Students</h1>
        <p>Voice rooms, video, chat and file sharing for our class organization.</p>
      </section>

      <section className="auth-panel">
        <form onSubmit={submit} className="auth-form">
          <h2>{mode === 'signin' ? 'Sign in' : 'Create your account'}</h2>

          {mode === 'signup' && (
            <label>
              Display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How classmates will see you"
                autoComplete="name"
                required
                maxLength={40}
              />
            </label>
          )}

          <label>
            Personal email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
          </label>

          {mode === 'signup' && (
            <label>
              ACES invite code
              <input
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="ACES"
                autoCapitalize="off"
                autoCorrect="off"
                required
              />
            </label>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-notice" role="status">{notice}</p>}

          <button className="btn primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          {mode === 'signin' && (
            <button type="button" className="btn link" onClick={magic} disabled={busy}>
              Email me a sign-in link instead
            </button>
          )}

          <p className="switch">
            {mode === 'signin' ? 'New to ACES Connect?' : 'Already have an account?'}{' '}
            <button
              type="button"
              className="btn link"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
                setNotice(null)
              }}
            >
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </form>
      </section>
    </div>
  )
}
