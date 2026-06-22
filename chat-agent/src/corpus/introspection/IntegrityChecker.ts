import { minioAdapter } from "../adapters/MinioAdapter";
import { typesenseAdapter } from "../adapters/TypesenseAdapter";
import { qdrantAdapter } from "../adapters/QdrantAdapter";

export interface CorpusIntegrityIssue {
  id: string;
  type: "MISSING_INDEX" | "MISSING_VECTOR" | "HASH_MISMATCH" | "MISSING_METADATA";
  details?: Record<string, any>;
}

export class IntegrityChecker {
  async run(): Promise<CorpusIntegrityIssue[]> {
    const issues: CorpusIntegrityIssue[] = [];

    try {
      // 1. Scan MinIO raw corpus
      const rawObjects = await minioAdapter.listObjects("cic-torquequery-raw");

      for (const obj of rawObjects) {
        const id = obj.name.replace(".raw", "");
        const rawMeta = await minioAdapter.getObjectMetadata("cic-torquequery-raw", obj.name);
        const sha256 = rawMeta?.["x-amz-meta-sha256"] as string | undefined;

        // 2. Check Typesense index
        let tsDoc;
        try {
          tsDoc = await typesenseAdapter.getDocument("docs_files", id);
        } catch {
          issues.push({ id, type: "MISSING_INDEX" });
        }

        // 3. Check Qdrant vector
        try {
          const qd = await qdrantAdapter.retrievePoints("docs_files_vectors", [id]);
          if (!qd || qd.length === 0) {
            issues.push({ id, type: "MISSING_VECTOR" });
          }
        } catch {
          issues.push({ id, type: "MISSING_VECTOR" });
        }

        // 4. Hash mismatch (check if tsDoc exists)
        if (tsDoc && sha256 && tsDoc.sha256 !== sha256) {
          issues.push({
            id,
            type: "HASH_MISMATCH",
            details: { raw: sha256, indexed: tsDoc.sha256 }
          });
        }

        // 5. Missing metadata (check if tsDoc exists)
        if (tsDoc && (!tsDoc.phase || !tsDoc.adapter)) {
          issues.push({ id, type: "MISSING_METADATA" });
        }
      }
    } catch (error) {
      console.error("IntegrityChecker error:", error);
    }

    return issues;
  }
}
