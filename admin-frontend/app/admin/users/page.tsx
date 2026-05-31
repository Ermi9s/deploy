'use client'

import { useEffect, useState } from 'react'
import { api, AuthUser, Department, PermissionLevel } from '@/lib/api'
import { Users, Search, Network, KeyRound, ShieldAlert, Loader2, ShieldCheck, X, Check, Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Switch } from '@/components/ui/switch'

export default function AdminUsers() {
  const { toast } = useToast()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Edit State
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null)
  const [editDeptId, setEditDeptId] = useState<string>('')
  const [editLevelId, setEditLevelId] = useState<string>('')
  const [editIsSuperuser, setEditIsSuperuser] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [userRes, deptRes] = await Promise.all([
        api.admin.listUsers({ search: searchQuery, department_id: selectedDeptId, page }),
        api.admin.listDepartments(),
      ])
      setUsers(userRes.results || [])
      setDepartments(deptRes || [])
      setTotalPages(Math.ceil((userRes.count || 0) / 20))
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch directory',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [searchQuery, selectedDeptId, page])

  const handleOpenEdit = (user: AuthUser) => {
    setSelectedUser(user)
    setEditDeptId(user.profile?.department?.id ? user.profile.department.id.toString() : '')
    setEditLevelId(user.profile?.permission_level?.id ? user.profile.permission_level.id.toString() : '')
    setEditIsSuperuser(!!user.is_superuser)
  }

  // Get clearance tiers for currently selected edit department
  const currentLevels = editDeptId
    ? departments.find((d) => d.id === parseInt(editDeptId, 10))?.permission_levels || []
    : []

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      setSubmitting(true)

      // 1. Save assignment
      const dId = editDeptId ? parseInt(editDeptId, 10) : null
      const lId = editLevelId ? parseInt(editLevelId, 10) : null
      await api.admin.assignUser(selectedUser.id, { department_id: dId, permission_level_id: lId })

      // 2. Toggle Admin if changed
      if (editIsSuperuser !== !!selectedUser.is_superuser) {
        await api.admin.toggleAdmin(selectedUser.id)
      }

      toast({
        title: 'Success',
        description: `Profile assignments for ${selectedUser.email} updated successfully.`,
      })
      setSelectedUser(null)
      loadData()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Update failed',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          User Registry & Clearances
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Assign archive access departments, clearance levels, and administrator roles.</p>
      </div>

      {/* Directory Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 gap-4 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search user email or name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="pl-10"
            />
          </div>
          <select
            value={selectedDeptId}
            onChange={(e) => {
              setSelectedDeptId(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-background border border-border text-foreground rounded-xl focus:border-primary text-sm"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* User Table Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">User Identity</th>
                      <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Department</th>
                      <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Clearance Tier</th>
                      <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Admin</th>
                      <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading && users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-16">
                          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                        </td>
                      </tr>
                    ) : users.length > 0 ? (
                      users.map((u) => (
                        <tr
                          key={u.id}
                          className="hover:bg-muted/50 transition-all duration-150 cursor-pointer"
                          onClick={() => handleOpenEdit(u)}
                        >
                          <td className="px-6 py-4.5">
                            <p className="text-sm font-semibold text-foreground">
                              {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : 'No Name Set'}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{u.email}</p>
                          </td>
                          <td className="px-6 py-4.5 text-sm text-muted-foreground">
                            {u.profile?.department?.name ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
                                <Network className="w-3.5 h-3.5" /> {u.profile.department.name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Unassigned (Public)</span>
                            )}
                          </td>
                          <td className="px-6 py-4.5 text-sm text-muted-foreground">
                            {u.profile?.permission_level?.name ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 text-xs font-medium">
                                <KeyRound className="w-3.5 h-3.5" /> Rank {u.profile.permission_level.ranking} - {u.profile.permission_level.name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border text-xs font-medium">
                                Rank 1 - Public
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4.5">
                            {u.is_superuser ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                                <Shield className="w-3 h-3" /> Admin
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">User</span>
                            )}
                          </td>
                          <td className="px-6 py-4.5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary/80 hover:bg-muted font-semibold"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenEdit(u)
                              }}
                            >
                              Edit Profile
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-16 text-muted-foreground text-sm">
                          No users matched your query filter.
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

        {/* Edit Panel Drawer Sidebar */}
        <div>
          {selectedUser ? (
            <Card className="sticky top-24">
              <CardHeader className="border-b pb-6 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Adjust clearance</CardTitle>
                  <CardDescription className="text-xs truncate max-w-[200px]">{selectedUser.email}</CardDescription>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSaveUser} className="space-y-6">
                  {/* Select Department */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Department Assignment</label>
                    <select
                      value={editDeptId}
                      onChange={(e) => {
                        setEditDeptId(e.target.value)
                        setEditLevelId('') // reset level
                      }}
                      className="w-full px-4.5 py-3 bg-background border border-border text-foreground rounded-xl focus:border-primary text-sm focus:outline-none"
                    >
                      <option value="">Unassigned (Public Access Fallback)</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Clearance Level */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">MAC Clearance level</label>
                    <select
                      value={editLevelId}
                      onChange={(e) => setEditLevelId(e.target.value)}
                      disabled={!editDeptId}
                      className="w-full px-4.5 py-3 bg-background border border-border text-foreground rounded-xl focus:border-primary text-sm focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Select Level...</option>
                      {currentLevels
                        .sort((a, b) => a.ranking - b.ranking)
                        .map((level) => (
                          <option key={level.id} value={level.id}>
                            Rank {level.ranking} - {level.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Superuser Flag toggle */}
                  <div className="flex items-center justify-between p-4.5 rounded-xl border border-border bg-muted/30">
                    <div>
                      <p className="text-xs font-bold text-foreground">Site Administrator</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Grant full administrative capability.</p>
                    </div>
                    <Switch
                      checked={editIsSuperuser}
                      onCheckedChange={setEditIsSuperuser}
                      disabled={selectedUser.is_superuser && selectedUser.email === 'admin@okm.local'}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setSelectedUser(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting} className="w-full">
                      {submitting ? 'Updating...' : 'Apply Access'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="h-64 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-6 text-muted-foreground sticky top-24">
              <ShieldCheck className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-xs font-medium">Select a user profile to adjust access levels and roles.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
