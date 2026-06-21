/**
 * Shared Types for Phase-5 Outreach Automation
 * Used by: chat-frontend, chat-agent, Planning Engine
 * Version: 1.0.0
 */

// ============================================================================
// CORE DOMAIN MODELS
// ============================================================================

export interface Lead {
  id: string
  email: string
  name: string
  company?: string
  title?: string
  industry?: string
  custom_fields: Record<string, string | number | boolean>
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

export interface Template {
  id: string
  name: string
  base_content: string
  tone: 'formal' | 'casual' | 'sales' | 'follow-up'
  variants?: Variant[]
  personalization_tokens: string[] // e.g. ["{{lead.name}}", "{{custom.product}}"]
  a_b_config?: {
    enabled: boolean
    control_variant_id?: string
    treatment_variant_id?: string
  }
  created_by: string
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

export interface Variant {
  id: string
  template_id: string
  content: string
  tone?: string
  generated_by: 'llm' | 'manual'
  a_b_bucket?: 'control' | 'treatment'
  created_at: string // ISO 8601
}

export type MessageStatus = 'pending' | 'sent' | 'bounced' | 'failed' | 'opened' | 'clicked'

export interface OutreachMessage {
  id: string
  lead_id: string
  template_id: string
  variant_id?: string
  campaign_id?: string
  engine: 'page-agent' | 'backend-batch'
  status: MessageStatus
  content_rendered: string
  error?: string
  sent_at?: string // ISO 8601
  opened_at?: string // ISO 8601
  clicked_at?: string // ISO 8601
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
  metadata: {
    ip_address?: string
    user_agent?: string
    initiator_id?: string
  }
}

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled' | 'failed'

export interface Campaign {
  id: string
  name: string
  template_id: string
  lead_count: number
  status: CampaignStatus
  scheduled_at?: string // ISO 8601
  started_at?: string // ISO 8601
  completed_at?: string // ISO 8601
  created_by: string
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

export interface CampaignStats {
  sent: number
  failed: number
  opened: number
  clicked: number
  bounced: number
  success_rate: number // 0-1
  open_rate: number // 0-1
  click_rate: number // 0-1
  bounce_rate: number // 0-1
}

export type DeliveryEventType = 'sent' | 'bounced' | 'failed' | 'opened' | 'clicked' | 'spamreport' | 'unsubscribe'

export interface DeliveryEvent {
  id: string
  message_id: string
  event_type: DeliveryEventType
  timestamp: string // ISO 8601
  provider: string // 'sendgrid', 'mailgun', 'aws_ses', etc.
  raw_event: Record<string, any>
  created_at: string // ISO 8601
}

export type AuditEventType =
  | 'send'
  | 'campaign_create'
  | 'campaign_cancel'
  | 'template_create'
  | 'template_update'
  | 'template_delete'
  | 'variant_generate'
  | 'lead_import'
  | 'message_opened'
  | 'message_clicked'

export interface AuditLog {
  id: string
  event_type: AuditEventType
  actor: {
    id: string
    email: string
    role: 'admin' | 'user' | 'service'
  }
  resource: {
    type: 'message' | 'campaign' | 'template' | 'lead'
    id: string
  }
  changes?: {
    before: Record<string, any>
    after: Record<string, any>
  }
  context: {
    ip_address?: string
    user_agent?: string
    api_version: string
  }
  timestamp: string // ISO 8601
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

// Common envelope for all API responses
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  meta: {
    request_id: string
    timestamp: string // ISO 8601
  }
}

export interface ApiError {
  code: ErrorCode
  message: string
  details?: Record<string, any>
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_EMAIL'
  | 'EMAIL_ALREADY_SENT_TODAY'
  | 'TEMPLATE_NOT_FOUND'
  | 'LEAD_NOT_FOUND'
  | 'MISSING_PERSONALIZATION_TOKENS'
  | 'INVALID_CSV_FORMAT'
  | 'CSV_TOO_LARGE'

// ============================================================================
// OUTREACH SEND ENDPOINT
// ============================================================================

export interface SendMessageRequest {
  lead: {
    email: string
    name: string
    company?: string
    title?: string
    industry?: string
    custom_fields?: Record<string, string | number | boolean>
  }
  template_id: string
  variant_id?: string
  engine?: 'page-agent' | 'backend-batch'
  metadata?: {
    source?: string
    user_context?: string
  }
}

export interface SendMessageResponse {
  message_id: string
  lead_id: string
  status: MessageStatus
  sent_at?: string // ISO 8601
  variant_id?: string
  content_preview: string
}

// ============================================================================
// OUTREACH BATCH ENDPOINT
// ============================================================================

export interface BatchSendRequest {
  campaign_name: string
  template_id: string
  leads: Array<{
    email: string
    name: string
    company?: string
    title?: string
    industry?: string
    custom_fields?: Record<string, string | number | boolean>
  }>
  scheduled_at?: string // ISO 8601, null for immediate
  a_b_config?: {
    enabled: boolean
    control_variant_id?: string
    treatment_variant_id?: string
  }
}

export interface BatchSendResponse {
  campaign_id: string
  name: string
  lead_count: number
  status: CampaignStatus
  scheduled_at?: string // ISO 8601
  created_at: string // ISO 8601
  estimated_completion?: string // ISO 8601
}

// ============================================================================
// TEMPLATE PREVIEW ENDPOINT
// ============================================================================

export interface PreviewTemplateRequest {
  template_id: string
  variant_id?: string
  lead: {
    email: string
    name: string
    company?: string
    title?: string
    industry?: string
    custom_fields?: Record<string, string | number | boolean>
  }
}

export interface PreviewTemplateResponse {
  template_id: string
  variant_id?: string
  rendered_content: string
  tokens_substituted: string[]
}

// ============================================================================
// MESSAGE STATUS ENDPOINT
// ============================================================================

export interface MessageStatusResponse {
  message_id: string
  lead_id: string
  status: MessageStatus
  sent_at?: string // ISO 8601
  opened_at?: string // ISO 8601
  clicked_at?: string // ISO 8601
  events?: Array<{
    event_type: DeliveryEventType
    timestamp: string // ISO 8601
  }>
}

// ============================================================================
// CAMPAIGN ENDPOINTS
// ============================================================================

export interface CampaignResponse {
  campaign_id: string
  name: string
  status: CampaignStatus
  template_id: string
  lead_count: number
  stats: CampaignStats
  created_at: string // ISO 8601
  started_at?: string // ISO 8601
  completed_at?: string // ISO 8601
}

export interface CampaignListResponse {
  campaigns: CampaignResponse[]
  pagination: {
    limit: number
    offset: number
    total: number
    has_more: boolean
  }
}

export interface CancelCampaignRequest {
  reason?: string
}

export interface CancelCampaignResponse {
  campaign_id: string
  status: 'cancelled'
  messages_sent: number
  messages_cancelled: number
  cancelled_at: string // ISO 8601
}

// ============================================================================
// TEMPLATE ENDPOINTS
// ============================================================================

export interface CreateTemplateRequest {
  name: string
  base_content: string
  tone: 'formal' | 'casual' | 'sales' | 'follow-up'
  a_b_config?: {
    enabled: boolean
  }
}

export interface UpdateTemplateRequest {
  name?: string
  base_content?: string
  tone?: 'formal' | 'casual' | 'sales' | 'follow-up'
}

export interface TemplateResponse extends Template {
  // Full template object with variants
}

// ============================================================================
// VARIANT GENERATION ENDPOINT
// ============================================================================

export interface GenerateVariantsRequest {
  tone: 'formal' | 'casual' | 'sales' | 'follow-up'
  count: number
  custom_prompt?: string
}

export interface GenerateVariantsResponse {
  template_id: string
  job_id: string
  status: 'processing' | 'completed' | 'failed'
  estimated_completion?: string // ISO 8601
  variants?: Variant[]
}

// ============================================================================
// WEBHOOK EVENTS
// ============================================================================

export interface WebhookEvent {
  type: 'delivery' | 'status_update'
  timestamp: string // ISO 8601
}

export interface DeliveryWebhookEvent extends WebhookEvent {
  type: 'delivery'
  event_type: DeliveryEventType
  message_id: string
  provider: string
  provider_event_id: string
  raw_event: Record<string, any>
}

export interface SendgridWebhookPayload {
  event: string
  email: string
  timestamp: number
  sg_message_id: string
  sg_event_id: string
  metadata?: {
    outreach_message_id?: string
  }
}

export interface MailgunWebhookPayload {
  'event-data': {
    event: string
    timestamp: number
    'message-id': string
    recipient: string
    metadata?: {
      outreach_message_id?: string
    }
  }
}

// ============================================================================
// ANALYTICS ENDPOINT
// ============================================================================

export interface AnalyticsRequest {
  campaign_id?: string
  days?: number // default 7, max 90
  group_by?: 'day' | 'hour'
}

export interface AnalyticsSummary {
  total_sent: number
  success_rate: number // 0-1
  open_rate: number // 0-1
  click_rate: number // 0-1
  bounce_rate: number // 0-1
}

export interface AnalyticsTimeseries {
  timestamp: string // ISO 8601
  sent: number
  opened: number
  clicked: number
  bounced: number
  failed: number
}

export interface VariantComparison {
  control: {
    open_rate: number
    click_rate: number
  }
  treatment: {
    open_rate: number
    click_rate: number
  }
}

export interface AnalyticsResponse {
  period: string
  summary: AnalyticsSummary
  timeseries: AnalyticsTimeseries[]
  variant_comparison?: VariantComparison
}

// ============================================================================
// AUDIT LOG ENDPOINT
// ============================================================================

export interface AuditLogQueryParams {
  start_date?: string // ISO 8601
  end_date?: string // ISO 8601
  event_type?: string[] // comma-separated
  actor_id?: string
  format?: 'csv' | 'json'
}

export interface AuditLogListResponse {
  logs: AuditLog[]
  pagination: {
    limit: number
    offset: number
    total: number
    has_more: boolean
  }
}

// ============================================================================
// PAGINATION & FILTERING
// ============================================================================

export interface PaginationParams {
  limit?: number // default 20, max 100
  offset?: number // default 0
  sort?: string // format: "field:direction", e.g. "created_at:desc"
}

export interface PaginationMeta {
  limit: number
  offset: number
  total: number
  has_more: boolean
}

export interface ListParams extends PaginationParams {
  status?: string
  created_after?: string // ISO 8601
  created_before?: string // ISO 8601
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number // Unix timestamp
}

export interface RateLimitExceededError extends ApiError {
  code: 'RATE_LIMIT_EXCEEDED'
  retry_after: number // seconds
}

// ============================================================================
// IDEMPOTENCY
// ============================================================================

export interface IdempotencyKey {
  key: string // UUID
  resource_id: string // message_id or campaign_id
  response_json: ApiResponse<any>
  created_at: string // ISO 8601
  expires_at: string // ISO 8601
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type EngineType = 'page-agent' | 'backend-batch'

export type Tone = 'formal' | 'casual' | 'sales' | 'follow-up'

export interface UserContext {
  id: string
  email: string
  role: 'admin' | 'user' | 'service'
  scopes: string[] // ['outreach:send', 'outreach:read', etc.]
}

export interface RequestContext {
  user: UserContext
  request_id: string
  timestamp: string // ISO 8601
  ip_address?: string
  user_agent?: string
}

// ============================================================================
// PLANNING ENGINE INTEGRATION
// ============================================================================

export interface PlanningEngineOutreachRequest {
  campaign_name: string
  template_id: string
  leads: Lead[]
  scheduled_at?: string // ISO 8601
  context?: {
    plan_id?: string
    workflow_id?: string
    step_id?: string
  }
}

export interface PlanningEngineMetricsRequest {
  campaign_id?: string
  days?: number
}

export interface PlanningEngineMetricsResponse {
  campaign_id?: string
  metrics: AnalyticsSummary
  variant_recommendation?: {
    recommended_variant_id: string
    reason: string
    lift_percentage: number
  }
}

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

export function isOutreachMessage(obj: any): obj is OutreachMessage {
  return obj && typeof obj.id === 'string' && typeof obj.status === 'string'
}

export function isCampaign(obj: any): obj is Campaign {
  return obj && typeof obj.id === 'string' && typeof obj.template_id === 'string'
}

export function isTemplate(obj: any): obj is Template {
  return obj && typeof obj.id === 'string' && typeof obj.base_content === 'string'
}

export function isLead(obj: any): obj is Lead {
  return obj && typeof obj.email === 'string' && typeof obj.name === 'string'
}

export function isApiError<T>(response: ApiResponse<T>): response is ApiResponse<never> {
  return !response.success && !!response.error
}

export function isSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> {
  return response.success && !!response.data
}
