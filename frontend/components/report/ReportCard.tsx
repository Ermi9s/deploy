'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { FileText, CheckCircle2, Clock, Loader2, XCircle, Download, HardDrive, Calendar, Trash2 } from 'lucide-react'
import { type ReportJobList } from '@/lib/api'

interface ReportCardProps {
  report: ReportJobList
  onStoreToDrive?: (id: string) => void
  onDownload?: (id: string) => void
  onDelete?: (id: string) => void
  index?: number
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   icon: Clock,       color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  running:   { label: 'Running',   icon: Loader2,     color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  failed:    { label: 'Failed',    icon: XCircle,     color: 'text-destructive',  bg: 'bg-destructive/10' },
}

export function ReportCard({ report, onStoreToDrive, onDownload, onDelete, index = 0 }: ReportCardProps) {
  const cfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.pending
  const StatusIcon = cfg.icon
  const isRunning = report.status === 'running'
  const isCompleted = report.status === 'completed'

  const formatted = new Date(report.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
    >
      {/* Status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            {cfg.label}
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(report.id)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Delete report"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Title & meta */}
      <div className="flex-1 min-w-0">
        <Link href={`/report/${report.id}`}>
          <h3 className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug cursor-pointer">
            {report.title}
          </h3>
        </Link>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatted}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {report.agendas_count} agenda{report.agendas_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Actions — only for completed */}
      {isCompleted && (
        <div className="flex gap-2 pt-1 border-t border-border">
          {!report.drive_item_id && onStoreToDrive && (
            <button
              onClick={() => onStoreToDrive(report.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <HardDrive className="h-3.5 w-3.5" />
              Add to Drive
            </button>
          )}
          {report.drive_item_id && (
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved to Drive
            </span>
          )}
          {onDownload && (
            <button
              onClick={() => onDownload(report.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
