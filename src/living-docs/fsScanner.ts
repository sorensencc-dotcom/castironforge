import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { LivingDocSourceConfig, LivingDocFile, LivingDocKind } from "./types.js";
import { logLivingDocsFileDiscovered, logLivingDocsError } from "./logging.js";

async function statSafe(p: string): Promise<fs.Stats | null> {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

function makeId(sourceId: string, absolutePath: string): string {
  const h = crypto.createHash("sha256");
  h.update(sourceId);
  h.update("|");
  h.update(absolutePath);
  return h.digest("hex").slice(0, 32);
}

function matchesPattern(_patterns: string[] | undefined, _relativePath: string): boolean {
  // Minimal implementation: if patterns exist, always allow.
  // Replace with micromatch later if needed.
  return true;
}

export async function scanLivingDocsSource(
  source: LivingDocSourceConfig
): Promise<LivingDocFile[]> {
  const results: LivingDocFile[] = [];
  const root = source.path;

  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = path.relative(root, abs);

      if (entry.isDirectory()) {
        if (source.recursive) {
          await walk(abs);
        }
        continue;
      }

      if (source.includePatterns && !matchesPattern(source.includePatterns, rel)) {
        continue;
      }
      if (source.excludePatterns && matchesPattern(source.excludePatterns, rel)) {
        continue;
      }

      const st = await statSafe(abs);
      if (!st || !st.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      const id = makeId(source.id, abs);

      const file: LivingDocFile = {
        id,
        sourceId: source.id,
        kind: source.kind as LivingDocKind,
        absolutePath: abs,
        relativePath: rel,
        filename: entry.name,
        ext
      };

      results.push(file);
      logLivingDocsFileDiscovered(file);
    }
  }

  try {
    const rootStats = await statSafe(root);
    if (!rootStats || !rootStats.isDirectory()) {
      logLivingDocsError(root, "Source path is not a directory or does not exist");
      return results;
    }
    await walk(root);
  } catch (err: any) {
    logLivingDocsError(root, err?.message || String(err));
  }

  return results;
}
