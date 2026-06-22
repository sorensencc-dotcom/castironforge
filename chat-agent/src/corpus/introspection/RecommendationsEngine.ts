import { IntegrityChecker, CorpusIntegrityIssue } from "./IntegrityChecker";
import { DriftDetector, CorpusDriftIssue } from "./DriftDetector";
import { CorpusSummaryBuilder, CorpusSummary } from "./CorpusSummary";

export interface CorpusRecommendation {
  action: "REINDEX" | "REEMBED" | "FIX_METADATA" | "EXPAND_CORPUS";
  id?: string;
  target?: string;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export class RecommendationsEngine {
  private integrityChecker: IntegrityChecker;
  private driftDetector: DriftDetector;
  private summaryBuilder: CorpusSummaryBuilder;

  constructor() {
    this.integrityChecker = new IntegrityChecker();
    this.driftDetector = new DriftDetector();
    this.summaryBuilder = new CorpusSummaryBuilder();
  }

  async run(): Promise<CorpusRecommendation[]> {
    const recs: CorpusRecommendation[] = [];
    const seenTargets = new Set<string>();

    const integrity = await this.integrityChecker.run();
    const drift = await this.driftDetector.run();
    const summary = await this.summaryBuilder.run();

    // 1. Reindex documents with hash mismatch
    for (const issue of integrity.filter(i => i.type === "HASH_MISMATCH")) {
      recs.push({
        action: "REINDEX",
        id: issue.id,
        reason: "Hash mismatch between raw and indexed",
        priority: "HIGH"
      });
    }

    // 2. Re-embed stale vectors
    for (const issue of drift.filter(i => i.type === "EMBEDDING_STALE")) {
      recs.push({
        action: "REEMBED",
        id: issue.id,
        reason: "Embedding does not match raw document",
        priority: "HIGH"
      });
    }

    // 3. Fix missing metadata
    for (const issue of integrity.filter(i => i.type === "MISSING_METADATA")) {
      recs.push({
        action: "FIX_METADATA",
        id: issue.id,
        reason: "Missing phase/adapter tags",
        priority: "MEDIUM"
      });
    }

    // 4. Identify missing/stale vectors
    for (const issue of integrity.filter(i => i.type === "MISSING_VECTOR")) {
      recs.push({
        action: "REEMBED",
        id: issue.id,
        reason: "Document not embedded in Qdrant",
        priority: "HIGH"
      });
    }

    // 5. Identify missing indexes
    for (const issue of integrity.filter(i => i.type === "MISSING_INDEX")) {
      recs.push({
        action: "REINDEX",
        id: issue.id,
        reason: "Document not indexed in Typesense",
        priority: "HIGH"
      });
    }

    // 6. Identify underrepresented phases/adapters (deduplicated)
    for (const [phase, count] of Object.entries(summary.byPhase)) {
      if (count < 3) {
        const target = `phase-${phase}`;
        if (!seenTargets.has(target)) {
          recs.push({
            action: "EXPAND_CORPUS",
            target,
            reason: "Phase underrepresented in corpus (< 3 docs)",
            priority: "LOW"
          });
          seenTargets.add(target);
        }
      }
    }

    for (const [adapter, count] of Object.entries(summary.byAdapter)) {
      if (count < 5) {
        const target = `adapter-${adapter}`;
        if (!seenTargets.has(target)) {
          recs.push({
            action: "EXPAND_CORPUS",
            target,
            reason: "Adapter underrepresented in corpus (< 5 docs)",
            priority: "LOW"
          });
          seenTargets.add(target);
        }
      }
    }

    return recs;
  }
}
