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
      <div className="flex h-full min-h-[500px] rounded-3xl overflow-hidden border border-border shadow-sm bg-card relative">

        {/* ── Desktop Sidebar ────────────────────────────────────── */}
        <div className="hidden md:flex flex-col w-72 bg-accent/30 border-r border-border text-foreground select-none">
          {/* Sidebar Header */}
          <div className="p-5 border-b border-border flex items-center justify-between bg-background/50 backdrop-blur-sm">
            <span className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Conversations</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewSession}
              disabled={isStreaming}
              title="Start a new conversation"
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full bg-background/80 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Sidebar Chat List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {isSessionsLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 w-full bg-accent/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              sessions.map((session) => {
                const active = session.id === currentSessionId
                return (
                  <div
                    key={session.id}
                    className={`group flex items-center justify-between p-3 rounded-xl text-sm transition-all cursor-pointer ${active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    onClick={() => switchSession(session.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <MessageSquare className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="truncate pr-2">{session.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(session.id)
                      }}
                      disabled={isStreaming}
                      className={`shrink-0 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-background rounded-md text-muted-foreground hover:text-destructive transition-all cursor-pointer disabled:cursor-not-allowed`}
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
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-background/50">
            <span className="font-medium">Connection</span>
            <ConnectionBadge isConnected={isConnected} />
          </div>
        </div>

        {/* ── Mobile Sidebar Drawer ──────────────────────────────── */}
        {mobileSidebarOpen && (
          <div className="absolute inset-0 z-40 flex md:hidden bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-72 bg-card h-full flex flex-col border-r border-border shadow-xl animate-in slide-in-from-left duration-300">
              <div className="p-5 border-b border-border flex items-center justify-between bg-accent/30">
                <span className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Conversations</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={startNewSession}
                    disabled={isStreaming}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full bg-background"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full bg-background"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {isSessionsLoading ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 w-full bg-accent/50 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  sessions.map((session) => {
                    const active = session.id === currentSessionId
                    return (
                      <div
                        key={session.id}
                        className={`group flex items-center justify-between p-3 rounded-xl text-sm transition-all cursor-pointer ${active
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        onClick={() => {
                          switchSession(session.id)
                          setMobileSidebarOpen(false)
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <MessageSquare className="h-4 w-4 shrink-0 opacity-80" />
                          <span className="truncate pr-2">{session.title}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSession(session.id)
                          }}
                          disabled={isStreaming}
                          className="shrink-0 p-1.5 hover:bg-background rounded-md text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-accent/30">
                <span className="font-medium">Connection</span>
                <ConnectionBadge isConnected={isConnected} />
              </div>
            </div>
            {/* Click-out target to close */}
            <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
          </div>
        )}

        {/* ── Main Chat Pane ─────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 h-full bg-background">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden shrink-0 rounded-full p-2 bg-accent text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-display font-semibold text-foreground leading-tight truncate">
                  {sessions.find((s) => s.id === currentSessionId)?.title || 'Knowledge Assistant'}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">Permission-filtered RAG · Live Streaming</p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="md:hidden">
                <ConnectionBadge isConnected={isConnected} />
              </div>
              <Button
                id="chat-new-session"
                variant="outline"
                size="sm"
                onClick={startNewSession}
                disabled={isStreaming}
                title="Start a new conversation"
                className="text-xs rounded-full gap-2 hidden md:flex bg-background"
              >
                <Plus className="h-3.5 w-3.5" />
                New chat
              </Button>
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scroll-smooth">
            {isMessagesLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground select-none">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium">Loading history…</span>
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
              <div className="flex items-center gap-3 text-muted-foreground ml-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary/70" />
                <span className="text-sm">Thinking…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-border bg-card/50 backdrop-blur-sm px-6 py-4">
            <div className="flex items-end gap-3 rounded-2xl border border-border bg-background px-4 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary shadow-sm transition-all">
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
                  flex-1 resize-none bg-transparent text-sm text-foreground
                  placeholder:text-muted-foreground focus:outline-none
                  disabled:opacity-50 leading-relaxed
                  max-h-40 overflow-y-auto py-1
                "
              />
              <button
                id="chat-send-btn"
                onClick={handleSend}
                disabled={!inputValue.trim() || !isConnected || isStreaming}
                className="
                  flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                  bg-primary text-primary-foreground shadow-md
                  hover:bg-primary/90 active:scale-95
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                  transition-all duration-200 cursor-pointer mb-0.5
                "
                title="Send (Enter)"
              >
                {isStreaming
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Send className="h-4 w-4 ml-0.5" />}
              </button>
            </div>
            <p className="mt-2.5 text-center text-xs text-muted-foreground select-none">
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
