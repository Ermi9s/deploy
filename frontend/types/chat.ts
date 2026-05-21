/**
 * TypeScript interfaces for the real-time RAG chat feature.
 *
 * WebSocket message protocol (server → client):
 *   {"type": "token",   "content": "word "}
 *   {"type": "sources", "sources": [...]}
 *   {"type": "done"}
 *   {"type": "error",   "message": "..."}
 *
 * WebSocket message protocol (client → server):
 *   {"type": "query", "question": "...", "session_id": "uuid"}
 */

export interface ChatSource {
  /** UUID of the source document in the drive */
  document_id: string
  /** Elasticsearch chunk identifier */
  chunk_id: string
  /** Original filename for display */
  filename: string
  /** Relevance score from vector search (0–1) */
  score: number
}

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  /** Locally unique message id (nanoid/uuid) */
  id: string
  role: MessageRole
  /** Full text — grows incrementally while isStreaming is true */
  content: string
  /** True while tokens are still arriving from the server */
  isStreaming?: boolean
  /** Source citations — populated after the "sources" WS frame */
  sources?: ChatSource[]
  /** ISO timestamp when the message was created */
  createdAt: string
}

// ---------------------------------------------------------------------------
// WebSocket frame types (server → client)
// ---------------------------------------------------------------------------
export type WsTokenFrame        = { type: 'token';   content: string }
export type WsSourcesFrame      = { type: 'sources'; sources: ChatSource[] }
export type WsSessionTitleFrame = { type: 'session_title'; session_id: string; title: string }
export type WsDoneFrame         = { type: 'done' }
export type WsErrorFrame        = { type: 'error';   message: string }

export type WsServerFrame =
  | WsTokenFrame
  | WsSourcesFrame
  | WsSessionTitleFrame
  | WsDoneFrame
  | WsErrorFrame

// ---------------------------------------------------------------------------
// WebSocket frame types (client → server)
// ---------------------------------------------------------------------------
export interface WsQueryFrame {
  type: 'query'
  question: string
  session_id: string
}

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt?: string
}

export interface PaginatedSessions {
  count: number
  next: string | null
  previous: string | null
  results: ChatSession[]
}
