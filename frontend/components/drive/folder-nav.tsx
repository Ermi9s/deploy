import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FolderPlus, ChevronRight, Upload, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface FolderNavProps {
  currentFolderId: string | null
  onNavigate: (folderId: string | null) => void
  onSuccess?: () => void
}

export default function FolderNav({ currentFolderId, onNavigate, onSuccess }: FolderNavProps) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [destinationFolderId, setDestinationFolderId] = useState<string>('__CURRENT__')
  const [availableFolders, setAvailableFolders] = useState<Array<{ id: string; name: string }>>([])
  const [isUploading, setIsUploading] = useState(false)

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return
    try {
      await api.createFolder(folderName, currentFolderId)
      setFolderName('')
      setIsCreatingFolder(false)
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const openUploadDialog = async () => {
    try {
      const data = await api.listFiles(null)
      const rootFolders = data.items
        .filter((item) => item.type === 'folder')
        .map((item) => ({ id: item.id, name: item.name }))
      setAvailableFolders(rootFolders)
    } catch (error) {
      console.error('Failed to load destination folders:', error)
      setAvailableFolders([])
    }

    setDestinationFolderId(currentFolderId ? '__CURRENT__' : '__ROOT__')
    setSelectedFiles([])
    setIsUploadDialogOpen(true)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    const resolvedParentId =
      destinationFolderId === '__ROOT__'
        ? null
        : destinationFolderId === '__CURRENT__'
          ? currentFolderId
          : destinationFolderId

    setIsUploading(true)
    try {
      for (const file of selectedFiles) {
        await api.uploadDocument(file, resolvedParentId ?? null)
      }
      setIsUploadDialogOpen(false)
      setSelectedFiles([])
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Failed to upload files:', error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="default"
        size="sm"
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={openUploadDialog}
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsCreatingFolder(!isCreatingFolder)}
      >
        <FolderPlus className="w-4 h-4 mr-2" />
        New Folder
      </Button>

      {isCreatingFolder && (
        <div className="flex gap-2 items-center">
          <input
            placeholder="Folder name..."
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleCreateFolder}
            variant="default"
          >
            Create
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsCreatingFolder(false)
              setFolderName('')
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {currentFolderId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate(null)}
        >
          <ChevronRight className="w-4 h-4" />
          Back to Root
        </Button>
      )}

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload files</DialogTitle>
            <DialogDescription>
              Choose files and select the destination folder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label htmlFor="upload-files" className="text-sm font-medium text-slate-700">
                Files
              </label>
              <input
                id="upload-files"
                type="file"
                multiple
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : []
                  setSelectedFiles(files)
                }}
                className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {selectedFiles.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">{selectedFiles.length} file(s) selected</p>
              )}
            </div>

            <div>
              <label htmlFor="destination-folder" className="text-sm font-medium text-slate-700">
                Destination
              </label>
              <select
                id="destination-folder"
                value={destinationFolderId}
                onChange={(e) => setDestinationFolderId(e.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
              >
                {currentFolderId ? <option value="__CURRENT__">Current folder</option> : null}
                <option value="__ROOT__">My Drive (root)</option>
                {availableFolders
                  .filter((folder) => folder.id !== currentFolderId)
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsUploadDialogOpen(false)
                setSelectedFiles([])
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
