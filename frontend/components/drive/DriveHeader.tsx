'use client'

import { Button } from '@/components/ui/button'
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
  ChevronDown,
  FolderPlus,
  LayoutPanelLeft,
  List,
  Grid3X3,
  Menu,
  Plus,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { BreadcrumbItem } from '@/hooks/useDriveState'
import { DriveItem } from '@/lib/api'
import { DriveSidebarTree } from './DriveSidebarTree'
import { FileVersion } from '@/lib/api'

type ViewMode = 'list' | 'grid'
type SortBy = 'name' | 'updated' | 'size' | 'type'

interface DriveHeaderProps {
  currentFolderName: string
  currentPath: BreadcrumbItem[]
  viewMode: ViewMode
  sortBy: SortBy
  sortAsc: boolean
  sortLabel: string
  treePanelOpen: boolean
  isCreatingFolder: boolean
  folderName: string
  searchQuery: string
  // Sidebar tree props (for mobile sheet)
  currentFolderId: string | null
  selectedItemId: string | null
  treeChildren: Record<string, DriveItem[]>
  expandedFolders: Set<string>
  expandedFiles: Set<string>
  loadingTreeNodes: Set<string>
  loadingFileVersions: Set<string>
  fileVersions: Record<string, FileVersion[]>
  onToggleTreePanel: () => void
  onSetViewMode: (mode: ViewMode) => void
  onSetSortBy: (by: SortBy) => void
  onToggleSortAsc: () => void
  onUploadClick: () => void
  onNewFolderClick: () => void
  onRefresh: () => void
  onFolderNameChange: (name: string) => void
  onCreateFolder: () => void
  onCancelFolder: () => void
  onSearchChange: (q: string) => void
  onNavigate: (path: BreadcrumbItem[]) => void
  onToggleFolder: (id: string) => void
  onToggleFile: (id: string) => void
  onPreviewFile: (item: DriveItem, version?: number) => void
  formatDate: (date?: string) => string
}

/**
 * Top action bar for the Drive browse view.
 * Contains: title/breadcrumb, view toggle, sort, upload, new folder, refresh,
 * and the mobile sidebar sheet trigger.
 */
export function DriveHeader({
  currentFolderName,
  currentPath,
  viewMode,
  sortBy,
  sortAsc,
  sortLabel,
  treePanelOpen,
  isCreatingFolder,
  folderName,
  searchQuery,
  currentFolderId,
  selectedItemId,
  treeChildren,
  expandedFolders,
  expandedFiles,
  loadingTreeNodes,
  loadingFileVersions,
  fileVersions,
  onToggleTreePanel,
  onSetViewMode,
  onSetSortBy,
  onToggleSortAsc,
  onUploadClick,
  onNewFolderClick,
  onRefresh,
  onFolderNameChange,
  onCreateFolder,
  onCancelFolder,
  onSearchChange,
  onNavigate,
  onToggleFolder,
  onToggleFile,
  onPreviewFile,
  formatDate,
}: DriveHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-4 shadow-sm">
      <div className="min-w-0">
        <h1 className="text-xl font-display font-semibold text-foreground tracking-tight">Object Browser</h1>
        <p className="text-sm text-muted-foreground">{currentFolderName}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Desktop: toggle sidebar tree panel */}
        <Button
          variant="outline"
          size="sm"
          className="hidden lg:inline-flex rounded-full bg-background"
          onClick={onToggleTreePanel}
        >
          <LayoutPanelLeft className="mr-2 h-4 w-4" />
          {treePanelOpen ? 'Hide Tree' : 'Show Tree'}
        </Button>

        {/* Mobile: sidebar tree in a Sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden rounded-full bg-background">
              <Menu className="mr-2 h-4 w-4" />
              Tree
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0 border-r border-border bg-card">
            <SheetHeader className="border-b border-border px-4 py-4 bg-background/50">
              <SheetTitle className="text-sm font-semibold text-foreground font-display">
                Folder Tree
              </SheetTitle>
              <SheetDescription className="sr-only">
                Navigate your drive folder structure
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto p-4">
              <DriveSidebarTree
                parentId={null}
                path={[{ id: null, name: 'My Drive' }]}
                currentFolderId={currentFolderId}
                selectedItemId={selectedItemId}
                treeChildren={treeChildren}
                expandedFolders={expandedFolders}
                expandedFiles={expandedFiles}
                loadingTreeNodes={loadingTreeNodes}
                loadingFileVersions={loadingFileVersions}
                fileVersions={fileVersions}
                onNavigate={onNavigate}
                onToggleFolder={onToggleFolder}
                onToggleFile={onToggleFile}
                onPreviewFile={onPreviewFile}
                formatDate={formatDate}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* View mode toggle */}
        <div className="flex items-center rounded-full border border-border bg-accent/50 p-1">
          <button
            type="button"
            onClick={() => onSetViewMode('list')}
            className={`rounded-full px-3 py-1.5 transition-all text-sm font-medium ${
              viewMode === 'list'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onSetViewMode('grid')}
            className={`rounded-full px-3 py-1.5 transition-all text-sm font-medium ${
              viewMode === 'grid'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
            aria-label="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
        </div>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full bg-background">
              <ArrowDownUp className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              {sortLabel}
              <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl">
            {(['name', 'updated', 'size', 'type'] as SortBy[]).map((option) => (
              <DropdownMenuItem key={option} onClick={() => onSetSortBy(option)}>
                {option === 'updated' ? 'Date modified' : option[0].toUpperCase() + option.slice(1)}
                {sortBy === option && <span className="ml-auto opacity-60 text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={onToggleSortAsc}>
              {sortAsc ? 'Descending' : 'Ascending'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="relative hidden md:block">
          <Input
            id="drive-search"
            placeholder="Search files…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-48 text-sm rounded-full bg-accent/50 border-transparent focus-visible:bg-background focus-visible:border-primary transition-all"
          />
        </div>

        {/* Upload */}
        <Button size="sm" onClick={onUploadClick} className="rounded-full h-9">
          <Upload className="mr-1.5 h-4 w-4" />
          Upload
        </Button>

        {/* New Folder */}
        {isCreatingFolder ? (
          <div className="flex items-center gap-2">
            <Input
              id="new-folder-name"
              autoFocus
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => onFolderNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCreateFolder()
                if (e.key === 'Escape') onCancelFolder()
              }}
              className="h-9 w-36 text-sm rounded-full"
            />
            <Button size="sm" onClick={onCreateFolder} className="h-9 rounded-full">
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelFolder} className="h-9 rounded-full text-muted-foreground">
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={onNewFolderClick} className="rounded-full bg-background h-9">
            <FolderPlus className="mr-1.5 h-4 w-4 text-muted-foreground" />
            New Folder
          </Button>
        )}

        {/* Refresh */}
        <Button size="sm" variant="ghost" onClick={onRefresh} aria-label="Refresh" className="rounded-full h-9 w-9 p-0 text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
