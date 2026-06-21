# CIC Agent Tooling Integration — TorqueQuery Usage Guide

Agent developers: use this guide to wire TorqueQuery into your agents so they stop guessing and start querying deterministic search results.

## Core Concept

**Rule of thumb:** If your agent needs facts about CIC's code, docs, or logs—call TorqueQuery first.

This eliminates hallucinations and grounds answers in real, searchable code.

---

## 1. Quick Start

### Import the tool registry

```typescript
import { callTool, ToolName } from "../tools/registry.js";
import { searchKeyword, searchHybrid } from "../tools/torqueQuerySearch.js";
```

### Search for code

```typescript
// Keyword search (best for symbols, imports, exact terms)
const hits = await searchKeyword("WarmPoolManager");

// Hybrid search (keyword + semantic)
const hits = await searchHybrid("how does hydration work");

// Via registry
const hits = await callTool("torque_query", "WarmPoolManager", { mode: "keyword" });
```

### Use the results

```typescript
if (hits.length > 0) {
  const top = hits[0];
  // top.path — file location
  // top.repo — repository
  // top.content — full file content
  // top.hybridScore — confidence (0-1)

  return {
    grounded: true,
    file: top.path,
    explanation: `Found in ${top.repo}: ${top.content.substring(0, 200)}`
  };
}
```

---

## 2. Tool Interface

### `searchKeyword(query: string): Promise<TorqueQueryResult[]>`

Keyword search—best for code structure, symbols, imports, exact terms.

```typescript
const hits = await searchKeyword("Phase 27");
// Returns files with "Phase 27" in content or metadata
```

### `searchHybrid(query: string): Promise<TorqueQueryResult[]>`

Hybrid search—combines keyword + semantic for balanced results.

```typescript
const hits = await searchHybrid("how does the browser pool work");
// Returns files matching both structure and meaning
```

### `searchSemantic(query: string): Promise<TorqueQueryResult[]>`

Semantic search—best for conceptual lookups, logic patterns.

```typescript
const hits = await searchSemantic("spawn and manage browser instances");
// Returns semantically similar files, even without exact term match
```

### `callTool(name: "code_search" | "torque_query", query, options)`

Generic tool calling interface.

```typescript
// Code search (Search API)
await callTool("code_search", "WarmPoolManager", { queryBy: "symbols" });

// TorqueQuery (gateway)
await callTool("torque_query", "WarmPoolManager", { mode: "keyword" });
```

### Result Type

```typescript
type TorqueQueryResult = {
  path: string;           // file path
  repo: string;           // repository name
  content: string;        // full file content
  hybridScore: number;    // fusion score (0-1)
  keywordScore?: number;  // keyword component
  vectorScore?: number;   // semantic component
};
```

---

## 3. Agent Wiring Pattern

### Basic pattern

```typescript
import { searchKeyword, searchHybrid } from "../tools/registry.js";

export async function myAgentHandle(query: MyQuery) {
  // Step 1: Search for facts
  const hits = await searchKeyword(query.symbol);

  // Step 2: Check if grounded
  if (hits.length === 0) {
    return { grounded: false, error: "Not found" };
  }

  // Step 3: Use results
  const top = hits[0];
  return {
    grounded: true,
    file: top.path,
    repo: top.repo,
    analysis: await analyze(top.content)
  };
}
```

### Example: WarmPoolManager Agent

```typescript
import { searchKeyword } from "../tools/registry.js";

export async function explainWarmPool(): Promise<string> {
  const hits = await searchKeyword("WarmPoolManager");

  if (hits.length === 0) {
    return "WarmPoolManager not found";
  }

  const file = hits[0];
  return (
    `WarmPoolManager found in ${file.path}:\n` +
    `${file.content.substring(0, 500)}\n` +
    `...`
  );
}
```

### Example: Adapter Agent

```typescript
import { searchKeyword } from "../tools/registry.js";
import { callTool } from "../tools/registry.js";

export async function findAdapterUsage(adapterName: string) {
  // Find adapter definition
  const definitions = await searchKeyword(adapterName);
  if (definitions.length === 0) return { error: "Adapter not found" };

  // Find usages (imports + content)
  const usages = await callTool("code_search", adapterName, {
    queryBy: "imports,content"
  });

  return {
    definition: definitions[0].path,
    usages: usages.map(u => u.path)
  };
}
```

---

## 4. LLM-Based Agent Integration

If you have an LLM-driven agent (Claude, GPT, etc.), expose TorqueQuery as a tool:

### Tool schema for LLM

```typescript
const tools = [
  {
    name: "torque_query",
    description:
      "Search CIC code and documentation using hybrid keyword + semantic search. Use for finding code definitions, explaining logic, finding usages.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'WarmPoolManager', 'how does hydration work')"
        },
        mode: {
          type: "string",
          enum: ["hybrid", "keyword", "semantic"],
          description:
            "Search mode. Use 'keyword' for symbols/imports, 'semantic' for logic/concepts, 'hybrid' for general search."
        }
      },
      required: ["query"]
    }
  }
];
```

### Tool calling loop

```typescript
function toolCall(name: string, input: any) {
  if (name === "torque_query") {
    return searchHybrid(input.query, input.mode ?? "hybrid");
  }
}

// LLM makes a tool call
const modelResponse = await llm.complete({
  messages,
  tools
});

if (modelResponse.toolCalls) {
  for (const call of modelResponse.toolCalls) {
    const result = toolCall(call.name, call.input);
    // Feed result back into model
    messages.push({ role: "tool", content: JSON.stringify(result) });
  }
}
```

---

## 5. Best Practices

### Do: Use TorqueQuery for facts

```typescript
// ✅ Good: agent queries for facts
const hits = await searchKeyword("spawn");
return { grounded: true, files: hits };

// ✅ Good: agent uses results to explain
const content = hits[0].content;
return { answer: await explain(content) };
```

### Don't: Guess or hallucinate

```typescript
// ❌ Bad: agent guesses file locations
return { file: "src/agents/something.ts" }; // guessed!

// ❌ Bad: agent invents behavior
return { explanation: "WarmPoolManager probably does..." }; // guessed!

// ✅ Good: agent queries first
const hits = await searchKeyword("WarmPoolManager");
if (hits.length > 0) {
  return { file: hits[0].path, grounded: true };
}
```

### Use appropriate search mode

| Search Mode | Use Case | Example |
|-------------|----------|---------|
| `keyword` | Symbols, imports, exact terms | `searchKeyword("hydrate")` |
| `semantic` | Logic, concepts, behavior | `searchSemantic("how to spawn browsers")` |
| `hybrid` | General-purpose, balanced | `searchHybrid("WarmPoolManager")` |

### Filter by repo/phase when relevant

```typescript
// Search only in CIC repo
const hits = await callTool("code_search", "Phase 27", {
  repo: "cic"
});

// Search by phase
const hits = await callTool("code_search", "adapter", {
  phase: "27"
});
```

---

## 6. Usage Patterns

### Pattern: Code explanation

```typescript
async function explainCode(symbol: string) {
  const hits = await searchKeyword(symbol);
  if (hits.length === 0) return `${symbol} not found`;

  const file = hits[0];
  return `
${symbol} is defined in ${file.path}:

${file.content.substring(0, 1000)}
...
  `;
}
```

### Pattern: Find usages

```typescript
async function findUsages(symbol: string) {
  return await callTool("code_search", symbol, {
    queryBy: "imports,content"
  });
}
```

### Pattern: Phase navigation

```typescript
async function findPhaseCode(phase: string, keyword: string) {
  return await callTool("code_search", keyword, {
    phase
  });
}
```

### Pattern: Adapter discovery

```typescript
async function findAdapter(adapterName: string) {
  const definitions = await searchKeyword(adapterName);
  const usages = await callTool("code_search", adapterName, {
    queryBy: "imports"
  });

  return {
    definition: definitions[0]?.path,
    usages: usages.map(u => u.path)
  };
}
```

### Pattern: Multi-step investigation

```typescript
async function investigateComponent(name: string) {
  // Step 1: Find definition
  const defs = await searchKeyword(name);
  if (defs.length === 0) return null;

  // Step 2: Find imports
  const imports = await callTool("code_search", name, {
    queryBy: "imports"
  });

  // Step 3: Find TODOs in files
  const todos = await callTool("code_search", "TODO", {
    queryBy: "todos"
  });

  return {
    definition: defs[0],
    importedBy: imports,
    pendingWork: todos
  };
}
```

---

## 7. Error Handling

Always handle empty results:

```typescript
const hits = await searchKeyword("SomeSymbol");

if (hits.length === 0) {
  return {
    grounded: false,
    error: "SomeSymbol not found in codebase"
  };
}

// Safe to access hits[0]
return {
  grounded: true,
  file: hits[0].path
};
```

---

## 8. Performance Considerations

- **Keyword search:** ~5-20ms (fast)
- **Semantic search:** ~50-100ms (medium)
- **Hybrid search:** ~100-150ms (combines both)

For agents:
- Use `keyword` by default (fastest)
- Use `hybrid` when keyword alone isn't enough
- Use `semantic` for conceptual queries ("how does X work")

---

## 9. Available Tools in Registry

```typescript
import { tools, callTool, ToolName } from "../tools/registry.js";

// Available tools
type ToolName = "code_search" | "torque_query";

// Direct imports
import codeSearch from "./codeSearch.js";
import torqueQuerySearch from "./torqueQuerySearch.js";

// Also available
import { searchHybrid, searchKeyword, searchSemantic } from "./torqueQuerySearch.js";
import { findSymbol, findImports, findPhaseCode } from "./codeSearch.js";
```

---

## 10. Integration Checklist

- [ ] Import tool registry in agent
- [ ] Query for facts before answering
- [ ] Check if results are grounded (hits.length > 0)
- [ ] Use result.path, result.repo, result.content
- [ ] Handle empty results gracefully
- [ ] Choose appropriate search mode (keyword/semantic/hybrid)
- [ ] Filter by repo/phase if relevant
- [ ] Return grounded: true when using search results
- [ ] Return grounded: false when falling back to defaults
- [ ] Test with real queries before deployment

---

## Quick Reference

### Imports

```typescript
import { callTool } from "../tools/registry.js";
import { searchKeyword, searchHybrid, searchSemantic } from "../tools/torqueQuerySearch.js";
```

### Common queries

```typescript
// Find symbol
await searchKeyword("WarmPoolManager");

// Find imports
await callTool("code_search", "puppeteer", { queryBy: "imports" });

// Find phase code
await callTool("code_search", "spawn", { phase: "27" });

// Semantic search
await searchHybrid("how does hydration work");
```

### Response structure

```typescript
{
  path: string;           // "src/agents/WarmPoolManager.ts"
  repo: string;           // "castironforge"
  content: string;        // full file content
  hybridScore: number;    // 0.892
  phase?: string;         // "27"
  adapter?: string;       // "WarmPoolManager"
}
```

---

**Next steps:**

1. Import tools in your agent
2. Call TorqueQuery before answering
3. Use results to ground your explanations
4. Test with real queries
5. Deploy with confidence (no more hallucinations!)

**Support:** See `TORQUEQUERY_PHASE26.md` for API details.
