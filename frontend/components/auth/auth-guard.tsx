'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, clearStoredTokens, isAuthenticated } from '@/lib/api'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    const verify = async () => {
      if (!isAuthenticated()) {
        router.replace('/login')
        return
      }

      try {
        await api.getCurrentUser()
        if (active) {
          setChecking(false)
        }
      } catch {
        clearStoredTokens()
        router.replace('/login')
      }
    }

    void verify()

    return () => {
      active = false
    }
  }, [router])

  if (checking) {
    return (
      <div className="py-16 text-center text-gray-500 text-sm">
        Checking session...
      </div>
    )
  }

  return <>{children}</>
}
