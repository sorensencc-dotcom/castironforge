# TorqueQuery Metrics

Prometheus metrics for TorqueQuery observability. Tracks latency, errors, cache hits, and throughput.

## Metrics Exposed

### Latency Histograms

- `tq_query_latency_ms` — total hybrid query latency (5ms to 2s buckets)
- `tq_typesense_latency_ms` — Typesense search latency (5ms to 500ms)
- `tq_qdrant_latency_ms` — Qdrant semantic search latency (10ms to 1s)
- `tq_hybrid_merge_ms` — hybrid merge + scoring latency (1ms to 100ms)

All labeled by `status` (success, error).

### Throughput Gauges & Counters

- `tq_results_count` — gauge, number of results per search (labeled by mode)
- `tq_errors_total` — counter, total errors (labeled by type, endpoint)
- `tq_cache_hits_total` — counter, embedding cache hits
- `tq_embeddings_total` — counter, embeddings computed (labeled by model)
- `tq_documents_ingested_total` — counter, documents ingested (labeled by index, status)
- `tq_collection_size_bytes` — gauge, collection size in bytes

## Usage

### Import in your TorqueQuery service

```typescript
import {
  tqQueryLatency,
  tqTypesenseLatency,
  tqQdrantLatency,
  tqHybridMerge,
  tqResultsCount,
  tqErrors,
  tqCacheHits,
  tqEmbeddingsCount,
  tqDocumentsIngested,
  tqCollectionSize
} from "torquequery-metrics";
```

### Instrument your code

```typescript
export async function hybridSearch(query: string) {
  const endQuery = tqQueryLatency.startTimer({ mode: "hybrid" });

  try {
    const endTS = tqTypesenseLatency.startTimer({ status: "success" });
    const tsHits = await typesenseSearch(query);
    endTS();

    const endQD = tqQdrantLatency.startTimer({ status: "success" });
    const qdHits = await qdrantSearch(query);
    endQD();

    const endMerge = tqHybridMerge.startTimer({ status: "success" });
    const ranked = rankFusion(tsHits, qdHits);
    endMerge();

    tqResultsCount.set({ mode: "hybrid" }, ranked.length);

    endQuery({ status: "success" });
    return { query, results: ranked };
  } catch (err) {
    tqErrors.inc({ type: "search_error", endpoint: "hybrid" });
    endQuery({ status: "error" });
    throw err;
  }
}
```

### Start metrics server

```typescript
import { startMetricsServer } from "torquequery-metrics";

startMetricsServer(9090);
// Metrics exposed at http://localhost:9090/metrics
```

## Prometheus Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "torquequery"
    static_configs:
      - targets: ["localhost:9090"]
    scrape_interval: 15s
```

## Grafana Dashboards

Example queries:

```promql
# P95 latency (hybrid)
histogram_quantile(0.95, rate(tq_query_latency_ms_bucket[5m]))

# Errors per minute
rate(tq_errors_total[1m])

# Cache hit rate
rate(tq_cache_hits_total[5m]) / rate(tq_embeddings_total[5m])

# Results per search (average)
avg(tq_results_count)
```

## License

Part of CIC system.
