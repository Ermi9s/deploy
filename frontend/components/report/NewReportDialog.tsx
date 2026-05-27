'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, FileText, Loader2, AlertCircle } from 'lucide-react'
import { reportApi } from '@/lib/api'

interface NewReportDialogProps {
  open: boolean
  onClose: () => void
}

export function NewReportDialog({ open, onClose }: NewReportDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [agendas, setAgendas] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addAgenda = () => {
    if (agendas.length < 10) setAgendas((prev) => [...prev, ''])
  }

  const removeAgenda = (idx: number) => {
    if (agendas.length <= 1) return
    setAgendas((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateAgenda = (idx: number, value: string) => {
    setAgendas((prev) => prev.map((a, i) => (i === idx ? value : a)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    const trimmedAgendas = agendas.map((a) => a.trim()).filter(Boolean)

    if (!trimmedTitle) { setError('Report title is required.'); return }
    if (trimmedAgendas.length === 0) { setError('At least 1 agenda item is required.'); return }

    setLoading(true)
    try {
      const job = await reportApi.createJob({ title: trimmedTitle, agendas: trimmedAgendas })
      onClose()
      router.push(`/report/${job.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report.')
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setTitle('')
    setAgendas([''])
    setError(null)
    onClose()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={handleClose}
      >
        <motion.div
          key="dialog"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">New Report</h2>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="report-title" className="text-sm font-medium text-foreground">
                Report Title
              </label>
              <input
                id="report-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 Strategic Review"
                maxLength={255}
                disabled={loading}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 transition"
              />
            </div>

            {/* Agendas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Agenda Items <span className="text-muted-foreground font-normal">({agendas.length}/10)</span>
                </label>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {agendas.map((agenda, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={agenda}
                      onChange={(e) => updateAgenda(idx, e.target.value)}
                      placeholder={`Agenda item ${idx + 1}…`}
                      disabled={loading}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 transition"
                    />
                    {agendas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAgenda(idx)}
                        disabled={loading}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>

              {agendas.length < 10 && (
                <button
                  type="button"
                  onClick={addAgenda}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Agenda Item
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Footer */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Generate Report'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
