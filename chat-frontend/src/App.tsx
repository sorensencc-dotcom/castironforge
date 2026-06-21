import { useState, useMemo } from 'react'
import { createApiClient } from './services/api/client.js'
import { OutreachAPI } from './features/outreach/services/outreachAPI.js'
import { SendToClientButton } from './features/outreach/components/SendToClientButton.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN || 'test-token-dev'

export default function App() {
  const [messageId, setMessageId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const api = useMemo(() => {
    const client = createApiClient(API_BASE_URL, AUTH_TOKEN)
    return new OutreachAPI(client)
  }, [])

  const handleSuccess = async (id: string) => {
    setMessageId(id)
    setStatus('Message sent successfully!')

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const messageStatus = await api.getMessageStatus(id)
      setStatus(`Status: ${messageStatus.status} - Sent at ${messageStatus.sent_at}`)
    } catch (error) {
      setStatus(`Error fetching status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleError = (error: string) => {
    setStatus(`Error: ${error}`)
    setMessageId(null)
  }

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1>Outreach Automation</h1>

      <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>Send to Client Demo</h2>

        <SendToClientButton
          api={api}
          lead={{
            email: 'john@example.com',
            name: 'John Smith',
            company: 'Acme Corp',
          }}
          templateId='template-1'
          onSuccess={handleSuccess}
          onError={handleError}
        />

        {status && (
          <div
            style={{
              marginTop: '20px',
              padding: '12px',
              backgroundColor: messageId ? '#d4edda' : '#fff3cd',
              color: messageId ? '#155724' : '#856404',
              borderRadius: '4px',
            }}
          >
            {status}
            {messageId && <div style={{ marginTop: '8px', fontSize: '12px' }}>Message ID: {messageId}</div>}
          </div>
        )}
      </div>

      <div style={{ fontSize: '12px', color: '#666' }}>
        <p>API Base URL: {API_BASE_URL}</p>
        <p>This demo sends a message to the backend and polls for the status.</p>
      </div>
    </div>
  )
}
