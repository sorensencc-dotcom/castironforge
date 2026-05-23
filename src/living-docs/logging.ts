import { LivingDocSourceConfig, LivingDocFile, LivingDoc } from "./types.js";

export function logLivingDocsStart(runId: string, sources: LivingDocSourceConfig[]): void {
  console.log("living_docs_start", {
    runId,
    sources: sources.map(s => ({ id: s.id, path: s.path }))
  });
}

export function logLivingDocsFileDiscovered(file: LivingDocFile): void {
  console.log("living_docs_file", {
    id: file.id,
    sourceId: file.sourceId,
    kind: file.kind,
    path: file.absolutePath
  });
}

export function logLivingDocsDocParsed(doc: LivingDoc): void {
  console.log("living_docs_parsed", {
    id: doc.id,
    sourceId: doc.sourceId,
    kind: doc.kind,
    path: doc.absolutePath,
    sectionCount: doc.sections.length,
    entityCount: doc.entities.length,
    timelineCount: doc.timeline.length
  });
}

export function logLivingDocsError(path: string, message: string): void {
  console.error("living_docs_error", { path, message });
}

export function logLivingDocsEnd(runId: string, fileCount: number, docCount: number): void {
  console.log("living_docs_end", {
    runId,
    fileCount,
    docCount
  });
}
