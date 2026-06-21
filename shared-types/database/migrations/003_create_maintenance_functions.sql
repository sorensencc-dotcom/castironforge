-- Migration: 003_create_maintenance_functions.sql
-- Description: Create maintenance functions for data cleanup and archiving
-- Created: 2026-06-20
-- Target: PostgreSQL 12+
-- Dependencies: 001_create_outreach_core_tables.sql

-- ============================================================================
-- FUNCTION: Clean expired idempotency keys
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_keys
  WHERE expires_at < CURRENT_TIMESTAMP;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys() IS 'Delete idempotency keys older than 24 hours (run hourly)';

-- ============================================================================
-- FUNCTION: Archive old audit log entries
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_old_audit_logs(p_retention_days INTEGER DEFAULT 730)
RETURNS TABLE(archived_count BIGINT, archive_location TEXT) AS $$
DECLARE
  v_cutoff_date TIMESTAMP WITH TIME ZONE;
  v_archived_count BIGINT;
BEGIN
  v_cutoff_date := CURRENT_TIMESTAMP - (p_retention_days || ' days')::INTERVAL;

  -- Count records to archive
  SELECT COUNT(*)
  INTO v_archived_count
  FROM outreach_audit_log
  WHERE timestamp < v_cutoff_date;

  -- Note: In production, you would:
  -- 1. Export to S3/cold storage
  -- 2. Delete from hot storage
  -- For now, we just log the intent

  RETURN QUERY SELECT
    v_archived_count,
    'Archive audit_log records before ' || v_cutoff_date::TEXT || ' to cold storage'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_old_audit_logs(INTEGER) IS 'Identify audit log records eligible for archival (default 2 years)';

-- ============================================================================
-- FUNCTION: Clean stale messages (orphaned records)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_orphaned_messages()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete messages with failed leads (should not happen, but defensive)
  DELETE FROM outreach_messages
  WHERE lead_id NOT IN (SELECT id FROM outreach_leads)
  OR template_id NOT IN (SELECT id FROM outreach_templates);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_orphaned_messages() IS 'Remove orphaned messages with missing leads/templates (defensive)';

-- ============================================================================
-- FUNCTION: Vacuum analyze outreach tables
-- ============================================================================

CREATE OR REPLACE FUNCTION maintenance_vacuum_outreach_tables()
RETURNS void AS $$
BEGIN
  ANALYZE outreach_messages;
  ANALYZE outreach_delivery_events;
  ANALYZE outreach_campaigns;
  ANALYZE outreach_audit_log;
  ANALYZE idempotency_keys;
  VACUUM ANALYZE outreach_daily_metrics;
  VACUUM ANALYZE outreach_campaign_performance_cache;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION maintenance_vacuum_outreach_tables() IS 'Run ANALYZE on outreach tables for query optimization (run weekly)';

-- ============================================================================
-- FUNCTION: Generate health check report
-- ============================================================================

CREATE OR REPLACE FUNCTION outreach_health_check()
RETURNS TABLE(
  check_name VARCHAR,
  status VARCHAR,
  detail TEXT,
  severity VARCHAR
) AS $$
BEGIN
  -- Check 1: Pending messages older than 1 day
  RETURN QUERY
  SELECT
    'Stale pending messages'::VARCHAR,
    CASE WHEN COUNT(*) > 100 THEN 'WARNING' ELSE 'OK' END,
    COUNT(*)::TEXT || ' messages pending > 1 day',
    CASE WHEN COUNT(*) > 100 THEN 'HIGH' ELSE 'LOW' END
  FROM outreach_messages
  WHERE status = 'pending'::message_status
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 day';

  -- Check 2: Failed messages without error details
  RETURN QUERY
  SELECT
    'Failed messages missing error details'::VARCHAR,
    CASE WHEN COUNT(*) > 10 THEN 'WARNING' ELSE 'OK' END,
    COUNT(*)::TEXT || ' failed messages without error text',
    CASE WHEN COUNT(*) > 10 THEN 'MEDIUM' ELSE 'LOW' END
  FROM outreach_messages
  WHERE status = 'failed'::message_status
  AND error IS NULL;

  -- Check 3: Campaigns stuck in running state
  RETURN QUERY
  SELECT
    'Campaigns stuck in running state'::VARCHAR,
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END,
    COUNT(*)::TEXT || ' campaigns still running',
    CASE WHEN COUNT(*) > 0 THEN 'HIGH' ELSE 'LOW' END
  FROM outreach_campaigns
  WHERE status = 'running'::campaign_status
  AND started_at < CURRENT_TIMESTAMP - INTERVAL '24 hours';

  -- Check 4: Unprocessed delivery events
  RETURN QUERY
  SELECT
    'Unprocessed delivery events backlog'::VARCHAR,
    CASE WHEN COUNT(*) > 1000 THEN 'WARNING' ELSE 'OK' END,
    COUNT(*)::TEXT || ' delivery events created in last hour',
    CASE WHEN COUNT(*) > 1000 THEN 'MEDIUM' ELSE 'LOW' END
  FROM outreach_delivery_events
  WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour';

  -- Check 5: Database size
  RETURN QUERY
  SELECT
    'Audit log table size'::VARCHAR,
    'INFO'::VARCHAR,
    (pg_total_relation_size('outreach_audit_log') / 1024 / 1024)::TEXT || ' MB',
    'INFO'::VARCHAR;

  -- Check 6: Idempotency key table growth
  RETURN QUERY
  SELECT
    'Idempotency keys (should be cleaned hourly)'::VARCHAR,
    CASE WHEN COUNT(*) > 10000 THEN 'WARNING' ELSE 'OK' END,
    COUNT(*)::TEXT || ' keys stored',
    CASE WHEN COUNT(*) > 10000 THEN 'MEDIUM' ELSE 'LOW' END
  FROM idempotency_keys;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION outreach_health_check() IS 'Health check report for outreach system (run daily)';

-- ============================================================================
-- FUNCTION: Generate daily metrics report
-- ============================================================================

CREATE OR REPLACE FUNCTION get_daily_report(p_days INTEGER DEFAULT 7)
RETURNS TABLE(
  report_date DATE,
  total_sent BIGINT,
  total_failed BIGINT,
  total_opened BIGINT,
  total_clicked BIGINT,
  success_rate NUMERIC,
  open_rate NUMERIC,
  click_rate NUMERIC,
  avg_time_to_open_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(m.sent_at)::DATE,
    COUNT(*)::BIGINT,
    COUNT(CASE WHEN m.status = 'failed' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN m.status = 'opened' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN m.status = 'clicked' THEN 1 END)::BIGINT,
    ROUND(COUNT(CASE WHEN m.status != 'failed' THEN 1 END)::NUMERIC / COUNT(*) * 100, 2),
    ROUND(COUNT(CASE WHEN m.status = 'opened' THEN 1 END)::NUMERIC / COUNT(*) * 100, 2),
    ROUND(COUNT(CASE WHEN m.status = 'clicked' THEN 1 END)::NUMERIC / COUNT(CASE WHEN m.status = 'opened' THEN 1 END) * 100, 2),
    ROUND(AVG(EXTRACT(EPOCH FROM (m.opened_at - m.sent_at)))::NUMERIC / 3600, 2)
  FROM outreach_messages m
  WHERE m.sent_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY DATE(m.sent_at)
  ORDER BY DATE(m.sent_at) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_daily_report(INTEGER) IS 'Daily metrics report (default last 7 days)';

-- ============================================================================
-- FUNCTION: Get campaign performance by variant
-- ============================================================================

CREATE OR REPLACE FUNCTION get_variant_performance(p_campaign_id UUID)
RETURNS TABLE(
  variant_id UUID,
  variant_bucket VARCHAR,
  message_count BIGINT,
  open_count BIGINT,
  click_count BIGINT,
  open_rate NUMERIC,
  click_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tv.id,
    tv.a_b_bucket,
    COUNT(m.id)::BIGINT,
    COUNT(CASE WHEN m.status = 'opened' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN m.status = 'clicked' THEN 1 END)::BIGINT,
    ROUND(COUNT(CASE WHEN m.status = 'opened' THEN 1 END)::NUMERIC / COUNT(m.id) * 100, 2),
    ROUND(COUNT(CASE WHEN m.status = 'clicked' THEN 1 END)::NUMERIC / COUNT(m.id) * 100, 2)
  FROM outreach_template_variants tv
  LEFT JOIN outreach_messages m ON tv.id = m.variant_id AND m.campaign_id = p_campaign_id
  WHERE tv.template_id IN (
    SELECT template_id FROM outreach_campaigns WHERE id = p_campaign_id
  )
  GROUP BY tv.id, tv.a_b_bucket
  ORDER BY COUNT(m.id) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_variant_performance(UUID) IS 'Compare performance of variants in a campaign (A/B testing)';

-- ============================================================================
-- MAINTENANCE JOBS (to be scheduled via cron or Airflow)
-- ============================================================================

-- Run hourly:
--   SELECT cleanup_expired_idempotency_keys();
--
-- Run daily:
--   SELECT maintenance_vacuum_outreach_tables();
--   SELECT aggregate_daily_metrics(CURRENT_DATE - INTERVAL '1 day');
--   SELECT * FROM outreach_health_check();
--   SELECT * FROM get_daily_report(7);
--
-- Run weekly:
--   REINDEX TABLE outreach_messages;
--   REINDEX TABLE outreach_delivery_events;
--
-- Run monthly:
--   SELECT archive_old_audit_logs(730);  -- Archive > 2 years

-- ============================================================================
-- GRANTS (adjust for your roles)
-- ============================================================================

-- GRANT EXECUTE ON FUNCTION cleanup_expired_idempotency_keys() TO maintenance_role;
-- GRANT EXECUTE ON FUNCTION maintenance_vacuum_outreach_tables() TO maintenance_role;
-- GRANT EXECUTE ON FUNCTION outreach_health_check() TO monitoring_role;
-- GRANT EXECUTE ON FUNCTION get_daily_report(INTEGER) TO analytics_role;
