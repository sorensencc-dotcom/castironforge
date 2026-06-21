import { ApiClient } from '../../../services/api/client.js'
import { SendMessageRequest, SendMessageResponse, OutreachMessage } from '@castironforge/shared-types'

export class OutreachAPI {
  constructor(private client: ApiClient) {}

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.client.post<SendMessageResponse>('/api/v1/outreach/send', request)
  }

  async getMessageStatus(messageId: string): Promise<OutreachMessage> {
    return this.client.get<OutreachMessage>(`/api/v1/outreach/${messageId}/status`)
  }
}
