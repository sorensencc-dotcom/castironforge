# Phase 30 — Distributed Agent Reasoning and Multi-Agent Coordination

Phase 30 orchestrates multiple agents working together on corpus intelligence, maintenance, and expansion. Agents specialize by role and coordinate decisions via consensus.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Corpus Intelligence Layer (Phase 27)           │
│  Detects: integrity, drift, coverage gaps → Recommendations      │
└────────────────────────┬─────────────────────────────────────────┘
                         │
        ┌────────────────▼─────────────────┐
        │   Agent Coordination Bus (MCP)   │
        │  - Message routing               │
        │  - Consensus building            │
        │  - Conflict resolution           │
        └────────────────┬─────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
┌───▼────┐  ┌───────────▼──┐  ┌──────────▼──┐
│ Curator │  │ Indexer      │  │ Expander   │
│ Agent   │  │ Agent        │  │ Agent      │
└───┬────┘  └───────────┬──┘  └──────┬─────┘
    │                   │            │
    │ Specializes in:   │            │
    │ - Quality        │            │
    │ - Consistency    │ Maintains  │ Finds gaps
    │ - Metadata       │ indices,   │ Ingests new
    │ - Dedup          │ embeddings │ content
    │                   │            │
    └────────────────────┼────────────┘
                         │
        ┌────────────────▼─────────────────┐
        │ Consensus Layer (Raft-style)     │
        │ - Vote on actions                │
        │ - Distribute work                │
        │ - Handle failures                │
        └────────────────┬─────────────────┘
                         │
        ┌────────────────▼─────────────────┐
        │  Phase 29 Autonomous Execution   │
        │  Distributed MinIO (Phase 28)    │
        └──────────────────────────────────┘
```

## Agent Roles

### 1. Curator Agent
**Role:** Quality control and consistency

- Deduplicates content
- Validates metadata completeness
- Ensures phase/adapter accuracy
- Resolves conflicts in metadata
- Reports quality metrics

**Tools:**
- `deduplicateContent`
- `validateMetadata`
- `resolveConflicts`
- `getQualityReport`

### 2. Indexer Agent
**Role:** Index and embedding maintenance

- Detects missing/stale indices
- Monitors embedding freshness
- Reindexes documents
- Regenerates embeddings
- Tracks index health

**Tools:**
- `reindexDocuments`
- `reembedVectors`
- `checkIndexHealth`
- `getIndexMetrics`

### 3. Expander Agent
**Role:** Corpus expansion and ingestion

- Identifies coverage gaps
- Finds content from external sources
- Ingests new documents
- Monitors phase/adapter distribution
- Plans corpus growth

**Tools:**
- `identifyGaps`
- `findContent`
- `ingestDocuments`
- `planExpansion`

## Distributed Coordination

### Message Protocol
```
Agent A: "I found 5 docs missing for Phase-27"
Bus: Broadcast to all agents
Agent B: "I can reindex those"
Agent C: "I need embeddings first"
Consensus: Execute reembed, then reindex, then mark done
```

### Consensus Mechanism
- **Leader Election:** Current active DC leader orchestrates
- **Voting:** Agents vote on action proposals
- **Quorum:** 2/3 agents must agree on major decisions
- **Fallback:** Curator agent breaks ties

### Conflict Resolution
- **Data Conflicts:** Last-write-wins for metadata
- **Action Conflicts:** Consensus voting
- **Resource Conflicts:** Priority queue (HIGH > MEDIUM > LOW)
- **Deadlock:** Curator agent arbitrates

## Distributed Workflows

### Workflow: Collective Corpus Maintenance
```
1. All agents detect problems via Phase 27
2. Curator: "I found 10 metadata issues"
3. Indexer: "I have 5 stale embeddings"
4. Expander: "Phase-25 is missing 8 docs"
5. Consensus: Prioritize and sequence
6. Execute: Curator fixes metadata → Indexer reembed → Expander ingest
7. Report: Collective health update
```

### Workflow: Multi-Agent Expansion
```
1. Expander: "Phase-30 needs 20 more docs"
2. Curator: "Check for duplicates in candidates"
3. Indexer: "I'll prepare embeddings"
4. Consensus: Approve ingestion plan
5. Execute in parallel:
   - Expander ingests docs
   - Curator deduplicates
   - Indexer generates embeddings
6. Verify: All agents confirm completion
```

## Communication Protocol

**Agent Message Types:**
- `ANNOUNCE` — "I detected a problem"
- `PROPOSE` — "I propose action X"
- `VOTE` — "I agree/disagree"
- `EXECUTE` — "I'm executing workflow Y"
- `REPORT` — "Workflow completed with stats"
- `CONFLICT` — "Resource conflict detected"

## Observability

### Per-Agent Metrics
- Actions proposed
- Actions executed
- Success rate
- Average latency
- Resource usage

### Collective Metrics
- Consensus frequency
- Conflict resolution rate
- Workflow completion time
- Corpus health trajectory
- Agent specialization efficiency

### Dashboard
- Real-time agent status
- Workflow execution timeline
- Consensus votes visualized
- Coordination efficiency
- Health trends

## Scalability

### Horizontal Scaling
- Add agents in same or different DCs
- Automatic discovery via service mesh
- Consensus adjusts quorum (e.g., 5 agents = 3 quorum)
- Load balancing across agents

### Fault Tolerance
- Any agent can fail; consensus adjusts
- Workflows resume on next stable quorum
- Leader election handles DC failures
- State replicated across agents

## Autonomy with Oversight

### Human Control Points
1. **Configuration:** Autonomy levels per action
2. **Approval Gates:** High-risk actions require vote
3. **Rate Limits:** Constrain concurrent workflows
4. **Alerts:** Notify on anomalies
5. **Dashboard:** View all agent decisions

## Deliverables

A. **Agent Framework**
- Base Agent class
- Role definitions
- Tool registry

B. **Three Specialized Agents**
- Curator (quality)
- Indexer (maintenance)
- Expander (growth)

C. **Coordination Bus**
- Message routing
- Consensus building
- Conflict resolution

D. **Distributed Consensus**
- Leader election
- Voting mechanism
- Quorum management

E. **Observability**
- Per-agent metrics
- Collective health
- Audit trail

## Outcome

CIC achieves:
- ✅ **Distributed reasoning** across multiple agents
- ✅ **Collaborative decision-making** via consensus
- ✅ **Specialization** — agents excel at their roles
- ✅ **Resilience** — any agent can fail
- ✅ **Scalability** — add agents horizontally
- ✅ **Transparency** — full audit of agent decisions

The corpus becomes a **multi-agent society** working toward collective intelligence.

## What's Next (Post-Phase 30)

### Phase 31+: Advanced Topics
- Agent learning (improve consensus over time)
- Dynamic specialization (agents switch roles)
- Competitive proposals (agents bid on work)
- Cross-corpus collaboration (federated corpuses)
- Human-in-the-loop learning (feedback loops)
