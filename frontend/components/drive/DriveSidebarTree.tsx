'use client'

import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react'
import { DriveItem, FileVersion } from '@/lib/api'
import { BreadcrumbItem } from '@/hooks/useDriveState'

interface DriveSidebarTreeProps {
  parentId: string | null
  path: BreadcrumbItem[]
  currentFolderId: string | null
  selectedItemId: string | null
  treeChildren: Record<string, DriveItem[]>
  expandedFolders: Set<string>
  expandedFiles: Set<string>
  loadingTreeNodes: Set<string>
  loadingFileVersions: Set<string>
  fileVersions: Record<string, FileVersion[]>
  onNavigate: (path: BreadcrumbItem[]) => void
  onToggleFolder: (folderId: string) => void
  onToggleFile: (fileId: string) => void
  onPreviewFile: (item: DriveItem, version?: number) => void
  formatDate: (date?: string) => string
}

const ROOT_KEY = '__ROOT__'

function parentKey(parentId: string | null): string {
  return parentId || ROOT_KEY
}

/**
 * Recursive sidebar folder/file tree.
 * Renders folders with expandable children and files with version history.
 */
export function DriveSidebarTree({
  parentId,
  path,
  currentFolderId,
  selectedItemId,
  treeChildren,
  expandedFolders,
  expandedFiles,
  loadingTreeNodes,
  loadingFileVersions,
  fileVersions,
  onNavigate,
  onToggleFolder,
  onToggleFile,
  onPreviewFile,
  formatDate,
}: DriveSidebarTreeProps) {
  const key = parentKey(parentId)
  const nodes = treeChildren[key] || []

  if (nodes.length === 0) return null

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
                className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleFolder(node.id)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent transition-colors"
                  aria-label={`Toggle ${node.name}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate(nextPath)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                >
                  <Folder className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} fill={isActive ? 'currentColor' : 'none'} fillOpacity={0.2} />
                  <span className="truncate">{node.name}</span>
                </button>
              </div>

              {isExpanded && (
                <div className="ml-4 border-l border-border pl-2">
                  {loadingChildren ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground">Loading...</p>
                  ) : (
                    <DriveSidebarTree
                      parentId={node.id}
                      path={nextPath}
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
                  )}
                </div>
              )}
            </li>
          )
        }

        // File node
        const isSelected = selectedItemId === node.id
        const isExpanded = expandedFiles.has(node.id)
        const versions = fileVersions[node.id] || []
        const versionsLoading = loadingFileVersions.has(node.id)

        return (
          <li key={node.id}>
            <div
              className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
              }`}
            >
              <button
                type="button"
                onClick={() => onToggleFile(node.id)}
                className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent transition-colors"
                aria-label={`Toggle versions for ${node.name}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onPreviewFile(node)}
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
              >
                <File className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-slate-400'}`} />
                <span className="truncate">{node.name}</span>
              </button>
            </div>

            {isExpanded && (
              <div className="ml-4 border-l border-border pl-2">
                {versionsLoading && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">Loading versions...</p>
                )}
                {!versionsLoading && versions.length === 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No versions</p>
                )}
                {!versionsLoading && versions.length > 0 && (
                  <ul className="space-y-1">
                    {versions.map((version, index) => (
                      <li key={version.id}>
                        <button
                          type="button"
                          onClick={() => onPreviewFile(node, version.version)}
                          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors font-medium"
                        >
                          <span>{`v${version.version}${index === 0 ? ' (latest)' : ''}`}</span>
                          <span className="opacity-70">{formatDate(version.createdAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
