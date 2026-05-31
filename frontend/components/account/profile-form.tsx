'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { UserProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface ProfileFormProps {
  profile: UserProfile | null
  onSave: (payload: Partial<UserProfile>) => Promise<void>
  onUploadPicture: (file: File) => Promise<void>
  onRemovePicture: () => Promise<void>
}

export default function ProfileForm({ profile, onSave, onUploadPicture, onRemovePicture }: ProfileFormProps) {
  const [contactInfo, setContactInfo] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [emergencyContactName, setEmergencyContactName] = useState('')
  const [emergencyNumber, setEmergencyNumber] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setContactInfo(profile?.contact_info ?? '')
    setFirstName(profile?.firstname ?? '')
    setLastName(profile?.lastname ?? '')
    setEmergencyContactName(profile?.emergency_contact_name ?? '')
    setEmergencyNumber(profile?.emergency_number ?? '')
    setAddress(profile?.address ?? '')
  }, [profile])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await onSave({
        contact_info: contactInfo.trim(),
        firstname: firstName.trim(),
        lastname: lastName.trim(),
        emergency_contact_name: emergencyContactName.trim(),
        emergency_number: emergencyNumber.trim(),
        address: address.trim(),
      })
      setSuccess('Profile updated.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handlePictureUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setError('')
    setSuccess('')
    setUploading(true)

    try {
      await onUploadPicture(file)
      setSuccess('Profile picture updated.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to upload picture')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleRemovePicture = async () => {
    setError('')
    setSuccess('')
    setUploading(true)

    try {
      await onRemovePicture()
      setSuccess('Profile picture removed.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to remove picture')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your profile information.</p>
      </div>

      <div className="space-y-2">
        {profile?.profile_pic ? (
          <img src={profile.profile_pic} alt="Profile" className="h-20 w-20 rounded-full object-cover border" />
        ) : (
          <div className="h-20 w-20 rounded-full bg-gray-200 border" />
        )}
        <div className="flex gap-2 items-center">
          <Input type="file" accept="image/*" onChange={handlePictureUpload} disabled={uploading} />
          <Button type="button" variant="outline" onClick={handleRemovePicture} disabled={uploading}>
            Remove
          </Button>
        </div>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <Input
          type="text"
          placeholder="Contact info"
          value={contactInfo}
          onChange={(event) => setContactInfo(event.target.value)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            type="text"
            placeholder="Profile first name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <Input
            type="text"
            placeholder="Profile last name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            type="text"
            placeholder="Emergency contact name"
            value={emergencyContactName}
            onChange={(event) => setEmergencyContactName(event.target.value)}
          />
          <Input
            type="text"
            placeholder="Emergency number"
            value={emergencyNumber}
            onChange={(event) => setEmergencyNumber(event.target.value)}
          />
        </div>

        <textarea
          className="w-full min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          placeholder="Address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-green-700">{success}</p> : null}

        <Button type="submit" disabled={loading || uploading}>
          {loading ? 'Saving...' : 'Save profile'}
        </Button>
      </form>
    </Card>
  )
}
