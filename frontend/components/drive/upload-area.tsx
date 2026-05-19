'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Upload } from 'lucide-react'
import { api, DepartmentAccessMap } from '@/lib/api'
import DepartmentAccessPicker from './department-access-picker'

interface UploadAreaProps {
  currentFolderId: string | null
  onUploadSuccess: () => void
}

export default function UploadArea({ currentFolderId, onUploadSuccess }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showAccessConfig, setShowAccessConfig] = useState(false)
  const [departmentAccess, setDepartmentAccess] = useState<DepartmentAccessMap>({})
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const startUpload = async (files: FileList) => {
    setIsUploading(true)
    setUploadError(null)
    try {
      for (let i = 0; i < files.length; i++) {
        await api.uploadDocument(files[i], currentFolderId, departmentAccess)
      }
      setShowAccessConfig(false)
      setPendingFiles(null)
      setDepartmentAccess({})
      onUploadSuccess()
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setPendingFiles(e.dataTransfer.files)
      setShowAccessConfig(true)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPendingFiles(e.target.files)
      setShowAccessConfig(true)
    }
  }

  const handleConfirmUpload = () => {
    if (pendingFiles) {
      void startUpload(pendingFiles)
    }
  }

  const handleCancel = () => {
    setShowAccessConfig(false)
    setPendingFiles(null)
    setDepartmentAccess({})
    setUploadError(null)
  }

  const fileCount = pendingFiles?.length ?? 0
  const fileLabel = fileCount === 1 ? pendingFiles?.[0]?.name : `${fileCount} files`

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <Card
        className={`p-8 sm:p-10 text-center cursor-pointer transition-all border border-dashed rounded-xl shadow-none ${
          isDragging
            ? 'bg-indigo-50 border-indigo-400 scale-[1.01]'
            : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-indigo-100' : 'bg-slate-100'}`}>
              <Upload className={`w-7 h-7 ${isDragging ? 'text-indigo-600' : 'text-slate-500'}`} />
            </div>
          </div>
          <div>
            <p className="text-slate-900 font-semibold text-base">
              Drag files here to upload
            </p>
            <p className="text-sm text-slate-500 mt-1">PDF and image formats supported</p>
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading…' : 'Select files'}
          </Button>
        </div>
      </Card>

      {/* Access configuration panel — shown after file selection */}
      {showAccessConfig && pendingFiles && (
        <Card className="p-5 border border-indigo-200 bg-indigo-50/40 rounded-xl shadow-none space-y-4">
          {/* File summary */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 truncate max-w-xs">{fileLabel}</p>
              <p className="text-xs text-slate-500 mt-0.5">Configure access permissions before uploading</p>
            </div>
          </div>

          {/* Department access picker */}
          <DepartmentAccessPicker
            value={departmentAccess}
            onChange={setDepartmentAccess}
            disabled={isUploading}
          />

          {/* MAC context hint */}
          <div className="flex items-start gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Permissions are embedded in every vector chunk. Only users whose department
              is listed <em>and</em> whose ranking meets the minimum will retrieve this
              content during RAG queries.
            </p>
          </div>

          {uploadError && (
            <p className="text-xs text-red-600 font-medium">{uploadError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isUploading}
              className="rounded-lg border-slate-200 text-slate-600"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmUpload}
              disabled={isUploading}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5"
            >
              {isUploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
