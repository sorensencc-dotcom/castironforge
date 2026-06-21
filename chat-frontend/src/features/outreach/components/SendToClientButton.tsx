import React, { useState } from 'react'
import { SendMessageRequest } from '@castironforge/shared-types'
import { OutreachAPI } from '../services/outreachAPI.js'
import { useSendToClient } from '../hooks/useSendToClient.js'

export interface SendToClientButtonProps {
  api: OutreachAPI
  lead: {
    email: string
    name: string
    company?: string
  }
  templateId: string
  onSuccess?: (messageId: string) => void
  onError?: (error: string) => void
}

export const SendToClientButton: React.FC<SendToClientButtonProps> = ({
  api,
  lead,
  templateId,
  onSuccess,
  onError,
}) => {
  const [showModal, setShowModal] = useState(false)
  const { loading, error, response, send, reset } = useSendToClient(api)

  const handleSend = async () => {
    const request: SendMessageRequest = {
      lead,
      template_id: templateId,
    }

    await send(request)
  }

  const handleClose = () => {
    setShowModal(false)
    reset()
  }

  React.useEffect(() => {
    if (response?.message_id && onSuccess) {
      onSuccess(response.message_id)
      handleClose()
    }
  }, [response])

  React.useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error])

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          padding: '8px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        Send to Client
      </button>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Send Message</h2>

            <div style={{ marginBottom: '16px' }}>
              <p>
                <strong>To:</strong> {lead.name} ({lead.email})
              </p>
              {lead.company && (
                <p>
                  <strong>Company:</strong> {lead.company}
                </p>
              )}
              <p>
                <strong>Template ID:</strong> {templateId}
              </p>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '16px',
                }}
              >
                {error}
              </div>
            )}

            {response && (
              <div
                style={{
                  backgroundColor: '#d4edda',
                  color: '#155724',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '16px',
                }}
              >
                Message sent successfully! ID: {response.message_id}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleClose}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: loading ? '#cccccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
