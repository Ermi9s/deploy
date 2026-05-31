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
        <div className="flex flex-col h-screen p-4 md:p-6 lg:p-8 bg-background">
          <div className="flex flex-col flex-1 border border-border rounded-xl shadow-xl overflow-hidden bg-card min-h-0">
            <ReportListClient />
          </div>
        </div>
      </AppLayout>
    </AuthGuard>
  )
}
