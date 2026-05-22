import type { Metadata } from 'next'
import DriveLayout from '@/components/drive/drive-layout'
import { ChatWindow } from '@/components/chat/ChatWindow'

export const metadata: Metadata = {
  title: 'Knowledge Assistant — OKM',
  description:
    'Ask questions across your organisation\'s documents. Responses are permission-filtered and grounded in your approved knowledge base.',
}

export default function ChatPage() {
  return (
    <DriveLayout>
      <ChatWindow />
    </DriveLayout>
  )
}
