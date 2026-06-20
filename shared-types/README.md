# @castironforge/shared-types

Shared TypeScript type definitions for Phase-5 outreach automation system.

Used by:
- `chat-frontend` — React app with Page-Agent abstraction layer
- `chat-agent` — Express backend API
- `Planning Engine` — Orchestration and automation

## Installation

```bash
npm install @castironforge/shared-types
```

Or from monorepo:
```bash
npm install ./shared-types
```

## Usage

### Frontend
```typescript
import { SendMessageRequest, SendMessageResponse } from '@castironforge/shared-types'

const request: SendMessageRequest = {
  lead: {
    email: 'john@acme.com',
    name: 'John Doe',
    company: 'ACME Corp'
  },
  template_id: 'tpl_abc123',
  engine: 'page-agent'
}

// Type-safe API call
const response: SendMessageResponse = await fetch('/api/v1/outreach/send', {
  method: 'POST',
  body: JSON.stringify(request)
}).then(r => r.json())
```

### Backend
```typescript
import { OutreachMessage, Lead, Template, ApiResponse } from '@castironforge/shared-types'

async function sendMessage(lead: Lead, template: Template): Promise<ApiResponse<OutreachMessage>> {
  // Type-safe implementation
  const message: OutreachMessage = {
    id: 'msg_123',
    lead_id: lead.id,
    template_id: template.id,
    engine: 'backend-batch',
    status: 'sent',
    content_rendered: template.base_content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {}
  }
  
  return {
    success: true,
    data: message,
    meta: {
      request_id: 'req_123',
      timestamp: new Date().toISOString()
    }
  }
}
```

### Planning Engine
```typescript
import { PlanningEngineOutreachRequest, AnalyticsResponse } from '@castironforge/shared-types'

const outreachRequest: PlanningEngineOutreachRequest = {
  campaign_name: 'Q3 Follow-up',
  template_id: 'tpl_abc123',
  leads: [
    {
      id: 'lead_1',
      email: 'alice@acme.com',
      name: 'Alice',
      custom_fields: {}
    }
  ],
  scheduled_at: '2026-06-21T09:00:00Z'
}

// Submit batch to outreach API
const response = await submitOutreachBatch(outreachRequest)
```

## Core Models

### Domain Models
- `Lead` — User record with custom fields
- `Template` — Email template with variants
- `Variant` — Template variant (LLM-generated or manual)
- `OutreachMessage` — Individual message record
- `Campaign` — Batch campaign metadata
- `DeliveryEvent` — Webhook event from provider
- `AuditLog` — Compliance audit trail

### API Models
- `SendMessageRequest` / `SendMessageResponse` — Single send
- `BatchSendRequest` / `BatchSendResponse` — Bulk campaign
- `PreviewTemplateRequest` / `PreviewTemplateResponse` — Template preview
- `MessageStatusResponse` — Status polling
- `CampaignResponse` / `CampaignListResponse` — Campaign management
- `AnalyticsResponse` — Metrics dashboard
- `AuditLogListResponse` — Audit trail

### Webhook Models
- `DeliveryWebhookEvent` — Delivery events
- `SendgridWebhookPayload` — Sendgrid format
- `MailgunWebhookPayload` — Mailgun format

## Type Guards & Utilities

```typescript
import { isOutreachMessage, isApiError, isSuccess } from '@castironforge/shared-types'

// Check if object is a message
if (isOutreachMessage(obj)) {
  console.log(obj.status) // Type-safe
}

// Check if API response succeeded
const response = await fetch('/api/outreach/send').then(r => r.json())
if (isSuccess(response)) {
  console.log(response.data) // Type-safe
} else if (isApiError(response)) {
  console.error(response.error.message)
}
```

## Enums & Unions

```typescript
type MessageStatus = 'pending' | 'sent' | 'bounced' | 'failed' | 'opened' | 'clicked'
type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled' | 'failed'
type EngineType = 'page-agent' | 'backend-batch'
type Tone = 'formal' | 'casual' | 'sales' | 'follow-up'
```

## Rate Limiting

```typescript
import { RateLimitInfo } from '@castironforge/shared-types'

// Extract from response headers
const limit: RateLimitInfo = {
  limit: parseInt(response.headers['x-ratelimit-limit']),
  remaining: parseInt(response.headers['x-ratelimit-remaining']),
  reset: parseInt(response.headers['x-ratelimit-reset'])
}
```

## Error Handling

```typescript
import { ApiError, ErrorCode } from '@castironforge/shared-types'

const error: ApiError = {
  code: 'VALIDATION_ERROR',
  message: 'Email address is invalid',
  details: {
    field: 'lead.email',
    value: 'not-an-email'
  }
}
```

## Development

### Build
```bash
npm run build
```

### Watch
```bash
npm run watch
```

### Clean
```bash
npm run clean
```

### Lint
```bash
npm run lint
```

### Test
```bash
npm test
```

## Compatibility

- **Node:** 18+
- **TypeScript:** 5.0+
- **ES Target:** ES2020

## Monorepo Integration

Add to root `package.json` workspaces:
```json
{
  "workspaces": [
    "shared-types",
    "chat-frontend",
    "chat-agent"
  ]
}
```

Then reference in other packages:
```json
{
  "dependencies": {
    "@castironforge/shared-types": "workspace:*"
  }
}
```

## Documentation

See `/UNIFIED_OUTREACH_API_SPEC.md` for full API specification.

All types align with the OpenAPI schema defined in that document.

## License

MIT
