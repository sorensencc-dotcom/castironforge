import { typesenseAdapter } from "../adapters/TypesenseAdapter";

export interface CorpusSummary {
  byPhase: Record<string, number>;
  byAdapter: Record<string, number>;
  bySubsystem: Record<string, number>;
  totalDocs: number;
  timestamp: string;
}

export class CorpusSummaryBuilder {
  async run(): Promise<CorpusSummary> {
    const summary: CorpusSummary = {
      byPhase: {},
      byAdapter: {},
      bySubsystem: {},
      totalDocs: 0,
      timestamp: new Date().toISOString()
    };

    try {
      const searchResults = await typesenseAdapter.search("docs_files", {
        q: "*",
        query_by: "content",
        per_page: 5000
      });

      for (const hit of searchResults.hits || []) {
        const doc = hit.document;
        summary.totalDocs++;

        if (doc.phase) {
          summary.byPhase[doc.phase] = (summary.byPhase[doc.phase] || 0) + 1;
        }
        if (doc.adapter) {
          summary.byAdapter[doc.adapter] = (summary.byAdapter[doc.adapter] || 0) + 1;
        }
        if (doc.subsystem) {
          summary.bySubsystem[doc.subsystem] = (summary.bySubsystem[doc.subsystem] || 0) + 1;
        }
      }
    } catch (error) {
      console.error("CorpusSummaryBuilder error:", error);
    }

    return summary;
  }
}
