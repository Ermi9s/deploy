import type { Metadata } from 'next'
import { AppLayout } from '@/components/layout/AppLayout'
import AuthGuard from '@/components/auth/auth-guard'
import { ChatWindow } from '@/components/chat/ChatWindow'

export const metadata: Metadata = {
  title: 'Knowledge Assistant — OKM',
  description:
    'Ask questions across your organisation\'s documents. Responses are permission-filtered and grounded in your approved knowledge base.',
}

export default function ChatPage() {
  return (
    <AuthGuard>
      <AppLayout>
        <div className="h-full p-4 md:p-6 lg:p-8">
          <ChatWindow />
        </div>
      </AppLayout>
    </AuthGuard>
  )
}
