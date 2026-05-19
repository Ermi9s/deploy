'use client'

import { useState } from 'react'
import { Shield, Plus, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DepartmentAccessMap } from '@/lib/api'

interface DeptEntry {
  deptId: string
  deptLabel: string
  minRanking: number
}

interface DepartmentAccessPickerProps {
  value: DepartmentAccessMap
  onChange: (next: DepartmentAccessMap) => void
  disabled?: boolean
}

/**
 * A self-contained editor for the file-level department access matrix.
 *
 * Produces a map of:   { "<dept-id-or-label>": min_ranking }
 *
 * In a real system the dept options would be fetched from the management API.
 * For now it accepts free-text department identifiers so the picker is usable
 * immediately without an extra endpoint.
 */
export default function DepartmentAccessPicker({
  value,
  onChange,
  disabled = false,
}: DepartmentAccessPickerProps) {
  const [open, setOpen] = useState(false)
  const [newDept, setNewDept] = useState('')
  const [newRanking, setNewRanking] = useState(1)

  const entries: DeptEntry[] = Object.entries(value).map(([id, rank]) => ({
    deptId: id,
    deptLabel: id,
    minRanking: rank,
  }))

  const handleAdd = () => {
    const trimmed = newDept.trim()
    if (!trimmed || value[trimmed] !== undefined) return
    onChange({ ...value, [trimmed]: newRanking })
    setNewDept('')
    setNewRanking(1)
  }

  const handleRemove = (deptId: string) => {
    const next = { ...value }
    delete next[deptId]
    onChange(next)
  }

  const handleRankChange = (deptId: string, rank: number) => {
    onChange({ ...value, [deptId]: Math.max(1, rank) })
  }

  const rankingLabel = (r: number) => {
    if (r <= 1) return 'Public'
    if (r === 2) return 'Restricted'
    if (r === 3) return 'Confidential'
    if (r === 4) return 'Secret'
    return 'Top Secret'
  }

  const rankingColor = (r: number) => {
    if (r <= 1) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (r === 2) return 'bg-sky-100 text-sky-800 border-sky-200'
    if (r === 3) return 'bg-amber-100 text-amber-800 border-amber-200'
    if (r === 4) return 'bg-orange-100 text-orange-800 border-orange-200'
    return 'bg-red-100 text-red-800 border-red-200'
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
      >
        <span className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-500" />
          Department Access Control
          {entries.length > 0 && (
            <span className="ml-1 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {entries.length}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 pt-3">
            Specify which departments may access this file and the minimum clearance
            ranking required. Leave empty to allow unrestricted access.
          </p>

          {/* Existing entries */}
          {entries.length > 0 && (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li
                  key={e.deptId}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                    {e.deptLabel}
                  </span>
                  <select
                    value={e.minRanking}
                    disabled={disabled}
                    onChange={(ev) => handleRankChange(e.deptId, Number(ev.target.value))}
                    className={`text-xs border rounded-full px-2 py-0.5 font-semibold cursor-pointer ${rankingColor(e.minRanking)}`}
                  >
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r}>
                        Rank {r} — {rankingLabel(r)}
                      </option>
                    ))}
                  </select>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(e.deptId)}
                      className="ml-1 text-slate-400 hover:text-red-500 transition"
                      aria-label={`Remove ${e.deptLabel}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add new department */}
          {!disabled && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Department UUID or name…"
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <select
                value={newRanking}
                onChange={(e) => setNewRanking(Number(e.target.value))}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>
                    Rank {r}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                disabled={!newDept.trim()}
                className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>
          )}

          {entries.length === 0 && (
            <p className="text-xs italic text-slate-400 text-center py-2">
              No restrictions set — all authenticated users may access this file.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
