import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, forgotPassword, login, register } from '../api'
import { useAuth } from '../auth'
import './Auth.css'

/* Create-account / log-in / forgot-password, all wired to the backend.

   Separate first/last name fields at signup: the users table was extended with
   first_name/last_name so the assistant can greet by first name, and splitting a single
   `name` on whitespace breaks compound surnames (output/harness.md §4.4). */

interface Props {
  mode: 'login' | 'signup'
}

// Mirrors backend/security.py so the user sees requirements before submitting.
const RULES = [
  { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'An uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p), label: 'A lowercase letter' },
  { test: (p: string) => /[0-9]/.test(p), label: 'A number' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'A symbol' },
]

export default function Auth({ mode }: Props) {
  const isSignup = mode === 'signup'
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const unmet = RULES.filter((r) => !r.test(form.password))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isSignup && form.password !== form.confirm) {
      setError('The two passwords do not match.')
      return
    }
    if (isSignup && unmet.length) {
      setError('Please meet all the password requirements.')
      return
    }

    setBusy(true)
    try {
      const res = isSignup
        ? await register({
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            password: form.password,
          })
        : await login({ email: form.email, password: form.password })
      signIn(res)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wrap page auth">
      <h1>{isSignup ? 'Create an account' : 'Log in'}</h1>
      <p className="auth-lede">
        {isSignup
          ? 'An account lets the shop assistant greet you by name and keep your conversation between visits.'
          : 'Welcome back. Log in to pick up where you left off.'}
      </p>

      <form className="auth-form" onSubmit={submit} noValidate>
        {isSignup && (
          <div className="field-row">
            <label>
              First name
              <input value={form.first_name} onChange={set('first_name')} autoComplete="given-name" required />
            </label>
            <label>
              Last name
              <input value={form.last_name} onChange={set('last_name')} autoComplete="family-name" required />
            </label>
          </div>
        )}

        <label>
          Email
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required placeholder="you@yale.edu" />
        </label>

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
          />
        </label>

        {isSignup && form.password.length > 0 && (
          <ul className="pw-rules">
            {RULES.map((r) => {
              const ok = r.test(form.password)
              return (
                <li key={r.label} className={ok ? 'ok' : ''}>
                  <span aria-hidden="true">{ok ? '✓' : '○'}</span> {r.label}
                </li>
              )
            })}
          </ul>
        )}

        {isSignup && (
          <label>
            Confirm password
            <input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required />
            {form.confirm.length > 0 && form.confirm !== form.password && (
              <span className="hint hint-warn">Passwords do not match.</span>
            )}
          </label>
        )}

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
        </button>
      </form>

      {!isSignup && (
        <p className="auth-alt">
          <button className="linklike" onClick={() => setForgotOpen((o) => !o)}>Forgot your password?</button>
        </p>
      )}
      {forgotOpen && <ForgotPassword initialEmail={form.email} />}

      <p className="auth-alt">
        {isSignup ? (
          <>Already have an account? <Link to="/login">Log in</Link>.</>
        ) : (
          <>New to Campus Customs? <Link to="/signup">Create an account</Link>.</>
        )}
      </p>
    </div>
  )
}

/** Forgot-password panel. No mail server in this build, so the backend returns the reset
 *  link and we show it directly — clearly labelled as a simulated email. */
function ForgotPassword({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'sent' | 'error'; message?: string; link?: string }>({
    kind: 'idle',
  })

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setState({ kind: 'busy' })
    try {
      const res = await forgotPassword(email)
      setState({ kind: 'sent', link: res.reset_link })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Something went wrong.' })
    }
  }

  return (
    <div className="forgot">
      <form onSubmit={send}>
        <label>
          Email for your reset link
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@yale.edu" />
        </label>
        <button className="btn btn-ghost" disabled={state.kind === 'busy'}>Send reset link</button>
      </form>

      {state.kind === 'error' && <p className="auth-error" role="alert">{state.message}</p>}
      {state.kind === 'sent' && (
        <div className="forgot-sent" role="status">
          <p><strong>Reset link generated.</strong> No email is actually sent in this coursework build, so here is the link:</p>
          <p><Link to={state.link!.replace(/^https?:\/\/[^/]+/, '')}>Open the reset page →</Link></p>
        </div>
      )}
    </div>
  )
}
