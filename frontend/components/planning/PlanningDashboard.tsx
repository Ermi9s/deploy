'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Award, 
  Sparkles, 
  Clock, 
  ClipboardList, 
  Building2, 
  FileText,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Lock,
  Filter
} from 'lucide-react'
import { api, Plan, Milestone } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type MilestoneFilter = 'all' | 'open' | 'completed'

export function PlanningDashboard() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [milestoneFilter, setMilestoneFilter] = useState<MilestoneFilter>('all')
  const [showCompletedSection, setShowCompletedSection] = useState(true)

  // Modals state
  const [isPlanOpen, setIsPlanOpen] = useState(false)
  const [planTitle, setPlanTitle] = useState('')
  const [planDescription, setPlanDescription] = useState('')

  const [isMilestoneOpen, setIsMilestoneOpen] = useState(false)
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDescription, setMilestoneDescription] = useState('')
  const [milestoneDueDate, setMilestoneDueDate] = useState('')

  // Always hydrate milestones via detail endpoint after selecting a plan
  const fetchPlanDetails = async (planId: string) => {
    try {
      const detailedPlan = await api.planning.getPlanDetails(planId)
      setSelectedPlan(detailedPlan)
      setPlans(prev => prev.map(p => p.id === planId ? detailedPlan : p))
    } catch (err) {
      console.error('Failed to load plan details', err)
    }
  }

  const loadPlans = async (selectId?: string) => {
    setLoading(true)
    try {
      const data = await api.planning.listPlans()
      const list = data.results || []
      setPlans(list)
      if (list.length > 0) {
        const target = selectId ? list.find(p => p.id === selectId) : null
        const chosen = target || list[0]
        // Always fetch full details so milestones are never missing
        await fetchPlanDetails(chosen.id)
      } else {
        setSelectedPlan(null)
      }
    } catch (err) {
      toast({
        title: 'Error loading plans',
        description: err instanceof Error ? err.message : 'Please check your connection.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [])

  const handleSelectPlan = async (plan: Plan) => {
    setSelectedPlan(plan)
    setMilestoneFilter('all')
    await fetchPlanDetails(plan.id)
  }

  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())

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
      console.error('[Planning] Download error:', err)
      toast({
        title: 'Access Denied',
        description: 'You do not have sufficient clearance (MAC) or permission to view this source document.',
        variant: 'destructive',
      })
    } finally {
      setDownloadingIds(prev => { const s = new Set(prev); s.delete(documentId); return s })
    }
  }

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planTitle.trim()) return
    setActionLoading(true)
    try {
      const newPlan = await api.planning.createPlan({ title: planTitle, description: planDescription })
      toast({ title: 'Plan created successfully', description: `"${planTitle}" has been created.` })
      setIsPlanOpen(false)
      setPlanTitle('')
      setPlanDescription('')
      await loadPlans(newPlan.id)
    } catch (err) {
      toast({ title: 'Failed to create plan', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeletePlan = async (uuid: string) => {
    if (!confirm('Are you sure you want to delete this planning outline? All milestones and configurations will be permanently removed.')) return
    setActionLoading(true)
    try {
      await api.planning.deletePlan(uuid)
      toast({ title: 'Plan removed', description: 'The plan and milestones have been successfully deleted.' })
      await loadPlans()
    } catch (err) {
      toast({ title: 'Failed to delete plan', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlan || !milestoneTitle.trim() || !milestoneDescription.trim()) return
    setActionLoading(true)
    try {
      await api.planning.createMilestone(selectedPlan.id, {
        title: milestoneTitle,
        description: milestoneDescription,
        due_date: milestoneDueDate ? milestoneDueDate : null,
      })
      toast({ title: 'Milestone added', description: `"${milestoneTitle}" has been registered in the plan.` })
      setIsMilestoneOpen(false)
      setMilestoneTitle('')
      setMilestoneDescription('')
      setMilestoneDueDate('')
      await fetchPlanDetails(selectedPlan.id)
    } catch (err) {
      toast({ title: 'Failed to add milestone', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleManualComplete = async (milestoneId: string) => {
    if (!selectedPlan) return
    try {
      await api.planning.manuallyCompleteMilestone(milestoneId)
      toast({ title: 'Milestone marked complete', description: 'This milestone has been manually satisfied.' })
      await fetchPlanDetails(selectedPlan.id)
    } catch (err) {
      toast({ title: 'Action failed', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' })
    }
  }

  const handleRejectMilestone = async (milestoneId: string) => {
    if (!selectedPlan) return
    if (!confirm('Are you sure you want to reject this AI auto-completion? This document will be permanently excluded from triggering this specific milestone in the future.')) return
    try {
      await api.planning.rejectMilestone(milestoneId)
      toast({ title: 'AI Auto-Completion Rejected', description: 'Milestone reverted back to OPEN. Triggering document has been excluded.' })
      await fetchPlanDetails(selectedPlan.id)
    } catch (err) {
      toast({ title: 'Action failed', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' })
    }
  }

  const getMilestoneStats = (milestones: Milestone[] = []) => {
    const total = milestones.length
    const completed = milestones.filter(m => m.status !== 'open').length
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, progress }
  }

  const getFilteredMilestones = (milestones: Milestone[] = []) => {
    if (milestoneFilter === 'open') return milestones.filter(m => m.status === 'open')
    if (milestoneFilter === 'completed') return milestones.filter(m => m.status !== 'open')
    return milestones
  }

  const openMilestones = selectedPlan?.milestones?.filter(m => m.status === 'open') ?? []
  const completedMilestones = selectedPlan?.milestones?.filter(m => m.status !== 'open') ?? []
  const filteredMilestones = selectedPlan?.milestones ? getFilteredMilestones(selectedPlan.milestones) : []

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="h-8 w-8 text-primary" />
            AI Planning &amp; Milestones
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Define objectives and milestones. The indexing engine runs periodic searches and semantic AI analysis (via Gemini) to automatically track and verify achievements as files are indexed.
          </p>
        </div>

        <Dialog open={isPlanOpen} onOpenChange={setIsPlanOpen}>
          <DialogTrigger asChild>
            <Button className="font-semibold shadow-sm shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              New Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreatePlan}>
              <DialogHeader>
                <DialogTitle>Create Strategic Plan</DialogTitle>
                <DialogDescription>Formulate a high-level strategic roadmap. This plan will be scoped to your active department.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-title">Plan Title</Label>
                  <Input id="plan-title" placeholder="e.g. Q3 Security & Access Control Compliance" value={planTitle} onChange={e => setPlanTitle(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-desc">Description</Label>
                  <Textarea id="plan-desc" placeholder="Provide contextual details and high-level departmental goals..." value={planDescription} onChange={e => setPlanDescription(e.target.value)} className="min-h-[100px]" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPlanOpen(false)} disabled={actionLoading}>Cancel</Button>
                <Button type="submit" disabled={actionLoading}>{actionLoading ? 'Creating...' : 'Create Plan'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
          <Spinner className="h-8 w-8 text-primary" />
          <span className="text-sm text-muted-foreground font-medium">Loading planning dashboard...</span>
        </div>
      ) : plans.length === 0 ? (
        <div className="flex-1 border border-dashed border-border rounded-xl flex flex-col items-center justify-center p-12 text-center bg-card/50">
          <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center text-muted-foreground mb-4">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Plans Configured</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
            Get started by defining your first high-level plan and let the AI system keep track of its completion metrics.
          </p>
          <Button onClick={() => setIsPlanOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Plan
          </Button>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">

          {/* Left — Plans Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto max-h-[350px] lg:max-h-none">
            <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider px-1">
              Active Roadmaps
            </h3>
            <div className="space-y-3">
              {plans.map((p) => {
                const isSelected = selectedPlan?.id === p.id
                const stats = getMilestoneStats(p.milestones)
                const allDone = stats.total > 0 && stats.completed === stats.total

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPlan(p)}
                    className={cn(
                      'group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                        : 'border-border bg-card hover:bg-accent/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1">
                        {p.title}
                      </h4>
                      <Badge
                        variant={allDone ? 'default' : 'secondary'}
                        className={cn('text-[10px] uppercase font-bold shrink-0', allDone && 'bg-emerald-500 hover:bg-emerald-600 border-none text-white')}
                      >
                        {allDone ? 'Done' : 'Active'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                      {p.description || 'No description provided.'}
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                        <span>Milestones</span>
                        <span>{stats.completed}/{stats.total} ({stats.progress}%)</span>
                      </div>
                      <Progress value={stats.progress} className="h-1.5" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right — Milestones Detail */}
          <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
            {selectedPlan && (
              <div className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm overflow-hidden">

                {/* Plan Header */}
                <div className="p-6 border-b border-border bg-card/50 flex flex-col sm:flex-row sm:items-start justify-between gap-4 shrink-0">
                  <div className="space-y-1">
                    <h2 className="text-xl font-display font-semibold text-foreground">{selectedPlan.title}</h2>
                    <p className="text-sm text-muted-foreground line-clamp-3">{selectedPlan.description || 'No plan details added yet.'}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-[11px] text-muted-foreground font-medium">
                      <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Department Scoped</span>
                      <span>•</span>
                      <span>Created {new Date(selectedPlan.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                    <Dialog open={isMilestoneOpen} onOpenChange={setIsMilestoneOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="font-semibold">
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Add Milestone
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <form onSubmit={handleCreateMilestone}>
                          <DialogHeader>
                            <DialogTitle>Add Target Milestone</DialogTitle>
                            <DialogDescription>Specify a clear, unambiguous milestone statement. The AI agent will search for documents fitting this statement.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                              <Label htmlFor="milestone-title">Milestone Title</Label>
                              <Input id="milestone-title" placeholder="e.g. Publish Official Phishing Incident Playbook" value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="milestone-desc">Completion Evidence Statement</Label>
                              <Textarea id="milestone-desc" placeholder="Describe what constitutes satisfaction..." value={milestoneDescription} onChange={e => setMilestoneDescription(e.target.value)} className="min-h-[100px]" required />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="milestone-due">Target Completion Date (Optional)</Label>
                              <Input id="milestone-due" type="date" value={milestoneDueDate} onChange={e => setMilestoneDueDate(e.target.value)} />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsMilestoneOpen(false)} disabled={actionLoading}>Cancel</Button>
                            <Button type="submit" disabled={actionLoading}>{actionLoading ? 'Adding...' : 'Add Milestone'}</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePlan(selectedPlan.id)} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0" title="Delete Plan">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 px-6 pt-4 shrink-0">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  {(['all', 'open', 'completed'] as MilestoneFilter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setMilestoneFilter(f)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-semibold transition-all capitalize',
                        milestoneFilter === f
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      {f === 'all' && `All (${selectedPlan.milestones?.length ?? 0})`}
                      {f === 'open' && `Open (${openMilestones.length})`}
                      {f === 'completed' && `Completed (${completedMilestones.length})`}
                    </button>
                  ))}
                </div>

                {/* Milestones List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {!selectedPlan.milestones || selectedPlan.milestones.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-xl bg-accent/10">
                      <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">This plan has no milestones registered. Click &quot;Add Milestone&quot; to populate the roadmap.</p>
                    </div>
                  ) : filteredMilestones.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-xl bg-accent/10">
                      <CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No milestones in this view.</p>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {filteredMilestones.map((milestone) => {
                        const isOpen = milestone.status === 'open'
                        const isAuto = milestone.status === 'auto_completed'
                        const isManual = milestone.status === 'manually_completed'

                        return (
                          <motion.div
                            key={milestone.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className={cn(
                              'p-5 rounded-xl border flex flex-col gap-4 relative transition-all duration-200',
                              isAuto ? 'border-emerald-500/20 bg-emerald-500/[0.02]'
                                : isManual ? 'border-indigo-500/20 bg-indigo-500/[0.02]'
                                : 'border-border bg-card'
                            )}
                          >
                            {/* Milestone Header */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                                  {isAuto && <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                  {isManual && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
                                  {isOpen && <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                  {milestone.title}
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">{milestone.description}</p>
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-1.5">
                                {isAuto && (
                                  <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-semibold text-[10px] tracking-wide flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" /> AI Completed
                                  </Badge>
                                )}
                                {isManual && (
                                  <Badge className="bg-indigo-500 hover:bg-indigo-600 border-none font-semibold text-[10px] tracking-wide flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Completed
                                  </Badge>
                                )}
                                {isOpen && (
                                  <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/[0.03] font-semibold text-[10px] tracking-wide flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Open
                                  </Badge>
                                )}
                                {milestone.due_date && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Calendar className="h-3 w-3" />
                                    Due {new Date(milestone.due_date).toLocaleDateString()}
                                  </span>
                                )}
                                {milestone.completed_at && !isOpen && (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {new Date(milestone.completed_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* AI Completion Details */}
                            {isAuto && (
                              <div className="border border-emerald-500/10 rounded-lg p-3.5 bg-emerald-500/[0.01] space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="font-semibold text-foreground flex items-center gap-1 text-[11px]">
                                    <Award className="h-3.5 w-3.5 text-emerald-500" />
                                    Confidence:
                                    <span className={cn('capitalize ml-0.5 font-bold', milestone.completion_confidence === 'high' ? 'text-emerald-500' : 'text-amber-500')}>
                                      {milestone.completion_confidence}
                                    </span>
                                  </span>
                                  <span className="text-muted-foreground">|</span>
                                  {milestone.reference_document_id ? (
                                    <button
                                      type="button"
                                      disabled={downloadingIds.has(milestone.reference_document_id)}
                                      onClick={() => handleViewSourceFile(milestone.reference_document_id!)}
                                      className="text-primary hover:underline font-semibold flex items-center gap-1 text-[11px] hover:text-primary/80 transition-colors focus:outline-none"
                                    >
                                      <FileText className="h-3.5 w-3.5 shrink-0" />
                                      Source: {milestone.reference_filename || 'Indexed File'}
                                      {downloadingIds.has(milestone.reference_document_id) && (
                                        <Spinner className="h-3 w-3 ml-1" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="text-muted-foreground/80 font-semibold flex items-center gap-1 text-[11px] cursor-not-allowed italic" title="You do not have sufficient access level to see the source filename.">
                                      <Lock className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                                      Source: Redacted (Insufficient Clearance)
                                    </span>
                                  )}
                                </div>
                                {milestone.completion_summary && (
                                  <p className="text-muted-foreground leading-relaxed mt-1 text-[11px] bg-accent/30 rounded p-2 border border-border/40">
                                    <span className="font-semibold text-foreground block mb-1">Reasoning:</span>
                                    {milestone.completion_summary}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Manual completion summary */}
                            {isManual && (
                              <div className="border border-indigo-500/10 rounded-lg p-3 bg-indigo-500/[0.01] text-[11px] text-muted-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                Manually marked as satisfied by a team member.
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 ml-auto mt-1 border-t border-border/40 pt-3 w-full justify-end">
                              {isOpen && (
                                <Button variant="outline" size="sm" className="text-xs font-semibold py-1.5 h-8 hover:bg-primary/5 hover:text-primary" onClick={() => handleManualComplete(milestone.id)}>
                                  <Check className="h-3.5 w-3.5 mr-1" /> Mark Satisfied
                                </Button>
                              )}
                              {isAuto && (
                                <Button variant="ghost" size="sm" className="text-xs font-semibold py-1.5 h-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => handleRejectMilestone(milestone.id)}>
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject AI Match
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
