'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'json',
  'csv',
  'log',
  'xml',
  'yaml',
  'yml',
  'html',
  'htm',
  'css',
  'js',
  'ts',
  'tsx',
  'jsx',
  'py',
  'java',
  'go',
  'rs',
  'sql',
  'sh',
])

type ViewerKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'embed'

interface AllFileViewerProps {
  fileName: string
  fileUrl?: string | null
  mimeType?: string
  loading?: boolean
  error?: string | null
}

function getFileExtension(name: string): string {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

export default function AllFileViewer({
  fileName,
  fileUrl,
  mimeType,
  loading = false,
  error = null,
}: AllFileViewerProps) {
  const [textContent, setTextContent] = useState('')
  const [textLoading, setTextLoading] = useState(false)
  const [textError, setTextError] = useState<string | null>(null)

  const viewerKind = useMemo<ViewerKind>(() => {
    const extension = getFileExtension(fileName)
    const type = mimeType?.toLowerCase() || ''

    if (type.startsWith('image/')) return 'image'
    if (type.startsWith('video/')) return 'video'
    if (type.startsWith('audio/')) return 'audio'
    if (type === 'application/pdf' || extension === 'pdf') return 'pdf'

    const textLikeMime =
      type.startsWith('text/') ||
      type.includes('json') ||
      type.includes('xml') ||
      type.includes('javascript')

    if (textLikeMime || TEXT_EXTENSIONS.has(extension)) return 'text'

    return 'embed'
  }, [fileName, mimeType])

  useEffect(() => {
    let active = true

    const loadText = async () => {
      if (viewerKind !== 'text' || !fileUrl) {
        setTextContent('')
        setTextError(null)
        setTextLoading(false)
        return
      }

      setTextLoading(true)
      setTextError(null)

      try {
        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error(`Unable to preview file (${response.status})`)
        }
        const text = await response.text()
        if (active) {
          setTextContent(text)
        }
      } catch {
        if (active) {
          setTextError('Could not render text preview for this file.')
          setTextContent('')
        }
      } finally {
        if (active) {
          setTextLoading(false)
        }
      }
    }

    void loadText()

    return () => {
      active = false
    }
  }, [fileUrl, viewerKind])

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-slate-500">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading preview...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-red-600">Failed to open preview</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!fileUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6">
        <p className="text-sm text-slate-500">No preview URL available for this file.</p>
      </div>
    )
  }

  if (viewerKind === 'image') {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <img src={fileUrl} alt={fileName} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  if (viewerKind === 'video') {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <video src={fileUrl} controls className="max-h-full max-w-full rounded-md bg-black" />
      </div>
    )
  }

  if (viewerKind === 'audio') {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <audio src={fileUrl} controls className="w-full max-w-xl" />
      </div>
    )
  }

  if (viewerKind === 'text') {
    if (textLoading) {
      return (
        <div className="flex h-full w-full items-center justify-center text-slate-500">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading text...
          </div>
        </div>
      )
    }

    if (textError) {
      return (
        <div className="flex h-full w-full items-center justify-center px-6">
          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-500">{textError}</p>
            <Button asChild variant="outline" size="sm">
              <a href={fileUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in new tab
              </a>
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full w-full overflow-auto bg-white p-5">
        <pre className="whitespace-pre-wrap break-words font-mono text-sm text-slate-700">{textContent}</pre>
      </div>
    )
  }

  return <iframe title={fileName} src={fileUrl} className="h-full w-full border-0 bg-white" />
}