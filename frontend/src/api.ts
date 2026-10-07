import type { ChatReply, ProductDetail, ProductSummary } from './types'

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
