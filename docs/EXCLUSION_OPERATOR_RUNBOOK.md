# Balanced Exclusion Profile System — Operator Runbook

**Date:** 2026-06-19  
**Target Audience:** Platform operators, on-call engineers  

---

## Quick Reference

| Symptom | Command | Expected Output |
|---------|---------|-----------------|
| Is agent healthy? | `curl http://localhost:8000/exclusion/health \| jq '.status'` | `"online"` |
| What profile? | `curl http://localhost:8000/exclusion/health \| jq '.profile'` | `"fullstack"` |
| Exclude count? | `curl http://localhost:8000/exclusion/filters \| jq '.filters.exclude \| length'` | `8` |
| Recent drift? | `curl http://localhost:8000/exclusion/timeline?limit=1 \| jq '.entries[0].driftDetected'` | `true/false` |
| Full diagnostics | `curl http://localhost:8000/exclusion/diagnostics \| jq '.'` | Full report |

---

## Daily Operations

### Morning Health Check

```bash
#!/bin/bash
# Run every morning to verify overnight stability

for ws in $(cat /opt/workspace-list.txt); do
  echo "=== $ws ==="
  curl -s "http://${ws}.internal:8000/exclusion/health" | jq '{status, uptime: (.uptime / 3600000 | floor), profile, drift_events: .driftEventsDetected, timeline: .timelineEntries}'
done
```

**Expected:**
- `status: "online"` for all workspaces
- `uptime` increasing steadily
- `drift_events` incrementing reasonably (1-5/day typical)

**If any workspace is not online:**
1. Check logs: `docker-compose logs chat-agent | tail -50`
2. Restart if needed: `docker-compose restart chat-agent`
3. Verify TorqueQuery: `curl http://localhost:9000/health`

### Weekly Trend Analysis

```bash
#!/bin/bash
# Run weekly to spot trends

echo "=== Profile Distribution (Past 1000 entries) ==="
curl -s "http://localhost:8000/exclusion/timeline?limit=1000" | \
  jq -r '.entries[].profile' | sort | uniq -c | sort -rn

echo ""
echo "=== Drift Detection Rate ==="
curl -s "http://localhost:8000/exclusion/timeline?limit=1000" | \
  jq '[.entries | map(select(.driftDetected == true))] | length'

echo ""
echo "=== Memory Baseline ==="
docker stats cic-chat-agent --no-stream | tail -1
```

---

## Troubleshooting Guide

### Issue 1: ExclusionAgent Status is "degraded"

**Symptoms:**
- `/exclusion/health` returns `"status": "degraded"`
- `lastError` field contains error message

**Diagnosis:**
```bash
# Check last error
curl http://localhost:8000/exclusion/health | jq '.lastError'

# Check full logs
docker-compose logs chat-agent | grep -i "error" | tail -20
```

**Common Errors & Fixes:**

#### Error: "TorqueQuery connection failed"
**Cause:** TorqueQuery service down or unreachable
```bash
# Check TorqueQuery
curl http://localhost:9000/health

# If down, restart it
docker-compose up -d torquequery

# Wait for health check to pass
sleep 5
curl http://localhost:9000/health
```

#### Error: "Profile detection failed"
**Cause:** Profiles directory missing or corrupted
```bash
# Check directory
ls -la /home/user/castironforge/profiles/ | grep -E "\.ts$"

# Should list: exclusion-agent.ts, exclusion-profile-engine.ts, etc.

# If missing, restore from git
cd /home/user/castironforge
git checkout profiles/
```

#### Error: "fs.watch failed"
**Cause:** File system watching unavailable (normal fallback)
```bash
# This is not an error - check logs for:
# "fs.watch not available, using polling only"

# Agent will use 5-second polling instead (acceptable)
```

**Resolution:**
1. Restart chat-agent: `docker-compose restart chat-agent`
2. Wait 30s for re-initialization
3. Verify health: `curl http://localhost:8000/exclusion/health`

---

### Issue 2: High Memory Usage (>250MB)

**Symptoms:**
- Chat-agent memory exceeds 250MB
- OOM killer warnings in dmesg
- Slowness or crashes

**Diagnosis:**
```bash
# Check memory
docker stats cic-chat-agent | grep cic-chat-agent

# Check timeline size (number of snapshots in memory)
curl http://localhost:8000/exclusion/health | jq '.timelineEntries'

# Check healing history size (if available)
curl http://localhost:8000/exclusion/diagnostics | jq '.manifest'
```

**Fixes (in priority order):**

1. **Reduce timeline max snapshots:**
   ```bash
   # Edit profiles/ingestion-timeline.ts line 52
   # From: private maxSnapshots: number = 1000;
   # To:   private maxSnapshots: number = 500;
   
   cd /home/user/castironforge
   git pull origin docs/migration-2026-05-04
   docker-compose up --build -d
   ```

2. **Reduce scan frequency:**
   ```typescript
   // profiles/self-healing-engine.ts line 66
   // From: scanInterval: 5000   (5 seconds)
   // To:   scanInterval: 30000  (30 seconds)
   ```

3. **Increase fingerprint cache TTL:**
   ```typescript
   // profiles/self-healing-engine.ts line 58
   // From: fingerprintCacheTTL: 5 * 60 * 1000   (5 min)
   // To:   fingerprintCacheTTL: 15 * 60 * 1000  (15 min)
   ```

**After changes:**
```bash
cd /home/user/castironforge/chat-agent
npm run build
docker-compose up --build -d
sleep 10
curl http://localhost:8000/exclusion/health
```

---

### Issue 3: No Drift Detection (Stuck Profile)

**Symptoms:**
- `driftEventsDetected` not incrementing
- Always same profile in timeline
- New files/frameworks not triggering updates

**Diagnosis:**
```bash
# Check if drift detection is working
curl http://localhost:8000/exclusion/timeline?limit=10 | \
  jq '.entries | map(.driftDetected)'

# All false? Something is wrong

# Check if recent entries show changes
curl http://localhost:8000/exclusion/timeline?limit=10 | \
  jq '.entries | map({timestamp, profile, driftDetected})'
```

**Fixes:**

1. **Force rescan:**
   ```bash
   # Add/remove a file to trigger drift
   touch /tmp/test.py
   # Wait 10-15 seconds
   rm /tmp/test.py
   
   # Check again
   curl http://localhost:8000/exclusion/timeline?limit=1
   ```

2. **Reduce cache TTL (speed up detection):**
   ```typescript
   // profiles/self-healing-engine.ts line 58
   // From: fingerprintCacheTTL: 5 * 60 * 1000
   // To:   fingerprintCacheTTL: 1 * 60 * 1000  (1 minute)
   ```

3. **Restart healing engine:**
   ```bash
   docker-compose restart chat-agent
   sleep 10
   curl http://localhost:8000/exclusion/health
   ```

---

### Issue 4: Drift Detection Too Frequent (Noisy)

**Symptoms:**
- `driftEventsDetected` incrementing rapidly (>5 per minute)
- Constant profile/rule changes
- TorqueQuery syncing too often

**Diagnosis:**
```bash
# Check drift rate
curl http://localhost:8000/exclusion/timeline?limit=100 | \
  jq '[.entries | map(select(.driftDetected == true))] | length'

# If >10 in recent 100 entries, it's noisy
```

**Fixes:**

1. **Increase cache TTL (reduce scan sensitivity):**
   ```typescript
   // profiles/self-healing-engine.ts line 58
   // From: fingerprintCacheTTL: 5 * 60 * 1000
   // To:   fingerprintCacheTTL: 15 * 60 * 1000  (15 minutes)
   ```

2. **Increase scan interval:**
   ```typescript
   // profiles/self-healing-engine.ts line 66
   // From: scanInterval: 5000   (5 seconds)
   // To:   scanInterval: 30000  (30 seconds)
   ```

3. **Check for legitimate drift:**
   ```bash
   # Review recent drift events
   curl http://localhost:8000/exclusion/timeline?limit=50 | \
     jq '.entries | map(select(.driftDetected == true)) | map({timestamp, profile})'
   
   # If all same profile but driftDetected=true, check cache validity
   ```

---

### Issue 5: TorqueQuery Filters Not Updating

**Symptoms:**
- `/exclusion/filters` shows data
- But query results not respecting new exclusions
- Filters are old/stale

**Diagnosis:**
```bash
# Check local filters
curl http://localhost:8000/exclusion/filters | jq '.filters.exclude'

# Check filter age
TIMESTAMP=$(curl -s http://localhost:8000/exclusion/filters | jq '.metadata.generatedAt')

# Check if being synced (manifest_updated events)
docker-compose logs chat-agent | grep "Manifest updated" | tail -5
```

**Fixes:**

1. **Verify TorqueQuery connectivity:**
   ```bash
   # Check if TQ is reachable
   curl http://localhost:9000/health
   
   # If not, restart TQ
   docker-compose up -d torquequery
   ```

2. **Force manifest update:**
   ```bash
   # Restart chat-agent to re-sync
   docker-compose restart chat-agent
   sleep 10
   
   # Verify
   curl http://localhost:8000/exclusion/filters | jq '.profile'
   ```

3. **Check filter delta computation:**
   ```bash
   # If filters haven't changed, delta will be null (skipped sync)
   # This is normal behavior
   
   # To force full sync, trigger a drift event
   touch /tmp/test.rs
   sleep 15
   rm /tmp/test.rs
   
   # Check logs for "Manifest updated"
   docker-compose logs chat-agent | grep "Manifest updated"
   ```

---

## Performance Tuning

### Baseline Metrics

Typical production values (100 workspaces):

| Metric | Baseline | Warning | Critical |
|--------|----------|---------|----------|
| Memory | 50-100 MB | >200 MB | >300 MB |
| CPU (mean) | 1-3% | >8% | >15% |
| CPU (peak) | 5-10% | >20% | >30% |
| Uptime | 99.9% | <99% | <95% |
| Drift events/day | 1-5 | >20 | >100 |
| Filter syncs/day | 10-30 | >100 | >500 |

### Optimization Strategy

**If memory is high (>150MB):**
1. Reduce `maxSnapshots`: 1000 → 500
2. Increase fingerprint cache TTL: 5min → 10min

**If CPU is high (>8%):**
1. Increase scan interval: 5s → 15s
2. Increase fingerprint cache TTL: 5min → 10min

**If drift detection is slow (>2min lag):**
1. Reduce fingerprint cache TTL: 5min → 2min
2. Reduce scan interval: 5s → 2s

**If TorqueQuery syncs are too frequent:**
1. Tune profile detection to be more stable
2. Increase manifest update interval from 10s → 30s (line 128 in exclusion-agent.ts)

---

## Alerting

### Recommended Alerts

**Critical (Page immediately):**
```yaml
- alert: ExclusionAgentDown
  expr: exclusion_agent_status != 1
  for: 5m
  
- alert: HighErrorRate
  expr: rate(exclusion_errors_total[5m]) > 0.1
  for: 2m
  
- alert: MemoryOverflow
  expr: exclusion_memory_bytes > 300_000_000
  for: 5m
```

**Warning (Alert but don't page):**
```yaml
- alert: HighDriftRate
  expr: rate(exclusion_drift_events[5m]) > 1
  for: 10m
  
- alert: HighCpuUsage
  expr: rate(exclusion_cpu_seconds[5m]) > 8
  for: 10m
  
- alert: StaleTimeline
  expr: time() - exclusion_last_update > 60
  for: 5m
```

### Dashboard Queries

**Prometheus/Grafana:**
```promql
# Agent health
topk(5, (time() - exclusion_start_time) / 3600)

# Memory trend
rate(exclusion_memory_bytes[5m])

# Drift detection rate
rate(exclusion_drift_events[1h])

# Filter sync frequency
rate(exclusion_manifest_updates[1h])

# Profile distribution
topk(5, exclusion_timeline_entries{profile=~".+"})
```

---

## Runbook Scenarios

### Scenario 1: Production Incident (Agent Down)

**Time: 2:47 AM**

1. **Alert received:** ExclusionAgent down on workspace-5
2. **Immediate action (2 min):**
   ```bash
   # SSH to workspace-5
   ssh user@workspace-5.internal
   
   # Check status
   curl http://localhost:8000/exclusion/health
   # Response: 503 error
   ```

3. **Diagnosis (5 min):**
   ```bash
   # Check logs
   docker-compose logs chat-agent | tail -50
   
   # Possible output: "TorqueQuery connection failed"
   
   # Check dependencies
   curl http://localhost:9000/health  # TorqueQuery
   curl http://localhost:11434/api/tags  # Ollama
   ```

4. **Fix (2 min):**
   ```bash
   # Restart TorqueQuery if needed
   docker-compose restart torquequery
   sleep 5
   
   # Restart chat-agent
   docker-compose restart chat-agent
   sleep 10
   ```

5. **Verification (1 min):**
   ```bash
   # Check health
   curl http://localhost:8000/exclusion/health | jq '.status'
   # Output: "online"
   
   # Alert pager: resolved
   ```

**Total incident time: ~15 minutes**

---

### Scenario 2: Memory Leak Detected

**Time: 10:15 AM**

1. **Alert received:** Memory >250MB on workspace-3
2. **Investigate (5 min):**
   ```bash
   # SSH to workspace-3
   ssh user@workspace-3.internal
   
   # Check memory trend
   docker stats cic-chat-agent --no-stream
   # Memory: 267 MB (growing)
   
   # Check timeline size
   curl http://localhost:8000/exclusion/health | jq '.timelineEntries'
   # Output: 1000 (max capacity reached)
   ```

3. **Quick fix (1 min):**
   ```bash
   # Reduce max snapshots in config
   cd /home/user/castironforge
   sed -i 's/maxSnapshots: number = 1000/maxSnapshots: number = 500/' profiles/ingestion-timeline.ts
   
   # Rebuild and restart
   npm run build
   docker-compose up --build -d
   sleep 10
   ```

4. **Verify (1 min):**
   ```bash
   # Check memory
   docker stats cic-chat-agent --no-stream
   # Memory: ~80 MB (stable)
   
   # Alert resolved
   ```

**Total incident time: ~20 minutes**

---

### Scenario 3: Drift Detection Too Noisy

**Time: 3:30 PM**

1. **Observation:** 47 drift events in past hour (usually 2-3)
2. **Investigate (5 min):**
   ```bash
   # Check drift events
   curl http://localhost:8000/exclusion/timeline?limit=100 | \
     jq '[.entries | map(select(.driftDetected == true))] | length'
   # Output: 47
   
   # Check what changed
   curl http://localhost:8000/exclusion/timeline?limit=10 | \
     jq '.entries | map(select(.driftDetected == true)) | .[0]'
   # Output shows profile alternating between "fullstack" and "python"
   ```

3. **Root cause:** Workspace has both Node and Python, creating instability
4. **Fix (2 min):**
   ```bash
   # Increase cache TTL to stabilize detection
   sed -i 's/fingerprintCacheTTL: 5 \* 60/fingerprintCacheTTL: 10 * 60/' profiles/self-healing-engine.ts
   
   # Rebuild and restart
   npm run build
   docker-compose up --build -d
   sleep 10
   ```

5. **Verify (1 min):**
   ```bash
   # Wait 5 min and check drift rate
   # Should drop to 1-2 events per hour
   ```

**Total investigation time: ~10 minutes**

---

## Maintenance Tasks

### Weekly Backup

```bash
#!/bin/bash
# Backup timeline data for audit

for ws in $(cat /opt/workspace-list.txt); do
  echo "Backing up $ws..."
  curl -s "http://${ws}.internal:8000/exclusion/timeline?limit=10000" > \
    "/backups/exclusion-timeline-${ws}-$(date +%Y%m%d).json"
done

echo "Backup complete"
```

### Monthly Cleanup

```bash
#!/bin/bash
# Clean up old backups (>90 days)

find /backups -name "exclusion-timeline-*.json" -mtime +90 -delete
echo "Cleanup complete"
```

### Quarterly Tuning Review

1. Analyze drift detection trends
2. Review memory/CPU baseline
3. Adjust cache TTL and scan intervals if needed
4. Update this runbook with new findings

---

## Escalation Path

**Level 1 (Operator):** Run diagnostics, check logs, restart services
**Level 2 (Backend Eng):** Code changes, tuning, git operations
**Level 3 (Arch):** Design issues, architectural changes, cross-system impacts

---

## Next Steps

1. **[API Reference](./EXCLUSION_API_REFERENCE.md)** — Endpoint details
2. **[Integration Guide](./EXCLUSION_INTEGRATION_GUIDE.md)** — System architecture
3. **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** — Rollout procedures
