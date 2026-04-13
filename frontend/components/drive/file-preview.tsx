'use client'

import { Download, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AllFileViewer from './all-file-viewer'

interface Item {
  id: string
  name: string
  type: 'file' | 'folder'
  fileType?: string
}

interface FilePreviewProps {
  item: Item
  onClose: () => void
  onDownload?: () => void
  fileUrl?: string | null
  loading?: boolean
  error?: string | null
}

export default function FilePreview({
  item,
  onClose,
  onDownload,
  fileUrl,
  loading = false,
  error = null,
}: FilePreviewProps) {

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-800 truncate">{item.name}</h2>
          <div className="flex gap-2 ml-4">
            {fileUrl && (
              <Button asChild variant="ghost" size="icon">
                <a href={fileUrl} target="_blank" rel="noreferrer" aria-label="Open in new tab">
                  <ExternalLink className="w-5 h-5" />
                </a>
              </Button>
            )}
            {onDownload && (
              <Button variant="ghost" size="icon" onClick={onDownload}>
                <Download className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50">
          <AllFileViewer
            fileName={item.name}
            mimeType={item.fileType}
            fileUrl={fileUrl}
            loading={loading}
            error={error}
          />
        </div>
      </div>
    </div>
  )
}
