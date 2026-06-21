import { callTool } from "../tools/registry.js";
import { searchKeyword, searchHybrid } from "../tools/torqueQuerySearch.js";

export type AdapterQuery = {
  adapterName: string;
  action: "list" | "explain" | "find-usage" | "find-phase";
  phase?: string;
};

export type AdapterResponse = {
  grounded: boolean;
  adapter?: string;
  phase?: string;
  results?: Array<{
    path: string;
    repo: string;
    score?: number;
    phase?: string;
  }>;
  explanation?: string;
};

async function generateAdapterSummary(
  adapterName: string,
  content: string
): Promise<string> {
  return (
    `Adapter: ${adapterName}\n` +
    `Purpose: Provides browser instance management and lifecycle control\n` +
    `Key methods: spawn, hydrate, cleanup, pool management\n` +
    `Implementation excerpt: ${content.substring(0, 300)}...`
  );
}

export async function adapterAgentHandle(query: AdapterQuery): Promise<AdapterResponse> {
  try {
    const { adapterName, action, phase } = query;

    switch (action) {
      case "list": {
        const hits = await searchKeyword(adapterName);
        return {
          grounded: true,
          adapter: adapterName,
          results: hits.map(h => ({
            path: h.path,
            repo: h.repo,
            phase: h.phase
          }))
        };
      }

      case "explain": {
        const hits = await searchKeyword(adapterName);
        if (hits.length === 0) {
          return {
            grounded: false,
            explanation: `Adapter ${adapterName} not found`
          };
        }

        const top = hits[0];
        const explanation = await generateAdapterSummary(adapterName, top.content);
        return {
          grounded: true,
          adapter: adapterName,
          explanation,
          results: hits.slice(0, 3).map(h => ({
            path: h.path,
            repo: h.repo,
            phase: h.phase
          }))
        };
      }

      case "find-usage": {
        const hits = await callTool("code_search", adapterName, {
          queryBy: "content,imports"
        });
        return {
          grounded: true,
          adapter: adapterName,
          results: hits
        };
      }

      case "find-phase": {
        if (!phase) {
          return { grounded: false, explanation: "Phase required for find-phase action" };
        }

        const hits = await callTool("code_search", adapterName, {
          queryBy: "symbols,content",
          phase
        });

        return {
          grounded: true,
          adapter: adapterName,
          phase,
          results: hits
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
