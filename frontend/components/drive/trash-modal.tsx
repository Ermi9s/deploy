'use client'

import { useEffect, useState } from 'react'
import { X, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'

interface TrashItem {
  id: string
  name: string
  type: 'file' | 'folder'
  deletedAt?: string | null
}

interface TrashModalProps {
  onClose: () => void
}

export default function TrashModal({ onClose }: TrashModalProps) {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTrash()
  }, [])

  const loadTrash = async () => {
    try {
      const data = await api.listTrash()
      setItems(data.items || [])
    } catch (error) {
      console.error('Failed to load trash:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (item: TrashItem) => {
    try {
      await api.restoreItem(item.id)
      await loadTrash()
    } catch (error) {
      console.error('Failed to restore item:', error)
    }
  }

  const handleDeletePermanent = async (item: TrashItem) => {
    try {
      await api.deleteFile(item.id, true)
      await loadTrash()
    } catch (error) {
      console.error('Failed to permanently delete item:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-red-50 to-orange-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Trash</h2>
            <p className="text-sm text-gray-600 mt-1">Items deleted more than 30 days ago will be automatically removed</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-500">Loading trash...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-500">Trash is empty</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Deleted {item.deletedAt
                        ? new Date(item.deletedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                        : 'unknown date'}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(item)}
                      className="border-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleDeletePermanent(item)}
                      title="Delete permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
