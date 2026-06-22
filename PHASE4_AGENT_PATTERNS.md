# Phase 4: Create Agent Grounding Pattern (Day 2)

**Goal:** Document and implement the canonical agent grounding pattern so all agents can be updated consistently.

**Timeline:** 3-4 hours (mostly writing examples + updating agents).

**Owner:** Agent team + DevOps.

---

## What is the Grounding Pattern?

**Before Phase 26:** Agents guess about code structure
```typescript
const answer = "WarmPoolManager is probably in pool.ts";
// Wrong! File doesn't exist. Hallucination.
```

**After Phase 26:** Agents query first, answer second
```typescript
const hits = await callTool("torque_query", "WarmPoolManager");
if (hits.length === 0) {
  return { grounded: false, error: "WarmPoolManager not found" };
}
const answer = `WarmPoolManager is in ${hits[0].path}`;
// Correct! File exists. Grounded answer.
```

**Pattern:** Query → Verify → Answer (with evidence)

---

## 4.1: Create Agent Template

File: `chat-agent/src/agents/AGENT_TEMPLATE.ts`

```typescript
import { callTool, ToolName } from "../tools/registry.js";

/**
 * Template for any CIC agent that grounds reasoning in verified code.
 *
 * Pattern:
 * 1. Receive user query
 * 2. Query TorqueQuery for facts
 * 3. Check if results exist (grounding check)
 * 4. Use results to answer with confidence
 * 5. Return grounded: true/false
 */

export interface TemplateAgentQuery {
  action: string;
  query?: string;
  mode?: "keyword" | "semantic" | "hybrid";
  // Add agent-specific fields
}

export interface TemplateAgentResponse {
  grounded: boolean;  // ← Key field: is answer backed by code?
  action: string;
  file?: string;      // ← From search results
  repo?: string;      // ← From search results
  content?: string;   // ← From search results (excerpt)
  explanation?: string;
  error?: string;
  confidence?: number; // 0-1, based on search score
}

/**
 * Main agent handler
 *
 * CRITICAL: All responses must set grounded: true or grounded: false
 * - grounded: true → backed by search results (verified against code)
 * - grounded: false → couldn't find code or error occurred
 *
 * Never guess or hallucinate when grounded: false
 */
export async function templateAgentHandle(query: TemplateAgentQuery): Promise<TemplateAgentResponse> {
  const action = query.action || "default";

  try {
    // ============ STEP 1: Query for facts ============
    // Use appropriate tool based on query type
    const searchQuery = query.query || "";
    const searchMode = query.mode || "hybrid";

    let hits;
    if (searchMode === "keyword" || searchMode === "semantic") {
      // Use specific mode
      hits = await callTool("torque_query", searchQuery, { mode: searchMode });
    } else {
      // Default: hybrid (keyword + semantic)
      hits = await callTool("torque_query", searchQuery, { mode: "hybrid" });
    }

    // ============ STEP 2: Verify grounding ============
    if (hits.length === 0) {
      // No results = not grounded
      return {
        grounded: false,
        action,
        error: `No results found for query: "${searchQuery}"`
      };
    }

    // ============ STEP 3: Extract evidence ============
    const topResult = hits[0];
    const file = topResult.path;
    const repo = topResult.repo;
    const content = topResult.content;
    const score = topResult.hybridScore ?? 0.5;

    // ============ STEP 4: Answer with confidence ============
    // Implement agent-specific logic here
    const explanation = await generateExplanation(topResult, action);

    // ============ STEP 5: Return grounded response ============
    return {
      grounded: true,  // ← All results backed by code
      action,
      file,
      repo,
      content: content.substring(0, 500),  // Truncate for brevity
      explanation,
      confidence: score  // 0-1 based on search score
    };
  } catch (err) {
    // Error = not grounded
    return {
      grounded: false,
      action,
      error: `Error during search: ${String(err)}`
    };
  }
}

/**
 * Helper: Generate explanation from search results
 * Customize per agent
 */
async function generateExplanation(result: any, action: string): Promise<string> {
  const path = result.path;
  const symbols = result.symbols ?? [];
  const functions = result.functions ?? [];

  return `
Found in ${path}:
- Symbols: ${symbols.slice(0, 3).join(", ")}
- Functions: ${functions.slice(0, 3).join(", ")}
- File size: ${result.size} bytes
  `.trim();
}

// ============ EXAMPLE: Agent-specific actions ============

/**
 * Action: Explain what this symbol/file does
 */
export async function explainAction(query: TemplateAgentQuery): Promise<TemplateAgentResponse> {
  // Query for the symbol
  const hits = await callTool("torque_query", query.query || "", { mode: "semantic" });

  if (hits.length === 0) {
    return { grounded: false, action: "explain", error: "Not found" };
  }

  return {
    grounded: true,
    action: "explain",
    file: hits[0].path,
    repo: hits[0].repo,
    explanation: `${query.query} is a ${hits[0].classes?.length ? "class" : "function"} that handles code operations in ${hits[0].repo}.`
  };
}

/**
 * Action: Find all usages of this symbol
 */
export async function findUsagesAction(query: TemplateAgentQuery): Promise<TemplateAgentResponse> {
  // Search for imports + content references
  const hits = await callTool("code_search", query.query || "", {
    queryBy: "imports,content"
  });

  if (hits.length === 0) {
    return { grounded: false, action: "find-usages", error: "No usages found" };
  }

  const files = hits.map(h => h.path);
  return {
    grounded: true,
    action: "find-usages",
    content: `Found ${hits.length} usages in:\n${files.join("\n")}`
  };
}

/**
 * Action: Find by phase/adapter
 */
export async function findByPhaseAction(query: TemplateAgentQuery): Promise<TemplateAgentResponse> {
  // Search with phase filter
  const hits = await callTool("code_search", query.query || "", {
    phase: "26"
  });

  if (hits.length === 0) {
    return { grounded: false, action: "find-phase", error: "No Phase 26 code found" };
  }

  return {
    grounded: true,
    action: "find-phase",
    content: `Phase 26 results (${hits.length} files):\n${hits.slice(0, 5).map(h => h.path).join("\n")}`
  };
}

// ============ EXAMPLE: Dispatch based on action ============

export async function handleAction(query: TemplateAgentQuery): Promise<TemplateAgentResponse> {
  switch (query.action) {
    case "explain":
      return explainAction(query);
    case "find-usages":
      return findUsagesAction(query);
    case "find-phase":
      return findByPhaseAction(query);
    default:
      return templateAgentHandle(query);
  }
}
```

### Template Key Points

✅ **Every response has `grounded: true/false`**
✅ **Grounded responses have file paths from search results**
✅ **Ungrounded responses have error explaining why**
✅ **Error handling catches and returns grounded: false**
✅ **Confidence score from search result (0-1)**

**Checklist:**
- [ ] Template created at `chat-agent/src/agents/AGENT_TEMPLATE.ts`
- [ ] Template demonstrates 5-step pattern (Query → Verify → Extract → Answer → Return)
- [ ] Example actions provided (explain, find-usages, find-phase)
- [ ] All responses properly grounded or error-handled

---

## 4.2: Update Existing Agents

For each agent in `chat-agent/src/agents/`:

### Example: Update WarmPoolAgent

**Before:**
```typescript
export async function explainWarmPool() {
  return "WarmPoolManager manages browser instances in a pool";
  // ^ Guess! No evidence!
}
```

**After:**
```typescript
import { callTool } from "../tools/registry.js";

export interface WarmPoolResponse {
  grounded: boolean;
  file?: string;
  content?: string;
  explanation?: string;
  error?: string;
}

export async function explainWarmPool(): Promise<WarmPoolResponse> {
  try {
    // Step 1: Query for facts
    const hits = await callTool("torque_query", "WarmPoolManager", {
      mode: "keyword"
    });

    // Step 2: Verify grounding
    if (hits.length === 0) {
      return {
        grounded: false,
        error: "WarmPoolManager not found"
      };
    }

    // Step 3: Extract evidence
    const file = hits[0];

    // Step 4: Answer with confidence
    const explanation = `
WarmPoolManager (in ${file.path}):
- Manages browser instance pooling
- Key functions: ${file.functions?.slice(0, 3).join(", ")}
- Imported by: ${file.imports?.length ?? 0} files
    `.trim();

    // Step 5: Return grounded response
    return {
      grounded: true,
      file: file.path,
      content: file.content.substring(0, 500),
      explanation
    };
  } catch (err) {
    return {
      grounded: false,
      error: String(err)
    };
  }
}
```

### Update Checklist (Per Agent)

For each agent:
- [ ] Add `import { callTool } from "../tools/registry.js"`
- [ ] Add response interface with `grounded: boolean`
- [ ] Implement query → verify → extract → answer → return pattern
- [ ] Handle errors with `grounded: false`
- [ ] Add confidence score from search result
- [ ] Test with `npm run test -- agentName`

**Agents to update:**
- [ ] warmPoolAgent.ts
- [ ] adapterAgent.ts
- [ ] [other agents]

---

## 4.3: Verify Grounding

### Unit Test per Agent

File: `chat-agent/test-grounding.ts`

```typescript
import { explainWarmPool } from "./src/agents/warmPoolAgent.js";
import { explainAdapter } from "./src/agents/adapterAgent.js";
// Import all agent functions

async function testGrounding() {
  console.log("Testing agent grounding...\n");

  // Test 1: WarmPool Agent
  console.log("1. WarmPoolAgent.explainWarmPool()");
  const result1 = await explainWarmPool();
  verifyGrounding(result1, "WarmPoolManager");

  // Test 2: Adapter Agent
  console.log("\n2. AdapterAgent.explainAdapter()");
  const result2 = await explainAdapter();
  verifyGrounding(result2, "Adapter");

  // Test 3: Agent with no results
  console.log("\n3. Testing error case (should have grounded: false)");
  const result3 = await queryNonexistent();
  verifyUngrounded(result3);

  console.log("\n✓ All grounding tests passed!");
}

function verifyGrounding(response: any, expectedKeyword: string) {
  if (!response.grounded) {
    console.error(`  ✗ NOT GROUNDED: ${response.error}`);
    process.exit(1);
  }

  if (!response.file) {
    console.error(`  ✗ Missing file path`);
    process.exit(1);
  }

  if (!response.file.includes(".ts") && !response.file.includes(".js")) {
    console.error(`  ✗ Invalid file path: ${response.file}`);
    process.exit(1);
  }

  console.log(`  ✓ Grounded: ${response.file}`);
  console.log(`  ✓ Confidence: ${response.confidence ?? "N/A"}`);
  console.log(`  ✓ Explanation: ${response.explanation?.substring(0, 80)}...`);
}

function verifyUngrounded(response: any) {
  if (response.grounded === true) {
    console.error(`  ✗ Should not be grounded`);
    process.exit(1);
  }

  if (!response.error) {
    console.error(`  ✗ Missing error message`);
    process.exit(1);
  }

  console.log(`  ✓ Correctly ungrounded`);
  console.log(`  ✓ Error: ${response.error}`);
}

testGrounding().catch(console.error);
```

### Run Tests

```bash
cd chat-agent
npx ts-node test-grounding.ts
```

**Expected output:**
```
Testing agent grounding...

1. WarmPoolAgent.explainWarmPool()
  ✓ Grounded: src/agents/WarmPoolManager.ts
  ✓ Confidence: 0.892
  ✓ Explanation: WarmPoolManager (in src/agents/WarmPoolManager.ts)...

2. AdapterAgent.explainAdapter()
  ✓ Grounded: src/adapters/cloakBrowserAdapter.ts
  ✓ Confidence: 0.876
  ✓ Explanation: CloakBrowserAdapter (in src/adapters/...)...

3. Testing error case (should have grounded: false)
  ✓ Correctly ungrounded
  ✓ Error: No results found for query: "nonexistent_symbol_12345"

✓ All grounding tests passed!
```

**Checklist:**
- [ ] All agents tested
- [ ] All return grounded: true/false
- [ ] grounded: true always has file paths
- [ ] File paths verified to exist
- [ ] No hallucinations detected

---

## 4.4: Documentation Updates

### Update Agent Development Guide

File: `docs/AGENT_DEVELOPMENT.md` (or update existing)

```markdown
# Agent Development Guide

## Grounding Your Agent in Code

Every agent should query for facts before answering.

### Quick Start

```typescript
import { callTool } from "../tools/registry.js";

export async function myAgent(query) {
  // Step 1: Query for facts
  const hits = await callTool("torque_query", query, { mode: "hybrid" });

  // Step 2: Check if grounded
  if (hits.length === 0) {
    return { grounded: false, error: "Not found" };
  }

  // Step 3: Use results
  const file = hits[0];
  return {
    grounded: true,
    file: file.path,
    explanation: `Found in ${file.path}`
  };
}
```

### Pattern: 5 Steps

1. **Query:** `await callTool("torque_query", query)`
2. **Verify:** Check results exist (`hits.length > 0`)
3. **Extract:** Get file path, content, metadata
4. **Answer:** Use verified facts to explain
5. **Return:** Include `grounded: true/false` in response

### Search Modes

- **keyword** — Fast, structure-focused (symbols, imports)
- **semantic** — Slow, concept-focused ("how does X work")
- **hybrid** — Balanced (default, recommended)

### Common Patterns

```typescript
// Find symbol definition
const defs = await callTool("torque_query", "WarmPoolManager", { mode: "keyword" });

// Find usages
const usages = await callTool("code_search", "spawn", { queryBy: "imports,content" });

// Find by phase
const phase26 = await callTool("code_search", "adapter", { phase: "26" });

// Semantic search
const concept = await callTool("torque_query", "how does hydration work", { mode: "semantic" });
```

### Response Format

```typescript
{
  grounded: true,          // ← Required
  file: string,            // ← If grounded: true
  repo: string,            // ← Optional
  content: string,         // ← First 500 chars
  explanation: string,     // ← Explanation of findings
  confidence: number,      // ← 0-1 from search score
  error?: string           // ← If grounded: false
}
```

### Error Handling

Always handle `grounded: false`:

```typescript
const hits = await callTool("torque_query", query);

if (hits.length === 0) {
  return {
    grounded: false,
    error: `No results for: ${query}`
  };
}

// Safe to access hits[0]
```

### Testing

Test your agent for grounding:

```bash
npx ts-node test-agent.ts
```

Verify:
- [ ] Returns grounded: true with file paths
- [ ] File paths exist and are verified
- [ ] No hallucinations (all facts grounded)
- [ ] Errors handled gracefully

## Template

See `src/agents/AGENT_TEMPLATE.ts` for a complete example.
```

**Checklist:**
- [ ] Agent development guide created/updated
- [ ] Quick start example provided
- [ ] 5-step pattern documented
- [ ] Common patterns shown
- [ ] Response format defined
- [ ] Error handling explained
- [ ] Testing instructions included

### Update README files

Add "Agent Grounding" section to relevant READMEs:

```markdown
## Agent Grounding (Phase 26)

All agents must ground reasoning in verified code.

**Before answering, agents:**
1. Query TorqueQuery for code facts
2. Verify results exist
3. Extract file paths and metadata
4. Answer with verified facts
5. Return grounded: true/false

**Result:** No hallucinations. All facts verified against indexed code.

**Get started:** See `docs/AGENT_DEVELOPMENT.md`
```

---

## 4.5: Integration with Chat API

Ensure agents are properly exposed via API.

### Update Chat Endpoint

File: `chat-agent/src/router/chatAgentRouter.ts`

```typescript
import { agentContext } from "../agents/index.js";

router.post("/agents/:agentName", async (req, res) => {
  const { agentName } = req.params;
  const query = req.body;

  try {
    // Get agent handler
    const agent = getAgent(agentName);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Call agent with tool context
    const response = await agent(query, agentContext);

    // Verify response is grounded
    if (response.grounded === undefined) {
      return res.status(500).json({
        error: "Agent must return grounded: true/false"
      });
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({
      grounded: false,
      error: String(err)
    });
  }
});

function getAgent(name: string) {
  const agents: Record<string, any> = {
    warmpool: warmPoolAgentHandle,
    adapter: adapterAgentHandle,
    // Add all agents
  };
  return agents[name.toLowerCase()];
}
```

**Checklist:**
- [ ] Agents accessible via API
- [ ] Response includes grounded field
- [ ] Errors handled with grounded: false
- [ ] Tools available to all agents

---

## 4.6: Monitoring & Observability

Add metrics for agent grounding.

### Grounding Metrics

```typescript
// In agent handler:
const groundingMetric = {
  agent: agentName,
  action: query.action,
  grounded: response.grounded,
  confidence: response.confidence,
  latency: endTime - startTime,
  timestamp: new Date()
};

// Log to metrics system
emitMetric("agent_grounding", groundingMetric);
```

**Metrics to Track:**
- `agent_grounded_total` — Count by agent, grounded: true/false
- `agent_grounding_latency_ms` — Time to ground answer
- `agent_confidence_score` — Average confidence per agent
- `agent_errors_total` — Error count by type

### Observability Dashboard

Display:
- Grounding success rate per agent
- Average confidence scores
- Error trends
- Query latency per mode (keyword/semantic/hybrid)

**Checklist:**
- [ ] Grounding metrics emitted
- [ ] Dashboard shows grounding stats
- [ ] Alerts on low grounding rate
- [ ] Observability integrated

---

## Phase 4 Complete ✅

**Agent Grounding Pattern Established:**
- Template provided (AGENT_TEMPLATE.ts)
- All agents updated to use pattern
- All responses properly grounded
- Documentation comprehensive
- Testing in place
- Monitoring configured

**Key Achievement:**
- Agents query before answering
- All facts verified against code
- Zero hallucinations (grounded: false when no facts)
- Confidence scores from search results
- Full observability

**Ready for Phase 5 (Validation)**

---

## Grounding Pattern Summary

### The 5-Step Pattern

```typescript
// 1. Query for facts
const hits = await callTool("torque_query", query, { mode: "hybrid" });

// 2. Verify grounding
if (hits.length === 0) return { grounded: false, error: "..." };

// 3. Extract evidence
const file = hits[0];

// 4. Answer with confidence
const answer = `Found in ${file.path}: ...`;

// 5. Return grounded response
return { grounded: true, file: file.path, answer, confidence: file.score };
```

### Response Contract

```typescript
interface AgentResponse {
  grounded: boolean;  // ← REQUIRED
  file?: string;      // ← If grounded: true
  error?: string;     // ← If grounded: false
  confidence?: number; // ← Search score (0-1)
}
```

### Never Do This ❌

```typescript
// ❌ Guessing
return { answer: "WarmPoolManager is probably in pool.ts" };

// ❌ Missing grounded field
return { file: "src/agents/WarmPoolManager.ts" };

// ❌ Hallucinating when no results
const hits = await callTool(...);
if (hits.length === 0) {
  return { answer: "I think it's in xyz" };  // ← Wrong!
}
```

### Always Do This ✅

```typescript
// ✅ Query first
const hits = await callTool("torque_query", query);

// ✅ Check grounding
if (hits.length === 0) {
  return { grounded: false, error: "Not found" };
}

// ✅ Use verified facts
return {
  grounded: true,
  file: hits[0].path,
  answer: `Found in ${hits[0].path}`
};
```

---

**Timeline:** 3-4 hours

**Owner:** Agent team

**Handoff Criteria:**
- [ ] Template created and documented
- [ ] All agents updated to use pattern
- [ ] All responses properly grounded
- [ ] No hallucinations (test verified)
- [ ] Documentation complete
- [ ] Monitoring configured
- [ ] Ready for Phase 5 validation
