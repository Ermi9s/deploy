'use client'

import { useEffect, useState } from 'react'
import { api, Department, PermissionLevel } from '@/lib/api'
import { Network, Plus, Trash2, Edit2, ShieldAlert, Loader2, ChevronRight, X, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

export default function AdminDepartments() {
  const { toast } = useToast()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal State
  const [activeDept, setActiveDept] = useState<Department | null>(null)
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [showLevelModal, setShowLevelModal] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [editingLevel, setEditingLevel] = useState<PermissionLevel | null>(null)

  // Form State
  const [deptName, setDeptName] = useState('')
  const [levelName, setLevelName] = useState('')
  const [levelRanking, setLevelRanking] = useState('1')
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.admin.listDepartments()
      setDepartments(res)
      if (activeDept) {
        const updated = res.find((d) => d.id === activeDept.id)
        if (updated) setActiveDept(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateOrUpdateDept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deptName.trim()) return

    try {
      setSubmitting(true)
      if (editingDept) {
        await api.admin.updateDepartment(editingDept.id, { name: deptName.trim() })
        toast({ title: 'Success', description: 'Department updated successfully' })
      } else {
        await api.admin.createDepartment({ name: deptName.trim() })
        toast({ title: 'Success', description: 'Department created successfully' })
      }
      setDeptName('')
      setEditingDept(null)
      setShowDeptModal(false)
      loadData()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Operation failed',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteDept = async (id: number) => {
    if (!confirm('Are you absolutely sure you want to delete this department?')) return

    try {
      await api.admin.deleteDepartment(id)
      toast({ title: 'Success', description: 'Department deleted successfully' })
      if (activeDept?.id === id) setActiveDept(null)
      loadData()
    } catch (err) {
      toast({
        title: 'Integrity Protection',
        description: err instanceof Error ? err.message : 'Cannot delete department with active dependencies.',
        variant: 'destructive',
      })
    }
  }

  const handleCreateOrUpdateLevel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!levelName.trim() || !activeDept) return

    try {
      setSubmitting(true)
      const rank = parseInt(levelRanking, 10)
      if (editingLevel) {
        await api.admin.updatePermissionLevel(editingLevel.id, { name: levelName.trim(), ranking: rank })
        toast({ title: 'Success', description: 'Clearance level updated successfully' })
      } else {
        await api.admin.createPermissionLevel(activeDept.id, { name: levelName.trim(), ranking: rank })
        toast({ title: 'Success', description: 'Clearance level added successfully' })
      }
      setLevelName('')
      setLevelRanking('1')
      setEditingLevel(null)
      setShowLevelModal(false)
      loadData()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Operation failed',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteLevel = async (id: number) => {
    if (!confirm('Are you sure you want to delete this clearance tier?')) return

    try {
      await api.admin.deletePermissionLevel(id)
      toast({ title: 'Success', description: 'Clearance level removed' })
      loadData()
    } catch (err) {
      toast({
        title: 'Active Clearance Link',
        description: err instanceof Error ? err.message : 'Cannot remove levels currently assigned to active users.',
        variant: 'destructive',
      })
    }
  }

  if (loading && departments.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Departments & Clearances
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage departmental groups and hierarchical Mandatory Access Control (MAC) tiers.</p>
        </div>
        <Button
          onClick={() => {
            setEditingDept(null)
            setDeptName('')
            setShowDeptModal(true)
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Department
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left 2 Columns: Departments Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {departments.map((dept) => (
              <Card
                key={dept.id}
                onClick={() => setActiveDept(dept)}
                className={`border-slate-800/80 bg-slate-900/40 backdrop-blur-md cursor-pointer transition-all duration-300 relative group hover:border-slate-700/80 ${
                  activeDept?.id === dept.id ? 'ring-2 ring-indigo-500/60 border-indigo-500/40' : ''
                }`}
              >
                <CardHeader className="p-6 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Network className="w-4 h-4" />
                      </div>
                      <CardTitle className="text-base font-bold text-slate-200">{dept.name}</CardTitle>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity duration-200">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingDept(dept)
                          setDeptName(dept.name)
                          setShowDeptModal(true)
                        }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteDept(dept.id)
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0 flex justify-between items-center text-xs text-slate-400">
                  <div className="space-y-1">
                    <p>Clearance Tiers: <span className="font-semibold text-slate-300">{dept.permission_levels?.length || 0}</span></p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 transition-transform duration-200 group-hover:translate-x-1" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right 1 Column: Selected Department Levels */}
        <div>
          {activeDept ? (
            <Card className="border-slate-800 bg-slate-900/30 backdrop-blur-md sticky top-24">
              <CardHeader className="border-b border-slate-800/60 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-200">{activeDept.name} Tiers</CardTitle>
                    <CardDescription className="text-xs text-slate-400">Clearance level hierarchy.</CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingLevel(null)
                      setLevelName('')
                      setLevelRanking('1')
                      setShowLevelModal(true)
                    }}
                    size="sm"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Tier
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {activeDept.permission_levels && activeDept.permission_levels.length > 0 ? (
                    [...activeDept.permission_levels]
                      .sort((a, b) => b.ranking - a.ranking) // Higher clearance at the top
                      .map((level) => (
                        <div
                          key={level.id}
                          className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 font-mono">
                              {level.ranking}
                            </div>
                            <span className="text-sm font-semibold text-slate-300">{level.name}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                              onClick={() => {
                                setEditingLevel(level)
                                setLevelName(level.name)
                                setLevelRanking(level.ranking.toString())
                                setShowLevelModal(true)
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                              onClick={() => handleDeleteLevel(level.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      No clearance tiers defined for this department. Add one to restrict access.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-64 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-6 text-slate-500 sticky top-24">
              <ShieldCheck className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-xs font-medium">Select a department to view or manage its hierarchal clearance levels.</p>
            </div>
          )}
        </div>
      </div>

      {/* DEPARTMENT MODAL */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <Card className="max-w-md w-full border-slate-800 bg-slate-900 p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowDeptModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-100">
                {editingDept ? 'Edit Department' : 'Create Department'}
              </h3>
              <p className="text-xs text-slate-400">Specify the unique name for this archive department.</p>
            </div>
            <form onSubmit={handleCreateOrUpdateDept} className="space-y-4">
              <Input
                placeholder="Department Name (e.g. Finance, Intelligence)"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                className="bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-200"
                required
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  onClick={() => setShowDeptModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  {submitting ? 'Saving...' : 'Save Department'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* LEVEL MODAL */}
      {showLevelModal && activeDept && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <Card className="max-w-md w-full border-slate-800 bg-slate-900 p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowLevelModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-100">
                {editingLevel ? 'Edit Clearance Tier' : 'Add Clearance Tier'}
              </h3>
              <p className="text-xs text-slate-400">
                Define the clearance label and hierarchical ranking in <span className="text-indigo-400">{activeDept.name}</span>.
              </p>
            </div>
            <form onSubmit={handleCreateOrUpdateLevel} className="space-y-4">
              <div className="space-y-3">
                <Input
                  placeholder="Clearance Name (e.g. Confidential, Top Secret)"
                  value={levelName}
                  onChange={(e) => setLevelName(e.target.value)}
                  className="bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-200"
                  required
                  autoFocus
                />
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hierarchy Rank</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ranking Rank (1 is lowest)"
                    value={levelRanking}
                    onChange={(e) => setLevelRanking(e.target.value)}
                    className="bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-200"
                    required
                  />
                  <p className="text-[10px] text-slate-500">
                    Higher numbers can access items requiring lower levels (e.g. Rank 3 accesses 3, 2, and 1).
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  onClick={() => setShowLevelModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  {submitting ? 'Saving...' : 'Save Tier'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
