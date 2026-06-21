import { Pool } from 'pg'
import { v4 as uuidv4 } from 'crypto'

export interface SendMessageRequest {
  lead: {
    email: string
    name: string
    company?: string
    custom_fields?: Record<string, any>
  }
  template_id: string
  variant_id?: string
  engine: 'page-agent' | 'backend-batch'
  metadata?: Record<string, any>
}

export interface SendMessageResponse {
  message_id: string
  lead_id: string
  status: string
  sent_at?: string
  content_preview: string
}

export class OutreachService {
  constructor(private db: Pool) {}

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    // 1. Validate lead exists or create it
    let leadId: string
    const existingLead = await this.db.query(
      'SELECT id FROM outreach_leads WHERE email = $1',
      [request.lead.email]
    )

    if (existingLead.rows.length > 0) {
      leadId = existingLead.rows[0].id
    } else {
      // Create new lead
      const newLead = await this.db.query(
        `INSERT INTO outreach_leads (email, name, company, custom_fields)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          request.lead.email,
          request.lead.name,
          request.lead.company || null,
          JSON.stringify(request.lead.custom_fields || {}),
        ]
      )
      leadId = newLead.rows[0].id
    }

    // 2. Validate template exists
    const templateResult = await this.db.query(
      'SELECT id, base_content FROM outreach_templates WHERE id = $1',
      [request.template_id]
    )

    if (templateResult.rows.length === 0) {
      throw new Error(`Template not found: ${request.template_id}`)
    }

    const template = templateResult.rows[0]

    // 3. Render template (simple substitution)
    let renderedContent = template.base_content
    renderedContent = renderedContent.replace(/\{\{lead\.name\}\}/g, request.lead.name)
    renderedContent = renderedContent.replace(/\{\{lead\.email\}\}/g, request.lead.email)
    if (request.lead.company) {
      renderedContent = renderedContent.replace(/\{\{lead\.company\}\}/g, request.lead.company)
    }

    // 4. Create message record
    const messageId = uuidv4()
    const now = new Date().toISOString()

    await this.db.query(
      `INSERT INTO outreach_messages
       (id, lead_id, template_id, variant_id, engine, status, content_rendered, created_at, updated_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        messageId,
        leadId,
        request.template_id,
        request.variant_id || null,
        request.engine,
        'sent', // For MVP, mark as sent immediately
        renderedContent,
        now,
        now,
        JSON.stringify(request.metadata || {}),
      ]
    )

    return {
      message_id: messageId,
      lead_id: leadId,
      status: 'sent',
      sent_at: now,
      content_preview: renderedContent.substring(0, 100) + '...',
    }
  }

  async getMessageStatus(messageId: string) {
    const messageResult = await this.db.query(
      `SELECT id, lead_id, status, sent_at, created_at
       FROM outreach_messages
       WHERE id = $1`,
      [messageId]
    )

    if (messageResult.rows.length === 0) {
      throw new Error(`Message not found: ${messageId}`)
    }

    const message = messageResult.rows[0]

    // Get delivery events
    const eventsResult = await this.db.query(
      `SELECT event_type, timestamp FROM outreach_delivery_events
       WHERE message_id = $1
       ORDER BY timestamp DESC`,
      [messageId]
    )

    return {
      message_id: messageId,
      lead_id: message.lead_id,
      status: message.status,
      sent_at: message.sent_at,
      created_at: message.created_at,
      events: eventsResult.rows,
    }
  }
}
