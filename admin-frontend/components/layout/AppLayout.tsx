'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { LucideIcon } from 'lucide-react'

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
}

interface AppLayoutProps {
  children: React.ReactNode
  navItems?: NavItem[]
  brandTitle?: string
  brandSubtitle?: string
  backLink?: { name: string; href: string; icon: LucideIcon; isExternal?: boolean }
}

export function AppLayout({ children, navItems, brandTitle, brandSubtitle, backLink }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        navItems={navItems}
        brandTitle={brandTitle}
        brandSubtitle={brandSubtitle}
        backLink={backLink}
      />
      
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
