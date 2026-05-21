'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api, clearStoredTokens, AuthUser } from '@/lib/api'
import { LayoutDashboard, ShieldAlert, Network, Users, History, LogOut, Loader2, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Departments', href: '/admin/departments', icon: Network },
  { label: 'Users & Clearances', href: '/admin/users', icon: Users },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: History },
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-medium tracking-wide text-slate-400">Loading OKM Administrative Panel...</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
          <div className="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-2">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Access Denied</h1>
            <p className="text-sm text-slate-400">
              This area is restricted to site administrators. Your account ({user?.email}) does not have superuser privileges.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300" onClick={() => router.push('/drive')}>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* Premium Sidebar */}
      <aside className="w-64 border-r border-slate-800/60 bg-slate-900/40 backdrop-blur-xl flex flex-col justify-between shrink-0 select-none">
        <div className="p-6">
          <div className="flex items-center gap-3 px-2 py-1 mb-8">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-lg">
              Ω
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-tight text-slate-200 uppercase leading-none">OKNowledge</h2>
              <span className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">Admin Panel</span>
            </div>
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group relative ${
                    active
                      ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400 border-l-2 border-indigo-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="p-6 space-y-4 border-t border-slate-800/60 bg-slate-900/20">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
              {user?.email?.[0] || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-300 truncate leading-none mb-1">{user?.first_name || 'Admin'}</p>
              <p className="text-[10px] text-slate-500 truncate leading-none">{user?.email}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-slate-800 hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs py-2"
              onClick={() => router.push('/drive')}
            >
              <Home className="w-3.5 h-3.5 mr-1.5" /> Portal
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-slate-800 hover:bg-red-950/20 hover:text-red-400 text-slate-400 text-xs py-2"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Exit
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 min-w-0 flex flex-col bg-slate-950">
        <header className="h-16 border-b border-slate-800/40 flex items-center justify-between px-8 bg-slate-900/10 backdrop-blur-md sticky top-0 z-40">
          <h1 className="text-sm font-semibold tracking-tight text-slate-300">
            {NAV_ITEMS.find((item) => pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href)))?.label || 'Administrative Overview'}
          </h1>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-slate-500 font-medium tracking-wide">Live Connection Connected</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 max-w-7xl w-full mx-auto space-y-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  )
}
