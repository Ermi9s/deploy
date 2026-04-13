'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import AuthGuard from '@/components/auth/auth-guard'
import DriveLayout from '@/components/drive/drive-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { api, IngestionStatusSnapshot } from '@/lib/api'

function isTerminalStatus(status?: string): boolean {
  if (!status) {
    return false
  }
  const normalized = status.toLowerCase()
  return normalized === 'completed' || normalized === 'failed'
}

function normalizeProgress(progress?: number): number {
  if (typeof progress !== 'number' || Number.isNaN(progress)) {
    return 0
  }
  return Math.max(0, Math.min(100, progress))
}

function formatStage(stage?: string): string {
  if (!stage) {
    return 'pending'
  }
  return stage.replace(/[_-]/g, ' ')
}

export default function IngestionProgressPage() {
  const params = useParams<{ documentId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()

  const documentId = params?.documentId || ''
  const itemId = searchParams.get('itemId')

  const [snapshot, setSnapshot] = useState<IngestionStatusSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isComplete = useMemo(() => isTerminalStatus(snapshot?.status), [snapshot?.status])
  const progress = useMemo(() => normalizeProgress(snapshot?.progress), [snapshot?.progress])

  useEffect(() => {
    if (!documentId) {
      setLoading(false)
      setError('Missing document id.')
      return
    }

    let active = true
    let done = false
    let socket: WebSocket | null = null
    let pollTimer: number | null = null

    const clearPoll = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer)
        pollTimer = null
      }
    }

    const closeSocket = () => {
      if (socket) {
        socket.close()
        socket = null
      }
    }

    const updateSnapshot = (next: IngestionStatusSnapshot) => {
      if (!active) {
        return
      }
      setSnapshot(next)
      setLoading(false)
      setError(null)

      if (isTerminalStatus(next.status)) {
        done = true
        clearPoll()
        closeSocket()
      }
    }

    const fetchStatus = async () => {
      try {
        const status = await api.getIngestionStatus(documentId)
        updateSnapshot(status)
      } catch (err) {
        if (!active) {
          return
        }
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Failed to fetch ingestion status.')
      }
    }

    const connectWebSocket = () => {
      socket = new WebSocket(api.getIngestionWsUrl(documentId))

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as IngestionStatusSnapshot
          updateSnapshot(data)
        } catch {
          // Ignore malformed frames and rely on polling fallback.
        }
      }

      socket.onclose = () => {
        socket = null
      }

      socket.onerror = () => {
        closeSocket()
      }
    }

    void fetchStatus()
    connectWebSocket()

    // Poll as a resilience fallback in case websocket updates are delayed.
    pollTimer = window.setInterval(() => {
      if (!done) {
        void fetchStatus()
      }
    }, 5000)

    return () => {
      active = false
      clearPoll()
      closeSocket()
    }
  }, [documentId])

  return (
    <AuthGuard>
      <DriveLayout>
        <div className="mx-auto max-w-3xl space-y-4">
          <header className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-slate-800">Ingestion Progress</h1>
                <p className="mt-1 text-sm text-slate-500">Track indexing and vectorization for your uploaded file.</p>
              </div>
              <Badge variant="outline" className="text-xs">Document {documentId}</Badge>
            </div>
          </header>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading ingestion status...
              </div>
            ) : error ? (
              <div className="space-y-3">
                <p className="text-sm text-red-600">{error}</p>
                <Button variant="outline" onClick={() => router.refresh()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : snapshot ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {snapshot.status.toLowerCase() === 'completed' ? (
                    <Badge className="bg-emerald-600 text-white">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Completed
                    </Badge>
                  ) : snapshot.status.toLowerCase() === 'failed' ? (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Failed
                    </Badge>
                  ) : (
                    <Badge variant="outline">{snapshot.status}</Badge>
                  )}
                  <Badge variant="outline">Stage: {formatStage(snapshot.stage)}</Badge>
                  {itemId ? <Badge variant="outline">File: {itemId}</Badge> : null}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {snapshot.message ? (
                  <p className="text-sm text-slate-600">{snapshot.message}</p>
                ) : null}

                {snapshot.error_message ? (
                  <p className="text-sm text-red-600">{snapshot.error_message}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No ingestion status available yet.</p>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push('/drive')}>
              Back to Drive
            </Button>
            {isComplete ? (
              <Button onClick={() => router.push('/drive')}>
                Continue
              </Button>
            ) : null}
          </div>
        </div>
      </DriveLayout>
    </AuthGuard>
  )
}
