import fetch from "node-fetch";

export type TorqueQueryResult = {
  path: string;
  repo: string;
  content: string;
  hybridScore: number;
  keywordScore?: number;
  vectorScore?: number;
};

export type TorqueQueryResponse = {
  query: string;
  count: number;
  results: TorqueQueryResult[];
};

const TORQUEQUERY_API_URL = process.env.TORQUEQUERY_API_URL ?? "http://localhost:5051";

async function torqueQuerySearch(
  query: string,
  mode: "hybrid" | "keyword" | "semantic" = "hybrid"
): Promise<TorqueQueryResponse> {
  const url = `${TORQUEQUERY_API_URL}/${mode}?q=${encodeURIComponent(query)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TorqueQuery error: ${response.statusText}`);
  }

  return (await response.json()) as TorqueQueryResponse;
}

export async function searchHybrid(query: string): Promise<TorqueQueryResult[]> {
  const response = await torqueQuerySearch(query, "hybrid");
  return response.results;
}

export async function searchKeyword(query: string): Promise<TorqueQueryResult[]> {
  const response = await torqueQuerySearch(query, "keyword");
  return response.results;
}

export async function searchSemantic(query: string): Promise<TorqueQueryResult[]> {
  const response = await torqueQuerySearch(query, "semantic");
  return response.results;
}

export function createTorqueQueryTool() {
  return {
    name: "torque_query",
    description:
      "Search code and documentation using hybrid keyword + semantic search. Returns grounded results for answering questions about codebase.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (keyword, symbol, semantic question, etc.)"
        },
        mode: {
          type: "string",
          description: "Search mode",
          enum: ["hybrid", "keyword", "semantic"],
          default: "hybrid"
        }
      },
      required: ["query"]
    },
    handler: async (input: Record<string, unknown>) => {
      const query = String(input.query);
      const mode = (input.mode as "hybrid" | "keyword" | "semantic") ?? "hybrid";

      const results = await torqueQuerySearch(query, mode);

      if (results.count === 0) {
        return {
          content: `No results found for query: "${query}"`,
          artifacts: []
        };
      }

      const topResults = results.results.slice(0, 5);
      const fileList = topResults.map(r => r.path).join("\n");

      return {
        content: `Found ${results.count} result(s) matching "${query}" (top 5 shown):\n\n${topResults
          .map(
            r =>
              `[${r.hybridScore.toFixed(3)}] ${r.path} (${r.repo})`
          )
          .join(
            "\n"
          )}\n\nFiles available for reading and analysis.`,
        artifacts: [
          {
            type: "torque_query_results",
            results: topResults
          }
        ]
      };
    }
  };
}

export default torqueQuerySearch;
