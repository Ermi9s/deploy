'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  CircleUserRound,
  Cloud,
  FolderOpen,
  Users,
  Clock3,
  Star,
  Shield,
} from 'lucide-react'
import { api, getStoredTokens, getMacContext } from '@/lib/api'

interface DriveLayoutProps {
  children: React.ReactNode
}

const RANK_COLORS: Record<number, string> = {
  1: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  2: 'bg-sky-100 text-sky-800 border-sky-200',
  3: 'bg-amber-100 text-amber-800 border-amber-200',
  4: 'bg-orange-100 text-orange-800 border-orange-200',
  5: 'bg-red-100 text-red-800 border-red-200',
}

const RANK_LABELS: Record<number, string> = {
  1: 'Public',
  2: 'Restricted',
  3: 'Confidential',
  4: 'Secret',
  5: 'Top Secret',
}

export default function DriveLayout({ children }: DriveLayoutProps) {
  const hasAuthToken = Boolean(getStoredTokens()?.access)

  // Read MAC context from the stored JWT (client-side only)
  const [macCtx, setMacCtx] = useState<{ departmentId: string | null; permissionRanking: number | null }>({
    departmentId: null,
    permissionRanking: null,
  })

  useEffect(() => {
    setMacCtx(getMacContext())
  }, [])

  const rankLabel = macCtx.permissionRanking !== null
    ? (RANK_LABELS[macCtx.permissionRanking] ?? `Rank ${macCtx.permissionRanking}`)
    : null
  const rankColor = macCtx.permissionRanking !== null
    ? (RANK_COLORS[macCtx.permissionRanking] ?? 'bg-slate-100 text-slate-700 border-slate-200')
    : ''

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="h-16 sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200/70 shadow-sm">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-2 sm:mr-6 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
                <Cloud className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-800 tracking-tight">OKM</span>
            </div>

            {/* Search */}
            <div className="hidden md:block w-full max-w-2xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search in Drive…"
                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-100/70 px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
                />
              </div>
            </div>
          </div>

          {/* Right side: clearance badge + nav */}
          <div className="flex items-center gap-3">
            {/* MAC Clearance badge */}
            {hasAuthToken && rankLabel && (
              <span
                title="Your permission clearance level"
                className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${rankColor}`}
              >
                <Shield className="w-3 h-3" />
                {rankLabel}
              </span>
            )}

            {hasAuthToken ? (
              <>
                <Link href="/profile">
                  <Button variant="ghost" size="icon" title="Profile" className="text-slate-600 hover:text-slate-900 hover:bg-slate-100">
                    <CircleUserRound className="w-5 h-5" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg"
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
        {/* Sidebar */}
        <aside className="hidden lg:flex w-64 fixed left-0 top-16 bottom-0 bg-white border-r border-slate-200/70 flex-col px-3 py-5 gap-1">
          <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Navigation
          </p>
          <Link
            href="/drive"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-800 text-sm font-semibold"
          >
            <FolderOpen className="w-4 h-4 text-indigo-600" />
            My Drive
          </Link>
          <button className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition">
            <Users className="w-4 h-4 text-slate-500" />
            Shared with me
          </button>
          <button className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition">
            <Clock3 className="w-4 h-4 text-slate-500" />
            Recent
          </button>
          <button className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition">
            <Star className="w-4 h-4 text-slate-500" />
            Starred
          </button>

          {/* Access level card at bottom of sidebar */}
          {hasAuthToken && rankLabel && (
            <div className="mt-auto mx-1 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Shield className="w-3.5 h-3.5 text-indigo-500" />
                Your clearance
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${rankColor}`}>
                {rankLabel}
              </span>
              {macCtx.departmentId && (
                <p className="text-[10px] text-slate-400 truncate" title={macCtx.departmentId}>
                  Dept: {macCtx.departmentId}
                </p>
              )}
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="w-full lg:ml-64 p-4 sm:p-6 overflow-auto">
          <div className="bg-white rounded-2xl min-h-full p-5 sm:p-6 shadow-sm border border-slate-200/60">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
