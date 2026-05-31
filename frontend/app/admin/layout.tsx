'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api, clearStoredTokens, AuthUser } from '@/lib/api'
import { LayoutDashboard, ShieldAlert, Network, Users, History, LogOut, Loader2, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout/AppLayout'

const ADMIN_NAV_ITEMS = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Departments', href: '/admin/departments', icon: Network },
  { name: 'Users & Clearances', href: '/admin/users', icon: Users },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: History },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await api.getCurrentUser()
        setUser(currentUser)
        if (currentUser.is_superuser) {
          setAuthorized(true)
        } else {
          // Redirect standard users back to main drive
          router.replace('/drive')
        }
      } catch (err) {
        clearStoredTokens()
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  const handleLogout = () => {
    api.logout()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-medium tracking-wide text-muted-foreground">Loading OKM Administrative Panel...</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6 bg-card border border-border p-8 rounded-2xl shadow-lg">
          <div className="mx-auto w-16 h-16 bg-destructive/10 border border-destructive/20 rounded-full flex items-center justify-center text-destructive mb-2">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Access Denied</h1>
            <p className="text-sm text-muted-foreground">
              This area is restricted to site administrators. Your account ({user?.email}) does not have superuser privileges.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push('/drive')}>
              <Home className="w-4 h-4 mr-2" /> Go to Drive
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AppLayout 
      navItems={ADMIN_NAV_ITEMS}
      brandTitle="OKM Admin"
      brandSubtitle="Admin Panel"
      backLink={{ name: 'Return to Portal', href: '/drive', icon: Home }}
    >
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/40 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          {ADMIN_NAV_ITEMS.find((item) => pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href)))?.name || 'Administrative Overview'}
        </h1>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-muted-foreground font-medium tracking-wide">Live Connection Connected</span>
        </div>
      </header>
      
      <div className="p-6 max-w-7xl w-full mx-auto space-y-8 animate-in fade-in duration-500">
        {children}
      </div>
    </AppLayout>
  )
}
