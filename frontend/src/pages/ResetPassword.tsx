import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, resetPassword } from '../api'
import { useAuth } from '../auth'
import './Auth.css'

const RULES = [
  { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'An uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p), label: 'A lowercase letter' },
  { test: (p: string) => /[0-9]/.test(p), label: 'A number' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'A symbol' },
]

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const unmet = RULES.filter((r) => !r.test(password))

  if (!token) {
    return (
      <div className="wrap page auth">
        <h1>Reset password</h1>
        <p className="auth-error">This reset link is missing its token. Start again from <Link to="/login">Log in</Link>.</p>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) return setError('The two passwords do not match.')
    if (unmet.length) return setError('Please meet all the password requirements.')

    setBusy(true)
    try {
      const res = await resetPassword(token, password)
      signIn(res) // reset returns a session, so the user lands logged in
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wrap page auth">
      <h1>Choose a new password</h1>
      <p className="auth-lede">Set a new password for your account. The link is valid for one hour.</p>

      <form className="auth-form" onSubmit={submit} noValidate>
        <label>
          New password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </label>
        {password.length > 0 && (
          <ul className="pw-rules">
            {RULES.map((r) => {
              const ok = r.test(password)
              return <li key={r.label} className={ok ? 'ok' : ''}><span aria-hidden="true">{ok ? '✓' : '○'}</span> {r.label}</li>
            })}
          </ul>
        )}
        <label>
          Confirm new password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Please wait…' : 'Set new password'}</button>
      </form>
    </div>
  )
}
