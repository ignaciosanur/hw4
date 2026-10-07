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

export interface ChatReply {
  reply: string
  products: ProductSummary[]
  stub?: boolean
}
