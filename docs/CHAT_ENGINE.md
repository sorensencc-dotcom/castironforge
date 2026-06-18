# Chat Engine Integration

**Date:** 2026-06-17  
**Status:** Complete  
**Semver:** 1.0.0

---

## Overview

The Chat Engine provides real-time interactive DOM and code editing through a unified GLM-5 pipeline. Users send chat messages, the engine routes them through classification and context assembly, calls GLM-5, validates responses against EditProtocol, and applies changes to the DOM or filesystem.

---

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────┐
│   ChatEngineService (HTTP)      │
│   - Session management          │
│   - Applicator delegation       │
│   - Result aggregation          │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   ChatEditSession               │
│   - GLM-5 pipeline orchestration│
│   - Turn history maintenance    │
│   - Undo/redo capability        │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   Applicators & Renderers       │
│   - DOMPatchApplicator          │
│   - CodeEditApplicator          │
│   - DesignVariantRenderer       │
└─────────────────────────────────┘
```

### Request Flow

```
User Message (ChatRequestEnvelope)
    ↓
ChatEngineService.processMessage()
    ├─ Create/retrieve ChatEditSession
    └─ Delegate to session.processMessage()
        ├─ Classify request (UnifiedRouter.classify)
        ├─ Route to model (UnifiedRouter.route)
        ├─ Assemble context (UnifiedRouter.assembleContext)
        ├─ Build prompt from classification
        ├─ Execute GLM-5 (UnifiedRouter.execute)
        ├─ Validate EditProtocol
        └─ Store in turn cache
    ├─ Apply edit based on action type
    └─ Return ChatResponse
        ├─ session_id
        ├─ turn_id
        ├─ edit_protocol (action + payload)
        ├─ application_result (success/message)
        └─ metadata (duration, model, tokens)
```

---

## Components

### ChatEngineService

**Purpose:** Main HTTP coordinator for session management and applicator delegation.

**Key Methods:**
- `processMessage(envelope)` - Execute full pipeline
- `getSessionHistory(sessionId)` - Retrieve turn history
- `getSessionMetadata(sessionId)` - Get session state
- `undoLastEdit(sessionId)` - Undo last turn
- `closeSession(sessionId)` - Cleanup session
- `getHealth()` - Service health

**Session Management:**
- Auto-create sessions with unique IDs
- TTL-based cleanup (1 hour default)
- Timeout reset on activity
- Result accumulation per session

### ChatEditSession

**Purpose:** Orchestrate GLM-5 pipeline for single message processing.

**Key Methods:**
- `processMessage(envelope)` - Full pipeline execution
- `applyEdit(editProtocol)` - Apply changes to DOM/code
- `undo()` - Revert last turn
- `getMetadata()` - Session info
- `getHistory()` - Turn history

**Turn Structure:**
```typescript
interface Turn {
  id: string;                    // Unique turn ID
  timestamp: number;             // When created
  userMessage: string;           // User input
  classification?: unknown;      // Task classification
  routingDecision?: unknown;     // Model selection
  selectedTool?: ToolRouteResult;
  glmResponse?: unknown;         // GLM-5 output
  editProtocol?: EditProtocol;   // Validated protocol
  appliedAt?: number;            // Application timestamp
  undoable?: boolean;            // Can be undone
}
```

### DOMPatchApplicator

**Purpose:** Apply deterministic DOM mutations via CSS selectors.

**Supported Patch Types:**

| Path Pattern | Example | Effect |
|---|---|---|
| `style.*` | `style.backgroundColor` | Set CSS property |
| `classList.add` | `classList.add` | Add class |
| `classList.remove` | `classList.remove` | Remove class |
| `classList.toggle` | `classList.toggle` | Toggle class |
| `textContent` | `textContent` | Replace text |
| `innerHTML` | `innerHTML` | Replace HTML |
| `attribute.*` | `attribute.href` | Set HTML attribute |

**Example:**
```typescript
const result = await applicator.applyPatches({
  selector: ".button",
  patches: [
    { path: "style.backgroundColor", value: "blue" },
    { path: "classList.add", value: "active" },
    { path: "textContent", value: "Click me" }
  ]
});
```

### CodeEditApplicator

**Purpose:** Parse and apply unified diff format to source files.

**Components:**
- `DiffParser.parse()` - Extract file headers and hunks
- `applyHunk()` - Apply single hunk with context validation

**Hunk Format:**
```
@@ -fromStart,fromCount +toStart,toCount @@
 context line
-removed line
+added line
 context line
```

**Validation:**
- Context line matching (prevents misapplied patches)
- Line number tracking
- Error reporting with diagnostics

### DesignVariantRenderer

**Purpose:** Render design system variations by applying design tokens to elements.

**Token Structure:**
```typescript
interface DesignToken {
  name: string;
  property: string;           // CSS property
  value: string | number;
  targets?: string[];         // :hover, ::before, etc.
}
```

**Features:**
- CSS custom properties (--var-name)
- Theme variants (light/dark, density)
- Pseudo-element support via data attributes
- Multi-element batch application

---

## EditProtocol Actions

### dom_edit
Apply DOM patches to elements.
```typescript
{
  action: "dom_edit",
  target: { selector: ".element" },
  patches: [{ path: "style.color", value: "red" }],
  explanation?: "Changed color to red"
}
```

### code_edit
Apply unified diff to file.
```typescript
{
  action: "code_edit",
  file: "src/index.ts",
  diff: "--- a/src/index.ts\n+++ b/src/index.ts\n...",
  explanation?: "Extracted utility function"
}
```

### design_variant
Apply design tokens to elements.
```typescript
{
  action: "design_variant",
  target: { selector: ".card" },
  tokens: [{ name: "bg", property: "background-color", value: "#fff" }],
  theme?: "dark",
  explanation?: "Rendered dark theme"
}
```

### refactor_plan
Present refactoring plan for review.
```typescript
{
  action: "refactor_plan",
  title: "Extract utility functions",
  files: [{ file: "src/utils.ts", changes: [...] }]
}
```

### answer
Display text answer.
```typescript
{
  action: "answer",
  content: "The best approach is..."
}
```

---

## HTTP API

### POST /chat/message
Process a chat message.

**Request:**
```json
{
  "user_message": "Change the button color to blue",
  "mode": "chat",
  "session_id": "session_123",
  "dom_snapshot": { ... },
  "active_file": { "path": "src/index.ts", "content": "..." }
}
```

**Response:**
```json
{
  "session_id": "session_123",
  "turn_id": "turn_456",
  "edit_protocol": { "action": "dom_edit", ... },
  "application_result": { "success": true, "message": "..." },
  "metadata": {
    "duration_ms": 245,
    "model": "glm-5.1",
    "tokens": { "input": 1200, "output": 450, "total": 1650 }
  }
}
```

### GET /chat/session/:id/history
Get turn history for session.

### POST /chat/session/:id/undo
Undo last turn in session.

### GET /health
Service health status.

---

## Mode-Specific Behavior

### Chat Mode
- Fast response times (GLM-5.1 preferred)
- Low latency editing
- Session-based context accumulation
- Real-time applicator feedback

### CIC Mode (via Chat)
- Deeper analysis available (GLM-5.2)
- Longer context budgets
- Refactoring recommendations
- Code quality metrics

### Labs Mode (via Chat)
- Design-focused edits
- Component token generation
- Theme variant support

---

## Error Handling

**Validation Failures:**
- Invalid EditProtocol responses → error logged, fallback to answer
- No matching DOM elements → error message returned
- Malformed unified diffs → patch failure with diagnostics
- File not found → error message with suggestion

**Graceful Degradation:**
- Syntax errors in changes → reported, original preserved
- Partial successes → report applied + failed patches
- Session timeouts → automatic cleanup

---

## Integration Points

- **UnifiedRouter** - Classification and GLM-5 execution
- **Tool Registry** - Future: tool selection per task
- **ChatEditSession** - Core orchestration
- **Edit Protocol** - Validation of GLM-5 output
- **ToolRouter** - Future: capability-based tool routing

---

## Performance Characteristics

| Operation | Typical Latency | Notes |
|---|---|---|
| DOM patch (single) | <50ms | In-memory operation |
| DOM patch (100 elements) | 50-100ms | Selector + iteration |
| Code edit (small file) | 100-200ms | Parse + apply + validation |
| Code edit (large file) | 200-500ms | Multi-hunk processing |
| GLM-5.1 call | 800-1500ms | Fast agentic model |
| GLM-5.2 call | 2000-4000ms | Deep reasoning |
| Full pipeline | 2500-5500ms | Classification + execution + application |

---

## Testing

Comprehensive test coverage in `src/chat/__tests__/`:
- `integration.spec.ts` - Full pipeline tests
- DOMPatchApplicator tests
- CodeEditApplicator tests
- DesignVariantRenderer tests
- ChatEditSession tests
- End-to-end integration tests
