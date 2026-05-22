'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, ExternalLink, Download, MapPin, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { ChatSource } from '@/types/chat'
import { Button } from '@/components/ui/button'

interface DocumentPreviewModalProps {
  source: ChatSource | null
  onClose: () => void
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

function isPreviewable(filename: string): 'pdf' | 'image' | 'text' | 'none' {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if ([
    'txt', 'md', 'markdown', 'json', 'js', 'ts', 'tsx', 'jsx',
    'html', 'css', 'py', 'sh', 'yaml', 'yml', 'csv', 'xml', 'ini', 'conf',
    'sql', 'go', 'rs', 'java', 'c', 'cpp', 'h'
  ].includes(ext)) return 'text'
  return 'none'
}

export function DocumentPreviewModal({ source, onClose }: DocumentPreviewModalProps) {
  const router = useRouter()
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string>('')
  const [loadState, setLoadState] = useState<LoadState>('idle')

  const fetchUrl = useCallback(async (documentId: string, filename: string) => {
    setLoadState('loading')
    setDownloadUrl(null)
    setTextContent('')
    try {
      const { downloadUrl: url } = await api.getDownloadUrl(documentId)
      setDownloadUrl(url)

      const type = isPreviewable(filename)
      if (type === 'text') {
        const response = await fetch(url)
        if (response.ok) {
          const text = await response.text()
          setTextContent(text)
        } else {
          throw new Error('Failed to fetch text contents')
        }
      }
      setLoadState('ready')
    } catch (err) {
      console.error('[DocumentPreview] Failed to get document preview:', err)
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    if (source?.document_id) {
      fetchUrl(source.document_id, source.filename)
    }
  }, [source, fetchUrl])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!source) return null

  const previewType = isPreviewable(source.filename)

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel */}
      <div className="
        relative flex flex-col
        w-full sm:w-[600px] h-[85vh] sm:h-[90vh]
        bg-white rounded-t-2xl sm:rounded-2xl sm:mr-4
        shadow-2xl border border-slate-200
        overflow-hidden
        animate-in slide-in-from-right duration-300
      ">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-0.5">Source Document</p>
            <h2
              className="text-sm font-semibold text-slate-800 truncate"
              title={source.filename}
            >
              {source.filename}
            </h2>
          </div>
          <button
            id="doc-preview-close"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-100">
          <Button
            id="doc-preview-locate"
            variant="ghost"
            size="sm"
            className="text-xs text-slate-600 gap-1.5"
            onClick={() => {
              onClose()
              router.push(`/drive?highlight=${encodeURIComponent(source.document_id)}`)
            }}
          >
            <MapPin className="h-3.5 w-3.5" />
            Locate in Drive
          </Button>

          {downloadUrl && (
            <>
              <Button
                id="doc-preview-download"
                variant="ghost"
                size="sm"
                className="text-xs text-slate-600 gap-1.5"
                asChild
              >
                <a href={downloadUrl} download={source.filename}>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
              <Button
                id="doc-preview-open-tab"
                variant="ghost"
                size="sm"
                className="text-xs text-slate-600 gap-1.5"
                asChild
              >
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
            </>
          )}
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-hidden bg-slate-150">
          {loadState === 'loading' && (
            <div className="flex h-full items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">Loading preview…</span>
            </div>
          )}

          {loadState === 'error' && (
            <div className="flex h-full items-center justify-center text-center px-8">
              <div>
                <p className="text-slate-600 font-medium animate-bounce">Preview unavailable</p>
                <p className="text-xs text-slate-400 mt-1">Could not fetch the document content.</p>
              </div>
            </div>
          )}

          {loadState === 'ready' && downloadUrl && (
            <>
              {previewType === 'pdf' && (
                <iframe
                  src={downloadUrl}
                  title={source.filename}
                  className="h-full w-full border-0"
                />
              )}
              {previewType === 'image' && (
                <div className="flex h-full items-center justify-center p-4 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={downloadUrl}
                    alt={source.filename}
                    className="max-h-full max-w-full rounded-lg object-contain shadow-lg border border-slate-200 animate-in zoom-in-95 duration-200"
                  />
                </div>
              )}
              {previewType === 'text' && (
                <div className="h-full w-full overflow-auto p-5 bg-slate-950 text-slate-300 font-mono text-xs leading-relaxed whitespace-pre select-text">
                  {textContent || <span className="text-slate-500 italic">[Empty document]</span>}
                </div>
              )}
              {previewType === 'none' && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center px-8 bg-slate-50">
                  <p className="text-slate-600 font-medium">No inline preview for this file type.</p>
                  <p className="text-xs text-slate-400">Use the Download or Open buttons above to view it.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
