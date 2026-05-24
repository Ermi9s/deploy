'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import AuthGuard from '@/components/auth/auth-guard'
import { AppLayout } from '@/components/layout/AppLayout'
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
      <AppLayout title="Ingestion Progress">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-display font-semibold text-foreground tracking-tight">Ingestion Progress</h1>
                <p className="mt-1 text-sm text-muted-foreground">Track indexing and vectorization for your uploaded file.</p>
              </div>
              <Badge variant="outline" className="text-xs bg-background">Document {documentId}</Badge>
            </div>
          </header>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            {loading ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Loading ingestion status...
              </div>
            ) : error ? (
              <div className="space-y-4">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" onClick={() => router.refresh()} className="rounded-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : snapshot ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  {snapshot.status.toLowerCase() === 'completed' ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200/50 hover:bg-emerald-500/20">
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Completed
                    </Badge>
                  ) : snapshot.status.toLowerCase() === 'failed' ? (
                    <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Failed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-background">{snapshot.status}</Badge>
                  )}
                  <Badge variant="outline" className="bg-background">Stage: {formatStage(snapshot.stage)}</Badge>
                  {itemId ? <Badge variant="outline" className="bg-background">File: {itemId}</Badge> : null}
                </div>

                <div className="bg-accent/50 p-4 rounded-xl border border-border/50">
                  <div className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
                    <span>Progress</span>
                    <span className="text-primary">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-background" />
                </div>

                {snapshot.message ? (
                  <p className="text-sm text-muted-foreground">{snapshot.message}</p>
                ) : null}

                {snapshot.error_message ? (
                  <p className="text-sm text-destructive font-medium">{snapshot.error_message}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No ingestion status available yet.</p>
            )}
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={() => router.push('/drive')} className="rounded-full px-6">
              Back to Drive
            </Button>
            {isComplete ? (
              <Button onClick={() => router.push('/drive')} className="rounded-full px-6">
                Continue
              </Button>
            ) : null}
          </div>
        </div>
      </AppLayout>
    </AuthGuard>
  )
}
