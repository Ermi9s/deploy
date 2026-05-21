'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { api, getStoredTokens } from '@/lib/api'
import type { ChatMessage, ChatSource, WsServerFrame, ChatSession } from '@/types/chat'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface UseChatWebSocket {
  messages: ChatMessage[]
  isConnected: boolean
  isStreaming: boolean
  isSessionsLoading: boolean
  isMessagesLoading: boolean
  sessions: ChatSession[]
  currentSessionId: string
  sendQuery: (question: string) => void
  startNewSession: () => void
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  clearHistory: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1500

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useChatWebSocket(): UseChatWebSocket {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  
  const [isSessionsLoading, setIsSessionsLoading] = useState(true)
  const [isMessagesLoading, setIsMessagesLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef<number>(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

  // Track the active session ref so async callbacks (e.g. WebSocket onmessage)
  // always refer to the latest selection.
  const currentSessionIdRef = useRef<string>('')
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // -------------------------------------------------------------------------
  // Connect WebSocket
  // -------------------------------------------------------------------------
  const connect = useCallback(() => {
    const token = getStoredTokens()?.access
    if (!token) {
      console.warn('[Chat] No JWT available — cannot connect to RAG WebSocket.')
      return
    }

    const url = api.getChatWsUrl()

    // Pass JWT via Sec-WebSocket-Protocol header (browser workaround)
    const ws = new WebSocket(url, ['access_token', token])
    wsRef.current = ws

    ws.onopen = () => {
      if (!isMountedRef.current) return
      retryCountRef.current = 0
      setIsConnected(true)
    }

    ws.onclose = (event) => {
      if (!isMountedRef.current) return
      setIsConnected(false)
      setIsStreaming(false)

      // 4001 = auth failure — don't retry
      if (event.code === 4001) {
        console.error('[Chat] WebSocket closed: authentication failed.')
        return
      }

      // Exponential back-off reconnect
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * 2 ** retryCountRef.current
        retryCountRef.current += 1
        console.info(`[Chat] Reconnecting in ${delay}ms (attempt ${retryCountRef.current})…`)
        retryTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) connect()
        }, delay)
      } else {
        console.warn('[Chat] Max WebSocket reconnection attempts reached.')
      }
    }

    ws.onerror = (err) => {
      console.error('[Chat] WebSocket error', err)
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      if (!isMountedRef.current) return
      let frame: WsServerFrame
      try {
        frame = JSON.parse(event.data) as WsServerFrame
      } catch {
        console.warn('[Chat] Received non-JSON WS message', event.data)
        return
      }
      handleFrame(frame)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Load initial session list on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    isMountedRef.current = true

    async function initChat() {
      try {
        setIsSessionsLoading(true)
        const res = await api.chat.listSessions()
        const fetchedSessions = res.results.map((s) => ({
          id: s.id,
          title: s.title,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }))

        setSessions(fetchedSessions)

        if (fetchedSessions.length > 0) {
          const firstSessionId = fetchedSessions[0].id
          setCurrentSessionId(firstSessionId)
          await loadMessages(firstSessionId)
        } else {
          // Create the first session if none exists
          const newSession = await api.chat.createSession()
          const created: ChatSession = {
            id: newSession.id,
            title: newSession.title,
            createdAt: newSession.created_at,
            updatedAt: newSession.updated_at,
          }
          setSessions([created])
          setCurrentSessionId(created.id)
          setMessages([])
        }
      } catch (err) {
        console.error('[Chat] Failed to load chat sessions:', err)
      } finally {
        setIsSessionsLoading(false)
      }
    }

    initChat()
    connect()

    return () => {
      isMountedRef.current = false
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  // -------------------------------------------------------------------------
  // Load messages for a session
  // -------------------------------------------------------------------------
  const loadMessages = async (sessionId: string) => {
    try {
      setIsMessagesLoading(true)
      const list = await api.chat.listMessages(sessionId)
      const mapped = list.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        sources: msg.sources as ChatSource[],
        createdAt: msg.created_at,
      }))
      setMessages(mapped)
    } catch (err) {
      console.error(`[Chat] Failed to load messages for session ${sessionId}:`, err)
      setMessages([])
    } finally {
      setIsMessagesLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // WebSocket Frame handler
  // -------------------------------------------------------------------------
  const handleFrame = useCallback((frame: WsServerFrame) => {
    switch (frame.type) {
      case 'token':
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant' && last.isStreaming) {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + frame.content,
            }
          }
          return updated
        })
        break

      case 'sources':
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              sources: frame.sources,
            }
          }
          return updated
        })
        break

      case 'session_title':
        // Dynamically update the session's title in the sidebar list when generated
        setSessions((prev) =>
          prev.map((s) => (s.id === frame.session_id ? { ...s, title: frame.title } : s))
        )
        // If it's the currently active session, update the document title too
        break

      case 'done':
        setIsStreaming(false)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, isStreaming: false }
          }
          return updated
        })
        break

      case 'error':
        setIsStreaming(false)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant' && last.isStreaming) {
            updated[updated.length - 1] = {
              ...last,
              isStreaming: false,
              content: last.content || `⚠️ ${frame.message}`,
            }
          } else {
            updated.push({
              id: uuidv4(),
              role: 'assistant',
              content: `⚠️ ${frame.message}`,
              isStreaming: false,
              createdAt: new Date().toISOString(),
            })
          }
          return updated
        })
        break
    }
  }, [])

  // -------------------------------------------------------------------------
  // Public Actions
  // -------------------------------------------------------------------------
  const sendQuery = useCallback((question: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[Chat] WebSocket not open — cannot send query.')
      return
    }

    const trimmed = question.trim()
    if (!trimmed) return

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }

    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      isStreaming: true,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setIsStreaming(true)

    ws.send(
      JSON.stringify({
        type: 'query',
        question: trimmed,
        session_id: currentSessionIdRef.current,
      })
    )
  }, [])

  const startNewSession = useCallback(async () => {
    if (isStreaming) return

    try {
      setIsMessagesLoading(true)
      const newSession = await api.chat.createSession()
      const created: ChatSession = {
        id: newSession.id,
        title: newSession.title,
        createdAt: newSession.created_at,
        updatedAt: newSession.updated_at,
      }

      setSessions((prev) => [created, ...prev])
      setCurrentSessionId(created.id)
      setMessages([])
    } catch (err) {
      console.error('[Chat] Failed to create new session:', err)
    } finally {
      setIsMessagesLoading(false)
    }
  }, [isStreaming])

  const switchSession = useCallback((id: string) => {
    if (isStreaming || id === currentSessionId) return
    setCurrentSessionId(id)
    loadMessages(id)
  }, [currentSessionId, isStreaming])

  const deleteSession = useCallback(async (id: string) => {
    if (isStreaming) return

    try {
      await api.chat.deleteSession(id)
      
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id)
        
        // Handle switching away if deleting the active session
        if (id === currentSessionIdRef.current) {
          if (filtered.length > 0) {
            const nextActiveId = filtered[0].id
            setTimeout(() => {
              setCurrentSessionId(nextActiveId)
              loadMessages(nextActiveId)
            }, 0)
          } else {
            // Auto-create a fallback session if list is empty
            api.chat.createSession().then((newSession) => {
              const fallback: ChatSession = {
                id: newSession.id,
                title: newSession.title,
                createdAt: newSession.created_at,
                updatedAt: newSession.updated_at,
              }
              setSessions([fallback])
              setCurrentSessionId(fallback.id)
              setMessages([])
            })
          }
        }
        return filtered
      })
    } catch (err) {
      console.error(`[Chat] Failed to delete session ${id}:`, err)
    }
  }, [isStreaming])

  const clearHistory = useCallback(async () => {
    if (isStreaming) return
    // Delete all sessions in bulk (best-effort soft delete)
    try {
      await Promise.all(sessions.map((s) => api.chat.deleteSession(s.id)))
      const newSession = await api.chat.createSession()
      const fallback: ChatSession = {
        id: newSession.id,
        title: newSession.title,
        createdAt: newSession.created_at,
        updatedAt: newSession.updated_at,
      }
      setSessions([fallback])
      setCurrentSessionId(fallback.id)
      setMessages([])
    } catch (err) {
      console.error('[Chat] Failed to clear history:', err)
    }
  }, [sessions, isStreaming])

  return {
    messages,
    isConnected,
    isStreaming,
    isSessionsLoading,
    isMessagesLoading,
    sessions,
    currentSessionId,
    sendQuery,
    startNewSession,
    switchSession,
    deleteSession,
    clearHistory,
  }
}
