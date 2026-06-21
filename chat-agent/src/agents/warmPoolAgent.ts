import { callTool } from "../tools/registry.js";
import { searchKeyword } from "../tools/torqueQuerySearch.js";

export type WarmPoolQuery = {
  action: "explain" | "find" | "trace" | "list";
  target?: string;
};

export type WarmPoolResponse = {
  grounded: boolean;
  file?: string;
  repo?: string;
  phase?: string;
  content?: string;
  explanation?: string;
  results?: Array<{
    path: string;
    repo: string;
    phase?: string;
  }>;
};

async function explainWarmPool(content: string): Promise<string> {
  return (
    "WarmPoolManager:\n" +
    "- Maintains a warm pool of browser instances\n" +
    "- Pre-spawns browsers to reduce latency\n" +
    "- Manages lifecycle (spawn, hydrate, cleanup)\n" +
    "- See: " +
    content.substring(0, 200) +
    "..."
  );
}

export async function warmPoolAgentHandle(query: WarmPoolQuery): Promise<WarmPoolResponse> {
  try {
    const hits = await searchKeyword("WarmPoolManager");

    if (hits.length === 0) {
      return {
        grounded: false,
        explanation: "WarmPoolManager not found in codebase"
      };
    }

    const top = hits[0];

    switch (query.action) {
      case "explain": {
        const explanation = await explainWarmPool(top.content);
        return {
          grounded: true,
          file: top.path,
          repo: top.repo,
          explanation
        };
      }

      case "find": {
        const targetHits = target ? await searchKeyword(query.target || "WarmPoolManager") : hits;
        return {
          grounded: true,
          results: targetHits.map(h => ({
            path: h.path,
            repo: h.repo,
            phase: h.phase
          }))
        };
      }

      case "trace": {
        const importHits = await callTool("code_search", "WarmPoolManager", {
          queryBy: "imports"
        });
        return {
          grounded: true,
          file: top.path,
          repo: top.repo,
          results: importHits
        };
      }

      case "list": {
        return {
          grounded: true,
          results: hits.map(h => ({
            path: h.path,
            repo: h.repo,
            phase: h.phase
          }))
        };
      }

      default:
        return { grounded: false };
    }
  } catch (err) {
    return {
      grounded: false,
      explanation: `Error: ${String(err)}`
    };
  }
}
