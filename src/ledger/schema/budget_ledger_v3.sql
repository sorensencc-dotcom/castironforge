-- budget_ledger_v3: Authoritative ledger schema for M2 Budget Ledger (WS-A)
-- This is the source of truth for all token usage, cost tracking, and governance

CREATE TABLE IF NOT EXISTS ledger_entries (
  -- Identifiers
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,

  -- Event metadata
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL CHECK (event_type IN ('usage', 'warning', 'abort')),

  -- Usage and cost
  tokens_used INTEGER NOT NULL CHECK (tokens_used >= 0),
  cost_usd DECIMAL(10, 5) NOT NULL CHECK (cost_usd >= 0),

  -- Cumulative totals (monotonic)
  cumulative_tokens INTEGER NOT NULL CHECK (cumulative_tokens >= 0),
  cumulative_cost_usd DECIMAL(12, 5) NOT NULL CHECK (cumulative_cost_usd >= 0),

  -- Projection
  projected_cost_usd DECIMAL(12, 5) NOT NULL CHECK (projected_cost_usd >= cumulative_cost_usd),

  -- Flexible metadata (JSON for extensibility)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Constraints
  CONSTRAINT cumulative_cost_monotonic CHECK (cumulative_cost_usd >= 0),
  CONSTRAINT projected_cost_valid CHECK (projected_cost_usd >= cumulative_cost_usd)
);

-- Indexes for query performance

-- Agent + timestamp lookups (hot path for SLO Controller)
CREATE INDEX idx_ledger_agent_time
  ON ledger_entries(agent_id, timestamp DESC);

-- Session lookups (for per-session budget enforcement)
CREATE INDEX idx_ledger_session
  ON ledger_entries(session_id);

-- Event type lookups (for filtering governance events)
CREATE INDEX idx_ledger_event_type
  ON ledger_entries(event_type);

-- Timestamp index (for rolling window queries)
CREATE INDEX idx_ledger_timestamp
  ON ledger_entries(timestamp DESC);

-- Composite index for common queries (agent + event_type + timestamp)
CREATE INDEX idx_ledger_agent_event_time
  ON ledger_entries(agent_id, event_type, timestamp DESC);

-- Additional constraints and triggers

-- Prevent concurrent writes via row-level locking
-- (Application enforces via transaction isolation level SERIALIZABLE)

-- Audit trail: store original insert time (immutable)
ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE
  NOT NULL DEFAULT NOW();

-- Version for schema migrations
ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS schema_version INTEGER
  NOT NULL DEFAULT 3;
