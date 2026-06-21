# CIC Phase 26 Indexer Migration Notes

**Phase:** 26  
**Component:** Typesense Code Indexer  
**Status:** Ready for deployment  
**Timeline:** 2-3 weeks (indexing + validation + optimization)  

---

## Executive Summary

The Typesense Code Indexer is the deterministic code search foundation of CIC Phase 26. It enables:

- **Real-time code indexing:** Files indexed within seconds of change
- **Deterministic search:** Same query → same results (always)
- **Agent grounding:** Agents query verified code before answering (no hallucinations)
- **Evidence packets:** Every indexed item carries provenance (repo, phase, adapter, timestamp)
- **Structure-aware search:** AST-extracted symbols, imports, exports, call chains

**What's Enabled:**
- Phase 26: Runtime Orchestrator can ground decisions in verified code
- Phase 27: Query Planner can automatically select keyword vs semantic search
- Phase 28: Distributed indexing across multiple Typesense clusters

---

## Phase 26: The Code Search Tier

### CIC Phases 23-28 (Simplified)

```
Phase 23: Short-term Memory
Phase 24: Long-term Memory
Phase 25: Retrieval Indexes
Phase 26: TORQUEQUERY (INDEXER GOES HERE)
         ├─ Typesense Indexer (watch files, extract metadata)
         ├─ Typesense Index (keyword search, metadata facets)
         ├─ Qdrant Index (semantic vectors)
         ├─ API Gateway (unified /keyword /semantic /hybrid)
         └─ Runtime Orchestrator (ground decisions in code)
Phase 27: Query Planner (automatic strategy selection)
Phase 28: Distributed TorqueQuery (multi-node indexing)
```

### What the Indexer Unlocks

**For Agents:**
```typescript
// Before Phase 26: Agents guess
const answer = "WarmPoolManager is probably in pool.ts";

// After Phase 26: Agents query
const hits = await torque_query("WarmPoolManager");
const answer = hits.length > 0 
  ? `WarmPoolManager is in ${hits[0].path}` 
  : "Not found";
```

**For Runtime Orchestrator:**
```typescript
// Before Phase 26: Route agents blindly
const agent = selectAgent(userQuery);  // Guess based on keywords

// After Phase 26: Ground routing in code
const codeContext = await torque_query(userQuery);
const agent = selectAgent(userQuery, codeContext);  // Informed decision
```

**For Query Planner (Phase 27):**
```typescript
// Phase 27 will be able to do this:
// "Is this a structure query?" (symbols, imports) → keyword search
// "Is this a logic query?" (how does X work) → semantic search
// The indexer provides both indexes, Query Planner orchestrates
```

---

## Integration Path: Phases 23 → 26

### Phase 23-25: Memory and Retrieval (Pre-26)

The Memory Layer (Phases 23-25) normalizes and indexes evidence from the Ingestion Layer:

```
Ingestion Layer
    ↓
Evidence Packets (canonical form)
    ↓
Short-term Memory (Phase 23)
    ↓
Long-term Memory (Phase 24)
    ↓
Retrieval Indexes (Phase 25)
```

### Phase 26: TorqueQuery Indexer Joins

The Typesense Indexer subscribes to normalized documents from the Memory Layer:

```
Memory Layer (Phase 25)
    ↓ pushes normalized documents
    ↓
Typesense Indexer (Phase 26)
    ├─ Extract metadata (Phase tags, Adapters, TODOs)
    ├─ Parse AST (symbols, imports, exports, call chains)
    ├─ Upsert to Typesense (keyword index)
    └─ Upsert to Qdrant (semantic vectors)
    ↓
TorqueQuery API Gateway
    ├─ /keyword → Typesense
    ├─ /semantic → Qdrant
    └─ /hybrid → merged results
    ↓
Runtime Orchestrator (Phase 26)
    └─ Ground decisions in verified code
```

### Result: Deterministic Code Search

Same query **always** returns same results (no randomness, no hallucinations).

---

## What Gets Indexed (Data Model)

### Document Structure

Every indexed document has this shape:

```typescript
{
  id: "castironforge/src/agents/WarmPoolManager.ts",
  path: "src/agents/WarmPoolManager.ts",
  repo: "castironforge",
  language: "typescript",
  
  // File content
  content: "export class WarmPoolManager { ... }",
  
  // Extracted structure (AST)
  symbols: ["WarmPoolManager", "hydrate", "spawn", "destroy"],
  functions: ["hydrate", "spawn", "destroy"],
  classes: ["WarmPoolManager"],
  imports: ["puppeteer", "events"],
  exports: ["WarmPoolManager"],
  
  // Extracted metadata
  phase: "26",
  adapter: "WarmPoolManager",
  todos: ["TODO: add connection pooling", "TODO: handle browser crash"],
  
  // Provenance
  modified: 1718956800,      // Unix timestamp
  size: 4521,                // Bytes
  hash: "abc123...",         // SHA-256 of content
  
  // Searchable fields
  // Typesense creates full-text index on: content, symbols, functions, imports, todos
  // Typesense creates facet indexes on: repo, language, phase, adapter, modified, size
}
```

### What Comes From Where

| Field | Source | How | Example |
|-------|--------|-----|---------|
| `path` | File system | Direct from watcher | `src/agents/WarmPoolManager.ts` |
| `repo` | Config | From config per repo | `castironforge` |
| `language` | File extension | Map `.ts` → `typescript` | `typescript` |
| `content` | File system | Read entire file | `export class WarmPool...` |
| `symbols` | AST parser | Extract identifiers | `["WarmPoolManager", ...]` |
| `functions` | AST parser | Extract function declarations | `["hydrate", "spawn"]` |
| `classes` | AST parser | Extract class declarations | `["WarmPoolManager"]` |
| `imports` | AST parser | Extract import statements | `["puppeteer", "events"]` |
| `exports` | AST parser | Extract export statements | `["WarmPoolManager"]` |
| `phase` | Regex in content + config | Extract `@phase-26` tag or use config | `26` |
| `adapter` | Regex in content + config | Extract `@adapter:WarmPool` tag or use config | `WarmPoolManager` |
| `todos` | Regex in content | Extract `TODO` and `FIXME` comments | `["TODO: add pooling"]` |
| `modified` | File system | Last modified timestamp | `1718956800` |
| `size` | File system | File size in bytes | `4521` |
| `hash` | Content | SHA-256(content) for dedup | `abc123xyz...` |

---

## Indexing Timeline: What Gets Indexed When

### Immediate (On File Change)

1. File system event detected: ADD, CHANGE, DELETE (< 1ms)
2. Watcher queues event for processing (debounce 500ms)
3. After debounce: batch processing starts

### During Batch (100 documents at a time)

1. Read file from disk
2. Compute SHA-256 hash
3. Extract metadata (Phase tags, Adapters, TODOs) via regex
4. Parse AST (symbols, functions, classes, imports, exports)
5. Upsert document to Typesense
6. Upsert embeddings to Qdrant

### Timeline Per File

```
File changes
    ↓ (detected < 1ms)
Queued for batch
    ↓ (wait up to 5s or until batch full)
Batch processing starts
    ├─ Read file: 1-10ms
    ├─ Hash computation: 1-5ms
    ├─ Metadata extraction: 10-20ms
    ├─ AST parsing: 20-50ms
    ├─ Upsert to Typesense: 50-100ms
    ├─ Upsert to Qdrant: 50-100ms
    ↓ (total: 200-300ms per file)
Document indexed and searchable
```

**Result:** File indexed within 200-300ms after change (or 5 seconds after last change, whichever comes first).

---

## Indexer Inputs and Outputs

### Inputs

| Input | Source | Format | Example |
|-------|--------|--------|---------|
| Repository roots | Config | Array of paths | `["/code/castironforge", "/code/other"]` |
| Ignore patterns | Config | Glob patterns | `["node_modules/**", ".git/**"]` |
| Language mappings | Config | Extension → language | `{ ".ts": "typescript" }` |
| Phase tag | Config | Default phase per repo | `phase: "26"` |
| Adapter name | Config | Default adapter per repo | `adapter: "WarmPoolManager"` |
| File content | File system | Raw bytes | Raw TypeScript/JavaScript/Python |
| File metadata | File system | Timestamps, size | Modified time, file size |

### Outputs

| Output | Destination | Format | Purpose |
|--------|-------------|--------|---------|
| Typesense documents | Typesense index | JSON documents | Keyword search |
| Embeddings | Qdrant vectors | 768-dim vectors | Semantic search |
| Logs | CIC Logging | JSON structured logs | Observability |
| Metrics | Prometheus | Gauge/counter/histogram | Monitoring |
| Evidence packets | CIC Memory Layer | JSON | Evidence trail |

### Search Results

When queried via TorqueQuery Gateway, results include:

```typescript
{
  path: "src/agents/WarmPoolManager.ts",
  repo: "castironforge",
  language: "typescript",
  content: "export class WarmPoolManager { ... }",  // First 1000 chars
  symbols: ["WarmPoolManager", "hydrate", "spawn"],
  imports: ["puppeteer", "events"],
  phase: "26",
  adapter: "WarmPoolManager",
  hybridScore: 0.892,  // Combined keyword + semantic score
  keywordScore: 0.85,
  vectorScore: 0.93
}
```

---

## Performance Characteristics

### Latency (Per Operation)

| Operation | Target | Typical | Notes |
|-----------|--------|---------|-------|
| File add → indexed | 5s | 2-3s | Includes batch debounce |
| Metadata extraction | 20ms | 10-20ms | Regex-based |
| AST parsing | 50ms | 20-50ms | TypeScript/JavaScript |
| Upsert to Typesense | 100ms | 50-100ms | Per document |
| Keyword search (/keyword) | 20ms | 5-15ms | Typesense only |
| Semantic search (/semantic) | 100ms | 50-80ms | Qdrant only |
| Hybrid search (/hybrid) | 150ms | 100-120ms | Both in parallel |

### Throughput

| Metric | Capacity |
|--------|----------|
| Files per repo | 100,000+ |
| Repositories | 10+ |
| Documents indexed | 1,000,000+ |
| Concurrent watched files | 100,000+ |
| Documents/minute | 1,000+ |
| Index size | 10-50 GB |

### Resource Usage

| Resource | Typical | Peak |
|----------|---------|------|
| CPU | 20% | 80% (during full index) |
| Memory | 512 MB | 2 GB (large batches) |
| Disk (index) | 10-50 GB | Varies by code volume |
| Network (to Typesense) | 10 Mbps | 50+ Mbps (bulk upload) |

---

## Determinism Guarantee

### How We Achieve Determinism

1. **SHA-256 deduplication:** Same content hash = same indexed state
2. **Deterministic ranking:** BM25 + vector fusion (no randomness)
3. **Sorted results:** Results always in same order
4. **Versioned schema:** Schema changes tracked and migrated
5. **Audit trail:** All changes logged with timestamps

### Verification

To verify determinism, run the same query twice:

```bash
# Query 1
curl "http://localhost:5051/hybrid?q=WarmPoolManager"
# Response: [doc1, doc2, doc3]

# Query 2 (immediately after)
curl "http://localhost:5051/hybrid?q=WarmPoolManager"
# Response: [doc1, doc2, doc3]  ← Identical results
```

If results differ, check:
- Is Typesense index healthy?
- Were files modified between queries?
- Are ranking weights configured consistently?

---

## Integration Checklist (Phase 26 Deployment)

### Day 1: Foundation

- [ ] Typesense cluster running
- [ ] Indexer service deployed
- [ ] Config registry populated (repos, ignore patterns)
- [ ] Logging integrated with CIC observability
- [ ] Health checks passing

### Day 2-3: Validation

- [ ] All repos being indexed
- [ ] Documents searchable via Typesense
- [ ] Metadata extracted correctly
- [ ] AST parsing working (all languages)
- [ ] Embeddings computed and stored

### Week 2: Optimization

- [ ] Performance benchmarks met
- [ ] Index drift < 0.1%
- [ ] Error rate < 0.1%
- [ ] Memory stable (no leaks)
- [ ] Alerts configured

### Week 3: Agent Integration

- [ ] Tool registry updated
- [ ] Agents can call torque_query
- [ ] Agent grounding working
- [ ] No hallucinations in responses
- [ ] Agent performance acceptable

### Week 4: Handoff

- [ ] Documentation complete
- [ ] Runbooks written
- [ ] On-call procedures defined
- [ ] Monitoring dashboard live
- [ ] Ready for Phase 27

---

## What Phase 27 Will Add

Phase 27 builds on Phase 26's foundation:

### Query Planner

```typescript
// Phase 27 analyzes query intent
const query = "WarmPoolManager";
const intent = analyzer.analyze(query);

if (intent.type === "symbol") {
  // "WarmPoolManager" → keyword search
  return torque_query(query, "keyword");
} else if (intent.type === "concept") {
  // "how does hydration work" → semantic search
  return torque_query(query, "semantic");
} else {
  // Balanced → hybrid
  return torque_query(query, "hybrid");
}
```

### Result Caching

```typescript
// Phase 27 caches popular queries (5-minute TTL)
const cached = cache.get("WarmPoolManager");
if (cached && !stale(cached)) {
  return cached;  // Fast
}
return torque_query("WarmPoolManager");  // Fresh
```

### Advanced Ranking

```typescript
// Phase 27 boosts Phase 26 results, favors recent code
const result = hybrid_search(query);
const reranked = result.map(r => ({
  ...r,
  score: r.hybridScore * 
         phaseBoost(r.phase) *  // Phase 26 docs: +10%
         recencyWeight(r.modified)  // Recent files: +20%
}));
```

### Webhook Ingestion

```typescript
// Phase 27 ingests from GitHub push events
webhook.on("push", async (event) => {
  const files = event.changedFiles;
  await indexer.reindex(files);  // Faster than filesystem watcher
});
```

---

## Migration Risks and Mitigations

### Risk: Index Drift (Indexed ≠ On-Disk)

**Cause:** Files changed but not re-indexed (e.g., service restart).

**Mitigation:** 
- SHA-256 dedup detects mismatches
- Auto-reindex on hash mismatch
- Daily consistency check
- Alert if drift > 1%

### Risk: Hallucinated Files (Index has non-existent files)

**Cause:** Files deleted but not removed from index.

**Mitigation:**
- File deletion event triggers removal
- Periodic cleanup (scan on-disk, remove stale)
- Document timestamp allows filtering by age

### Risk: Performance Degradation

**Cause:** Index grows, queries slow down.

**Mitigation:**
- Monitor latency per operation
- Implement pagination (don't return 10k results)
- Shard large indexes by repo
- Archive old documents (Phase 27)

### Risk: Typesense Cluster Failure

**Cause:** Hardware failure, data corruption.

**Mitigation:**
- Replicated Typesense cluster (3+ nodes)
- Daily backups to S3
- Recovery procedure tested
- RTO: 30 minutes, RPO: 24 hours

### Risk: Agent Dependence (Agents can't function without indexer)

**Cause:** Indexer down → agents can't query → chat breaks.

**Mitigation:**
- Indexer registered as critical service
- Auto-restart on failure
- Circuit breaker: gracefully degrade if indexer unavailable
- Fallback: agents can still reason without indexed code (suboptimal)

---

## Deployment Strategy

### Phase 26a: Pilot (Week 1)

Deploy indexer to test environment:
- Pilot with 1-2 repositories
- Validate indexing quality
- Benchmark performance
- Tune configuration

### Phase 26b: Staging (Week 2)

Deploy to staging with full CIC:
- All repositories indexed
- Full Integration tests
- Performance testing at scale
- Load testing (multiple queries)

### Phase 26c: Production (Week 3)

Gradual rollout to production:
- Deploy indexer service
- Deploy Typesense cluster
- Deploy API Gateway
- Deploy agent tools
- Monitor 24/7 for issues

### Phase 26d: Optimization (Week 4)

Ongoing monitoring and optimization:
- Tune batch size
- Tune ignore patterns
- Optimize ignore patterns based on file count
- Archive old documents

---

## Success Metrics (How We Know Phase 26 Worked)

### Indexing Metrics

- [ ] 95%+ of files indexed within 5 seconds of change
- [ ] Index drift < 0.1% (false positives)
- [ ] Parse errors < 0.1%
- [ ] Typesense uptime > 99.9%

### Search Metrics

- [ ] Keyword search latency < 20ms (p95)
- [ ] Semantic search latency < 100ms (p95)
- [ ] Hybrid search latency < 150ms (p95)
- [ ] Results are deterministic (same query = same results)

### Agent Metrics

- [ ] 100% of agents grounded (call torque_query)
- [ ] Agent query success rate > 99%
- [ ] Agent response time < 2 seconds
- [ ] Agent hallucination rate = 0%

### Operational Metrics

- [ ] Zero unplanned downtime
- [ ] Error rate < 0.1%
- [ ] Memory usage stable (no leaks)
- [ ] CPU usage < 50% baseline

---

## Rollback Plan (If Something Breaks)

### Symptoms Requiring Rollback

- Indexer down > 1 hour
- Index corruption detected
- Agent errors > 5% of queries
- Performance degradation > 2x

### Rollback Steps

1. **Stop new indexing:** Disable watcher (no new file events)
2. **Restore from backup:** Restore Typesense snapshot
3. **Restart indexer:** Deploy previous version
4. **Verify:** Run integration tests
5. **Investigate:** What went wrong?
6. **Re-release:** Fixed version

### Rollback RTO

- Detection: < 5 minutes
- Restore: < 10 minutes
- Verification: < 5 minutes
- **Total:** < 20 minutes to restore service

---

## Success Criteria: Phase 26 Complete ✅

✅ **Code Search Works**
- Deterministic keyword, semantic, hybrid search
- < 20ms keyword, < 100ms semantic, < 150ms hybrid
- All CIC repositories indexed
- No hallucinations

✅ **Agent Grounding Enabled**
- All agents call torque_query
- Agents return grounded: true/false
- Confidence scores reflect search quality

✅ **Operations Ready**
- Monitoring dashboard live
- Alerts configured
- Runbooks written
- On-call procedures established

✅ **Phase 27 Foundation Laid**
- Query Planner can be built on top
- Caching can be added
- Webhook ingestion can be plugged in

---

## Next: Phase 27 (Query Planner)

Phase 27 will automatically select keyword vs semantic search:

```typescript
// Phase 26 today: User chooses search mode
curl "http://localhost:5051/keyword?q=WarmPoolManager"

// Phase 27 tomorrow: Query Planner chooses
curl "http://localhost:5051/auto?q=WarmPoolManager"
// → Planner recognizes "symbol lookup" → keyword search
```

---

## Resources

**Documentation:**
- TORQUEQUERY_PHASE26.md — Full API and architecture
- AGENT_TOOLING_GUIDE.md — Agent integration patterns
- AGENT_GROUNDING_CHECKLIST.md — Post-merge enablement
- TORQUEQUERY_INDEXER_WIRING.md — Service wiring guide

**Code:**
- typesense-indexer/ — Indexer implementation
- torquequery-gateway/ — API Gateway
- chat-agent/src/tools/registry.ts — Agent tools
- chat-agent/src/agents/ — Example agents

**Support:**
- Slack: #cic-indexer
- Runbooks: docs/RUNBOOKS.md
- On-call: page via PagerDuty

---

**Status:** 🚀 Phase 26 Ready for Deployment

**Timeline:** 2-3 weeks from approval to production

**Owner:** Platform / DevOps Team

**Last Updated:** 2026-06-21
