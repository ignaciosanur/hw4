import { Link } from 'react-router-dom'
import './Home.css'

/* Copy is original. The underlying facts (officially licensed by Campus Customs,
   storefront at 57 Broadway in New Haven, the residential-college / athletics /
   graduate-school ranges) come from yalebulldogblue.com; the wording does not. */

const PILLARS = [
  {
    title: 'Licensed, not look-alike',
    body: 'Every piece is officially licensed Yale merchandise. The crest on your chest is the real one, printed and stitched to the standard the University holds us to.',
  },
  {
    title: 'A shop on Broadway',
    body: 'We have sold Yale gear from 57 Broadway in New Haven for years. The website carries the same racks you would walk past on your way to class.',
  },
  {
    title: 'Built for the whole campus',
    body: 'Fourteen residential colleges, more than twenty varsity programmes, a dozen graduate and professional schools. Whatever corner of Yale is yours, there is something here with its name on it.',
  },
]

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">New Haven, Connecticut</p>
          <h1>Yale gear worth keeping.</h1>
          <p className="lede">
            Campus Customs has dressed students, parents, alumni and the occasional visiting
            rival since long before anyone thought to put a shop online. Sweatshirts that
            survive four winters, tees you still reach for a decade after graduation.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary">Shop the catalogue</Link>
            <Link to="/about" className="btn btn-ghost">About the shop</Link>
          </div>
        </div>
      </section>

      <section className="wrap page">
        <div className="pillars">
          {PILLARS.map((p) => (
            <article key={p.title} className="pillar">
              <h2>{p.title}</h2>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="strip">
        <div className="wrap strip-inner">
          <div>
            <h2>Not sure what you are after?</h2>
            <p>
              Ask the assistant in the corner. Tell it who you are shopping for and what the
              weather is doing, and it will point you at something sensible.
            </p>
          </div>
          <Link to="/products" className="btn btn-primary">Browse everything</Link>
        </div>
      </section>
    </div>
  )
}
