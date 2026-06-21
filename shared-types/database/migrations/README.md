# Database Migrations for Phase-5 Outreach Automation

SQL migrations for the unified outreach system. Includes core tables, analytics, and maintenance functions.

## Migration Files

### 001_create_outreach_core_tables.sql
**Creates 8 tables + 7 enums**

- **outreach_leads** — Individual contacts
- **outreach_templates** — Email templates with variants
- **outreach_template_variants** — Template variants (LLM-generated or manual)
- **outreach_campaigns** — Batch campaign metadata
- **outreach_messages** — Individual messages sent
- **outreach_delivery_events** — Webhook events from providers
- **outreach_audit_log** — Compliance audit trail (partitioned by date)
- **idempotency_keys** — Duplicate prevention (24h TTL)

**Enums:**
- `outreach_engine` — page-agent, backend-batch
- `message_status` — pending, sent, bounced, failed, opened, clicked
- `campaign_status` — draft, scheduled, running, completed, paused, cancelled, failed
- `template_tone` — formal, casual, sales, follow-up
- `delivery_event_type` — sent, bounced, failed, opened, clicked, spamreport, unsubscribe
- `audit_event_type` — send, campaign_create, campaign_cancel, template_*, variant_*, lead_import, message_*
- `user_role` — admin, user, service

**Indexes:** 20+ indexes for query performance
**Partitioning:** Audit log partitioned quarterly (2024-2027)

---

### 002_create_analytics_tables.sql
**Creates analytics and reporting infrastructure**

- **outreach_daily_metrics** — Daily rollup per campaign
- **outreach_variant_performance** — A/B test metrics per variant
- **outreach_provider_metrics** — Delivery provider health
- **outreach_campaign_performance_cache** — Denormalized cache for fast queries

**Materialized Views:**
- `campaign_summary_view` — Campaign list with metrics

**Views:**
- `message_summary_view` — Messages with lead/template details
- `delivery_event_hourly_rate` — Hourly event volumes

**Functions:**
- `refresh_campaign_performance_cache(uuid)` — Recalculate metrics
- `aggregate_daily_metrics(date)` — Nightly aggregation job
- **Trigger:** Auto-refresh cache on message updates

---

### 003_create_maintenance_functions.sql
**Creates maintenance and health check functions**

- `cleanup_expired_idempotency_keys()` — Remove expired keys (run hourly)
- `archive_old_audit_logs(int)` — Identify archivable records (run monthly)
- `cleanup_orphaned_messages()` — Remove orphaned records (defensive)
- `maintenance_vacuum_outreach_tables()` — Optimize query performance (run weekly)
- `outreach_health_check()` — System health report (run daily)
- `get_daily_report(int)` — Daily metrics summary (run daily)
- `get_variant_performance(uuid)` — A/B test analysis per campaign

---

## Running Migrations

### Using psql

```bash
# Connect to database
psql -U postgres -h localhost -d castironforge

# Run migrations in order
\i shared-types/database/migrations/001_create_outreach_core_tables.sql
\i shared-types/database/migrations/002_create_analytics_tables.sql
\i shared-types/database/migrations/003_create_maintenance_functions.sql
```

### Using a migration tool (e.g., Flyway, Liquibase)

```bash
# Flyway
flyway migrate -locations=filesystem:shared-types/database/migrations -url=jdbc:postgresql://localhost/castironforge -user=postgres -password=...

# Liquibase
liquibase update
```

### Using Node.js (if using pg library)

```typescript
import fs from 'fs'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

async function runMigrations() {
  const migrations = [
    '001_create_outreach_core_tables.sql',
    '002_create_analytics_tables.sql',
    '003_create_maintenance_functions.sql'
  ]

  for (const migration of migrations) {
    const sql = fs.readFileSync(`shared-types/database/migrations/${migration}`, 'utf-8')
    await pool.query(sql)
    console.log(`✓ ${migration}`)
  }

  await pool.end()
}

runMigrations().catch(console.error)
```

---

## Database Schema Overview

### Data Model

```
┌──────────────────────────────────────────────────────────┐
│ outreach_campaigns                                       │
├──────────────────────────────────────────────────────────┤
│ id (PK) | name | template_id (FK) | status | scheduled_at│
│ lead_count | created_by | created_at                    │
└──────────────────────────────────────────────────────────┘
                         │
                         ├─→ outreach_templates (1:N)
                         │   ├─→ outreach_template_variants
                         │   │
                         └─→ outreach_messages (1:N)
                             ├─→ outreach_leads (1:1)
                             ├─→ outreach_delivery_events (1:N)
                             │
                             └─→ outreach_campaign_performance_cache
                                 outreach_daily_metrics
```

### Key Relationships

- **Campaign** → **Messages** (1:N) — A campaign sends to many leads
- **Message** → **Lead** (N:1) — Each message targets one lead
- **Message** → **Delivery Events** (1:N) — One message may have multiple events (sent, opened, clicked)
- **Campaign** → **Template** (N:1) — Campaign uses template
- **Template** → **Variants** (1:N) — Template has multiple variants (A/B test)
- **Message** → **Variant** (N:1) — Each message uses one variant

---

## Scheduled Maintenance Jobs

### Hourly (00:00)
```sql
SELECT cleanup_expired_idempotency_keys();
```
Removes idempotency keys older than 24 hours.

### Daily (02:00)
```sql
SELECT aggregate_daily_metrics(CURRENT_DATE - INTERVAL '1 day');
SELECT * FROM outreach_health_check();
SELECT * FROM get_daily_report(7);
```
- Aggregate yesterday's metrics
- Generate health report
- Get weekly summary

### Weekly (Sunday 03:00)
```sql
SELECT maintenance_vacuum_outreach_tables();
REINDEX TABLE outreach_messages;
REINDEX TABLE outreach_delivery_events;
```
- Optimize tables and indexes

### Monthly (1st of month, 04:00)
```sql
SELECT archive_old_audit_logs(730);  -- Archive > 2 years
```
- Identify audit logs eligible for archival
- Export to cold storage (S3, etc.)

---

## Queries for Common Operations

### Get campaign statistics
```sql
SELECT 
  c.id,
  c.name,
  COUNT(m.id) AS total_messages,
  COUNT(CASE WHEN m.status = 'sent' THEN 1 END) AS sent_count,
  COUNT(CASE WHEN m.status = 'opened' THEN 1 END) AS opened_count,
  COUNT(CASE WHEN m.status = 'clicked' THEN 1 END) AS clicked_count
FROM outreach_campaigns c
LEFT JOIN outreach_messages m ON c.id = m.campaign_id
WHERE c.id = $1
GROUP BY c.id, c.name;
```

### Get recent delivery events
```sql
SELECT 
  de.event_type,
  COUNT(*) AS count,
  m.email,
  de.timestamp
FROM outreach_delivery_events de
JOIN outreach_messages m ON de.message_id = m.id
WHERE de.created_at > NOW() - INTERVAL '1 hour'
GROUP BY de.event_type, m.email, de.timestamp
ORDER BY de.timestamp DESC
LIMIT 100;
```

### Compare variant performance
```sql
SELECT * FROM get_variant_performance($campaign_id);
```

### Health check
```sql
SELECT * FROM outreach_health_check();
```

### Daily metrics
```sql
SELECT * FROM get_daily_report(7);
```

---

## Performance Tuning

### Index Strategy
- **Lead lookups:** Indexed by email, company
- **Message queries:** Indexed by status, created_at, campaign_id
- **Event queries:** Indexed by message_id, event_type, timestamp
- **Composite indexes:** For common filter + sort combinations

### Partitioning
- **Audit log:** Quarterly partitions (2024-2027) for easier archival
- **Partitions automatically used for date range queries**

### Query Optimization
- Use materialized views for heavy queries
- Campaign performance cache refreshed on every message update
- Daily metrics pre-aggregated (avoid SELECT COUNT on large tables)

### Vacuum Strategy
- Weekly `VACUUM ANALYZE` on high-churn tables
- Weekly `REINDEX` on message and event tables
- Monthly archival of audit log partitions

---

## Data Retention Policy

| Table | Retention | Action |
|-------|-----------|--------|
| outreach_messages | Indefinite | Keep (minimal storage) |
| outreach_delivery_events | 2 years | Archive to S3 |
| outreach_audit_log | 7 years | Archive to cold storage quarterly |
| idempotency_keys | 24 hours | Auto-delete |
| outreach_daily_metrics | Indefinite | Keep (already aggregated) |

---

## Troubleshooting

### "relation does not exist" errors
Migrations haven't run. Run all three migrations in order.

### "duplicate key value violates unique constraint"
- Idempotency key collision: Check if same message is being sent twice
- Email collision: Check if lead already exists in DB

### "Slow queries on outreach_messages"
- Ensure indexes are present: `\d outreach_messages`
- Run `ANALYZE outreach_messages;`
- Check partition strategy for audit log

### "Audit log table growing too large"
- Run monthly archival job: `SELECT archive_old_audit_logs(730);`
- Export partitions > 2 years to S3/cold storage

---

## Backup & Recovery

### Backup outreach data only
```bash
pg_dump -h localhost -U postgres -d castironforge \
  -t 'outreach_*' -t 'idempotency_keys' \
  > outreach_backup.sql
```

### Restore from backup
```bash
psql -U postgres -d castironforge < outreach_backup.sql
```

---

## Configuration

### Environment Variables
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/castironforge
DB_MIGRATION_TIMEOUT=30000  # milliseconds
```

### Connection Pool Size
```sql
-- Recommended: 10-20 connections for typical load
ALTER SYSTEM SET max_connections = 200;
SELECT pg_reload_conf();
```

---

## Testing

### Unit test: Create test data
```sql
-- Insert test lead
INSERT INTO outreach_leads (email, name, company, custom_fields)
VALUES ('test@example.com', 'Test User', 'Test Corp', '{"region": "US"}');

-- Insert test template
INSERT INTO outreach_templates (name, base_content, tone, created_by)
VALUES ('Test Template', 'Hi {{lead.name}}', 'casual', 'test_user');

-- Insert test campaign
INSERT INTO outreach_campaigns (name, template_id, lead_count, status, created_by)
SELECT 'Test Campaign', t.id, 1, 'draft', 'test_user'
FROM outreach_templates t WHERE t.name = 'Test Template';
```

### Integration test: End-to-end flow
```sql
-- 1. Create leads
-- 2. Create template with variants
-- 3. Create campaign
-- 4. Insert messages
-- 5. Simulate webhook events
-- 6. Verify metrics aggregation
```

---

## Related Documentation

- See `UNIFIED_OUTREACH_API_SPEC.md` for API contracts
- See `shared-types/src/index.ts` for TypeScript type definitions
- See `PHASE_5_OUTREACH_ROADMAP.md` for implementation timeline
