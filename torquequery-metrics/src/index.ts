import prom from "prom-client";

export const tqQueryLatency = new prom.Histogram({
  name: "tq_query_latency_ms",
  help: "Total hybrid query latency (milliseconds)",
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000],
  labelNames: ["mode", "status"]
});

export const tqTypesenseLatency = new prom.Histogram({
  name: "tq_typesense_latency_ms",
  help: "Typesense search latency (milliseconds)",
  buckets: [5, 10, 25, 50, 100, 250, 500],
  labelNames: ["status"]
});

export const tqQdrantLatency = new prom.Histogram({
  name: "tq_qdrant_latency_ms",
  help: "Qdrant semantic search latency (milliseconds)",
  buckets: [10, 25, 50, 100, 250, 500, 1000],
  labelNames: ["status"]
});

export const tqHybridMerge = new prom.Histogram({
  name: "tq_hybrid_merge_ms",
  help: "Hybrid merge and scoring latency (milliseconds)",
  buckets: [1, 2, 5, 10, 25, 50, 100],
  labelNames: ["status"]
});

export const tqResultsCount = new prom.Gauge({
  name: "tq_results_count",
  help: "Number of results returned by search",
  labelNames: ["mode"]
});

export const tqErrors = new prom.Counter({
  name: "tq_errors_total",
  help: "Total TorqueQuery errors",
  labelNames: ["type", "endpoint"]
});

export const tqCacheHits = new prom.Counter({
  name: "tq_cache_hits_total",
  help: "Total cache hits (embeddings)",
  labelNames: ["status"]
});

export const tqEmbeddingsCount = new prom.Counter({
  name: "tq_embeddings_total",
  help: "Total embeddings computed",
  labelNames: ["model"]
});

export const tqDocumentsIngested = new prom.Counter({
  name: "tq_documents_ingested_total",
  help: "Total documents ingested into indexes",
  labelNames: ["index", "status"]
});

export const tqCollectionSize = new prom.Gauge({
  name: "tq_collection_size_bytes",
  help: "Size of each collection in bytes",
  labelNames: ["collection"]
});

export function startMetricsServer(port: number = 9090) {
  const app = require("express")();
  app.get("/metrics", async (req: any, res: any) => {
    res.set("Content-Type", prom.register.contentType);
    res.end(await prom.register.metrics());
  });
  app.listen(port, () => {
    console.log(`Prometheus metrics available on http://localhost:${port}/metrics`);
  });
}

export { prom };
