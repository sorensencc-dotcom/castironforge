/**
 * TorqueQuery ↔ GLM-5 Adapter
 * filename: TorqueQueryGLM5Adapter.ts
 * date: 2026-06-17
 * semver: 0.1.0
 */

import {
  IngestionInput,
  IngestionOutput,
  QueryInput,
  AdapterOutput,
  EditProtocol,
} from "../types/index.js";

interface Logger {
  info(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
}

interface GLM5Client {
  call(
    model: string,
    prompt: string,
    options: { reasoning_effort: string; enable_thinking: boolean }
  ): Promise<string>;
}

interface Indexer {
  indexBM25(docId: string, terms: string[]): Promise<void>;
  indexVectors(docId: string, summary: string, anchors: string[]): Promise<void>;
  indexGraph(relations: Array<{ from: string; to: string; type: string }>): Promise<void>;
}

export class TorqueQueryGLM5Adapter {
  constructor(
    private readonly glm5Client: GLM5Client,
    private readonly indexer: Indexer,
    private readonly logger: Logger
  ) {}

  async ingest(slice: IngestionInput): Promise<IngestionOutput> {
    this.logger.info(`Ingesting slice ${slice.slice_id}`, {
      corpus_id: slice.corpus_id,
      tokens_estimate: slice.tokens_estimate,
      doc_count: slice.documents.length,
    });

    const prompt = this.buildIngestionPrompt(slice);

    try {
      const glmOutput = await this.glm5Client.call("glm-5.2", prompt, {
        reasoning_effort: "high",
        enable_thinking: false,
      });

      const parsed: IngestionOutput = JSON.parse(glmOutput);

      // Index the results
      for (const file of parsed.files) {
        await this.indexer.indexBM25(file.doc_id, file.index_hints.bm25_terms);
        await this.indexer.indexVectors(
          file.doc_id,
          file.summary,
          file.index_hints.semantic_anchors
        );
        if (file.relations.length > 0) {
          await this.indexer.indexGraph(file.relations);
        }
      }

      this.logger.info(`Ingestion complete for slice ${slice.slice_id}`, {
        files_indexed: parsed.files.length,
      });

      return parsed;
    } catch (error) {
      this.logger.error(`Ingestion failed for slice ${slice.slice_id}`, { error });
      throw error;
    }
  }

  async query(input: QueryInput): Promise<EditProtocol | AdapterOutput> {
    this.logger.info(`Processing query ${input.query_id}`, {
      user_query: input.user_query,
      result_count: input.results.length,
    });

    const frame = this.buildContextFrame(input);
    const prompt = this.buildQueryPrompt(frame);

    // Route based on context size
    const model = input.results.length > 3 ? "glm-5.2" : "glm-5.1";

    try {
      const glmOutput = await this.glm5Client.call(model, prompt, {
        reasoning_effort: "max",
        enable_thinking: false,
      });

      const parsed = JSON.parse(glmOutput) as EditProtocol;

      this.logger.debug(`Query ${input.query_id} complete`, {
        action: parsed.action,
        model,
      });

      return parsed;
    } catch (error) {
      this.logger.error(`Query processing failed for ${input.query_id}`, { error });
      throw error;
    }
  }

  private buildIngestionPrompt(slice: IngestionInput): string {
    const docsSummary = slice.documents
      .map(
        (doc) =>
          `[${doc.type}] ${doc.doc_id}\n${doc.content.substring(0, 500)}${doc.content.length > 500 ? "..." : ""}`
      )
      .join("\n\n---\n\n");

    return `You are an ingestion engine for a hybrid search system.
Given a large corpus slice, produce hierarchical summaries, key entities, relationships, and index hints.

Return ONLY valid JSON matching this schema:
{
  "corpus_id": string,
  "slice_id": string,
  "global_summary": string,
  "files": [
    {
      "doc_id": string,
      "summary": string,
      "entities": string[],
      "relations": [{ "from": string, "to": string, "type": string }],
      "index_hints": {
        "bm25_terms": string[],
        "semantic_anchors": string[]
      }
    }
  ]
}

CORPUS SLICE:
Corpus ID: ${slice.corpus_id}
Slice ID: ${slice.slice_id}
Token Estimate: ${slice.tokens_estimate}

Documents:
${docsSummary}

Analyze the corpus. For each document:
1. Write a concise summary (1-2 sentences)
2. Extract key entities (APIs, components, services, routes, types)
3. Identify relationships and dependencies
4. Generate BM25 terms (lexical search hints)
5. Generate semantic anchors (conceptual summaries for vector search)

Return ONLY the JSON response.`;
  }

  private buildQueryPrompt(frame: AdapterOutput): string {
    const docsSummary = frame.top_docs
      .map((doc) => `[${doc.doc_id}]\n${doc.content.substring(0, 300)}...`)
      .join("\n\n---\n\n");

    return `You are the reasoning layer on top of a hybrid search engine.
Given the user query and retrieved context, respond with a structured answer.

Return ONLY valid JSON matching one of these schemas:

Answer schema:
{
  "action": "answer",
  "response": string,
  "locations": string[]
}

Refactor plan schema:
{
  "action": "refactor_plan",
  "steps": [
    { "description": string, "files": string[] }
  ]
}

Query: "${frame.user_query}"

Retrieved Context:
${docsSummary}

Entities: ${(frame.entities || []).join(", ")}
Summaries: ${(frame.summaries || []).join(" ")}

Respond based on the query:
- If asking "where is X used?", return locations of all usages
- If asking to refactor, propose a step-by-step plan
- Otherwise, provide a clear answer grounded in the context

Return ONLY the JSON response.`;
  }

  private buildContextFrame(input: QueryInput): AdapterOutput {
    return {
      user_query: input.user_query,
      top_docs: input.results.map((r) => ({
        doc_id: r.doc_id,
        content: r.content,
      })),
      summaries: input.metadata?.global_summaries,
      entities: input.metadata?.entities,
    };
  }
}

export { Logger, GLM5Client, Indexer };
