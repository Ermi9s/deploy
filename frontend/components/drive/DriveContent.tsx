'use client'

import { DriveItem, FileVersion, IngestionStatusSnapshot } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CheckCircle2,
  ExternalLink,
  File,
  FileText,
  Folder,
  Image as ImageIcon,
  MoreHorizontal,
  Table2,
  XCircle,
} from 'lucide-react'
import AllFileViewer from '@/components/drive/all-file-viewer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ── Utility helpers ─────────────────────────────────────────────────────────

export function clampProgress(progress?: number): number {
  if (typeof progress !== 'number' || Number.isNaN(progress)) return 0
  return Math.max(0, Math.min(100, progress))
}

export function formatStage(stage?: string): string {
  if (!stage) return 'pending'
  return stage.replace(/[_-]/g, ' ')
}

export function formatDate(date?: string): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatFileSize(bytes?: number): string {
  const value = bytes || 0
  if (value === 0) return '-'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(value) / Math.log(k))
  return `${Math.round((value / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
}

export function iconForFile(mimeType?: string) {
  if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />
  if (mimeType.includes('sheet') || mimeType.includes('excel'))
    return <Table2 className="h-5 w-5 text-emerald-500" />
  if (mimeType.includes('image')) return <ImageIcon className="h-5 w-5 text-orange-500" />
  if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-rose-500" />
  return <File className="h-5 w-5 text-muted-foreground" />
}

// ── Ingestion status badge ───────────────────────────────────────────────────

interface IngestionStatusProps {
  item: DriveItem
  ingestionByDocumentId: Record<string, IngestionStatusSnapshot>
}

export function IngestionStatusCell({ item, ingestionByDocumentId }: IngestionStatusProps) {
  if (item.type !== 'file') return <span className="text-xs text-slate-400">-</span>
  if (!item.sourceDocumentId)
    return (
      <Badge variant="outline" className="text-[10px] text-slate-500">
        Not linked
      </Badge>
    )

  const snapshot = item.sourceDocumentId ? ingestionByDocumentId[item.sourceDocumentId] : null
  if (!snapshot)
    return (
      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200">
        Pending
      </Badge>
    )

  const progress = clampProgress(snapshot.progress)
  const status = snapshot.status.toLowerCase()

  if (status === 'completed')
    return (
      <Badge className="bg-emerald-600 text-white">
        <CheckCircle2 className="h-3 w-3" />
        Ingested
      </Badge>
    )

  if (status === 'failed')
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    )

  return (
    <div className="min-w-[140px] space-y-1">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="truncate">{formatStage(snapshot.stage)}</span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  )
}

// ── File / folder grid + list ─────────────────────────────────────────────────

type ViewMode = 'list' | 'grid'

interface DriveContentProps {
  items: DriveItem[]
  loading: boolean
  viewMode: ViewMode
  selectedItem: DriveItem | null
  ingestionByDocumentId: Record<string, IngestionStatusSnapshot>
  onSelectItem: (item: DriveItem) => void
  onOpenFolder: (item: DriveItem) => void
  onPreviewFile: (item: DriveItem, version?: number) => void
  onRename: (item: DriveItem) => void
  onDelete: (item: DriveItem) => void
  onDownload: (item: DriveItem) => void
}

export function DriveContent({
  items,
  loading,
  viewMode,
  selectedItem,
  ingestionByDocumentId,
  onSelectItem,
  onOpenFolder,
  onPreviewFile,
  onRename,
  onDelete,
  onDownload,
}: DriveContentProps) {
  if (loading) {
    return (
      <p className="px-4 py-6 text-sm text-muted-foreground">Loading items...</p>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-medium text-foreground">No items here yet</p>
        <p className="text-sm text-muted-foreground">Upload files or create a folder to get started.</p>
      </div>
    )
  }

  const handleClick = (item: DriveItem) => {
    if (item.type === 'file') onPreviewFile(item)
    else onSelectItem(item)
  }

  const handleDoubleClick = (item: DriveItem) => {
    if (item.type === 'folder') onOpenFolder(item)
    else onPreviewFile(item)
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 p-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`group relative flex flex-col items-center rounded-lg p-2 text-center transition-all duration-200 ${
              selectedItem?.id === item.id
                ? 'bg-primary/10 ring-1 ring-primary/20'
                : 'hover:bg-accent/50'
            }`}
            onClick={() => handleClick(item)}
            onDoubleClick={() => handleDoubleClick(item)}
          >
            <div className="relative mb-2 flex items-center justify-center h-16 w-16">
              <div className={`p-3 rounded-2xl transition-colors ${selectedItem?.id === item.id ? 'bg-primary/20' : 'bg-muted group-hover:bg-background'}`}>
                {item.type === 'folder' ? (
                  <Folder className="h-10 w-10 text-primary" fill="currentColor" fillOpacity={0.2} />
                ) : (
                  <div className="scale-150">
                    {iconForFile(item.fileType)}
                  </div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -top-1 -right-1 h-6 w-6 p-0 rounded-full bg-background border border-border opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shadow-sm"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48 rounded-xl">
                  {item.type === 'file' && (
                    <DropdownMenuItem onClick={() => onPreviewFile(item)}>Preview</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onRename(item)}>Rename</DropdownMenuItem>
                  {item.type === 'file' && (
                    <DropdownMenuItem onClick={() => onDownload(item)}>Download</DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => onDelete(item)}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className={`w-full truncate text-xs font-medium px-1 py-0.5 rounded ${selectedItem?.id === item.id ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
              {item.name}
            </p>
            {item.type === 'file' && item.sourceDocumentId && (
               <div className="mt-1 scale-90 origin-top">
                 <IngestionStatusCell item={item} ingestionByDocumentId={ingestionByDocumentId} />
               </div>
            )}
          </button>
        ))}
      </div>
    )
  }

  // List view
  return (
    <div className="w-full">
      <div className="grid grid-cols-12 border-b border-border bg-background px-4 py-2 text-[11px] font-semibold text-muted-foreground sticky top-0 z-10">
        <div className="col-span-6">Name</div>
        <div className="col-span-2">Date Modified</div>
        <div className="col-span-2">Size</div>
        <div className="col-span-2">Kind</div>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div
            key={item.id}
            className={`group grid cursor-pointer grid-cols-12 items-center px-4 py-1.5 text-sm transition-colors ${
              selectedItem?.id === item.id ? 'bg-primary/10' : 'hover:bg-accent/30'
            }`}
            onClick={() => handleClick(item)}
            onDoubleClick={() => handleDoubleClick(item)}
          >
            <div className="col-span-6 flex min-w-0 items-center gap-2 pr-4">
              <div className="flex items-center justify-center w-6 h-6">
                {item.type === 'folder' ? (
                  <Folder className="h-4 w-4 text-primary" fill="currentColor" fillOpacity={0.2} />
                ) : (
                  iconForFile(item.fileType)
                )}
              </div>
              <div className="min-w-0 flex-1 flex items-center gap-2">
                <span className={`block truncate font-medium ${selectedItem?.id === item.id ? 'text-primary' : 'text-foreground'}`}>
                  {item.name}
                </span>
              </div>
            </div>
            <div className="col-span-2 text-muted-foreground text-xs">
              {formatDate(item.updatedAt || item.createdAt)}
            </div>
            <div className="col-span-2 text-muted-foreground text-xs">
              {item.type === 'folder' ? '--' : formatFileSize(item.fileSize)}
            </div>
            <div className="col-span-2 flex items-center justify-between text-muted-foreground text-xs capitalize pr-2">
              <span>{item.type === 'folder' ? 'Folder' : item.fileType?.split('/')[1] || 'File'}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 w-6 p-0 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                  {item.type === 'file' && (
                    <DropdownMenuItem onClick={() => onPreviewFile(item)}>Preview</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onRename(item)}>Rename</DropdownMenuItem>
                  {item.type === 'file' && (
                    <DropdownMenuItem onClick={() => onDownload(item)}>Download</DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => onDelete(item)}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Preview / metadata / AI right-hand panel ────────────────────────────────

interface PreviewPanelProps {
  selectedItem: DriveItem | null
  previewUrl: string | null
  previewLoading: boolean
  previewError: string | null
  previewVersion: number | null
  selectedVersions: FileVersion[]
  ingestionByDocumentId: Record<string, IngestionStatusSnapshot>
  onDownload: (item: DriveItem, version?: number) => void
  onPreviewVersion: (item: DriveItem, version: number) => void
  onRefreshVersions: (itemId: string) => void
  onStartResize: () => void
  onResetWidth: () => void
  formatDate: (date?: string) => string
  formatFileSize: (bytes?: number) => string
}

export function PreviewPanel({
  selectedItem,
  previewUrl,
  previewLoading,
  previewError,
  previewVersion,
  selectedVersions,
  ingestionByDocumentId,
  onDownload,
  onPreviewVersion,
  onRefreshVersions,
  onStartResize,
  onResetWidth,
  formatDate,
  formatFileSize,
}: PreviewPanelProps) {
  return (
    <aside className="relative hidden rounded-xl border border-border bg-card p-4 md:sticky md:top-4 md:flex md:h-[calc(100vh-7.5rem)] md:flex-col md:overflow-hidden">
      {/* Resize handle */}
      <button
        type="button"
        onMouseDown={onStartResize}
        onDoubleClick={onResetWidth}
        className="absolute -left-2 top-1/2 z-20 hidden h-16 w-4 -translate-y-1/2 cursor-col-resize items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground md:flex"
        aria-label="Resize preview panel"
        title="Drag to resize. Double-click to reset."
      >
        <span className="h-8 w-[2px] rounded bg-current" />
      </button>

      <Tabs defaultValue="preview" className="flex h-full flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        {/* Preview tab */}
        <TabsContent value="preview" className="mt-3 min-h-0 flex-1 overflow-hidden">
          {selectedItem?.type === 'file' ? (
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="truncate text-sm font-medium text-foreground"
                  title={selectedItem.name}
                >
                  {selectedItem.name}
                </p>
                <div className="flex items-center gap-1">
                  {previewUrl && (
                    <Button asChild variant="ghost" size="sm" title="Open in new tab">
                      <a href={previewUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onDownload(
                        selectedItem,
                        previewVersion === null ? undefined : previewVersion,
                      )
                    }
                  >
                    Download
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30">
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
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
              Select a file to preview it inline.
            </div>
          )}
        </TabsContent>

        {/* Metadata tab */}
        <TabsContent value="metadata" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {selectedItem ? (
            <div className="space-y-3 text-sm">
              {[
                { label: 'Name', value: selectedItem.name },
                {
                  label: 'Type',
                  value:
                    selectedItem.type === 'folder'
                      ? 'Folder'
                      : selectedItem.fileType || 'File',
                },
                {
                  label: 'Size',
                  value:
                    selectedItem.type === 'folder'
                      ? '-'
                      : formatFileSize(selectedItem.fileSize),
                },
                { label: 'Created', value: formatDate(selectedItem.createdAt) },
                {
                  label: 'Modified',
                  value: formatDate(selectedItem.updatedAt || selectedItem.createdAt),
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-muted-foreground">{label}</p>
                  <p className="font-medium text-foreground">{value}</p>
                </div>
              ))}

              <div>
                <p className="text-muted-foreground">Ingestion</p>
                <div className="mt-1">
                  <IngestionStatusCell
                    item={selectedItem}
                    ingestionByDocumentId={ingestionByDocumentId}
                  />
                </div>
                {selectedItem.type === 'file' &&
                  selectedItem.sourceDocumentId &&
                  ingestionByDocumentId[selectedItem.sourceDocumentId]?.message && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ingestionByDocumentId[selectedItem.sourceDocumentId].message}
                    </p>
                  )}
              </div>

              {selectedItem.type === 'file' && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-muted-foreground">Versions</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRefreshVersions(selectedItem.id)}
                    >
                      Refresh
                    </Button>
                  </div>
                  {selectedVersions.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70">No versions yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {selectedVersions.map((v, i) => (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => onPreviewVersion(selectedItem, v.version)}
                            className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <span>{`v${v.version}${i === 0 ? ' (latest)' : ''}`}</span>
                            <span>{formatDate(v.createdAt)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a file or folder to view metadata.</p>
          )}
        </TabsContent>

      </Tabs>
    </aside>
  )
}
