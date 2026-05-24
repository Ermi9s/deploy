'use client'

import { useEffect, useRef, useState } from 'react'
import { api, DriveItem, IngestionStatusSnapshot } from '@/lib/api'

function isTerminalIngestionStatus(status?: string): boolean {
  if (!status) return false
  const normalized = status.toLowerCase()
  return normalized === 'completed' || normalized === 'failed'
}

/**
 * Manages WebSocket connections for real-time ingestion status tracking.
 *
 * - Opens a WS connection for each file item that has a sourceDocumentId.
 * - Polls the HTTP status endpoint first; only opens the socket if the document
 *   is still in-progress.
 * - Automatically closes sockets that reach a terminal state or when the
 *   corresponding item is no longer in the view.
 */
export function useIngestionTracking(
  items: DriveItem[],
  selectedItem: DriveItem | null,
): Record<string, IngestionStatusSnapshot> {
  const socketsRef = useRef<Record<string, WebSocket>>({})
  const [ingestionByDocumentId, setIngestionByDocumentId] = useState<
    Record<string, IngestionStatusSnapshot>
  >({})

  useEffect(() => {
    const closeSocket = (documentId: string) => {
      const socket = socketsRef.current[documentId]
      if (!socket) return
      socket.close()
      delete socketsRef.current[documentId]
    }

    const trackDocument = async (documentId: string) => {
      try {
        const snapshot = await api.getIngestionStatus(documentId)
        setIngestionByDocumentId((prev) => ({ ...prev, [documentId]: snapshot }))
        if (isTerminalIngestionStatus(snapshot.status)) {
          closeSocket(documentId)
          return
        }
      } catch {
        // Keep UI resilient when ingestion service is temporarily unreachable.
      }

      if (socketsRef.current[documentId]) return

      const wsUrl = api.getIngestionWsUrl(documentId)
      if (!wsUrl) return

      const socket = new WebSocket(wsUrl)
      socketsRef.current[documentId] = socket

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as IngestionStatusSnapshot
          setIngestionByDocumentId((prev) => ({ ...prev, [documentId]: data }))
          if (isTerminalIngestionStatus(data.status)) {
            closeSocket(documentId)
          }
        } catch {
          // Ignore malformed payloads.
        }
      }

      socket.onclose = () => {
        delete socketsRef.current[documentId]
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    // Collect all document IDs currently visible
    const documentIds = new Set<string>()
    for (const item of items) {
      if (item.type === 'file' && item.sourceDocumentId) {
        documentIds.add(item.sourceDocumentId)
      }
    }
    if (selectedItem?.type === 'file' && selectedItem.sourceDocumentId) {
      documentIds.add(selectedItem.sourceDocumentId)
    }

    for (const documentId of documentIds) {
      void trackDocument(documentId)
    }

    // Close sockets for documents no longer in view
    for (const existingId of Object.keys(socketsRef.current)) {
      if (!documentIds.has(existingId)) {
        closeSocket(existingId)
      }
    }
  }, [items, selectedItem])

  // Clean up all sockets on unmount
  useEffect(() => {
    return () => {
      for (const id of Object.keys(socketsRef.current)) {
        socketsRef.current[id]?.close()
        delete socketsRef.current[id]
      }
    }
  }, [])

  return ingestionByDocumentId
}
