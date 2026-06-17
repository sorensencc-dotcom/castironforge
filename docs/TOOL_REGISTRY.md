# Tool Registry System

**Date:** 2026-06-17  
**Version:** 1.0.0  
**Status:** Specification

---

## Overview

The Tool Registry is a **source-of-truth catalog** of all available tools across CIC, Rewrite Labs, Chat Engine, and system utilities.

Rather than hardcoding tool availability, the registry:
- **Discovers** tools from multiple sources (JSON, ESM modules, MCP)
- **Validates** each tool against a strict schema
- **Routes** tasks to the best available tool + GLM-5 variant
- **Tracks** health, metrics, and usage per tool

---

## Architecture

### Four-Layer Design

```
┌──────────────────────────────────┐
│   Tool Registry Core             │
│   (source of truth catalog)      │
└──────────────────────────────────┘
         ↑        ↑        ↑
     ┌───┴────┬───┴────┬───┴────┐
     │        │        │        │
  ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
  │Loader│ │Router│ │Health│
  │      │ │      │ │Check │
  └──────┘ └──────┘ └──────┘
```

1. **Tool Registry** - In-memory catalog with persistence
2. **Loader** - Discovers tools from JSON, ESM, MCP
3. **Router** - Maps tasks to tools and models
4. **Observability** - Health, metrics, usage tracking

---

## Tool Descriptor Schema

Every tool is described by a **ToolDescriptor**:

```typescript
interface ToolDescriptor {
  id: ToolId;                         // Unique identifier
  group: "cic" | "labs" | "chat" | "search" | "system";
  name: string;                       // Human-readable name
  description: string;                // What the tool does
  version: string;                    // Semantic version (0.1.0)
  
  endpointType: "http" | "local" | "mcp";
  endpoint: string;                   // URL, module path, or MCP name
  
  inputSchema: object;                // JSON Schema for input
  outputSchema: object;               // JSON Schema for output
  
  capabilities: string[];             // ["read", "write", "search", ...]
  
  modelHints?: {
    preferredModel?: "glm-5.1" | "glm-5.2" | "glm-5";
    reasoningEffort?: "low" | "high" | "max";
    enableThinking?: boolean;
  };
  
  limits?: {
    maxCallsPerMinute?: number;
    maxConcurrent?: number;
    timeoutMs?: number;
  };
  
  tags?: string[];
  deprecated?: boolean;
  deprecationMessage?: string;
}
```

---

## Tool Groups

### CIC (Internal Development)

Tools for repo analysis, code generation, refactoring, and testing.

**Examples:**
- `cic_code_search` - Search for code patterns
- `cic_code_refactor` - Propose refactoring plans
- `cic_build_runner` - Execute build commands
- `cic_test_runner` - Run test suites

### Labs (Redesign Business)

Tools for site analysis, lead scoring, outreach, and redesign generation.

**Examples:**
- `labs_site_crawler` - Extract DOM and content
- `labs_design_analyzer` - Evaluate design quality
- `labs_lead_scorer` - Qualify leads (0-100)
- `labs_outreach_composer` - Generate pitch emails
- `labs_redesign_generator` - Create full redesigns

### Chat (Interactive UI)

Tools for real-time DOM editing, design variants, and code suggestions.

**Examples:**
- `chat_dom_editor` - Apply DOM changes
- `chat_design_variant_renderer` - Render design variations
- `chat_code_suggester` - Suggest code snippets

### Search (Cross-System)

Tools for hybrid search and retrieval.

**Examples:**
- `search_hybrid` - BM25 + vector search
- `search_knowledge_base` - Query documentation
- `search_code_patterns` - Find similar code

### System (Infrastructure)

Built-in system tools.

**Examples:**
- `system_health_check` - Tool registry health
- `system_observability` - Metrics and logging
- `system_mcp_bridge` - MCP tool integration

---

## Tool Capabilities

All tools are tagged with capabilities:

| Capability | Meaning | Used By |
|------------|---------|---------|
| `read` | Retrieves data (non-mutating) | All modes |
| `write` | Modifies data | CIC, Labs, Chat |
| `search` | Searches/retrieves | All modes |
| `refactor` | Refactors code | CIC |
| `design` | Generates designs | Labs, Chat |
| `build` | Runs builds | CIC |
| `test` | Runs tests | CIC |
| `harvest` | Crawls/extracts content | Labs |
| `score` | Evaluates/scores | Labs |
| `outreach` | Generates outreach | Labs |
| `classify` | Classifies content | All modes |

---

## Tool Discovery

### Discovery Sources

Tools are discovered from three sources:

#### 1. Static JSON/YAML Files

**Directory:** `services/glm5-router/tools/`

**Format:**
```json
[
  {
    "id": "cic_code_search",
    "group": "cic",
    "name": "Code Search",
    ...
  }
]
```

**Files:**
- `tools.cic.json` - CIC tools
- `tools.labs.json` - Labs tools
- `tools.chat.json` - Chat tools
- `tools.search.json` - Search tools
- `tools.system.json` - System tools

#### 2. ESM Modules

**Directory:** `services/glm5-router/tools/`

**Format:**
```typescript
export const descriptor: ToolDescriptor = {
  id: "cic_custom_tool",
  ...
};

// or

export default {
  id: "cic_custom_tool",
  ...
};

// or

export const tools: ToolDescriptor[] = [ ... ];
```

#### 3. MCP Manifests

**File:** `.mcp.json`

**Format:**
```json
{
  "mcpServers": {
    "my_server": {
      "tools": [
        {
          "name": "my_tool",
          "description": "...",
          "inputSchema": {}
        }
      ]
    }
  }
}
```

---

## Tool Routing

### Route Request

```typescript
interface ToolRouteRequest {
  mode: "cic" | "labs" | "chat";
  taskType: string;
  capabilities: ToolCapability[];
  preferredGroups?: ToolGroup[];
}
```

### Route Algorithm

1. **Filter by group** - Limit to mode's default groups (or preferred groups)
2. **Filter by capabilities** - Find tools with all required capabilities
3. **Exclude deprecated** - Skip deprecated tools
4. **Score candidates** - Rank by group match, model hints, capability match
5. **Select top candidate** - Return best-ranked tool
6. **Determine model** - Use tool hints or defaults for GLM-5 variant
7. **Return result** - Tool + model + reasoning parameters

### Route Result

```typescript
interface ToolRouteResult {
  tool: ToolDescriptor;
  model: "glm-5.1" | "glm-5.2" | "glm-5";
  modelParams: {
    reasoning_effort: "max" | "high" | "low";
    enable_thinking: boolean;
  };
}
```

---

## Default Model Selection

### CIC Mode

| Task Type | Model | Effort | Why |
|-----------|-------|--------|-----|
| `harvest`, `search` | GLM-5.2 | high | Long-context |
| `redesign`, `refactor` | GLM-5.2 | max | Deep reasoning |
| Other | GLM-5.1 | high | Fast |

### Labs Mode

| Task Type | Model | Effort | Why |
|-----------|-------|--------|-----|
| `redesign` | GLM-5.2 | max | Multi-page design |
| `harvest` | GLM-5.2 | high | Long-context |
| Other | GLM-5.1 | high | Fast |

### Chat Mode

| Task Type | Model | Effort | Why |
|-----------|-------|--------|-----|
| `design`, `refactor` | GLM-5.2 | high | Deep reasoning |
| Other | GLM-5.1 | high | Low latency |

---

## API Usage

### Initialize Registry

```typescript
import { initializeToolRegistry } from "./registry/index.js";

const { registry, loader, router } = await initializeToolRegistry({
  staticDir: "./tools",
  moduleDir: "./tools",
  mcpManifest: "./.mcp.json",
  logger: console,
});
```

### Register a Tool

```typescript
registry.register({
  id: "my_tool",
  group: "cic",
  name: "My Tool",
  description: "Does something useful",
  version: "0.1.0",
  endpointType: "local",
  endpoint: "./tools/MyTool.ts",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  capabilities: ["read", "search"],
});
```

### Get a Tool

```typescript
const tool = registry.get("cic_code_search");
console.log(tool);
```

### List Tools

```typescript
const cicTools = registry.list({ group: "cic" });
const searchTools = registry.getByCapability("search");
```

### Route a Task

```typescript
const route = router.route({
  mode: "cic",
  taskType: "refactor",
  capabilities: ["read", "refactor"],
});

console.log(route.tool.id);       // Selected tool
console.log(route.model);         // Selected model (glm-5.2)
console.log(route.modelParams);   // reasoning_effort, enable_thinking
```

### Get Recommendations

```typescript
const recommendations = router.getRecommendations(
  "labs",
  "redesign",
  ["design", "write"]
);

// Returns top 5 tools ranked by score
```

---

## Validation

All tool descriptors are validated at registration time:

**Required Fields:**
- `id` (string)
- `group` (valid group)
- `name` (string)
- `description` (string)
- `version` (semantic version)
- `endpointType` (http|local|mcp)
- `endpoint` (string)
- `inputSchema` (object)
- `outputSchema` (object)
- `capabilities` (array, non-empty)

**Valid Capabilities:**
read, write, search, refactor, design, build, test, harvest, score, outreach, classify

**Valid Groups:**
cic, labs, chat, search, system

**Model Hints (optional):**
- `preferredModel`: glm-5.1 | glm-5.2 | glm-5
- `reasoningEffort`: low | high | max
- `enableThinking`: boolean

**Limits (optional):**
- `maxCallsPerMinute`: number > 0
- `maxConcurrent`: number > 0
- `timeoutMs`: number > 0

---

## Health Checks

### HTTP Tools

```typescript
// Ping endpoint
GET {endpoint}/health
→ { status: "ok" }
```

### Local Tools

```typescript
// Test import/require
import tool from "{endpoint}";
→ Tool must export ToolDescriptor
```

### MCP Tools

```typescript
// Ping MCP server
mcp.ping("{toolId}")
→ { status: "ok" }
```

---

## Observability

### Per-Tool Metrics

```typescript
interface ToolMetrics {
  toolId: ToolId;
  callCount: number;
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  lastCalledAt?: number;
}
```

### Logging

Every tool call logs:

```json
{
  "timestamp": 1718658517000,
  "toolId": "cic_code_search",
  "requestId": "req_123...",
  "mode": "cic",
  "taskType": "refactor",
  "latencyMs": 245,
  "success": true,
  "tokens": { "input": 1200, "output": 450 }
}
```

---

## Example Tool Definitions

### CIC: Code Search

```json
{
  "id": "cic_code_search",
  "group": "cic",
  "name": "Code Search",
  "description": "Search for code patterns, functions, imports across repo",
  "version": "0.1.0",
  "endpointType": "local",
  "endpoint": "./tools/CICCodeSearch.ts",
  "inputSchema": {
    "type": "object",
    "required": ["query"],
    "properties": {
      "query": { "type": "string" }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "results": { "type": "array" }
    }
  },
  "capabilities": ["read", "search"],
  "modelHints": {
    "preferredModel": "glm-5.1",
    "reasoningEffort": "high"
  }
}
```

### Labs: Lead Scorer

```json
{
  "id": "labs_lead_scorer",
  "group": "labs",
  "name": "Lead Scorer",
  "description": "Rapidly score leads for redesign outreach",
  "version": "0.1.0",
  "endpointType": "local",
  "endpoint": "./tools/LabsLeadScorer.ts",
  "inputSchema": {
    "type": "object",
    "required": ["site", "company"],
    "properties": {
      "site": { "type": "string" },
      "company": { "type": "string" }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "score": { "type": "number", "minimum": 0, "maximum": 100 },
      "recommendation": { "type": "string" }
    }
  },
  "capabilities": ["score", "classify"],
  "modelHints": {
    "preferredModel": "glm-5.1",
    "reasoningEffort": "high"
  }
}
```

---

## Adding New Tools

### Step 1: Define Descriptor

Create `services/glm5-router/tools/tools.my-group.json`:

```json
[
  {
    "id": "my_tool_id",
    "group": "cic",
    "name": "My Tool",
    "description": "...",
    "version": "0.1.0",
    "endpointType": "local",
    "endpoint": "./tools/MyTool.ts",
    "inputSchema": {},
    "outputSchema": {},
    "capabilities": ["read"]
  }
]
```

### Step 2: Implement Tool

Create `services/glm5-router/tools/MyTool.ts`:

```typescript
export default {
  id: "my_tool_id",
  // ... descriptor
};

export async function execute(input: unknown) {
  // Tool implementation
  return output;
}
```

### Step 3: Restart

Registry loads tools at startup. Restart to pick up new tools.

---

## Future Extensions

- **Tool versioning**: Support multiple versions per tool
- **Tool dependencies**: Track tool-to-tool dependencies
- **Canary routing**: A/B test new tools before rollout
- **Tool marketplace**: Share tools across teams
- **Tool analytics**: Detailed per-tool cost/ROI tracking
- **Auto-scaling**: Scale tools based on demand

---

## References

- GLM-5 Integration: GLM5_INTEGRATION.md
- CIC ↔ Labs Integration: CIC_LABS_INTEGRATION.md
- Tool JSON Examples: services/glm5-router/tools/
