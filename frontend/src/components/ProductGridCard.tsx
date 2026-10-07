import { Link } from 'react-router-dom'

/** The storefront product card, shared by the catalogue grid and the chat-driven results
 *  so both look identical. Any card — catalogue or chat-placed — links to the Problem 3
 *  single-item detail page via its product_id. */

export interface GridCardProduct {
  product_id: string
  product_name: string
  garment_type: string
  price: number
  image_url: string
  short_description: string
}

export default function ProductGridCard({ product }: { product: GridCardProduct }) {
  return (
    <Link to={`/products/${product.product_id}`} className="card">
      <div className="card-media">
        <img src={product.image_url} alt={product.product_name} loading="lazy" width={400} height={400} />
      </div>
      <div className="card-body">
        <h2>{product.product_name}</h2>
        <p className="card-type">{product.garment_type}</p>
        <p className="card-desc">{product.short_description}</p>
        <p className="card-price">${product.price.toFixed(2)}</p>
      </div>
    </Link>
  )
}
