// cic-fs-temporal-benchmark.js — 2026-06-23 — v1.0.0
// Performance benchmarking: latency, memory, throughput

import { runCicFamilySearchTemporalPipeline } from "./cic-fs-temporal-master.js";
import { kgWriteStage } from "./cic-fs-temporal-kg-stage.js";
import { generateTemporalLineageTrace } from "./cic-temporal-lineage-trace.js";
import { generateTemporalAnomalyReport } from "./cic-temporal-anomaly-report.js";

// Benchmark utilities
class Benchmark {
  constructor(name) {
    this.name = name;
    this.measurements = [];
    this.memoryMeasurements = [];
  }

  measure(fn) {
    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    const start = process.hrtime.bigint();

    fn();

    const end = process.hrtime.bigint();
    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;

    const latency = Number(end - start) / 1_000_000; // Convert to ms
    const memDelta = memAfter - memBefore;

    this.measurements.push(latency);
    this.memoryMeasurements.push(memDelta);

    return { latency, memDelta };
  }

  getStats() {
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const n = sorted.length;

    return {
      count: n,
      min: sorted[0],
      max: sorted[n - 1],
      mean: sorted.reduce((a, b) => a + b) / n,
      median: sorted[Math.floor(n / 2)],
      p95: sorted[Math.floor(n * 0.95)],
      p99: sorted[Math.floor(n * 0.99)],
      stdev: this.calculateStdev(sorted),
      memMin: Math.min(...this.memoryMeasurements),
      memMax: Math.max(...this.memoryMeasurements),
      memMean: this.memoryMeasurements.reduce((a, b) => a + b) / n
    };
  }

  calculateStdev(arr) {
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  report() {
    const stats = this.getStats();
    return `
  ${this.name}:
    Count:        ${stats.count}
    Latency (ms):
      Min:        ${stats.min.toFixed(2)}
      Mean:       ${stats.mean.toFixed(2)}
      Median:     ${stats.median.toFixed(2)}
      P95:        ${stats.p95.toFixed(2)}
      P99:        ${stats.p99.toFixed(2)}
      Max:        ${stats.max.toFixed(2)}
      StDev:      ${stats.stdev.toFixed(2)}
    Memory (MB):
      Min:        ${stats.memMin.toFixed(2)}
      Mean:       ${stats.memMean.toFixed(2)}
      Max:        ${stats.memMax.toFixed(2)}
    `;
  }
}

// Test data generators
function createSimplePayload() {
  return {
    previousFs: {
      person: { display: { birthDate: "1822", deathDate: "1886" } },
      records: []
    },
    currentFs: {
      person: { display: { birthDate: "1822-06-15", deathDate: "1886-03-20" } },
      records: [
        { id: "r1", type: "CENSUS", date: "1850" },
        { id: "r2", type: "CENSUS", date: "1870" }
      ]
    },
    providerPayloads: {
      ancestry: {
        person: { display: { birthDate: "1822", deathDate: "1886" } },
        records: []
      }
    },
    providerStats: { ancestry: { reliability: 0.82 } }
  };
}

function createComplexPayload() {
  const records = [];
  for (let i = 0; i < 20; i++) {
    records.push({
      id: `r${i}`,
      type: ["CENSUS", "DEATH", "MARRIAGE", "BIRTH", "CHURCH"][i % 5],
      date: `${1800 + i * 5}`
    });
  }

  return {
    previousFs: {
      person: { display: { birthDate: "1800", deathDate: "1880" } },
      records: records.slice(0, 10)
    },
    currentFs: {
      person: { display: { birthDate: "1800-03-15", deathDate: "1880-11-20" } },
      records
    },
    providerPayloads: {
      ancestry: {
        person: { display: { birthDate: "1800", deathDate: "1880" } },
        records: records.slice(0, 8)
      },
      myheritage: {
        person: { display: { birthDate: "1801", deathDate: "1879" } },
        records: records.slice(5, 12)
      },
      findagrave: {
        person: { display: { birthDate: "1799", deathDate: "1881" } },
        records: records.slice(10, 15)
      }
    },
    providerStats: {
      ancestry: { reliability: 0.82 },
      myheritage: { reliability: 0.65 },
      findagrave: { reliability: 0.45 }
    }
  };
}

function createLargePayload() {
  const records = [];
  for (let i = 0; i < 100; i++) {
    records.push({
      id: `r${i}`,
      type: ["CENSUS", "DEATH", "MARRIAGE", "BIRTH", "CHURCH", "MILITARY", "LAND", "PROBATE"][i % 8],
      date: `${1700 + i}`
    });
  }

  const providers = {
    ancestry: {
      person: { display: { birthDate: "1700", deathDate: "1800" } },
      records: records.slice(0, 30)
    },
    myheritage: {
      person: { display: { birthDate: "1700", deathDate: "1800" } },
      records: records.slice(20, 50)
    },
    findagrave: {
      person: { display: { birthDate: "1700", deathDate: "1800" } },
      records: records.slice(40, 70)
    },
    wikitree: {
      person: { display: { birthDate: "1700", deathDate: "1800" } },
      records: records.slice(60, 90)
    }
  };

  return {
    previousFs: {
      person: { display: { birthDate: "1700", deathDate: "1800" } },
      records: records.slice(0, 50)
    },
    currentFs: {
      person: { display: { birthDate: "1700-05-10", deathDate: "1800-09-15" } },
      records
    },
    providerPayloads: providers,
    providerStats: {
      ancestry: { reliability: 0.82 },
      myheritage: { reliability: 0.65 },
      findagrave: { reliability: 0.45 },
      wikitree: { reliability: 0.58 }
    }
  };
}

// Benchmark tests
export function runPerformanceBenchmark() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  FamilySearch Temporal Pipeline — Performance Benchmark         ║");
  console.log("║  2026-06-23 v1.0.0                                             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const benchmarks = {
    temporalPipeline: new Benchmark("Temporal Pipeline (Simple)"),
    temporalPipelineComplex: new Benchmark("Temporal Pipeline (Complex)"),
    temporalPipelineLarge: new Benchmark("Temporal Pipeline (Large)"),
    kgWrite: new Benchmark("KG Write Adapter (Simple)"),
    kgWriteComplex: new Benchmark("KG Write Adapter (Complex)"),
    kgWriteLarge: new Benchmark("KG Write Adapter (Large)"),
    lineageTrace: new Benchmark("Lineage Trace (Simple)"),
    lineageTraceComplex: new Benchmark("Lineage Trace (Complex)"),
    lineageTraceLarge: new Benchmark("Lineage Trace (Large)"),
    anomalyReport: new Benchmark("Anomaly Report (Simple)"),
    anomalyReportComplex: new Benchmark("Anomaly Report (Complex)"),
    anomalyReportLarge: new Benchmark("Anomaly Report (Large)"),
    fullStack: new Benchmark("Full Stack (Simple)"),
    fullStackComplex: new Benchmark("Full Stack (Complex)"),
    fullStackLarge: new Benchmark("Full Stack (Large)")
  };

  // Warm up
  console.log("Warming up...");
  for (let i = 0; i < 3; i++) {
    const payload = createSimplePayload();
    const result = runCicFamilySearchTemporalPipeline(payload);
    kgWriteStage({ personId: "warmup", pipelineOutput: result });
  }

  // Simple payload benchmarks (50 iterations)
  console.log("Benchmarking simple payload...");
  for (let i = 0; i < 50; i++) {
    const payload = createSimplePayload();

    benchmarks.temporalPipeline.measure(() => {
      runCicFamilySearchTemporalPipeline(payload);
    });

    const result = runCicFamilySearchTemporalPipeline(payload);

    benchmarks.kgWrite.measure(() => {
      kgWriteStage({ personId: `simple_${i}`, pipelineOutput: result });
    });

    benchmarks.lineageTrace.measure(() => {
      generateTemporalLineageTrace(result, `simple_${i}`);
    });

    benchmarks.anomalyReport.measure(() => {
      generateTemporalAnomalyReport(result);
    });

    benchmarks.fullStack.measure(() => {
      const p = runCicFamilySearchTemporalPipeline(payload);
      kgWriteStage({ personId: `simple_${i}`, pipelineOutput: p });
      generateTemporalLineageTrace(p, `simple_${i}`);
      generateTemporalAnomalyReport(p);
    });
  }

  // Complex payload benchmarks (25 iterations)
  console.log("Benchmarking complex payload...");
  for (let i = 0; i < 25; i++) {
    const payload = createComplexPayload();

    benchmarks.temporalPipelineComplex.measure(() => {
      runCicFamilySearchTemporalPipeline(payload);
    });

    const result = runCicFamilySearchTemporalPipeline(payload);

    benchmarks.kgWriteComplex.measure(() => {
      kgWriteStage({ personId: `complex_${i}`, pipelineOutput: result });
    });

    benchmarks.lineageTraceComplex.measure(() => {
      generateTemporalLineageTrace(result, `complex_${i}`);
    });

    benchmarks.anomalyReportComplex.measure(() => {
      generateTemporalAnomalyReport(result);
    });

    benchmarks.fullStackComplex.measure(() => {
      const p = runCicFamilySearchTemporalPipeline(payload);
      kgWriteStage({ personId: `complex_${i}`, pipelineOutput: p });
      generateTemporalLineageTrace(p, `complex_${i}`);
      generateTemporalAnomalyReport(p);
    });
  }

  // Large payload benchmarks (10 iterations)
  console.log("Benchmarking large payload...");
  for (let i = 0; i < 10; i++) {
    const payload = createLargePayload();

    benchmarks.temporalPipelineLarge.measure(() => {
      runCicFamilySearchTemporalPipeline(payload);
    });

    const result = runCicFamilySearchTemporalPipeline(payload);

    benchmarks.kgWriteLarge.measure(() => {
      kgWriteStage({ personId: `large_${i}`, pipelineOutput: result });
    });

    benchmarks.lineageTraceLarge.measure(() => {
      generateTemporalLineageTrace(result, `large_${i}`);
    });

    benchmarks.anomalyReportLarge.measure(() => {
      generateTemporalAnomalyReport(result);
    });

    benchmarks.fullStackLarge.measure(() => {
      const p = runCicFamilySearchTemporalPipeline(payload);
      kgWriteStage({ personId: `large_${i}`, pipelineOutput: p });
      generateTemporalLineageTrace(p, `large_${i}`);
      generateTemporalAnomalyReport(p);
    });
  }

  // Generate reports
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Temporal Pipeline Performance                                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(benchmarks.temporalPipeline.report());
  console.log(benchmarks.temporalPipelineComplex.report());
  console.log(benchmarks.temporalPipelineLarge.report());

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  KG Write Adapter Performance                                  ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(benchmarks.kgWrite.report());
  console.log(benchmarks.kgWriteComplex.report());
  console.log(benchmarks.kgWriteLarge.report());

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Observability Layers Performance                              ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(benchmarks.lineageTrace.report());
  console.log(benchmarks.lineageTraceComplex.report());
  console.log(benchmarks.lineageTraceLarge.report());
  console.log(benchmarks.anomalyReport.report());
  console.log(benchmarks.anomalyReportComplex.report());
  console.log(benchmarks.anomalyReportLarge.report());

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Full Stack Performance (End-to-End)                           ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(benchmarks.fullStack.report());
  console.log(benchmarks.fullStackComplex.report());
  console.log(benchmarks.fullStackLarge.report());

  // Summary and throughput analysis
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Throughput Analysis                                           ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  const simpleFullStack = benchmarks.fullStack.getStats();
  const complexFullStack = benchmarks.fullStackComplex.getStats();
  const largeFullStack = benchmarks.fullStackLarge.getStats();

  const throughputSimple = 1000 / simpleFullStack.mean;
  const throughputComplex = 1000 / complexFullStack.mean;
  const throughputLarge = 1000 / largeFullStack.mean;

  console.log(`
  Simple Payload (2 records, 1 provider):
    Throughput: ${throughputSimple.toFixed(1)} persons/sec
    Latency (mean): ${simpleFullStack.mean.toFixed(2)}ms

  Complex Payload (20 records, 3 providers):
    Throughput: ${throughputComplex.toFixed(1)} persons/sec
    Latency (mean): ${complexFullStack.mean.toFixed(2)}ms

  Large Payload (100 records, 4 providers):
    Throughput: ${throughputLarge.toFixed(1)} persons/sec
    Latency (mean): ${largeFullStack.mean.toFixed(2)}ms

  Scaling Factor:
    Simple → Complex: ${(complexFullStack.mean / simpleFullStack.mean).toFixed(1)}x
    Complex → Large: ${(largeFullStack.mean / complexFullStack.mean).toFixed(1)}x
  `);

  // Memory usage summary
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Memory Usage Summary                                          ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  const memSimple = benchmarks.fullStack.getStats();
  const memComplex = benchmarks.fullStackComplex.getStats();
  const memLarge = benchmarks.fullStackLarge.getStats();

  console.log(`
  Simple Payload: ${memSimple.memMean.toFixed(2)}MB avg (min: ${memSimple.memMin.toFixed(2)}, max: ${memSimple.memMax.toFixed(2)})
  Complex Payload: ${memComplex.memMean.toFixed(2)}MB avg (min: ${memComplex.memMin.toFixed(2)}, max: ${memComplex.memMax.toFixed(2)})
  Large Payload: ${memLarge.memMean.toFixed(2)}MB avg (min: ${memLarge.memMin.toFixed(2)}, max: ${memLarge.memMax.toFixed(2)})

  Peak Heap Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB
  `);

  // Latency SLA compliance
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  SLA Compliance (P95 < 50ms, P99 < 100ms)                     ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  const slas = [
    { name: "Simple Payload", stats: simpleFullStack },
    { name: "Complex Payload", stats: complexFullStack },
    { name: "Large Payload", stats: largeFullStack }
  ];

  for (const sla of slas) {
    const p95Status = sla.stats.p95 < 50 ? "✅ PASS" : "❌ FAIL";
    const p99Status = sla.stats.p99 < 100 ? "✅ PASS" : "❌ FAIL";

    console.log(`
  ${sla.name}:
    P95: ${sla.stats.p95.toFixed(2)}ms ${p95Status}
    P99: ${sla.stats.p99.toFixed(2)}ms ${p99Status}
    `);
  }

  console.log("Benchmark complete.");
}

// Export for CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceBenchmark();
}
