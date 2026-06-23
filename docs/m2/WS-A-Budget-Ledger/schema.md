# WS-A: Budget Ledger — Schema

The Budget Ledger uses `budget_ledger_v3`, a normalized schema optimized for atomic writes and low‑latency reads.

## budget_ledger_v3

### Table: ledger_entries

| Field | Type | Description |
|-------|------|-------------|
| entry_id | UUID | Unique identifier |
| agent_id | TEXT | Agent or subsystem identifier |
| session_id | TEXT | Session or request identifier |
| timestamp | TIMESTAMP | Event time |
| tokens_used | INTEGER | Tokens consumed in this event |
| cost_usd | DECIMAL(10,5) | Cost of this event |
| cumulative_tokens | INTEGER | Running total |
| cumulative_cost_usd | DECIMAL(12,5) | Running cost total |
| projected_cost_usd | DECIMAL(12,5) | Estimated cost to completion |
| event_type | TEXT | `usage` \| `warning` \| `abort` |
| metadata | JSONB | Additional structured data |

### Indexes

- `idx_ledger_agent_time` (agent_id, timestamp)
- `idx_ledger_session` (session_id)
- `idx_ledger_event_type` (event_type)

### Constraints

- Writes must be atomic
- `cumulative_cost_usd` must be monotonic (≥ previous value)
- `projected_cost_usd` must be ≥ `cumulative_cost_usd`
- `entry_id` must be unique (enforced at write time)
