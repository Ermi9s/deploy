'use client'

import { FormEvent, useEffect, useState } from 'react'
import { AuthUser } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface UserFormProps {
  user: AuthUser
  onSave: (payload: { email?: string; first_name?: string; last_name?: string }) => Promise<void>
}

export default function UserForm({ user, onSave }: UserFormProps) {
  const [email, setEmail] = useState(user.email ?? '')
  const [firstName, setFirstName] = useState(user.first_name ?? '')
  const [lastName, setLastName] = useState(user.last_name ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setEmail(user.email ?? '')
    setFirstName(user.first_name ?? '')
    setLastName(user.last_name ?? '')
  }, [user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await onSave({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      })
      setSuccess('Account details updated.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update account details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Account details</h2>
        <p className="text-sm text-gray-600">Update your email and display name.</p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="First name"
          />
          <Input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Last name"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-green-700">{success}</p> : null}

        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save account details'}
        </Button>
      </form>
    </Card>
  )
}
