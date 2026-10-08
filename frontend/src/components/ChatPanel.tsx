import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useChatResults } from '../chatResults'
import Markdown from './Markdown'
import { clearChatHistory, fetchChatHistory, sendChatMessage } from '../api'
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
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { show } = useChatResults()

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, sending])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Customer memory: when signed in, reload this shopper's saved conversation; when signed
  // out, drop back to a fresh guest greeting (guest chat is never persisted).
  useEffect(() => {
    const token = localStorage.getItem('cc.session')
    if (!user || !token) {
      setTurns([GREETING])
      return
    }
    fetchChatHistory(token)
      .then((msgs) => {
        const past: Turn[] = msgs.map((m) => ({ role: m.role, text: m.content }))
        setTurns(past.length ? [{ ...GREETING, text: `Welcome back, ${user.first_name}! Here's where we left off.` }, ...past] : [GREETING])
      })
      .catch(() => setTurns([GREETING]))
  }, [user])

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
      const match = location.pathname.match(/^\/products\/(.+)$/)
      const pageContext = match ? { product_id: match[1], path: location.pathname } : { path: location.pathname }
      const reply: ChatReply = await sendChatMessage(message, history, token, pageContext)
      setTurns((t) => [...t, { role: 'assistant', text: reply.reply, products: reply.products }])
      // Chat updates the page: surface the matches on the storefront grid and take the
      // shopper there, so the website itself shows what they asked about.
      if (reply.products.length > 0) {
        show(reply.products, message)
        navigate('/products')
      }
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
          <span className="chat-crest" aria-hidden="true">CC</span>
          <div className="chat-head-text">
            <strong>Campus Customs assistant</strong>
            <span className="chat-status"><span className="chat-dot" aria-hidden="true" />Online · here to help</span>
          </div>
          <div className="chat-head-actions">
            {user && (
              <button
                className="chat-forget"
                onClick={async () => {
                  const token = localStorage.getItem('cc.session')
                  if (token) await clearChatHistory(token).catch(() => {})
                  setTurns([GREETING])
                }}
                title="Delete your saved chat history"
              >
                Forget my chat
              </button>
            )}
            <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>
        </header>

        <div className="chat-body" ref={bodyRef}>
          {turns.map((t, i) => (
            <div key={i} className={`bubble-row bubble-row-${t.role}`}>
              <div className={`bubble bubble-${t.role}`}>
                {t.role === 'assistant' ? <Markdown text={t.text} /> : t.text}
              </div>
              {t.products && t.products.length > 0 && (
                <Link to="/products" className="chat-onpage" onClick={() => setOpen(false)}>
                  🛍️ {t.products.length} {t.products.length === 1 ? 'item' : 'items'} shown on the page →
                </Link>
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
