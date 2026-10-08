import './AnnouncementBar.css'

/** Thin trust/announcement strip above the nav — a collegiate-store convention (seen on
 *  The Harvard Shop): official licensing, local pickup, and heritage, stated up front. */
const MESSAGES = [
  'Officially licensed Yale apparel',
  'Free in-store pickup · 57 Broadway, New Haven',
  'Outfitting the Bulldogs since the start',
]

export default function AnnouncementBar() {
  return (
    <div className="announce" role="note">
      <div className="wrap announce-inner">
        {MESSAGES.map((m, i) => (
          <span key={m} className="announce-item">
            {i > 0 && <span className="announce-dot" aria-hidden="true">✦</span>}
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}
