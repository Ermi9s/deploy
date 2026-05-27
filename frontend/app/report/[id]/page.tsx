import type { Metadata } from 'next'
import { AppLayout } from '@/components/layout/AppLayout'
import AuthGuard from '@/components/auth/auth-guard'
import { ReportDetailClient } from '@/components/report/ReportDetailClient'

export const metadata: Metadata = {
  title: 'Report — OKM',
  description: 'View your AI-generated report with per-agenda sub-reports and a synthesised final report.',
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AuthGuard>
      <AppLayout>
        <ReportDetailClient jobId={id} />
      </AppLayout>
    </AuthGuard>
  )
}
