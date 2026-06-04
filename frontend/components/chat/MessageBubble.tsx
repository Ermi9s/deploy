'use client'

import type { ChatMessage, ChatSource } from '@/types/chat'
import { SourceChip } from './SourceChip'
import { Bot, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MessageBubbleProps {
  message: ChatMessage
  onSourceClick: (source: ChatSource) => void
}

/** Blinking cursor shown while a message is still streaming. */
function StreamingCursor() {
  return (
    <span className="inline-block w-[2px] h-[1em] bg-indigo-500 ml-0.5 align-middle animate-pulse rounded-full" />
  )
}

/**
 * Renders markdown from the LLM with GitHub-Flavoured Markdown support
 * (tables, strikethrough, task lists, etc.).
 */
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // ── Block elements ─────────────────────────────────────────────────
        h1: ({ children }) => (
          <h1 className="text-base font-semibold text-foreground mt-3 mb-1 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-semibold text-foreground mt-3 mb-1 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-foreground mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="my-1 leading-relaxed text-foreground">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="my-1.5 pl-5 space-y-0.5 list-disc marker:text-muted-foreground">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-1.5 pl-5 space-y-0.5 list-decimal marker:text-muted-foreground">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-foreground">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-indigo-400 pl-3 my-2 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-border my-3" />,

        // ── Inline elements ────────────────────────────────────────────────
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-muted-foreground">{children}</em>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-500 dark:text-indigo-400 hover:underline"
          >
            {children}
          </a>
        ),

        // ── Code ───────────────────────────────────────────────────────────
        code: ({ className, children, ...props }) => {
          // Fenced code blocks have a `language-*` class; inline code does not
          const isBlock = Boolean(className)
          if (isBlock) {
            return (
              <code className="text-foreground font-mono text-xs" {...props}>
                {children}
              </code>
            )
          }
          return (
            <code
              className="bg-muted text-indigo-500 dark:text-indigo-400 px-1 py-0.5 rounded text-xs font-mono"
              {...props}
            >
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="bg-muted border border-border rounded-xl p-3 overflow-x-auto my-2 text-xs font-mono">
            {children}
          </pre>
        ),

        // ── Tables (GFM) ───────────────────────────────────────────────────
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted border-b border-border">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-border">{children}</tbody>
        ),
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-1.5 text-left text-xs font-semibold text-foreground">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-1.5 text-xs text-muted-foreground">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export function MessageBubble({ message, onSourceClick }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isStreaming = message.isStreaming ?? false

  if (isUser) {
    return (
      <div className="flex items-end justify-end gap-2 group">
        <div className="
          max-w-[78%] rounded-2xl rounded-br-sm
          bg-indigo-600 px-4 py-3
          text-sm text-white leading-relaxed shadow-md
          transition-shadow group-hover:shadow-lg
        ">
          {message.content}
        </div>
        <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 shadow-sm">
          <User className="h-3.5 w-3.5" />
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex items-start gap-2 group">
      {/* Avatar */}
      <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm mt-0.5">
        <Bot className="h-3.5 w-3.5" />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {/* Message card */}
        <div className="
          inline-block max-w-full rounded-2xl rounded-tl-sm
          border border-border bg-card
          px-4 py-3 shadow-sm
          transition-shadow group-hover:shadow-md
        ">
          {/* Markdown-rendered content */}
          <div className="text-sm break-words">
            <MarkdownContent content={message.content || (isStreaming ? '\u200b' : '—')} />
            {isStreaming && <StreamingCursor />}
          </div>
        </div>

        {/* Source chips — deduplicated by filename so the same file never
            appears twice even when multiple chunks were retrieved from it. */}
        {message.sources && message.sources.length > 0 && (() => {
          const seen = new Set<string>()
          const uniqueSources = message.sources.filter((src) => {
            // Use filename as primary dedup key (visible to the user).
            // Fall back to document_id then chunk_id for robustness.
            const key = src.filename || src.document_id || src.chunk_id
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          return (
            <div className="flex flex-wrap gap-1.5 pl-1">
              <span className="w-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Sources
              </span>
              {uniqueSources.map((src, i) => (
                <SourceChip
                  key={src.filename || src.chunk_id || src.document_id}
                  source={src}
                  index={i + 1}
                  onClick={onSourceClick}
                />
              ))}
            </div>
          )
        })()}

        {/* Timestamp */}
        {!isStreaming && (
          <p className="pl-1 text-[10px] text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  )
}
