# Balanced Exclusion Profile System — Deployment Guide

**Date:** 2026-06-19  
**Status:** Production Ready  
**System:** CIC Phase 26 Integration  

---

## Overview

This guide covers deployment of the Balanced Exclusion Profile System across three rollout phases:
- **Phase 1 (Day 1):** Test workspace validation
- **Phase 2 (Days 2-3):** Canary rollout (5-10% of fleet)
- **Phase 3 (Days 4-7):** General availability

---

## Prerequisites

### Infrastructure
- Docker & Docker Compose (or manual Node.js/TypeScript setup)
- chat-agent on `:8000`
- TorqueQuery on `:9000` (with RAG indices built)
- Ollama or llama.cpp for inference

### Access
- Git access to `sorensencc-dotcom/castironforge`
- Ability to deploy to test/staging environments
- Monitoring/alerting dashboard access

### Knowledge
- Familiarity with CIC architecture
- Understanding of TorqueQuery filter syntax
- Basic TypeScript/Node.js operations

---

## Phase 1: Test Workspace (Day 1)

### 1.1 Deploy with Docker Compose

```bash
cd /home/user/castironforge
git pull origin docs/migration-2026-05-04
docker-compose up --build -d
```

**Expected output:**
```
Starting cic-torquequery ... done
Starting cic-ollama ... done
Starting cic-chat-agent ... done
Starting cic-chat-frontend ... done
```

### 1.2 Verify Startup

```bash
# Check health endpoints
curl http://localhost:8000/health
curl http://localhost:8000/exclusion/health
curl http://localhost:9000/health

# Expected responses:
# /health: {"torque": "online", "ollama": "online", "llamacpp": "error"}
# /exclusion/health: {"status": "online", "uptime": 5234, ...}
# /torque/health: {"status": "ok"}
```

### 1.3 Verify ExclusionAgent Initialization

```bash
# Check logs for initialization messages
docker-compose logs chat-agent | grep -i "exclusion"

# Expected:
# [ExclusionAgent] Initializing...
# [ExclusionAgent] Started
# [ExclusionAgent] Initialization complete
```

### 1.4 Test Endpoints

```bash
# Get health status
curl http://localhost:8000/exclusion/health | jq

# Get active filters
curl http://localhost:8000/exclusion/filters | jq

# Get timeline (last 5 entries)
curl "http://localhost:8000/exclusion/timeline?limit=5" | jq

# Get diagnostics
curl http://localhost:8000/exclusion/diagnostics | jq
```

### 1.5 Monitor for 24 Hours

**Metrics to track:**
```bash
# Every 5 minutes:
curl http://localhost:8000/exclusion/health | jq '{status, driftEventsDetected, timelineEntries}'

# Check for errors:
docker-compose logs chat-agent | grep -i "error\|warn" | tail -20

# Memory usage:
docker stats cic-chat-agent --no-stream | awk '{print $7}'

# TorqueQuery sync latency (check logs):
docker-compose logs chat-agent | grep "Manifest updated" | tail -5
```

**Success Criteria:**
- [ ] ExclusionAgent healthy (status: "online")
- [ ] No ERROR logs in chat-agent
- [ ] Memory stable (<150MB)
- [ ] At least 1 drift detection event
- [ ] Timeline entries growing (≥24 entries in 24h)
- [ ] No TorqueQuery connection errors

### 1.6 Manual Drift Trigger (Optional)

To test drift detection:

```bash
# Add a Python file to trigger language addition drift
touch /home/user/castironforge/test_script.py

# Wait 10-15 seconds for scan interval
sleep 15

# Check for drift event
curl http://localhost:8000/exclusion/timeline?limit=1 | jq '.entries[0]'

# Should show: "driftDetected": true (if drift occurred)

# Cleanup
rm /home/user/castironforge/test_script.py
```

---

## Phase 2: Canary Rollout (Days 2-3)

### 2.1 Deploy to 5-10 Workspaces

For each workspace (e.g., workspace-1, workspace-2, ...):

```bash
# SSH to workspace host
ssh user@workspace-1.internal

# Pull latest code
cd /opt/cic && git pull origin docs/migration-2026-05-04

# Build and start
docker-compose up --build -d

# Verify
curl http://localhost:8000/exclusion/health
```

### 2.2 Canary Monitoring

Monitor all 5-10 workspaces continuously:

```bash
# Create monitoring script: monitor-canary.sh
#!/bin/bash
WORKSPACES=("workspace-1" "workspace-2" "workspace-3" ... "workspace-10")

for ws in "${WORKSPACES[@]}"; do
  echo "=== $ws ==="
  curl -s "http://${ws}.internal:8000/exclusion/health" | jq '{status, uptime, driftEventsDetected}'
  curl -s "http://${ws}.internal:8000/exclusion/diagnostics" | jq '.health.status'
done
```

Run every 5 minutes:
```bash
watch -n 300 ./monitor-canary.sh
```

### 2.3 Canary Success Criteria

For each workspace, verify:
- [ ] ExclusionAgent online for >6 hours
- [ ] CPU <10% (mean)
- [ ] Memory <150MB (stable)
- [ ] TorqueQuery filter syncs (at least 2-3 per 24h)
- [ ] Drift detection working (≥1 event per workspace)
- [ ] No ERROR logs

**Rollback trigger:** If any workspace fails criteria, proceed to rollback section.

### 2.4 Canary Rollback (If Needed)

```bash
# SSH to failing workspace
ssh user@workspace-X.internal

# Stop services
docker-compose down

# Revert code
cd /opt/cic && git checkout docs/migration-2026-05-04~1

# Restart
docker-compose up -d

# Verify
curl http://localhost:8000/exclusion/health
```

---

## Phase 3: General Availability (Days 4-7)

### 3.1 Full Fleet Deployment

```bash
# Deploy to all remaining workspaces
# Use infrastructure-as-code (Terraform, Ansible, etc.) if available

for ws in $(cat /opt/workspace-list.txt); do
  ssh user@${ws}.internal "cd /opt/cic && git pull origin docs/migration-2026-05-04 && docker-compose up --build -d"
done

# Monitor deployment progress
watch -n 60 'cat /opt/workspace-list.txt | wc -l && curl -s http://WORKSPACE:8000/exclusion/health 2>/dev/null | jq -c "if .status == \"online\" then \".\" else \"F\" end" | tr -d "\n"'
```

### 3.2 Full Fleet Monitoring

Deploy centralized monitoring (Prometheus/Grafana or equivalent):

```yaml
# prometheus-exclusion-targets.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'exclusion-health'
    static_configs:
      - targets:
        - 'workspace-1:8000'
        - 'workspace-2:8000'
        # ... all workspaces
    metrics_path: '/exclusion/health'
```

### 3.3 Success Criteria (Full Fleet)

- [ ] ≥95% of workspaces with status = "online"
- [ ] Mean memory usage <150MB across fleet
- [ ] Mean CPU <8%
- [ ] Drift detection working on >80% of workspaces
- [ ] <0.1% ERROR rate in logs

### 3.4 Production Sign-Off

Once criteria met:
```bash
# Tag release
git tag -a v1.0.0-production -m "Balanced Exclusion Profile System - Production GA"
git push origin v1.0.0-production

# Notify stakeholders
# Create incident/change log entry
# Update runbooks/dashboards
```

---

## Phase 4: Optimization & Tuning (Weeks 2-4)

### 4.1 Collect Baseline Metrics

After 1 week of production, collect data:

```bash
# Query all workspaces for diagnostics
for ws in $(cat /opt/workspace-list.txt); do
  echo "=== $ws ===" >> baseline-metrics.txt
  curl -s "http://${ws}.internal:8000/exclusion/diagnostics" >> baseline-metrics.txt
done

# Analyze drift frequency, profile distribution, etc.
```

### 4.2 Tune Cache TTL

Default fingerprint cache TTL: 5 minutes

**If drift detection is too slow (>5min lag):**
```typescript
// profiles/self-healing-engine.ts
private fingerprintCacheTTL: number = 2 * 60 * 1000; // Reduce to 2 min
```

**If drift detection is too noisy (>5 events/hour):**
```typescript
private fingerprintCacheTTL: number = 10 * 60 * 1000; // Increase to 10 min
```

### 4.3 Profile Distribution Analysis

Check which profiles are most common:

```bash
# Query all timelines
for ws in $(cat /opt/workspace-list.txt); do
  curl -s "http://${ws}.internal:8000/exclusion/timeline?limit=100" | \
    jq -r '.entries[].profile' >> profile-dist.txt
done

# Analyze
sort profile-dist.txt | uniq -c | sort -rn
```

**Insight:** If balanced >90%, consider reducing default scan interval (currently 10s).

### 4.4 Document Findings

Create post-deployment report:

```markdown
## Post-Deployment Analysis

**Period:** 2026-06-19 to 2026-06-30

**Fleet Stats:**
- Total workspaces: N
- Average uptime: X%
- Memory baseline: Y MB
- CPU baseline: Z%

**Drift Detection:**
- Events per workspace/day: A
- Most common drift type: B
- Healing success rate: C%

**Profile Distribution:**
- fullstack: X%
- python: Y%
- monorepo: Z%
- ml: A%
- balanced: B%

**Optimizations Applied:**
- Cache TTL: 5min → [tuned value]
- Scan interval: 10s → [tuned value]

**Recommendations for Next Phase:**
- ...
```

---

## Rollback Procedures

### Quick Rollback (If Critical Issue)

```bash
# On affected workspace(s)
docker-compose down
git checkout docs/migration-2026-05-04~1  # Go back 1 commit
docker-compose up -d

# Verify
curl http://localhost:8000/exclusion/health
```

### Full Rollback (Fleet-wide)

```bash
# Stop ExclusionAgent across all workspaces
for ws in $(cat /opt/workspace-list.txt); do
  ssh user@${ws}.internal "docker-compose down"
done

# Revert all workspaces to previous release
for ws in $(cat /opt/workspace-list.txt); do
  ssh user@${ws}.internal "cd /opt/cic && git checkout docs/migration-2026-05-04~1 && docker-compose up -d"
done

# Verify fleet health
./monitor-canary.sh
```

---

## Troubleshooting

### ExclusionAgent Not Starting

```bash
# Check logs
docker-compose logs chat-agent | grep -A 5 "Initialization failed"

# Common causes:
# 1. TorqueQuery not healthy
#    → Verify TorqueQuery is running: curl http://localhost:9000/health
# 2. Profiles directory missing
#    → Check: ls -la /home/user/castironforge/profiles/
# 3. Port 8000 already in use
#    → Kill: lsof -ti:8000 | xargs kill -9
```

### High Memory Usage (>250MB)

```bash
# Reduce timeline max snapshots
# profiles/ingestion-timeline.ts line 52
private maxSnapshots: number = 500;  // Was 1000

# Reduce scan interval
# profiles/self-healing-engine.ts line 66
scanInterval: 10000  // Change to 30000 (30 seconds)
```

### Drift Detection Not Working

```bash
# Check if fs.watch is available
docker exec cic-chat-agent node -e "console.log(require('fs').watch ? 'available' : 'unavailable')"

# If unavailable, polling will be used instead (5 min intervals)
# Check logs for: "fs.watch not available, using polling only"
```

### TorqueQuery Sync Failures

```bash
# Check TorqueQuery health
curl http://localhost:9000/health

# Check filter delta computation
curl http://localhost:8000/exclusion/filters | jq '.exclude | length'

# If filters not changing, may indicate no drift or sync working correctly
```

---

## Support & Escalation

**For deployment issues:**
1. Check this guide's troubleshooting section
2. Review chat-agent logs: `docker-compose logs chat-agent -f`
3. Contact DevOps team with: timestamp, workspace, error from logs

**For architecture/design questions:**
- See `CIC_INTEGRATION_GUIDE.md`
- See `EXCLUSION_PROFILE_GUIDE.md`

**For post-deployment tuning:**
- See Phase 4 (Optimization & Tuning)
- Baseline metrics available in `/var/log/cic/exclusion-baseline.json`

---

**Next Steps:**
1. Review [Integration Guide](./CIC_INTEGRATION_GUIDE.md)
2. Review [API Reference](./EXCLUSION_API_REFERENCE.md)
3. Review [Operator Runbook](./EXCLUSION_OPERATOR_RUNBOOK.md)
