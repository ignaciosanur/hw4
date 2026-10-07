import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts } from '../api'
import type { ProductSummary } from '../types'
import './Products.css'

export default function Products() {
  const [products, setProducts] = useState<ProductSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="wrap page">
        <h1>Products</h1>
        <div className="state-error">
          <p><strong>Could not load the catalogue.</strong> {error}</p>
          <p>
            Start the API with <code>.venv/bin/python -m uvicorn backend.main:app --port 8010</code>.
          </p>
        </div>
      </div>
    )
  }

  if (!products) return <div className="wrap page"><div className="state">Loading the catalogue…</div></div>

  return (
    <div className="wrap page">
      <header className="products-head">
        <h1>Products</h1>
        <p>{products.length} items, all officially licensed.</p>
      </header>

      <ul className="grid">
        {products.map((p) => (
          <li key={p.product_id}>
            <Link to={`/products/${p.product_id}`} className="card">
              <div className="card-media">
                <img src={p.image_url} alt={p.product_name} loading="lazy" width={400} height={400} />
              </div>
              <div className="card-body">
                <h2>{p.product_name}</h2>
                <p className="card-type">{p.garment_type}</p>
                <p className="card-desc">{p.short_description}</p>
                <p className="card-price">${p.price.toFixed(2)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
