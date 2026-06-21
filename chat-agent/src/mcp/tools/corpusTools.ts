import { IntegrityChecker } from "../../corpus/introspection/IntegrityChecker";
import { DriftDetector } from "../../corpus/introspection/DriftDetector";
import { CorpusSummaryBuilder } from "../../corpus/introspection/CorpusSummary";
import { RecommendationsEngine } from "../../corpus/introspection/RecommendationsEngine";

const integrityChecker = new IntegrityChecker();
const driftDetector = new DriftDetector();
const summaryBuilder = new CorpusSummaryBuilder();
const recommendationsEngine = new RecommendationsEngine();

export const corpusSummaryTool = {
  name: "corpusSummary",
  description: "Get high-level corpus stats by phase, adapter, and subsystem.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  },
  async execute() {
    return await summaryBuilder.run();
  }
};

export const corpusIntegrityTool = {
  name: "corpusIntegrity",
  description: "Check corpus integrity across MinIO, Typesense, and Qdrant. Identifies missing indexes, embeddings, and hash mismatches.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  },
  async execute() {
    const issues = await integrityChecker.run();
    return {
      issues,
      count: issues.length,
      summary: {
        missingIndexes: issues.filter(i => i.type === "MISSING_INDEX").length,
        missingVectors: issues.filter(i => i.type === "MISSING_VECTOR").length,
        hashMismatches: issues.filter(i => i.type === "HASH_MISMATCH").length,
        missingMetadata: issues.filter(i => i.type === "MISSING_METADATA").length
      }
    };
  }
};

export const corpusDriftTool = {
  name: "corpusDrift",
  description: "Detect drift between raw documents and indexed/embedded state. Identifies stale embeddings and inconsistent metadata.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  },
  async execute() {
    const issues = await driftDetector.run();
    return {
      issues,
      count: issues.length,
      summary: {
        rawChanged: issues.filter(i => i.type === "RAW_CHANGED").length,
        embeddingStale: issues.filter(i => i.type === "EMBEDDING_STALE").length,
        metadataStale: issues.filter(i => i.type === "METADATA_STALE").length
      }
    };
  }
};

export const corpusRecommendationsTool = {
  name: "corpusRecommendations",
  description: "Generate corpus maintenance recommendations based on integrity checks, drift detection, and coverage analysis.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  },
  async execute() {
    const recommendations = await recommendationsEngine.run();
    return {
      recommendations,
      count: recommendations.length,
      byPriority: {
        HIGH: recommendations.filter(r => r.priority === "HIGH").length,
        MEDIUM: recommendations.filter(r => r.priority === "MEDIUM").length,
        LOW: recommendations.filter(r => r.priority === "LOW").length
      },
      byAction: {
        REINDEX: recommendations.filter(r => r.action === "REINDEX").length,
        REEMBED: recommendations.filter(r => r.action === "REEMBED").length,
        FIX_METADATA: recommendations.filter(r => r.action === "FIX_METADATA").length,
        EXPAND_CORPUS: recommendations.filter(r => r.action === "EXPAND_CORPUS").length
      }
    };
  }
};

export const corpusHealthTool = {
  name: "corpusHealth",
  description: "Get overall corpus health status including summary, integrity issues, and drift issues.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  },
  async execute() {
    const summary = await summaryBuilder.run();
    const integrityIssues = await integrityChecker.run();
    const driftIssues = await driftDetector.run();

    return {
      summary,
      integrityIssues: integrityIssues.length,
      driftIssues: driftIssues.length,
      status:
        integrityIssues.length === 0 && driftIssues.length === 0 ? "HEALTHY" : "NEEDS_ATTENTION",
      timestamp: new Date().toISOString()
    };
  }
};

export const corpusTools = [
  corpusSummaryTool,
  corpusIntegrityTool,
  corpusDriftTool,
  corpusRecommendationsTool,
  corpusHealthTool
];
