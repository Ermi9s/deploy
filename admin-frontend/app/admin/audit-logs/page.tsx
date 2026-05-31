'use client'

import { useEffect, useState } from 'react'
import { api, AuditLog } from '@/lib/api'
import { History, Search, Loader2, ArrowRight, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

export default function AdminAuditLogs() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionType, setActionType] = useState('')
  const [targetType, setTargetType] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.admin.listAuditLogs({
        action_type: actionType,
        target_type: targetType,
        page,
      })
      setLogs(res.results || [])
      setTotalPages(Math.ceil((res.count || 0) / 20))
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch logs',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [actionType, targetType, page])

  const toggleExpand = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Administrative Audit Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Immutable ledger recording all administrative actions and security parameter updates.</p>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-start">
        <select
          value={actionType}
          onChange={(e) => {
            setActionType(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 bg-background border border-border text-foreground rounded-xl focus:border-primary text-sm w-full sm:w-auto"
        >
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="ASSIGN">Assign</option>
          <option value="ROLE_TOGGLE">Role Toggle</option>
        </select>

        <select
          value={targetType}
          onChange={(e) => {
            setTargetType(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 bg-background border border-border text-foreground rounded-xl focus:border-primary text-sm w-full sm:w-auto"
        >
          <option value="">All Target Types</option>
          <option value="DEPARTMENT">Department</option>
          <option value="PERMISSION_LEVEL">Clearance level</option>
          <option value="USER">User Account</option>
        </select>
      </div>

      {/* Logs Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8"></th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Timestamp</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actor Identity</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Action Type</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Target Type</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Target ID</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    </td>
                  </tr>
                ) : logs.length > 0 ? (
                  logs.map((log) => {
                    const isExpanded = expandedLogId === log.id
                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          className="hover:bg-muted/50 transition-all duration-150 cursor-pointer"
                          onClick={() => toggleExpand(log.id)}
                        >
                          <td className="pl-4 text-center">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-6 py-4.5 text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4.5 text-sm font-semibold text-foreground">
                            {log.actor_email}
                          </td>
                          <td className="px-6 py-4.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              log.action_type === 'CREATE' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' :
                              log.action_type === 'UPDATE' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                              log.action_type === 'DELETE' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                              'bg-purple-500/10 border border-purple-500/20 text-purple-400'
                            }`}>
                              {log.action_type_display}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-xs font-semibold text-muted-foreground">
                            {log.target_type_display}
                          </td>
                          <td className="px-6 py-4.5 text-xs font-mono text-muted-foreground">
                            {log.target_id}
                          </td>
                          <td className="px-6 py-4.5 text-xs font-mono text-muted-foreground">
                            {log.ip_address || '—'}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/30">
                            <td colSpan={7} className="px-8 py-6 border-b border-border">
                              <div className="space-y-3">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Metadata payload diff</p>
                                <pre className="p-4 rounded-xl border border-border bg-background text-xs font-mono text-primary overflow-x-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground text-sm">
                      No matching actions found in the ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
import React from 'react'
