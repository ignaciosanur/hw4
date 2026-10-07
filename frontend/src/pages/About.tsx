import './About.css'

/* Original copy. Facts sourced from yalebulldogblue.com (licensing, the 57 Broadway
   storefront, the breadth of college/athletics/graduate ranges); phrasing is ours. */

export default function About() {
  return (
    <div className="wrap page about">
      <h1>About Campus Customs</h1>
      <p className="lede">
        We are the shop on Broadway that puts Yale on things. Officially licensed, locally
        run, and far more interested in whether a sweatshirt lasts than in whether it trends.
      </p>

      <section>
        <h2>What we actually do</h2>
        <p>
          Campus Customs sells officially licensed Yale apparel: hooded sweatshirts, crewnecks,
          quarter-zips, tees, and jackets, cut for students who wear them every day and for
          families who want something that will still look right at reunions. Licensing is not
          a detail we gloss over. It is the difference between a crest and an approximation.
        </p>
      </section>

      <section>
        <h2>Where to find us</h2>
        <p>
          Our storefront is at <strong>57 Broadway, New Haven, Connecticut 06511</strong>, a
          short walk from most of campus. If you are nearby, come in and try things on. Sizing
          on a screen is guesswork; sizing in a mirror is not.
        </p>
      </section>

      <section>
        <h2>Who we dress</h2>
        <p>
          Undergraduates buying their first hoodie during move-in week. Parents who came for a
          campus tour and left with three. Graduate and professional students who want their own
          school on the chest, not just the University. Alumni ordering from four time zones
          away. Athletics supporters who need the right programme, not a generic one.
        </p>
        <p>
          That breadth is why the catalogue runs deep across the fourteen residential colleges,
          the varsity programmes, and the graduate and professional schools, rather than
          offering one hoodie and calling it a day.
        </p>
      </section>

      <section>
        <h2>About the assistant</h2>
        <p>
          The chat window in the corner is a shop assistant, not a salesperson. It reads the
          same catalogue and the same stock numbers we do, which means it will tell you when
          something is out in your size instead of steering you toward a maybe. If it does not
          know, it says so.
        </p>
      </section>

      <p className="footnote">
        Campus Customs is an independent retailer of officially licensed Yale University
        merchandise. This site was built as coursework for Yale SOM&nbsp;&ldquo;AI for Managers&rdquo;.
      </p>
    </div>
  )
}
