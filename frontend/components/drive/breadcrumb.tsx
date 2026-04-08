'use client'

import { Button } from '@/components/ui/button'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  id: string | null
  name: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  onNavigate: (folderId: string | null) => void
}

export default function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 h-auto px-2 py-1"
        onClick={() => onNavigate(null)}
      >
        <Home className="w-4 h-4" />
        My Drive
      </Button>

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1"
            onClick={() => onNavigate(item.id)}
          >
            {item.name}
          </Button>
        </div>
      ))}
    </div>
  )
}
