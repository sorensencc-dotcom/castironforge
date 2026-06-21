import fetch from "node-fetch";

export type CodeSearchResult = {
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

export type CodeSearchResponse = {
  query: string;
  count: number;
  results: CodeSearchResult[];
};

export type CodeSearchOptions = {
  queryBy?: string;
  repo?: string;
  language?: string;
  phase?: string;
  adapter?: string;
  perPage?: number;
};

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:5050";

async function codeSearch(
  query: string,
  options: CodeSearchOptions = {}
): Promise<CodeSearchResponse> {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("query_by", options.queryBy ?? "content,symbols,imports");

  if (options.repo) params.set("repo", options.repo);
  if (options.language) params.set("language", options.language);
  if (options.phase) params.set("phase", options.phase);
  if (options.adapter) params.set("adapter", options.adapter);
  if (options.perPage) params.set("per_page", String(options.perPage));

  const url = `${SEARCH_API_URL}/search?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Search API error: ${response.statusText}`);
  }

  return (await response.json()) as CodeSearchResponse;
}

export async function findSymbol(
  symbolName: string,
  repo?: string
): Promise<CodeSearchResult[]> {
  const response = await codeSearch(symbolName, {
    queryBy: "symbols,functions,classes",
    repo
  });
  return response.results;
}

export async function findImports(
  moduleName: string,
  repo?: string
): Promise<CodeSearchResult[]> {
  const response = await codeSearch(moduleName, {
    queryBy: "imports",
    repo
  });
  return response.results;
}

export async function findPhaseCode(
  query: string,
  phase: string,
  repo?: string
): Promise<CodeSearchResult[]> {
  const response = await codeSearch(query, {
    queryBy: "content,symbols",
    phase,
    repo
  });
  return response.results;
}

export async function findAdapterCode(
  query: string,
  adapter: string,
  repo?: string
): Promise<CodeSearchResult[]> {
  const response = await codeSearch(query, {
    queryBy: "content,symbols",
    adapter,
    repo
  });
  return response.results;
}

export async function findTodos(repo?: string): Promise<CodeSearchResult[]> {
  const response = await codeSearch("TODO", {
    queryBy: "todos,content",
    repo
  });
  return response.results;
}

export function createCodeSearchTool() {
  return {
    name: "code_search",
    description:
      "Search code files across repositories. Returns file paths and metadata. Use for grounding answers in real code.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (keyword, symbol name, etc.)"
        },
        queryBy: {
          type: "string",
          description:
            'Fields to search: "content", "symbols", "functions", "classes", "imports", "exports", "todos" (default: "content,symbols,imports")',
          enum: [
            "content",
            "symbols",
            "functions",
            "classes",
            "imports",
            "exports",
            "todos",
            "content,symbols,imports"
          ]
        },
        repo: {
          type: "string",
          description: "Filter by repository name (e.g., 'cic', 'castironforge')"
        },
        phase: {
          type: "string",
          description: "Filter by CIC phase number (e.g., '27', '26')"
        },
        adapter: {
          type: "string",
          description:
            "Filter by adapter name (e.g., 'WarmPoolManager', 'CloakBrowserAdapter')"
        }
      },
      required: ["query"]
    },
    handler: async (input: Record<string, unknown>) => {
      const query = String(input.query);
      const options: CodeSearchOptions = {
        queryBy: input.queryBy ? String(input.queryBy) : undefined,
        repo: input.repo ? String(input.repo) : undefined,
        phase: input.phase ? String(input.phase) : undefined,
        adapter: input.adapter ? String(input.adapter) : undefined
      };

      const result = await codeSearch(query, options);

      if (result.count === 0) {
        return {
          content: `No results found for query: "${query}"`,
          artifacts: []
        };
      }

      const fileList = result.results.map(r => r.path).join("\n");
      const metadata = result.results
        .map(r => `${r.path} (${r.language} - ${r.repo})`)
        .join("\n");

      return {
        content: `Found ${result.count} file(s) matching "${query}":\n\n${metadata}`,
        artifacts: [
          {
            type: "code_search_results",
            results: result.results
          }
        ]
      };
    }
  };
}

export default codeSearch;
