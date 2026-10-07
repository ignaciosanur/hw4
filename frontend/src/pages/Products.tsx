import { useEffect, useState } from 'react'
import { fetchProducts } from '../api'
import ProductGridCard from '../components/ProductGridCard'
import { useChatResults } from '../chatResults'
import type { ProductSummary } from '../types'
import './Products.css'

export default function Products() {
  const [products, setProducts] = useState<ProductSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { results, query, clear } = useChatResults()

  // Products the chat surfaced take over the grid; otherwise show the full catalogue.
  const fromChat = results.length > 0

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
          <p>Start the API with <code>cd backend &amp;&amp; uvicorn main:app --port 8000</code>.</p>
        </div>
      </div>
    )
  }

  if (!fromChat && !products) {
    return <div className="wrap page"><div className="state">Loading the catalogue…</div></div>
  }

  const shown = fromChat ? results : (products ?? [])

  return (
    <div className="wrap page">
      {fromChat ? (
        <header className="chat-results-head">
          <div>
            <p className="chat-results-kicker">From your chat</p>
            <h1>{results.length} {results.length === 1 ? 'match' : 'matches'} for “{query}”</h1>
          </div>
          <button className="btn btn-ghost" onClick={clear}>Show all products</button>
        </header>
      ) : (
        <header className="products-head">
          <h1>Products</h1>
          <p>{shown.length} items, all officially licensed.</p>
        </header>
      )}

      <ul className="grid">
        {shown.map((p) => (
          <li key={p.product_id}>
            <ProductGridCard product={p} />
          </li>
        ))}
      </ul>
    </div>
  )
}
