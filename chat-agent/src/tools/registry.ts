import codeSearch from "./codeSearch.js";
import torqueQuerySearch from "./torqueQuerySearch.js";

export type ToolName = "code_search" | "torque_query";

export const tools = {
  code_search: codeSearch,
  torque_query: torqueQuerySearch
};

export async function callTool(name: ToolName, query: string, options?: Record<string, unknown>) {
  if (name === "code_search") {
    return await codeSearch(query, options as any);
  } else if (name === "torque_query") {
    return await torqueQuerySearch(query, (options?.mode as any) ?? "hybrid");
  }
  throw new Error(`Unknown tool: ${name}`);
}

export const toolSchemas = [
  {
    name: "code_search",
    description:
      "Search code files across repositories using keyword search on content, symbols, imports, and exports. Returns file paths and metadata.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (keyword, symbol name, etc.)"
        },
        queryBy: {
          type: "string",
          enum: ["content", "symbols", "functions", "classes", "imports", "exports", "todos"],
          description: "Field to search in (default: content,symbols,imports)"
        },
        repo: {
          type: "string",
          description: "Filter by repository name"
        },
        phase: {
          type: "string",
          description: "Filter by CIC phase number"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "torque_query",
    description:
      "Hybrid code/documentation search combining keyword and semantic search. Use for complex queries, logic questions, and conceptual lookups.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query (keyword, symbol, semantic question, e.g. 'how does hydration work')"
        },
        mode: {
          type: "string",
          enum: ["hybrid", "keyword", "semantic"],
          default: "hybrid",
          description:
            "Search mode: hybrid (default), keyword (structure/symbols), or semantic (meaning/logic)"
        }
      },
      required: ["query"]
    }
  }
];

export function getToolSchema(name: ToolName) {
  return toolSchemas.find(s => s.name === name);
}
