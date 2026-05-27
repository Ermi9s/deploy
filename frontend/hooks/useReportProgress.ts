'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getStoredTokens } from '@/lib/api'
import { reportApi, type ReportAgenda } from '@/lib/api'

export interface AgendaProgressState {
  agendaId: string
  order: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  message?: string
  subReport?: string
  sources?: ReportAgenda['sources']
}

export interface ReportProgressState {
  percent: number
  message: string
  agendaStatuses: AgendaProgressState[]
  finalReport: string | null
  error: string | null
  isConnected: boolean
  isDone: boolean
}

/**
 * Opens a WebSocket to `ws/report/<jobId>/` and streams progress events.
 * Auto-closes on completion or error.
 *
 * @param jobId     UUID of the ReportJob to watch
 * @param agendas   Initial agenda list (for rendering before WS events arrive)
 * @param enabled   Set to false to skip WS connection (e.g., for completed jobs)
 */
export function useReportProgress(
  jobId: string,
  agendas: { id: string; order: number; text: string }[] = [],
  enabled = true,
): ReportProgressState {
  const wsRef = useRef<WebSocket | null>(null)

  const [state, setState] = useState<ReportProgressState>({
    percent: 0,
    message: 'Initialising…',
    agendaStatuses: agendas.map((a) => ({
      agendaId: a.id,
      order: a.order,
      status: 'pending',
    })),
    finalReport: null,
    error: null,
    isConnected: false,
    isDone: false,
  })

  const updateAgenda = useCallback(
    (agendaId: string, patch: Partial<AgendaProgressState>) => {
      setState((prev) => ({
        ...prev,
        agendaStatuses: prev.agendaStatuses.map((a) =>
          a.agendaId === agendaId ? { ...a, ...patch } : a,
        ),
      }))
    },
    [],
  )

  useEffect(() => {
    if (!enabled || !jobId) return

    const tokens = getStoredTokens()
    if (!tokens?.access) return

    const url = reportApi.getReportWsUrl(jobId)
    const ws = new WebSocket(url, ['access_token', tokens.access])
    wsRef.current = ws

    ws.onopen = () => {
      setState((prev) => ({ ...prev, isConnected: true }))
    }

    ws.onclose = () => {
      setState((prev) => ({ ...prev, isConnected: false }))
    }

    ws.onerror = () => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: 'WebSocket connection failed. Progress updates unavailable.',
      }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as Record<string, unknown>
        const type = data.type as string

        switch (type) {
          case 'progress':
            setState((prev) => ({
              ...prev,
              percent: (data.percent as number) ?? prev.percent,
              message: (data.message as string) ?? prev.message,
            }))
            break

          case 'agenda_progress':
            updateAgenda(data.agenda_id as string, {
              status: 'running',
              message: data.message as string,
            })
            break

          case 'agenda_done':
            updateAgenda(data.agenda_id as string, {
              status: 'completed',
              subReport: data.sub_report as string,
              sources: data.sources as ReportAgenda['sources'],
            })
            setState((prev) => ({
              ...prev,
              percent: (data.percent as number) ?? prev.percent,
            }))
            break

          case 'report_done':
            setState((prev) => ({
              ...prev,
              percent: 100,
              message: 'Report generation complete!',
              finalReport: data.final_report as string,
              isDone: true,
            }))
            ws.close()
            break

          case 'error':
            setState((prev) => ({
              ...prev,
              error: data.message as string,
              isDone: true,
            }))
            ws.close()
            break
        }
      } catch {
        // ignore parse errors
      }
    }

    return () => {
      ws.close()
    }
  }, [jobId, enabled, updateAgenda])

  return state
}
