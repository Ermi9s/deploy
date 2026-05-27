'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, FileText } from 'lucide-react'
import type { ReportAgenda } from '@/lib/api'
import { DocumentPreviewModal } from '@/components/chat/DocumentPreviewModal'
import type { ChatSource } from '@/types/chat'

interface ReportViewerProps {
  title: string
  finalReport: string
  agendas: ReportAgenda[]
}

/** Minimal markdown → HTML renderer for headings, bold, bullets, and paragraphs. */
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="my-2 space-y-1">$1</ul>')
    .replace(/\n{2,}/g, '</p><p class="mb-3">')
    .replace(/^(?!<[hHuUlLoO])(.+)$/gm, '<p class="mb-3">$1</p>')
}

function AgendaSection({ agenda, index, onSourceClick }: { agenda: ReportAgenda; index: number; onSourceClick: (s: any) => void }) {
  const [open, setOpen] = useState(false)

  // Ensure unique sources per sub-agenda
  const uniqueSources = useMemo(() => {
    if (!agenda.sources) return []
    const sourceMap = new Map<string, any>()
    agenda.sources.forEach(source => {
      const key = source.document_id || source.filename
      if (!sourceMap.has(key)) {
        sourceMap.set(key, source)
      }
    })
    return Array.from(sourceMap.values())
  }, [agenda.sources])

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {index + 1}
          </span>
          <span className="font-medium text-sm text-foreground">{agenda.text}</span>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 py-4 space-y-4 bg-card">
              {/* Sub-report content */}
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-foreground text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(agenda.sub_report || '*No content generated.*') }}
              />

              {/* Sources */}
              {uniqueSources.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources</p>
                  <div className="flex flex-wrap gap-2">
                    {uniqueSources.map((s) => (
                      <button
                        onClick={() => onSourceClick(s)}
                        key={s.chunk_id || s.filename}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                      >
                        <FileText className="h-3 w-3" />
                        {s.filename}
                        <span className="text-[10px] opacity-60">({s.score.toFixed(3)})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ReportViewer({ title, finalReport, agendas }: ReportViewerProps) {
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null)

  // Extract unique sources across all agendas
  const uniqueSources = useMemo(() => {
    const sourceMap = new Map<string, any>()
    agendas.forEach(agenda => {
      if (!agenda.sources) return
      agenda.sources.forEach(source => {
        if (!sourceMap.has(source.filename)) {
          sourceMap.set(source.filename, source)
        }
      })
    })
    return Array.from(sourceMap.values())
  }, [agendas])

  return (
    <>
      <div className="space-y-8">
        {/* Final synthesised report */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
            Synthesised Report
          </h2>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 rounded-2xl border border-border bg-card p-6 shadow-sm min-w-0">
              <div
                id="report-print-area"
                className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(finalReport) }}
              />
            </div>
            {uniqueSources.length > 0 && (
              <div className="w-full lg:w-72 shrink-0 rounded-2xl border border-border bg-card p-6 shadow-sm self-start">
                <h3 className="text-sm font-semibold mb-4 text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Sources Used
                </h3>
                <ul className="space-y-3">
                  {uniqueSources.map(s => (
                    <li key={s.filename} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                      <button
                        onClick={() => setSelectedSource(s as ChatSource)}
                        className="break-words min-w-0 flex-1 text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                      >
                        {s.filename}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Per-agenda sub-reports */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
            Agenda Sub-Reports
          </h2>
          <div className="space-y-3">
            {agendas.map((agenda, idx) => (
              <AgendaSection key={agenda.id} agenda={agenda} index={idx} onSourceClick={setSelectedSource} />
            ))}
          </div>
        </section>
      </div>

      <DocumentPreviewModal 
        source={selectedSource}
        onClose={() => setSelectedSource(null)}
      />
    </>
  )
}
