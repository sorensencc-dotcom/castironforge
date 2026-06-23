# CIC FamilySearch Temporal Pipeline — Operator Guide

## Table of Contents

1. [Deployment](#deployment)
2. [Configuration](#configuration)
3. [Operations](#operations)
4. [Monitoring](#monitoring)
5. [Troubleshooting](#troubleshooting)
6. [Runbooks](#runbooks)

---

## Deployment

### System Requirements

**Node.js**: v16.0.0 or higher

**Memory**: Minimum 512MB for single-provider processing, 2GB for multi-provider at scale

**Storage**: Minimal (all processing in-memory)

**Network**: No external dependencies (fully self-contained)

### Installation

```bash
# Clone repository
git clone https://github.com/sorensencc-dotcom/castironforge.git
cd castironforge

# Install dependencies
npm install

# Verify installation
node mas/cic/__tests__/ancestry-temporal-extract.test.js
node mas/cic/__tests__/wikidata-temporal-extract.test.js
```

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "mas/cic/cic-run-fs-temporal.js"]
```

**Build and run:**
```bash
docker build -t cic-temporal:latest .
docker run -d \
  -e LOG_LEVEL=info \
  -e PROVIDER_RELIABILITY_FS=1.0 \
  -e PROVIDER_RELIABILITY_ANCESTRY=0.82 \
  -e PROVIDER_RELIABILITY_WIKIDATA=0.88 \
  cic-temporal:latest
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cic-temporal-pipeline
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cic-temporal
  template:
    metadata:
      labels:
        app: cic-temporal
    spec:
      containers:
      - name: temporal-processor
        image: cic-temporal:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        env:
        - name: LOG_LEVEL
          value: "info"
        - name: PROVIDER_RELIABILITY_FS
          value: "1.0"
        - name: PROVIDER_RELIABILITY_ANCESTRY
          value: "0.82"
```

---

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info                          # debug, info, warn, error
LOG_FORMAT=json                         # json or text

# Provider Reliability (0.0 - 1.0)
PROVIDER_RELIABILITY_FS=1.0
PROVIDER_RELIABILITY_ANCESTRY=0.82
PROVIDER_RELIABILITY_WIKIDATA=0.88
PROVIDER_RELIABILITY_CUSTOM=0.75

# Performance Tuning
MAX_BATCH_SIZE=1000                     # Persons per batch
WORKER_THREADS=4                        # Number of parallel workers
MEMORY_LIMIT_MB=2048

# Feature Flags
ENABLE_PROVENANCE_TRACKING=true
ENABLE_ANOMALY_DETECTION=true
ENABLE_RECONSTRUCTION=true

# SLA Targets
SLA_P95_MS=50
SLA_P99_MS=100
```

### Configuration File

Create `cic-config.json`:

```json
{
  "pipeline": {
    "engines": [
      "extract",
      "normalize",
      "enhance-precision",
      "consistency-check",
      "drift-detection",
      "arbitration",
      "stability-scoring",
      "reconstruction"
    ],
    "deterministic": true,
    "enableObservability": true
  },
  "providers": {
    "familysearch": {
      "enabled": true,
      "reliability": 1.0,
      "timeout_ms": 5000
    },
    "ancestry": {
      "enabled": true,
      "reliability": 0.82,
      "timeout_ms": 5000
    },
    "wikidata": {
      "enabled": true,
      "reliability": 0.88,
      "timeout_ms": 5000
    }
  },
  "performance": {
    "batchSize": 1000,
    "workerThreads": 4,
    "memoryLimitMB": 2048
  },
  "sla": {
    "p95_ms": 50,
    "p99_ms": 100,
    "throughput_persons_sec": 160
  },
  "observability": {
    "enableLineageTrace": true,
    "enableAnomalyReport": true,
    "enableProvenanceGraph": true,
    "logLevel": "info"
  }
}
```

### Provider Configuration

Configure provider reliability scores based on data quality assessment:

```javascript
// In your application setup
import { runCicFamilySearchTemporalPipeline } from "./cic-fs-temporal-master.js";

const providerStats = {
  ancestry: { 
    reliability: 0.82,  // Adjust based on data quality
    weightingStrategy: "accuracy"  // accuracy, coverage, consensus
  },
  wikidata: { 
    reliability: 0.88,
    weightingStrategy: "consensus"
  },
  myheritage: { 
    reliability: 0.75,  // Custom provider
    weightingStrategy: "coverage"
  }
};

const result = runCicFamilySearchTemporalPipeline({
  currentFs: /* ... */,
  providerPayloads: /* ... */,
  providerStats
});
```

---

## Operations

### Starting the Pipeline

**Single file processing:**
```bash
node mas/cic/cic-run-fs-temporal.js --input data.json --output result.json
```

**Batch processing:**
```bash
node mas/cic/cic-run-fs-temporal.js \
  --input-dir ./people/ \
  --output-dir ./results/ \
  --batch-size 100 \
  --workers 4
```

**Programmatic usage:**
```javascript
import { runCicFamilySearchTemporalPipeline } from "./cic-fs-temporal-master.js";
import { kgWriteStage } from "./cic-fs-temporal-kg-stage.js";

// Process single person
const pipelineResult = runCicFamilySearchTemporalPipeline({
  previousFs: null,
  currentFs: personData.familysearch,
  providerPayloads: {
    ancestry: personData.ancestry,
    wikidata: personData.wikidata
  },
  providerStats: {
    ancestry: { reliability: 0.82 },
    wikidata: { reliability: 0.88 }
  }
});

// Materialize to KG
const kgResult = kgWriteStage({
  personId: personData.id,
  pipelineOutput: pipelineResult
});

console.log(`Person ${personData.id}: ${kgResult.status}`);
```

### Health Checks

**Verify installation:**
```bash
# Run unit tests
node -e "import('./mas/cic/__tests__/ancestry-temporal-extract.test.js').then(m => m.runAncestryExtractorTests())"

node -e "import('./mas/cic/__tests__/wikidata-temporal-extract.test.js').then(m => m.runWikiDataExtractorTests())"

# Run integration tests
node -e "import('./mas/cic/__tests__/cic-fs-temporal-master.test.js').then(m => m.runMasterPipelineTests())"

# Run end-to-end tests
node -e "import('./mas/cic/__tests__/cic-fs-temporal-e2e.test.js').then(m => m.runE2ETests())"
```

**Performance baseline:**
```bash
node mas/cic/cic-fs-temporal-benchmark.js

# Outputs: Latency percentiles, memory usage, throughput, SLA compliance
```

### Scaling Guidelines

**Single provider (FamilySearch):**
- Throughput: ~200 persons/sec
- Recommended batch: 1,000-5,000 persons
- Workers: 1-2 (single provider doesn't benefit from parallelization)
- Memory: 512MB

**Two providers (FS + Ancestry):**
- Throughput: ~180 persons/sec
- Recommended batch: 500-2,000 persons
- Workers: 2-4
- Memory: 1-1.5GB

**Three providers (FS + Ancestry + WikiData):**
- Throughput: ~160 persons/sec
- Recommended batch: 100-500 persons
- Workers: 4-8
- Memory: 2GB+

---

## Monitoring

### Metrics to Track

**Pipeline Metrics:**
```
cic.temporal.pipeline.latency_p95      (milliseconds)
cic.temporal.pipeline.latency_p99      (milliseconds)
cic.temporal.pipeline.throughput       (persons/second)
cic.temporal.pipeline.persons_total    (count)
cic.temporal.pipeline.errors_total     (count)
```

**Data Quality Metrics:**
```
cic.temporal.stability.average         (0.0 - 1.0)
cic.temporal.stability.min             (0.0 - 1.0)
cic.temporal.stability.max             (0.0 - 1.0)
cic.temporal.drift.detected_total      (count)
cic.temporal.consistency.issues_total  (count)
cic.temporal.reconstruction.count      (count)
```

**Provider Metrics:**
```
cic.temporal.provider.events_total{provider="ancestry"}     (count)
cic.temporal.provider.events_total{provider="wikidata"}     (count)
cic.temporal.provider.agreement{provider="ancestry"}        (0.0 - 1.0)
cic.temporal.provider.agreement{provider="wikidata"}        (0.0 - 1.0)
```

### Prometheus Integration

Export metrics for monitoring:

```javascript
import prometheus from 'prom-client';

const latencyHistogram = new prometheus.Histogram({
  name: 'cic_temporal_pipeline_latency_ms',
  help: 'Pipeline latency in milliseconds',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
  labelNames: ['provider_count']
});

const throughputGauge = new prometheus.Gauge({
  name: 'cic_temporal_pipeline_throughput_persons_sec',
  help: 'Pipeline throughput'
});

// In your processing loop:
const start = Date.now();
const result = runCicFamilySearchTemporalPipeline(input);
const latency = Date.now() - start;

latencyHistogram.labels(String(providerCount)).observe(latency);
throughputGauge.set(personsProcessed / elapsedSeconds);
```

### Logging Levels

**DEBUG**: Detailed operation trace
- Event extraction details
- Normalization steps
- Precision enhancement decisions
- Every arbitration decision

**INFO**: Operation summary
- Processing started/completed
- Stability scores
- Drift detected
- Inconsistencies found

**WARN**: Issues requiring attention
- Low stability scores (< 0.5)
- Provider disagreement
- Data corruption detected
- Reconstruction inference

**ERROR**: Failures
- Processing errors
- Invalid inputs
- System errors

### Alert Thresholds

Set alerts for:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Latency P99 | > 100ms | Investigate performance |
| Latency P95 | > 50ms | Monitor for degradation |
| Throughput | < 150 persons/sec | Check resource utilization |
| Stability avg | < 0.7 | Review data quality |
| Errors | > 1% | Investigate error logs |
| Memory usage | > 90% | Scale horizontally |

---

## Troubleshooting

### Issue: High Latency (P95 > 50ms)

**Diagnosis:**
```bash
# Run performance benchmark
node mas/cic/cic-fs-temporal-benchmark.js

# Check current system load
top
free -h
```

**Common causes:**
1. Too many providers enabled — disable non-essential providers
2. Batch size too large — reduce from 1000 to 500
3. Worker threads insufficient — increase workers
4. Memory pressure — reduce batch size or add memory

**Solutions:**
```bash
# Reduce batch size
WORKER_THREADS=8 MAX_BATCH_SIZE=500 node cic-run-fs-temporal.js

# Disable optional providers
PROVIDER_RELIABILITY_WIKIDATA=0 node cic-run-fs-temporal.js

# Increase available memory
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Issue: Low Stability Scores (< 0.5)

**Diagnosis:**
```javascript
// Check individual event confidence
console.log(result.stability.metrics);
console.log(result.current.enhanced.map(e => ({ type: e.type, confidence: e.confidence })));
```

**Common causes:**
1. Precision mismatch (inferred vs exact) — check precision levels
2. Provider disagreement — verify provider reliability scores
3. Data corruption — check consistency issues

**Solutions:**
```javascript
// Review arbitration decisions
console.log(result.arbitration.decisions);

// Check consistency issues
if (result.consistency.issues.length > 0) {
  console.warn("Consistency issues:", result.consistency.issues);
}

// Review provider data
console.log("FS events:", result.current.enhanced);
console.log("Ancestry events:", result.providers.ancestry);
console.log("WikiData events:", result.providers.wikidata);
```

### Issue: Memory Exhaustion

**Diagnosis:**
```bash
# Monitor memory during processing
watch -n 1 'free -h && ps aux | grep node'

# Use Node profiler
node --prof mas/cic/cic-run-fs-temporal.js
node --prof-process isolate-*.log > profile.txt
```

**Common causes:**
1. Batch size too large
2. Accumulating results without cleanup
3. Memory leak in custom extensions

**Solutions:**
```bash
# Reduce batch size
MAX_BATCH_SIZE=100 node cic-run-fs-temporal.js

# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Process in streaming fashion
for file in people/*.json; do
  node cic-run-fs-temporal.js --input "$file" --output "${file%.json}-result.json"
done
```

### Issue: Inconsistent Results

**Diagnosis:**
```bash
# Check determinism with same input twice
node -e "
import('./cic-fs-temporal-master.js').then(async (m) => {
  const input = { /* test data */ };
  const result1 = m.runCicFamilySearchTemporalPipeline(input);
  const result2 = m.runCicFamilySearchTemporalPipeline(input);
  console.log('Deterministic:', JSON.stringify(result1) === JSON.stringify(result2));
})
"
```

**Common causes:**
1. Using non-deterministic custom extractor
2. Provider reliability scores changed mid-run
3. Bug in custom extension

**Solutions:**
```javascript
// Verify provider stats are consistent
const providerStats = {
  ancestry: { reliability: 0.82 },  // Fixed values
  wikidata: { reliability: 0.88 }
};

// Don't modify between runs
// ✓ Correct:
const result = runCicFamilySearchTemporalPipeline({ providerStats });

// ✗ Wrong:
providerStats.ancestry.reliability = 0.90;
const result = runCicFamilySearchTemporalPipeline({ providerStats });
```

### Issue: Provider Not Recognized

**Diagnosis:**
```javascript
import { getRegisteredProviders } from "./temporal-extractor-dispatcher.js";

console.log("Registered providers:", getRegisteredProviders());
// Output: ["familysearch", "ancestry", "wikidata"]
```

**Solution:**
```javascript
import { registerTemporalExtractor } from "./temporal-extractor-dispatcher.js";
import { extractMyProvider } from "./myprovider-extract.js";

// Register new provider
registerTemporalExtractor("myprovider", extractMyProvider);

// Now use in pipeline
const result = runCicFamilySearchTemporalPipeline({
  providerPayloads: {
    myprovider: { /* ... */ }
  },
  providerStats: {
    myprovider: { reliability: 0.75 }
  }
});
```

---

## Runbooks

### Runbook 1: Emergency Performance Degradation

**Trigger**: Latency P99 > 100ms for more than 5 minutes

**Steps:**
1. **Assess immediate state**
   ```bash
   top -p $(pgrep -f cic-temporal)
   free -h
   netstat -an | grep ESTABLISHED | wc -l
   ```

2. **Reduce load**
   ```bash
   # Kill non-essential workers
   pkill -f "cic-temporal.*worker" -n
   
   # Reduce batch size temporarily
   export MAX_BATCH_SIZE=100
   ```

3. **Investigate root cause**
   ```bash
   # Check for memory pressure
   npm run benchmark
   
   # Review logs
   tail -f logs/cic-temporal.log | grep -E "WARN|ERROR"
   ```

4. **Remediate**
   - If memory constrained: Scale horizontally or reduce providers
   - If CPU constrained: Add workers or reduce batch size
   - If I/O constrained: Disable non-essential logging

5. **Restore normal operation**
   ```bash
   # Restart with new configuration
   docker restart cic-temporal-pipeline
   ```

### Runbook 2: Data Quality Alert

**Trigger**: Average stability < 0.6

**Steps:**
1. **Verify data quality**
   ```javascript
   const sample = inputData.slice(0, 100);
   const results = sample.map(person => 
     runCicFamilySearchTemporalPipeline(person)
   );
   console.log("Avg stability:", results.reduce((s, r) => s + r.stability.metrics.composite_stability, 0) / results.length);
   ```

2. **Analyze provider agreement**
   ```javascript
   const disagreements = results.filter(r => r.arbitration.decisions.length > 2);
   console.log(`${disagreements.length} people have multi-provider conflicts`);
   ```

3. **Check for corruption**
   ```javascript
   const corrupted = results.filter(r => r.consistency.issues.length > 0);
   console.log(`${corrupted.length} people have data corruption`);
   ```

4. **Adjust provider reliability**
   ```javascript
   // If ancestry data is poor:
   providerStats.ancestry.reliability = 0.70;  // Lower from 0.82
   
   // If wikidata is good:
   providerStats.wikidata.reliability = 0.92;  // Raise from 0.88
   ```

5. **Reprocess affected data**
   ```bash
   node cic-run-fs-temporal.js --reprocess --quality-threshold 0.6
   ```

### Runbook 3: Reconciling Provider Conflicts

**Trigger**: High arbitration decision count

**Steps:**
1. **Identify conflicting fields**
   ```javascript
   const conflicts = result.arbitration.decisions.filter(d => d.fsScore !== d.otherScore);
   console.log("Conflicts by field:", conflicts.reduce((acc, c) => {
     acc[c.field] = (acc[c.field] || 0) + 1;
     return acc;
   }, {}));
   ```

2. **Analyze winning decisions**
   ```javascript
   conflicts.forEach(conflict => {
     console.log(`${conflict.field}:`);
     console.log(`  FS: ${conflict.fsValue} (score: ${conflict.fsScore})`);
     console.log(`  ${conflict.winner}: ${conflict.otherValue} (score: ${conflict.otherScore})`);
     console.log(`  Reason: ${conflict.reason}`);
   });
   ```

3. **Review arbitration logic**
   - If FS consistently losing: Adjust provider reliability
   - If specific provider losing: Review that provider's data quality
   - If tie scores: Improve arbitration algorithm

4. **Update provider reliability**
   ```javascript
   // If ancestry data is better quality:
   providerStats.ancestry.reliability = 0.90;
   
   // If wikidata precision is worse:
   providerStats.wikidata.reliability = 0.80;
   ```

5. **Reprocess with new weights**
   ```bash
   PROVIDER_RELIABILITY_ANCESTRY=0.90 node cic-run-fs-temporal.js
   ```

---

## Best Practices

### 1. Always Validate Input Data

```javascript
function validatePersonInput(person) {
  if (!person.id) throw new Error("Missing person ID");
  if (!person.familysearch) throw new Error("Missing FamilySearch data");
  if (typeof person.familysearch !== 'object') throw new Error("Invalid FamilySearch format");
  return true;
}

input.data.forEach(validatePersonInput);
```

### 2. Monitor Stability Scores

```javascript
// Set alert thresholds
const result = runCicFamilySearchTemporalPipeline(input);
const stability = result.stability.metrics.composite_stability;

if (stability < 0.5) {
  console.warn(`Low stability for ${personId}: ${stability}`);
  // Flag for manual review
}
```

### 3. Track Reconstruction Flags

```javascript
if (result.reconstruction.birth || result.reconstruction.death) {
  console.log(`${personId}: Inferred ${result.reconstruction.birth ? 'birth' : ''} ${result.reconstruction.death ? 'death' : ''}`);
  // Mark with lower confidence
}
```

### 4. Maintain Provider Reliability Scores

- Review quarterly based on data quality
- Adjust based on arbitration win rates
- Document changes with timestamps

### 5. Test Custom Providers

```javascript
// Unit test custom extractor
import { extractCustom } from './custom-extract.js';

const testPayload = { /* sample data */ };
const events = extractCustom(testPayload);

// Verify event schema
events.forEach(event => {
  if (!event.type || !event.date || !event.source) {
    throw new Error("Invalid event schema");
  }
});
```

