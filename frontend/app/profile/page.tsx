'use client'

import { useEffect, useState } from 'react'
import DriveLayout from '@/components/drive/drive-layout'
import AuthGuard from '@/components/auth/auth-guard'
import { api, AuthUser, UserProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface ProfileDraft {
  email: string
  first_name: string
  last_name: string
  contact_info: string
  emergency_contact_name: string
  emergency_number: string
  address: string
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

  useEffect(() => {
    void loadUserData()
  }, [])

  const handleStartEdit = () => {
    if (!user || !profile) {
      return
    }

    setDraft(toDraft(user, profile))
    setError('')
    setSuccess('')
    setEditing(true)
  }

  const handleDiscard = () => {
    if (!user || !profile) {
      return
    }

    const confirmed = window.confirm('Discard all unsaved profile changes?')
    if (!confirmed) {
      return
    }

    setDraft(toDraft(user, profile))
    setError('')
    setSuccess('Changes discarded.')
    setEditing(false)
  }

  const handleSave = async () => {
    if (!draft) {
      return
    }

    const confirmed = window.confirm('Save profile updates now?')
    if (!confirmed) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const [updatedUser, updatedProfile] = await Promise.all([
        api.updateUser({
          first_name: draft.first_name.trim(),
          last_name: draft.last_name.trim(),
        }),
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

  return (
    <AuthGuard>
      <DriveLayout>
        {loading || !user || !profile || !draft ? (
          <div className="py-12 text-center text-slate-500">Loading account data...</div>
        ) : (
          <div className="space-y-6 max-w-3xl">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My profile</h1>
              <p className="text-sm text-slate-600">View your details. Click edit to update your profile.</p>
            </div>

            <Card className="p-6 sm:p-8 space-y-5 border-slate-200 shadow-none">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Profile details</h2>
                {!editing ? (
                  <Button type="button" onClick={handleStartEdit}>Edit</Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={handleDiscard} disabled={saving}>
                      Discard
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input type="email" value={draft.email} disabled />
                <Input
                  type="text"
                  placeholder="First name"
                  value={draft.first_name}
                  disabled={!editing || saving}
                  onChange={(event) => setDraft((prev) => prev ? { ...prev, first_name: event.target.value } : prev)}
                />
                <Input
                  type="text"
                  placeholder="Last name"
                  value={draft.last_name}
                  disabled={!editing || saving}
                  onChange={(event) => setDraft((prev) => prev ? { ...prev, last_name: event.target.value } : prev)}
                />
                <Input
                  type="text"
                  placeholder="Contact info"
                  value={draft.contact_info}
                  disabled={!editing || saving}
                  onChange={(event) => setDraft((prev) => prev ? { ...prev, contact_info: event.target.value } : prev)}
                />
                <Input
                  type="text"
                  placeholder="Emergency contact name"
                  value={draft.emergency_contact_name}
                  disabled={!editing || saving}
                  onChange={(event) => setDraft((prev) => prev ? { ...prev, emergency_contact_name: event.target.value } : prev)}
                />
                <Input
                  type="text"
                  placeholder="Emergency number"
                  value={draft.emergency_number}
                  disabled={!editing || saving}
                  onChange={(event) => setDraft((prev) => prev ? { ...prev, emergency_number: event.target.value } : prev)}
                />
              </div>

              <textarea
                className="w-full min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm disabled:opacity-70"
                placeholder="Address"
                value={draft.address}
                disabled={!editing || saving}
                onChange={(event) => setDraft((prev) => prev ? { ...prev, address: event.target.value } : prev)}
              />

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {success ? <p className="text-sm text-green-700">{success}</p> : null}
            </Card>
          </div>
        )}
      </DriveLayout>
    </AuthGuard>
  )
}
