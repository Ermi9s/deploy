'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { type AgendaProgressState } from '@/hooks/useReportProgress'

interface ProgressPanelProps {
  percent: number
  message: string
  agendaStatuses: AgendaProgressState[]
  agendaTexts: Record<string, string>   // agendaId → text label
}

const AGENDA_ICON = {
  pending:   <Circle className="h-4 w-4 text-muted-foreground" />,
  running:   <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  failed:    <XCircle className="h-4 w-4 text-destructive" />,
}

export function ProgressPanel({ percent, message, agendaStatuses, agendaTexts }: ProgressPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Overall progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{message}</span>
          <span className="text-muted-foreground">{percent}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Per-agenda status */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agenda Items</p>
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {agendaStatuses.map((a, idx) => (
            <motion.div
              key={a.agendaId}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-3 px-4 py-3 bg-card"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {a.order + 1}
              </span>
              <span className="flex-1 text-sm text-foreground line-clamp-1">
                {agendaTexts[a.agendaId] ?? `Agenda ${a.order + 1}`}
              </span>
              <span className="flex items-center gap-1.5">
                {AGENDA_ICON[a.status]}
                {a.message && a.status === 'running' && (
                  <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[140px]">
                    {a.message}
                  </span>
                )}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
