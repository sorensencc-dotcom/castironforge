import crypto from "crypto";
import { client } from "./typesenseClient.js";
import { COLLECTION } from "./schema.js";
import { extractMetadata, RawFileInfo } from "./metadataExtractor.js";
import { parseCode } from "./astParser.js";
import { log } from "./logger.js";

export type IndexedDocument = {
  id: string;
  path: string;
  repo: string;
  language: string;
  content: string;
  symbols: string[];
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
  phase: string;
  adapter: string;
  todos: string[];
  modified: number;
  size: number;
  hash: string;
};

export const indexFile = async (file: RawFileInfo) => {
  try {
    const meta = extractMetadata(file);
    const parsed = parseCode(file.path, meta.content);

    const hash = crypto.createHash("sha256").update(meta.content).digest("hex");

    const doc: IndexedDocument = {
      id: `${file.repo}/${file.path}`,
      path: file.path,
      repo: file.repo,
      language: parsed.language,
      content: meta.content,
      symbols: parsed.symbols,
      imports: parsed.imports,
      exports: parsed.exports,
      functions: parsed.functions,
      classes: parsed.classes,
      phase: meta.phase ?? "",
      adapter: meta.adapter ?? "",
      todos: meta.todos,
      modified: meta.modified,
      size: meta.size,
      hash
    };

    await client.collections(COLLECTION).documents().upsert(doc as any);
    log("✓ Indexed:", doc.id);
  } catch (err) {
    log("✗ Index error:", file.path, String(err));
  }
};

export const deleteFile = async (file: RawFileInfo) => {
  try {
    const id = `${file.repo}/${file.path}`;
    await client.collections(COLLECTION).documents(id).delete();
    log("✗ Deleted:", id);
  } catch (err) {
    log("✗ Delete error:", file.path, String(err));
  }
};
