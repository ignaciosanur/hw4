import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct, fetchRelated } from '../api'
import ProductGridCard from '../components/ProductGridCard'
import type { ProductDetail as Product, ProductSummary } from '../types'
import './ProductDetail.css'

/** Low-stock threshold — below this we warn rather than simply saying "in stock". */
const LOW_STOCK = 3

function stockLabel(quantity: number) {
  if (quantity === 0) return { cls: 'badge-out', text: 'Out of stock' }
  if (quantity <= LOW_STOCK) return { cls: 'badge-low', text: `Only ${quantity} left` }
  return { cls: 'badge-in', text: 'In stock' }
}

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [related, setRelated] = useState<ProductSummary[]>([])

  useEffect(() => {
    if (!productId) return
    setProduct(null)
    setError(null)
    setSelectedSize(null)
    fetchProduct(productId)
      .then(setProduct)
      .catch((e: Error) => setError(e.message))
    fetchRelated(productId).then(setRelated).catch(() => setRelated([]))
  }, [productId])

  if (error) {
    return (
      <div className="wrap page">
        <div className="state-error">
          <p><strong>Could not load this product.</strong> {error}</p>
          <p><Link to="/products">Back to all products</Link></p>
        </div>
      </div>
    )
  }

  if (!product) return <div className="wrap page"><div className="state">Loading…</div></div>

  const selected = product.inventory.find((i) => i.size === selectedSize)

  return (
    <div className="wrap page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/products">Products</Link> <span aria-hidden="true">/</span> {product.product_name}
      </nav>

      <div className="detail">
        <div className="detail-media">
          <img src={product.image_url} alt={product.product_name} width={700} height={700} />
        </div>

        <div className="detail-info">
          <p className="detail-type">{product.garment_type}</p>
          <h1>{product.product_name}</h1>
          <p className="detail-price">${product.price.toFixed(2)}</p>
          <p className="detail-desc">{product.description}</p>

          <div className="detail-block">
            <h2>Colours</h2>
            <ul className="chips">
              {product.colors.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>

          <div className="detail-block">
            <h2>Sizes</h2>
            <div className="sizes" role="group" aria-label="Choose a size">
              {product.inventory.map((item) => {
                const out = item.quantity === 0
                return (
                  <button
                    key={item.size}
                    className={`size ${selectedSize === item.size ? 'is-selected' : ''} ${out ? 'is-out' : ''}`}
                    onClick={() => setSelectedSize(item.size)}
                    disabled={out}
                    aria-label={`${item.size}${out ? ', out of stock' : `, ${item.quantity} available`}`}
                  >
                    {item.size}
                  </button>
                )
              })}
            </div>

            <p className="stock-line" aria-live="polite">
              {selected ? (
                <>
                  <span className={`badge ${stockLabel(selected.quantity).cls}`}>
                    {stockLabel(selected.quantity).text}
                  </span>
                  {selected.quantity > 0 && <> — {selected.quantity} in {selected.size}</>}
                </>
              ) : (
                <span className="muted">
                  {product.total_stock} in stock across all sizes. Pick a size for details.
                </span>
              )}
            </p>
          </div>

          <button className="btn btn-primary detail-cta" disabled={!selected}>
            {selected ? `Add ${selected.size} to bag` : 'Select a size'}
          </button>
          <p className="muted small">Checkout is not part of this coursework build.</p>

          {product.search_tags.length > 0 && (
            <div className="detail-block">
              <h2>Tags</h2>
              <ul className="chips chips-soft">
                {product.search_tags.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="related">
          <h2>You might also like</h2>
          <ul className="grid related-grid">
            {related.map((p) => <li key={p.product_id}><ProductGridCard product={p} /></li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
