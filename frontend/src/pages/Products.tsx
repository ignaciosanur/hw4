import { useEffect, useMemo, useState } from 'react'
import { fetchProducts } from '../api'
import ProductGridCard from '../components/ProductGridCard'
import { useChatResults } from '../chatResults'
import type { ProductSummary } from '../types'
import './Products.css'

type Sort = 'featured' | 'price-asc' | 'price-desc' | 'name'

// L1 category order (output/harness.md §3), for stable chip ordering.
const CATEGORY_ORDER = [
  'T-shirt', 'Lightweight / performance', 'Crewneck sweatshirt',
  'Hoodie', 'Quarter-zip', 'Full-zip hoodie', 'Jacket',
]

export default function Products() {
  const [products, setProducts] = useState<ProductSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { results, query, clear } = useChatResults()

  // Browse controls (FE1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sort, setSort] = useState<Sort>('featured')

  const fromChat = results.length > 0

  useEffect(() => {
    fetchProducts().then(setProducts).catch((e: Error) => setError(e.message))
  }, [])

  const categories = useMemo(() => {
    const present = new Set((products ?? []).map((p) => p.category))
    return ['All', ...CATEGORY_ORDER.filter((c) => present.has(c))]
  }, [products])

  const filtered = useMemo(() => {
    let list = products ?? []
    if (category !== 'All') list = list.filter((p) => p.category === category)
    if (inStockOnly) list = list.filter((p) => p.total_stock > 0)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((p) =>
        p.product_name.toLowerCase().includes(q) ||
        p.garment_type.toLowerCase().includes(q) ||
        p.colors.some((c) => c.toLowerCase().includes(q)),
      )
    }
    const sorted = [...list]
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price)
    else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price)
    else if (sort === 'name') sorted.sort((a, b) => a.product_name.localeCompare(b.product_name))
    return sorted
  }, [products, category, inStockOnly, search, sort])

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

  // Chat-driven results take over the grid (Problem 7); browse controls apply to the catalogue.
  if (fromChat) {
    return (
      <div className="wrap page">
        <header className="chat-results-head">
          <div>
            <p className="chat-results-kicker">From your chat</p>
            <h1>{results.length} {results.length === 1 ? 'match' : 'matches'} for “{query}”</h1>
          </div>
          <button className="btn btn-ghost" onClick={clear}>Show all products</button>
        </header>
        <ul className="grid">
          {results.map((p) => <li key={p.product_id}><ProductGridCard product={p} /></li>)}
        </ul>
      </div>
    )
  }

  return (
    <div className="wrap page">
      <header className="products-head">
        <h1>Products</h1>
        <p>{filtered.length} of {products!.length} items</p>
      </header>

      <div className="browse">
        <div className="chips" role="group" aria-label="Filter by category">
          {categories.map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? 'is-active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="browse-row">
          <input
            className="browse-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, type or colour…"
            aria-label="Search products"
          />
          <label className="browse-toggle">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
            In stock only
          </label>
          <label className="browse-sort">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="state">No products match those filters. <button className="linklike" onClick={() => { setSearch(''); setCategory('All'); setInStockOnly(false) }}>Clear filters</button></div>
      ) : (
        <ul className="grid">
          {filtered.map((p) => <li key={p.product_id}><ProductGridCard product={p} /></li>)}
        </ul>
      )}
    </div>
  )
}
