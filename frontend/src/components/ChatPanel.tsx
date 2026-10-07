import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { sendChatMessage } from '../api'
import type { ChatProductCard, ChatReply } from '../types'
import './ChatPanel.css'

interface Turn {
  role: 'user' | 'assistant'
  text: string
  products?: ChatProductCard[]
}

const GREETING: Turn = {
  role: 'assistant',
  text: "Hi! I'm the Campus Customs assistant. Ask me about Yale gear — sizes, colours, prices, what's in stock.",
}

// How many prior turns to send as context. Enough for a coherent thread, bounded for cost.
const HISTORY_LIMIT = 10

export default function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([GREETING])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, sending])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const message = draft.trim()
    if (!message || sending) return

    const history = turns
      .filter((t) => t !== GREETING)
      .slice(-HISTORY_LIMIT)
      .map((t) => ({ role: t.role, content: t.text }))

    setTurns((t) => [...t, { role: 'user', text: message }])
    setDraft('')
    setSending(true)
    try {
      const token = localStorage.getItem('cc.session') ?? undefined
      const reply: ChatReply = await sendChatMessage(message, history, token)
      setTurns((t) => [...t, { role: 'assistant', text: reply.reply, products: reply.products }])
    } catch {
      setTurns((t) => [
        ...t,
        { role: 'assistant', text: "Sorry — I couldn't reach the shop assistant just now. Please try again." },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        className={`chat-fab ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="chat-panel"
      >
        {open ? '✕' : '💬'}
        <span className="visually-hidden">{open ? 'Close chat' : 'Open chat'}</span>
      </button>

      <div id="chat-panel" className={`chat ${open ? 'is-open' : ''}`} role="dialog" aria-label="Campus Customs chat">
        <header className="chat-head">
          <div>
            <strong>Campus Customs assistant</strong>
            <span className="chat-status">Here to help you find Yale gear</span>
          </div>
          <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
        </header>

        <div className="chat-body" ref={bodyRef}>
          {turns.map((t, i) => (
            <div key={i} className={`bubble-row bubble-row-${t.role}`}>
              <div className={`bubble bubble-${t.role}`}>{t.text}</div>
              {t.products && t.products.length > 0 && (
                <ul className="chat-cards">
                  {t.products.map((p) => (
                    <li key={p.product_id}>
                      <Link to={`/products/${p.product_id}`} className="chat-card" onClick={() => setOpen(false)}>
                        <img src={p.image_url} alt={p.product_name} loading="lazy" />
                        <div className="chat-card-info">
                          <span className="chat-card-name">{p.product_name}</span>
                          <span className="chat-card-price">${p.price.toFixed(2)}</span>
                          <span className={`chat-card-stock ${p.total_stock === 0 ? 'oos' : ''}`}>
                            {p.total_stock === 0
                              ? 'Out of stock'
                              : p.sizes_out.length === 0
                                ? 'All sizes in stock'
                                : `In: ${p.sizes_in_stock.join(', ')}`}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {sending && (
            <div className="bubble bubble-assistant typing" aria-live="polite">
              <span /><span /><span />
            </div>
          )}
        </div>

        <form className="chat-form" onSubmit={submit}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about sizes, colours, prices…"
            aria-label="Message"
          />
          <button className="btn btn-primary" disabled={!draft.trim() || sending}>Send</button>
        </form>
      </div>
    </>
  )
}
