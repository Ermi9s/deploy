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
        <div className="h-full p-4 md:p-6 lg:p-8">
          <PlanningDashboard />
        </div>
      </AppLayout>
    </AuthGuard>
  )
}
