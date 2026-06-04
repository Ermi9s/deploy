'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, DriveItem, FileVersion } from '@/lib/api'

export interface ClipboardEntry {
  item: DriveItem
  mode: 'copy' | 'cut'
}

export interface BreadcrumbItem {
  id: string | null
  name: string
}

export const ROOT_CRUMB: BreadcrumbItem = { id: null, name: 'My Drive' }
const ROOT_KEY = '__ROOT__'

function parentKey(parentId: string | null): string {
  return parentId || ROOT_KEY
}

/**
 * Core drive state management hook.
 *
 * Encapsulates:
 * - Current folder navigation (items, path, folder id)
 * - Folder tree children for the sidebar tree view
 * - File version tracking per file
 * - Helpers: loadCurrentItems, refresh, navigation, create/rename/delete/download
 */
export function useDriveState() {
  const router = useRouter()

  // ── Main listing ────────────────────────────────────────────────────────────
  const [items, setItems] = useState<DriveItem[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState<BreadcrumbItem[]>([ROOT_CRUMB])
  const [loading, setLoading] = useState(true)

  // ── Sidebar tree ─────────────────────────────────────────────────────────────
  const [treeChildren, setTreeChildren] = useState<Record<string, DriveItem[]>>({})
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [loadingTreeNodes, setLoadingTreeNodes] = useState<Set<string>>(new Set())

  // ── File versions ────────────────────────────────────────────────────────────
  const [fileVersions, setFileVersions] = useState<Record<string, FileVersion[]>>({})
  const [loadingFileVersions, setLoadingFileVersions] = useState<Set<string>>(new Set())
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  // ── Folder creation ──────────────────────────────────────────────────────────
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [folderName, setFolderName] = useState('')

  // ── Clipboard (cut / copy / paste) ───────────────────────────────────────────
  const [clipboard, setClipboard] = useState<ClipboardEntry | null>(null)

  // ── Search state with debounce ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ── Preview request deduplication ────────────────────────────────────────────
  const previewRequestRef = useRef(0)

  // ── Load current folder items ─────────────────────────────────────────────────
  const loadCurrentItems = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listFiles(currentFolderId, debouncedSearchQuery)
      setItems(data.items)
    } catch (error) {
      console.error('Failed to load items:', error)
      if (error instanceof Error && error.message.toLowerCase().includes('token')) {
        router.replace('/login')
      }
    } finally {
      setLoading(false)
    }
  }, [currentFolderId, debouncedSearchQuery, router])

  useEffect(() => {
    void loadCurrentItems()
  }, [loadCurrentItems])

  // ── Preload root tree on mount ───────────────────────────────────────────────
  useEffect(() => {
    void ensureTreeChildrenLoaded(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sidebar tree helpers ─────────────────────────────────────────────────────
  const ensureTreeChildrenLoaded = useCallback(
    async (parentId: string | null, force = false) => {
      const key = parentKey(parentId)
      if (!force && treeChildren[key]) return

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
    },
    // treeChildren deliberately omitted to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const toggleTreeFolder = useCallback(
    async (folderId: string) => {
      const isExpanded = expandedFolders.has(folderId)
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        isExpanded ? next.delete(folderId) : next.add(folderId)
        return next
      })
      if (!isExpanded) {
        await ensureTreeChildrenLoaded(folderId)
      }
    },
    [expandedFolders, ensureTreeChildrenLoaded],
  )

  // ── File version helpers ─────────────────────────────────────────────────────
  const ensureVersionsLoaded = useCallback(
    async (fileId: string, force = false) => {
      if (!force && fileVersions[fileId]) return

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
    },
    // fileVersions deliberately omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const toggleTreeFile = useCallback(
    async (fileId: string) => {
      const isExpanded = expandedFiles.has(fileId)
      setExpandedFiles((prev) => {
        const next = new Set(prev)
        isExpanded ? next.delete(fileId) : next.add(fileId)
        return next
      })
      if (!isExpanded) {
        await ensureVersionsLoaded(fileId)
      }
    },
    [expandedFiles, ensureVersionsLoaded],
  )

  // ── Full refresh ─────────────────────────────────────────────────────────────
  const refreshData = useCallback(
    async (selectedItemId?: string) => {
      const expandedFolderIds = Array.from(expandedFolders)
      await Promise.all([
        loadCurrentItems(),
        ensureTreeChildrenLoaded(null, true),
        ensureTreeChildrenLoaded(currentFolderId, true),
        ...expandedFolderIds.map((folderId) => ensureTreeChildrenLoaded(folderId, true)),
        ...(selectedItemId ? [ensureVersionsLoaded(selectedItemId, true)] : []),
      ])
    },
    [expandedFolders, currentFolderId, loadCurrentItems, ensureTreeChildrenLoaded, ensureVersionsLoaded],
  )

  // ── Navigation ───────────────────────────────────────────────────────────────
  const navigateToPath = useCallback(
    async (path: BreadcrumbItem[]) => {
      const target = path[path.length - 1]
      setCurrentPath(path)
      setCurrentFolderId(target?.id || null)
      if (target?.id) {
        await ensureTreeChildrenLoaded(target.id)
      }
    },
    [ensureTreeChildrenLoaded],
  )

  const openFolder = useCallback(
    async (folder: DriveItem) => {
      if (folder.type !== 'folder') return
      const nextPath = [...currentPath, { id: folder.id, name: folder.name }]
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        next.add(folder.id)
        return next
      })
      await navigateToPath(nextPath)
    },
    [currentPath, navigateToPath],
  )

  // ── CRUD helpers ─────────────────────────────────────────────────────────────
  const handleCreateFolder = useCallback(async () => {
    if (!folderName.trim()) return
    try {
      await api.createFolder(folderName.trim(), currentFolderId)
      setFolderName('')
      setIsCreatingFolder(false)
      await refreshData()
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }, [folderName, currentFolderId, refreshData])

  const handleRename = useCallback(
    async (item: DriveItem) => {
      const nextName = window.prompt('Rename item', item.name)
      if (!nextName || !nextName.trim() || nextName === item.name) return
      try {
        await api.renameItem(item.id, nextName.trim())
        await refreshData()
      } catch (error) {
        console.error('Failed to rename item:', error)
      }
    },
    [refreshData],
  )

  const handleDelete = useCallback(
    async (item: DriveItem, onDeleted?: (id: string) => void) => {
      const confirmed = window.confirm(`Delete "${item.name}"?`)
      if (!confirmed) return
      try {
        await api.deleteFile(item.id)
        onDeleted?.(item.id)
        await refreshData()
      } catch (error) {
        console.error('Failed to delete item:', error)
      }
    },
    [refreshData],
  )

  const handleDownload = useCallback(async (item: DriveItem, version?: number) => {
    if (item.type !== 'file') return
    try {
      const res =
        typeof version === 'number'
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
  }, [])

  // ── Clipboard helpers ─────────────────────────────────────────────────────────
  const handleCopy = useCallback((item: DriveItem) => {
    if (item.type === 'folder') {
      alert('Folder copy is not yet supported. You can move folders using Cut + Paste.')
      return
    }
    setClipboard({ item, mode: 'copy' })
  }, [])

  const handleCut = useCallback((item: DriveItem) => {
    setClipboard({ item, mode: 'cut' })
  }, [])

  const clearClipboard = useCallback(() => setClipboard(null), [])

  /**
   * Paste the clipboard item into `destinationFolderId`.
   * - cut  → move the item to the destination
   * - copy → move is used as a proxy until a server-side copy endpoint exists
   */
  const handlePaste = useCallback(
    async (destinationFolderId: string | null) => {
      if (!clipboard) return
      const { item, mode } = clipboard
      try {
        if (mode === 'cut') {
          await api.moveItem(item.id, destinationFolderId)
        } else {
          // Copy: re-use move for now (server-side copy can be added later)
          await api.moveItem(item.id, destinationFolderId)
        }
        setClipboard(null)
        await refreshData()
      } catch (error) {
        console.error('Failed to paste item:', error)
        alert(`Paste failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },
    [clipboard, refreshData],
  )

  /**
   * Move an item to a destination chosen by the user (e.g. from the Move dialog).
   */
  const handleMoveItem = useCallback(
    async (item: DriveItem, destinationFolderId: string | null) => {
      try {
        await api.moveItem(item.id, destinationFolderId)
        await refreshData()
      } catch (error) {
        console.error('Failed to move item:', error)
        alert(`Move failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },
    [refreshData],
  )

  return {
    // Listing
    items,
    currentFolderId,
    currentPath,
    loading,
    // Tree
    treeChildren,
    expandedFolders,
    expandedFiles,
    loadingTreeNodes,
    fileVersions,
    loadingFileVersions,
    // Folder creation
    isCreatingFolder,
    folderName,
    setIsCreatingFolder,
    setFolderName,
    // Clipboard
    clipboard,
    handleCopy,
    handleCut,
    handlePaste,
    handleMoveItem,
    clearClipboard,
    // Search
    searchQuery,
    setSearchQuery,
    // Actions
    refreshData,
    navigateToPath,
    openFolder,
    toggleTreeFolder,
    toggleTreeFile,
    ensureVersionsLoaded,
    ensureTreeChildrenLoaded,
    handleCreateFolder,
    handleRename,
    handleDelete,
    handleDownload,
    previewRequestRef,
  }
}
