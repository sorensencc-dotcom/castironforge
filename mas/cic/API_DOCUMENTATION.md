# CIC FamilySearch Temporal Pipeline — API Documentation

## Table of Contents

1. [Core Pipeline](#core-pipeline)
2. [Provider Adapters](#provider-adapters)
3. [Processing Engines](#processing-engines)
4. [KG Write Adapter](#kg-write-adapter)
5. [Observability](#observability)
6. [Configuration](#configuration)

---

## Core Pipeline

### `runCicFamilySearchTemporalPipeline(input)`

Main orchestrator that processes temporal data through all 8 engines.

**Location:** `mas/cic/cic-fs-temporal-master.js`

**Parameters:**

```typescript
{
  previousFs?: {
    person?: {
      display?: {
        birthDate?: string,
        deathDate?: string
      }
    },
    records?: Array<{
      id: string,
      type: string,
      date: string
    }>
  },
  currentFs: {
    person?: {
      display?: {
        birthDate?: string,
        deathDate?: string
      }
    },
    records?: Array<{
      id: string,
      type: string,
      date: string
    }>
  },
  providerPayloads?: {
    [providerName: string]: {
      person?: object,
      records?: Array<object>,
      events?: Array<object>
    }
  },
  providerStats?: {
    [providerName: string]: {
      reliability: number  // 0.0 - 1.0
    }
  }
}
```

**Returns:**

```typescript
{
  current: {
    raw: Event[],
    normalized: NormalizedEvent[],
    enhanced: EnhancedEvent[]
  },
  previous: {
    raw: Event[],
    normalized: NormalizedEvent[],
    enhanced: EnhancedEvent[]
  },
  providers: {
    [providerName: string]: EnhancedEvent[]
  },
  consistency: {
    issues: ConsistencyIssue[],
    isValid: boolean
  },
  drift: {
    drift: DriftRecord[],
    hasDrift: boolean
  },
  arbitration: {
    decisions: ArbitrationDecision[],
    winnerByField: object
  },
  stability: {
    metrics: StabilityMetrics,
    scores: object
  },
  reconstruction: {
    birth?: string,
    death?: string
  }
}
```

**Example:**

```javascript
import { runCicFamilySearchTemporalPipeline } from "./cic-fs-temporal-master.js";

const result = runCicFamilySearchTemporalPipeline({
  previousFs: {
    person: { display: { birthDate: "1822", deathDate: "1874" } },
    records: []
  },
  currentFs: {
    person: { display: { birthDate: "1822-06-15", deathDate: "1886" } },
    records: [
      { id: "r1", type: "CENSUS", date: "1850" }
    ]
  },
  providerPayloads: {
    ancestry: {
      person: { display: { birthDate: "1822", deathDate: "1886" } },
      records: []
    },
    wikidata: {
      person: {
        birthDate: { value: "1822-06-15", precision: 8 },
        deathDate: { value: "1886-03-20", precision: 8 }
      },
      events: []
    }
  },
  providerStats: {
    ancestry: { reliability: 0.82 },
    wikidata: { reliability: 0.88 }
  }
});

console.log(result.current.enhanced);        // Current person events
console.log(result.providers.ancestry);      // Ancestry events
console.log(result.arbitration.decisions);   // Conflict resolutions
console.log(result.stability.metrics);       // Confidence scores
```

---

## Provider Adapters

### `dispatchTemporalExtraction(provider, payload)`

Routes temporal extraction to the appropriate provider adapter.

**Location:** `mas/cic/temporal-extractor-dispatcher.js`

**Parameters:**
- `provider` (string): Provider name ("familysearch", "ancestry", "wikidata", or custom)
- `payload` (object): Provider-specific payload

**Returns:** `Event[]` - Normalized event array

**Example:**

```javascript
import { dispatchTemporalExtraction } from "./temporal-extractor-dispatcher.js";

const ancestryEvents = dispatchTemporalExtraction("ancestry", {
  person: { display: { birthDate: "1822", deathDate: "1886" } },
  records: [
    { id: "r1", type: "census", date: "1850" }
  ]
});

console.log(ancestryEvents);
// [
//   { type: "BIRTH", date: "1822", source: "ancestry" },
//   { type: "DEATH", date: "1886", source: "ancestry" },
//   { type: "CENSUS", date: "1850", source: "ancestry", recordId: "r1" }
// ]
```

### `extractFamilySearchTemporal(fsPayload)`

**Location:** `mas/cic/fs-temporal-extract.js`

Extracts temporal events from FamilySearch payload.

### `extractAncestryTemporal(ancestryPayload)`

**Location:** `mas/cic/ancestry-temporal-extract.js`

Extracts temporal events from Ancestry genealogy database format.

### `extractWikiDataTemporal(wikiDataPayload)`

**Location:** `mas/cic/wikidata-temporal-extract.js`

Extracts temporal events from WikiData JSON-LD format with precision levels.

### `registerTemporalExtractor(providerName, extractorFunction)`

Registers a new provider extractor for custom providers.

**Example:**

```javascript
import { registerTemporalExtractor } from "./temporal-extractor-dispatcher.js";

function extractMyProviderTemporal(payload) {
  const events = [];
  if (payload.birth) {
    events.push({
      type: "BIRTH",
      date: payload.birth,
      source: "myprovider"
    });
  }
  return events;
}

registerTemporalExtractor("myprovider", extractMyProviderTemporal);
```

---

## Processing Engines

### Engine 1: Extract

Extracts raw temporal events from provider payloads.

**Dispatcher:** `dispatchTemporalExtraction(provider, payload)`

**Output:** `Event[]`

### Engine 2: Normalize

Normalizes dates to standard format and determines precision.

**Location:** `mas/cic/kgtemporalnormalize-familysearch.js`

**Function:** `normalizeFamilySearchTemporal({ events })`

**Date Normalization:**
- YYYY → YYYY-01-01 (precision: YEAR)
- YYYY-MM → YYYY-MM-01 (precision: MONTH)
- YYYY-MM-DD → preserved (precision: DAY)

### Engine 3: Enhance Precision

Deterministically infers missing precision levels.

**Location:** `mas/cic/kgtemporalprecision-familysearch.js`

**Function:** `enhanceFamilySearchTemporalPrecision({ events })`

**Logic:**
- YEAR → YYYY-06-15 (midpoint, marked INFERRED_DAY)
- MONTH → YYYY-06-15 (midpoint, marked INFERRED_DAY)
- DAY → preserved

### Engine 4: Consistency Check

Validates temporal invariants (birth < death, chronological ordering).

**Location:** `mas/cic/kgtemporalconsistency-familysearch.js`

**Function:** `checkFamilySearchTemporalConsistency({ events })`

**Issues Detected:**
- REVERSED_LIFESPAN: Death before birth
- INVALID_EVENT_ORDERING: Events not chronological

### Engine 5: Drift Detection

Detects changes between previous and current snapshots.

**Location:** `mas/cic/kgtemporaldrift-familysearch.js`

**Function:** `detectFamilySearchTemporalDrift({ previous, current })`

**Output:** `{ drift: DriftRecord[] }`

**Drift Record:**
```typescript
{
  type: "BIRTH" | "DEATH" | "EVENT",
  previous: string,
  current: string,
  driftMagnitude: number  // Years of difference
}
```

### Engine 6: Arbitration

Multi-provider conflict resolution with weighted reliability scoring.

**Location:** `mas/cic/temporalarbitrationv2-familysearch.js`

**Function:** `arbitrateFamilySearchTemporalV2({ fsEvents, providerEvents, providerStats })`

**Arbitration Logic:**
1. FamilySearch score: 1.0 (baseline)
2. Provider score: reliability × (provider agreement / total providers)
3. Winner: provider with highest score
4. Defensive check: Penalize scores if data is corrupted

### Engine 7: Stability Scoring

Calculates confidence metrics across all providers.

**Location:** `mas/cic/kgtemporalstability-familysearch.js`

**Function:** `computeFamilySearchTemporalStability({ current, previous, providers })`

**Metrics:**
```typescript
{
  birth: 0.0 - 1.0,           // Confidence in birth date
  death: 0.0 - 1.0,           // Confidence in death date
  composite_stability: 0.0 - 1.0,  // Overall confidence
  drift_impact: number,        // How much drift affects stability
  provider_agreement: number   // % of providers matching
}
```

### Engine 8: Reconstruction

Infers missing temporal data.

**Location:** `mas/cic/temporalreconstruct-familysearch.js`

**Function:** `reconstructFamilySearchTemporal({ person })`

**Inference:**
- Missing birth: Estimated from earliest record or lifespan patterns
- Missing death: Estimated from latest record or life expectancy
- Marked as inferred with lower confidence

---

## KG Write Adapter

### `kgWriteStage({ personId, pipelineOutput, options })`

Materializes pipeline output into CIC Knowledge Graph.

**Location:** `mas/cic/cic-fs-temporal-kg-stage.js`

**Parameters:**
```typescript
{
  personId: string,
  pipelineOutput: PipelineOutput,
  options?: {
    includeProvenance?: boolean,
    includeMetadata?: boolean
  }
}
```

**Returns:**
```typescript
{
  status: "success" | "error",
  personId: string,
  block: KGBlock,
  metadata?: {
    writtenAt: string,
    temporalSpan: { birth?, death?, lifespan? },
    eventCount: number,
    stabilityScore: number,
    hasInconsistencies: boolean,
    hasReconstruction: boolean
  },
  error?: { name: string, message: string, stack: string }
}
```

**Example:**

```javascript
import { kgWriteStage } from "./cic-fs-temporal-kg-stage.js";

const kgResult = kgWriteStage({
  personId: "person_12345",
  pipelineOutput: result
});

if (kgResult.status === "success") {
  console.log("Materialized block:", kgResult.block);
  console.log("Stability score:", kgResult.metadata.stabilityScore);
}
```

### `batchKGWrite({ persons, options })`

Batch processing for multiple persons.

**Parameters:**
```typescript
{
  persons: Array<{
    personId: string,
    pipelineOutput: PipelineOutput
  }>,
  options?: object
}
```

**Returns:**
```typescript
{
  successful: KGWriteResult[],
  failed: Array<{ personId: string, error: string }>,
  summary: {
    total: number,
    succeeded: number,
    failed: number,
    averageStability: number
  }
}
```

### `verifyKGMaterialization({ block, pipelineOutput })`

Verifies KG block integrity and completeness.

**Returns:**
```typescript
{
  isValid: boolean,
  summary: { passed: number, failed: number, warnings: number },
  details: {
    passed: string[],
    failed: string[],
    warnings: string[]
  }
}
```

---

## Observability

### Lineage Tracing

Full lineage tracking through all 8 engines with provenance graph.

**13-Layer Provenance Graph:**

```
Layer 1:  INPUT_SOURCES (FamilySearch, Ancestry, WikiData, ...)
Layer 2:  EXTRACTION
Layer 3:  NORMALIZATION
Layer 4:  PRECISION_ENHANCEMENT
Layer 5:  CONSISTENCY_CHECK
Layer 6:  DRIFT_DETECTION
Layer 7:  ARBITRATION
Layer 8:  STABILITY_SCORING
Layer 9:  RECONSTRUCTION
Layer 10: CANONICAL_RESOLUTION
Layer 11: CONFIDENCE_SYNTHESIS
Layer 12: TEMPORAL_INDEXING
Layer 13: KG_MATERIALIZATION
```

Each event's path through the pipeline is recorded with full metadata.

### Anomaly Detection

Anomalies detected and reported:
- Corrupted data (death < birth)
- Precision anomalies (conflicting precision levels)
- Provider disagreement (multi-provider conflict)
- Drift anomalies (significant value changes)
- Reconstruction flags (inferred data)

### Logging

All operations are logged with context:
- Event timestamps
- Provider attribution
- Confidence scores
- Arbitration decisions
- Materialization status

---

## Configuration

### Provider Reliability Scores

Configure per-ingestion based on data quality assessment:

```javascript
const providerStats = {
  familysearch: { reliability: 1.0 },      // Baseline
  ancestry: { reliability: 0.82 },         // Reliable for vital/census
  wikidata: { reliability: 0.88 },         // Community-curated
  myheritage: { reliability: 0.75 },       // Custom provider
  // Add custom providers as needed
};
```

### Precision Handling

All extractors support three date precisions:
- **YEAR**: "1822" → normalized to "1822-01-01"
- **MONTH**: "1822-06" → normalized to "1822-06-01"
- **DAY**: "1822-06-15" → preserved exactly

### SLA Configuration

Default SLA targets:
- P95 latency: < 50ms per person
- P99 latency: < 100ms per person
- Throughput: 160-200 persons/sec (depends on provider count)

Override in benchmarking:
```javascript
const slaTargets = {
  p95_ms: 50,
  p99_ms: 100,
  throughput_persons_sec: 200
};
```

---

## Data Structures

### Event

```typescript
{
  type: "BIRTH" | "DEATH" | "MARRIAGE" | "CENSUS" | "RECORD",
  date: string,          // Original format
  source: string,        // Provider name
  recordId?: string,     // Optional, for records
  normalizedDate?: string,  // Added by normalize engine
  precision?: string,    // YEAR, MONTH, DAY, INFERRED_DAY
  wikiDataPrecision?: number  // For WikiData (6=year, 7=month, 8=day)
}
```

### ArbitrationDecision

```typescript
{
  field: "birthDate" | "deathDate",
  winner: "familysearch" | string,  // Provider name
  fsValue: string,
  otherValue: string,
  fsScore: number,
  otherScore: number,
  reason: string  // Why this provider won
}
```

### KGBlock

```typescript
{
  type: "TEMPORAL_MATERIALIZATION",
  timestamp: string,
  version: string,
  nodes: {
    canonical: CanonicalPerson,
    events: TemporalEvent[]
  },
  edges: {
    provenance: ProvenanceGraph,
    consistency: ConsistencyEdge[]
  },
  metadata: StabilityMetadata,
  indices: {
    eventsByType: object,
    eventsByDate: object,
    provenanceByLayer: object
  }
}
```

---

## Error Handling

### Null/Undefined Payloads

All extractors gracefully handle null or undefined inputs:

```javascript
extractAncestryTemporal(null);        // Returns []
extractWikiDataTemporal(undefined);   // Returns []
dispatchTemporalExtraction("", {});   // Defaults to FamilySearch
```

### Missing Data

Missing dates and records are skipped silently:

```javascript
// Only birth present
const events = extractAncestryTemporal({
  person: { display: { birthDate: "1822" } },
  records: []
});
// Returns 1 event (BIRTH)

// Records without dates are filtered
const events = extractAncestryTemporal({
  person: { display: { birthDate: "1822" } },
  records: [
    { id: "r1", type: "census", date: "1850" },
    { id: "r2", type: "record" },  // No date — skipped
    { id: "r3", type: "census", date: "1860" }
  ]
});
// Returns 3 events (BIRTH, CENSUS, CENSUS)
```

### KG Write Errors

KG write failures return error details:

```javascript
{
  status: "error",
  message: "Missing personId or pipelineOutput",
  block: null,
  error: {
    name: "Error",
    stack: "..."
  }
}
```

---

## Performance Characteristics

### Latency (per person)

- **Single provider (FS)**: ~5ms
- **Two providers (FS + Ancestry)**: ~5.5ms
- **Three providers (FS + Ancestry + WikiData)**: ~6.2ms

### Throughput

- **Single provider**: ~200 persons/sec
- **Two providers**: ~180 persons/sec
- **Three providers**: ~160 persons/sec

### Memory

- Per-person memory: ~100KB
- Batch overhead: ~1MB per 100 persons

---

## Determinism

All processing is deterministic and reproducible:
- No random number generation
- No external API calls during processing
- No system-dependent operations
- Same input always produces same output

Useful for:
- Testing and validation
- Debugging
- Audit trails
- Regulatory compliance

