import { client } from "./typesenseClient.js";
import { log } from "./logger.js";

const COLLECTION_NAME = "code_files";

const schema = {
  name: COLLECTION_NAME,
  fields: [
    { name: "path", type: "string", facet: true },
    { name: "repo", type: "string", facet: true },
    { name: "language", type: "string", facet: true },
    { name: "content", type: "string" },
    { name: "symbols", type: "string[]" },
    { name: "imports", type: "string[]" },
    { name: "exports", type: "string[]" },
    { name: "functions", type: "string[]" },
    { name: "classes", type: "string[]" },
    { name: "phase", type: "string", facet: true },
    { name: "adapter", type: "string", facet: true },
    { name: "todos", type: "string[]" },
    { name: "modified", type: "int64", facet: true },
    { name: "size", type: "int32", facet: true },
    { name: "hash", type: "string" }
  ],
  default_sorting_field: "modified"
};

export const ensureSchema = async () => {
  try {
    await client.collections(COLLECTION_NAME).retrieve();
    log("Typesense collection exists:", COLLECTION_NAME);
  } catch {
    log("Creating Typesense collection:", COLLECTION_NAME);
    await client.collections().create(schema as any);
  }
};

export const COLLECTION = COLLECTION_NAME;
