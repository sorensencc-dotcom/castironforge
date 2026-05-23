import { randomUUID } from "crypto";
import { loadLivingDocsConfig } from "./config.js";
import { scanLivingDocsSource } from "./fsScanner.js";
import { parseLivingDocFile } from "./parser.js";
import {
  LivingDocsImportResult,
  LivingDocFile,
  LivingDoc
} from "./types.js";
import {
  logLivingDocsStart,
  logLivingDocsEnd,
  logLivingDocsError,
  logLivingDocsDocParsed
} from "./logging.js";

export async function runLivingDocsImport(): Promise<LivingDocsImportResult> {
  const cfg = loadLivingDocsConfig();
  const now = new Date().toISOString();

  if (!cfg.enabled) {
    return {
      runId: "living_docs_disabled",
      startedAt: now,
      finishedAt: now,
      sources: cfg.sources,
      files: [],
      docs: [],
      errors: []
    };
  }

  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  logLivingDocsStart(runId, cfg.sources);

  const files: LivingDocFile[] = [];
  const docs: LivingDoc[] = [];
  const errors: { path: string; message: string }[] = [];

  for (const source of cfg.sources) {
    const discovered = await scanLivingDocsSource(source);
    files.push(...discovered);
  }

  for (const file of files) {
    try {
      const doc = await parseLivingDocFile(file);
      docs.push(doc);
      logLivingDocsDocParsed(doc);
    } catch (err: any) {
      const message = err?.message || String(err);
      errors.push({ path: file.absolutePath, message });
      logLivingDocsError(file.absolutePath, message);
    }
  }

  const finishedAt = new Date().toISOString();
  logLivingDocsEnd(runId, files.length, docs.length);

  return {
    runId,
    startedAt,
    finishedAt,
    sources: cfg.sources,
    files,
    docs,
    errors
  };
}
