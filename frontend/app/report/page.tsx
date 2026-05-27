import type { Metadata } from 'next'
import { AppLayout } from '@/components/layout/AppLayout'
import AuthGuard from '@/components/auth/auth-guard'
import { ReportListClient } from '@/components/report/ReportListClient'

export const metadata: Metadata = {
  title: 'Reports — OKM',
  description: 'Generate AI-powered reports from your organisation\'s knowledge base using Scatter-Gather RAG.',
}

export default function ReportPage() {
  return (
    <AuthGuard>
      <AppLayout>
        <ReportListClient />
      </AppLayout>
    </AuthGuard>
  )
}
