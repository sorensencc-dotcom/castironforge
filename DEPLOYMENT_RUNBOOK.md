# CIC Phase 26 Master Deployment Runbook

**Status:** 🚀 Production Ready  
**Timeline:** 3 days (Phases 1-5)  
**Owner:** DevOps / Platform / Agent teams (parallel execution)  

---

## Executive Summary

Deploy deterministic code search infrastructure (TorqueQuery Phase 26) enabling agents to ground reasoning in verified code.

**What you'll have at the end:**
- Real-time code indexing watching all repos
- Deterministic hybrid search (keyword + semantic)
- All agents grounded (zero hallucinations)
- Full observability and error recovery
- Production-ready infrastructure

**Time investment:** 3 days (mostly waiting for services to start)

---

## Prerequisites

**Infrastructure:**
- Docker and Docker Compose installed
- 4+ CPU cores, 8+ GB RAM
- 50+ GB free disk space

**Code:**
- Branch: `claude/typesense-code-indexer-9ilra0` checked out
- All submodules initialized
- Node 20.x installed

**Documentation:**
- All 15 guides available in repo root
- Checklists printed or in tracking system

---

## Quick Start (TL;DR)

```bash
# Day 1: Start services
docker compose up -d typesense typesense-indexer search-api \
  torquequery-embeddings torquequery-gateway

# Verify
curl http://localhost:8108/health    # Typesense
curl http://localhost:5050/health    # Search API
curl http://localhost:5053/health    # Embeddings
curl http://localhost:5051/health    # Gateway
curl http://localhost:8000/health    # chat-agent

# Day 2: Update agents
# Import callTool and implement grounding pattern in each agent
# See PHASE4_AGENT_PATTERNS.md for template

# Day 3: Validate
npx ts-node test-grounding.ts        # Verify grounding
npx ts-node test-tools.ts            # Verify tools
# Run full validation from PHASE5_VALIDATION.md
```

---

## Day 1: Infrastructure Deployment

### Timeline: 4-5 hours

### Phase 1: Start Indexer Stack (9:00 AM - 10:30 AM)

**Owner:** DevOps  
**Duration:** 1.5 hours

```bash
# 1. Start Typesense
docker compose up -d typesense
sleep 10

# 2. Verify Typesense
curl -H "X-TYPESENSE-API-KEY: dev-key" http://localhost:8108/health
# Expected: {"ok": true}

# 3. Start Indexer
docker compose up -d typesense-indexer
sleep 5

# 4. Monitor indexing
docker logs -f cic-indexer

# Expected output:
# Watcher started for repo: castironforge
# ADD src/agents/warmPoolAgent.ts
# ✓ Indexed: castironforge/src/agents/warmPoolAgent.ts
# ... (hundreds of files)

# 5. Verify documents indexed
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*" | \
  jq '.found'
# Expected: > 100 documents
```

**Sign-off:**
- [ ] Typesense responds to health check
- [ ] Indexer running (logs show file changes)
- [ ] > 100 documents indexed
- [ ] Typesense web UI accessible (if enabled)

---

### Phase 2: Wire TorqueQuery (10:30 AM - 1:30 PM)

**Owner:** DevOps  
**Duration:** 3 hours

```bash
# 1. Start Search API
docker compose up -d search-api
sleep 5

# Verify
curl http://localhost:5050/health
curl "http://localhost:5050/search?q=WarmPoolManager"
# Expected: > 0 results

# 2. Start Embeddings Engine
docker compose up -d torquequery-embeddings
sleep 5

# Verify
curl http://localhost:5053/health
curl -X POST http://localhost:5053/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}'
# Expected: 768-dimensional vector

# 3. Start API Gateway
docker compose up -d torquequery-gateway
sleep 5

# Verify all three modes
curl "http://localhost:5051/keyword?q=spawn"
curl "http://localhost:5051/semantic?q=browser+spawning"
curl "http://localhost:5051/hybrid?q=WarmPoolManager"
# Expected: Results from each mode
```

**Sign-off:**
- [ ] Search API on :5050 (>0 results)
- [ ] Embeddings on :5053 (vectors produced)
- [ ] Gateway on :5051 (/keyword, /semantic, /hybrid work)
- [ ] Performance benchmarks met (see PHASE5_VALIDATION.md)

---

### Phase 3: Verify Full Pipeline (1:30 PM - 2:30 PM)

**Owner:** DevOps + QA  
**Duration:** 1 hour

**Run the integration test script:**

```bash
cd chat-agent
npm install

# Test 1: Typesense has indexed
npx ts-node -e "
  const fetch = require('node-fetch');
  fetch('http://localhost:8108/collections/code_files/documents/search?q=*', {
    headers: { 'X-TYPESENSE-API-KEY': 'dev-key' }
  }).then(r => r.json()).then(d => console.log('Indexed:', d.found));
"

# Test 2: Search API works
npx ts-node -e "
  const fetch = require('node-fetch');
  fetch('http://localhost:5050/search?q=warmPool')
    .then(r => r.json()).then(d => console.log('Found:', d.count));
"

# Test 3: Gateway works
npx ts-node -e "
  const fetch = require('node-fetch');
  fetch('http://localhost:5051/hybrid?q=warmPool')
    .then(r => r.json()).then(d => console.log('Hybrid:', d.results.length));
"
```

**Expected output:**
```
Indexed: 847
Found: 12
Hybrid: 12
```

**Sign-off:**
- [ ] All services running (ps aux | grep cic)
- [ ] Typesense has > 100 documents
- [ ] All search modes return results
- [ ] No errors in logs

---

## Day 2: Agent Integration

### Timeline: 4-6 hours

### Phase 4: Update Agents with Grounding (9:00 AM - 12:30 PM)

**Owner:** Agent team  
**Duration:** 3-4 hours

**For each agent in `chat-agent/src/agents/`:**

1. **Add imports:**
```typescript
import { callTool } from "../tools/registry.js";
```

2. **Add response interface:**
```typescript
export interface MyAgentResponse {
  grounded: boolean;  // ← Required
  file?: string;
  content?: string;
  explanation?: string;
  error?: string;
}
```

3. **Implement grounding pattern:**
```typescript
export async function myAgentHandle(query: Query): Promise<MyAgentResponse> {
  try {
    // Step 1: Query for facts
    const hits = await callTool("torque_query", query.text, { mode: "hybrid" });

    // Step 2: Verify grounding
    if (hits.length === 0) {
      return { grounded: false, error: "Not found" };
    }

    // Step 3: Extract evidence
    const file = hits[0];

    // Step 4: Answer with confidence
    const explanation = `Found in ${file.path}`;

    // Step 5: Return grounded response
    return { grounded: true, file: file.path, explanation };
  } catch (err) {
    return { grounded: false, error: String(err) };
  }
}
```

**Agents to update:**
- [ ] warmPoolAgent.ts
- [ ] adapterAgent.ts
- [ ] [others]

**Reference:** PHASE4_AGENT_PATTERNS.md (complete template + examples)

**Sign-off:**
- [ ] All agents updated
- [ ] All agents return grounded: true/false
- [ ] No TypeScript errors: `npm run type-check`

---

### Phase 5: Test Agent Grounding (12:30 PM - 2:30 PM)

**Owner:** Agent team + QA  
**Duration:** 2 hours

**Create test file:**

```bash
# test-grounding-full.ts
cd chat-agent
cat > test-grounding-full.ts << 'EOF'
import { warmPoolAgentHandle } from "./src/agents/warmPoolAgent.js";
import { adapterAgentHandle } from "./src/agents/adapterAgent.js";

async function test() {
  console.log("Testing agent grounding...\n");

  // Test 1: WarmPool Agent
  const result1 = await warmPoolAgentHandle({ action: "explain" });
  console.log("WarmPool Agent:");
  console.log("  Grounded:", result1.grounded);
  console.log("  File:", result1.file);
  console.log("  Explanation:", result1.explanation?.substring(0, 100));

  // Test 2: Adapter Agent  
  const result2 = await adapterAgentHandle({ action: "explain" });
  console.log("\nAdapter Agent:");
  console.log("  Grounded:", result2.grounded);
  console.log("  File:", result2.file);

  // Verify
  if (!result1.grounded || !result2.grounded) {
    console.error("\n✗ Agents not properly grounded!");
    process.exit(1);
  }
  console.log("\n✓ All agents grounded!");
}

test().catch(console.error);
EOF

npx ts-node test-grounding-full.ts
```

**Expected output:**
```
Testing agent grounding...

WarmPool Agent:
  Grounded: true
  File: src/agents/WarmPoolManager.ts
  Explanation: WarmPoolManager is defined in src/agents/WarmPoolManager.ts...

Adapter Agent:
  Grounded: true
  File: src/adapters/cloakBrowserAdapter.ts

✓ All agents grounded!
```

**Sign-off:**
- [ ] All agents return grounded: true
- [ ] File paths are verified
- [ ] No hallucinations detected
- [ ] Response times acceptable (< 2s)

---

## Day 3: Validation & Sign-Off

### Timeline: 4-6 hours

### Phase 5: Complete Validation (9:00 AM - 3:00 PM)

**Owner:** QA / Platform  
**Duration:** 4-6 hours

**Run validation checklist from PHASE5_VALIDATION.md:**

```bash
# 5.1 Service Health
curl http://localhost:8108/health    # Typesense
curl http://localhost:5050/health    # Search API
curl http://localhost:5053/health    # Embeddings
curl http://localhost:5051/health    # Gateway
curl http://localhost:8000/health    # chat-agent

# 5.2 Integration (data flows correctly)
# - Indexer → Typesense ✓
# - Typesense → Search API ✓
# - Search API → Gateway ✓
# - Gateway → Agents ✓

# 5.3 Performance (latency benchmarks)
time curl "http://localhost:5051/keyword?q=spawn"    # < 20ms
time curl "http://localhost:5051/semantic?q=spawn"   # < 100ms
time curl "http://localhost:5051/hybrid?q=spawn"     # < 150ms

# 5.4 Grounding (all agents ground)
npx ts-node test-grounding-full.ts                    # All true

# 5.5 Error handling (graceful degradation)
docker stop cic-typesense
sleep 2
curl http://localhost:5051/health                    # Should show degraded
docker start cic-typesense

# 5.6 Data quality (index stats)
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*" | \
  jq '.found'                                        # Should be > 100

# 5.7 Documentation (all guides present)
ls -1 *.md | grep -i "phase\|agent\|grounding\|integration"

# 5.8 Deployment ready
# - docker-compose.yml configured ✓
# - All services have health checks ✓
# - All services have restart policies ✓
# - Logging configured ✓
# - Monitoring configured ✓
```

**Sign-off Checklist:**
- [ ] All services healthy (6/6)
- [ ] Integration points functional (4/4)
- [ ] Performance targets met (4/4)
- [ ] All agents grounded (N/N)
- [ ] Error handling tested
- [ ] Data quality verified
- [ ] Documentation complete (15 guides)
- [ ] Deployment ready

---

## Post-Deployment

### Ongoing Operations

**Daily Checks:**
```bash
# Service health
docker ps | grep cic-

# Error rate
docker logs cic-indexer | grep -i error | tail -5

# Index size
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  http://localhost:8108/collections/code_files | jq '.num_documents'
```

**Weekly Checks:**
- Index drift detection (stale documents)
- Performance trending
- Error pattern analysis
- Capacity planning

**Monthly Checks:**
- Full index consistency
- Schema optimization
- Documentation updates
- Performance optimization

### Monitoring

**Metrics to track:**
- Service health (all 6 services)
- Query latency (by mode: keyword, semantic, hybrid)
- Agent grounding rate (% grounded: true)
- Error rate (by type)
- Index size and document count

**Alerts to configure:**
- Any service down > 5 minutes
- Error rate > 1%
- Query latency > 2x normal
- Agent grounding rate < 95%

### Escalation

**If something breaks:**

1. **Typesense down:**
   - Check docker: `docker ps | grep typesense`
   - Restart: `docker restart cic-typesense`
   - Check logs: `docker logs cic-typesense`

2. **Indexing stuck:**
   - Check indexer: `docker logs cic-indexer`
   - Verify Typesense healthy: `curl http://localhost:8108/health`
   - Restart: `docker restart cic-indexer`

3. **Search API errors:**
   - Check Typesense connection: `curl http://localhost:8108/health`
   - Restart: `docker restart cic-search-api`
   - Check logs: `docker logs cic-search-api`

4. **Agent grounding broken:**
   - Check gateway: `curl http://localhost:5051/health`
   - Check Search API: `curl http://localhost:5050/health`
   - Verify agents updated: `grep -r "callTool" src/agents/`
   - Re-run grounding test: `npx ts-node test-grounding-full.ts`

5. **Performance degradation:**
   - Check resource usage: `docker stats`
   - Check index size: `curl http://localhost:8108/collections/code_files`
   - Profile queries: Add timing metrics
   - Optimize: Tune batch sizes or parallel workers

---

## Success Criteria

✅ **Infrastructure Deployed**
- All 6 services running
- All health checks passing
- All services have restart policies
- Monitoring configured

✅ **Agent Grounding Enabled**
- All agents return grounded: true/false
- All grounded responses have verified file paths
- Zero hallucinations detected
- Agent response times < 2s

✅ **Operations Ready**
- Monitoring dashboard live
- Alerts configured
- Runbooks written
- On-call procedures established

✅ **Documentation Complete**
- All 15 guides in repository
- Quick-start guide available
- Troubleshooting documented
- Deployment procedures tested

---

## Key References

| Guide | Purpose | Duration |
|-------|---------|----------|
| AGENT_GROUNDING_CHECKLIST.md | 6-phase high-level plan | 2-3 days |
| PHASE1-5 docs | Step-by-step implementation | Per phase |
| PHASE5_VALIDATION.md | Comprehensive testing | 4-6 hours |
| AGENT_TOOLING_GUIDE.md | Agent development patterns | Reference |
| CIC_INDEXER_SERVICE_MANIFEST.md | Service operations | Reference |

---

## Timeline Summary

```
Day 1 (Fri): Infrastructure
├─ Morning (1.5h): Phase 1 — Typesense + Indexer
├─ Afternoon (3h): Phase 2 — TorqueQuery wiring
└─ Evening (1h): Phase 3 — Verify pipeline

Day 2 (Mon): Agent Integration
├─ Morning (3-4h): Phase 4 — Update agents
└─ Afternoon (2h): Phase 5 — Test grounding

Day 3 (Tue): Validation
└─ Full Day (4-6h): Phase 5 — Full stack validation + sign-off
```

**Total time:** ~16-18 hours spread over 3 days

---

## Emergency Rollback

If deployment fails at any point:

1. **Stop all services:**
   ```bash
   docker compose down
   ```

2. **Check logs:**
   ```bash
   docker logs cic-typesense
   docker logs cic-indexer
   docker logs cic-search-api
   docker logs cic-embeddings
   docker logs cic-gateway
   ```

3. **Investigate:**
   - Network connectivity
   - Disk space
   - Resource limits
   - Configuration

4. **Re-deploy:**
   ```bash
   docker compose up -d
   ```

---

## Getting Help

**If stuck on:**
- **Architecture:** See CIC_PHASE26_ARCHITECTURE.md
- **APIs:** See TORQUEQUERY_PHASE26.md
- **Agents:** See AGENT_TOOLING_GUIDE.md
- **Deployment:** See individual Phase guides
- **Troubleshooting:** See PHASE5_VALIDATION.md

**Contact:**
- Platform team: #cic-indexer Slack
- DevOps: pagerduty oncall
- Agent team: @agent-dev

---

## Sign-Off

**Day 1 Sign-Off (Infra Ready):**
- [ ] DevOps: All services deployed and healthy
- [ ] QA: All integration tests passing
- [ ] Platform: Monitoring configured

**Day 2 Sign-Off (Agents Ready):**
- [ ] Agent team: All agents updated and grounded
- [ ] QA: All grounding tests passing
- [ ] DevOps: Performance targets met

**Day 3 Sign-Off (Production Ready):**
- [ ] QA: Full validation checklist complete
- [ ] Platform: All runbooks and docs in place
- [ ] Engineering lead: Approved for production

---

**Status:** 🚀 Ready to Deploy

**Next:** Execute Day 1 Phase 1 (Start Typesense + Indexer)

---

**Questions?** See the 15 guides in repo root or contact platform team.
