'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { api } from '@/lib/api'

interface UploadAreaProps {
  currentFolderId: string | null
  onUploadSuccess: () => void
}

export default function UploadArea({ currentFolderId, onUploadSuccess }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const uploadFiles = async (files: FileList) => {
    setIsUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        await api.uploadDocument(files[i], currentFolderId)
      }
      onUploadSuccess()
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files)
    }
  }

  return (
    <Card
      className={`p-8 sm:p-10 text-center cursor-pointer transition-colors border border-dashed rounded-xl shadow-none ${
        isDragging
          ? 'bg-blue-50 border-blue-300'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <Upload className="w-6 h-6 text-slate-600" />
          </div>
        </div>
        <div>
          <p className="text-slate-900 font-medium text-base">
            Drag files here to upload
          </p>
          <p className="text-sm text-slate-600 mt-1">or use the button below</p>
        </div>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
        />
        <Button
          size="lg"
          disabled={isUploading}
          onClick={() => document.getElementById('file-input')?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? 'Uploading...' : 'Select files'}
        </Button>
      </div>
    </Card>
  )
}
