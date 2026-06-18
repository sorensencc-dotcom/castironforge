# Master Roadmap

**Date:** 2026-06-17  
**Status:** Phases 1-4 Complete, Phase 5+ Planned  
**Last Updated:** 2026-06-17

Unified roadmap for Cast Iron Forge across three modes: CIC (Code Improvement), Rewrite Labs (Redesign Business), and future Collab mode.

---

## 1. CIC Roadmap (Code Improvement)

### Completed (Phases 1-4)

#### Phase 1: Core GLM-5 Integration
- ✅ GLM-5 client wrapper with deterministic defaults
- ✅ Task classification and model routing
- ✅ Prompt pack system with versioning
- ✅ TorqueQuery integration (BM25 + vector search)

#### Phase 2: Tool Registry System
- ✅ Multi-source tool discovery (JSON, ESM, MCP)
- ✅ Capability-based routing
- ✅ Health checks and observability
- ✅ Tool descriptor schema and validation

#### Phase 3: Chat Engine
- ✅ Real-time DOM editing (DOMPatchApplicator)
- ✅ Code editing (CodeEditApplicator with unified diffs)
- ✅ Design variants (DesignVariantRenderer)
- ✅ Session management with undo/redo
- ✅ HTTP service coordination

#### Phase 4: Multi-Phase Orchestrators
- ✅ CIC Orchestrator: Discovery → Harvest → Refactor → Audit
- ✅ Labs Orchestrator: Discovery → Harvest → Score → Redesign → Outreach
- ✅ Result accumulation and workflow metadata
- ✅ Comprehensive test coverage

### Planned (Phases 5+)

#### Phase 5A: Real File System Analysis
- Real repository scanning and indexing
- AST parsing for code structure
- Dependency graph extraction
- Actual metrics collection (complexity, coverage, duplication)
- Integration with version control (git blame, commit history)

#### Phase 5B: Actual Refactoring Execution
- Apply generated refactorings to real repositories
- Run test suites automatically
- Collect before/after metrics
- Generate impact reports
- Support rollback on test failure

#### Phase 5C: Database and Persistence
- Store discovery results and opportunities
- Track refactoring history and impact
- Measure ROI per change over time
- Build opportunity recommendation engine

### Long-Term Vision (Phase 7+)

**Autonomous Improvement Loop:**
- Continuous discovery of opportunities
- Automated analysis and refactoring
- Self-healing code based on production errors
- Long-horizon planning for architectural improvements
- Capability to propose multi-phase refactoring campaigns

---

## 2. Rewrite Labs Roadmap (Redesign Business)

### Completed (Phases 1-4)

#### Phase 1: Core Infrastructure
- ✅ Labs protocol with Redesign Protocol schemas
- ✅ Site discovery with quality metrics (design, mobile, content, conversion)
- ✅ Lead scoring algorithm (0-100 scale)
- ✅ Mode-aware routing in UnifiedRouter

#### Phase 2-4: Multi-Phase Orchestrator
- ✅ LabsOrchestrator with 5 phases
- ✅ Discovery: website quality assessment
- ✅ Harvest: deep design and tech analysis
- ✅ Lead Scoring: 0-100 qualification with factors
- ✅ Redesign: component-by-component improvements with tokens
- ✅ Outreach: AI-generated personalized pitches with follow-ups

### Planned (Phase 5)

#### Phase 5A: Web Crawling and Screenshot Capture
- Real website crawling (headless browser)
- Screenshot collection and analysis
- DOM structure extraction
- Asset inventory (images, fonts, icons)
- Technology detection (tech stack)
- Performance metrics collection

#### Phase 5B: Design Analysis Engine
- Visual design evaluation
- Accessibility audit (WCAG compliance)
- Responsive design testing
- Brand consistency analysis
- Competitive benchmarking
- Industry trend alignment

#### Phase 5C: Lead Database and CRM Integration
- Populate lead database from crawl results
- Integrate with CRM (HubSpot, Salesforce)
- Track outreach history and responses
- Measure conversion rates per campaign
- Build predictive scoring based on actual conversions
- Automate lead follow-up sequences

#### Phase 5D: Redesign Delivery and Handoff
- Generate design mockups (Figma/Sketch export)
- Generate implementation code (React/HTML/CSS)
- Create design specification documents
- Track client feedback and revisions
- Measure redesign impact (traffic, conversion improvement)
- Build portfolio of completed redesigns

### Long-Term Vision (Phase 7+)

**Autonomous Lead Generation and Conversion:**
- Continuous website crawling and analysis
- Automated lead scoring and prioritization
- Personalized outreach at scale
- Self-improving pitch and strategy generation
- Autonomous measurement of redesign ROI
- Capability to manage entire sales pipeline

---

## 3. Collab Mode Roadmap (Future)

### Vision
Joint CIC and Labs workflows enabling cross-modal collaboration.

### Planned Phases (6+)

#### Phase 6A: Joint Experiments
- Run CIC improvements on target of Labs redesign
- Apply redesigned UI and refactored code together
- Measure combined impact (UX + code quality)
- A/B test improvement strategies

#### Phase 6B: Cross-Orchestrator Workflows
- CIC discover code opportunities in Labs targets
- Labs identify design improvements in CIC projects
- Unified ROI reporting across modes
- Cross-validation of recommendations

#### Phase 6C: Unified Reporting
- Combined metrics dashboard
- Cross-mode impact analysis
- ROI aggregation across all projects
- Recommendation prioritization across modes

### Long-Term Vision

**Unified Growth Platform:**
- Simultaneously improve code quality and design
- Measure total value creation across all dimensions
- Autonomous decision-making on what to improve first
- Self-orchestrating workflows across all modes

---

## 4. Phase Roadmap (1–6)

### Phase 1: Core Infrastructure (✅ Complete)
**Status:** Merged (PR #11)

- Core GLM-5 integration with deterministic routing
- UnifiedRouter for task classification
- Prompt pack system
- TorqueQuery integration design
- Labs protocol schema

### Phase 2: Tool Registry (✅ Complete)
**Status:** Merged (PR #12)

- Multi-source tool discovery
- Tool descriptor schema
- Capability-based routing
- Health checks

### Phase 3: Chat Engine (✅ Complete)
**Status:** Merged (PRs #13-14)

- Real-time DOM/code/design editing
- Session management with undo
- HTTP service coordination
- Full test coverage

### Phase 4: Multi-Phase Orchestrators (✅ Complete)
**Status:** Merged (PR #15)

- CICOrchestrator (Discovery → Harvest → Refactor → Audit)
- LabsOrchestrator (Discovery → Harvest → Score → Redesign → Outreach)
- Workflow orchestration and result accumulation

### Phase 5: Business Layer (🔄 In Planning)
**Target:** Q3 2026

**5A: Real Analysis & Execution**
- File system scanning and code analysis
- Web crawling and screenshot capture
- Design analysis engine
- Actual refactoring execution with test validation

**5B: Database & Persistence**
- Results storage and history
- Metrics collection and trending
- Opportunity tracking
- Impact measurement

**5C: Integration & Automation**
- CRM integration (HubSpot, Salesforce)
- CI/CD pipeline integration
- Webhook support for automation
- Event-driven workflow triggers

### Phase 6: Autonomous Scheduling & Collab (🔄 Planned)
**Target:** Q4 2026

- Joint CIC + Labs workflows
- Cross-modal optimization
- Unified reporting and dashboards
- Autonomous scheduling of improvements
- Collab mode for multi-team collaboration

---

## 5. Future Phases

### Phase 7: Long-Horizon Planning (⏳ Conceptual)

**Roadmap Generation:**
- Multi-phase improvement campaigns
- Dependency analysis for sequencing
- Risk assessment per strategy
- Long-horizon impact modeling
- Capability to plan 6-12 month improvement journeys

### Phase 8: Autonomous Growth Loops (⏳ Conceptual)

**Self-Orchestrating Systems:**
- Continuous discovery and execution
- Self-healing based on production data
- Autonomous capability improvement
- Feedback loops from deployments to discovery
- Measure total value creation over time

---

## Architecture Timeline

```
Phase 1-2 (Completed)
    ↓
    ├─ Deterministic router + Tool registry
    ├─ GLM-5 model selection
    └─ Infrastructure foundation

Phase 3-4 (Completed)
    ↓
    ├─ Chat Engine (interactive editing)
    ├─ CIC Orchestrator (code improvement)
    └─ Labs Orchestrator (redesign business)

Phase 5 (In Planning)
    ↓
    ├─ Real analysis (file scanning, web crawling)
    ├─ Real execution (refactoring, redesign delivery)
    └─ Database + CRM integration

Phase 6+ (Planned)
    ↓
    ├─ Autonomous scheduling
    ├─ Collab mode
    └─ Multi-phase campaigns
```

---

## Key Dependencies

### Phase 5 Blockers
- [ ] Real file system integration
- [ ] Web crawling capability
- [ ] Design analysis engine
- [ ] Test execution framework
- [ ] CRM API integration

### Phase 6 Blockers
- [ ] Phase 5 completion
- [ ] Unified metrics system
- [ ] Cross-modal validation
- [ ] Autonomous scheduling engine

---

## Success Metrics

### CIC Mode
- Opportunities discovered per repo: target 20+
- Refactoring ROI: 30%+ code quality improvement
- Automation rate: 80%+ changes auto-applied
- Developer velocity: 2x improvement in refactoring cycles

### Labs Mode
- Lead scoring accuracy: 85%+ conversion correlation
- Redesign time: 10x reduction vs. manual
- Lead pipeline fill rate: 100+ qualified leads/month
- Redesign ROI: 25%+ improvement in client metrics

### Overall
- Platform adoption across teams: 5+ teams
- Autonomous workflow rate: 70%+ without human intervention
- Total value creation: $1M+ in measurable improvements

---

## References

**Implementation Documentation:**
- [CHAT_ENGINE.md](CHAT_ENGINE.md) - Phase 3 details
- [ORCHESTRATORS.md](ORCHESTRATORS.md) - Phase 4 details
- [TOOL_REGISTRY.md](TOOL_REGISTRY.md) - Phase 2 details
- [GLM5_INTEGRATION.md](GLM5_INTEGRATION.md) - Phase 1 details

**Schema Documentation:**
- [EDIT_PROTOCOL.md](EDIT_PROTOCOL.md) - Protocol definitions
- [LABS_REDESIGN_PROTOCOL.md](LABS_REDESIGN_PROTOCOL.md) - Labs protocols

**Integration Guides:**
- [CIC_LABS_INTEGRATION.md](CIC_LABS_INTEGRATION.md) - Cross-mode integration

**Code:**
- `services/glm5-router/src/orchestrators/` - Orchestrator implementations
- `services/glm5-router/src/chat/` - Chat Engine implementations
- `services/glm5-router/src/registry/` - Tool Registry
