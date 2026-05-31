'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { 
  MessageSquare, 
  Settings, 
  Brain,
  LogOut,
  ChevronRight,
  HardDrive,
  Search,
  Bell,
  Sun,
  Moon,
  User,
  FileText,
  Calendar,
  ClipboardList
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { clearStoredTokens, api } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  navItems?: { name: string; href: string; icon: any }[]
  brandTitle?: string
  brandSubtitle?: string
  backLink?: { name: string; href: string; icon: any; isExternal?: boolean }
}

const DEFAULT_NAV_ITEMS = [
  { name: 'My Drive', href: '/drive', icon: HardDrive },
  { name: 'AI Chat', href: '/chat', icon: MessageSquare },
  { name: 'Report', href: '/report', icon: FileText },
  { name: 'Planning', href: '/planning', icon: ClipboardList },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Settings', href: '/profile', icon: Settings },
]

export function Sidebar({ collapsed = false, onToggle, navItems, brandTitle, brandSubtitle, backLink }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { setTheme, theme } = useTheme()


  const handleLogout = () => {
    clearStoredTokens()
    router.replace('/login')
  }


  return (
    <motion.aside 
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="flex flex-col h-screen bg-card border-r border-border shrink-0 z-20 relative"
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        <div className={cn("flex items-center gap-3 w-full", collapsed && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Brain className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn("text-lg font-display font-semibold tracking-tight truncate", brandSubtitle && "leading-none mt-0.5")}
              >
                {brandTitle || 'OKM'}
              </motion.span>
              {brandSubtitle && (
                <span className="text-[10px] text-muted-foreground font-semibold tracking-widest uppercase leading-none mt-1">
                  {brandSubtitle}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {(navItems || DEFAULT_NAV_ITEMS).map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && item.href !== '/drive' && pathname?.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {!collapsed && (
                <span className="truncate">{item.name}</span>
              )}
              {isActive && !collapsed && (
                <motion.div layoutId="sidebar-active-indicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border shrink-0 flex flex-col gap-2">
        {backLink && (
          backLink.isExternal ? (
            <a
              href={backLink.href}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground mb-1",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? backLink.name : undefined}
            >
              <backLink.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{backLink.name}</span>}
            </a>
          ) : (
            <Link
              href={backLink.href}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground mb-1",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? backLink.name : undefined}
            >
              <backLink.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{backLink.name}</span>}
            </Link>
          )
        )}
        <div className={cn("flex items-center gap-1 mb-1 w-full", collapsed ? "flex-col" : "justify-between px-1")}>
          {/* Search */}
          <button className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Search">
            <Search className="h-4 w-4" />
          </button>


          {/* Theme Toggle */}
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors relative flex items-center justify-center" 
            title="Toggle Theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors outline-none" title="My Account">
                <User className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={collapsed ? "start" : "end"} side={collapsed ? "right" : "top"} sideOffset={8} className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/drive">My Drive</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? 'Log out' : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="truncate">Log out</span>}
        </button>
      </div>

      {/* Collapse Toggle Button */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-transform hover:bg-accent hover:text-foreground"
          style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </motion.aside>
  )
}
