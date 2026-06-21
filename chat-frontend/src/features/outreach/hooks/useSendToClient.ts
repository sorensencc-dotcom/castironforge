import { useState, useCallback } from 'react'
import { SendMessageRequest, SendMessageResponse } from '@castironforge/shared-types'
import { OutreachAPI } from '../services/outreachAPI.js'

export interface UseSendToClientState {
  loading: boolean
  error: string | null
  response: SendMessageResponse | null
}

export interface UseSendToClientActions {
  send: (request: SendMessageRequest) => Promise<void>
  reset: () => void
}

export function useSendToClient(api: OutreachAPI): UseSendToClientState & UseSendToClientActions {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<SendMessageResponse | null>(null)

  const send = useCallback(
    async (request: SendMessageRequest) => {
      setLoading(true)
      setError(null)
      setResponse(null)

      try {
        const result = await api.sendMessage(request)
        setResponse(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setResponse(null)
  }, [])

  return {
    loading,
    error,
    response,
    send,
    reset,
  }
}
