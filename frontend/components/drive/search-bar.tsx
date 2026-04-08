'use client'

import { useState } from 'react'
import { Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SearchBarProps {
  onSearch: (query: string) => void
  onFilterChange: (filter: string) => void
}

export default function SearchBar({ onSearch, onFilterChange }: SearchBarProps) {
  const [query, setQuery] = useState('')

  const handleSearch = (value: string) => {
    setQuery(value)
    onSearch(value)
  }

  const fileTypes = [
    { label: 'All Files', value: '' },
    { label: 'Images', value: 'image' },
    { label: 'PDFs', value: 'application/pdf' },
    { label: 'Documents', value: 'document' },
    { label: 'Videos', value: 'video' },
  ]

  return (
    <div className="flex gap-2 items-center">
      <div className="flex-1 relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          placeholder="Search files and folders..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-12 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            className="border-gray-300 hover:bg-gray-100"
          >
            <Filter className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {fileTypes.map((type) => (
            <DropdownMenuItem
              key={type.value}
              onClick={() => onFilterChange(type.value)}
              className="cursor-pointer"
            >
              {type.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
