import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchMe } from './api'
import type { AuthResponse, UserPublic } from './types'

/** Minimal client-side auth state. The session token is a signed, expiring token issued
 *  by the backend; we persist it so a reload keeps the user signed in, and validate it
 *  against /api/auth/me on startup. */

interface AuthState {
  user: UserPublic | null
  loading: boolean
  signIn: (res: AuthResponse) => void
  signOut: () => void
}

const TOKEN_KEY = 'cc.session'
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    fetchMe(token)
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY)) // expired or invalid
      .finally(() => setLoading(false))
  }, [])

  const signIn = (res: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, res.session_token)
    setUser(res.user)
  }

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
