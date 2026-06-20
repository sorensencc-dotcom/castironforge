# Unified Outreach API Specification

**Version:** 1.0.0  
**Status:** Ready for Implementation  
**Owner:** RewriteLabs Backend  
**Updated:** 2026-06-20

---

## 0. Overview

Single API surface for both interactive (Page-Agent) and batch outreach engines. This specification defines the contract that both execution modes use, enabling deterministic behavior and seamless integration with the Planning Engine.

**Base URL:** `https://api.castironforge.com/v1` (or `http://localhost:3001/v1` for local dev)

**Authentication:** Bearer token (JWT or API key)  
**Content-Type:** `application/json`

---

## 1. Core Concepts

### Engine Types
- `page-agent` — Interactive, real-time sends triggered from chat UI
- `backend-batch` — Scheduled, bulk sends from backend jobs or Planning Engine

### Message States
- `pending` — Queued for sending
- `sent` — Delivered to provider
- `bounced` — Provider returned bounce
- `failed` — Permanent error (invalid email, blocked, etc.)
- `opened` — Recipient opened (if trackable)
- `clicked` — Recipient clicked link (if trackable)

### Campaign States
- `draft` — Template selected, not yet running
- `scheduled` — Waiting for scheduled send time
- `running` — Actively processing
- `completed` — All leads processed
- `paused` — Manually paused
- `cancelled` — Manually stopped
- `failed` — Batch failed with errors

---

## 2. Authentication & Authorization

### Header Format
```
Authorization: Bearer {token}
X-Idempotency-Key: {uuid}  (optional but recommended for all writes)
X-Request-ID: {uuid}       (optional, for tracing)
```

### Scopes
```
outreach:send          — Send single message
outreach:batch         — Submit bulk sends
outreach:read          — Read messages, campaigns, status
outreach:templates     — CRUD templates
outreach:webhooks      — Receive webhook events
admin:audit            — Read/export audit logs
```

### Rate Limits
- **Default:** 100 requests/minute per user
- **Burst:** 500 requests/minute (authenticated service accounts)
- **Response Headers:**
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 42
  X-RateLimit-Reset: 1687234800
  ```

---

## 3. Common Response Envelope

All responses follow this structure:

### Success (2xx)
```json
{
  "success": true,
  "data": { /* endpoint-specific payload */ },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-20T10:30:45.123Z"
  }
}
```

### Error (4xx, 5xx)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email address is invalid",
    "details": {
      "field": "lead.email",
      "value": "not-an-email"
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-20T10:30:45.123Z"
  }
}
```

### Error Codes
- `VALIDATION_ERROR` (400) — Invalid input
- `AUTHENTICATION_ERROR` (401) — Missing or invalid token
- `AUTHORIZATION_ERROR` (403) — Insufficient permissions
- `NOT_FOUND` (404) — Resource doesn't exist
- `CONFLICT` (409) — Resource already exists (duplicate)
- `RATE_LIMIT_EXCEEDED` (429) — Too many requests
- `INTERNAL_SERVER_ERROR` (500) — Unexpected server error
- `SERVICE_UNAVAILABLE` (503) — Temporary outage

---

## 4. Shared Data Models

### Lead
```typescript
interface Lead {
  id: string                    // UUID, auto-generated
  email: string                 // Required, validated
  name: string                  // Required
  company?: string              // Optional
  title?: string                // Optional
  industry?: string             // Optional
  custom_fields: Record<string, string | number | boolean>  // User-defined
  created_at: string            // ISO 8601
  updated_at: string            // ISO 8601
}
```

### Template
```typescript
interface Template {
  id: string                    // UUID, auto-generated
  name: string                  // User-defined
  base_content: string          // HTML or plaintext
  tone: 'formal' | 'casual' | 'sales' | 'follow-up'
  variants?: Variant[]          // Generated or manual variants
  personalization_tokens: string[]  // {{lead.name}}, {{custom.field}}, etc.
  a_b_config?: {
    enabled: boolean
    control_variant_id: string
    treatment_variant_id: string
  }
  created_by: string            // User ID
  created_at: string            // ISO 8601
  updated_at: string            // ISO 8601
}
```

### Variant
```typescript
interface Variant {
  id: string                    // UUID
  template_id: string           // Parent template
  content: string               // Rendered content
  tone?: string                 // Tone override
  generated_by: 'llm' | 'manual'
  a_b_bucket?: 'control' | 'treatment'  // For A/B testing
  created_at: string            // ISO 8601
}
```

### OutreachMessage
```typescript
interface OutreachMessage {
  id: string                    // UUID, auto-generated
  lead_id: string               // FK to Lead
  template_id: string           // FK to Template
  variant_id?: string           // FK to Variant (if A/B test)
  campaign_id?: string          // FK to Campaign (if batch)
  engine: 'page-agent' | 'backend-batch'
  status: 'pending' | 'sent' | 'bounced' | 'failed' | 'opened' | 'clicked'
  content_rendered: string      // Final message (tokens substituted)
  error?: string                // Error message if failed
  sent_at?: string              // ISO 8601
  created_at: string            // ISO 8601
  updated_at: string            // ISO 8601
  metadata: {
    ip_address?: string
    user_agent?: string
    initiator_id?: string        // User who triggered send
  }
}
```

### Campaign
```typescript
interface Campaign {
  id: string                    // UUID, auto-generated
  name: string
  template_id: string           // FK to Template
  lead_count: number            // Total leads
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled' | 'failed'
  scheduled_at?: string         // ISO 8601, null if immediate
  started_at?: string           // ISO 8601
  completed_at?: string         // ISO 8601
  created_by: string            // User ID
  created_at: string            // ISO 8601
  updated_at: string            // ISO 8601
}
```

### DeliveryEvent
```typescript
interface DeliveryEvent {
  id: string                    // UUID
  message_id: string            // FK to OutreachMessage
  event_type: 'sent' | 'bounced' | 'failed' | 'opened' | 'clicked'
  timestamp: string             // ISO 8601, when event occurred
  provider: string              // 'sendgrid', 'mailgun', 'aws_ses', etc.
  raw_event: Record<string, any>  // Original provider event (for debugging)
  created_at: string            // ISO 8601
}
```

### AuditLog
```typescript
interface AuditLog {
  id: string                    // UUID
  event_type: string            // 'send', 'campaign_create', 'template_update', etc.
  actor: {
    id: string                  // User ID or service name
    email: string
    role: string                // 'admin', 'user', 'service'
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
  timestamp: string             // ISO 8601
}
```

---

## 5. API Endpoints

### 5.1 Send Single Message

**POST** `/outreach/send`

Send a single message via Page-Agent or backend (interactive).

#### Request
```json
{
  "lead": {
    "email": "john@acme.com",
    "name": "John Doe",
    "company": "ACME Corp",
    "custom_fields": {
      "company_size": "1000+",
      "region": "US-East"
    }
  },
  "template_id": "tpl_abc123",
  "variant_id": "var_xyz789",
  "engine": "page-agent",
  "metadata": {
    "source": "chat_ui",
    "user_context": "context_data"
  }
}
```

#### Query Parameters
```
?idempotency_key=uuid     (optional, prevents duplicate sends)
?dry_run=true             (optional, render template but don't send)
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "message_id": "msg_abc123",
    "lead_id": "lead_xyz789",
    "status": "sent",
    "sent_at": "2026-06-20T10:30:45Z",
    "variant_id": "var_xyz789",
    "content_preview": "Hi John, following up on…"
  },
  "meta": { /* ... */ }
}
```

#### Error Cases
- `400` — Invalid email, template not found
- `401` — Unauthorized
- `409` — Idempotency key already exists (return existing message_id)
- `429` — Rate limited

---

### 5.2 Batch Submit (Bulk Sends)

**POST** `/outreach/batch`

Submit a batch of leads for bulk sending (backend-batch engine).

#### Request
```json
{
  "campaign_name": "Q3 Followup Campaign",
  "template_id": "tpl_abc123",
  "leads": [
    {
      "email": "alice@acme.com",
      "name": "Alice",
      "company": "ACME",
      "custom_fields": { "region": "US-West" }
    },
    {
      "email": "bob@acme.com",
      "name": "Bob",
      "company": "ACME",
      "custom_fields": { "region": "US-East" }
    }
  ],
  "scheduled_at": "2026-06-21T09:00:00Z",
  "a_b_config": {
    "enabled": true,
    "control_variant_id": "var_ctrl",
    "treatment_variant_id": "var_treat"
  }
}
```

#### Query Parameters
```
?csv_url=https://...      (alternative: upload CSV file via multipart/form-data)
?dedup=true               (skip leads already sent in past 30d)
```

#### Response (202 Accepted)
```json
{
  "success": true,
  "data": {
    "campaign_id": "camp_abc123",
    "name": "Q3 Followup Campaign",
    "lead_count": 2,
    "status": "scheduled",
    "scheduled_at": "2026-06-21T09:00:00Z",
    "created_at": "2026-06-20T10:30:45Z",
    "estimated_completion": "2026-06-21T09:15:00Z"
  },
  "meta": { /* ... */ }
}
```

#### Error Cases
- `400` — Invalid CSV format, template not found, scheduled time in past
- `413` — Too many leads (max 100k per batch)
- `429` — Rate limited

---

### 5.3 Preview Template

**POST** `/outreach/preview`

Render a template with substitutions (useful for UI preview before send).

#### Request
```json
{
  "template_id": "tpl_abc123",
  "variant_id": "var_xyz789",
  "lead": {
    "email": "john@acme.com",
    "name": "John Doe",
    "company": "ACME Corp",
    "custom_fields": { "region": "US-East" }
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "template_id": "tpl_abc123",
    "variant_id": "var_xyz789",
    "rendered_content": "Hi John, following up on your interest in our services at ACME Corp…",
    "tokens_substituted": ["{{lead.name}}", "{{lead.company}}"]
  },
  "meta": { /* ... */ }
}
```

#### Error Cases
- `400` — Invalid lead data, missing required tokens
- `404` — Template or variant not found

---

### 5.4 Get Message Status

**GET** `/outreach/{message_id}/status`

Poll delivery status and events for a single message.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "message_id": "msg_abc123",
    "lead_id": "lead_xyz789",
    "status": "opened",
    "sent_at": "2026-06-20T10:00:00Z",
    "opened_at": "2026-06-20T10:15:30Z",
    "events": [
      {
        "event_type": "sent",
        "timestamp": "2026-06-20T10:00:00Z"
      },
      {
        "event_type": "opened",
        "timestamp": "2026-06-20T10:15:30Z"
      }
    ]
  },
  "meta": { /* ... */ }
}
```

#### Query Parameters
```
?include_events=true      (include full event array)
?include_raw=true         (include raw provider events)
```

#### Error Cases
- `404` — Message not found

---

### 5.5 Get Campaign Status

**GET** `/outreach/campaigns/{campaign_id}`

Retrieve campaign metadata and aggregate stats.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "campaign_id": "camp_abc123",
    "name": "Q3 Followup Campaign",
    "status": "completed",
    "template_id": "tpl_abc123",
    "lead_count": 100,
    "stats": {
      "sent": 95,
      "failed": 5,
      "opened": 42,
      "clicked": 8,
      "success_rate": 0.95,
      "open_rate": 0.442,
      "click_rate": 0.084
    },
    "created_at": "2026-06-20T08:00:00Z",
    "started_at": "2026-06-21T09:00:00Z",
    "completed_at": "2026-06-21T09:45:00Z"
  },
  "meta": { /* ... */ }
}
```

---

### 5.6 List Campaigns

**GET** `/outreach/campaigns`

List all campaigns for current user with pagination and filtering.

#### Query Parameters
```
?status=completed,running   (filter by status, comma-separated)
?created_after=2026-06-01   (ISO 8601 date filter)
?created_before=2026-06-30
?limit=20                   (default 20, max 100)
?offset=0                   (pagination offset)
?sort=created_at:desc       (sort field:direction)
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "campaign_id": "camp_abc123",
        "name": "Q3 Followup Campaign",
        "status": "completed",
        "lead_count": 100,
        "stats": { /* ... */ },
        "created_at": "2026-06-20T08:00:00Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 47,
      "has_more": true
    }
  },
  "meta": { /* ... */ }
}
```

---

### 5.7 Cancel Campaign

**POST** `/outreach/campaigns/{campaign_id}/cancel`

Stop an active or scheduled campaign.

#### Request
```json
{
  "reason": "Campaign paused for review"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "campaign_id": "camp_abc123",
    "status": "cancelled",
    "messages_sent": 45,
    "messages_cancelled": 55,
    "cancelled_at": "2026-06-21T09:30:00Z"
  },
  "meta": { /* ... */ }
}
```

#### Error Cases
- `400` — Campaign already completed
- `404` — Campaign not found

---

### 5.8 Template CRUD

#### Create Template

**POST** `/outreach/templates`

```json
{
  "name": "Q3 Followup",
  "base_content": "Hi {{lead.name}}, following up on your interest in {{custom.product}}. At {{lead.company}}, I know you prioritize…",
  "tone": "sales",
  "a_b_config": {
    "enabled": true
  }
}
```

Response: `201 Created` with full template object + generated variants.

#### Get Template

**GET** `/outreach/templates/{template_id}`

Response: `200 OK` with template + variants.

#### List Templates

**GET** `/outreach/templates?limit=20&offset=0&sort=created_at:desc`

Response: `200 OK` with paginated template list.

#### Update Template

**PUT** `/outreach/templates/{template_id}`

```json
{
  "name": "Q3 Followup (Updated)",
  "base_content": "…"
}
```

Response: `200 OK` with updated template.

#### Delete Template

**DELETE** `/outreach/templates/{template_id}`

Response: `204 No Content`.

---

### 5.9 Generate Template Variants

**POST** `/outreach/templates/{template_id}/variants/generate`

Request LLM to generate new variants of a template.

#### Request
```json
{
  "tone": "formal",
  "count": 3,
  "custom_prompt": "Make it more concise for mobile readers"
}
```

#### Response (202 Accepted)
```json
{
  "success": true,
  "data": {
    "template_id": "tpl_abc123",
    "job_id": "job_xyz789",
    "status": "processing",
    "estimated_completion": "2026-06-20T10:35:00Z"
  },
  "meta": { /* ... */ }
}
```

#### Polling (GET `/outreach/templates/{template_id}/variants/generate/{job_id}`)
```json
{
  "success": true,
  "data": {
    "job_id": "job_xyz789",
    "status": "completed",
    "variants": [
      { "id": "var_1", "content": "…", "generated_by": "llm" },
      { "id": "var_2", "content": "…", "generated_by": "llm" },
      { "id": "var_3", "content": "…", "generated_by": "llm" }
    ]
  },
  "meta": { /* ... */ }
}
```

---

### 5.10 Webhook Receiver

**POST** `/webhooks/delivery`

Receives signed webhook events from third-party providers (Sendgrid, Mailgun, AWS SES).

#### Authentication
- Signature verification via HMAC (provider-specific)
- Header: `X-Signature-Ed25519` (Sendgrid) or `X-Mailgun-Signature` (Mailgun)

#### Example Payload (Sendgrid Format)
```json
{
  "event": "open",
  "email": "john@acme.com",
  "timestamp": 1687234800,
  "sg_message_id": "msg_abc123",
  "sg_event_id": "evt_xyz789",
  "metadata": {
    "outreach_message_id": "msg_abc123"
  }
}
```

#### Event Types Supported
- `sent` — Message delivered
- `open` — Recipient opened
- `click` — Recipient clicked link
- `bounce` — Bounce (hard or soft)
- `spamreport` — Marked as spam
- `unsubscribe` — Unsubscribe request
- `failed` — Delivery failed (permanent error)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "event_id": "evt_abc123",
    "message_id": "msg_abc123",
    "processed": true
  },
  "meta": { /* ... */ }
}
```

#### Error Cases
- `400` — Invalid webhook format
- `401` — Signature verification failed
- `404` — Message not found (optional: queue for retry)

---

### 5.11 Get Delivery Analytics

**GET** `/outreach/analytics`

Retrieve aggregate analytics for dashboard.

#### Query Parameters
```
?campaign_id=camp_abc123     (filter by campaign, optional)
?days=7                      (default 7, max 90)
?group_by=day|hour           (time granularity)
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "period": "last_7_days",
    "summary": {
      "total_sent": 500,
      "success_rate": 0.92,
      "open_rate": 0.38,
      "click_rate": 0.08,
      "bounce_rate": 0.08
    },
    "timeseries": [
      {
        "timestamp": "2026-06-20",
        "sent": 100,
        "opened": 38,
        "clicked": 8,
        "bounced": 8
      },
      {
        "timestamp": "2026-06-19",
        "sent": 90,
        "opened": 34,
        "clicked": 7,
        "bounced": 7
      }
    ],
    "variant_comparison": {
      "control": { "open_rate": 0.35 },
      "treatment": { "open_rate": 0.42 }
    }
  },
  "meta": { /* ... */ }
}
```

---

### 5.12 Export Audit Log

**GET** `/audit/logs/export`

Export audit events as CSV (admin only).

#### Query Parameters
```
?start_date=2026-06-01       (ISO 8601)
?end_date=2026-06-30
?event_type=send,campaign_create  (comma-separated)
?actor_id=user_abc123        (optional)
?format=csv                  (default csv, also supports json)
```

#### Response
- `200 OK` with CSV attachment
- Headers: `Content-Disposition: attachment; filename="audit_2026-06.csv"`

---

## 6. Idempotency & Deduplication

All write endpoints (`/send`, `/batch`) support idempotency via `X-Idempotency-Key` header.

```
POST /outreach/send
X-Idempotency-Key: req_abc123
```

**Behavior:**
1. First request → execute, store key + response
2. Retry with same key → return cached response (do not re-execute)
3. Key expires after 24 hours

**Implementation:**
```
Table: idempotency_keys
├── key (uuid, primary)
├── resource_id (message_id or campaign_id)
├── response_json (full response body)
└── created_at (timestamp)
```

---

## 7. Rate Limiting Strategy

### Tier 1: User (Default)
- 100 requests/minute
- 1000 requests/hour
- 10k requests/day

### Tier 2: Service Account (Elevated)
- 500 requests/minute
- 5000 requests/hour
- 100k requests/day

### Tier 3: Planning Engine (Elevated, Special)
- 1000 requests/minute
- 10k requests/hour
- 1M requests/day

**Headers on Each Response:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1687234800
```

**429 Response:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again after 60 seconds.",
    "retry_after": 60
  },
  "meta": { /* ... */ }
}
```

---

## 8. Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "field": "email",
      "value": "invalid"
    }
  },
  "meta": {
    "request_id": "req_abc123"
  }
}
```

### Common Validation Errors
- `INVALID_EMAIL` — Email format invalid
- `EMAIL_ALREADY_SENT_TODAY` — Limit to 1 message per lead per day
- `TEMPLATE_NOT_FOUND` — Template ID doesn't exist
- `LEAD_NOT_FOUND` — Lead ID doesn't exist
- `MISSING_PERSONALIZATION_TOKENS` — Template has tokens not in lead data
- `INVALID_CSV_FORMAT` — CSV missing required columns
- `CSV_TOO_LARGE` — More than 100k rows

---

## 9. Versioning & Compatibility

- **Current Version:** `v1` (in URL path: `/v1/outreach/*`)
- **Backward Compatibility:** Maintained for 6 months after new version released
- **Deprecation Notice:** Sent 3 months before sunset
- **Header:** `API-Version: 1.0.0`

---

## 10. WebSocket Support (Optional, Future)

For real-time status updates (instead of polling):

```
WS wss://api.castironforge.com/v1/ws?token=...

Subscribe to message status:
{ "type": "subscribe", "channel": "message:{message_id}" }

Receive updates:
{ "type": "status_update", "message_id": "msg_abc123", "status": "opened", "timestamp": "…" }
```

---

## 11. Implementation Checklist

### Database Layer
- [ ] Create `outreach_messages` table
- [ ] Create `outreach_leads` table
- [ ] Create `outreach_campaigns` table
- [ ] Create `outreach_delivery_events` table
- [ ] Create `outreach_audit_log` table
- [ ] Create `idempotency_keys` table
- [ ] Add indexes on foreign keys and status columns
- [ ] Add date-based partitioning for audit log (optional)

### API Layer
- [ ] POST `/outreach/send` fully functional
- [ ] POST `/outreach/batch` fully functional
- [ ] POST `/outreach/preview` fully functional
- [ ] GET `/outreach/{message_id}/status` fully functional
- [ ] GET `/outreach/campaigns/{campaign_id}` fully functional
- [ ] GET `/outreach/campaigns` (list) fully functional
- [ ] POST `/outreach/campaigns/{campaign_id}/cancel` fully functional
- [ ] Template CRUD endpoints (all 5)
- [ ] POST `/outreach/templates/{template_id}/variants/generate` fully functional
- [ ] POST `/webhooks/delivery` fully functional
- [ ] GET `/outreach/analytics` fully functional
- [ ] GET `/audit/logs/export` (admin only) fully functional

### Middleware
- [ ] Authentication (Bearer token validation)
- [ ] Authorization (scope checking)
- [ ] Rate limiting (per-tier)
- [ ] Request validation (JSON schema)
- [ ] Error handling (standard envelope)
- [ ] Logging & tracing (request_id propagation)
- [ ] Idempotency (key store + cache)

### Testing
- [ ] Unit tests for all services (80%+ coverage)
- [ ] Integration tests for all endpoints
- [ ] E2E tests for critical workflows
- [ ] Load test (1000 req/sec target)
- [ ] Webhook signature verification tests
- [ ] Idempotency tests (duplicate request handling)

### Documentation
- [ ] OpenAPI/Swagger spec (interactive UI at `/docs`)
- [ ] Backend integration guide
- [ ] Frontend integration guide
- [ ] Webhook setup guide (per provider)
- [ ] Error reference guide
- [ ] Rate limit tier documentation

---

## 12. Example Workflows

### Workflow 1: Interactive Send (Page-Agent)
```
1. User clicks "Send to Client" in chat UI
2. Frontend calls POST /outreach/send with engine="page-agent"
3. Backend creates outreach_message with status="pending"
4. Page-Agent executes in browser (abstraction layer)
5. User sees confirmation in UI
6. Backend receives webhook (delivery event)
7. Status updated to "sent" or "opened"
8. Frontend polls GET /outreach/{message_id}/status
9. Dashboard shows real-time delivery status
```

### Workflow 2: Batch Campaign (Backend-Batch)
```
1. Planning Engine calls POST /outreach/batch with 100 leads
2. Backend creates campaign with status="scheduled"
3. Scheduled time arrives, batch job starts
4. For each lead:
   - Select variant (A/B test logic)
   - Render template with personalization tokens
   - Send via email provider
   - Create outreach_message
5. Provider fires webhook events (sent, opened, clicked)
6. Delivery events stored in DB
7. Metrics aggregated (daily job)
8. Planning Engine polls GET /outreach/campaigns/{id}/metrics
9. Planning Engine recommends follow-ups based on engagement
```

### Workflow 3: Template Preview
```
1. User selects template in UI
2. Frontend calls POST /outreach/preview
3. Backend renders template with lead data
4. Frontend displays rendered preview
5. User confirms and clicks "Send"
6. Proceeds to Workflow 1
```

---

## 13. OpenAPI Schema (YAML)

See `openapi.yaml` in same directory for full OpenAPI 3.1.0 specification.

To generate SDK from spec:
```bash
openapi-generator-cli generate -i openapi.yaml -g typescript -o sdk/
```

---

## 14. Migration from Phase-4

**No breaking changes.** Phase-4 systems continue to work. New systems use this API.

**Integration points:**
- Existing chat message store remains unchanged
- Outreach data stored in separate tables (new)
- Planning Engine gains access to outreach metrics via new API
- Frontend abstraction layer allows Page-Agent to coexist with other automation engines

---

