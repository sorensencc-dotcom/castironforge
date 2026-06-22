# Phase 3: Enable Agent Tools (Day 1 Evening / Day 2 Morning)

**Goal:** Wire the tool registry into chat-agent initialization so agents can call TorqueQuery.

**Timeline:** 2-3 hours (mostly wiring + testing).

**Owner:** Agent team.

---

## Prerequisites

✅ Typesense running (:8108)  
✅ Indexer running (watching files)  
✅ Search API running (:5050)  
✅ Embeddings running (:5053)  
✅ Gateway running (:5051)  

---

## 3.1: Verify Tool Registry

The tool registry should already exist at `chat-agent/src/tools/registry.ts`.

### Check Registry Exports

```bash
cd chat-agent
grep -E "export.*tools|export.*callTool|export.*ToolName" src/tools/registry.ts
```

**Expected output:**
```typescript
export const tools = {
  code_search: codeSearch,
  torque_query: torqueQuerySearch
};

export async function callTool(name: ToolName, query: string, options?: Record<string, unknown>) {
  // routes to appropriate tool
}

export const toolSchemas = [
  // schema for code_search
  // schema for torque_query
];

export function getToolSchema(name: ToolName) {
  // return schema
}
```

**Checklist:**
- [ ] `chat-agent/src/tools/registry.ts` exists
- [ ] Exports `tools`, `callTool`, `toolSchemas`, `getToolSchema`
- [ ] No TypeScript errors: `npm run type-check`

---

## 3.2: Integrate into Agent Initialization

The agent system needs access to all available tools.

### Update Agent Server Bootstrap

File: `chat-agent/src/server.ts`

Add tool registry initialization:

```typescript
import { tools, toolSchemas, callTool } from "./tools/registry.js";

// When initializing the express app or agent context:
app.locals.agentTools = tools;
app.locals.toolSchemas = toolSchemas;

// Make callTool globally available if needed
global.callTool = callTool;
```

### Make Tools Available to Agents

Agents need to import and use the tools:

```typescript
// In any agent file
import { callTool } from "../tools/registry.js";

export async function myAgent(query: Query) {
  // Agents call tools like this:
  const results = await callTool("torque_query", query.text, {
    mode: "hybrid"
  });
  
  // Use results...
  return response;
}
```

### Update Agent Context

Ensure all agents receive tool context:

```typescript
// In chat-agent/src/agents/index.ts or equivalent
import { tools, toolSchemas } from "../tools/registry.js";

export const agentContext = {
  tools,
  toolSchemas,
  callTool
};

// Agents can access via:
// import { agentContext } from "./index.js";
```

**Checklist:**
- [ ] Tool registry imported in server.ts
- [ ] tools and toolSchemas available to all agents
- [ ] callTool function accessible globally or via context
- [ ] No TypeScript errors: `npm run type-check`

---

## 3.3: Test Tool Calling

Create a test script to verify tools work:

File: `chat-agent/test-tools.ts`

```typescript
import { callTool } from "./src/tools/registry.js";

async function testTools() {
  console.log("Testing tool registry...\n");

  // Test 1: Code search (via Search API)
  console.log("1. Testing code_search tool...");
  try {
    const codeHits = await callTool("code_search", "WarmPoolManager", {
      queryBy: "symbols"
    });
    console.log(`   ✓ Found ${codeHits.length} results`);
  } catch (err) {
    console.error(`   ✗ Error:`, err);
  }

  // Test 2: TorqueQuery (via Gateway)
  console.log("\n2. Testing torque_query tool...");
  try {
    const torqueHits = await callTool("torque_query", "WarmPoolManager", {
      mode: "hybrid"
    });
    console.log(`   ✓ Found ${torqueHits.length} results`);
    if (torqueHits.length > 0) {
      console.log(`   Top result: ${torqueHits[0].path}`);
    }
  } catch (err) {
    console.error(`   ✗ Error:`, err);
  }

  // Test 3: Keyword vs Semantic vs Hybrid
  console.log("\n3. Testing all search modes...");
  const modes = ["keyword", "semantic", "hybrid"] as const;
  for (const mode of modes) {
    try {
      const results = await callTool("torque_query", "spawn", {
        mode
      });
      console.log(`   ${mode}: ${results.length} results`);
    } catch (err) {
      console.error(`   ${mode} error:`, err);
    }
  }

  console.log("\n✓ Tool registry test complete");
}

testTools().catch(console.error);
```

### Run the Test

```bash
cd chat-agent
npx ts-node test-tools.ts
```

**Expected output:**
```
Testing tool registry...

1. Testing code_search tool...
   ✓ Found 3 results

2. Testing torque_query tool...
   ✓ Found 3 results
   Top result: src/agents/WarmPoolManager.ts

3. Testing all search modes...
   keyword: 3 results
   semantic: 2 results
   hybrid: 3 results

✓ Tool registry test complete
```

**Checklist:**
- [ ] code_search tool is callable
- [ ] torque_query tool is callable
- [ ] Both return grounded results (file paths exist)
- [ ] All three search modes work

---

## 3.4: Example Agent Integration

Update existing agents to use tools.

### Example: WarmPoolAgent

File: `chat-agent/src/agents/warmPoolAgent.ts`

```typescript
import { callTool } from "../tools/registry.js";

export interface WarmPoolQuery {
  action: "explain" | "find" | "trace" | "list";
  query?: string;
}

export interface WarmPoolResponse {
  grounded: boolean;
  action: string;
  file?: string;
  repo?: string;
  content?: string;
  explanation?: string;
  error?: string;
}

export async function warmPoolAgentHandle(query: WarmPoolQuery): Promise<WarmPoolResponse> {
  try {
    switch (query.action) {
      case "explain": {
        // Query for WarmPoolManager definition
        const hits = await callTool("torque_query", "WarmPoolManager", {
          mode: "keyword"
        });

        if (hits.length === 0) {
          return { grounded: false, action: "explain", error: "WarmPoolManager not found" };
        }

        const file = hits[0];
        return {
          grounded: true,
          action: "explain",
          file: file.path,
          repo: file.repo,
          explanation: `WarmPoolManager is defined in ${file.path}. It manages browser instance pooling with methods for hydration, spawning, and destruction.`
        };
      }

      case "find": {
        // Find usages of query term
        const hits = await callTool("code_search", query.query || "spawn", {
          queryBy: "content,imports"
        });

        if (hits.length === 0) {
          return { grounded: false, action: "find", error: `No usages of '${query.query}' found` };
        }

        return {
          grounded: true,
          action: "find",
          content: `Found ${hits.length} usages of '${query.query}':\n${hits.map(h => `- ${h.path}`).join("\n")}`
        };
      }

      case "trace": {
        // Trace call chain
        const hits = await callTool("torque_query", query.query || "hydrate", {
          mode: "semantic"
        });

        if (hits.length === 0) {
          return { grounded: false, action: "trace", error: "No semantic matches found" };
        }

        return {
          grounded: true,
          action: "trace",
          content: `Semantic trace for '${query.query}':\n${hits.map(h => h.path).join("\n")}`
        };
      }

      case "list": {
        // List all related files
        const hits = await callTool("code_search", "", {
          queryBy: "phase",
          phase: "26"
        });

        return {
          grounded: true,
          action: "list",
          content: `Phase 26 files (${hits.length} total):\n${hits.slice(0, 5).map(h => `- ${h.path}`).join("\n")}...`
        };
      }

      default:
        return { grounded: false, action: "unknown", error: "Unknown action" };
    }
  } catch (err) {
    return { grounded: false, action: query.action, error: String(err) };
  }
}
```

### Test the Agent

```bash
# Create test file: chat-agent/test-agent.ts
import { warmPoolAgentHandle } from "./src/agents/warmPoolAgent.js";

async function test() {
  console.log("Testing WarmPoolAgent...\n");

  const result = await warmPoolAgentHandle({ action: "explain" });
  console.log("Action: explain");
  console.log("Grounded:", result.grounded);
  console.log("File:", result.file);
  console.log("Explanation:", result.explanation);
}

test().catch(console.error);
```

Run:
```bash
npx ts-node test-agent.ts
```

**Expected:**
```
Testing WarmPoolAgent...

Action: explain
Grounded: true
File: src/agents/WarmPoolManager.ts
Explanation: WarmPoolManager is defined in src/agents/WarmPoolManager.ts. It manages browser instance pooling...
```

**Checklist:**
- [ ] Agent imports callTool
- [ ] Agent calls torque_query or code_search
- [ ] Agent returns grounded: true with file paths
- [ ] No hallucinations (all paths exist in indexed code)

---

## 3.5: Update All Existing Agents

For each agent in `chat-agent/src/agents/`:

1. **Add import:**
   ```typescript
   import { callTool } from "../tools/registry.js";
   ```

2. **Query before answering:**
   ```typescript
   const hits = await callTool("torque_query", userQuery);
   if (hits.length === 0) {
     return { grounded: false, error: "Not found" };
   }
   ```

3. **Use results:**
   ```typescript
   const file = hits[0];
   return { grounded: true, file: file.path, content: file.content };
   ```

**Agents to update:**
- [ ] warmPoolAgent.ts
- [ ] adapterAgent.ts
- [ ] [other agents]

---

## 3.6: Verify Agent Grounding

Test each agent returns `grounded: true` with real file paths:

```bash
npm run test -- warmPoolAgent
npm run test -- adapterAgent
# etc.
```

**Expected output for each:**
```
✓ Agent grounded (file paths verified)
✓ No hallucinations detected
✓ All results backed by indexed code
```

**Checklist:**
- [ ] All agents have code search integration
- [ ] All agents return grounded: true/false appropriately
- [ ] All file paths exist and are verified
- [ ] No hallucinations in any responses

---

## 3.7: Wire into Chat API

Agents need to be accessible via the chat API.

### Update Chat Route

File: `chat-agent/src/router/chatAgentRouter.ts`

```typescript
import { agentContext } from "../agents/index.js";

// In route handler:
router.post("/chat", async (req, res) => {
  const { message, model } = req.body;
  
  // Make agent tools available to runtime
  const runtimeContext = {
    ...agentContext,
    callTool: agentContext.callTool
  };
  
  // Agents can now query during processing
  const response = await runtime.complete(message, {
    tools: runtimeContext.toolSchemas,
    context: runtimeContext
  });
  
  res.json(response);
});
```

**Checklist:**
- [ ] Agent tools passed to runtime
- [ ] Tool schemas available for LLM integration
- [ ] Runtime can invoke tools via callTool

---

## 3.8: Integration Checklist

Run comprehensive integration test:

```bash
# 1. Services running
ps aux | grep -E "typesense|search-api|embeddings|gateway"

# 2. Tool registry works
npx ts-node test-tools.ts

# 3. Agents work
npx ts-node test-agent.ts

# 4. API accessible
curl http://localhost:8000/health

# 5. Agents can query
curl -X POST http://localhost:8000/agents/warmpool \
  -H "Content-Type: application/json" \
  -d '{"action": "explain"}'
```

**Checklist:**
- [ ] All services running (4/4)
- [ ] Tool registry callable
- [ ] Agents callable
- [ ] Agents return grounded results
- [ ] No errors in logs

---

## Phase 3 Complete ✅

**Agent Grounding Enabled:**
- Agents can call `torque_query(query, mode)`
- Agents can call `code_search(query, options)`
- All agents return grounded: true/false
- No hallucinations (all facts verified against code)

**Ready for Phase 4 (Documentation)**

---

## Quick Reference

### Tool Usage (from agent code)

```typescript
import { callTool } from "../tools/registry.js";

// Keyword search (fast, structure-focused)
const hits = await callTool("code_search", "spawn", { queryBy: "symbols" });

// Hybrid search (balanced)
const hits = await callTool("torque_query", "WarmPoolManager", { mode: "hybrid" });

// Semantic search (concept-focused)
const hits = await callTool("torque_query", "how does hydration work", { mode: "semantic" });

// Check if grounded
if (hits.length > 0) {
  return { grounded: true, file: hits[0].path };
} else {
  return { grounded: false, error: "Not found" };
}
```

### Common Patterns

**Pattern: Find definition**
```typescript
const defs = await callTool("code_search", "WarmPoolManager", { queryBy: "symbols" });
const def = defs[0];
```

**Pattern: Find usages**
```typescript
const usages = await callTool("code_search", "WarmPoolManager", { queryBy: "imports,content" });
```

**Pattern: Find by phase**
```typescript
const phase26 = await callTool("code_search", "adapter", { phase: "26" });
```

**Pattern: Semantic understanding**
```typescript
const concept = await callTool("torque_query", "how does browser pooling work", { mode: "semantic" });
```

---

**Timeline:** 2-3 hours

**Owner:** Agent team

**Handoff Criteria:**
- [ ] All agents have code search integration
- [ ] All agents return grounded: true/false
- [ ] No hallucinations (all paths verified)
- [ ] Performance acceptable (queries < 2s)
- [ ] Ready for Phase 4 (documentation)
