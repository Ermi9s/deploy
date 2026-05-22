'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, clearStoredTokens, isAuthenticated } from '@/lib/api'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3000'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }

    api.getCurrentUser()
      .then((user) => {
        if (user.is_superuser) {
          router.replace('/admin')
        } else {
          // Not an admin — send them back to the user portal
          window.location.href = `${PORTAL_URL}/drive`
        }
      })
      .catch(() => {
        clearStoredTokens()
        router.replace('/login')
      })
  }, [router])

  return null
}
