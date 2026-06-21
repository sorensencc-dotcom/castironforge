-- Migration: 002_create_analytics_tables.sql
-- Description: Create analytics and metrics rollup tables
-- Created: 2026-06-20
-- Target: PostgreSQL 12+
-- Dependencies: 001_create_outreach_core_tables.sql

-- ============================================================================
-- DAILY METRICS ROLLUP TABLE
-- ============================================================================

CREATE TABLE outreach_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_clicked INTEGER NOT NULL DEFAULT 0,
  total_bounced INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  open_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  click_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  bounce_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, campaign_id)
);

COMMENT ON TABLE outreach_daily_metrics IS 'Aggregated daily metrics for campaigns (for dashboard performance)';
COMMENT ON COLUMN outreach_daily_metrics.date IS 'Date of metrics (YYYY-MM-DD)';
COMMENT ON COLUMN outreach_daily_metrics.campaign_id IS 'NULL for global metrics, specific UUID for campaign metrics';
COMMENT ON COLUMN outreach_daily_metrics.success_rate IS 'sent / total (0-1, stored as 4 decimal places)';

CREATE INDEX idx_daily_metrics_date ON outreach_daily_metrics(date DESC);
CREATE INDEX idx_daily_metrics_campaign_id ON outreach_daily_metrics(campaign_id);
CREATE INDEX idx_daily_metrics_campaign_date ON outreach_daily_metrics(campaign_id, date DESC);

-- ============================================================================
-- VARIANT PERFORMANCE TABLE (for A/B testing)
-- ============================================================================

CREATE TABLE outreach_variant_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES outreach_template_variants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES outreach_templates(id),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_clicked INTEGER NOT NULL DEFAULT 0,
  open_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  click_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  ctr NUMERIC(5, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE outreach_variant_performance IS 'A/B test performance tracking per variant';
COMMENT ON COLUMN outreach_variant_performance.ctr IS 'Click-through rate (clicked / sent)';

CREATE INDEX idx_variant_performance_variant_id ON outreach_variant_performance(variant_id);
CREATE INDEX idx_variant_performance_template_id ON outreach_variant_performance(template_id);
CREATE INDEX idx_variant_performance_campaign_id ON outreach_variant_performance(campaign_id);

-- ============================================================================
-- DELIVERY PROVIDER METRICS TABLE
-- ============================================================================

CREATE TABLE outreach_provider_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  events_sent INTEGER NOT NULL DEFAULT 0,
  events_opened INTEGER NOT NULL DEFAULT 0,
  events_clicked INTEGER NOT NULL DEFAULT 0,
  events_bounced INTEGER NOT NULL DEFAULT 0,
  events_failed INTEGER NOT NULL DEFAULT 0,
  avg_delivery_latency_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, date)
);

COMMENT ON TABLE outreach_provider_metrics IS 'Delivery provider health metrics (Sendgrid, Mailgun, AWS SES, etc.)';
COMMENT ON COLUMN outreach_provider_metrics.avg_delivery_latency_ms IS 'Average latency from send to first event';

CREATE INDEX idx_provider_metrics_provider ON outreach_provider_metrics(provider);
CREATE INDEX idx_provider_metrics_date ON outreach_provider_metrics(date DESC);
CREATE INDEX idx_provider_metrics_provider_date ON outreach_provider_metrics(provider, date DESC);

-- ============================================================================
-- CAMPAIGN PERFORMANCE CACHE (denormalized for fast dashboard queries)
-- ============================================================================

CREATE TABLE outreach_campaign_performance_cache (
  campaign_id UUID PRIMARY KEY REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  total_leads INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_clicked INTEGER NOT NULL DEFAULT 0,
  total_bounced INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  open_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  click_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  bounce_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  time_to_open_median_seconds INTEGER,
  time_to_click_median_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE outreach_campaign_performance_cache IS 'Denormalized cache for campaign performance (refreshed after each webhook)';
COMMENT ON COLUMN outreach_campaign_performance_cache.engagement_rate IS '(opened + clicked) / sent';

CREATE INDEX idx_campaign_performance_updated_at ON outreach_campaign_performance_cache(updated_at DESC);

-- ============================================================================
-- MATERIALIZED VIEW: Campaign Summary (for dashboard)
-- ============================================================================

CREATE MATERIALIZED VIEW campaign_summary_view AS
SELECT
  c.id,
  c.name,
  c.status,
  c.template_id,
  t.name AS template_name,
  c.lead_count,
  COALESCE(cpc.total_sent, 0) AS total_sent,
  COALESCE(cpc.total_failed, 0) AS total_failed,
  COALESCE(cpc.total_opened, 0) AS total_opened,
  COALESCE(cpc.total_clicked, 0) AS total_clicked,
  COALESCE(cpc.success_rate, 0) AS success_rate,
  COALESCE(cpc.open_rate, 0) AS open_rate,
  COALESCE(cpc.click_rate, 0) AS click_rate,
  COALESCE(cpc.engagement_rate, 0) AS engagement_rate,
  c.scheduled_at,
  c.started_at,
  c.completed_at,
  c.created_by,
  c.created_at,
  c.updated_at
FROM outreach_campaigns c
LEFT JOIN outreach_templates t ON c.template_id = t.id
LEFT JOIN outreach_campaign_performance_cache cpc ON c.id = cpc.campaign_id;

COMMENT ON MATERIALIZED VIEW campaign_summary_view IS 'Denormalized view for efficient campaign listing on dashboard';

CREATE INDEX idx_campaign_summary_view_status ON campaign_summary_view(status);
CREATE INDEX idx_campaign_summary_view_created_at ON campaign_summary_view(created_at DESC);

-- ============================================================================
-- VIEW: Message Summary (denormalized for fast queries)
-- ============================================================================

CREATE VIEW message_summary_view AS
SELECT
  m.id,
  m.lead_id,
  l.email,
  l.name,
  l.company,
  m.template_id,
  t.name AS template_name,
  m.variant_id,
  tv.a_b_bucket,
  m.campaign_id,
  m.engine,
  m.status,
  m.sent_at,
  m.opened_at,
  m.clicked_at,
  EXTRACT(EPOCH FROM (m.opened_at - m.sent_at))::INTEGER AS time_to_open_seconds,
  EXTRACT(EPOCH FROM (m.clicked_at - m.sent_at))::INTEGER AS time_to_click_seconds,
  m.created_at,
  m.updated_at
FROM outreach_messages m
LEFT JOIN outreach_leads l ON m.lead_id = l.id
LEFT JOIN outreach_templates t ON m.template_id = t.id
LEFT JOIN outreach_template_variants tv ON m.variant_id = tv.id;

COMMENT ON VIEW message_summary_view IS 'Denormalized message view for analytics queries';

-- ============================================================================
-- VIEW: Hourly Event Rate (for monitoring)
-- ============================================================================

CREATE VIEW delivery_event_hourly_rate AS
SELECT
  DATE_TRUNC('hour', created_at)::TIMESTAMP AS hour,
  event_type,
  provider,
  COUNT(*) AS event_count,
  COUNT(DISTINCT message_id) AS unique_message_count
FROM outreach_delivery_events
GROUP BY DATE_TRUNC('hour', created_at), event_type, provider;

COMMENT ON VIEW delivery_event_hourly_rate IS 'Hourly delivery event rates for monitoring';

-- ============================================================================
-- FUNCTION: Refresh campaign performance cache
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_campaign_performance_cache(p_campaign_id UUID)
RETURNS void AS $$
DECLARE
  v_total_sent INTEGER;
  v_total_failed INTEGER;
  v_total_opened INTEGER;
  v_total_clicked INTEGER;
  v_total_bounced INTEGER;
BEGIN
  -- Count messages by status
  SELECT
    COUNT(CASE WHEN status = 'sent' THEN 1 END),
    COUNT(CASE WHEN status = 'failed' THEN 1 END),
    COUNT(CASE WHEN status = 'opened' THEN 1 END),
    COUNT(CASE WHEN status = 'clicked' THEN 1 END),
    COUNT(CASE WHEN status = 'bounced' THEN 1 END)
  INTO v_total_sent, v_total_failed, v_total_opened, v_total_clicked, v_total_bounced
  FROM outreach_messages
  WHERE campaign_id = p_campaign_id;

  -- Upsert cache entry
  INSERT INTO outreach_campaign_performance_cache (
    campaign_id,
    total_sent,
    total_failed,
    total_opened,
    total_clicked,
    total_bounced,
    success_rate,
    open_rate,
    click_rate,
    bounce_rate,
    engagement_rate,
    updated_at
  )
  VALUES (
    p_campaign_id,
    COALESCE(v_total_sent, 0),
    COALESCE(v_total_failed, 0),
    COALESCE(v_total_opened, 0),
    COALESCE(v_total_clicked, 0),
    COALESCE(v_total_bounced, 0),
    CASE WHEN COALESCE(v_total_sent, 0) > 0 THEN v_total_sent::NUMERIC / (v_total_sent + v_total_failed) ELSE 0 END,
    CASE WHEN COALESCE(v_total_sent, 0) > 0 THEN v_total_opened::NUMERIC / v_total_sent ELSE 0 END,
    CASE WHEN COALESCE(v_total_opened, 0) > 0 THEN v_total_clicked::NUMERIC / v_total_opened ELSE 0 END,
    CASE WHEN COALESCE(v_total_sent, 0) > 0 THEN v_total_bounced::NUMERIC / v_total_sent ELSE 0 END,
    CASE WHEN COALESCE(v_total_sent, 0) > 0 THEN (v_total_opened + v_total_clicked)::NUMERIC / v_total_sent ELSE 0 END,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (campaign_id) DO UPDATE SET
    total_sent = EXCLUDED.total_sent,
    total_failed = EXCLUDED.total_failed,
    total_opened = EXCLUDED.total_opened,
    total_clicked = EXCLUDED.total_clicked,
    total_bounced = EXCLUDED.total_bounced,
    success_rate = EXCLUDED.success_rate,
    open_rate = EXCLUDED.open_rate,
    click_rate = EXCLUDED.click_rate,
    bounce_rate = EXCLUDED.bounce_rate,
    engagement_rate = EXCLUDED.engagement_rate,
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_campaign_performance_cache(UUID) IS 'Recalculate and cache campaign performance metrics';

-- ============================================================================
-- FUNCTION: Daily metrics aggregation (scheduled job)
-- ============================================================================

CREATE OR REPLACE FUNCTION aggregate_daily_metrics(p_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
  -- Insert/update daily metrics for each campaign
  INSERT INTO outreach_daily_metrics (
    date, campaign_id, total_sent, total_failed, total_opened, total_clicked, total_bounced,
    success_rate, open_rate, click_rate, bounce_rate
  )
  SELECT
    p_date,
    m.campaign_id,
    COUNT(CASE WHEN m.status = 'sent' THEN 1 END) AS total_sent,
    COUNT(CASE WHEN m.status = 'failed' THEN 1 END) AS total_failed,
    COUNT(CASE WHEN m.status = 'opened' THEN 1 END) AS total_opened,
    COUNT(CASE WHEN m.status = 'clicked' THEN 1 END) AS total_clicked,
    COUNT(CASE WHEN m.status = 'bounced' THEN 1 END) AS total_bounced,
    CASE WHEN COUNT(*) > 0 THEN COUNT(CASE WHEN m.status = 'sent' THEN 1 END)::NUMERIC / COUNT(*) ELSE 0 END,
    CASE WHEN COUNT(CASE WHEN m.status = 'sent' THEN 1 END) > 0 THEN COUNT(CASE WHEN m.status = 'opened' THEN 1 END)::NUMERIC / COUNT(CASE WHEN m.status = 'sent' THEN 1 END) ELSE 0 END,
    CASE WHEN COUNT(CASE WHEN m.status = 'opened' THEN 1 END) > 0 THEN COUNT(CASE WHEN m.status = 'clicked' THEN 1 END)::NUMERIC / COUNT(CASE WHEN m.status = 'opened' THEN 1 END) ELSE 0 END,
    CASE WHEN COUNT(CASE WHEN m.status = 'sent' THEN 1 END) > 0 THEN COUNT(CASE WHEN m.status = 'bounced' THEN 1 END)::NUMERIC / COUNT(CASE WHEN m.status = 'sent' THEN 1 END) ELSE 0 END
  FROM outreach_messages m
  WHERE DATE(m.created_at) = p_date
  GROUP BY m.campaign_id
  ON CONFLICT (date, campaign_id) DO UPDATE SET
    total_sent = EXCLUDED.total_sent,
    total_failed = EXCLUDED.total_failed,
    total_opened = EXCLUDED.total_opened,
    total_clicked = EXCLUDED.total_clicked,
    total_bounced = EXCLUDED.total_bounced,
    success_rate = EXCLUDED.success_rate,
    open_rate = EXCLUDED.open_rate,
    click_rate = EXCLUDED.click_rate,
    bounce_rate = EXCLUDED.bounce_rate,
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_daily_metrics(DATE) IS 'Aggregate metrics for a given date (run nightly)';

-- ============================================================================
-- TRIGGER: Auto-refresh campaign cache on message status change
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_refresh_campaign_performance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL THEN
    PERFORM refresh_campaign_performance_cache(NEW.campaign_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_campaign_performance
AFTER INSERT OR UPDATE ON outreach_messages
FOR EACH ROW
EXECUTE FUNCTION trigger_refresh_campaign_performance();

COMMENT ON TRIGGER trg_refresh_campaign_performance ON outreach_messages IS 'Automatically refresh campaign performance cache when messages change';
