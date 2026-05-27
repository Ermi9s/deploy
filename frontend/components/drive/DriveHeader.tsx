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
  PanelRight,
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
  previewPanelOpen: boolean
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
  onTogglePreviewPanel: () => void
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
  previewPanelOpen,
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
  onTogglePreviewPanel,
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
    <header className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 border-b border-border bg-background shadow-sm z-10 sticky top-0 rounded-t-xl">
      <div className="min-w-0 flex items-center gap-2">
        <h1 className="text-lg font-display font-semibold text-foreground tracking-tight">{currentFolderName}</h1>
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

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
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
                className="h-8 w-32 text-sm rounded-md"
              />
              <Button size="sm" onClick={onCreateFolder} className="h-8 rounded-md px-2">
                Create
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelFolder} className="h-8 rounded-md px-2 text-muted-foreground">
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={onNewFolderClick} className="rounded-md h-8 px-2 text-muted-foreground hover:bg-accent hover:text-foreground">
              <FolderPlus className="h-4 w-4" />
            </Button>
          )}

          {/* Upload */}
          <Button size="sm" variant="ghost" onClick={onUploadClick} className="rounded-md h-8 px-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Upload className="h-4 w-4" />
          </Button>

          {/* Refresh */}
          <Button size="sm" variant="ghost" onClick={onRefresh} aria-label="Refresh" className="rounded-md h-8 px-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {/* View mode toggle */}
        <div className="flex items-center rounded-md border border-border bg-accent/50 p-0.5">
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
            <Button variant="ghost" size="sm" className="rounded-md h-8 px-2 text-muted-foreground hover:bg-accent hover:text-foreground">
              <ArrowDownUp className="h-4 w-4" />
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
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 w-48 text-sm rounded-md bg-accent/50 border-transparent focus-visible:bg-background focus-visible:border-primary transition-all"
          />
        </div>
        
        {/* Preview Panel Toggle */}
        <Button
          variant={previewPanelOpen ? "secondary" : "ghost"}
          size="sm"
          onClick={onTogglePreviewPanel}
          className="rounded-md h-8 px-2"
          aria-label="Toggle Preview Panel"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
