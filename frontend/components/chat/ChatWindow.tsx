'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Plus, Wifi, WifiOff, Loader2, MessageSquare, Trash2, Menu, X } from 'lucide-react'
import { useChatWebSocket } from '@/hooks/useChatWebSocket'
import { MessageBubble } from './MessageBubble'
import { DocumentPreviewModal } from './DocumentPreviewModal'
import type { ChatSource } from '@/types/chat'
import { Button } from '@/components/ui/button'

/** Welcome screen shown before the first message */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center select-none py-10">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-200">
        <MessageSquare className="h-8 w-8 text-white" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-slate-800">OKM Knowledge Assistant</h2>
        <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
          Ask anything about your organisation's documents. Responses are permission-filtered to your clearance level.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {[
          'What is the leave policy?',
          'Summarise the Q1 report',
          'What are the IT security guidelines?',
        ].map((suggestion) => (
          <span
            key={suggestion}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700 font-medium"
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Connection status dot in the header */
function ConnectionBadge({ isConnected }: { isConnected: boolean }) {
  const colorCls = isConnected
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-amber-50 text-amber-700 border-amber-200'

  return (
    <span
      title={isConnected ? 'Connected' : 'Disconnected — reconnecting…'}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all duration-300 ${colorCls}`}
    >
      {isConnected
        ? <Wifi className="h-3 w-3 animate-pulse" />
        : <WifiOff className="h-3 w-3" />}
      {isConnected ? 'Live' : 'Reconnecting'}
    </span>
  )
}

export function ChatWindow() {
  const {
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
  } = useChatWebSocket()

  const [inputValue, setInputValue] = useState('')
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [inputValue])

  const handleSend = useCallback(() => {
    const q = inputValue.trim()
    if (!q || isStreaming || !isConnected) return
    sendQuery(q)
    setInputValue('')
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [inputValue, isStreaming, isConnected, sendQuery])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <div className="flex h-[calc(100vh-7rem)] rounded-2xl overflow-hidden border border-slate-200/70 shadow-sm bg-white relative">

        {/* ── Desktop Sidebar ────────────────────────────────────── */}
        <div className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-300 select-none">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversations</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewSession}
              disabled={isStreaming}
              title="Start a new conversation"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Sidebar Chat List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isSessionsLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-9 w-full bg-slate-800/60 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              sessions.map((session) => {
                const active = session.id === currentSessionId
                return (
                  <div
                    key={session.id}
                    className={`group flex items-center justify-between p-2.5 rounded-lg text-sm transition cursor-pointer ${active
                        ? 'bg-indigo-600 text-white font-medium shadow-md'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    onClick={() => switchSession(session.id)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                      <span className="truncate pr-2">{session.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(session.id)
                      }}
                      disabled={isStreaming}
                      className={`shrink-0 opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer disabled:cursor-not-allowed`}
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-slate-950/40">
            <span>Connection</span>
            <ConnectionBadge isConnected={isConnected} />
          </div>
        </div>

        {/* ── Mobile Sidebar Drawer ──────────────────────────────── */}
        {mobileSidebarOpen && (
          <div className="absolute inset-0 z-40 flex md:hidden bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-64 bg-slate-900 h-full flex flex-col text-slate-300 animate-in slide-in-from-left duration-300">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversations</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={startNewSession}
                    disabled={isStreaming}
                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {isSessionsLoading ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-9 w-full bg-slate-800/60 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  sessions.map((session) => {
                    const active = session.id === currentSessionId
                    return (
                      <div
                        key={session.id}
                        className={`group flex items-center justify-between p-2.5 rounded-lg text-sm cursor-pointer ${active
                            ? 'bg-indigo-600 text-white font-medium shadow-md'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                        onClick={() => {
                          switchSession(session.id)
                          setMobileSidebarOpen(false)
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                          <span className="truncate pr-2">{session.title}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSession(session.id)
                          }}
                          disabled={isStreaming}
                          className="shrink-0 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-slate-950/40">
                <span>Connection</span>
                <ConnectionBadge isConnected={isConnected} />
              </div>
            </div>
            {/* Click-out target to close */}
            <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
          </div>
        )}

        {/* ── Main Chat Pane ─────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 h-full bg-white">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/60 active:scale-95 transition cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-800 leading-tight truncate">
                  {sessions.find((s) => s.id === currentSessionId)?.title || 'Knowledge Assistant'}
                </h1>
                <p className="text-[10px] text-slate-400">Permission-filtered RAG · Live Streaming</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="md:hidden">
                <ConnectionBadge isConnected={isConnected} />
              </div>
              <Button
                id="chat-new-session"
                variant="ghost"
                size="sm"
                onClick={startNewSession}
                disabled={isStreaming}
                title="Start a new conversation"
                className="text-xs text-slate-500 gap-1.5 hover:text-slate-800 cursor-pointer hidden md:flex"
              >
                <Plus className="h-3.5 w-3.5" />
                New chat
              </Button>
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 scroll-smooth">
            {isMessagesLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 select-none">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <span className="text-xs font-medium">Loading history…</span>
              </div>
            ) : messages.length === 0 ? (
              <EmptyState />
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onSourceClick={setSelectedSource}
                />
              ))
            )}

            {/* Streaming typing indicator — shown while waiting for first token */}
            {isStreaming && messages[messages.length - 1]?.content === '' && (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                <span className="text-xs">Thinking…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition">
              <textarea
                ref={textareaRef}
                id="chat-input"
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isConnected
                    ? 'Ask a question… (Enter to send, Shift+Enter for newline)'
                    : 'Connecting to knowledge assistant…'
                }
                disabled={!isConnected || isStreaming}
                className="
                  flex-1 resize-none bg-transparent text-sm text-slate-800
                  placeholder:text-slate-400 focus:outline-none
                  disabled:opacity-50 leading-relaxed
                  max-h-40 overflow-y-auto
                "
              />
              <button
                id="chat-send-btn"
                onClick={handleSend}
                disabled={!inputValue.trim() || !isConnected || isStreaming}
                className="
                  flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                  bg-indigo-600 text-white shadow-sm
                  hover:bg-indigo-700 active:scale-95
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                  transition-all duration-150 cursor-pointer
                "
                title="Send (Enter)"
              >
                {isStreaming
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400 select-none">
              Responses are grounded in documents you are authorised to access.
            </p>
          </div>

        </div>
      </div>

      {/* Document preview modal */}
      <DocumentPreviewModal
        source={selectedSource}
        onClose={() => setSelectedSource(null)}
      />
    </>
  )
}
