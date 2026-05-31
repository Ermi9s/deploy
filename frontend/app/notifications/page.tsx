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
        <div className="flex flex-col h-screen p-4 md:p-6 lg:p-8 bg-background">
          <div className="flex flex-col flex-1 border border-border rounded-xl shadow-xl overflow-hidden bg-card min-h-0">
            <NotificationsView />
          </div>
        </div>
      </AppLayout>
    </AuthGuard>
  )
}
