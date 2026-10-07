import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Auth.css'

/* Forms only. No authentication is wired up in Problem 3 — the backend grows into the
   agent in Problem 5, and real signup/login belongs with it. Submitting shows a notice
   rather than pretending to create an account.

   Note the separate first/last name fields: the users table was extended with
   first_name/last_name precisely so the assistant can greet by first name, and splitting
   a single `name` on whitespace breaks compound surnames (see output/harness.md §4.4). */

interface Props {
  mode: 'login' | 'signup'
}

export default function Auth({ mode }: Props) {
  const isSignup = mode === 'signup'
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="wrap page auth">
      <h1>{isSignup ? 'Create an account' : 'Log in'}</h1>
      <p className="auth-lede">
        {isSignup
          ? 'An account lets the shop assistant greet you by name and keep your conversation between visits.'
          : 'Welcome back. Log in to pick up your previous conversation with the assistant.'}
      </p>

      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(true)
        }}
      >
        {isSignup && (
          <div className="field-row">
            <label>
              First name
              <input name="first_name" autoComplete="given-name" required />
            </label>
            <label>
              Last name
              <input name="last_name" autoComplete="family-name" required />
            </label>
          </div>
        )}

        <label>
          Email
          <input type="email" name="email" autoComplete="email" required placeholder="you@yale.edu" />
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={8}
          />
          {isSignup && <span className="hint">At least 8 characters.</span>}
        </label>

        <button className="btn btn-primary" type="submit">
          {isSignup ? 'Create account' : 'Log in'}
        </button>

        {submitted && (
          <p className="auth-notice" role="status">
            Accounts are not connected yet — this form is the Problem 3 scaffold. Sign-up and
            login are wired to the backend in a later problem.
          </p>
        )}
      </form>

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
