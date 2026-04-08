'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await api.forgotPassword(email.trim())
      setSuccess(response.detail || 'If that email exists, a reset link has been sent.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6 border-slate-200 shadow-none">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Forgot password</h1>
          <p className="text-sm text-slate-600">Enter your email to request a password reset.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-green-700">{success}</p> : null}

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? 'Requesting...' : 'Request reset'}
          </Button>
        </form>

        <p className="text-sm text-slate-600 text-center">
          Back to{' '}
          <Link className="text-blue-600 hover:underline" href="/login">
            sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}
