'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, DriveItem, FileVersion, IngestionStatusSnapshot } from '@/lib/api'
import DriveLayout from '@/components/drive/drive-layout'
import AuthGuard from '@/components/auth/auth-guard'
import AllFileViewer from '@/components/drive/all-file-viewer'
import UploadModal from '@/components/drive/upload-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  ArrowDownUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  File,
  FileText,
  Folder,
  Grid3X3,
  Image as ImageIcon,
  LayoutPanelLeft,
  List,
  Loader2,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Upload,
  X,
  XCircle,
} from 'lucide-react'

interface BreadcrumbItem {
  id: string | null
  name: string
}

type ViewMode = 'list' | 'grid'
type SortBy = 'name' | 'updated' | 'size' | 'type'

const ROOT_KEY = '__ROOT__'
const ROOT_CRUMB: BreadcrumbItem = { id: null, name: 'My Drive' }
const DEFAULT_PREVIEW_PANE_WIDTH = 460

function parentKey(parentId: string | null): string {
  return parentId || ROOT_KEY
}

function isTerminalIngestionStatus(status?: string): boolean {
  if (!status) {
    return false
  }
  const normalized = status.toLowerCase()
  return normalized === 'completed' || normalized === 'failed'
}

function clampProgress(progress?: number): number {
  if (typeof progress !== 'number' || Number.isNaN(progress)) {
    return 0
  }
  return Math.max(0, Math.min(100, progress))
}

function formatStage(stage?: string): string {
  if (!stage) {
    return 'pending'
  }
  return stage.replace(/[_-]/g, ' ')
}

export default function DrivePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const ingestionSocketsRef = useRef<Record<string, WebSocket>>({})
  const previewRequestRef = useRef(0)
  const browseSectionRef = useRef<HTMLElement | null>(null)

  const [items, setItems] = useState<DriveItem[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState<BreadcrumbItem[]>([ROOT_CRUMB])

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  const [sortAsc, setSortAsc] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [loading, setLoading] = useState(true)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [folderName, setFolderName] = useState('')

  const [selectedItem, setSelectedItem] = useState<DriveItem | null>(null)
  const [previewVersion, setPreviewVersion] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [treeChildren, setTreeChildren] = useState<Record<string, DriveItem[]>>({})
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [loadingTreeNodes, setLoadingTreeNodes] = useState<Set<string>>(new Set())
  const [loadingFileVersions, setLoadingFileVersions] = useState<Set<string>>(new Set())
  const [fileVersions, setFileVersions] = useState<Record<string, FileVersion[]>>({})
  const [treePanelOpen, setTreePanelOpen] = useState(true)
  const [ingestionByDocumentId, setIngestionByDocumentId] = useState<Record<string, IngestionStatusSnapshot>>({})
  const [previewPaneWidth, setPreviewPaneWidth] = useState(DEFAULT_PREVIEW_PANE_WIDTH)
  const [isResizingPreviewPane, setIsResizingPreviewPane] = useState(false)

  useEffect(() => {
    void loadCurrentItems()
  }, [currentFolderId, router])

  useEffect(() => {
    void ensureTreeChildrenLoaded(null)
  }, [])

  useEffect(() => {
    if (currentFolderId) {
      setTreePanelOpen(true)
    }
  }, [currentFolderId])

  useEffect(() => {
    if (!isResizingPreviewPane) {
      return
    }

    const onMouseMove = (event: MouseEvent) => {
      if (!browseSectionRef.current) {
        return
      }

      const rect = browseSectionRef.current.getBoundingClientRect()
      const minWidth = 320
      const maxWidth = Math.max(420, Math.min(760, rect.width * 0.65))
      const nextWidth = rect.right - event.clientX
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, nextWidth))
      setPreviewPaneWidth(Math.round(clampedWidth))
    }

    const onMouseUp = () => {
      setIsResizingPreviewPane(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isResizingPreviewPane])

  useEffect(() => {
    const closeSocket = (documentId: string) => {
      const socket = ingestionSocketsRef.current[documentId]
      if (!socket) {
        return
      }
      socket.close()
      delete ingestionSocketsRef.current[documentId]
    }

    const trackDocument = async (documentId: string) => {
      try {
        const statusSnapshot = await api.getIngestionStatus(documentId)
        setIngestionByDocumentId((prev) => ({
          ...prev,
          [documentId]: statusSnapshot,
        }))

        if (isTerminalIngestionStatus(statusSnapshot.status)) {
          closeSocket(documentId)
          return
        }
      } catch {
        // Keep UI resilient when ingestion service is temporarily unreachable.
      }

      if (ingestionSocketsRef.current[documentId]) {
        return
      }

      const socket = new WebSocket(api.getIngestionWsUrl(documentId))
      ingestionSocketsRef.current[documentId] = socket

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as IngestionStatusSnapshot
          setIngestionByDocumentId((prev) => ({
            ...prev,
            [documentId]: data,
          }))
          if (isTerminalIngestionStatus(data.status)) {
            closeSocket(documentId)
          }
        } catch {
          // Ignore malformed payloads from transient websocket frames.
        }
      }

      socket.onclose = () => {
        delete ingestionSocketsRef.current[documentId]
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    const documentIds = new Set<string>()
    for (const item of items) {
      if (item.type === 'file' && item.sourceDocumentId) {
        documentIds.add(item.sourceDocumentId)
      }
    }
    if (selectedItem?.type === 'file' && selectedItem.sourceDocumentId) {
      documentIds.add(selectedItem.sourceDocumentId)
    }

    for (const documentId of documentIds) {
      void trackDocument(documentId)
    }

    for (const existingDocumentId of Object.keys(ingestionSocketsRef.current)) {
      if (!documentIds.has(existingDocumentId)) {
        closeSocket(existingDocumentId)
      }
    }

  }, [items, selectedItem])

  useEffect(() => {
    return () => {
      for (const existingDocumentId of Object.keys(ingestionSocketsRef.current)) {
        const socket = ingestionSocketsRef.current[existingDocumentId]
        socket.close()
        delete ingestionSocketsRef.current[existingDocumentId]
      }
    }
  }, [])

  useEffect(() => {
    if (selectedItem?.type === 'file') {
      void ensureVersionsLoaded(selectedItem.id)
    }
  }, [selectedItem])

  const loadCurrentItems = async () => {
    setLoading(true)
    try {
      const data = await api.listFiles(currentFolderId)
      setItems(data.items)
    } catch (error) {
      console.error('Failed to load items:', error)
      if (error instanceof Error && error.message.toLowerCase().includes('token')) {
        router.replace('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const ensureTreeChildrenLoaded = async (parentId: string | null, force = false) => {
    const key = parentKey(parentId)
    if (!force && treeChildren[key]) {
      return
    }

    setLoadingTreeNodes((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })

    try {
      const data = await api.listFiles(parentId)
      const sorted = [...data.items].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setTreeChildren((prev) => ({ ...prev, [key]: sorted }))
    } catch (error) {
      console.error('Failed to load tree node:', error)
    } finally {
      setLoadingTreeNodes((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const ensureVersionsLoaded = async (fileId: string, force = false) => {
    if (!force && fileVersions[fileId]) {
      return
    }

    setLoadingFileVersions((prev) => {
      const next = new Set(prev)
      next.add(fileId)
      return next
    })

    try {
      const data = await api.listFileVersions(fileId)
      setFileVersions((prev) => ({ ...prev, [fileId]: data.versions }))
    } catch (error) {
      console.error('Failed to load file versions:', error)
    } finally {
      setLoadingFileVersions((prev) => {
        const next = new Set(prev)
        next.delete(fileId)
        return next
      })
    }
  }

  const refreshData = async () => {
    const expandedFolderIds = Array.from(expandedFolders)

    await Promise.all([
      loadCurrentItems(),
      ensureTreeChildrenLoaded(null, true),
      ensureTreeChildrenLoaded(currentFolderId, true),
      ...expandedFolderIds.map((folderId) => ensureTreeChildrenLoaded(folderId, true)),
      ...(selectedItem?.type === 'file' ? [ensureVersionsLoaded(selectedItem.id, true)] : []),
    ])
  }

  const formatDate = (date?: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatFileSize = (bytes?: number) => {
    const value = bytes || 0
    if (value === 0) return '-'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(value) / Math.log(k))
    return `${Math.round((value / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const iconForFile = (mimeType?: string) => {
    if (!mimeType) return <File className="h-5 w-5 text-slate-500" />
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <Table2 className="h-5 w-5 text-emerald-600" />
    if (mimeType.includes('image')) return <ImageIcon className="h-5 w-5 text-orange-500" />
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-rose-600" />
    return <File className="h-5 w-5 text-slate-500" />
  }

  const filteredAndSortedItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = query
      ? items.filter((item) => item.name.toLowerCase().includes(query))
      : items

    const sorted = [...filtered].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }

      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      }

      if (sortBy === 'updated') {
        const aDate = new Date(a.updatedAt || a.createdAt).getTime()
        const bDate = new Date(b.updatedAt || b.createdAt).getTime()
        return aDate - bDate
      }

      if (sortBy === 'size') {
        return (a.fileSize || 0) - (b.fileSize || 0)
      }

      return (a.fileType || a.type).localeCompare(b.fileType || b.type)
    })

    return sortAsc ? sorted : sorted.reverse()
  }, [items, searchQuery, sortBy, sortAsc])

  const currentFolderName = currentPath[currentPath.length - 1]?.name || ROOT_CRUMB.name

  const navigateToPath = async (path: BreadcrumbItem[]) => {
    const target = path[path.length - 1]
    setCurrentPath(path)
    setCurrentFolderId(target?.id || null)
    if (target?.id) {
      await ensureTreeChildrenLoaded(target.id)
    }
  }

  const openFolder = async (folder: DriveItem) => {
    if (folder.type !== 'folder') {
      return
    }
    const nextPath = [...currentPath, { id: folder.id, name: folder.name }]
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      next.add(folder.id)
      return next
    })
    await navigateToPath(nextPath)
  }

  const toggleTreeFolder = async (folderId: string) => {
    const isExpanded = expandedFolders.has(folderId)
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (isExpanded) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
    if (!isExpanded) {
      await ensureTreeChildrenLoaded(folderId)
    }
  }

  const toggleTreeFile = async (fileId: string) => {
    const isExpanded = expandedFiles.has(fileId)
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (isExpanded) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
    if (!isExpanded) {
      await ensureVersionsLoaded(fileId)
    }
  }


  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      return
    }

    try {
      await api.createFolder(folderName.trim(), currentFolderId)
      setFolderName('')
      setIsCreatingFolder(false)
      await refreshData()
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleRename = async (item: DriveItem) => {
    const nextName = window.prompt('Rename item', item.name)
    if (!nextName || !nextName.trim() || nextName === item.name) {
      return
    }

    try {
      await api.renameItem(item.id, nextName.trim())
      await refreshData()
    } catch (error) {
      console.error('Failed to rename item:', error)
    }
  }

  const handleDelete = async (item: DriveItem) => {
    const confirmed = window.confirm(`Delete \"${item.name}\"?`)
    if (!confirmed) {
      return
    }

    try {
      await api.deleteFile(item.id)
      if (selectedItem?.id === item.id) {
        setSelectedItem(null)
        clearPreviewState()
      }
      await refreshData()
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const handleDownload = async (item: DriveItem, version?: number) => {
    if (item.type !== 'file') {
      return
    }

    try {
      const res = typeof version === 'number'
        ? await api.getVersionDownloadUrl(item.id, version)
        : await api.getDownloadUrl(item.id)
      const link = document.createElement('a')
      link.href = res.downloadUrl
      link.download = item.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to download item:', error)
    }
  }

  const clearPreviewState = () => {
    previewRequestRef.current += 1
    setPreviewVersion(null)
    setPreviewUrl(null)
    setPreviewError(null)
    setPreviewLoading(false)
  }

  const openPreview = async (item: DriveItem, version?: number) => {
    if (item.type !== 'file') {
      return
    }

    setSelectedItem(item)
    const requestId = ++previewRequestRef.current

    setPreviewVersion(typeof version === 'number' ? version : null)
    setPreviewUrl(null)
    setPreviewError(null)
    setPreviewLoading(true)

    try {
      const res = typeof version === 'number'
        ? await api.getVersionDownloadUrl(item.id, version)
        : await api.getDownloadUrl(item.id)

      if (requestId !== previewRequestRef.current) {
        return
      }
      setPreviewUrl(res.downloadUrl)
    } catch (error) {
      if (requestId !== previewRequestRef.current) {
        return
      }
      console.error('Failed to load preview URL:', error)
      setPreviewError('Could not load a preview URL for this file.')
    } finally {
      if (requestId !== previewRequestRef.current) {
        return
      }
      setPreviewLoading(false)
    }
  }

  const selectedVersions = useMemo(() => {
    if (!selectedItem || selectedItem.type !== 'file') {
      return [] as FileVersion[]
    }
    return fileVersions[selectedItem.id] || []
  }, [selectedItem, fileVersions])

  const getIngestionSnapshot = (item: DriveItem): IngestionStatusSnapshot | null => {
    if (item.type !== 'file' || !item.sourceDocumentId) {
      return null
    }
    return ingestionByDocumentId[item.sourceDocumentId] || null
  }

  const renderIngestionStatus = (item: DriveItem) => {
    if (item.type !== 'file') {
      return <span className="text-xs text-slate-400">-</span>
    }

    if (!item.sourceDocumentId) {
      return <Badge variant="outline" className="text-[10px] text-slate-500">Not linked</Badge>
    }

    const snapshot = getIngestionSnapshot(item)
    if (!snapshot) {
      return <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200">Pending</Badge>
    }

    const progress = clampProgress(snapshot.progress)
    const status = snapshot.status.toLowerCase()

    if (status === 'completed') {
      return (
        <Badge className="bg-emerald-600 text-white">
          <CheckCircle2 className="h-3 w-3" />
          Ingested
        </Badge>
      )
    }

    if (status === 'failed') {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    }

    return (
      <div className="min-w-[150px] space-y-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate">{formatStage(snapshot.stage)}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    )
  }

  const renderTree = (parentId: string | null, path: BreadcrumbItem[]): React.ReactNode => {
    const key = parentKey(parentId)
    const nodes = treeChildren[key] || []
    if (nodes.length === 0) {
      return null
    }

    return (
      <ul className="space-y-1">
        {nodes.map((node) => {
          if (node.type === 'folder') {
            const isExpanded = expandedFolders.has(node.id)
            const isActive = currentFolderId === node.id
            const childrenKey = parentKey(node.id)
            const loadingChildren = loadingTreeNodes.has(childrenKey)
            const nextPath = [...path, { id: node.id, name: node.name }]

            return (
              <li key={node.id}>
                <div
                  className={`group flex items-center gap-1 rounded-lg px-2 py-1 text-sm transition ${
                    isActive
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void toggleTreeFolder(node.id)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-slate-200/70"
                    aria-label={`Toggle ${node.name}`}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => void navigateToPath(nextPath)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                  >
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="truncate">{node.name}</span>
                  </button>
                </div>

                {isExpanded ? (
                  <div className="ml-4 border-l border-slate-200 pl-2">
                    {loadingChildren ? (
                      <p className="px-2 py-1 text-xs text-slate-400">Loading...</p>
                    ) : (
                      renderTree(node.id, nextPath)
                    )}
                  </div>
                ) : null}
              </li>
            )
          }

          const isSelected = selectedItem?.id === node.id
          const isExpanded = expandedFiles.has(node.id)
          const versions = fileVersions[node.id] || []
          const versionsLoading = loadingFileVersions.has(node.id)

          return (
            <li key={node.id}>
              <div
                className={`group flex items-center gap-1 rounded-lg px-2 py-1 text-sm transition ${
                  isSelected
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void toggleTreeFile(node.id)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-slate-200/70"
                  aria-label={`Toggle versions for ${node.name}`}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => void openPreview(node)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                >
                  <File className="h-4 w-4 shrink-0" />
                  <span className="truncate">{node.name}</span>
                </button>
              </div>

              {isExpanded ? (
                <div className="ml-4 border-l border-slate-200 pl-2">
                  {versionsLoading ? <p className="px-2 py-1 text-xs text-slate-400">Loading versions...</p> : null}
                  {!versionsLoading && versions.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-slate-400">No versions</p>
                  ) : null}
                  {!versionsLoading ? (
                    <ul className="space-y-1">
                      {versions.map((version, index) => (
                        <li key={version.id}>
                          <button
                            type="button"
                            onClick={() => void openPreview(node, version.version)}
                            className="flex w-full items-center justify-between rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <span>{`v${version.version}${index === 0 ? ' (latest)' : ''}`}</span>
                            <span>{formatDate(version.createdAt)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    )
  }

  const sortLabel = `${sortBy === 'updated' ? 'Date' : sortBy[0].toUpperCase() + sortBy.slice(1)} ${sortAsc ? 'Asc' : 'Desc'}`

  return (
    <AuthGuard>
      <DriveLayout>
        <Tabs defaultValue="browse" className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-2">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="browse">Browse</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="planning">Planning</TabsTrigger>
              <TabsTrigger value="reporting">Reporting</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="browse" className="space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-800">Object Browser</h1>
              <p className="text-sm text-slate-500">{currentFolderName}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="hidden lg:inline-flex"
                onClick={() => setTreePanelOpen((prev) => !prev)}
              >
                <LayoutPanelLeft className="mr-2 h-4 w-4" />
                {treePanelOpen ? 'Hide Tree' : 'Show Tree'}
              </Button>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <Menu className="mr-2 h-4 w-4" />
                    Tree
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[86vw] sm:max-w-sm">
                  <SheetHeader>
                    <SheetTitle>Folder and File Tree</SheetTitle>
                    <SheetDescription>Browse folders, files, and file versions.</SheetDescription>
                  </SheetHeader>
                  <div className="px-4 pb-4">
                    <button
                      type="button"
                      onClick={() => void navigateToPath([ROOT_CRUMB])}
                      className={`mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm ${
                        !currentFolderId ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Folder className="h-4 w-4" />
                      {ROOT_CRUMB.name}
                    </button>
                    {renderTree(null, [ROOT_CRUMB])}
                  </div>
                </SheetContent>
              </Sheet>

              <Button variant="outline" size="sm" onClick={() => void refreshData()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setUploadModalOpen(true)} className="min-w-[180px]">
                <Upload className="mr-2 h-4 w-4" />
                Upload to {currentFolderName}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsCreatingFolder((prev) => !prev)}>
                {isCreatingFolder ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {isCreatingFolder ? 'Cancel' : 'New Folder'}
              </Button>
            </div>
          </header>

          {isCreatingFolder ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <Input
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="Folder name"
                className="max-w-sm"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleCreateFolder()
                  }
                }}
              />
              <Button size="sm" onClick={() => void handleCreateFolder()}>
                Create
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search files and folders"
                  className="pl-9"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowDownUp className="mr-2 h-4 w-4" />
                    {sortLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy('name')}>Sort by name</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('updated')}>Sort by date</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('size')}>Sort by size</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('type')}>Sort by type</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortAsc((prev) => !prev)}>
                    {sortAsc ? 'Use descending' : 'Use ascending'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon-sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon-sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 text-sm">
            {currentPath.map((crumb, index) => (
              <div className="flex items-center gap-1" key={`${crumb.id || ROOT_KEY}-${index}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => void navigateToPath(currentPath.slice(0, index + 1))}
                >
                  {crumb.name}
                </Button>
                {index < currentPath.length - 1 ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
              </div>
            ))}
          </div>

          <section
            ref={browseSectionRef}
            className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(320px,var(--preview-width))] lg:grid-cols-[minmax(0,var(--tree-width,260px))_minmax(0,1fr)_minmax(320px,var(--preview-width))]"
            style={{ '--preview-width': `${previewPaneWidth}px` } as React.CSSProperties}
          >
            <aside
              className={`hidden rounded-xl border border-slate-200 bg-white p-3 lg:block ${
                treePanelOpen ? 'opacity-100' : 'w-0 overflow-hidden border-none p-0 opacity-0'
              } transition-all duration-300`}
            >
              <button
                type="button"
                onClick={() => void navigateToPath([ROOT_CRUMB])}
                className={`mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm ${
                  !currentFolderId ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Folder className="h-4 w-4" />
                {ROOT_CRUMB.name}
              </button>
              {loadingTreeNodes.has(ROOT_KEY) ? (
                <p className="px-2 py-1 text-xs text-slate-400">Loading structure...</p>
              ) : (
                renderTree(null, [ROOT_CRUMB])
              )}
            </aside>

            <div className="rounded-xl border border-slate-200 bg-white lg:h-[calc(100vh-7.5rem)] lg:overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-sm text-slate-500">Loading items...</p>
              ) : filteredAndSortedItems.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="font-medium text-slate-700">No items here yet</p>
                  <p className="text-sm text-slate-500">Upload files or create a folder to get started.</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredAndSortedItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`rounded-xl border p-3 text-left transition ${
                        selectedItem?.id === item.id
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      onClick={() => {
                        if (item.type === 'file') {
                          void openPreview(item)
                        } else {
                          setSelectedItem(item)
                          clearPreviewState()
                        }
                      }}
                      onDoubleClick={() => {
                        if (item.type === 'folder') {
                          void openFolder(item)
                        } else {
                          void openPreview(item)
                        }
                      }}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {item.type === 'folder' ? <Folder className="h-5 w-5 text-amber-500" /> : iconForFile(item.fileType)}
                          <span className="text-sm font-medium text-slate-800">{item.type === 'folder' ? 'Folder' : 'File'}</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" onClick={(event) => event.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.type === 'file' ? (
                              <DropdownMenuItem onClick={() => void openPreview(item)}>
                                Preview
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => void handleRename(item)}>Rename</DropdownMenuItem>
                            {item.type === 'file' ? (
                              <DropdownMenuItem onClick={() => void handleDownload(item)}>Download</DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => void handleDelete(item)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                      <div className="mt-2">{renderIngestionStatus(item)}</div>
                      <p className="mt-1 text-xs text-slate-500">Updated {formatDate(item.updatedAt || item.createdAt)}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Size</div>
                    <div className="col-span-2 text-right">Updated</div>
                  </div>
                  {filteredAndSortedItems.map((item) => (
                    <div
                      key={item.id}
                      className={`grid cursor-pointer grid-cols-12 items-center px-4 py-2 text-sm transition ${
                        selectedItem?.id === item.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        if (item.type === 'file') {
                          void openPreview(item)
                        } else {
                          setSelectedItem(item)
                          clearPreviewState()
                        }
                      }}
                      onDoubleClick={() => {
                        if (item.type === 'folder') {
                          void openFolder(item)
                        } else {
                          void openPreview(item)
                        }
                      }}
                    >
                      <div className="col-span-6 flex min-w-0 items-center gap-2">
                        {item.type === 'folder' ? <Folder className="h-4 w-4 text-amber-500" /> : iconForFile(item.fileType)}
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-slate-800">{item.name}</span>
                          <div className="mt-1">{renderIngestionStatus(item)}</div>
                        </div>
                      </div>
                      <div className="col-span-2 text-slate-600">{item.type}</div>
                      <div className="col-span-2 text-slate-600">{item.type === 'folder' ? '-' : formatFileSize(item.fileSize)}</div>
                      <div className="col-span-2 flex items-center justify-end gap-2 text-slate-500">
                        <span>{formatDate(item.updatedAt || item.createdAt)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" onClick={(event) => event.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.type === 'file' ? (
                              <DropdownMenuItem onClick={() => void openPreview(item)}>
                                Preview
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => void handleRename(item)}>Rename</DropdownMenuItem>
                            {item.type === 'file' ? (
                              <DropdownMenuItem onClick={() => void handleDownload(item)}>Download</DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => void handleDelete(item)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <aside className="relative hidden rounded-xl border border-slate-200 bg-white p-4 md:sticky md:top-4 md:flex md:h-[calc(100vh-7.5rem)] md:flex-col md:overflow-hidden">
              <button
                type="button"
                onMouseDown={() => setIsResizingPreviewPane(true)}
                onDoubleClick={() => setPreviewPaneWidth(DEFAULT_PREVIEW_PANE_WIDTH)}
                className="absolute -left-2 top-1/2 z-20 hidden h-16 w-4 -translate-y-1/2 cursor-col-resize items-center justify-center rounded-full border border-slate-300 bg-white text-slate-400 hover:text-slate-700 md:flex"
                aria-label="Resize preview panel"
                title="Drag to resize. Double-click to reset width."
              >
                <span className="h-8 w-[2px] rounded bg-current" />
              </button>
              <Tabs defaultValue="preview" className="flex h-full flex-col">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                  <TabsTrigger value="ai">AI</TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="mt-3 min-h-0 flex-1 overflow-hidden">
                  {selectedItem?.type === 'file' ? (
                    <div className="flex h-full flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-800" title={selectedItem.name}>
                          {selectedItem.name}
                        </p>
                        <div className="flex items-center gap-1">
                          {previewUrl ? (
                            <Button asChild variant="ghost" size="icon-sm" title="Open in new tab">
                              <a href={previewUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDownload(selectedItem, previewVersion === null ? undefined : previewVersion)}
                          >
                            Download
                          </Button>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        <AllFileViewer
                          fileName={selectedItem.name}
                          fileUrl={previewUrl}
                          mimeType={selectedItem.fileType}
                          loading={previewLoading}
                          error={previewError}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500">
                      Select a file to preview it inline.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="metadata" className="mt-3 min-h-0 flex-1 overflow-y-auto">
                  {selectedItem ? (
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-slate-500">Name</p>
                        <p className="font-medium text-slate-800">{selectedItem.name}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Type</p>
                        <p className="font-medium text-slate-800">{selectedItem.type === 'folder' ? 'Folder' : selectedItem.fileType || 'File'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Size</p>
                        <p className="font-medium text-slate-800">{selectedItem.type === 'folder' ? '-' : formatFileSize(selectedItem.fileSize)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Created</p>
                        <p className="font-medium text-slate-800">{formatDate(selectedItem.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Modified</p>
                        <p className="font-medium text-slate-800">{formatDate(selectedItem.updatedAt || selectedItem.createdAt)}</p>
                      </div>

                      <div>
                        <p className="text-slate-500">Ingestion</p>
                        <div className="mt-1">{renderIngestionStatus(selectedItem)}</div>
                        {selectedItem.type === 'file' && getIngestionSnapshot(selectedItem)?.message ? (
                          <p className="mt-1 text-xs text-slate-500">{getIngestionSnapshot(selectedItem)?.message}</p>
                        ) : null}
                      </div>

                      {selectedItem.type === 'file' ? (
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-slate-500">Versions</p>
                            <Button variant="ghost" size="sm" onClick={() => void ensureVersionsLoaded(selectedItem.id, true)}>
                              Refresh
                            </Button>
                          </div>
                          {selectedVersions.length === 0 ? (
                            <p className="text-xs text-slate-400">No versions yet.</p>
                          ) : (
                            <ul className="space-y-1">
                              {selectedVersions.map((version, index) => (
                                <li key={version.id}>
                                  <button
                                    type="button"
                                    onClick={() => void openPreview(selectedItem, version.version)}
                                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-slate-600 hover:bg-slate-100"
                                  >
                                    <span>{`v${version.version}${index === 0 ? ' (latest)' : ''}`}</span>
                                    <span>{formatDate(version.createdAt)}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Select a file or folder to view metadata.</p>
                  )}
                </TabsContent>

                <TabsContent value="ai" className="mt-3 min-h-0 flex-1 overflow-y-auto">
                  <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-700">File-aware AI tools</p>
                    <p>
                      {selectedItem?.type === 'file'
                        ? `Use ${selectedItem.name} as context for chat, planning, and reporting.`
                        : 'Select a file to enable context-aware AI actions.'}
                    </p>
                    <Button size="sm" variant="outline" disabled>
                      Ask AI About This File
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </aside>
          </section>

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Why Tabs In One Workspace?</h3>
              <p className="mt-1 text-sm text-slate-600">
                Keeping AI features close to the file browser preserves context and avoids bouncing across pages.
                As each feature matures, these tabs can still split into dedicated routes without redesigning the core navigation.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-800">AI Chat</h2>
              <p className="mt-2 text-sm text-slate-600">
                Ask questions grounded in your ingested files. This tab is prepared for your RAG chat workflow.
              </p>
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                Coming soon: conversational retrieval, citations, and source jumping.
              </div>
            </section>
          </TabsContent>

          <TabsContent value="planning" className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-800">Planning Assistant</h2>
              <p className="mt-2 text-sm text-slate-600">
                Generate task plans and action checklists using the documents already stored and indexed.
              </p>
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                Coming soon: goal planning, timeline generation, and file-backed action items.
              </div>
            </section>
          </TabsContent>

          <TabsContent value="reporting" className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-800">Reporting</h2>
              <p className="mt-2 text-sm text-slate-600">
                Build summaries and report outputs from your ingested knowledge base.
              </p>
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                Coming soon: periodic reports, executive summaries, and export workflows.
              </div>
            </section>
          </TabsContent>
        </Tabs>

        <UploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          currentFolderId={currentFolderId}
          onUploadSuccess={() => void refreshData()}
        />

      </DriveLayout>
    </AuthGuard>
  )
}
