# Balanced Exclusion Profile System — API Reference

**Date:** 2026-06-19  
**Base URL:** `http://localhost:8000` (or your chat-agent endpoint)  
**Content-Type:** `application/json`

---

## Endpoints

### 1. GET /exclusion/health

**Purpose:** Get current health status of ExclusionAgent

**Request:**
```bash
curl http://localhost:8000/exclusion/health
```

**Response (200 OK):**
```json
{
  "status": "online",
  "uptime": 3600000,
  "lastUpdate": 1718794523456,
  "driftEventsDetected": 3,
  "timelineEntries": 45,
  "profile": "fullstack",
  "lastError": null
}
```

**Response (503 Service Unavailable):**
```json
{
  "error": "ExclusionAgent not initialized"
}
```

**Response Schema:**
```typescript
interface AgentHealth {
  status: "online" | "offline" | "degraded";
  uptime: number;               // milliseconds since start
  lastUpdate: number;          // Unix timestamp of last manifest update
  driftEventsDetected: number; // Counter of drift events
  timelineEntries: number;     // Number of snapshots in memory
  profile: string | null;      // Current profile name
  lastError: string | null;    // Last error message, if degraded
}
```

**Status Codes:**
- `200 OK` — Agent is running
- `503 Service Unavailable` — Agent not initialized or stopped

**Example Monitoring:**
```bash
# Check if agent is healthy
HEALTH=$(curl -s http://localhost:8000/exclusion/health)
STATUS=$(echo $HEALTH | jq -r '.status')

if [ "$STATUS" != "online" ]; then
  echo "ALERT: ExclusionAgent not online: $STATUS"
  exit 1
fi
```

---

### 2. GET /exclusion/filters

**Purpose:** Get active TorqueQuery filter configuration

**Request:**
```bash
curl http://localhost:8000/exclusion/filters
```

**Response (200 OK):**
```json
{
  "mode": "balanced",
  "profile": "fullstack",
  "filters": {
    "exclude": [
      "node_modules/**",
      "dist/**",
      ".next/**",
      ".env",
      "*.pem",
      "*.key",
      "*.mp4",
      "*.sqlite",
      "*.db"
    ],
    "include": [
      "!src/**/*.test.ts",
      "!**/*.spec.ts"
    ],
    "sizeCap": 500,
    "languageWhitelist": [
      "ts", "js", "py", "json", "yaml", "toml", "md", "txt", "go", "rs"
    ]
  }
}
```

**Response (503 Service Unavailable):**
```json
{
  "error": "ExclusionAgent not initialized"
}
```

**Response Schema:**
```typescript
interface TorqueQueryConfig {
  mode: "balanced";
  profile: string;  // Current profile name
  filters: {
    exclude: string[];           // Patterns to exclude
    include: string[];           // Patterns to include (override excludes)
    sizeCap: number;            // Max file size in KB
    languageWhitelist: string[]; // File extensions to include
  };
}
```

**Usage Notes:**
- `exclude`: Glob patterns to skip during ingestion
- `include`: Negation rules (must start with `!` for override semantics)
- `sizeCap`: Files larger than this are skipped
- `languageWhitelist`: Only files with these extensions are indexed (unless in include list)

**Example Usage:**
```typescript
// Fetch filters and validate
const response = await fetch('http://localhost:8000/exclusion/filters');
const config = await response.json();

console.log(`Active profile: ${config.profile}`);
console.log(`Excluding: ${config.filters.exclude.length} patterns`);
console.log(`Including: ${config.filters.include.length} patterns`);
console.log(`Max file size: ${config.filters.sizeCap} KB`);
```

---

### 3. GET /exclusion/timeline

**Purpose:** Get chronological ingestion timeline with optional limit

**Request:**
```bash
# Get last 50 entries (default)
curl http://localhost:8000/exclusion/timeline

# Get last 10 entries
curl "http://localhost:8000/exclusion/timeline?limit=10"

# Get last 100 entries
curl "http://localhost:8000/exclusion/timeline?limit=100"
```

**Response (200 OK):**
```json
{
  "entries": [
    {
      "timestamp": 1718794523456,
      "profile": "fullstack",
      "excludeCount": 8,
      "includeCount": 2,
      "fileSizeCapKB": 500,
      "languageWhitelistCount": 10,
      "driftDetected": false,
      "metadata": {
        "scanDuration": 234,
        "cacheHit": true
      }
    },
    {
      "timestamp": 1718794513456,
      "profile": "fullstack",
      "excludeCount": 8,
      "includeCount": 2,
      "fileSizeCapKB": 500,
      "languageWhitelistCount": 10,
      "driftDetected": true,
      "metadata": {
        "driftType": "framework_change",
        "scanDuration": 456
      }
    }
  ],
  "count": 2
}
```

**Response (503 Service Unavailable):**
```json
{
  "error": "ExclusionAgent not initialized"
}
```

**Response Schema:**
```typescript
interface IngestionTimelineEntry {
  timestamp: number;                      // Unix timestamp (ms)
  profile: string;                        // Profile name at this time
  excludeCount: number;                   // Number of exclusion rules
  includeCount: number;                   // Number of inclusion rules
  fileSizeCapKB: number;                  // File size cap
  languageWhitelistCount: number;         // Number of whitelisted extensions
  driftDetected: boolean;                 // Whether drift was detected
  metadata?: Record<string, unknown>;     // Optional metadata
}
```

**Query Parameters:**
- `limit` (optional, default: 50, max: 1000) — Number of recent entries to return

**Status Codes:**
- `200 OK` — Successfully returned timeline entries
- `503 Service Unavailable` — Agent not initialized

**Example Usage:**
```bash
# Get timeline and find drift events
curl -s "http://localhost:8000/exclusion/timeline?limit=100" | \
  jq '.entries | map(select(.driftDetected == true))'

# Get timeline and analyze profile changes
curl -s "http://localhost:8000/exclusion/timeline" | \
  jq '.entries | map(.profile) | unique'

# Get most recent entry
curl -s "http://localhost:8000/exclusion/timeline?limit=1" | \
  jq '.entries[0]'
```

---

### 4. GET /exclusion/diagnostics

**Purpose:** Get comprehensive diagnostic report of ExclusionAgent state

**Request:**
```bash
curl http://localhost:8000/exclusion/diagnostics
```

**Response (200 OK):**
```json
{
  "health": {
    "status": "online",
    "uptime": 3600000,
    "lastUpdate": 1718794523456,
    "driftEventsDetected": 3,
    "timelineEntries": 45,
    "profile": "fullstack",
    "lastError": null
  },
  "tq_config": {
    "mode": "balanced",
    "profile": "fullstack",
    "filters": {
      "exclude": ["node_modules/**", "dist/**", ...],
      "include": ["!src/**/*.test.ts", ...],
      "sizeCap": 500,
      "languageWhitelist": ["ts", "js", "py", ...]
    }
  },
  "timeline_length": 45,
  "recent_entries": [
    {
      "timestamp": 1718794523456,
      "profile": "fullstack",
      "excludeCount": 8,
      "includeCount": 2,
      "fileSizeCapKB": 500,
      "languageWhitelistCount": 10,
      "driftDetected": false
    }
  ],
  "manifest": {
    "name": "fullstack",
    "exclude_count": 8,
    "include_count": 2,
    "file_size_cap_kb": 500
  }
}
```

**Response (503 Service Unavailable):**
```json
{
  "error": "ExclusionAgent not initialized"
}
```

**Response Schema:**
```typescript
interface DiagnosticsReport {
  health: AgentHealth;
  tq_config: TorqueQueryConfig | null;
  timeline_length: number;
  recent_entries: IngestionTimelineEntry[];
  manifest: {
    name: string;
    exclude_count: number;
    include_count: number;
    file_size_cap_kb: number;
  } | null;
}
```

**Status Codes:**
- `200 OK` — Successfully returned diagnostics
- `503 Service Unavailable` — Agent not initialized

**Usage Notes:**
- This endpoint combines data from `/health`, `/filters`, and `/timeline`
- Useful for comprehensive health checks and debugging
- Returns 5 most recent timeline entries (not all 50)

**Example Usage:**
```bash
# Full system health check
curl -s http://localhost:8000/exclusion/diagnostics | jq '{
  status: .health.status,
  profile: .health.profile,
  uptime_hours: (.health.uptime / 3600000),
  drift_events: .health.driftEventsDetected,
  filter_count: (.tq_config.filters.exclude | length)
}'

# Output:
# {
#   "status": "online",
#   "profile": "fullstack",
#   "uptime_hours": 1.0,
#   "drift_events": 3,
#   "filter_count": 8
# }
```

---

## Error Responses

### 503 Service Unavailable

**When:** ExclusionAgent not initialized or stopped

**Response:**
```json
{
  "error": "ExclusionAgent not initialized"
}
```

**Cause:** Agent initialization failed or hasn't completed yet

**Resolution:**
1. Check chat-agent logs: `docker-compose logs chat-agent | grep -i "exclusion"`
2. Verify TorqueQuery is running: `curl http://localhost:9000/health`
3. Wait 5-10 seconds for initialization
4. Restart chat-agent if needed

---

## Response Headers

All endpoints return:
```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: XXXX
```

---

## Rate Limiting

No rate limiting implemented. Recommendations:
- Keep polling intervals ≥5 seconds for `/health`
- Use `/diagnostics` sparingly (expensive operation)
- Cache `/filters` response if called frequently

**Typical polling intervals:**
- `/health`: 10-30 seconds (monitoring)
- `/filters`: 1-5 minutes (less volatile)
- `/timeline`: 1-5 minutes (historical)
- `/diagnostics`: On-demand only

---

## Examples

### Health Check Script

```bash
#!/bin/bash
# Check if ExclusionAgent is healthy

ENDPOINT="http://localhost:8000/exclusion/health"
TIMEOUT=5

RESPONSE=$(curl -s --max-time $TIMEOUT "$ENDPOINT")

if [ $? -ne 0 ]; then
  echo "ERROR: Could not reach endpoint"
  exit 1
fi

STATUS=$(echo "$RESPONSE" | jq -r '.status')

if [ "$STATUS" = "online" ]; then
  UPTIME=$(echo "$RESPONSE" | jq '.uptime / 3600000' | cut -d. -f1)
  DRIFT=$(echo "$RESPONSE" | jq '.driftEventsDetected')
  echo "✓ ExclusionAgent online (uptime: ${UPTIME}h, drift events: $DRIFT)"
  exit 0
else
  echo "✗ ExclusionAgent not online: $STATUS"
  exit 1
fi
```

**Usage:**
```bash
chmod +x health-check.sh
./health-check.sh
```

### Monitor Filter Changes

```bash
#!/bin/bash
# Alert when filter rules change

ENDPOINT="http://localhost:8000/exclusion/filters"
CACHE_FILE="/tmp/exclusion-filters.json"

CURRENT=$(curl -s "$ENDPOINT")

if [ -f "$CACHE_FILE" ]; then
  PREVIOUS=$(cat "$CACHE_FILE")
  
  if [ "$CURRENT" != "$PREVIOUS" ]; then
    echo "ALERT: Filter configuration changed"
    echo "Previous: $(echo $PREVIOUS | jq '.profile')"
    echo "Current: $(echo $CURRENT | jq '.profile')"
    
    # Send alert (webhook, email, etc.)
    # curl -X POST https://alerts.example.com/hook ...
  fi
fi

echo "$CURRENT" > "$CACHE_FILE"
```

### Extract Profile Distribution

```bash
#!/bin/bash
# Analyze profile distribution across timeline

ENDPOINT="http://localhost:8000/exclusion/timeline?limit=1000"

curl -s "$ENDPOINT" | jq -r '.entries[].profile' | sort | uniq -c | sort -rn

# Output:
#    850 fullstack
#    120 python
#     30 monorepo
```

### Detect Anomalous Behavior

```bash
#!/bin/bash
# Alert if drift detection becomes too frequent

ENDPOINT="http://localhost:8000/exclusion/health"

DRIFT=$(curl -s "$ENDPOINT" | jq '.driftEventsDetected')
THRESHOLD=10

if [ "$DRIFT" -gt "$THRESHOLD" ]; then
  echo "ALERT: High drift detection rate: $DRIFT events"
  echo "Possible causes:"
  echo "- Rapid file system changes"
  echo "- New framework detected"
  echo "- Configuration mismatch"
fi
```

---

## Testing

### cURL Examples

```bash
# Test all endpoints
for endpoint in health filters "timeline?limit=5" diagnostics; do
  echo "=== /exclusion/$endpoint ==="
  curl -s "http://localhost:8000/exclusion/$endpoint" | jq '.'
done

# Pretty-print specific fields
curl -s "http://localhost:8000/exclusion/health" | \
  jq '{status, uptime: (.uptime / 1000 | tostring + "ms"), profile}'
```

### Monitoring Tools Integration

**Prometheus:**
```yaml
scrape_configs:
  - job_name: 'exclusion-agent'
    metrics_path: '/exclusion/diagnostics'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:8000']
```

**Datadog (via agent script):**
```python
import requests

def check_exclusion_agent():
    response = requests.get('http://localhost:8000/exclusion/health')
    data = response.json()
    
    datadog_api.gauge('exclusion.uptime', data['uptime'])
    datadog_api.gauge('exclusion.drift_events', data['driftEventsDetected'])
    datadog_api.gauge('exclusion.timeline_entries', data['timelineEntries'])
    
    if data['status'] != 'online':
        datadog_api.event('exclusion.agent_down', 'ExclusionAgent is ' + data['status'])
```

---

## Next Steps

1. **[Integration Guide](./EXCLUSION_INTEGRATION_GUIDE.md)** — Understand system architecture
2. **[Operator Runbook](./EXCLUSION_OPERATOR_RUNBOOK.md)** — Day-2 operations
3. **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** — Deployment procedures
