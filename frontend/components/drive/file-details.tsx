'use client'

import { Card } from '@/components/ui/card'
import { FileIcon, Calendar, HardDrive, FileType } from 'lucide-react'

interface FileDetailsProps {
  name: string
  type: 'file' | 'folder'
  fileType?: string
  fileSize?: number
  createdAt: string
}

export default function FileDetails({
  name,
  type,
  fileType,
  fileSize,
  createdAt,
}: FileDetailsProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold text-lg">Details</h3>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <FileIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Name</p>
            <p className="text-sm font-medium break-words">{name}</p>
          </div>
        </div>

        {type === 'file' && fileType && (
          <div className="flex items-start gap-3">
            <FileType className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Type</p>
              <p className="text-sm font-medium">{fileType}</p>
            </div>
          </div>
        )}

        {type === 'file' && fileSize && (
          <div className="flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Size</p>
              <p className="text-sm font-medium">{formatFileSize(fileSize)}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Created</p>
            <p className="text-sm font-medium">{formatDate(createdAt)}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
