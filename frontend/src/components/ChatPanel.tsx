import { useEffect, useRef, useState } from 'react'
import { sendChatMessage } from '../api'
import type { ChatReply } from '../types'
import './ChatPanel.css'

interface Turn {
  role: 'user' | 'assistant'
  text: string
  stub?: boolean
}

const GREETING: Turn = {
  role: 'assistant',
  text: "Hi! I'm the Campus Customs assistant. Ask me about Yale gear — sizes, colours, prices. (I'm not connected to the AI yet; that arrives in Problem 5.)",
}

export default function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([GREETING])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the latest turn in view as the conversation grows.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, sending])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Escape closes the panel, which is what people expect of an overlay.
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

    setTurns((t) => [...t, { role: 'user', text: message }])
    setDraft('')
    setSending(true)
    try {
      const reply: ChatReply = await sendChatMessage(message)
      setTurns((t) => [...t, { role: 'assistant', text: reply.reply, stub: reply.stub }])
    } catch {
      setTurns((t) => [
        ...t,
        { role: 'assistant', text: "I couldn't reach the shop's server. Is the API running on port 8010?" },
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
            <span className="chat-status">Not connected yet</span>
          </div>
          <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
        </header>

        <div className="chat-body" ref={bodyRef}>
          {turns.map((t, i) => (
            <div key={i} className={`bubble bubble-${t.role}`}>
              {t.text}
              {t.stub && <span className="bubble-tag">stub response</span>}
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
