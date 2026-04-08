'use client'

import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Item {
  id: string
  name: string
  type: 'file' | 'folder'
  fileType?: string
}

interface FilePreviewProps {
  item: Item
  onClose: () => void
}

export default function FilePreview({ item, onClose }: FilePreviewProps) {
  const isImage = item.fileType?.startsWith('image/')
  const isPdf = item.fileType === 'application/pdf'
  const isVideo = item.fileType?.startsWith('video/')
  const isAudio = item.fileType?.startsWith('audio/')
  const isText = item.fileType?.includes('text') || item.name?.endsWith('.txt')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-800 truncate">{item.name}</h2>
          <div className="flex gap-2 ml-4">
            <Button variant="ghost" size="icon">
              <Download className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50">
          {isImage ? (
            <div className="flex items-center justify-center">
              <img
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23e5e7eb' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' font-size='24' fill='%239ca3af' text-anchor='middle' dy='.3em'%3EImage Preview%3C/text%3E%3C/svg%3E"
                alt={item.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : isPdf ? (
            <div className="flex flex-col items-center gap-4 py-12 text-gray-500">
              <div className="w-24 h-24 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-5xl">📄</span>
              </div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm">PDF preview not available in demo</p>
            </div>
          ) : isVideo ? (
            <div className="flex flex-col items-center gap-4 py-12 text-gray-500">
              <div className="w-24 h-24 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-5xl">🎬</span>
              </div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm">Video preview not available in demo</p>
            </div>
          ) : isAudio ? (
            <div className="flex flex-col items-center gap-6 py-12">
              <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-6xl">🎵</span>
              </div>
              <p className="text-gray-600 font-medium">{item.name}</p>
              <p className="text-sm text-gray-500">Audio preview not available in demo</p>
            </div>
          ) : isText ? (
            <div className="p-6 w-full bg-white max-h-full overflow-auto font-mono text-sm text-gray-700">
              <p className="whitespace-pre-wrap">This is a demo file. In a real application, the text content would be displayed here.</p>
            </div>
          ) : (
            <div className="text-center py-12 px-6">
              <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-5xl">📎</span>
              </div>
              <p className="text-gray-600 text-lg mb-2">No preview available</p>
              <p className="text-gray-500 text-sm">Download the file to view its contents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
