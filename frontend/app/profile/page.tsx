'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import AuthGuard from '@/components/auth/auth-guard'
import { api, AuthUser, UserProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Shield, Lock, Building2, User, Save, X } from 'lucide-react'
import { motion } from 'framer-motion'

interface ProfileDraft {
  email: string
  first_name: string
  last_name: string
  contact_info: string
  emergency_contact_name: string
  emergency_number: string
  address: string
}

const RANK_LABELS: Record<number, string> = {
  1: 'Public',
  2: 'Restricted',
  3: 'Confidential',
  4: 'Secret',
  5: 'Top Secret',
}
const RANK_COLORS: Record<number, string> = {
  1: 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50',
  2: 'bg-sky-500/10 text-sky-600 border-sky-200/50',
  3: 'bg-amber-500/10 text-amber-600 border-amber-200/50',
  4: 'bg-orange-500/10 text-orange-600 border-orange-200/50',
  5: 'bg-red-500/10 text-red-600 border-red-200/50',
}

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const toDraft = (currentUser: AuthUser, currentProfile: UserProfile): ProfileDraft => ({
    email: currentUser.email ?? '',
    first_name: currentUser.first_name ?? '',
    last_name: currentUser.last_name ?? '',
    contact_info: currentProfile.contact_info ?? '',
    emergency_contact_name: currentProfile.emergency_contact_name ?? '',
    emergency_number: currentProfile.emergency_number ?? '',
    address: currentProfile.address ?? '',
  })

  const loadUserData = async () => {
    setLoading(true)
    try {
      const [currentUser, currentProfile] = await Promise.all([
        api.getCurrentUser(),
        api.getProfile(),
      ])
      setUser(currentUser)
      setProfile(currentProfile)
      setDraft(toDraft(currentUser, currentProfile))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadUserData() }, [])

  const handleStartEdit = () => {
    if (!user || !profile) return
    setDraft(toDraft(user, profile))
    setError('')
    setSuccess('')
    setEditing(true)
  }

  const handleDiscard = () => {
    if (!user || !profile) return
    const confirmed = window.confirm('Discard all unsaved profile changes?')
    if (!confirmed) return
    setDraft(toDraft(user, profile))
    setError('')
    setSuccess('Changes discarded.')
    setEditing(false)
  }

  const handleSave = async () => {
    if (!draft) return
    const confirmed = window.confirm('Save profile updates now?')
    if (!confirmed) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const [updatedUser, updatedProfile] = await Promise.all([
        api.updateUser({ first_name: draft.first_name.trim(), last_name: draft.last_name.trim() }),
        api.updateProfile({
          firstname: draft.first_name.trim(),
          lastname: draft.last_name.trim(),
          contact_info: draft.contact_info.trim(),
          emergency_contact_name: draft.emergency_contact_name.trim(),
          emergency_number: draft.emergency_number.trim(),
          address: draft.address.trim(),
        }),
      ])
      setUser(updatedUser)
      setProfile(updatedProfile)
      setDraft(toDraft(updatedUser, updatedProfile))
      setEditing(false)
      setSuccess('Profile saved successfully.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const permRanking = profile?.permission_level?.ranking ?? null
  const rankLabel = permRanking !== null ? (RANK_LABELS[permRanking] ?? `Rank ${permRanking}`) : null
  const rankColor = permRanking !== null ? (RANK_COLORS[permRanking] ?? 'bg-muted text-muted-foreground border-border') : ''

  return (
    <AuthGuard>
      <AppLayout>
        {loading || !user || !profile || !draft ? (
          <div className="py-12 flex justify-center items-center h-[50vh]">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
              <p className="text-muted-foreground font-medium">Loading account data...</p>
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 max-w-4xl mx-auto p-4 md:p-6 lg:p-8"
          >
            <div className="space-y-1">
              <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">My Profile</h1>
              <p className="text-muted-foreground">Manage your account settings and clearance levels.</p>
            </div>

            {/* ── MAC Clearance Card ─────────────────────────────────────── */}
            <Card className="border-primary/20 bg-primary/5 shadow-sm p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
              
              <div className="flex flex-col sm:flex-row items-start gap-6 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
                      Access Clearance
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed max-w-2xl">
                      Your department and clearance level determine which documents you can access and which documents the AI can retrieve for you.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Department */}
                    <div className="flex items-center gap-4 rounded-xl border border-primary/10 bg-background/50 backdrop-blur-sm px-4 py-3">
                      <Building2 className="w-5 h-5 text-primary/60 shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Department</p>
                        <p className="text-sm font-medium text-foreground">
                          {profile.department?.name ?? (
                            <span className="text-muted-foreground italic">Not assigned</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Clearance level */}
                    <div className="flex items-center gap-4 rounded-xl border border-primary/10 bg-background/50 backdrop-blur-sm px-4 py-3">
                      <Lock className="w-5 h-5 text-primary/60 shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Clearance Level</p>
                        {rankLabel ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${rankColor}`}>
                              {rankLabel}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              rank {permRanking}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Not assigned</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Profile Details Card ───────────────────────────────────── */}
            <Card className="p-6 sm:p-8 space-y-6 border-border shadow-sm bg-card">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent rounded-lg">
                    <User className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-semibold text-foreground">Personal Information</h2>
                    <p className="text-sm text-muted-foreground hidden sm:block">Update your contact details and emergency info.</p>
                  </div>
                </div>
                {!editing ? (
                  <Button type="button" variant="outline" onClick={handleStartEdit} className="rounded-full px-6">Edit Profile</Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" onClick={handleDiscard} disabled={saving} className="rounded-full text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4 mr-2" /> Discard
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving} className="rounded-full">
                      <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email Address</label>
                  <Input type="email" value={draft.email} disabled className="bg-muted/50 font-mono text-sm" />
                </div>
                <div className="hidden md:block"></div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">First Name</label>
                  <Input
                    type="text"
                    value={draft.first_name}
                    disabled={!editing || saving}
                    className="focus-visible:ring-primary/50"
                    onChange={(e) => setDraft((p) => p ? { ...p, first_name: e.target.value } : p)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Last Name</label>
                  <Input
                    type="text"
                    value={draft.last_name}
                    disabled={!editing || saving}
                    className="focus-visible:ring-primary/50"
                    onChange={(e) => setDraft((p) => p ? { ...p, last_name: e.target.value } : p)}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Phone Number</label>
                  <Input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={draft.contact_info}
                    disabled={!editing || saving}
                    className="focus-visible:ring-primary/50"
                    onChange={(e) => setDraft((p) => p ? { ...p, contact_info: e.target.value } : p)}
                  />
                </div>
                <div className="hidden md:block"></div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Emergency Contact Name</label>
                  <Input
                    type="text"
                    value={draft.emergency_contact_name}
                    disabled={!editing || saving}
                    className="focus-visible:ring-primary/50"
                    onChange={(e) => setDraft((p) => p ? { ...p, emergency_contact_name: e.target.value } : p)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Emergency Number</label>
                  <Input
                    type="text"
                    value={draft.emergency_number}
                    disabled={!editing || saving}
                    className="focus-visible:ring-primary/50"
                    onChange={(e) => setDraft((p) => p ? { ...p, emergency_number: e.target.value } : p)}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-foreground">Physical Address</label>
                <textarea
                  className="w-full min-h-[100px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm disabled:opacity-50 disabled:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow resize-y"
                  placeholder="123 Main St..."
                  value={draft.address}
                  disabled={!editing || saving}
                  onChange={(e) => setDraft((p) => p ? { ...p, address: e.target.value } : p)}
                />
              </div>

              {error && (
                <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1,y:0}} className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1,y:0}} className="p-3 text-sm text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  {success}
                </motion.div>
              )}
            </Card>
          </motion.div>
        )}
      </AppLayout>
    </AuthGuard>
  )
}
