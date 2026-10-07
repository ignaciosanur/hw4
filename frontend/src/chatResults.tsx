import { createContext, useContext, useState, type ReactNode } from 'react'
import type { ChatProductCard } from './types'

/** Shared state for the "chat updates the page" feature: the products the agent most
 *  recently surfaced, plus the question that produced them. The chat widget writes here;
 *  the Products page reads here and renders them as the storefront grid. */

interface ChatResultsState {
  results: ChatProductCard[]
  query: string
  show: (results: ChatProductCard[], query: string) => void
  clear: () => void
}

const ChatResultsContext = createContext<ChatResultsState | null>(null)

export function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ChatProductCard[]>([])
  const [query, setQuery] = useState('')

  const show = (r: ChatProductCard[], q: string) => {
    setResults(r)
    setQuery(q)
  }
  const clear = () => {
    setResults([])
    setQuery('')
  }

  return (
    <ChatResultsContext.Provider value={{ results, query, show, clear }}>
      {children}
    </ChatResultsContext.Provider>
  )
}

export function useChatResults(): ChatResultsState {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used within ChatResultsProvider')
  return ctx
}
