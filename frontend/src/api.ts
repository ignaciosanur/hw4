import type { AuthResponse, ChatReply, ProductDetail, ProductSummary, UserPublic } from './types'

/** Thrown for any non-2xx response so callers can show the real reason. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    // FastAPI puts the useful text in `detail`; fall back to the status line.
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export const fetchProducts = () => get<ProductSummary[]>('/api/products')
export const fetchProduct = (id: string) => get<ProductDetail>(`/api/products/${id}`)

export async function sendChatMessage(message: string): Promise<ChatReply> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  return res.json()
}

// --- auth -------------------------------------------------------------------

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* non-JSON */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export const register = (b: {
  first_name: string
  last_name: string
  email: string
  password: string
}) => post<AuthResponse>('/api/auth/register', b)

export const login = (b: { email: string; password: string }) =>
  post<AuthResponse>('/api/auth/login', b)

export const forgotPassword = (email: string) =>
  post<{ message: string; reset_link: string; email_simulated: boolean }>(
    '/api/auth/forgot-password',
    { email },
  )

export const resetPassword = (token: string, password: string) =>
  post<AuthResponse>('/api/auth/reset-password', { token, password })

export async function fetchMe(token: string): Promise<UserPublic> {
  const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  return res.json()
}
