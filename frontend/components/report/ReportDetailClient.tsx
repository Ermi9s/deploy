'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Download, HardDrive, Loader2, AlertCircle,
  CheckCircle2, RefreshCw, Eye,
} from 'lucide-react'
import { reportApi, type ReportJobDetail } from '@/lib/api'
import { useReportProgress } from '@/hooks/useReportProgress'
import { ProgressPanel } from '@/components/report/ProgressPanel'
import { ReportViewer } from '@/components/report/ReportViewer'
import UploadModal from '@/components/drive/upload-modal'

interface ReportDetailClientProps {
  jobId: string
}

export function ReportDetailClient({ jobId }: ReportDetailClientProps) {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)

  const [job, setJob] = useState<ReportJobDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [reportFilesToUpload, setReportFilesToUpload] = useState<File[]>([])

  // Load initial job state
  const fetchJob = useCallback(async () => {
    setLoadError(null)
    try {
      const data = await reportApi.getJob(jobId)
      setJob(data)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load report.')
    }
  }, [jobId])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  // Only connect WS if the job is actively running
  const wsEnabled = job?.status === 'running' || job?.status === 'pending'

  const agendaList = useMemo(
    () => (job?.agendas ?? []).map((a) => ({ id: a.id, order: a.order, text: a.text })),
    [job],
  )

  const progress = useReportProgress(jobId, agendaList, wsEnabled)

  // Fetch the fully updated job (including all sub-reports and sources) when generation completes
  useEffect(() => {
    if (progress.isDone) {
      fetchJob()
    }
  }, [progress.isDone, fetchJob])

  // Build agenda text map for ProgressPanel
  const agendaTexts = useMemo(() => {
    const map: Record<string, string> = {}
    job?.agendas.forEach((a) => { map[a.id] = a.text })
    return map
  }, [job])

  const loadPdfMake = () => new Promise<void>((resolve, reject) => {
    if ((window as any).pdfMake && (window as any).htmlToPdfmake) return resolve()
    
    let loaded = 0
    const checkDone = () => { 
      loaded++
      if (loaded === 3) resolve() 
    }
    
    const script1 = document.createElement('script')
    script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js'
    script1.onload = checkDone
    script1.onerror = () => reject(new Error('Failed to load pdfmake'))
    
    const script2 = document.createElement('script')
    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js'
    script2.onload = checkDone
    script2.onerror = () => reject(new Error('Failed to load vfs_fonts'))
    
    const script3 = document.createElement('script')
    script3.src = 'https://cdn.jsdelivr.net/npm/html-to-pdfmake@2.5.1/browser.min.js'
    script3.onload = checkDone
    script3.onerror = () => reject(new Error('Failed to load html-to-pdfmake'))

    document.head.appendChild(script1)
    document.head.appendChild(script2)
    document.head.appendChild(script3)
  })

  const [preparingPdf, setPreparingPdf] = useState(false)

  const handleStoreToDrive = async () => {
    if (!job) return
    const element = document.getElementById('report-print-area')
    if (!element) return

    setPreparingPdf(true)
    try {
      await loadPdfMake()
      const pdfMake = (window as any).pdfMake
      const htmlToPdfmake = (window as any).htmlToPdfmake
      
      const filename = `${job.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'report'}.pdf`
      
      const pdfMakeContent = htmlToPdfmake(element.innerHTML)
      const docDefinition = {
        content: pdfMakeContent,
        defaultStyle: { fontSize: 11, lineHeight: 1.5 },
        styles: {
          'html-h1': { fontSize: 18, bold: true, margin: [0, 10, 0, 5] },
          'html-h2': { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
          'html-h3': { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
        }
      }

      const pdfGenerator = pdfMake.createPdf(docDefinition)
      const pdfBlob = await new Promise<Blob>((resolve) => {
        pdfGenerator.getBlob((blob: Blob) => resolve(blob))
      })
      
      const file = new File([pdfBlob], filename, { type: 'application/pdf' })
      setReportFilesToUpload([file])
      setUploadModalOpen(true)
    } catch (err) {
      console.error('Failed to generate PDF for Drive:', err)
      alert('Failed to generate PDF for Drive. Check console for details.')
    } finally {
      setPreparingPdf(false)
    }
  }

  const handleUploadSuccess = () => {
    fetchJob()
  }

  const handleDownload = async () => {
    if (!job) return
    const element = document.getElementById('report-print-area')
    if (!element) return

    try {
      await loadPdfMake()
      const pdfMake = (window as any).pdfMake
      const htmlToPdfmake = (window as any).htmlToPdfmake
      
      const pdfMakeContent = htmlToPdfmake(element.innerHTML)
      const docDefinition = {
        content: pdfMakeContent,
        defaultStyle: { fontSize: 11, lineHeight: 1.5 },
        styles: {
          'html-h1': { fontSize: 18, bold: true, margin: [0, 10, 0, 5] },
          'html-h2': { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
          'html-h3': { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
        }
      }

      const filename = `${job.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
      pdfMake.createPdf(docDefinition).download(filename)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert('Failed to generate PDF. Check console for details.')
    }
  }

  const handlePreview = () => setPreviewing(true)

  // ── Loading / error states ──────────────────────────────────────────────
  if (!job && !loadError) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-8">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <button onClick={fetchJob} className="flex items-center gap-2 text-sm text-primary hover:underline">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    )
  }

  const isRunning = job!.status === 'running' || job!.status === 'pending'
  const isCompleted = job!.status === 'completed'
  const isFailed = job!.status === 'failed'

  return (
    <div className="flex flex-col h-full">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/report')}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-foreground truncate">{job!.title}</h1>
            <p className="text-xs text-muted-foreground">
              {new Date(job!.created_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
              {' · '}{job!.agendas.length} agenda{job!.agendas.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        {isCompleted && (
          <div className="flex items-center gap-2 shrink-0">
            {!job!.drive_item_id && (
              <button
                id="store-to-drive-btn"
                onClick={handleStoreToDrive}
                disabled={preparingPdf}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                {preparingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
                {preparingPdf ? 'Preparing…' : 'Add to Drive'}
              </button>
            )}
            {job!.drive_item_id && (
              <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
            <button
              id="preview-report-btn"
              onClick={handlePreview}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              id="download-report-btn"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </button>
          </div>
        )}
      </div>



      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Running: live progress panel */}
        {isRunning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <h2 className="font-semibold text-sm text-foreground">Generating report…</h2>
              </div>
              <ProgressPanel
                percent={progress.percent}
                message={progress.message}
                agendaStatuses={
                  progress.agendaStatuses.length > 0
                    ? progress.agendaStatuses
                    : job!.agendas.map((a) => ({ agendaId: a.id, order: a.order, status: a.status }))
                }
                agendaTexts={agendaTexts}
              />
            </div>
          </motion.div>
        )}

        {/* Failed state */}
        {isFailed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <h2 className="font-semibold text-destructive">Report generation failed</h2>
              </div>
              <p className="text-sm text-muted-foreground">{job!.error_message || 'An unknown error occurred.'}</p>
            </div>
          </motion.div>
        )}

        {/* Completed: full report viewer */}
        {isCompleted && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div ref={printRef}>
              <ReportViewer
                title={job!.title}
                finalReport={job!.final_report}
                agendas={job!.agendas}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Print-only styles (injected globally for window.print) ─────────── */}
      <style>{`
        @media print {
          body > * { visibility: hidden; }
          #report-print-area, #report-print-area * { visibility: visible; }
          #report-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      {/* ── PDF preview modal ────────────────────────────────────────────── */}
      {previewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewing(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/50">
              <h3 className="font-semibold text-sm">{job!.title}</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  <Download className="h-3 w-3" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setPreviewing(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium border border-border hover:bg-accent"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <div
                id="report-print-area"
                className="prose prose-sm max-w-none dark:prose-invert text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: job!.final_report
                    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/^- (.+)$/gm, '<li>$1</li>')
                    .replace(/\n\n/g, '<br/><br/>'),
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Add to Drive Upload Modal ────────────────────────────────────── */}
      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        currentFolderId={null} // Root folder for now
        onUploadSuccess={handleUploadSuccess}
        initialFiles={reportFilesToUpload}
      />
    </div>
  )
}
