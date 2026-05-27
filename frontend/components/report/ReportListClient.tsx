'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Plus, RefreshCw, Loader2 } from 'lucide-react'
import { reportApi, type ReportJobList } from '@/lib/api'
import { ReportCard } from '@/components/report/ReportCard'
import { NewReportDialog } from '@/components/report/NewReportDialog'

export function ReportListClient() {
  const [reports, setReports] = useState<ReportJobList[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const data = await reportApi.listJobs()
      setReports(data.results)
    } catch {
      // silently fail — empty state will show
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleStoreToDrive = async (id: string) => {
    try {
      await reportApi.storeToDrive(id)
      await fetchReports()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to store report.')
    }
  }

  const handleDownload = (id: string) => {
    const report = reports.find((r) => r.id === id)
    if (!report) return
    // Navigate to detail page where the PDF print is available
    window.open(`/report/${id}?print=1`, '_blank')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return
    try {
      await reportApi.deleteJob(id)
      await fetchReports()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete report.')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-generated reports from your knowledge base
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchReports}
            disabled={loading}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            id="new-report-btn"
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Report
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading && reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading reports…</p>
          </div>
        ) : reports.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-6 text-center"
          >
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
                <FileText className="h-9 w-9 text-primary opacity-70" />
              </div>
              <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                <Plus className="h-4 w-4" />
              </div>
            </div>
            <div className="space-y-1.5 max-w-xs">
              <h2 className="text-lg font-semibold text-foreground">No reports yet</h2>
              <p className="text-sm text-muted-foreground">
                Generate AI-powered reports from your organisation's knowledge base using Scatter-Gather RAG.
              </p>
            </div>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Generate Your First Report
            </button>
          </motion.div>
        ) : (
          /* Reports grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report, i) => (
              <ReportCard
                key={report.id}
                report={report}
                index={i}
                onStoreToDrive={report.status === 'completed' ? handleStoreToDrive : undefined}
                onDownload={report.status === 'completed' ? handleDownload : undefined}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <NewReportDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
