'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, clearStoredTokens, isAuthenticated } from '@/lib/api'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }

    api.getCurrentUser()
      .then(() => router.replace('/drive'))
      .catch(() => {
        clearStoredTokens()
        router.replace('/login')
      })
  }, [router])

  return null
}
