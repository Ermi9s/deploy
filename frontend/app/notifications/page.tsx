import type { Metadata } from 'next'
import { AppLayout } from '@/components/layout/AppLayout'
import AuthGuard from '@/components/auth/auth-guard'
import { NotificationsView } from '@/components/notifications/NotificationsView'

export const metadata: Metadata = {
  title: 'Notifications — OKM',
  description: 'Planning alerts, milestone completions, and AI analysis results for your department.',
}

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <AppLayout>
        <div className="h-full p-4 md:p-6 lg:p-8">
          <NotificationsView />
        </div>
      </AppLayout>
    </AuthGuard>
  )
}
