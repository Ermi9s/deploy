import type { Metadata } from 'next'
import { AppLayout } from '@/components/layout/AppLayout'
import AuthGuard from '@/components/auth/auth-guard'
import { PlanningDashboard } from '@/components/planning/PlanningDashboard'

export const metadata: Metadata = {
  title: 'Strategic Planning — OKM',
  description:
    'Define departmental objectives and track automatic completion metrics evaluated by our semantic Gemini AI models.',
}

export default function PlanningPage() {
  return (
    <AuthGuard>
      <AppLayout>
        <div className="flex flex-col h-screen p-4 md:p-6 lg:p-8 bg-background">
          <div className="flex flex-col flex-1 border border-border rounded-xl shadow-xl overflow-hidden bg-card min-h-0">
            <PlanningDashboard />
          </div>
        </div>
      </AppLayout>
    </AuthGuard>
  )
}
