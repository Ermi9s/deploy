'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { api, clearStoredTokens, isAuthenticated } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ShieldAlert } from 'lucide-react'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3000'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) return
    api.getCurrentUser()
      .then((user) => {
        if (user.is_superuser) {
          router.replace('/admin')
        } else {
          window.location.href = `${PORTAL_URL}/drive`
        }
      })
      .catch(() => clearStoredTokens())
  }, [router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.login(email.trim(), password)
      const user = await api.getCurrentUser()
      if (user.is_superuser) {
        router.replace('/admin')
      } else {
        setError('Your account does not have administrator privileges.')
        clearStoredTokens()
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-2xl">
            Ω
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground">OKnowledge Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in with your administrator credentials.</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            id="admin-email"
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="bg-background"
          />
          <Input
            id="admin-password"
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="bg-background"
          />

          {error ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : null}

          <Button
            id="admin-login-submit"
            className="w-full font-semibold shadow-md"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Admin Panel'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          Not an admin?{' '}
          <a href={`${PORTAL_URL}/login`} className="text-primary hover:underline">
            Return to the user portal
          </a>
        </p>
      </Card>
    </div>
  )
}
