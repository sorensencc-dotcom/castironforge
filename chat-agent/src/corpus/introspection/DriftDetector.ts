import { minioAdapter } from "../adapters/MinioAdapter";
import { typesenseAdapter } from "../adapters/TypesenseAdapter";
import { qdrantAdapter } from "../adapters/QdrantAdapter";

export interface CorpusDriftIssue {
  id: string;
  type: "RAW_CHANGED" | "EMBEDDING_STALE" | "METADATA_STALE";
  details?: Record<string, any>;
}

export class DriftDetector {
  async run(): Promise<CorpusDriftIssue[]> {
    const issues: CorpusDriftIssue[] = [];

    try {
      const rawObjects = await minioAdapter.listObjects("cic-torquequery-raw");

      for (const obj of rawObjects) {
        const id = obj.name.replace(".raw", "");
        const rawMeta = await minioAdapter.getObjectMetadata("cic-torquequery-raw", obj.name);
        const rawSha256 = rawMeta?.["x-amz-meta-sha256"] as string | undefined;

        // 1. Typesense doc
        let tsDoc;
        try {
          tsDoc = await typesenseAdapter.getDocument("docs_files", id);
        } catch {
          continue;
        }

        // 2. Qdrant vector
        let vectorMeta;
        try {
          const qd = await qdrantAdapter.retrievePoints("docs_files_vectors", [id]);
          vectorMeta = qd?.[0]?.payload;
        } catch {
          continue;
        }

        // RAW_CHANGED
        if (rawSha256 && tsDoc.sha256 !== rawSha256) {
          issues.push({
            id,
            type: "RAW_CHANGED",
            details: { raw: rawSha256, indexed: tsDoc.sha256 }
          });
        }

        // EMBEDDING_STALE
        if (rawSha256 && vectorMeta?.sha256 !== rawSha256) {
          issues.push({
            id,
            type: "EMBEDDING_STALE",
            details: { raw: rawSha256, embedded: vectorMeta?.sha256 }
          });
        }

        // METADATA_STALE
        if (vectorMeta?.phase !== tsDoc.phase || vectorMeta?.adapter !== tsDoc.adapter) {
          issues.push({
            id,
            type: "METADATA_STALE",
            details: {
              typesense: { phase: tsDoc.phase, adapter: tsDoc.adapter },
              qdrant: { phase: vectorMeta?.phase, adapter: vectorMeta?.adapter }
            }
          });
        }
      }
    } catch (error) {
      console.error("DriftDetector error:", error);
    }

    return issues;
  }
}
