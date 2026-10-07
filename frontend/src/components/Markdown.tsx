import type { ReactNode } from 'react'

/** Minimal, safe renderer for the light markdown the agent produces: **bold**, bullet
 *  lists (- / •), and line breaks. Builds React nodes directly — no dangerouslySetInnerHTML,
 *  so there is no HTML-injection surface. Anything it doesn't recognise renders as plain text. */

function inline(text: string, keyBase: string): ReactNode[] {
  // Split on **bold**; odd segments are the bolded ones.
  return text.split(/\*\*(.+?)\*\*/g).map((seg, i) =>
    i % 2 === 1 ? <strong key={`${keyBase}-b${i}`}>{seg}</strong> : <span key={`${keyBase}-t${i}`}>{seg}</span>,
  )
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let list: string[] = []

  const flushList = () => {
    if (list.length === 0) return
    const items = list
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="md-list">
        {items.map((item, i) => <li key={i}>{inline(item, `li-${blocks.length}-${i}`)}</li>)}
      </ul>,
    )
    list = []
  }

  lines.forEach((raw) => {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    if (bullet) {
      list.push(bullet[1])
    } else if (line.trim() === '') {
      flushList()
    } else {
      flushList()
      blocks.push(<p key={`p-${blocks.length}`} className="md-p">{inline(line, `p-${blocks.length}`)}</p>)
    }
  })
  flushList()

  return <>{blocks}</>
}
