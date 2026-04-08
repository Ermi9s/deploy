'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TrashModal from './trash-modal'

export default function TrashButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Trash
      </Button>
      {isOpen && <TrashModal onClose={() => setIsOpen(false)} />}
    </>
  )
}
