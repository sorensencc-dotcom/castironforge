# GLM-5 CIC Integration Router

Deterministic, multi-phase GLM-5 integration for CIC (Cast Iron Charlie).

## Architecture Overview

### Core Components

1. **CICRouter** - Task classification and model routing
   - Classifies requests (DOM edits, code changes, refactors, searches)
   - Routes to appropriate GLM-5 variant (5.1, 5.2, or base)
   - Assembles unified context frames

2. **GLM5Client** - Unified GLM-5 API client
   - Calls all GLM-5 variants with deterministic parameters
   - Enforces reasoning effort and thinking mode settings
   - Implements fallback logic (GLM-5.2 → GLM-5.1 on failure)
   - Logs observability metrics

3. **TorqueQueryGLM5Adapter** - Search integration bridge
   - **Ingestion**: Corpus → GLM-5.2 → Hierarchical summaries, entities, index hints
   - **Query**: User query + TorqueQuery results → GLM-5 → Answer/refactor plan
   - Converts GLM-5 output to BM25 terms, vector anchors, and dependency graphs

4. **PromptPacks** - Role-specific prompt templates
   - DOM/Design editing (GLM-5.1/5.2)
   - Code editing (GLM-5.2)
   - Refactor planning (GLM-5.2)
   - Search/Q&A (GLM-5.1/5.2)
   - CIC Orchestration (GLM-5.1)

## Usage

### Installation

```bash
npm install @castironforge/glm5-router
```

### Basic Usage

```typescript
import { CICRouter, GLM5Client, TorqueQueryGLM5Adapter } from "@castironforge/glm5-router";

// Initialize components
const glm5Client = new GLM5Client(process.env.GLM5_API_KEY, logger);
const router = new CICRouter(glm5Client, logger);

// Classify a chat request
const envelope = {
  session_id: "sess_123",
  user_message: "Make the header background darker",
  mode: "edit",
  active_component: "Header",
};

const classification = await router.classify(envelope);
const decision = router.route(classification);

// Assemble context and execute
const context = await router.assembleContext(envelope);
const result = await router.execute(decision, context, prompt);
```

### TorqueQuery Integration

```typescript
const adapter = new TorqueQueryGLM5Adapter(glm5Client, indexer, logger);

// Ingest a corpus slice
const ingestionOutput = await adapter.ingest({
  corpus_id: "corpus_123",
  slice_id: "slice_456",
  tokens_estimate: 500000,
  documents: [
    { doc_id: "src/App.tsx", type: "code", content: "..." },
    { doc_id: "docs/architecture.md", type: "doc", content: "..." },
  ],
});

// Query the indexed corpus
const answer = await adapter.query({
  query_id: "query_789",
  user_query: "Where is the NavBar component used?",
  results: [
    { doc_id: "src/App.tsx", score: 0.92, content: "..." },
  ],
});
```

## Routing Rules

| Task Type | Scope | Model | Reasoning Effort |
|-----------|-------|-------|------------------|
| DOM Edit | local | GLM-5.1 | high |
| DOM Edit | multi_file | GLM-5.2 | high |
| Design Variant | - | GLM-5.2 | high |
| Code Edit | local | GLM-5.2 | high |
| Code Edit | repo_scale | GLM-5.2 | max |
| Refactor | multi_file | GLM-5.2 | high |
| Refactor | repo_scale | GLM-5.2 | max |
| Search | local | GLM-5.1 | high |
| Search | repo_scale | GLM-5.2 | high |
| CIC Task | - | GLM-5.1 | max |

## Unified Edit Protocol

All GLM-5 responses follow a strict JSON schema:

### DOM Edit
```json
{
  "action": "dom_edit",
  "target": { "selector": "#header", "component": "Header" },
  "patches": [
    { "path": "style.backgroundColor", "value": "#001133" }
  ],
  "explanation": "Darken header background for contrast"
}
```

### Code Edit
```json
{
  "action": "code_edit",
  "file": "src/components/NavBar.tsx",
  "diff": "--- a/src/...\n+++ b/src/...\n",
  "explanation": "Extracted responsive logic into a hook"
}
```

### Refactor Plan
```json
{
  "action": "refactor_plan",
  "scope": "repo_scale",
  "steps": [
    {
      "id": "extract_layout",
      "description": "Extract shared layout into LayoutShell component",
      "files": ["src/pages/Home.tsx", "src/pages/About.tsx"]
    }
  ]
}
```

### Search Answer
```json
{
  "action": "answer",
  "response": "NavBar is used in Home.tsx and About.tsx",
  "locations": ["src/pages/Home.tsx:45", "src/pages/About.tsx:30"]
}
```

## Configuration

```typescript
const router = new CICRouter(glm5Client, logger, {
  model_thresholds: {
    context_size_long: 65536,      // 64k tokens
    context_size_very_long: 131072, // 128k tokens
  },
  default_reasoning_effort: "high",
  enable_thinking: false,
});
```

## Observability

All GLM-5 calls are logged with:
- Model variant (5.1, 5.2, base)
- Reasoning effort
- Enable thinking flag
- Context size
- Latency
- Success/failure status
- Error details (if failed)

```typescript
interface CallObservability {
  call_id: string;
  timestamp: number;
  model: ModelVariant;
  reasoning_effort: ReasoningEffort;
  latency_ms: number;
  success: boolean;
  error?: string;
}
```

## Error Handling & Fallbacks

- **GLM-5.2 failure**: Automatically retry with GLM-5.1 and reduced context
- **JSON parsing failure**: Log error and request schema correction from model
- **Context overflow**: Shrink context and retry with smaller model

## Development

```bash
# Build
npm run build

# Watch
npm run dev

# Type check
npm run type-check

# Test
npm run test
```

## Integration Points

### With CIC Orchestrator
The router feeds classification and routing decisions to the CIC Orchestrator for multi-phase workflows.

### With Chat Engine
Chat requests flow: ChatEditSession → CICRouter → GLM-5 → Edit Protocol → DOMPatch/CodeEdit

### With TorqueQuery
Ingestion: Corpus → Adapter → GLM-5.2 → Index metadata
Query: TorqueQuery results → Adapter → GLM-5 → Answer/Plan

## References

- [GLM-5 Technical Specification](https://docs.example.com/glm5)
- [CIC Architecture](../../../docs/ARCHITECTURE.md)
- [Unified Edit Protocol](./docs/EDIT_PROTOCOL.md)
