'use client'

import { useEffect, useState } from 'react'
import { api, AdminDashboardStats, AuditLog } from '@/lib/api'
import { Users, Network, KeyRound, Clock, ArrowUpRight, ShieldAlert, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await api.admin.getDashboardStats()
        setStats(res)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load system stats')
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-900/50 bg-red-950/10 text-red-400 p-6">
        <CardHeader className="flex flex-row items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-red-500" />
          <div>
            <CardTitle>Error Loading Dashboard</CardTitle>
            <CardDescription className="text-red-400/80">{error}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    )
  }

  const kpis = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: Users, color: 'from-blue-500/20 to-cyan-500/20 text-blue-400' },
    { label: 'Departments', value: stats?.total_departments ?? 0, icon: Network, color: 'from-indigo-500/20 to-purple-500/20 text-indigo-400' },
    { label: 'Clearance Tiers', value: stats?.total_clearance_levels ?? 0, icon: KeyRound, color: 'from-amber-500/20 to-orange-500/20 text-amber-400' },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
          System Overview
        </h1>
        <p className="text-sm text-slate-400 mt-1">Real-time status of OKM archives, departments, and user profiles.</p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md relative overflow-hidden group hover:border-slate-700/80 transition-all duration-300">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                <Icon className="w-24 h-24" />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</span>
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${kpi.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-100">{kpi.value}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity Feed */}
      <Card className="border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/60 pb-6">
          <div>
            <CardTitle className="text-lg font-bold text-slate-100">Administrative Logs</CardTitle>
            <CardDescription className="text-slate-400">Most recent actions performed across the platform.</CardDescription>
          </div>
          <Link href="/admin/audit-logs">
            <Button variant="outline" size="sm" className="border-slate-800 hover:bg-slate-800 text-slate-300">
              View All Logs <ArrowUpRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800/40">
            {stats?.recent_audit_logs && stats.recent_audit_logs.length > 0 ? (
              stats.recent_audit_logs.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-6 hover:bg-slate-800/20 transition-all duration-200">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        <span className="text-indigo-400">{log.actor_email}</span> performed{' '}
                        <span className="text-amber-400 font-medium">{log.action_type_display}</span> on{' '}
                        <span className="text-slate-300">{log.target_type_display}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Target ID: <span className="font-mono text-slate-500">{log.target_id}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-medium text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    {log.ip_address && (
                      <p className="text-[10px] text-slate-500/80 font-mono mt-0.5">{log.ip_address}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500 text-sm">
                No recent administrative actions logged yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
