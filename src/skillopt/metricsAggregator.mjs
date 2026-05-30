import fs from "node:fs";
import path from "node:path";

const TELEMETRY_PATH = "./skillopt/telemetry.log.jsonl";
const METRICS_STATE_PATH = "./skillopt/metrics-state.json";
const AGGREGATE_PATH = "./skillopt/metrics-aggregate.json";

export async function aggregateSkillOptMetrics() {
  const telemetry = readTelemetry();
  const state = readMetricsState();

  const runtime = computeRuntimeMetrics(telemetry);
  const dataset = computeDatasetMetrics("./skillopt/data");

  const aggregate = {
    generatedAt: new Date().toISOString(),
    skill: {
      version: state.currentSkillVersion,
      lastDeployAt: state.lastDeployAt
    },
    validation: state.lastValidation,
    runtime,
    dataset,
    drift: computeDrift(state, runtime)
  };

  fs.writeFileSync(AGGREGATE_PATH, JSON.stringify(aggregate, null, 2));
  return aggregate;
}

function readTelemetry() {
  if (!fs.existsSync(TELEMETRY_PATH)) return [];
  return fs.readFileSync(TELEMETRY_PATH, "utf8")
    .trim()
    .split("
")
    .map(line => JSON.parse(line));
}

function readMetricsState() {
  if (!fs.existsSync(METRICS_STATE_PATH)) {
    return {
      currentSkillVersion: "unknown",
      lastDeployAt: null,
      lastValidation: {},
      thresholds: {}
    };
  }
  return JSON.parse(fs.readFileSync(METRICS_STATE_PATH, "utf8"));
}

function computeRuntimeMetrics(entries) {
  if (entries.length === 0) return {};

  const latencies = entries.map(e => e.runtimeLatencyMs).sort((a,b) => a-b);
  const p = q => latencies[Math.floor(q * latencies.length)];

  return {
    p50LatencyMs: p(0.5),
    p95LatencyMs: p(0.95),
    p99LatencyMs: p(0.99),
    meanInputSize: avg(entries.map(e => e.inputSize)),
    meanOutputSize: avg(entries.map(e => e.outputSize)),
    totalRedesigns: entries.length
  };
}

function computeDatasetMetrics(baseDir) {
  const splits = ["train", "val", "test"];
  const counts = {};

  for (const split of splits) {
    const dir = path.join(baseDir, split);
    counts[split] = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(f => f.endsWith(".json")).length
      : 0;
  }

  return counts;
}

function computeDrift(state, runtime) {
  const v = state.lastValidation || {};
  const t = state.thresholds || {};

  return {
    structural: v.structural - t.structural,
    heuristic: v.heuristic - t.heuristic,
    accessibility: v.accessibility - t.accessibility,
    determinism: v.determinism - t.determinism,
    latencyP95: runtime.p95LatencyMs
  };
}

function avg(arr) {
  return arr.reduce((a,b) => a+b, 0) / arr.length;
}
