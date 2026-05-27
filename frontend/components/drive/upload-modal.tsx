'use client'

import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  Shield,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  Info,
} from 'lucide-react'
import { api, DepartmentAccessMap } from '@/lib/api'
import DepartmentAccessPicker from './department-access-picker'

interface UploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentFolderId: string | null
  onUploadSuccess: () => void
  initialFiles?: File[]
}

type Step = 'select' | 'classify' | 'review' | 'uploading'

interface QueuedFile {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'completed' | 'failed'
  error?: string
}

export default function UploadModal({
  open,
  onOpenChange,
  currentFolderId,
  onUploadSuccess,
  initialFiles,
}: UploadModalProps) {
  const [step, setStep] = useState<Step>('select')
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([])
  const [departmentAccess, setDepartmentAccess] = useState<DepartmentAccessMap>({})
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Initialize with initialFiles when modal opens
  React.useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      const newFiles: QueuedFile[] = []
      for (let i = 0; i < initialFiles.length; i++) {
        const file = initialFiles[i]
        newFiles.push({
          id: `${file.name}-${file.size}-${Date.now()}-${i}`,
          file,
          status: 'queued',
        })
      }
      setFileQueue(newFiles)
      setStep('classify') // Skip select step if files are pre-provided
    }
  }, [open, initialFiles])

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const validateAndQueueFiles = (files: FileList | File[]) => {
    const newFiles: QueuedFile[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const mime = file.type.toLowerCase()
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

      // Validate: PDF, Images, or Text/Markdown
      const isValid =
        mime === 'application/pdf' ||
        mime.startsWith('image/') ||
        mime.startsWith('text/') ||
        ext === '.pdf' ||
        ext === '.md' ||
        ext === '.txt' ||
        ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff'].some((e) => ext.endsWith(e))

      if (isValid) {
        newFiles.push({
          id: `${file.name}-${file.size}-${Date.now()}-${i}`,
          file,
          status: 'queued',
        })
      } else {
        alert(`Unsupported file format: ${file.name}. Only PDFs and images are supported.`)
      }
    }

    if (newFiles.length > 0) {
      setFileQueue((prev) => [...prev, ...newFiles])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndQueueFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndQueueFiles(e.target.files)
    }
  }

  const removeFileFromQueue = (id: string) => {
    setFileQueue((prev) => prev.filter((f) => f.id !== id))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const getFileIcon = (file: File) => {
    const mime = file.type.toLowerCase()
    if (mime === 'application/pdf') return <FileText className="w-5 h-5 text-rose-500 shrink-0" />
    if (mime.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-amber-500 shrink-0" />
    return <FileIcon className="w-5 h-5 text-slate-400 shrink-0" />
  }

  const executeUploadLoop = async () => {
    setStep('uploading')

    // Copy queue reference
    const currentQueue = [...fileQueue]
    
    // We upload sequentially
    for (let i = 0; i < currentQueue.length; i++) {
      const qFile = currentQueue[i]
      
      // Update status to uploading
      setFileQueue((prev) =>
        prev.map((f) => (f.id === qFile.id ? { ...f, status: 'uploading' } : f))
      )

      try {
        await api.uploadDocument(qFile.file, currentFolderId, departmentAccess)
        setFileQueue((prev) =>
          prev.map((f) => (f.id === qFile.id ? { ...f, status: 'completed' } : f))
        )
      } catch (err) {
        console.error(err)
        const errMsg = err instanceof Error ? err.message : 'Upload failed'
        setFileQueue((prev) =>
          prev.map((f) => (f.id === qFile.id ? { ...f, status: 'failed', error: errMsg } : f))
        )
      }
    }

    // Refresh directory content on success
    onUploadSuccess()
  }

  const resetState = () => {
    setStep('select')
    setFileQueue([])
    setDepartmentAccess({})
  }

  // Derived properties
  const totalFiles = fileQueue.length
  const completedCount = fileQueue.filter((f) => f.status === 'completed').length
  const failedCount = fileQueue.filter((f) => f.status === 'failed').length
  const isUploadingFinished = completedCount + failedCount === totalFiles && totalFiles > 0

  return (
    <Dialog open={open} onOpenChange={(val) => {
      // Prevent closing if we are currently uploading
      if (step === 'uploading' && !isUploadingFinished) return
      onOpenChange(val)
      if (!val) resetState()
    }}>
      <DialogContent className="sm:max-w-[760px] p-0 overflow-hidden rounded-2xl border-slate-200">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Secure Document Ingestor
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Select, classify, and audit documents uploaded to your knowledge environment.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Stepper progress indicator */}
        {step !== 'uploading' && (
          <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-center gap-8">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${step === 'select' ? 'bg-indigo-600 text-white' : 'bg-emerald-100 text-emerald-700 font-bold'}`}>
                {step !== 'select' ? '✓' : '1'}
              </span>
              <span className={`text-xs font-semibold ${step === 'select' ? 'text-slate-800' : 'text-slate-400'}`}>Select Files</span>
            </div>
            <div className="w-8 h-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${step === 'classify' ? 'bg-indigo-600 text-white' : step === 'review' ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-500'}`}>
                {step === 'review' ? '✓' : '2'}
              </span>
              <span className={`text-xs font-semibold ${step === 'classify' ? 'text-slate-800' : 'text-slate-400'}`}>Classify</span>
            </div>
            <div className="w-8 h-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${step === 'review' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                3
              </span>
              <span className={`text-xs font-semibold ${step === 'review' ? 'text-slate-800' : 'text-slate-400'}`}>Review & Upload</span>
            </div>
          </div>
        )}

        {/* Step contents */}
        <div className="p-6 max-h-[460px] overflow-y-auto">
          {/* STEP 1: Select Files */}
          {step === 'select' && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                    : 'border-slate-200 bg-slate-50/30 hover:border-indigo-400 hover:bg-indigo-50/10'
                }`}
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Drag files here or browse</p>
                <p className="text-xs text-slate-400 mt-1">PDF and image formats supported up to 500 MB</p>
              </div>

              {/* Queued files list */}
              {fileQueue.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Queue ({totalFiles})</h4>
                  <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white max-h-[220px] overflow-y-auto shadow-inner">
                    {fileQueue.map((qFile) => (
                      <li key={qFile.id} className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          {getFileIcon(qFile.file)}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate max-w-[400px]">{qFile.file.name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{formatFileSize(qFile.file.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFileFromQueue(qFile.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Classify */}
          {step === 'classify' && (
            <div className="space-y-4">
              <DepartmentAccessPicker
                value={departmentAccess}
                onChange={setDepartmentAccess}
              />
              <div className="flex items-start gap-2.5 rounded-lg bg-indigo-50/40 border border-indigo-100 p-3">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                  Clearance rules are permanently embedded inside each extracted vector chunk in Elasticsearch. 
                  Users who do not belong to the selected departments, or whose authorization is below the chosen minimum ranking, 
                  will be blocked from accessing this data during queries.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === 'review' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* File Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center justify-between">
                  <span>Target Files</span>
                  <span className="text-slate-500">{totalFiles} total</span>
                </h4>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[280px] overflow-y-auto">
                  {fileQueue.map((qFile) => (
                    <li key={qFile.id} className="flex items-center gap-3 p-3">
                      {getFileIcon(qFile.file)}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 truncate">{qFile.file.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatFileSize(qFile.file.size)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Policy Audit */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-indigo-500" />
                  Assigned Security Policy
                </h4>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Permitted Clearance Levels</p>
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(departmentAccess).map(([deptUuid, minRanking]) => {
                        const rankLabel =
                          minRanking === 1 ? 'Public (Rank 1)' :
                          minRanking === 2 ? 'Restricted (Rank 2)' :
                          minRanking === 3 ? 'Confidential (Rank 3)' :
                          minRanking === 4 ? 'Secret (Rank 4)' :
                          `Top Secret (Rank ${minRanking})`;

                        return (
                          <div key={deptUuid} className="flex items-center justify-between bg-white border border-slate-100 px-3 py-1.5 rounded-lg">
                            <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">
                              {deptUuid === 'Public' ? 'Public' : 'Active Department'}
                            </span>
                            <Badge variant="outline" className={`text-[10px] font-bold ${
                              minRanking <= 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              minRanking === 2 ? 'bg-sky-50 text-sky-700 border-sky-200' :
                              minRanking === 3 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              minRanking === 4 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {rankLabel}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Lock className="w-3.5 h-3.5 text-indigo-500" />
                      Locked Security Fallback
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      Public users are automatically granted read access at clearance rank 1+.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Uploading Progress */}
          {step === 'uploading' && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">
                    {!isUploadingFinished
                      ? `Uploading documents... (${completedCount + failedCount}/${totalFiles})`
                      : 'Upload session completed'}
                  </span>
                  <span className="text-slate-500 font-bold">{Math.round((completedCount / totalFiles) * 100)}%</span>
                </div>
                <Progress value={(completedCount / totalFiles) * 100} className="h-2 bg-slate-100" />
              </div>

              {/* Sequential queue execution breakdown */}
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[220px] overflow-y-auto">
                {fileQueue.map((qFile) => (
                  <li key={qFile.id} className="flex items-center justify-between p-3.5">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {getFileIcon(qFile.file)}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 truncate">{qFile.file.name}</p>
                        {qFile.status === 'failed' && qFile.error && (
                          <p className="text-[10px] text-red-500 mt-0.5 truncate">{qFile.error}</p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 ml-4">
                      {qFile.status === 'queued' && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                          Queued
                        </span>
                      )}
                      {qFile.status === 'uploading' && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" /> Ingestion
                        </span>
                      )}
                      {qFile.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Complete
                        </span>
                      )}
                      {qFile.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3 text-red-600" /> Failed
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-medium">
            {step === 'select' && totalFiles > 0 && `${totalFiles} file(s) queued`}
            {step === 'classify' && 'Step 2 of 3'}
            {step === 'review' && 'Step 3 of 3'}
            {step === 'uploading' && isUploadingFinished && `${completedCount} uploaded successfully, ${failedCount} failed`}
          </div>

          <div className="flex items-center gap-2">
            {step === 'select' && (
              <>
                <DialogClose asChild>
                  <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  disabled={totalFiles === 0}
                  onClick={() => setStep('classify')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                >
                  Next: Classify
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}

            {step === 'classify' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep('select')}
                  className="border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep('review')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                >
                  Next: Review
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}

            {step === 'review' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep('classify')}
                  className="border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={executeUploadLoop}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5"
                >
                  Confirm & Ingest
                </Button>
              </>
            )}

            {step === 'uploading' && isUploadingFinished && (
              <Button
                onClick={() => {
                  onOpenChange(false)
                  resetState()
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6"
              >
                Finish
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
