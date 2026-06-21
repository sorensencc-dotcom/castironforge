-- Migration: 001_create_outreach_core_tables.sql
-- Description: Create core outreach tables (messages, leads, campaigns)
-- Created: 2026-06-20
-- Target: PostgreSQL 12+

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE outreach_engine AS ENUM ('page-agent', 'backend-batch');
CREATE TYPE message_status AS ENUM ('pending', 'sent', 'bounced', 'failed', 'opened', 'clicked');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'running', 'completed', 'paused', 'cancelled', 'failed');
CREATE TYPE template_tone AS ENUM ('formal', 'casual', 'sales', 'follow-up');
CREATE TYPE delivery_event_type AS ENUM ('sent', 'bounced', 'failed', 'opened', 'clicked', 'spamreport', 'unsubscribe');
CREATE TYPE audit_event_type AS ENUM ('send', 'campaign_create', 'campaign_cancel', 'template_create', 'template_update', 'template_delete', 'variant_generate', 'lead_import', 'message_opened', 'message_clicked');
CREATE TYPE user_role AS ENUM ('admin', 'user', 'service');

-- ============================================================================
-- LEADS TABLE
-- ============================================================================

CREATE TABLE outreach_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  title VARCHAR(255),
  industry VARCHAR(255),
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE outreach_leads IS 'Individual leads/contacts for outreach campaigns';
COMMENT ON COLUMN outreach_leads.id IS 'UUID primary key';
COMMENT ON COLUMN outreach_leads.email IS 'Unique email address';
COMMENT ON COLUMN outreach_leads.custom_fields IS 'JSONB for user-defined fields (region, company_size, etc.)';

CREATE INDEX idx_leads_email ON outreach_leads(email);
CREATE INDEX idx_leads_created_at ON outreach_leads(created_at DESC);
CREATE INDEX idx_leads_company ON outreach_leads(company);

-- ============================================================================
-- TEMPLATES TABLE
-- ============================================================================

CREATE TABLE outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  base_content TEXT NOT NULL,
  tone template_tone NOT NULL DEFAULT 'casual'::template_tone,
  personalization_tokens TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  a_b_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  a_b_control_variant_id UUID,
  a_b_treatment_variant_id UUID,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE outreach_templates IS 'Email templates for outreach campaigns';
COMMENT ON COLUMN outreach_templates.base_content IS 'Template content with {{token}} placeholders';
COMMENT ON COLUMN outreach_templates.personalization_tokens IS 'Array of tokens like {{lead.name}}, {{custom.product}}';
COMMENT ON COLUMN outreach_templates.a_b_enabled IS 'Whether A/B testing is enabled for this template';

CREATE INDEX idx_templates_created_by ON outreach_templates(created_by);
CREATE INDEX idx_templates_created_at ON outreach_templates(created_at DESC);

-- ============================================================================
-- TEMPLATE VARIANTS TABLE
-- ============================================================================

CREATE TABLE outreach_template_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES outreach_templates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tone template_tone,
  generated_by VARCHAR(50) NOT NULL DEFAULT 'manual',
  a_b_bucket VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_template_variants_template_id FOREIGN KEY (template_id) REFERENCES outreach_templates(id)
);

COMMENT ON TABLE outreach_template_variants IS 'Variants of templates (LLM-generated or manual)';
COMMENT ON COLUMN outreach_template_variants.generated_by IS '''llm'' or ''manual''';
COMMENT ON COLUMN outreach_template_variants.a_b_bucket IS '''control'' or ''treatment''';

CREATE INDEX idx_template_variants_template_id ON outreach_template_variants(template_id);
CREATE INDEX idx_template_variants_created_at ON outreach_template_variants(created_at DESC);

-- ============================================================================
-- CAMPAIGNS TABLE
-- ============================================================================

CREATE TABLE outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_id UUID NOT NULL REFERENCES outreach_templates(id),
  lead_count INTEGER NOT NULL DEFAULT 0,
  status campaign_status NOT NULL DEFAULT 'draft'::campaign_status,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE outreach_campaigns IS 'Batch campaign metadata';
COMMENT ON COLUMN outreach_campaigns.lead_count IS 'Total leads in batch';
COMMENT ON COLUMN outreach_campaigns.scheduled_at IS 'When to start sending (NULL = immediate)';

CREATE INDEX idx_campaigns_status ON outreach_campaigns(status);
CREATE INDEX idx_campaigns_created_at ON outreach_campaigns(created_at DESC);
CREATE INDEX idx_campaigns_created_by ON outreach_campaigns(created_by);
CREATE INDEX idx_campaigns_scheduled_at ON outreach_campaigns(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- ============================================================================
-- OUTREACH MESSAGES TABLE
-- ============================================================================

CREATE TABLE outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES outreach_leads(id),
  template_id UUID NOT NULL REFERENCES outreach_templates(id),
  variant_id UUID REFERENCES outreach_template_variants(id),
  campaign_id UUID REFERENCES outreach_campaigns(id),
  engine outreach_engine NOT NULL,
  status message_status NOT NULL DEFAULT 'pending'::message_status,
  content_rendered TEXT NOT NULL,
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE outreach_messages IS 'Individual outreach messages (sent via page-agent or backend)';
COMMENT ON COLUMN outreach_messages.engine IS 'Which engine executed the send';
COMMENT ON COLUMN outreach_messages.content_rendered IS 'Final message content with substitutions';
COMMENT ON COLUMN outreach_messages.metadata IS 'IP address, user agent, initiator_id, etc.';

CREATE INDEX idx_messages_lead_id ON outreach_messages(lead_id);
CREATE INDEX idx_messages_campaign_id ON outreach_messages(campaign_id);
CREATE INDEX idx_messages_status ON outreach_messages(status);
CREATE INDEX idx_messages_created_at ON outreach_messages(created_at DESC);
CREATE INDEX idx_messages_sent_at ON outreach_messages(sent_at DESC) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_messages_engine ON outreach_messages(engine);
-- Index for finding unsent messages
CREATE INDEX idx_messages_pending ON outreach_messages(created_at DESC) WHERE status = 'pending'::message_status;

-- ============================================================================
-- DELIVERY EVENTS TABLE
-- ============================================================================

CREATE TABLE outreach_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES outreach_messages(id) ON DELETE CASCADE,
  event_type delivery_event_type NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  provider VARCHAR(50) NOT NULL,
  raw_event JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE outreach_delivery_events IS 'Webhook events from email providers (Sendgrid, Mailgun, etc.)';
COMMENT ON COLUMN outreach_delivery_events.timestamp IS 'When the event occurred (from provider)';
COMMENT ON COLUMN outreach_delivery_events.provider IS 'sendgrid, mailgun, aws_ses, etc.';
COMMENT ON COLUMN outreach_delivery_events.raw_event IS 'Original provider event payload';

CREATE INDEX idx_delivery_events_message_id ON outreach_delivery_events(message_id);
CREATE INDEX idx_delivery_events_event_type ON outreach_delivery_events(event_type);
CREATE INDEX idx_delivery_events_created_at ON outreach_delivery_events(created_at DESC);
CREATE INDEX idx_delivery_events_provider ON outreach_delivery_events(provider);
-- Composite index for analytics queries
CREATE INDEX idx_delivery_events_analytics ON outreach_delivery_events(message_id, event_type, created_at);

-- ============================================================================
-- AUDIT LOG TABLE (Partitioned by date)
-- ============================================================================

CREATE TABLE outreach_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type audit_event_type NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  actor_email VARCHAR(255),
  actor_role user_role,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  changes JSONB,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (timestamp);

COMMENT ON TABLE outreach_audit_log IS 'Compliance-grade audit trail for all outreach operations (partitioned by date)';
COMMENT ON COLUMN outreach_audit_log.event_type IS 'send, campaign_create, template_update, etc.';
COMMENT ON COLUMN outreach_audit_log.changes IS 'Before/after values for updates';
COMMENT ON COLUMN outreach_audit_log.context IS 'IP address, user_agent, api_version';

-- Create partitions for 2 years (2024-2026)
CREATE TABLE outreach_audit_log_2024_q1 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
CREATE TABLE outreach_audit_log_2024_q2 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');
CREATE TABLE outreach_audit_log_2024_q3 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');
CREATE TABLE outreach_audit_log_2024_q4 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

CREATE TABLE outreach_audit_log_2025_q1 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE outreach_audit_log_2025_q2 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE outreach_audit_log_2025_q3 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE outreach_audit_log_2025_q4 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

CREATE TABLE outreach_audit_log_2026_q1 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE outreach_audit_log_2026_q2 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE outreach_audit_log_2026_q3 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE outreach_audit_log_2026_q4 PARTITION OF outreach_audit_log
  FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

-- Indexes on partitioned table
CREATE INDEX idx_audit_log_event_type ON outreach_audit_log(event_type);
CREATE INDEX idx_audit_log_actor_id ON outreach_audit_log(actor_id);
CREATE INDEX idx_audit_log_resource ON outreach_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_timestamp ON outreach_audit_log(timestamp DESC);

-- ============================================================================
-- IDEMPOTENCY KEYS TABLE
-- ============================================================================

CREATE TABLE idempotency_keys (
  key UUID PRIMARY KEY,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

COMMENT ON TABLE idempotency_keys IS 'Prevents duplicate sends via idempotency key mechanism (24h TTL)';
COMMENT ON COLUMN idempotency_keys.resource_type IS 'message or campaign';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Key expires after 24 hours';

CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- ============================================================================
-- GRANTS (adjust for your roles)
-- ============================================================================

-- Example: Grant permissions to app role
-- GRANT SELECT, INSERT, UPDATE ON outreach_messages TO app_role;
-- GRANT SELECT ON outreach_audit_log TO app_role;
-- GRANT SELECT ON outreach_audit_log_2026_q2 TO app_role;

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================

-- Tables created:
-- 1. outreach_leads (individual contacts)
-- 2. outreach_templates (email templates)
-- 3. outreach_template_variants (template variants)
-- 4. outreach_campaigns (batch campaign metadata)
-- 5. outreach_messages (individual messages)
-- 6. outreach_delivery_events (webhook events)
-- 7. outreach_audit_log (compliance audit trail, partitioned)
-- 8. idempotency_keys (duplicate prevention)
--
-- Enums created:
-- - outreach_engine (page-agent, backend-batch)
-- - message_status (pending, sent, bounced, failed, opened, clicked)
-- - campaign_status (draft, scheduled, running, completed, paused, cancelled, failed)
-- - template_tone (formal, casual, sales, follow-up)
-- - delivery_event_type
-- - audit_event_type
-- - user_role (admin, user, service)
