'use client'

import type { ChatSource } from '@/types/chat'
import { FileText, Image, Film, Archive, File } from 'lucide-react'

interface SourceChipProps {
  source: ChatSource
  index: number
  onClick: (source: ChatSource) => void
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return Image
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return Film
  if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return Archive
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return FileText
  return File
}

function scoreToPercent(score: number): string {
  return `${Math.round(score * 100)}%`
}

export function SourceChip({ source, index, onClick }: SourceChipProps) {
  const Icon = getFileIcon(source.filename)
  const shortName =
    source.filename.length > 28
      ? `${source.filename.slice(0, 26)}…`
      : source.filename

  return (
    <button
      id={`source-chip-${source.chunk_id}`}
      onClick={() => onClick(source)}
      title={`Open: ${source.filename}`}
      className="
        group inline-flex items-center gap-2
        rounded-lg border border-indigo-100 bg-indigo-50/60
        px-3 py-1.5 text-xs text-indigo-800
        hover:border-indigo-300 hover:bg-indigo-100
        active:scale-95
        transition-all duration-150 cursor-pointer
        shadow-sm hover:shadow-md
      "
    >
      {/* Index badge */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
        {index}
      </span>

      {/* File icon */}
      <Icon className="h-3.5 w-3.5 shrink-0 text-indigo-500 group-hover:text-indigo-700 transition-colors" />

      {/* Filename */}
      <span className="font-medium">{shortName}</span>

      {/* Score badge */}
      <span className="ml-1 rounded-full bg-indigo-200/70 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700">
        {scoreToPercent(source.score)}
      </span>
    </button>
  )
}
