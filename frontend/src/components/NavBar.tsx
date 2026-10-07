import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import './NavBar.css'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products' },
  { to: '/about', label: 'About us' },
]

export default function NavBar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <NavLink to="/" className="brand" end>
          <span className="brand-mark">CC</span>
          <span className="brand-text">
            <strong>Campus Customs</strong>
            <small>Officially licensed Yale apparel</small>
          </span>
        </NavLink>

        <nav aria-label="Main">
          <ul className="nav-links">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="nav-account">
          {user ? (
            <>
              <span className="nav-greet">Hi, {user.first_name}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  signOut()
                  navigate('/')
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn-ghost btn-sm">Log in</NavLink>
              <NavLink to="/signup" className="btn btn-primary btn-sm">Create account</NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
