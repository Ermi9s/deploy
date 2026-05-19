'use client'

import { useEffect, useState } from 'react'
import DriveLayout from '@/components/drive/drive-layout'
import AuthGuard from '@/components/auth/auth-guard'
import { api, AuthUser, UserProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Shield, Lock, Building2, User } from 'lucide-react'

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
  1: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  2: 'bg-sky-100 text-sky-800 border-sky-200',
  3: 'bg-amber-100 text-amber-800 border-amber-200',
  4: 'bg-orange-100 text-orange-800 border-orange-200',
  5: 'bg-red-100 text-red-800 border-red-200',
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
  const rankColor = permRanking !== null ? (RANK_COLORS[permRanking] ?? 'bg-slate-100 text-slate-700 border-slate-200') : ''

  return (
    <AuthGuard>
      <DriveLayout>
        {loading || !user || !profile || !draft ? (
          <div className="py-12 text-center text-slate-500">Loading account data…</div>
        ) : (
          <div className="space-y-6 max-w-3xl">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">My profile</h1>
              <p className="text-sm text-slate-500">View your details and access clearance.</p>
            </div>

            {/* ── MAC Clearance Card ─────────────────────────────────────── */}
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-none p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-0.5">
                      Access Clearance
                    </p>
                    <p className="text-sm text-slate-500">
                      Your department and clearance level determine which documents the
                      RAG assistant can retrieve on your behalf.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Department */}
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase font-semibold tracking-wide text-slate-400">Department</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {profile.department?.name ?? (
                            <span className="text-slate-400 font-normal italic">Not assigned</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Clearance level */}
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase font-semibold tracking-wide text-slate-400">Clearance Level</p>
                        {rankLabel ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${rankColor}`}>
                              {rankLabel}
                            </span>
                            <span className="text-xs text-slate-500">
                              rank {permRanking}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic font-normal">Not assigned</p>
                        )}
                        {profile.permission_level?.name && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{profile.permission_level.name}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-indigo-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Contact your administrator to change your department or clearance level.
                  </p>
                </div>
              </div>
            </Card>

            {/* ── Profile Details Card ───────────────────────────────────── */}
            <Card className="p-6 sm:p-8 space-y-5 border-slate-200 shadow-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <h2 className="text-base font-semibold text-slate-900">Profile details</h2>
                </div>
                {!editing ? (
                  <Button type="button" size="sm" onClick={handleStartEdit} className="rounded-lg">Edit</Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleDiscard} disabled={saving} className="rounded-lg">
                      Discard
                    </Button>
                    <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white">
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input type="email" value={draft.email} disabled className="bg-slate-50" />
                <Input
                  type="text"
                  placeholder="First name"
                  value={draft.first_name}
                  disabled={!editing || saving}
                  onChange={(e) => setDraft((p) => p ? { ...p, first_name: e.target.value } : p)}
                />
                <Input
                  type="text"
                  placeholder="Last name"
                  value={draft.last_name}
                  disabled={!editing || saving}
                  onChange={(e) => setDraft((p) => p ? { ...p, last_name: e.target.value } : p)}
                />
                <Input
                  type="text"
                  placeholder="Contact info"
                  value={draft.contact_info}
                  disabled={!editing || saving}
                  onChange={(e) => setDraft((p) => p ? { ...p, contact_info: e.target.value } : p)}
                />
                <Input
                  type="text"
                  placeholder="Emergency contact name"
                  value={draft.emergency_contact_name}
                  disabled={!editing || saving}
                  onChange={(e) => setDraft((p) => p ? { ...p, emergency_contact_name: e.target.value } : p)}
                />
                <Input
                  type="text"
                  placeholder="Emergency number"
                  value={draft.emergency_number}
                  disabled={!editing || saving}
                  onChange={(e) => setDraft((p) => p ? { ...p, emergency_number: e.target.value } : p)}
                />
              </div>

              <textarea
                className="w-full min-h-24 rounded-lg border border-input bg-transparent px-3 py-2 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Address"
                value={draft.address}
                disabled={!editing || saving}
                onChange={(e) => setDraft((p) => p ? { ...p, address: e.target.value } : p)}
              />

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
            </Card>
          </div>
        )}
      </DriveLayout>
    </AuthGuard>
  )
}
