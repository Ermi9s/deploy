'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, DriveItem } from '@/lib/api'
import DriveLayout from '@/components/drive/drive-layout'
import AuthGuard from '@/components/auth/auth-guard'
import FolderNav from '@/components/drive/folder-nav'
import { Folder, MoreVertical, FileText, Table2, Image as ImageIcon, File } from 'lucide-react'

export default function DrivePage() {
  const router = useRouter()
  const [items, setItems] = useState<DriveItem[]>([])
  const [folders, setFolders] = useState<DriveItem[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadItems()
  }, [currentFolderId, router])

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await api.listFiles(currentFolderId)
      const itemsToDisplay = data.items

      // Separate files and folders
      const foldersData = itemsToDisplay.filter((item: DriveItem) => item.type === 'folder')
      const filesData = itemsToDisplay.filter((item: DriveItem) => item.type === 'file')

      setFolders(foldersData)
      setItems(filesData)
    } catch (error) {
      console.error('Failed to load items:', error)
      if (error instanceof Error && error.message.toLowerCase().includes('token')) {
        router.replace('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleFolderNavigate = (folderId: string | null) => {
    setCurrentFolderId(folderId)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const iconForFile = (mimeType?: string) => {
    if (!mimeType) return <File className="w-5 h-5 text-slate-500" />
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <Table2 className="w-5 h-5 text-emerald-600" />
    if (mimeType.includes('image')) return <ImageIcon className="w-5 h-5 text-orange-500" />
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-rose-600" />
    return <File className="w-5 h-5 text-slate-500" />
  }

  return (
    <AuthGuard>
      <DriveLayout>
        <div className="space-y-10">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-normal text-slate-800">My Drive</h1>
            </div>

            <div className="flex items-center gap-2">
              <FolderNav currentFolderId={currentFolderId} onNavigate={handleFolderNavigate} onSuccess={loadItems} />
            </div>
          </header>

          <section>
            <h2 className="text-sm font-medium text-slate-500 mb-4 px-1">Folders</h2>
            {folders.length === 0 ? (
              <div className="text-sm text-slate-500 px-1">No folders in this location.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onDoubleClick={() => handleFolderNavigate(folder.id)}
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all text-left group"
                  >
                    <Folder className="w-5 h-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
                    <span className="text-sm font-medium text-slate-700 truncate">{folder.name}</span>
                    <MoreVertical className="w-4 h-4 text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium text-slate-500 mb-4 px-1">Files</h2>
            {loading ? (
              <p className="text-sm text-slate-500 px-1">Loading files...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500 px-1">No files in this location.</p>
            ) : (
              <div className="w-full">
                <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
                  <div className="col-span-7">Name</div>
                  <div className="col-span-3">Owner</div>
                  <div className="col-span-2 text-right sm:text-left">Last modified</div>
                </div>

                {items.map((file) => (
                  <div
                    key={file.id}
                    className="grid grid-cols-12 px-4 py-4 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer items-center"
                  >
                    <div className="col-span-7 flex items-center gap-3 min-w-0">
                      {iconForFile(file.fileType)}
                      <span className="text-sm font-medium text-slate-800 truncate">{file.name}</span>
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-700 font-bold">ME</div>
                      <span className="text-xs text-slate-500 hidden sm:inline">Me</span>
                    </div>
                    <div className="col-span-2 text-right sm:text-left text-xs text-slate-500">
                      {formatDate(file.updatedAt || file.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {currentFolderId ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleFolderNavigate(null)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Back to root
              </button>
            </div>
          ) : null}

          {loading ? null : (
            <div className="hidden">
              {/* Keeps API-driven refresh affordance via existing components if needed later */}
              <FolderNav currentFolderId={currentFolderId} onNavigate={handleFolderNavigate} onSuccess={loadItems} />
            </div>
          )}
        </div>
      </DriveLayout>
    </AuthGuard>
  )
}
