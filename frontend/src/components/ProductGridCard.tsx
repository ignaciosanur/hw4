import { Link } from 'react-router-dom'
import './ProductGridCard.css'

/** The storefront product card, shared by the catalogue grid, chat-driven results, category
 *  tiles and "you might also like". Any card links to the Problem 3 detail page by product_id.
 *  colors/total_stock are optional extras used for swatches and a stock ribbon when present. */

export interface GridCardProduct {
  product_id: string
  product_name: string
  garment_type: string
  price: number
  image_url: string
  short_description: string
  colors?: string[]
  total_stock?: number
}

// Map colour names to swatch fills; unknown names fall back to a neutral chip.
const SWATCH: Record<string, string> = {
  navy: '#1b2a4a', 'navy blue': '#1b2a4a', white: '#f4f4f0', 'heather gray': '#b9bcc2',
  gray: '#9a9ea6', grey: '#9a9ea6', black: '#1c1c1e', red: '#9b2230', cream: '#efe7d2',
  blue: '#2f5fae', charcoal: '#3a3d43', green: '#2f6b40', gold: '#c7a24a',
}

function swatch(color: string): string {
  const key = color.toLowerCase()
  return SWATCH[key] ?? Object.entries(SWATCH).find(([k]) => key.includes(k))?.[1] ?? '#c9ccd2'
}

export default function ProductGridCard({ product }: { product: GridCardProduct }) {
  const stock = product.total_stock
  // Total across all sizes: 0 is sold out; a low total earns a "Low stock" nudge. (Per-size
  // availability is shown precisely on the detail page.)
  const ribbon =
    stock === 0 ? { cls: 'sold', text: 'Sold out' }
    : stock !== undefined && stock <= 15 ? { cls: 'low', text: 'Low stock' }
    : null

  return (
    <Link to={`/products/${product.product_id}`} className="card">
      <div className="card-media">
        <img src={product.image_url} alt={product.product_name} loading="lazy" width={400} height={400} />
        {ribbon && <span className={`card-ribbon card-ribbon-${ribbon.cls}`}>{ribbon.text}</span>}
      </div>
      <div className="card-body">
        <h2>{product.product_name}</h2>
        <p className="card-type">{product.garment_type}</p>
        <p className="card-desc">{product.short_description}</p>
        <div className="card-foot">
          <p className="card-price">${product.price.toFixed(2)}</p>
          {product.colors && product.colors.length > 0 && (
            <span className="card-swatches" aria-label={`Colours: ${product.colors.join(', ')}`}>
              {product.colors.slice(0, 4).map((c) => (
                <span key={c} className="swatch" style={{ background: swatch(c) }} title={c} />
              ))}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
