'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, clearStoredTokens, isAuthenticated } from '@/lib/api'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()

  useEffect(() => {
    let active = true

    const verify = async () => {
      if (!isAuthenticated()) {
        router.replace('/login')
        return
      }

      try {
        await api.getCurrentUser()
      } catch {
        if (active) {
          clearStoredTokens()
          router.replace('/login')
        }
      }
    }

    void verify()

    return () => {
      active = false
    }
  }, [router])

  return <>{children}</>
}
