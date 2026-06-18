# Documentation Index

Complete navigation of all Cast Iron Forge documentation.

---

## Getting Started

- **[README.md](README.md)** - Overview and quick start
- **[INSTALLATION.md](INSTALLATION.md)** - Setup and installation guide

---

## Architecture & Integration

### Core GLM-5 Integration

- **[GLM5_INTEGRATION.md](GLM5_INTEGRATION.md)** - Deterministic GLM-5 routing, model selection, and integration patterns
  - Model roles and routing rules
  - CICRouter decision engine
  - Parameter policies
  - TorqueQuery integration (long-context search)

### Chat Engine (Phase 3)

- **[CHAT_ENGINE.md](CHAT_ENGINE.md)** - Real-time DOM and code editing
  - ChatEngineService (HTTP coordinator)
  - ChatEditSession (GLM-5 pipeline)
  - DOMPatchApplicator (element mutations)
  - CodeEditApplicator (unified diff parsing)
  - DesignVariantRenderer (design tokens)
  - EditProtocol actions
  - Performance characteristics

### Multi-Phase Orchestrators (Phase 4)

- **[ORCHESTRATORS.md](ORCHESTRATORS.md)** - Batch workflows for code improvement and redesign
  - CICOrchestrator: Discovery → Harvest → Refactor → Audit
  - LabsOrchestrator: Discovery → Harvest → Score → Redesign → Outreach
  - Phase-by-phase API documentation
  - Workflow execution model

### Tool Registry System (Phase 2)

- **[TOOL_REGISTRY.md](TOOL_REGISTRY.md)** - Dynamic tool discovery and capability-based routing
  - Tool registry architecture
  - Tool descriptor schema
  - Multi-source loader (JSON, ESM, MCP)
  - Scoring-based routing algorithm
  - Health checks and observability

### Edit Protocols

- **[EDIT_PROTOCOL.md](EDIT_PROTOCOL.md)** - Strict JSON schemas for DOM/code edits
  - DOMEditMessage (element patches)
  - CodeEditMessage (unified diffs)
  - RefactorPlanMessage
  - DesignVariantMessage
  - AnswerMessage
  - Validation rules and error handling

- **[LABS_REDESIGN_PROTOCOL.md](LABS_REDESIGN_PROTOCOL.md)** - Extended protocols for redesign workflows
  - SiteRedesignMessage (components, layout, tokens)
  - ComponentRedesignMessage
  - OutreachMessage (pitch, follow-ups)
  - LeadScoreMessage

### Integration Guides

- **[CIC_LABS_INTEGRATION.md](CIC_LABS_INTEGRATION.md)** - How CIC and Labs share unified infrastructure
  - Unified router with mode-based routing
  - Shared EditProtocol + extended protocols
  - Model selection per mode
  - Cross-mode capabilities

---

## Code Organization

```
services/glm5-router/
├── src/
│   ├── types/               # Shared type definitions
│   │   └── index.ts         # EditProtocol, UnifiedContextFrame, etc.
│   │
│   ├── adapters/            # GLM-5 API integration
│   │   ├── GLM5Client.ts    # TypeScript wrapper
│   │   └── TorqueQueryGLM5Adapter.ts
│   │
│   ├── router/              # Task routing and classification
│   │   └── UnifiedRouter.ts # Mode-aware (CIC/Labs/Chat)
│   │
│   ├── registry/            # Tool registry system
│   │   ├── ToolRegistry.ts
│   │   ├── ToolLoader.ts
│   │   ├── ToolRouter.ts
│   │   └── types.ts
│   │
│   ├── chat/                # Real-time editing (Phase 3)
│   │   ├── ChatEditSession.ts
│   │   ├── DOMPatchApplicator.ts
│   │   ├── CodeEditApplicator.ts
│   │   ├── DesignVariantRenderer.ts
│   │   └── __tests__/
│   │
│   ├── services/            # Higher-level orchestrators
│   │   └── ChatEngineService.ts
│   │
│   ├── orchestrators/       # Multi-phase workflows (Phase 4)
│   │   ├── CICOrchestrator.ts
│   │   ├── LabsOrchestrator.ts
│   │   └── __tests__/
│   │
│   └── prompts/             # Prompt packs
│       └── PromptPacks.ts
│
├── tools/                   # Tool descriptors
│   ├── tools.cic.json
│   ├── tools.labs.json
│   ├── tools.chat.json
│   └── tools.system.json
│
└── package.json
```

---

## Deployment & Operations

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development guidelines
- **[SECURITY.md](SECURITY.md)** - Security considerations
- **[LICENSE.md](LICENSE.md)** - License information

---

## Quick Reference

### Create New Chat Session
```typescript
const session = new ChatEditSession(router, toolRouter, logger);
const result = await session.processMessage({
  user_message: "Change the button color to blue",
  mode: "chat"
});
```

### Run CIC Discovery Workflow
```typescript
const cic = new CICOrchestrator(router, toolRouter, logger);
const discovery = await cic.executeDiscoveryWorkflow("/repo");
// Get opportunities, run harvest, refactor, audit
```

### Run Labs Lead Scoring
```typescript
const labs = new LabsOrchestrator(router, logger);
const scored = await labs.executeLeadScore(url, company);
// 0-100 score with factors and recommendation
```

### Register New Tool
```typescript
registry.register({
  id: "my_tool",
  group: "cic",
  name: "My Tool",
  capabilities: ["read", "search"],
  // ... full descriptor
});
```

---

## Phase Completion Status

| Phase | Status | Files | PRs |
|-------|--------|-------|-----|
| 1: Core GLM-5 Integration | ✅ Complete | 8 | #11 |
| 1.5: Labs Extension | ✅ Complete | 2 | #11 |
| 2: Tool Registry | ✅ Complete | 5 | #12 |
| 3: Chat Engine | ✅ Complete | 7 | #13, #14 |
| 4: Orchestrators | ✅ Complete | 3 | #15 |
| 5: Production Integrations | 🔄 Planned | TBD | TBD |

---

## Key Files by Purpose

### Understanding the Router
1. Read: types/index.ts (EditProtocol, UnifiedContextFrame)
2. Read: router/UnifiedRouter.ts (classification, routing)
3. Read: adapters/GLM5Client.ts (API integration)

### Understanding Chat Engine
1. Read: chat/ChatEditSession.ts (orchestration)
2. Read: chat/DOMPatchApplicator.ts (DOM mutations)
3. Read: chat/CodeEditApplicator.ts (file edits)

### Understanding Orchestrators
1. Read: orchestrators/CICOrchestrator.ts (code improvement)
2. Read: orchestrators/LabsOrchestrator.ts (redesign business)

### Understanding Tool Registry
1. Read: registry/ToolRegistry.ts (storage)
2. Read: registry/ToolLoader.ts (discovery)
3. Read: registry/ToolRouter.ts (routing)

---

## API Documentation

### Chat Engine HTTP
- **POST /chat/message** - Process user message
- **GET /chat/session/:id/history** - Get turn history
- **POST /chat/session/:id/undo** - Undo last turn
- **GET /health** - Service health

See [CHAT_ENGINE.md](CHAT_ENGINE.md) for full API docs.

### Orchestrator APIs

**CICOrchestrator:**
```
executeDiscoveryWorkflow(repoPath)
executeHarvestPhase(opportunityId)
executeRefactorPhase(opportunityId)
executeAuditPhase(opportunityId)
```

**LabsOrchestrator:**
```
executeDiscovery(url)
executeHarvest(url)
executeLeadScore(url, company)
executeRedesign(url)
executeOutreach(url, company)
```

See [ORCHESTRATORS.md](ORCHESTRATORS.md) for full API docs.

---

## Testing

All components have comprehensive test coverage:
- `src/chat/__tests__/integration.spec.ts` - Chat engine tests
- `src/orchestrators/__tests__/orchestrators.spec.ts` - Orchestrator tests
- `src/registry/__tests__/` - Tool registry tests

Run tests:
```bash
npm test
```

---

## Further Reading

- GLM-5 Model Capabilities: See GLM5_INTEGRATION.md "Model Roles"
- Edit Protocol Validation: See EDIT_PROTOCOL.md "Validation Rules"
- Tool Discovery Process: See TOOL_REGISTRY.md "Tool Discovery"
- Prompt Pack System: See PromptPacks.ts code comments
