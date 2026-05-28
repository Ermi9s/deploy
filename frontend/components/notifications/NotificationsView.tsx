'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  CheckCheck,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  X,
  InboxIcon,
  RefreshCw,
  ClipboardList,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { PlanningNotification } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { useNotificationSocket } from '@/hooks/useNotificationSocket'
import { FileText } from 'lucide-react'

type NotifFilter = 'all' | 'unread' | 'read'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function NotificationsView() {
  const router = useRouter()
  const { toast } = useToast()

  const {
    notifications,
    unreadCount,
    isLoading: loading,
    refresh: fetchNotifications,
    markRead,
    markAllRead,
  } = useNotificationSocket()

  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<NotifFilter>('all')
  const [actionIds, setActionIds] = useState<Set<string>>(new Set())
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchNotifications()
    } finally {
      setRefreshing(false)
    }
  }

  const handleMarkRead = async (id: string) => {
    setActionIds(prev => new Set(prev).add(id))
    try {
      await markRead(id)
    } catch {
      toast({ title: 'Failed to mark as read', variant: 'destructive' })
    } finally {
      setActionIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllRead()
      toast({ title: 'All notifications marked as read' })
    } catch {
      toast({ title: 'Failed to mark all as read', variant: 'destructive' })
    }
  }

  const handleViewSourceFile = async (documentId: string) => {
    if (!documentId) return
    setDownloadingIds(prev => new Set(prev).add(documentId))
    try {
      const res = await api.getDownloadUrl(documentId)
      if (res && res.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer')
      } else {
        throw new Error('No URL returned')
      }
    } catch (err) {
      console.error('[Notifications] Download error:', err)
      toast({
        title: 'Access Denied',
        description: 'You do not have sufficient clearance (MAC) or permission to view this source document.',
        variant: 'destructive',
      })
    } finally {
      setDownloadingIds(prev => { const s = new Set(prev); s.delete(documentId); return s })
    }
  }

  const handleRejectAI = async (notif: PlanningNotification) => {
    if (!confirm('Reject this AI auto-completion? The triggering document will be permanently excluded from this milestone.')) return
    setActionIds(prev => new Set(prev).add(notif.id))
    try {
      await api.planning.rejectMilestone(notif.milestone.id)
      toast({ title: 'AI Match Rejected', description: 'Milestone reverted to Open.' })
      await fetchNotifications()
    } catch {
      toast({ title: 'Failed to reject', variant: 'destructive' })
    } finally {
      setActionIds(prev => { const s = new Set(prev); s.delete(notif.id); return s })
    }
  }

  const handleViewMilestone = (notif: PlanningNotification) => {
    const planId = notif.milestone.plan_id
    router.push(planId ? `/planning?plan=${planId}` : '/planning')
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'read') return n.is_read
    return true
  })

  const isAINotif = (n: PlanningNotification) =>
    n.notification_type === 'milestone_auto_completed' || n.milestone.status === 'auto_completed'

  return (
    <div className="flex flex-col h-full gap-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-8 w-8 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="ml-1 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planning alerts, milestone completions, and AI analysis results.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => fetchNotifications()} disabled={refreshing} className="font-semibold">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" onClick={handleMarkAllRead} className="font-semibold">
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-1 shrink-0">
        {(['all', 'unread', 'read'] as NotifFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 rounded-t-lg text-sm font-semibold transition-all capitalize border-b-2 -mb-[3px]',
              filter === f
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {f === 'all' && `All (${notifications.length})`}
            {f === 'unread' && `Unread (${unreadCount})`}
            {f === 'read' && `Read (${notifications.length - unreadCount})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
          <Spinner className="h-8 w-8 text-primary" />
          <span className="text-sm text-muted-foreground font-medium">Loading notifications...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 border border-dashed border-border rounded-xl bg-card/50">
          <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
            <InboxIcon className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-foreground">No notifications</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'unread' ? 'All caught up! No unread alerts.' : 'Nothing to show in this view.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/planning')}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Go to Planning
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <AnimatePresence initial={false}>
            {filtered.map((notif, i) => {
              const isAI = isAINotif(notif)
              const busy = actionIds.has(notif.id)

              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    'rounded-xl border p-5 flex flex-col gap-3 transition-all duration-200',
                    !notif.is_read
                      ? 'border-primary/20 bg-primary/[0.02] shadow-sm'
                      : 'border-border bg-card opacity-80'
                  )}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                        isAI ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'
                      )}>
                        {isAI ? <Sparkles className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {notif.milestone.plan_title}
                        </p>
                        <h3 className="font-semibold text-foreground text-sm leading-snug">
                          {notif.milestone.title}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!notif.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Message */}
                  <p className="text-sm text-muted-foreground leading-relaxed pl-11">
                    {notif.message}
                  </p>

                  {/* Type badge + timestamp */}
                  <div className="pl-11 flex items-center gap-2 flex-wrap">
                    {isAI ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                        <Sparkles className="h-3 w-3 mr-1" /> AI Auto-Completed
                      </Badge>
                    ) : (
                      <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-semibold">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Manually Completed
      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="pl-11 flex items-center gap-2 flex-wrap pt-1 border-t border-border/40">
                    <Button variant="outline" size="sm" className="h-7 text-xs font-semibold" onClick={() => handleViewMilestone(notif)} disabled={busy}>
                      <ArrowRight className="h-3.5 w-3.5 mr-1" />
                      View Milestone
                    </Button>
                    {isAI && notif.milestone.reference_document_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs font-semibold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => handleViewSourceFile(notif.milestone.reference_document_id!)}
                        disabled={busy || downloadingIds.has(notif.milestone.reference_document_id)}
                      >
                        {downloadingIds.has(notif.milestone.reference_document_id) ? (
                          <Spinner className="h-3 w-3 mr-1" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 mr-1" />
                        )}
                        View Source File
                      </Button>
                    )}
                    {isAI && notif.milestone.status === 'auto_completed' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => handleRejectAI(notif)} disabled={busy}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        Reject AI Match
                      </Button>
                    )}
                    {!notif.is_read && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-muted-foreground hover:text-primary ml-auto" onClick={() => handleMarkRead(notif.id)} disabled={busy}>
                        {busy ? <Spinner className="h-3 w-3 mr-1" /> : <CheckCheck className="h-3.5 w-3.5 mr-1" />}
                        Mark Read
                      </Button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
