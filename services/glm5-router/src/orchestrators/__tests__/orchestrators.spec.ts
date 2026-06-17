/**
 * Orchestrator Tests
 * filename: orchestrators.spec.ts
 * date: 2026-06-17
 *
 * Comprehensive tests for CIC and Labs orchestrators.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { CICOrchestrator } from "../CICOrchestrator.js";
import { LabsOrchestrator } from "../LabsOrchestrator.js";

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockRouter = {
  classify: jest.fn(async () => ({ task_type: "test" })),
  route: jest.fn(() => ({
    model: "glm-5.2",
    reasoning_effort: "high",
    enable_thinking: false,
  })),
  assembleContext: jest.fn(() => ({
    mode: "cic",
    user_intent: "test",
  })),
  execute: jest.fn(async (decision: any, context: any, prompt: string) => {
    // Return mock data based on task type
    return {};
  }),
};

describe("CIC Orchestrator", () => {
  let orchestrator: CICOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new CICOrchestrator(mockRouter as any, {} as any, mockLogger);
  });

  describe("Discovery Workflow", () => {
    it("should execute discovery workflow successfully", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        opportunities: [
          {
            id: "opp_1",
            type: "code_smell",
            location: { file: "src/index.ts", line: 42 },
            title: "Duplicate code",
            description: "Code duplication in handlers",
            priority: "high",
            estimatedEffort: 4,
          },
        ],
      });

      const result = await orchestrator.executeDiscoveryWorkflow("/repo");

      expect(result.repoPath).toBe("/repo");
      expect(result.opportunities).toHaveLength(1);
      expect(result.metrics.issuesFound).toBeGreaterThan(0);
    });

    it("should classify discovery task correctly", async () => {
      await orchestrator.executeDiscoveryWorkflow("/repo");

      expect(mockRouter.classify).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "cic_discovery",
          repoPath: "/repo",
        })
      );
    });

    it("should assemble CIC context", async () => {
      await orchestrator.executeDiscoveryWorkflow("/repo");

      expect(mockRouter.assembleContext).toHaveBeenCalledWith(
        expect.objectContaining({
          repoPath: "/repo",
          mode: "cic",
        })
      );
    });

    it("should handle discovery errors gracefully", async () => {
      mockRouter.execute.mockRejectedValueOnce(new Error("Discovery failed"));

      try {
        await orchestrator.executeDiscoveryWorkflow("/repo");
        expect(false).toBe(true);
      } catch (error) {
        expect((error as Error).message).toContain("Discovery failed");
      }
    });
  });

  describe("Harvest Phase", () => {
    it("should execute harvest phase successfully", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        rootCause: "Missing abstraction layer",
        affectedAreas: ["handlers", "middleware"],
        metrics: { duplicationRatio: 0.35 },
        recommendation: "Extract to shared utility",
      });

      const result = await orchestrator.executeHarvestPhase("opp_1");

      expect(result.opportunityId).toBe("opp_1");
      expect(result.analysis.rootCause).toBeDefined();
      expect(result.estimatedImpact.maintainability).toBeGreaterThan(0);
    });

    it("should extract analysis details", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        rootCause: "Test",
        affectedAreas: ["a", "b"],
        metrics: {},
        recommendation: "Do this",
      });

      const result = await orchestrator.executeHarvestPhase("opp_1");

      expect(result.analysis.affectedAreas).toHaveLength(2);
      expect(result.recommendations).toBeDefined();
    });
  });

  describe("Refactor Phase", () => {
    it("should execute refactor phase successfully", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        changes: [
          {
            file: "src/utils.ts",
            diff: "--- a/src/utils.ts\n+++ b/src/utils.ts\n@@ -1 +1 @@\n...",
            explanation: "Extract common logic",
          },
        ],
        validation: {
          syntaxValid: true,
          testsPass: true,
        },
      });

      const result = await orchestrator.executeRefactorPhase("opp_1");

      expect(result.opportunityId).toBe("opp_1");
      expect(result.status).toBe("generated");
      expect(result.validation.syntaxValid).toBe(true);
    });

    it("should generate diffs for changes", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        changes: [
          { file: "a.ts", diff: "...", explanation: "Change 1" },
          { file: "b.ts", diff: "...", explanation: "Change 2" },
        ],
      });

      const result = await orchestrator.executeRefactorPhase("opp_1");

      expect(result.changes).toHaveLength(2);
      expect(result.changes[0].file).toBe("a.ts");
    });
  });

  describe("Audit Phase", () => {
    it("should execute audit phase successfully", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        performance: 15,
        quality: 20,
        coverage: 10,
      });

      const result = await orchestrator.executeAuditPhase("opp_1");

      expect(result.opportunityId).toBe("opp_1");
      expect(result.impact.performanceGain).toBeGreaterThan(0);
      expect(result.impact.codeQualityImprovement).toBeGreaterThan(0);
    });

    it("should measure before/after metrics", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        performance: 25,
        quality: 30,
        coverage: 5,
      });

      const result = await orchestrator.executeAuditPhase("opp_1");

      expect(result.before).toBeDefined();
      expect(result.after).toBeDefined();
      expect(result.impact.performanceGain).toBe(25);
    });
  });

  describe("Workflow Results", () => {
    it("should accumulate phase results", async () => {
      mockRouter.execute.mockResolvedValue({});

      await orchestrator.executeDiscoveryWorkflow("/repo");
      await orchestrator.executeHarvestPhase("opp_1");
      await orchestrator.executeRefactorPhase("opp_1");
      await orchestrator.executeAuditPhase("opp_1");

      const results = orchestrator.getResults();
      expect(results.size).toBeGreaterThan(0);
    });

    it("should provide workflow metadata", () => {
      const metadata = orchestrator.getMetadata();

      expect(metadata.workflowId).toBeDefined();
      expect(metadata.workflowId).toContain("workflow_");
      expect(metadata.phasesCompleted).toBe(0);
      expect(metadata.createdAt).toBeDefined();
    });
  });
});

describe("Labs Orchestrator", () => {
  let orchestrator: LabsOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new LabsOrchestrator(mockRouter as any, mockLogger);
  });

  describe("Discovery Phase", () => {
    it("should execute site discovery successfully", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        industry: "SaaS",
        designScore: 45,
        mobileScore: 52,
        contentFreshness: 38,
        conversionReadiness: 41,
      });

      const result = await orchestrator.executeDiscovery("https://example.com");

      expect(result.url).toBe("https://example.com");
      expect(result.domain).toContain("example.com");
      expect(result.metrics.designScore).toBe(45);
    });

    it("should extract domain from URL", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        industry: "E-commerce",
        designScore: 55,
        mobileScore: 60,
        contentFreshness: 50,
        conversionReadiness: 55,
      });

      const result = await orchestrator.executeDiscovery("https://shop.example.com/path");

      expect(result.domain).toBe("shop.example.com");
    });

    it("should classify discovery task", async () => {
      mockRouter.execute.mockResolvedValueOnce({});

      await orchestrator.executeDiscovery("https://example.com");

      expect(mockRouter.classify).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "labs_discovery",
          url: "https://example.com",
        })
      );
    });
  });

  describe("Harvest Phase", () => {
    it("should execute site harvest successfully", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        designPatterns: ["Material Design", "Glassmorphism"],
        contentStructure: "Blog-driven with product showcase",
        technologies: ["React", "Next.js", "Tailwind CSS"],
        opportunities: ["Mobile optimization", "Performance improvements"],
        screenshots: [],
      });

      const result = await orchestrator.executeHarvest("https://example.com");

      expect(result.url).toBe("https://example.com");
      expect(result.analysis.designPatterns).toHaveLength(2);
      expect(result.analysis.opportunities).toHaveLength(2);
    });
  });

  describe("Lead Scoring Phase", () => {
    it("should score leads correctly", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        score: 85,
        design_quality: 60,
        mobile_friendliness: 70,
        content_freshness: 80,
        conversion_readiness: 75,
      });

      const result = await orchestrator.executeLeadScore("https://example.com", "Example Corp");

      expect(result.url).toBe("https://example.com");
      expect(result.company).toBe("Example Corp");
      expect(result.score).toBe(85);
      expect(result.recommendation).toBe("high_priority");
    });

    it("should categorize scores into recommendations", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        score: 45,
        design_quality: 50,
        mobile_friendliness: 40,
        content_freshness: 45,
        conversion_readiness: 45,
      });

      const result = await orchestrator.executeLeadScore("https://example.com", "Company A");

      expect(result.recommendation).toBe("low_priority");
    });

    it("should handle pass recommendations", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        score: 20,
        design_quality: 30,
        mobile_friendliness: 25,
        content_freshness: 15,
        conversion_readiness: 20,
      });

      const result = await orchestrator.executeLeadScore("https://example.com", "Company B");

      expect(result.recommendation).toBe("pass");
    });
  });

  describe("Redesign Phase", () => {
    it("should generate redesign successfully", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        components: [
          {
            name: "Hero Section",
            before: "<section>...",
            after: "<section class='redesigned'>...",
            designTokens: { backgroundColor: "#0066cc" },
          },
        ],
        globalTokens: { primaryColor: "#0066cc", secondaryColor: "#ff6600" },
        layoutChanges: ["Hero section expanded", "Navigation redesigned"],
        explanation: "Modern, mobile-first design with improved conversion paths",
      });

      const result = await orchestrator.executeRedesign("https://example.com");

      expect(result.url).toBe("https://example.com");
      expect(result.components).toHaveLength(1);
      expect(result.globalTokens).toBeDefined();
      expect(result.layoutChanges).toHaveLength(2);
    });
  });

  describe("Outreach Phase", () => {
    it("should compose outreach successfully", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        pitch: "We noticed your site and think we can help modernize it...",
        followUpSequence: [
          { day: 3, message: "Following up on our initial message..." },
          { day: 7, message: "Last touch base before we move on..." },
        ],
      });

      const result = await orchestrator.executeOutreach("https://example.com", "Example Corp");

      expect(result.url).toBe("https://example.com");
      expect(result.company).toBe("Example Corp");
      expect(result.pitch).toBeDefined();
      expect(result.followUpSequence).toHaveLength(2);
    });

    it("should include follow-up timing", async () => {
      mockRouter.execute.mockResolvedValueOnce({
        pitch: "Redesign pitch",
        followUpSequence: [
          { day: 3, message: "Follow up 1" },
          { day: 7, message: "Follow up 2" },
          { day: 14, message: "Final follow up" },
        ],
      });

      const result = await orchestrator.executeOutreach("https://example.com", "Company");

      expect(result.followUpSequence[0].day).toBe(3);
      expect(result.followUpSequence[2].day).toBe(14);
    });
  });

  describe("Workflow Results", () => {
    it("should accumulate workflow results", async () => {
      mockRouter.execute.mockResolvedValue({});

      await orchestrator.executeDiscovery("https://example.com");
      await orchestrator.executeHarvest("https://example.com");
      await orchestrator.executeLeadScore("https://example.com", "Company");

      const results = orchestrator.getResults();
      expect(results.size).toBeGreaterThan(0);
    });

    it("should provide workflow metadata", () => {
      const metadata = orchestrator.getMetadata();

      expect(metadata.workflowId).toBeDefined();
      expect(metadata.workflowId).toContain("labs_");
      expect(metadata.phasesCompleted).toBe(0);
      expect(metadata.createdAt).toBeDefined();
    });
  });

  describe("End-to-End Labs Workflow", () => {
    it("should execute complete redesign pipeline", async () => {
      // Setup mock responses for full workflow
      mockRouter.execute
        .mockResolvedValueOnce({ industry: "SaaS", designScore: 50 }) // discovery
        .mockResolvedValueOnce({ designPatterns: [], opportunities: [] }) // harvest
        .mockResolvedValueOnce({ score: 75 }) // lead score
        .mockResolvedValueOnce({ components: [] }) // redesign
        .mockResolvedValueOnce({ pitch: "test", followUpSequence: [] }); // outreach

      const discovery = await orchestrator.executeDiscovery("https://example.com");
      expect(discovery.metrics.designScore).toBe(50);

      const harvest = await orchestrator.executeHarvest("https://example.com");
      expect(harvest.url).toBe("https://example.com");

      const scored = await orchestrator.executeLeadScore("https://example.com", "Corp");
      expect(scored.score).toBe(75);

      const redesign = await orchestrator.executeRedesign("https://example.com");
      expect(redesign.url).toBe("https://example.com");

      const outreach = await orchestrator.executeOutreach("https://example.com", "Corp");
      expect(outreach.company).toBe("Corp");
    });
  });
});
