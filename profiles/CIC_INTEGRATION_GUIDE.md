# CIC Exclusion Subsystem Integration Guide

Complete guide to integrating the Balanced Exclusion Profile System with CIC, TorqueQuery Phase 26, and the Operator Dashboard.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│         CIC Orchestrator (Agent-of-Agents)              │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼──────────────────────┐   ┌───▼──────────────┐
    │  Exclusion Agent Wrapper   │   │  Other CIC Agents│
    │  (exclusion-agent.ts)      │   │                  │
    └────┬──────────────────────┘   └──────────────────┘
         │
         ├─ Self-Healing Engine
         ├─ Profile Detector
         ├─ TorqueQuery Adapter
         └─ Ingestion Timeline
         │
    ┌────▼──────────────────────────┐
    │  TorqueQuery Phase 26          │
    │  (Ingestion Pipeline)          │
    └────┬──────────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │  CIC Ingestion (INGEST phase) │
    └────┬──────────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │  CIC Observability Dashboard   │
    │  (Real-time exclusion health)  │
    └────────────────────────────────┘
```

---

## Components

### 1. Exclusion Agent (exclusion-agent.ts)

A first-class CIC agent that orchestrates the entire exclusion subsystem.

**Responsibilities:**
- Start/stop lifecycle management
- Run exclusion engine on startup and on intervals
- Detect workspace drift via healing engine
- Update TorqueQuery filters on manifest changes
- Maintain rolling ingestion timeline
- Emit structured logs and metrics

**Key Methods:**
```typescript
agent.start()                          // Start the agent
agent.stop()                           // Stop the agent
agent.getHealth()                      // Get agent health status
agent.getTorqueQueryConfig()           // Get current TQ filters
agent.getTimeline(limit)               // Get ingestion timeline
agent.getTimelineDiff(from, to)        // Get diff between states
agent.getDiagnostics()                 // Get full diagnostics
```

**Events:**
```typescript
agent.on('started', () => { })
agent.on('manifest_updated', (update) => { })
agent.on('drift_detected', (drift) => { })
agent.on('error', (err) => { })
agent.on('stopped', () => { })
```

### 2. Operator Dashboard (exclusion-dashboard.html)

Zero-dependency Rewrite Labs style dashboard showing real-time exclusion health.

**Displays:**
- Current agent health (online/degraded/offline)
- Active profile
- TorqueQuery filters
- Drift events feed
- Ingestion timeline with changes
- Profile changes history

**Auto-refreshes every 3 seconds from:**
- `/exclusion/health` — Agent health
- `/exclusion/filters` — Active filters
- `/exclusion/timeline` — Ingestion timeline

### 3. Ingestion Timeline (ingestion-timeline.ts)

Chronological record of all exclusion updates for debugging and regression detection.

**Key Methods:**
```typescript
timeline.record(profile, excludes, includes, cap, langs, drift)
timeline.getSnapshots(limit)
timeline.getSnapshot(timestamp)
timeline.getLatest()
timeline.getDiff(fromTs, toTs)           // Diff between states
timeline.getStats()                      // Timeline statistics
timeline.getProfileChanges()             // All profile switches
timeline.getDriftEvents()                // All drift detections
timeline.queryTimeRange(start, end)
timeline.queryByProfile(profile)
timeline.export()                        // Export as JSON
```

**Features:**
- Persistent storage (optional JSON file)
- FIFO rotation (keep last N snapshots)
- Queryable by timestamp, profile, or time range
- Diff computation between any two states
- Statistics and trend analysis

---

## Integration Points

### 1. CIC Startup

In your CIC orchestrator initialization:

```typescript
import ExclusionAgent from './profiles/exclusion-agent';

async function initializeCIC() {
  const exclusionAgent = new ExclusionAgent(
    process.cwd(),
    'http://localhost:9000'  // TorqueQuery endpoint
  );

  await exclusionAgent.start();

  // Wire up to other CIC agents...
}
```

### 2. TorqueQuery Integration

The exclusion agent automatically pushes filters to TorqueQuery:

```typescript
// The agent calls this internally:
const config = agent.getTorqueQueryConfig();
// {
//   mode: 'balanced',
//   profile: 'fullstack',
//   filters: {
//     exclude: [...],
//     include: [...],
//     sizeCap: 500,
//     languageWhitelist: [...]
//   }
// }

// Apply to TorqueQuery (pseudocode):
TorqueQuery.configure(config.filters);
```

### 3. Dashboard Endpoints

Expose these HTTP endpoints in your CIC API server:

```typescript
// Health
app.get('/exclusion/health', (req, res) => {
  res.json({ health: agent.getHealth() });
});

// Filters
app.get('/exclusion/filters', (req, res) => {
  res.json({ filters: agent.getTorqueQueryConfig()?.filters });
});

// Timeline
app.get('/exclusion/timeline', (req, res) => {
  res.json({
    recent_entries: agent.getTimeline(50),
    stats: timeline.getStats()
  });
});

// Diff
app.get('/exclusion/timeline/diff', (req, res) => {
  const from = parseInt(req.query.from);
  const to = parseInt(req.query.to);
  const diff = timeline.getDiff(from, to);
  res.json({ diff });
});

// Serve dashboard
app.get('/exclusion/dashboard', (req, res) => {
  res.sendFile('./profiles/exclusion-dashboard.html');
});
```

### 4. Event Subscriptions

Listen to agent events for logging, alerting, or triggering workflows:

```typescript
// Log updates
agent.on('manifest_updated', (update) => {
  logger.info(`Exclusion filters updated`, update);
});

// Alert on drift
agent.on('drift_detected', (drift) => {
  logger.warn(`Workspace drift detected`, drift);
  // Could trigger re-indexing, re-analysis, etc.
});

// Track errors
agent.on('error', (err) => {
  logger.error(`Exclusion agent error`, err);
  metrics.increment('exclusion.errors');
});
```

### 5. Monitoring & Alerts

Expose metrics for your observability pipeline:

```typescript
// Periodically (every 10 seconds)
const health = agent.getHealth();
metrics.gauge('exclusion.status', health.status === 'online' ? 1 : 0);
metrics.gauge('exclusion.drift_events', health.driftEventsDetected);
metrics.gauge('exclusion.uptime_ms', health.uptime);
metrics.gauge('exclusion.timeline_entries', health.timelineEntries);

if (health.lastError) {
  alerts.critical(`Exclusion agent degraded: ${health.lastError}`);
}
```

---

## Workflow: Drift → Healing → TorqueQuery Update

### Scenario: New ML Framework Added to Workspace

1. **Workspace Change** — User adds `wandb/` directory (ML experiment tracking)

2. **Self-Healing Engine Detects** — Next scan cycle (every 5 seconds)
   ```
   Fingerprint change: wandb/ directory detected
   Drift event: type = "ml_artifacts"
   ```

3. **Agent Reacts** — Calls `exclusionEngine.runCycle()`
   ```
   Detect profile → detect() returns "ml" (changed from "fullstack")
   Load manifest → merge("balanced", "ml")
   Apply healing → add("wandb/", "*.pt", "*.pth")
   Build filters → TorqueQueryAdapter.buildFilters()
   ```

4. **Timeline Record** — New entry added
   ```typescript
   {
     timestamp: 1718700042000,
     profile: "ml",
     excludeCount: 95,  // up from 80
     includeCount: 42,
     fileSizeCapKB: 500,
     languageWhitelistCount: 13,
     driftDetected: true
   }
   ```

5. **TorqueQuery Update** — Filters applied
   ```
   exclude: [..., "wandb/", "*.pt", "*.pth"]
   ```

6. **Dashboard Reflects** — Real-time UI updated
   ```
   Profile: ML (changed from Fullstack)
   Drift Events: 1
   Latest Timeline: "wandb/ detected, profile switched to ML"
   ```

---

## Testing the Integration

### 1. Unit Test Example

```typescript
import ExclusionAgent from './profiles/exclusion-agent';

test('agent detects ML drift and switches profile', async () => {
  // Mock workspace with wandb/
  mockFS.mkdirSync('wandb');

  const agent = new ExclusionAgent();
  await agent.start();

  // Wait for drift detection
  await new Promise(resolve => {
    agent.once('drift_detected', () => {
      const profile = agent.getManifest()?.name;
      expect(profile).toBe('ml');
      resolve(undefined);
    });
  });

  agent.stop();
});
```

### 2. Integration Test Example

```typescript
test('end-to-end: drift → healing → timeline → dashboard', async () => {
  const agent = new ExclusionAgent();
  const timeline = new IngestionTimeline();

  agent.on('manifest_updated', (update) => {
    const tq = agent.getTorqueQueryConfig();
    timeline.record(
      tq.profile,
      tq.filters.exclude.length,
      tq.filters.include.length,
      tq.filters.sizeCap,
      tq.filters.languageWhitelist.length
    );
  });

  await agent.start();

  // Simulate workspace change
  mockFS.mkdirSync('checkpoints');

  // Wait for update
  await new Promise(resolve => setTimeout(resolve, 2000));

  const stats = timeline.getStats();
  expect(stats.profileChanges).toBe(1);
  expect(stats.driftEvents).toBe(1);

  agent.stop();
});
```

---

## Performance Considerations

- **Agent Scan Interval** — 10 seconds (configurable)
- **Self-Healing Scan** — 5 seconds (configurable)
- **Dashboard Refresh** — 3 seconds (frontend only)
- **Timeline Snapshots** — Keep last 1000 (configurable)
- **Memory Footprint** — ~10 MB (agent + engines + timeline)

---

## Troubleshooting

### Agent Not Starting

```typescript
const health = agent.getHealth();
if (health.status !== 'online') {
  console.error(`Agent degraded: ${health.lastError}`);
}
```

### Filters Not Updating

```typescript
const tq = agent.getTorqueQueryConfig();
if (!tq) {
  console.error('No TQ config generated');
} else {
  console.log('Active filters:', tq.filters);
}
```

### Timeline Not Recording

```typescript
const timeline = new IngestionTimeline('./timeline.json');
const stats = timeline.getStats();
console.log(`Timeline has ${stats.totalSnapshots} snapshots`);
```

---

## Security Considerations

- **Secret Protection** — 4th layer excludes `.env`, `*.pem`, `*.key`
- **Token Bloat Prevention** — File size cap (default 500 KB)
- **Non-Destructive** — Exclusion rules never modify source code
- **Audit Trail** — Complete timeline history for compliance

---

## Next Steps

1. **Deploy** — Add `ExclusionAgent` to CIC startup
2. **Monitor** — Expose health endpoints and dashboard
3. **Tune** — Adjust scan intervals and max timeline size as needed
4. **Integrate** — Wire event hooks into your observability pipeline

---

**Status:** Production-ready  
**Last Updated:** 2026-06-18  
**Version:** 1.0.0
