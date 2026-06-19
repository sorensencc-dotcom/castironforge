# Balanced Exclusion Profile System — Rollout Plan

**Date:** 2026-06-19  
**Duration:** 8 calendar days (4 business days) + 4 weeks optimization  
**Release:** v1.0.0-production  

---

## Executive Summary

**Objective:** Deploy Balanced Exclusion Profile System to 100% of CIC workspaces

**Phases:**
1. **Phase 1 (Day 1):** Test workspace validation
2. **Phase 2 (Days 2-3):** Canary rollout (5-10% of fleet)
3. **Phase 3 (Days 4-7):** General availability (remaining 90-95%)
4. **Phase 4 (Weeks 2-4):** Optimization and tuning

**Success Criteria:**
- ≥95% of workspaces "online"
- Memory <150 MB (mean)
- CPU <8% (mean)
- <0.1% ERROR rate
- Zero data loss

**Risk Level:** Low (read-only system, auto-healing, easy rollback)

---

## Phase 1: Test Workspace (Day 1)

**Objective:** Validate ExclusionAgent in controlled environment

### Timeline

| Time | Task | Owner | Duration |
|------|------|-------|----------|
| 08:00 | Pre-deploy checklist | DevOps | 15 min |
| 08:15 | Deploy to test workspace | DevOps | 10 min |
| 08:30 | Health check | DevOps | 10 min |
| 08:45 | Trigger drift (manual test) | QA | 15 min |
| 09:00 | Verify drift detection | QA | 15 min |
| 09:15 | Monitor for 1 hour | DevOps | 60 min |
| 10:15 | Performance baseline | Eng | 30 min |
| 10:45 | Go/no-go decision | Leads | 15 min |

**Total Day 1: 4 hours (completed by 10:45 AM)**

### Validation Steps

**1. Deployment (08:15-08:30)**
```bash
cd /opt/test-workspace
git pull origin docs/migration-2026-05-04
docker-compose up --build -d
sleep 10
```

**2. Health Check (08:30-08:45)**
```bash
# Endpoint 1: Base health
curl http://localhost:8000/health | jq '{torque, ollama}'
# Expected: Both online

# Endpoint 2: ExclusionAgent health
curl http://localhost:8000/exclusion/health | jq '.status'
# Expected: "online"

# Endpoint 3: Filters
curl http://localhost:8000/exclusion/filters | jq '.profile'
# Expected: "fullstack" or similar
```

**3. Drift Trigger (08:45-09:15)**
```bash
# Add a Python file to trigger framework change
touch /opt/test-workspace/test_script.py

# Wait for scan cycle (5s) + healing (5s) + manifest update (10s) = 20s
sleep 20

# Verify drift was detected
curl http://localhost:8000/exclusion/health | jq '.driftEventsDetected'
# Expected: ≥1

# Verify in timeline
curl http://localhost:8000/exclusion/timeline?limit=1 | \
  jq '.entries[0].driftDetected'
# Expected: true

# Cleanup
rm /opt/test-workspace/test_script.py
```

**4. Monitoring (09:15-10:15)**
```bash
# Every 5 minutes, collect metrics
while true; do
  echo "$(date): $(curl -s http://localhost:8000/exclusion/health | jq -c '.')"
  sleep 300
done

# Check for errors
docker-compose logs chat-agent | grep -i "error" | wc -l
# Expected: 0
```

**5. Baseline Metrics (10:15-10:45)**
```bash
# Memory
docker stats cic-chat-agent --no-stream | awk '{print $7}'
# Expected: <100 MB

# CPU
docker stats cic-chat-agent --no-stream | awk '{print $3}'
# Expected: <3%

# Timeline size
curl http://localhost:8000/exclusion/health | jq '.timelineEntries'
# Expected: 30-50 entries (1 per 10s × 5 min sampling)

# Drift events
curl http://localhost:8000/exclusion/health | jq '.driftEventsDetected'
# Expected: 1 (from manual trigger)
```

### Success Criteria (Day 1)

- [ ] ExclusionAgent status = "online" for entire duration
- [ ] No ERROR logs in chat-agent
- [ ] Drift detection triggered and successful
- [ ] Memory <100 MB throughout
- [ ] CPU mean <3%
- [ ] All 4 endpoints responding (health, filters, timeline, diagnostics)
- [ ] No TorqueQuery connection errors

### Go/No-Go Decision (10:45 AM)

**Go Criteria:** All success criteria met
**No-Go Criteria:** Any of: (1) agent not online, (2) errors in logs, (3) drift detection failed, (4) memory >150 MB

If **Go**: Proceed to Phase 2
If **No-Go**: Investigate, fix, re-test

---

## Phase 2: Canary Rollout (Days 2-3)

**Objective:** Deploy to 5-10% of fleet, monitor for issues

### Workspace Selection

Select 5-10 diverse workspaces:
```bash
# Mix of profiles
- 2 fullstack (Node + React)
- 2 python (Django/FastAPI)
- 1 monorepo (Turborepo)
- 1 ml (PyTorch)
- 1-3 balanced (misc)
```

### Deployment Schedule (Day 2)

| Time | Workspace | Owner | Status |
|------|-----------|-------|--------|
| 09:00 | ws-fullstack-1 | DevOps | Deploy |
| 09:30 | ws-python-1 | DevOps | Deploy |
| 10:00 | ws-monorepo | DevOps | Deploy |
| 10:30 | ws-ml-1 | DevOps | Deploy |
| 11:00 | ws-fullstack-2 | DevOps | Deploy |
| 11:30 | ws-python-2 | DevOps | Deploy |
| 14:00 | ws-balanced-1 (if time) | DevOps | Deploy |

**Deployment command (per workspace):**
```bash
ssh user@${WS}.internal "cd /opt/cic && git pull && docker-compose up --build -d"
```

**Verify:**
```bash
for ws in ws-fullstack-1 ws-python-1 ws-monorepo ws-ml-1 ws-fullstack-2 ws-python-2; do
  STATUS=$(curl -s "http://${ws}.internal:8000/exclusion/health" | jq -r '.status')
  echo "$ws: $STATUS"
done
# Expected: all "online"
```

### Monitoring (Days 2-3)

**Continuous monitoring (every 5 min):**
```bash
#!/bin/bash
# monitor-canary.sh
WORKSPACES=("ws-fullstack-1" "ws-python-1" "ws-monorepo" "ws-ml-1" "ws-fullstack-2" "ws-python-2")

for ws in "${WORKSPACES[@]}"; do
  curl -s "http://${ws}.internal:8000/exclusion/health" | jq -c "{workspace: \"$ws\", status: .status, uptime_h: (.uptime/3600000|floor), drift: .driftEventsDetected}"
done
```

**Daily reports (end of day):**
```bash
# Per-workspace summary
for ws in "${WORKSPACES[@]}"; do
  echo "=== $ws ==="
  curl -s "http://${ws}.internal:8000/exclusion/diagnostics" | jq '{health: .health, profile: .manifest.name, timeline_len: .timeline_length}'
done
```

### Success Criteria (Canary)

For **each** workspace:
- [ ] Status = "online" for >12 hours
- [ ] Memory <150 MB (stable)
- [ ] CPU mean <8%
- [ ] No persistent ERROR logs
- [ ] ≥1 drift detection event (proves system active)

### Rollback Decision (Day 3 Morning)

**If ANY workspace fails criteria:**
1. Stop rollout
2. Revert failing workspace: `git checkout docs/migration-2026-05-04~1 && docker-compose up --build -d`
3. Investigate root cause
4. Fix issue in code or configuration
5. Re-test on original test workspace
6. Resume canary (or escalate to architects)

**If ALL workspaces pass:**
1. Review logs and metrics with team
2. Get sign-off from leads
3. Proceed to Phase 3

---

## Phase 3: General Availability (Days 4-7)

**Objective:** Deploy to remaining 90-95% of fleet

### Deployment Strategy

**Option A: Rolling deployment (recommended for fleet >50 workspaces)**
```bash
#!/bin/bash
# Deploy in batches of 10 workspaces per hour

WORKSPACES=$(cat /opt/all-workspaces.txt | grep -v "ws-fullstack-1\|ws-python-1\|...(canary workspaces)")

BATCH_SIZE=10
for ((i=0; i<${#WORKSPACES[@]}; i+=BATCH_SIZE)); do
  BATCH=("${WORKSPACES[@]:$i:$BATCH_SIZE}")
  
  echo "Deploying batch: ${BATCH[@]}"
  for ws in "${BATCH[@]}"; do
    ssh user@${ws}.internal "cd /opt/cic && git pull && docker-compose up --build -d" &
  done
  
  wait  # Wait for batch to complete
  sleep 300  # 5-minute delay between batches for monitoring
done
```

**Option B: Parallel deployment (faster, higher risk)**
```bash
# Deploy all at once
for ws in $(cat /opt/all-workspaces.txt); do
  ssh user@${ws}.internal "cd /opt/cic && git pull && docker-compose up --build -d" &
done
wait
```

### Monitoring (Days 4-7)

**Automated health check (every 2 minutes):**
```bash
#!/bin/bash
# fleet-health.sh

ONLINE=0
DEGRADED=0
OFFLINE=0

for ws in $(cat /opt/all-workspaces.txt); do
  STATUS=$(curl -s --max-time 5 "http://${ws}.internal:8000/exclusion/health" | jq -r '.status // "timeout"')
  
  case "$STATUS" in
    "online") ((ONLINE++)) ;;
    "degraded") ((DEGRADED++)) ;;
    *) ((OFFLINE++)) ;;
  esac
done

TOTAL=$((ONLINE + DEGRADED + OFFLINE))
HEALTH=$((ONLINE * 100 / TOTAL))

echo "Fleet Health: ${HEALTH}% (online: $ONLINE, degraded: $DEGRADED, offline: $OFFLINE)"

# Alert if health drops below 95%
if [ $HEALTH -lt 95 ]; then
  echo "ALERT: Fleet health below 95%"
  # Send alert (webhook, PagerDuty, etc.)
fi
```

**Metrics dashboard (update every 10 min):**
- Total workspaces: N
- Online: X (X/N %)
- Degraded: Y
- Offline: Z
- Median memory: A MB
- Median CPU: B %
- Median drift events/workspace: C

### Success Criteria (GA)

- [ ] ≥95% workspaces "online"
- [ ] <5% "degraded" (transient, auto-healing expected)
- [ ] <0.1% persistent "offline"
- [ ] Memory <150 MB (95th percentile)
- [ ] CPU <8% (mean)
- [ ] <0.1% ERROR rate in logs
- [ ] All workspaces reporting drift events (indicates activity)

### Production Sign-Off (Day 7)

Once criteria met:
```bash
# Tag release
git tag -a v1.0.0-production -m "Balanced Exclusion Profile System - Production GA"
git push origin v1.0.0-production

# Update runbooks
# Notify stakeholders
# Create incident log entry
# Update monitoring dashboards
```

---

## Phase 4: Optimization & Tuning (Weeks 2-4)

### Week 1 Baseline Collection (Days 7-14)

```bash
#!/bin/bash
# Collect comprehensive metrics

for ws in $(cat /opt/all-workspaces.txt); do
  echo "=== $ws ===" >> /backups/baseline-metrics.txt
  curl -s "http://${ws}.internal:8000/exclusion/diagnostics" >> /backups/baseline-metrics.txt
done
```

**Analyze:**
- Profile distribution
- Drift event frequency per workspace
- Memory and CPU baselines
- Filter change frequency
- Cache hit rates

### Tuning Decisions (Weeks 2-3)

Based on collected data:

**If drift detection too slow (>2min lag):**
```typescript
// profiles/self-healing-engine.ts
private fingerprintCacheTTL: number = 2 * 60 * 1000;  // Reduce to 2 min
```

**If drift detection too noisy (>5 events/hour):**
```typescript
// profiles/self-healing-engine.ts
private fingerprintCacheTTL: number = 10 * 60 * 1000; // Increase to 10 min
private scanInterval: number = 30000;  // Increase to 30 sec
```

**If memory pressure (>200MB):**
```typescript
// profiles/ingestion-timeline.ts
private maxSnapshots: number = 500;  // Reduce from 1000
```

**Deploy tuning changes:**
```bash
# Tag tuning release
git tag -a v1.0.1-tuned -m "Baseline tuning based on production metrics"
git push origin v1.0.1-tuned

# Deploy to fleet (rolling)
```

### Post-Deployment Report (Week 4)

```markdown
## Post-Deployment Analysis Report

**Period:** 2026-06-19 to 2026-07-17 (4 weeks)

### Execution Summary

| Phase | Duration | Workspaces | Success Rate |
|-------|----------|------------|--------------|
| Phase 1 (Test) | Day 1 | 1 | 100% |
| Phase 2 (Canary) | Days 2-3 | 7 | 100% |
| Phase 3 (GA) | Days 4-7 | 93 | 96% |
| Total | 8 days | 101 | 98% |

### Performance Metrics

**Memory:**
- Min: 45 MB
- Mean: 82 MB
- 95th percentile: 135 MB
- Max: 198 MB

**CPU:**
- Min: 0.5%
- Mean: 2.1%
- 95th percentile: 6.8%
- Max: 18.2%

**Uptime:**
- 99.8% (3 outages: 1 TQ restart, 2 auto-recovery)

### Drift Detection Analysis

- Events per workspace/day: 2.3 (mean)
- Most common type: framework_change (35%)
- Healing success rate: 99.4%
- False positives: <1%

### Profile Distribution

- fullstack: 62%
- python: 18%
- balanced: 12%
- monorepo: 5%
- ml: 3%

### Optimizations Applied

- Cache TTL tuned from 5min → 7min (reduced noise)
- Max snapshots reduced from 1000 → 750 (memory optimization)
- Scan interval kept at 5s (good balance)

### Recommendations for Future

1. Consider auto-scaling fingerprint cache TTL based on drift rate
2. Implement ML-based anomaly detection for "noisy" workspaces
3. Add metric persistence (Prometheus, Datadog)
4. Expand language whitelist based on observed files

### Issues Encountered & Resolution

| Issue | Root Cause | Resolution | Time to Fix |
|-------|-----------|-----------|------------|
| Workspace-3 memory spike | Timeline buffer at 1000 entries | Reduced maxSnapshots | 30 min |
| Workspace-8 degraded status | TQ outage (unrelated) | Auto-recovered | 5 min |
| High drift rate on ws-15 | Rapid code generation during CI | Tuned cache TTL | 15 min |

**Overall:** Deployment successful with <1% friction.
```

---

## Rollback Procedures

### Phase 1 Rollback

If test workspace fails:
```bash
cd /opt/test-workspace
docker-compose down
git checkout docs/migration-2026-05-04~1
docker-compose up -d
```

### Phase 2 Rollback (Individual Workspace)

```bash
for ws in ws-fullstack-1 ws-python-1 ws-monorepo; do
  ssh user@${ws}.internal "cd /opt/cic && git checkout docs/migration-2026-05-04~1 && docker-compose up --build -d"
done
```

### Phase 3 Rollback (Fleet-Wide)

```bash
for ws in $(cat /opt/all-workspaces.txt); do
  ssh user@${ws}.internal "cd /opt/cic && git checkout docs/migration-2026-05-04~1 && docker-compose up --build -d" &
done
wait

# Verify all rolled back
for ws in $(cat /opt/all-workspaces.txt); do
  curl -s "http://${ws}.internal:8000/exclusion/health" | jq -r '.status'
done
```

---

## Communication Plan

### Pre-Deployment (Day 0)

- [ ] Team sync: review plan, assign owners
- [ ] Stakeholder notification: expect deployment Day 1
- [ ] Monitoring setup: dashboards, alerts

### Phase 1 (Day 1)

- [ ] 08:00 — Start deployment
- [ ] 10:45 — Go/no-go decision communicated
- [ ] If **go**: proceed to Phase 2 (announcement)

### Phase 2 (Days 2-3)

- [ ] Daily standup: canary metrics, issues
- [ ] Day 3 morning: full team review, proceed/pivot decision

### Phase 3 (Days 4-7)

- [ ] Daily rollout status (% complete, health)
- [ ] Day 7: production sign-off

### Phase 4 (Weeks 2-4)

- [ ] Weekly reports on baseline metrics
- [ ] Final report (Week 4)

---

## Success Metrics

### Immediate (Day 7)
- ✓ 95%+ fleet online
- ✓ <0.1% error rate
- ✓ Zero data loss
- ✓ Full rollback tested

### Short-term (Week 4)
- ✓ Stable baseline metrics
- ✓ Tuning complete
- ✓ All operators trained
- ✓ Runbooks finalized

### Long-term (Month 1)
- ✓ Cost savings realized ($7.7k-15.2k/month)
- ✓ Ingestion 85-90% faster
- ✓ Zero production incidents
- ✓ <1% drift detection false-positive rate

---

## Next Steps

1. **Review Plan** with leadership
2. **Confirm Timeline** (Day 1 deployment date)
3. **Assign Owners** (DevOps, Eng, QA, Leads)
4. **Set up Monitoring** (dashboards, alerts)
5. **Prepare Runbooks** (operator reference)
6. **Proceed to Phase 1**

---

## Appendix: Pre-Deployment Checklist

- [ ] Code review complete (PR #19 approved)
- [ ] All tests passing
- [ ] Build working (docker-compose up successful)
- [ ] TorqueQuery ready (indices built)
- [ ] Monitoring dashboards prepared
- [ ] Alert rules configured
- [ ] Runbooks reviewed with operators
- [ ] Rollback procedures tested
- [ ] Communication plan finalized
- [ ] Stakeholders notified

**Signed off by:**
- [ ] Engineering Lead
- [ ] Platform Lead
- [ ] DevOps Lead
- [ ] Product Lead

---

**Next Steps:** [Deployment Guide](./DEPLOYMENT_GUIDE.md) | [Operator Runbook](./EXCLUSION_OPERATOR_RUNBOOK.md)
