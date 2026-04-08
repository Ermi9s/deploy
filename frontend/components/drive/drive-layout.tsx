'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  CircleUserRound,
  Cloud,
  FolderOpen,
  Users,
  Clock3,
  Star,
} from 'lucide-react'
import { api, getStoredTokens } from '@/lib/api'

interface DriveLayoutProps {
  children: React.ReactNode
}

export default function DriveLayout({ children }: DriveLayoutProps) {
  const hasAuthToken = Boolean(getStoredTokens()?.access)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="h-16 sticky top-0 z-50 bg-slate-50 border-b border-slate-200/70">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-2 mr-2 sm:mr-6 shrink-0">
              <Cloud className="w-7 h-7 text-blue-600" />
              <span className="text-lg font-semibold text-slate-800">OKM</span>
            </div>

            <div className="hidden md:block w-full max-w-2xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search in Drive"
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-100/80 px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasAuthToken ? (
              <>
                <Link href="/profile">
                  <Button variant="ghost" size="icon" title="Profile" className="text-slate-600 hover:text-slate-900">
                    <CircleUserRound className="w-5 h-5" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    api.logout()
                    window.location.href = '/login'
                  }}
                >
                  Logout
                </Button>
              </>
            ) : (
              <p className="text-sm text-slate-500">JWT auth ready</p>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="hidden lg:flex w-64 fixed left-0 top-16 bottom-0 bg-slate-100 border-r border-slate-200/70 flex-col px-3 py-4">
          <nav className="space-y-1">
            <Link href="/drive" className="flex items-center gap-3 px-4 py-2.5 rounded-r-full bg-blue-100 text-blue-800 text-sm font-medium">
              <FolderOpen className="w-4 h-4 text-blue-900" />
              My Drive
            </Link>
            <button className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-r-full text-slate-600 hover:bg-slate-200 text-sm font-medium transition">
              <Users className="w-4 h-4 text-blue-900" />
              Shared with me
            </button>
            <button className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-r-full text-slate-600 hover:bg-slate-200 text-sm font-medium transition">
              <Clock3 className="w-4 h-4 text-blue-900" />
              Recent
            </button>
            <button className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-r-full text-slate-600 hover:bg-slate-200 text-sm font-medium transition">
              <Star className="w-4 h-4 text-blue-900" />
              Starred
            </button>
          </nav>
        </aside>

        <main className="w-full lg:ml-64 p-4 sm:p-6 overflow-auto">
          <div className="bg-white rounded-2xl min-h-full p-5 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
