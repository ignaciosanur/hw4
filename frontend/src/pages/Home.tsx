import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts } from '../api'
import { useReveal } from '../useReveal'
import type { ProductSummary } from '../types'
import './Home.css'

/* Copy is original. Facts (officially licensed by Campus Customs, the 57 Broadway storefront,
   the residential-college / athletics / graduate ranges) come from yalebulldogblue.com;
   the design takes collegiate-store cues (announcement strip, shop-by-category tiles,
   editorial pacing) from references like The Harvard Shop, rendered in the Yale palette. */

const PILLARS = [
  { k: 'Licensed, not look-alike', v: 'Every piece is officially licensed Yale merchandise — the real crest, printed and stitched to the University’s standard.' },
  { k: 'A shop on Broadway', v: 'We have sold Yale gear from 57 Broadway in New Haven for years. The website carries the same racks.' },
  { k: 'Built for the whole campus', v: 'Fourteen residential colleges, twenty-plus varsity programmes, a dozen graduate schools — your corner of Yale is here.' },
]

export default function Home() {
  const [byCategory, setByCategory] = useState<{ category: string; from: number; image: string }[]>([])
  const pillarsRef = useReveal<HTMLDivElement>()
  const catRef = useReveal<HTMLDivElement>()
  const stripRef = useReveal<HTMLDivElement>()

  // Build "shop by category" tiles from the live catalogue: one representative image and the
  // starting price per L1 category, ordered by price.
  useEffect(() => {
    fetchProducts()
      .then((items: ProductSummary[]) => {
        const map = new Map<string, { from: number; image: string }>()
        for (const p of items) {
          const cur = map.get(p.category)
          if (!cur || p.price < cur.from) map.set(p.category, { from: p.price, image: p.image_url })
        }
        setByCategory([...map.entries()]
          .map(([category, v]) => ({ category, ...v }))
          .sort((a, b) => a.from - b.from))
      })
      .catch(() => setByCategory([]))
  }, [])

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-motif" aria-hidden="true">Y</div>
        <div className="wrap hero-inner">
          <p className="eyebrow"><span className="eyebrow-mark">✦</span> Officially licensed · New Haven</p>
          <h1>Yale gear<br />worth keeping.</h1>
          <p className="lede">
            Campus Customs has dressed students, parents, alumni and the occasional visiting rival
            since long before anyone put a shop online. Sweatshirts that survive four winters; tees
            you still reach for a decade after graduation.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary">Shop the catalogue</Link>
            <Link to="/about" className="btn btn-ghost">About the shop</Link>
          </div>
        </div>
      </section>

      <section className="wrap page">
        <div className="section-head">
          <h2>Shop by category</h2>
          <Link to="/products" className="section-link">View all →</Link>
        </div>
        <div className="cat-tiles reveal" ref={catRef}>
          {byCategory.map((c) => (
            <Link key={c.category} to={`/products?category=${encodeURIComponent(c.category)}`} className="cat-tile">
              <div className="cat-tile-media"><img src={c.image} alt={c.category} loading="lazy" /></div>
              <div className="cat-tile-body">
                <span className="cat-tile-name">{c.category}</span>
                <span className="cat-tile-from">from ${c.from.toFixed(0)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="pillars reveal" ref={pillarsRef}>
          {PILLARS.map((p, i) => (
            <article key={p.k} className={`pillar reveal-${i + 1}`}>
              <span className="pillar-rule" aria-hidden="true" />
              <h3>{p.k}</h3>
              <p>{p.v}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="strip">
        <div className="wrap strip-inner reveal" ref={stripRef}>
          <div>
            <h2>Not sure what you’re after?</h2>
            <p>Ask the assistant in the corner — tell it who you’re shopping for and the weather,
              and it’ll point you at something sensible, in stock, in your size.</p>
          </div>
          <Link to="/products" className="btn btn-primary">Browse everything</Link>
        </div>
      </section>
    </div>
  )
}
