'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, DriveItem } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronRight, Folder, FolderOpen, Home, Loader2 } from 'lucide-react'

interface FolderNode {
  id: string | null
  name: string
  children?: FolderNode[]
  loaded?: boolean
}

interface MoveDialogProps {
  open: boolean
  item: DriveItem | null
  onOpenChange: (open: boolean) => void
  onMove: (item: DriveItem, destinationFolderId: string | null) => Promise<void>
}

// Recursive folder row inside the picker
function FolderRow({
  node,
  depth,
  selectedId,
  disabledId,
  onSelect,
}: {
  node: FolderNode
  depth: number
  selectedId: string | null | undefined
  disabledId: string | undefined
  onSelect: (id: string | null, name: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FolderNode[] | null>(null)
  const [loading, setLoading] = useState(false)

  const isDisabled = node.id === disabledId
  const isSelected = node.id === selectedId

  const toggle = useCallback(async () => {
    if (isDisabled) return
    if (!expanded && children === null) {
      setLoading(true)
      try {
        const data = await api.listFiles(node.id)
        const folders = data.items
          .filter((i) => i.type === 'folder')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((i) => ({ id: i.id, name: i.name }))
        setChildren(folders)
      } catch {
        setChildren([])
      } finally {
        setLoading(false)
      }
    }
    setExpanded((p) => !p)
  }, [expanded, children, node.id, isDisabled])

  return (
    <div>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => {
          if (!isDisabled) {
            onSelect(node.id, node.name)
            void toggle()
          }
        }}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
          isDisabled
            ? 'cursor-not-allowed text-muted-foreground/40'
            : isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-accent/50 text-foreground'
        }`}
        style={{ paddingLeft: `${(depth + 1) * 16}px` }}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation()
              void toggle()
            }}
          />
        )}
        {expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {expanded && children && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FolderRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              disabledId={disabledId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {expanded && children && children.length === 0 && (
        <p
          className="text-xs text-muted-foreground/60 italic"
          style={{ paddingLeft: `${(depth + 2) * 16}px` }}
        >
          No sub-folders
        </p>
      )}
    </div>
  )
}

export function MoveDialog({ open, item, onOpenChange, onMove }: MoveDialogProps) {
  const [rootFolders, setRootFolders] = useState<FolderNode[]>([])
  const [loadingRoot, setLoadingRoot] = useState(false)
  const [selectedDestId, setSelectedDestId] = useState<string | null | undefined>(undefined)
  const [selectedDestName, setSelectedDestName] = useState<string>('My Drive')
  const [moving, setMoving] = useState(false)

  // Reset selection each time dialog opens
  useEffect(() => {
    if (!open) return
    setSelectedDestId(undefined)
    setSelectedDestName('My Drive')
    setLoadingRoot(true)
    api
      .listFiles(null)
      .then((data) => {
        const folders = data.items
          .filter((i) => i.type === 'folder')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((i) => ({ id: i.id, name: i.name }))
        setRootFolders(folders)
      })
      .catch(() => setRootFolders([]))
      .finally(() => setLoadingRoot(false))
  }, [open])

  const handleConfirm = async () => {
    if (!item || selectedDestId === undefined) return
    setMoving(true)
    try {
      await onMove(item, selectedDestId)
      onOpenChange(false)
    } finally {
      setMoving(false)
    }
  }

  const isMoveRootSelected = selectedDestId === null
  const isRootRow = selectedDestId === undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Move &quot;{item?.name}&quot;</DialogTitle>
          <DialogDescription>
            Choose a destination folder. Select &quot;My Drive&quot; to move to the root.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-72 rounded-lg border border-border bg-muted/30 p-2">
          {/* Root row */}
          <button
            type="button"
            onClick={() => { setSelectedDestId(null); setSelectedDestName('My Drive') }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              isMoveRootSelected
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-accent/50 text-foreground'
            }`}
          >
            <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>My Drive (root)</span>
          </button>

          {loadingRoot ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            rootFolders.map((node) => (
              <FolderRow
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedDestId}
                disabledId={item?.type === 'folder' ? item.id : undefined}
                onSelect={(id, name) => { setSelectedDestId(id); setSelectedDestName(name) }}
              />
            ))
          )}
        </ScrollArea>

        <p className="text-xs text-muted-foreground mt-1">
          Destination:{' '}
          <span className="font-medium text-foreground">
            {selectedDestId === undefined ? 'None selected' : selectedDestName}
          </span>
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={selectedDestId === undefined || moving}
          >
            {moving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
