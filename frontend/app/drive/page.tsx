'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { DriveItem, FileVersion } from '@/lib/api'
import { useDriveState, ROOT_CRUMB } from '@/hooks/useDriveState'
import { useIngestionTracking } from '@/hooks/useIngestionTracking'
import { AppLayout } from '@/components/layout/AppLayout'
import AuthGuard from '@/components/auth/auth-guard'
import UploadModal from '@/components/drive/upload-modal'
import { DriveHeader } from '@/components/drive/DriveHeader'
import { DriveContent, PreviewPanel, formatDate, formatFileSize } from '@/components/drive/DriveContent'
import { DriveSidebarTree } from '@/components/drive/DriveSidebarTree'
import { Button } from '@/components/ui/button'
import { ChevronRight, Folder } from 'lucide-react'

type ViewMode = 'list' | 'grid'
type SortBy = 'name' | 'updated' | 'size' | 'type'

const DEFAULT_PREVIEW_PANE_WIDTH = 460
const ROOT_KEY = '__ROOT__'

export default function DrivePage() {
  // ── Drive data + CRUD ───────────────────────────────────────────────────────
  const {
    items,
    currentFolderId,
    currentPath,
    loading,
    treeChildren,
    expandedFolders,
    expandedFiles,
    loadingTreeNodes,
    fileVersions,
    loadingFileVersions,
    isCreatingFolder,
    folderName,
    setIsCreatingFolder,
    setFolderName,
    refreshData,
    navigateToPath,
    openFolder,
    toggleTreeFolder,
    toggleTreeFile,
    ensureVersionsLoaded,
    handleCreateFolder,
    handleRename,
    handleDelete,
    handleDownload,
  } = useDriveState()

  // ── Preview state ────────────────────────────────────────────────────────────
  const [selectedItem, setSelectedItem] = useState<DriveItem | null>(null)
  const [previewVersion, setPreviewVersion] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewRequestRef = useRef(0)

  // ── Ingestion tracking ───────────────────────────────────────────────────────
  const ingestionByDocumentId = useIngestionTracking(items, selectedItem)

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  const [sortAsc, setSortAsc] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false)
  const [previewPaneWidth, setPreviewPaneWidth] = useState(DEFAULT_PREVIEW_PANE_WIDTH)
  const [isResizingPreviewPane, setIsResizingPreviewPane] = useState(false)
  const browseSectionRef = useRef<HTMLElement | null>(null)

  // ── Side-effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedItem?.type === 'file') void ensureVersionsLoaded(selectedItem.id)
  }, [selectedItem, ensureVersionsLoaded])

  useEffect(() => {
    // Tree panel is always open now
  }, [currentFolderId])

  useEffect(() => {
    if (!isResizingPreviewPane) return
    const onMove = (e: MouseEvent) => {
      if (!browseSectionRef.current) return
      const rect = browseSectionRef.current.getBoundingClientRect()
      const min = 320
      const max = Math.max(420, Math.min(760, rect.width * 0.65))
      setPreviewPaneWidth(Math.round(Math.max(min, Math.min(max, rect.right - e.clientX))))
    }
    const onUp = () => {
      setIsResizingPreviewPane(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isResizingPreviewPane])

  // ── Preview helpers ───────────────────────────────────────────────────────────
  const clearPreviewState = () => {
    previewRequestRef.current += 1
    setPreviewVersion(null)
    setPreviewUrl(null)
    setPreviewError(null)
    setPreviewLoading(false)
  }

  const openPreview = async (item: DriveItem, version?: number) => {
    if (item.type !== 'file') return
    setSelectedItem(item)
    const requestId = ++previewRequestRef.current
    setPreviewVersion(typeof version === 'number' ? version : null)
    setPreviewUrl(null)
    setPreviewError(null)
    setPreviewLoading(true)
    try {
      const { api } = await import('@/lib/api')
      const res =
        typeof version === 'number'
          ? await api.getVersionDownloadUrl(item.id, version)
          : await api.getDownloadUrl(item.id)
      if (requestId !== previewRequestRef.current) return
      setPreviewUrl(res.downloadUrl)
    } catch {
      if (requestId !== previewRequestRef.current) return
      setPreviewError('Could not load a preview URL for this file.')
    } finally {
      if (requestId === previewRequestRef.current) setPreviewLoading(false)
    }
  }

  // ── Sorted + filtered list ────────────────────────────────────────────────────
  const filteredAndSortedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items
    const sorted = [...filtered].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'updated')
        return new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime()
      if (sortBy === 'size') return (a.fileSize || 0) - (b.fileSize || 0)
      return (a.fileType || a.type).localeCompare(b.fileType || b.type)
    })
    return sortAsc ? sorted : sorted.reverse()
  }, [items, searchQuery, sortBy, sortAsc])

  const selectedVersions: FileVersion[] = useMemo(
    () => (selectedItem?.type === 'file' ? fileVersions[selectedItem.id] || [] : []),
    [selectedItem, fileVersions],
  )

  const currentFolderName = currentPath[currentPath.length - 1]?.name || ROOT_CRUMB.name
  const sortLabel = `${sortBy === 'updated' ? 'Date' : sortBy[0].toUpperCase() + sortBy.slice(1)} ${sortAsc ? 'Asc' : 'Desc'}`

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <AuthGuard>
      <AppLayout>
        <div className="flex flex-col h-screen p-4 md:p-6 lg:p-8 bg-background">
          <div className="flex flex-col flex-1 border border-border rounded-xl shadow-xl overflow-hidden bg-card min-h-0">
            {/* Action bar and Breadcrumb Combined */}
            <DriveHeader
              currentFolderName={currentFolderName}
              currentPath={currentPath}
              viewMode={viewMode}
              sortBy={sortBy}
              sortAsc={sortAsc}
              sortLabel={sortLabel}
              previewPanelOpen={previewPanelOpen}
              isCreatingFolder={isCreatingFolder}
              folderName={folderName}
              searchQuery={searchQuery}
              currentFolderId={currentFolderId}
              selectedItemId={selectedItem?.id ?? null}
              treeChildren={treeChildren}
              expandedFolders={expandedFolders}
              expandedFiles={expandedFiles}
              loadingTreeNodes={loadingTreeNodes}
              loadingFileVersions={loadingFileVersions}
              fileVersions={fileVersions}
              onTogglePreviewPanel={() => setPreviewPanelOpen((p) => !p)}
              onSetViewMode={setViewMode}
              onSetSortBy={setSortBy}
              onToggleSortAsc={() => setSortAsc((p) => !p)}
              onUploadClick={() => setUploadModalOpen(true)}
              onNewFolderClick={() => setIsCreatingFolder(true)}
              onRefresh={() => void refreshData(selectedItem?.id)}
              onFolderNameChange={setFolderName}
              onCreateFolder={() => void handleCreateFolder()}
              onCancelFolder={() => { setIsCreatingFolder(false); setFolderName('') }}
              onSearchChange={setSearchQuery}
              onNavigate={(path) => void navigateToPath(path)}
              onToggleFolder={(id) => void toggleTreeFolder(id)}
              onToggleFile={(id) => void toggleTreeFile(id)}
              onPreviewFile={(item, v) => void openPreview(item, v)}
              formatDate={formatDate}
            />

            {/* 3-column layout: tree | files | preview */}
            <section
              ref={browseSectionRef}
              className={`grid gap-0 overflow-hidden flex-1 min-h-0 ${
                previewPanelOpen
                  ? 'grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(320px,var(--preview-width))] lg:grid-cols-[minmax(200px,var(--tree-width,260px))_minmax(0,1fr)_minmax(320px,var(--preview-width))]'
                  : 'grid-cols-1 lg:grid-cols-[minmax(200px,var(--tree-width,260px))_minmax(0,1fr)]'
              }`}
              style={{ '--preview-width': `${previewPaneWidth}px` } as React.CSSProperties}
            >
              {/* Desktop sidebar tree */}
              <aside
                className="hidden lg:flex flex-col border-r border-border bg-accent/30 p-3 transition-all duration-300 overflow-hidden"
              >
                <div className="mb-1 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Locations
                </div>
                <button
                  type="button"
                  onClick={() => void navigateToPath([ROOT_CRUMB])}
                  className={`mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors ${
                    !currentFolderId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <Folder className={`h-4 w-4 ${!currentFolderId ? 'text-primary' : 'text-muted-foreground/70'}`} fill={!currentFolderId ? 'currentColor' : 'none'} fillOpacity={0.2} />
                  {ROOT_CRUMB.name}
                </button>
                {loadingTreeNodes.has(ROOT_KEY) ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">Loading structure...</p>
                ) : (
                  <DriveSidebarTree
                    parentId={null}
                    path={[ROOT_CRUMB]}
                    currentFolderId={currentFolderId}
                    selectedItemId={selectedItem?.id ?? null}
                    treeChildren={treeChildren}
                    expandedFolders={expandedFolders}
                    expandedFiles={expandedFiles}
                    loadingTreeNodes={loadingTreeNodes}
                    loadingFileVersions={loadingFileVersions}
                    fileVersions={fileVersions}
                    onNavigate={(path) => void navigateToPath(path)}
                    onToggleFolder={(id) => void toggleTreeFolder(id)}
                    onToggleFile={(id) => void toggleTreeFile(id)}
                    onPreviewFile={(item, v) => void openPreview(item, v)}
                    formatDate={formatDate}
                  />
                )}
              </aside>

              {/* File list / grid */}
              <div className="bg-card overflow-y-auto flex-1 min-w-0">
                <DriveContent
                  items={filteredAndSortedItems}
                  loading={loading}
                  viewMode={viewMode}
                  selectedItem={selectedItem}
                  ingestionByDocumentId={ingestionByDocumentId}
                  onSelectItem={(item) => { setSelectedItem(item); clearPreviewState() }}
                  onOpenFolder={(item) => void openFolder(item)}
                  onPreviewFile={(item, v) => void openPreview(item, v)}
                  onRename={(item) => void handleRename(item)}
                  onDelete={(item) =>
                    void handleDelete(item, (id) => {
                      if (selectedItem?.id === id) { setSelectedItem(null); clearPreviewState() }
                    })
                  }
                  onDownload={(item) => void handleDownload(item)}
                />
              </div>

              {/* Right-hand preview / metadata panel */}
              {previewPanelOpen && (
                <div className="border-l border-border bg-accent/30">
                  <PreviewPanel
                    selectedItem={selectedItem}
                    previewUrl={previewUrl}
                    previewLoading={previewLoading}
                    previewError={previewError}
                    previewVersion={previewVersion}
                    selectedVersions={selectedVersions}
                    ingestionByDocumentId={ingestionByDocumentId}
                    onDownload={(item, v) => void handleDownload(item, v)}
                    onPreviewVersion={(item, v) => void openPreview(item, v)}
                    onRefreshVersions={(id) => void ensureVersionsLoaded(id, true)}
                    onStartResize={() => setIsResizingPreviewPane(true)}
                    onResetWidth={() => setPreviewPaneWidth(DEFAULT_PREVIEW_PANE_WIDTH)}
                    formatDate={formatDate}
                    formatFileSize={formatFileSize}
                  />
                </div>
              )}
            </section>
          </div>
        </div>

        <UploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          currentFolderId={currentFolderId}
          onUploadSuccess={() => void refreshData()}
        />
      </AppLayout>
    </AuthGuard>
  )
}
