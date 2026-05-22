'use client'

import { Card } from '@/components/ui/card'
import { FileIcon, Calendar, HardDrive, FileType, Shield, Lock, Unlock } from 'lucide-react'
import { DepartmentAccessMap } from '@/lib/api'

interface FileDetailsProps {
  name: string
  type: 'file' | 'folder'
  fileType?: string
  fileSize?: number
  createdAt: string
  departmentAccess?: DepartmentAccessMap
}

const RANKING_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Public',       color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  2: { label: 'Restricted',   color: 'bg-sky-100 text-sky-800 border-sky-200' },
  3: { label: 'Confidential', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  4: { label: 'Secret',       color: 'bg-orange-100 text-orange-800 border-orange-200' },
  5: { label: 'Top Secret',   color: 'bg-red-100 text-red-800 border-red-200' },
}

function rankBadge(ranking: number) {
  const meta = RANKING_LABELS[ranking] ?? { label: `Rank ${ranking}`, color: 'bg-slate-100 text-slate-700 border-slate-200' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
      <Lock className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  )
}

export default function FileDetails({
  name,
  type,
  fileType,
  fileSize,
  createdAt,
  departmentAccess,
}: FileDetailsProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const accessEntries = Object.entries(departmentAccess ?? {})
  const isOpen = accessEntries.length === 0

  return (
    <Card className="p-4 space-y-5 border-slate-200 shadow-none">
      <h3 className="font-semibold text-base text-slate-900">Details</h3>

      {/* Core metadata */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <FileIcon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Name</p>
            <p className="text-sm font-medium text-slate-800 break-words">{name}</p>
          </div>
        </div>

        {type === 'file' && fileType && (
          <div className="flex items-start gap-3">
            <FileType className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Type</p>
              <p className="text-sm font-medium text-slate-800">{fileType}</p>
            </div>
          </div>
        )}

        {type === 'file' && fileSize && (
          <div className="flex items-start gap-3">
            <HardDrive className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Size</p>
              <p className="text-sm font-medium text-slate-800">{formatFileSize(fileSize)}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Created</p>
            <p className="text-sm font-medium text-slate-800">{formatDate(createdAt)}</p>
          </div>
        </div>
      </div>

      {/* MAC access section (files only) */}
      {type === 'file' && (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Access Control
            </span>
          </div>

          {isOpen ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700 font-medium">
                No restrictions — all authenticated users can access this file.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {accessEntries.map(([deptId, minRanking]) => (
                <li
                  key={deptId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="text-xs text-slate-700 font-medium truncate max-w-[130px]" title={deptId}>
                    {deptId}
                  </span>
                  {rankBadge(minRanking)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
