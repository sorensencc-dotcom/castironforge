# Phase 5: Full Stack Validation (Day 2 Evening / Day 3)

**Goal:** Ensure all Phase 26 components work end-to-end without errors.

**Timeline:** 4-6 hours (mostly waiting + testing).

**Owner:** QA / Platform team.

---

## Pre-Validation Checklist

**All services deployed and running:**
- [ ] Typesense (:8108) — health check OK
- [ ] Typesense Indexer (headless) — watching files
- [ ] Search API (:5050) — responding to queries
- [ ] Embeddings Engine (:5053) — computing vectors
- [ ] API Gateway (:5051) — routing searches
- [ ] chat-agent (:8000) — API available

**All documentation in place:**
- [ ] 13 guides created (architecture, integration, deployment, patterns)
- [ ] README files updated with agent grounding info
- [ ] Troubleshooting guides available

**All agents updated:**
- [ ] All agents import callTool
- [ ] All agents query before answering
- [ ] All agents return grounded: true/false

---

## 5.1: Service Health Validation

Verify all services are healthy and responsive.

### Typesense Health

```bash
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  http://localhost:8108/health

# Expected:
# {"ok": true}

curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*&per_page=1"

# Expected:
# {"found": 1247, "hits": [...]}  ← Should have > 100 documents
```

**Checklist:**
- [ ] Typesense responds to health check
- [ ] Collection code_files exists
- [ ] Index has > 100 documents

### Search API Health

```bash
curl http://localhost:5050/health

# Expected:
# {"status": "ok", "typesense": "healthy"}

curl "http://localhost:5050/search?q=spawn&per_page=5"

# Expected:
# {"query": "spawn", "count": 42, "results": [...]}
```

**Checklist:**
- [ ] Search API responds to health check
- [ ] /search endpoint works
- [ ] Returns results for valid queries

### Embeddings Engine Health

```bash
curl http://localhost:5053/health

# Expected:
# {"status": "ok"}

curl -X POST http://localhost:5053/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}'

# Expected:
# {"text": "test", "embedding": [...], "dimension": 768, "cached": false}
```

**Checklist:**
- [ ] Embeddings responds to health check
- [ ] POST /embed works
- [ ] Returns vectors with correct dimension

### API Gateway Health

```bash
curl http://localhost:5051/health

# Expected:
# {"status": "ok", "uptime_seconds": 3600}

curl "http://localhost:5051/keyword?q=spawn"
curl "http://localhost:5051/semantic?q=browser+spawning"
curl "http://localhost:5051/hybrid?q=spawn"

# All should return results
```

**Checklist:**
- [ ] Gateway responds to health check
- [ ] All three search modes work
- [ ] Results returned for each mode

### Chat Agent API Health

```bash
curl http://localhost:8000/health

# Expected:
# {"status": "ok"}

curl -X POST http://localhost:8000/agents/warmpool \
  -H "Content-Type: application/json" \
  -d '{"action": "explain"}'

# Expected:
# {"grounded": true, "file": "...", "explanation": "..."}
```

**Checklist:**
- [ ] chat-agent responds to health check
- [ ] Agents accessible via API
- [ ] Agent responses include grounded field

---

## 5.2: Integration Validation

Verify data flows through pipeline correctly.

### Indexer → Typesense

```bash
# 1. Verify files are being indexed
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*" | \
  jq '.found'

# Expected: > 100

# 2. Verify metadata extraction
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*&facet_by=phase,repo" | \
  jq '.facet_counts'

# Expected:
# {
#   "phase": {"26": 847, "27": 123},
#   "repo": {"castironforge": 970}
# }

# 3. Verify AST extraction
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=WarmPoolManager" | \
  jq '.hits[0].document.symbols'

# Expected: ["WarmPoolManager", "hydrate", "spawn", ...]
```

**Checklist:**
- [ ] Typesense has indexed documents
- [ ] Facets populated (phase, repo, language)
- [ ] Symbols, functions, classes extracted

### Typesense → Search API → Gateway

```bash
# 1. Search API queries Typesense
curl "http://localhost:5050/search?q=WarmPoolManager" | jq '.count'

# Expected: > 0

# 2. Gateway routes to Search API (keyword mode)
curl "http://localhost:5051/keyword?q=WarmPoolManager" | jq '.results[0].path'

# Expected: "src/agents/WarmPoolManager.ts"

# 3. Gateway routes to Embeddings (semantic mode)
curl "http://localhost:5051/semantic?q=how+does+pooling+work" | jq '.results | length'

# Expected: > 0

# 4. Gateway merges both (hybrid mode)
curl "http://localhost:5051/hybrid?q=WarmPoolManager" | jq '.results[0].hybridScore'

# Expected: 0.5-1.0 (confidence score)
```

**Checklist:**
- [ ] Search API finds results via Typesense
- [ ] Gateway keyword mode works
- [ ] Gateway semantic mode works
- [ ] Gateway hybrid mode merges results with scores

### Gateway → Agent Tools

```bash
# 1. Tool registry can call gateway
npx ts-node -e "
  import { callTool } from './src/tools/registry.js';
  callTool('torque_query', 'WarmPoolManager', { mode: 'hybrid' })
    .then(r => console.log('Found:', r.length, 'results'))
    .catch(e => console.error('Error:', e.message));
"

# Expected: "Found: 2 results"

# 2. Agents can query
npx ts-node -e "
  import { warmPoolAgentHandle } from './src/agents/warmPoolAgent.js';
  warmPoolAgentHandle({ action: 'explain' })
    .then(r => console.log('Grounded:', r.grounded, 'File:', r.file))
    .catch(e => console.error('Error:', e.message));
"

# Expected: "Grounded: true File: src/agents/WarmPoolManager.ts"

# 3. API endpoint works
curl -X POST http://localhost:8000/agents/warmpool \
  -H "Content-Type: application/json" \
  -d '{"action":"explain"}' | jq '.grounded'

# Expected: true
```

**Checklist:**
- [ ] Tool registry callable
- [ ] Agents callable with grounding
- [ ] API endpoint accessible

---

## 5.3: Performance Validation

Verify performance targets are met.

### Latency Testing

```bash
# Keyword search (target: < 20ms)
for i in {1..10}; do
  time curl -s "http://localhost:5051/keyword?q=spawn" > /dev/null
done
# Real: 5-15ms ✓

# Semantic search (target: < 100ms)
for i in {1..5}; do
  time curl -s "http://localhost:5051/semantic?q=how+does+spawning+work" > /dev/null
done
# Real: 50-80ms ✓

# Hybrid search (target: < 150ms)
for i in {1..5}; do
  time curl -s "http://localhost:5051/hybrid?q=WarmPoolManager" > /dev/null
done
# Real: 100-120ms ✓

# Agent query (target: < 2s)
for i in {1..3}; do
  time curl -s -X POST http://localhost:8000/agents/warmpool \
    -H "Content-Type: application/json" \
    -d '{"action":"explain"}' > /dev/null
done
# Real: 200-400ms ✓
```

**Checklist:**
- [ ] Keyword search < 20ms
- [ ] Semantic search < 100ms
- [ ] Hybrid search < 150ms
- [ ] Agent queries < 2s

### Throughput Testing

```bash
# Test concurrent queries
ab -n 100 -c 10 "http://localhost:5051/keyword?q=spawn"

# Expected:
# Requests per second: > 50 req/s
# Failed requests: 0
# Average latency: < 200ms
```

**Checklist:**
- [ ] Handles 10+ concurrent requests
- [ ] No failures under load
- [ ] Latency acceptable

---

## 5.4: Grounding Validation

Verify all agents ground properly.

### Agent Grounding Test

```bash
# Test file: test-grounding-full.ts
import { warmPoolAgentHandle } from "./src/agents/warmPoolAgent.js";
import { adapterAgentHandle } from "./src/agents/adapterAgent.js";

async function validateGrounding() {
  console.log("Validating agent grounding...\n");

  const tests = [
    { name: "WarmPool", handler: warmPoolAgentHandle, query: { action: "explain" } },
    { name: "Adapter", handler: adapterAgentHandle, query: { action: "explain" } }
  ];

  for (const test of tests) {
    console.log(`Testing ${test.name}Agent...`);
    try {
      const result = await test.handler(test.query);

      // Validation rules
      if (result.grounded === undefined) {
        throw new Error("Missing grounded field");
      }

      if (result.grounded === false && !result.error) {
        throw new Error("grounded: false should have error message");
      }

      if (result.grounded === true) {
        if (!result.file) throw new Error("grounded: true should have file path");
        if (!result.file.includes(".ts") && !result.file.includes(".js")) {
          throw new Error(`Invalid file path: ${result.file}`);
        }
        console.log(`  ✓ Grounded: ${result.file}`);
        console.log(`  ✓ Confidence: ${result.confidence ?? "N/A"}`);
      } else {
        console.log(`  ✓ Correctly ungrounded: ${result.error}`);
      }
    } catch (err) {
      console.error(`  ✗ Error: ${err}`);
      process.exit(1);
    }
  }

  console.log("\n✓ All agents grounded correctly!");
}

validateGrounding().catch(console.error);
```

Run:
```bash
npx ts-node test-grounding-full.ts
```

**Expected:**
```
Validating agent grounding...

Testing WarmPoolAgent...
  ✓ Grounded: src/agents/WarmPoolManager.ts
  ✓ Confidence: 0.892

Testing AdapterAgent...
  ✓ Grounded: src/adapters/cloakBrowserAdapter.ts
  ✓ Confidence: 0.876

✓ All agents grounded correctly!
```

**Checklist:**
- [ ] All agents return grounded: true/false
- [ ] grounded: true has valid file paths
- [ ] grounded: false has error messages
- [ ] Confidence scores present
- [ ] No hallucinations detected

---

## 5.5: Error Handling Validation

Verify systems degrade gracefully.

### Test Service Failures

**Simulate Typesense down:**
```bash
docker stop cic-typesense
sleep 2

# Search API should fail
curl http://localhost:5050/search?q=spawn
# Expected: Error (connection refused)

# Gateway should show degraded
curl http://localhost:5051/health
# Expected: {"status": "degraded", "typesense": "unhealthy"}

# Restart
docker start cic-typesense
sleep 5

# Services should recover
curl http://localhost:5051/keyword?q=spawn
# Expected: Results (recovered)
```

**Simulate Search API down:**
```bash
docker stop cic-search-api
sleep 2

# Gateway keyword mode should fail
curl http://localhost:5051/keyword?q=spawn
# Expected: Error

# Semantic mode should still work
curl http://localhost:5051/semantic?q=spawn
# Expected: Results

# Hybrid mode should return semantic only
curl http://localhost:5051/hybrid?q=spawn
# Expected: Results (degraded)

# Restart
docker start cic-search-api
sleep 5

# Full hybrid should work
curl http://localhost:5051/hybrid?q=spawn
# Expected: Results (recovered)
```

**Checklist:**
- [ ] Services fail gracefully
- [ ] Error messages are clear
- [ ] System recovers when services restart
- [ ] No cascading failures

---

## 5.6: Data Quality Validation

Verify indexed data is correct and complete.

### Index Statistics

```bash
# Total documents
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*" | \
  jq '.found'
# Expected: > 100

# Check facet distribution
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*&facet_by=language,phase,repo" | \
  jq '.facet_counts'

# Expected:
# {
#   "language": {
#     "typescript": 500,
#     "javascript": 300,
#     ...
#   },
#   "phase": {
#     "26": 800,
#     "27": 100,
#     ...
#   },
#   "repo": {
#     "castironforge": 950,
#     ...
#   }
# }

# Verify no stale documents
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*" | \
  jq '.hits[] | select(.document.modified < now - 86400) | length'
# Expected: 0 (no documents older than 1 day)
```

**Checklist:**
- [ ] Index has correct document count
- [ ] Facets properly populated
- [ ] No obviously stale documents
- [ ] Language distribution reasonable

### Search Quality

```bash
# Keyword search accuracy
curl "http://localhost:5051/keyword?q=WarmPoolManager" | jq '.results[] | .path' | head -5
# Expected: All results mention WarmPoolManager

# Semantic search relevance
curl "http://localhost:5051/semantic?q=browser+pooling" | jq '.results[] | .path' | head -5
# Expected: Results related to pool, browser, instances

# Hybrid score distribution
curl "http://localhost:5051/hybrid?q=spawn" | \
  jq '.results[] | .hybridScore' | sort -nr | head -5
# Expected: Scores 0.5-1.0, well-distributed
```

**Checklist:**
- [ ] Keyword results relevant to query
- [ ] Semantic results conceptually related
- [ ] Hybrid scores reasonable (0.5-1.0)
- [ ] No obviously wrong results

---

## 5.7: Documentation Validation

Verify all documentation is complete and accurate.

### Documentation Checklist

- [ ] AGENT_GROUNDING_CHECKLIST.md — Complete 6-phase plan
- [ ] TORQUEQUERY_INDEXER_WIRING.md — Step-by-step wiring guide
- [ ] CIC_INDEXER_INTEGRATION_CHECKLIST.md — 10 subsystems mapped
- [ ] CIC_INDEXER_SERVICE_MANIFEST.md — Complete service spec
- [ ] CIC_PHASE26_INDEXER_MIGRATION_NOTES.md — Phase alignment
- [ ] PHASE2_TORQUEQUERY_WIRING.md — Service wiring guide
- [ ] PHASE3_AGENT_TOOLS.md — Tool registry integration
- [ ] PHASE4_AGENT_PATTERNS.md — Grounding pattern template
- [ ] PHASE5_VALIDATION.md — This validation guide
- [ ] README files — Updated with Phase 26 info
- [ ] AGENT_TOOLING_GUIDE.md — Developer guide
- [ ] CIC_PHASE26_ARCHITECTURE.md — Architecture diagram
- [ ] TORQUEQUERY_PHASE26.md — API reference

**Checklist:**
- [ ] All 13 guides present in repo
- [ ] No broken links between guides
- [ ] All code examples work
- [ ] All command examples tested
- [ ] Quick start section present in main docs

---

## 5.8: Deployment Checklist

Final pre-production checklist.

### Infrastructure

- [ ] Typesense cluster healthy (3+ nodes recommended for prod)
- [ ] Persistent volumes configured (typesense_data, indexer_cache)
- [ ] Network properly configured (cic-network)
- [ ] Resource limits set (CPU, memory)
- [ ] Health checks configured for all services

### Services

- [ ] All 5 services deployed and healthy
- [ ] All services have restart policies
- [ ] All services have logging configured
- [ ] All services monitored (Prometheus metrics)
- [ ] All services have graceful shutdown

### Code Quality

- [ ] No TypeScript errors: `npm run type-check`
- [ ] No lint errors: `npm run lint` (if configured)
- [ ] All tests passing: `npm test`
- [ ] Code coverage acceptable (> 70%)

### Security

- [ ] Typesense API key configured (not hardcoded)
- [ ] HTTPS enabled for production
- [ ] CORS configured appropriately
- [ ] No sensitive data in logs
- [ ] Rate limiting configured

### Monitoring

- [ ] Prometheus metrics exposed
- [ ] Dashboards created
- [ ] Alerts configured for:
  - [ ] Service down
  - [ ] High error rate
  - [ ] High latency
  - [ ] Index drift

### Runbooks

- [ ] Startup procedures documented
- [ ] Shutdown procedures documented
- [ ] Troubleshooting guide created
- [ ] Rollback procedures documented
- [ ] Incident response procedures defined

---

## 5.9: Sign-Off

### Validation Complete ✅

**Verified:**
- ✅ All services healthy
- ✅ All integration points functional
- ✅ Performance targets met
- ✅ All agents properly grounded
- ✅ Error handling working
- ✅ Data quality acceptable
- ✅ Documentation complete
- ✅ Deployment ready

**Ready for:**
- Production deployment
- Agent grounding enabled
- Phase 27 planning

---

## Phase 5 Success Criteria

✅ **Service Health**
- All 5 services running and healthy
- Health endpoints responding
- No errors in logs

✅ **Integration**
- Data flows correctly through pipeline
- All search modes working
- Agents query TorqueQuery successfully

✅ **Performance**
- Keyword search < 20ms
- Semantic search < 100ms
- Hybrid search < 150ms
- Agent queries < 2s
- Handles 10+ concurrent requests

✅ **Grounding**
- All agents return grounded: true/false
- All grounded responses have file paths
- File paths verified to exist
- Zero hallucinations

✅ **Documentation**
- 13 comprehensive guides complete
- Code examples tested
- Quick start available
- Troubleshooting included

✅ **Deployment Ready**
- All infrastructure configured
- All security measures in place
- All monitoring configured
- Runbooks written

---

**Timeline:** 4-6 hours total

**Owner:** QA / Platform team

**Approval:** Signed off by platform lead when all checklists complete

---

**Status after Phase 5:** 🚀 **PRODUCTION READY**

**Next Phase:** Ongoing operations + Phase 27 (Query Planner)
