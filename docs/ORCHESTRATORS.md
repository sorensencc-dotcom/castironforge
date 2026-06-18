# Multi-Phase Orchestrators

**Date:** 2026-06-17  
**Status:** Complete  
**Semver:** 1.0.0

---

## Overview

Two specialized orchestrators coordinate multi-phase workflows through GLM-5:

1. **CICOrchestrator** - Code improvement discovery, analysis, refactoring, and auditing
2. **LabsOrchestrator** - Website analysis, lead scoring, and redesign generation

Both orchestrators are independent of the Chat Engine and can be used for batch processing, background jobs, or programmatic workflows.

---

## CICOrchestrator

### Purpose
Automate code improvement workflows by discovering opportunities, analyzing them deeply, generating refactorings, and measuring impact.

### Four-Phase Workflow

#### Phase 1: Discovery
**Input:** Repository path  
**Task Type:** `cic_discovery`  
**Model:** GLM-5.1 (fast)  

Find improvement opportunities:
- Code smells (duplication, complexity)
- Performance bottlenecks
- Test coverage gaps
- Refactoring opportunities

**Output:**
```typescript
interface DiscoveryResult {
  repoPath: string;
  opportunities: Opportunity[];  // Prioritized list
  metrics: {
    filesScanned: number;
    issuesFound: number;
    estimatedImpact: number;  // 0-100
  };
}

interface Opportunity {
  id: string;
  type: string;  // "code_smell", "perf_bottleneck", etc.
  location: { file: string; line?: number };
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  estimatedEffort: number;  // story points
}
```

**Example:**
```typescript
const discovery = await orchestrator.executeDiscoveryWorkflow("/repo");
// Returns:
// - 15 opportunities found
// - 3 critical (duplicate code, N+1 queries)
// - 8 high (test coverage gaps)
// - 4 medium/low (style issues)
```

#### Phase 2: Harvest
**Input:** Opportunity ID  
**Task Type:** `cic_harvest`  
**Model:** GLM-5.2 (deep reasoning)  

Analyze each opportunity in depth:
- Root cause analysis
- Affected areas and dependencies
- Quantitative metrics
- Recommended approaches

**Output:**
```typescript
interface HarvestResult {
  opportunityId: string;
  analysis: {
    rootCause: string;
    affectedAreas: string[];  // Functions, modules, systems
    metrics: Record<string, unknown>;
  };
  recommendations: string[];
  estimatedImpact: {
    performance: number;  // -100 to +100 (% improvement)
    maintainability: number;
    testability: number;
  };
}
```

**Example:**
```typescript
const harvest = await orchestrator.executeHarvestPhase("opp_1");
// Returns:
// - Root Cause: "Missing abstraction layer in request handlers"
// - Affected: handlers.ts, middleware.ts, routes.ts
// - Metrics: { duplicationRatio: 0.35, complexity: 8.2 }
// - Impact: +25% maintainability, +15% testability
```

#### Phase 3: Refactor
**Input:** Opportunity ID  
**Task Type:** `cic_refactor`  
**Model:** GLM-5.2 (reasoning_effort=max)  

Generate code improvements:
- Multi-file unified diffs
- Syntax-valid changes
- Test compatibility verification

**Output:**
```typescript
interface RefactorResult {
  opportunityId: string;
  status: "generated" | "applied" | "failed";
  changes: {
    file: string;
    diff: string;  // Unified format
    explanation: string;
  }[];
  validation: {
    syntaxValid: boolean;
    testsPass: boolean;
  };
}
```

**Example:**
```typescript
const refactor = await orchestrator.executeRefactorPhase("opp_1");
// Returns:
// - 3 files changed
// - handlers.ts: extract RequestValidator class
// - middleware.ts: use RequestValidator
// - routes.ts: simplify route definitions
// - Validation: syntax✓, tests✓
```

#### Phase 4: Audit
**Input:** Opportunity ID  
**Task Type:** `cic_audit`  
**Model:** GLM-5.2  

Measure post-refactor impact:
- Before/after metrics
- Calculated improvements
- ROI assessment

**Output:**
```typescript
interface AuditResult {
  opportunityId: string;
  before: { metrics: Record<string, number> };
  after: { metrics: Record<string, number> };
  impact: {
    performanceGain: number;  // % improvement
    codeQualityImprovement: number;
    testCoverageChange: number;
  };
}
```

**Example:**
```typescript
const audit = await orchestrator.executeAuditPhase("opp_1");
// Returns:
// - Before: complexity=8.2, coverage=72%, duplication=35%
// - After: complexity=5.1, coverage=85%, duplication=8%
// - Impact: +20% quality, +13% coverage, -77% duplication
```

### API

```typescript
const orchestrator = new CICOrchestrator(router, toolRouter, logger);

// Execute full discovery
const discovery = await orchestrator.executeDiscoveryWorkflow("/repo");

// Analyze specific opportunity
const harvest = await orchestrator.executeHarvestPhase("opp_1");

// Generate refactoring
const refactor = await orchestrator.executeRefactorPhase("opp_1");

// Measure impact
const audit = await orchestrator.executeAuditPhase("opp_1");

// Get accumulated results
const results = orchestrator.getResults();

// Get workflow metadata
const metadata = orchestrator.getMetadata();
// { workflowId, phasesCompleted, createdAt }
```

---

## LabsOrchestrator

### Purpose
Automate the redesign business by analyzing websites, scoring leads, generating redesigns, and composing outreach.

### Six-Phase Workflow

#### Phase 1: Discovery
**Input:** Website URL  
**Task Type:** `labs_discovery`  
**Model:** GLM-5.1 (fast)  

Analyze website quality:
- Design maturity
- Mobile-friendliness
- Content freshness
- Conversion optimization

**Output:**
```typescript
interface SiteDiscoveryResult {
  url: string;
  domain: string;
  industry: string;
  metrics: {
    designScore: number;        // 0-100
    mobileScore: number;        // 0-100
    contentFreshness: number;   // 0-100
    conversionReadiness: number; // 0-100
  };
}
```

**Example:**
```typescript
const discovery = await orchestrator.executeDiscovery("https://example.com");
// Returns:
// - domain: example.com
// - industry: SaaS
// - scores: design=42, mobile=55, content=38, conversion=41
```

#### Phase 2: Harvest
**Input:** Website URL  
**Task Type:** `labs_harvest`  
**Model:** GLM-5.2 (long-context)  

Deep site analysis:
- Design patterns used
- Technology stack
- Content structure
- Improvement opportunities

**Output:**
```typescript
interface SiteHarvestResult {
  url: string;
  analysis: {
    designPatterns: string[];  // "Material Design", etc.
    contentStructure: string;
    technologies: string[];    // React, Next.js, Tailwind, etc.
    opportunities: string[];
  };
  screenshots: { url: string; section: string }[];
}
```

**Example:**
```typescript
const harvest = await orchestrator.executeHarvest("https://example.com");
// Returns:
// - Patterns: [Material Design, Glassmorphism]
// - Tech: [React, Next.js, Tailwind CSS]
// - Opportunities: [Mobile optimization, Performance improvements]
```

#### Phase 3: Lead Scoring
**Input:** URL + Company name  
**Task Type:** `labs_lead_score`  
**Model:** GLM-5.1  

Qualify redesign leads (0-100):

| Score Range | Recommendation | Notes |
|---|---|---|
| 80-100 | high_priority | Strong redesign potential |
| 60-79 | medium_priority | Good opportunity |
| 40-59 | low_priority | Limited potential |
| <40 | pass | Not a good fit |

**Factors:**
- design_quality (pattern maturity, visual hierarchy)
- mobile_friendliness (responsive design, touch targets)
- content_freshness (update recency, relevance)
- conversion_readiness (CTA clarity, flow optimization)

**Output:**
```typescript
interface LeadScoreResult {
  url: string;
  company: string;
  score: number;  // 0-100
  factors: {
    design_quality: number;
    mobile_friendliness: number;
    content_freshness: number;
    conversion_readiness: number;
  };
  recommendation: "high_priority" | "medium_priority" | "low_priority" | "pass";
}
```

**Example:**
```typescript
const scored = await orchestrator.executeLeadScore(
  "https://example.com",
  "Example Corp"
);
// Returns:
// - score: 75
// - factors: {design: 60, mobile: 70, content: 80, conversion: 75}
// - recommendation: "medium_priority"
```

#### Phase 4: Redesign
**Input:** Website URL  
**Task Type:** `labs_redesign`  
**Model:** GLM-5.2 (reasoning_effort=max)  

Generate full site redesign:
- Component improvements
- Design tokens (colors, typography, spacing)
- Layout changes
- Global design system

**Output:**
```typescript
interface RedesignResult {
  url: string;
  components: {
    name: string;
    before: string;           // Original code/description
    after: string;            // Redesigned code/description
    designTokens: Record<string, unknown>;  // Colors, sizes, etc.
  }[];
  globalTokens: Record<string, unknown>;    // Shared system
  layoutChanges: string[];
  explanation: string;
}
```

**Example:**
```typescript
const redesign = await orchestrator.executeRedesign("https://example.com");
// Returns:
// - 8 components redesigned
// - Hero section: expanded, modern imagery, clear CTA
// - Navigation: sticky, simplified menu, better mobile
// - globalTokens: primaryColor, spacing scale, typography
// - layoutChanges: [Hero expanded, Footer reorganized]
```

#### Phase 5: Outreach
**Input:** URL + Company name  
**Task Type:** `labs_outreach`  
**Model:** GLM-5.1  

Compose personalized sales pitch:
- Context-aware messaging
- Multi-message follow-up sequences
- Timing recommendations

**Output:**
```typescript
interface OutreachResult {
  url: string;
  company: string;
  pitch: string;  // Multi-paragraph personalized message
  followUpSequence: {
    day: number;    // Days after initial contact
    message: string;
  }[];
}
```

**Example:**
```typescript
const outreach = await orchestrator.executeOutreach(
  "https://example.com",
  "Example Corp"
);
// Returns:
// - pitch: "We noticed your SaaS platform... we've redesigned..."
// - followUps:
//   - day 3: "Following up on our initial message..."
//   - day 7: "Last touch base before we move on..."
```

### API

```typescript
const orchestrator = new LabsOrchestrator(router, logger);

// Analyze website
const discovery = await orchestrator.executeDiscovery("https://example.com");

// Deep analysis
const harvest = await orchestrator.executeHarvest("https://example.com");

// Score lead
const scored = await orchestrator.executeLeadScore(
  "https://example.com",
  "Company Name"
);

// Generate redesign
const redesign = await orchestrator.executeRedesign("https://example.com");

// Compose outreach
const outreach = await orchestrator.executeOutreach(
  "https://example.com",
  "Company Name"
);

// Get accumulated results
const results = orchestrator.getResults();

// Get workflow metadata
const metadata = orchestrator.getMetadata();
```

---

## Workflow Execution Model

```
Request
    ↓
Orchestrator
    ├─ Classify task (UnifiedRouter.classify)
    ├─ Select model (UnifiedRouter.route)
    ├─ Assemble context (UnifiedRouter.assembleContext)
    └─ Execute GLM-5 (UnifiedRouter.execute)
        └─ Temperature=0, top_p=1 (deterministic)
    ↓
Phase Result
    ├─ Accumulated in Results map
    └─ Returned to caller
```

---

## Key Design Principles

1. **Phase Independence** - Each phase executable independently in any order
2. **Result Accumulation** - All outputs stored with workflow ID for audit trail
3. **Deterministic Routing** - Task classification drives GLM-5 model selection
4. **Error Isolation** - Phase failures don't block workflow continuation
5. **Metadata Tracking** - Workflow ID, timing, completion status tracked

---

## Integration Points

- **UnifiedRouter** - Task classification and GLM-5 execution
- **Tool Registry** - Future: tool-based phase implementation
- **ChatEngineService** - Apply generated redesigns in real-time
- **EditProtocol** - Validate and execute refactorings

---

## Testing

Comprehensive test coverage in `src/orchestrators/__tests__/orchestrators.spec.ts`:
- CIC discovery, harvest, refactor, audit phases
- Labs discovery, harvest, scoring, redesign, outreach phases
- Error handling and recovery
- End-to-end workflow execution
- Result accumulation and metadata
