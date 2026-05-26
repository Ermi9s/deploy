'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, getStoredTokens } from '@/lib/api'
import type { PlanningNotification } from '@/lib/api'

export interface UseNotificationSocket {
  notifications: PlanningNotification[]
  unreadCount: number
  isConnected: boolean
  isLoading: boolean
  refresh: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const MAX_RETRIES = 5
const BASE_RETRY_DELAY_MS = 1500

export function useNotificationSocket(): UseNotificationSocket {
  const [notifications, setNotifications] = useState<PlanningNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef<number>(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef<boolean>(true)

  // Fetch initial notifications via HTTP REST fallback/hydration
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await api.planning.listNotifications()
      if (isMountedRef.current) {
        setNotifications(res.results)
        // Count unread locally or rely on server list
        const unread = res.results.filter(n => !n.is_read).length
        setUnreadCount(unread)
      }
    } catch (err) {
      console.error('[Notifications] Failed to load initial notifications:', err)
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  // Establish WebSocket connection
  const connect = useCallback(() => {
    const token = getStoredTokens()?.access
    if (!token) {
      console.warn('[Notifications] No JWT available — skipping WebSocket.')
      setIsLoading(false)
      return
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = api.getNotificationWsUrl()
    if (!url) return

    console.info('[Notifications] Connecting to WebSocket…')
    const ws = new WebSocket(url, ['access_token', token])
    wsRef.current = ws

    ws.onopen = () => {
      if (!isMountedRef.current) return
      console.info('[Notifications] WebSocket connected!')
      setIsConnected(true)
      retryCountRef.current = 0
    }

    ws.onclose = (event) => {
      if (!isMountedRef.current) return
      setIsConnected(false)
      console.warn('[Notifications] WebSocket closed.', event.reason)

      // 4001 = Auth failure, don't auto-reconnect
      if (event.code === 4001) {
        console.error('[Notifications] Authentication failed. Stopping reconnection.')
        return
      }

      // Reconnect with exponential backoff
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * 2 ** retryCountRef.current
        retryCountRef.current += 1
        console.info(`[Notifications] Reconnecting in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})…`)
        retryTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) connect()
        }, delay)
      } else {
        console.warn('[Notifications] Max WebSocket reconnection attempts reached.')
      }
    }

    ws.onerror = (err) => {
      console.error('[Notifications] WebSocket error:', err)
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      if (!isMountedRef.current) return
      try {
        const data = JSON.parse(event.data) as PlanningNotification
        if (data && data.id) {
          console.info('[Notifications] Received push notification:', data)
          setNotifications((prev) => {
            // Deduplicate if already present, otherwise prepended
            const filtered = prev.filter((n) => n.id !== data.id)
            return [data, ...filtered]
          })
          if (!data.is_read) {
            setUnreadCount((c) => c + 1)
          }
        }
      } catch (err) {
        console.warn('[Notifications] Failed to parse WebSocket push message:', err)
      }
    }
  }, [])

  // Setup connection and fetch notifications on mount
  useEffect(() => {
    isMountedRef.current = true

    fetchNotifications()
    connect()

    return () => {
      isMountedRef.current = false
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [fetchNotifications, connect])

  // Individual Mark Read
  const markRead = useCallback(async (id: string) => {
    // Optimistic Update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))

    try {
      await api.planning.markNotificationRead(id)
    } catch (err) {
      console.error(`[Notifications] Failed to mark notification ${id} read:`, err)
      // Rollback on error by re-fetching
      fetchNotifications()
    }
  }, [fetchNotifications])

  // Bulk Mark Read
  const markAllRead = useCallback(async () => {
    // Optimistic Update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)

    try {
      await api.planning.markAllNotificationsRead()
    } catch (err) {
      console.error('[Notifications] Failed to mark all notifications read:', err)
      // Rollback on error
      fetchNotifications()
    }
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    isConnected,
    isLoading,
    refresh: fetchNotifications,
    markRead,
    markAllRead,
  }
}
