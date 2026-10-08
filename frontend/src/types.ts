// Mirrors the Pydantic models in backend/main.py.
// Note the deliberate `product_name` / `product_id`: the database has a bare `name`
// in both `catalogue` and `users`, so nothing crosses this boundary unqualified.

export interface SizeStock {
  size: string
  quantity: number
}

export interface ProductSummary {
  product_id: string
  product_name: string
  garment_type: string
  price: number
  image_url: string
  short_description: string
  colors: string[]
}

export interface ProductDetail extends ProductSummary {
  description: string
  search_tags: string[]
  inventory: SizeStock[]
  total_stock: number
}

export interface ChatProductCard {
  product_id: string
  product_name: string
  garment_type: string
  price: number
  image_url: string
  short_description: string
  colors: string[]
  total_stock: number
  sizes_in_stock: string[]
  sizes_out: string[]
}

export interface ChatReply {
  reply: string
  products: ChatProductCard[]
}

export interface UserPublic {
  id: number
  first_name: string
  last_name: string
  email: string
}

export interface AuthResponse {
  user: UserPublic
  session_token: string
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
