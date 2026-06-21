import express, { Request, Response } from "express";
import cors from "cors";
import { CONFIG } from "./config.js";
import { client } from "./typesenseClient.js";

const app = express();

app.use(cors());
app.use(express.json());

const COLLECTION = "code_files";

export type SearchResult = {
  path: string;
  repo?: string;
  language?: string;
  phase?: string;
  adapter?: string;
  symbols?: string[];
  imports?: string[];
  exports?: string[];
  functions?: string[];
  classes?: string[];
};

export type SearchResponse = {
  query: string;
  count: number;
  results: SearchResult[];
};

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/search", async (req: Request, res: Response) => {
  try {
    const {
      q,
      repo,
      language,
      phase,
      adapter,
      query_by = "content,symbols,imports",
      per_page = 20,
      page = 1
    } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const filters: string[] = [];

    if (repo && typeof repo === "string") {
      filters.push(`repo:=${repo}`);
    }

    if (language && typeof language === "string") {
      filters.push(`language:=${language}`);
    }

    if (phase && typeof phase === "string") {
      filters.push(`phase:=${phase}`);
    }

    if (adapter && typeof adapter === "string") {
      filters.push(`adapter:=${adapter}`);
    }

    const searchParams: any = {
      q,
      query_by: typeof query_by === "string" ? query_by : "content,symbols,imports",
      per_page: Math.min(Number(per_page) || 20, 100),
      page: Number(page) || 1
    };

    if (filters.length > 0) {
      searchParams.filter_by = filters.join(" && ");
    }

    const result = await client
      .collections(COLLECTION)
      .documents()
      .search(searchParams);

    const results: SearchResult[] = (result.hits ?? []).map((hit: any) => {
      const doc = hit.document;
      return {
        path: doc.path,
        repo: doc.repo,
        language: doc.language,
        phase: doc.phase || undefined,
        adapter: doc.adapter || undefined,
        symbols: doc.symbols,
        imports: doc.imports,
        exports: doc.exports,
        functions: doc.functions,
        classes: doc.classes
      };
    });

    const response: SearchResponse = {
      query: q,
      count: results.length,
      results
    };

    res.json(response);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.get("/search/facets", async (req: Request, res: Response) => {
  try {
    const searchParams: any = {
      q: "*",
      facet_by: "repo,language,phase,adapter",
      per_page: 0
    };

    const result = await client
      .collections(COLLECTION)
      .documents()
      .search(searchParams);

    res.json(result.facet_counts || {});
  } catch (err) {
    console.error("Facets error:", err);
    res.status(500).json({ error: String(err) });
  }
});

const port = CONFIG.server.port;
const host = CONFIG.server.host;

app.listen(port, host, () => {
  console.log(`Search API running on http://${host}:${port}`);
  console.log(`Typesense backend: ${CONFIG.typesense.protocol}://${CONFIG.typesense.host}:${CONFIG.typesense.port}`);
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  process.exit(0);
});
