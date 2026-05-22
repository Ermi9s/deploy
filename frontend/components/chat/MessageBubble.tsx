'use client'

import { useRef, useEffect } from 'react'
import type { ChatMessage, ChatSource } from '@/types/chat'
import { SourceChip } from './SourceChip'
import { Bot, User } from 'lucide-react'

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
          border border-slate-200/80 bg-white
          px-4 py-3 shadow-sm
          transition-shadow group-hover:shadow-md
        ">
          {/* Content — preserves whitespace / newlines from the LLM */}
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
            {message.content || (isStreaming ? '' : '—')}
            {isStreaming && <StreamingCursor />}
          </p>
        </div>

        {/* Source chips */}
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            <span className="w-full text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
              Sources
            </span>
            {message.sources.map((src, i) => (
              <SourceChip
                key={src.chunk_id}
                source={src}
                index={i + 1}
                onClick={onSourceClick}
              />
            ))}
          </div>
        )}

        {/* Timestamp */}
        {!isStreaming && (
          <p className="pl-1 text-[10px] text-slate-400">
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
