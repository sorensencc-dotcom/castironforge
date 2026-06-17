/**
 * Labs Orchestrator
 * filename: LabsOrchestrator.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Multi-phase workflow orchestrator for redesign business (Labs).
 * Coordinates: Discovery → Harvest → Lead Score → Redesign → Outreach → Delivery
 */

interface Logger {
  info(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
}

interface UnifiedRouter {
  classify(envelope: unknown): Promise<{ task_type?: string }>;
  route(classification: unknown): { model: string; reasoning_effort: string };
  assembleContext(envelope: unknown): unknown;
  execute(decision: unknown, context: unknown, prompt: string): Promise<unknown>;
}

interface SiteDiscoveryResult {
  url: string;
  domain: string;
  industry: string;
  metrics: {
    designScore: number;
    mobileScore: number;
    contentFreshness: number;
    conversionReadiness: number;
  };
}

interface SiteHarvestResult {
  url: string;
  analysis: {
    designPatterns: string[];
    contentStructure: string;
    technologies: string[];
    opportunities: string[];
  };
  screenshots: { url: string; section: string }[];
}

interface LeadScoreResult {
  url: string;
  company: string;
  score: number;
  factors: {
    design_quality: number;
    mobile_friendliness: number;
    content_freshness: number;
    conversion_readiness: number;
  };
  recommendation: "high_priority" | "medium_priority" | "low_priority" | "pass";
}

interface RedesignResult {
  url: string;
  components: {
    name: string;
    before: string;
    after: string;
    designTokens: Record<string, unknown>;
  }[];
  globalTokens: Record<string, unknown>;
  layoutChanges: string[];
  explanation: string;
}

interface OutreachResult {
  url: string;
  company: string;
  pitch: string;
  followUpSequence: {
    day: number;
    message: string;
  }[];
}

/**
 * Labs Orchestrator - Multi-phase workflow for redesign business
 */
export class LabsOrchestrator {
  private workflowId: string;
  private results: Map<string, any> = new Map();

  constructor(
    private unifiedRouter: UnifiedRouter,
    private logger: Logger
  ) {
    this.workflowId = `labs_${Date.now()}`;
    this.logger.info(`Labs Orchestrator initialized`, { workflowId: this.workflowId });
  }

  /**
   * Execute site discovery
   */
  async executeDiscovery(url: string): Promise<SiteDiscoveryResult> {
    this.logger.info(`Starting Labs discovery`, { url, workflowId: this.workflowId });

    try {
      const classification = await this.unifiedRouter.classify({
        task: "labs_discovery",
        url,
      });

      const decision = this.unifiedRouter.route(classification);
      const ctx = this.unifiedRouter.assembleContext({ url, mode: "labs" });

      const discovery = await this.unifiedRouter.execute(
        decision,
        ctx,
        this.buildDiscoveryPrompt(url)
      );

      const result: SiteDiscoveryResult = {
        url,
        domain: new URL(url).hostname,
        industry: (discovery as any)?.industry || "unknown",
        metrics: {
          designScore: (discovery as any)?.designScore || 0,
          mobileScore: (discovery as any)?.mobileScore || 0,
          contentFreshness: (discovery as any)?.contentFreshness || 0,
          conversionReadiness: (discovery as any)?.conversionReadiness || 0,
        },
      };

      this.results.set(`discovery_${url}`, result);

      this.logger.info(`Labs discovery completed`, {
        url,
        designScore: result.metrics.designScore,
      });

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Labs discovery failed`, { error: msg, url });
      throw error;
    }
  }

  /**
   * Execute site harvest (detailed analysis)
   */
  async executeHarvest(url: string): Promise<SiteHarvestResult> {
    this.logger.info(`Starting Labs harvest`, { url, workflowId: this.workflowId });

    try {
      const classification = await this.unifiedRouter.classify({
        task: "labs_harvest",
        url,
      });

      const decision = this.unifiedRouter.route(classification);
      const ctx = this.unifiedRouter.assembleContext({ url, mode: "labs" });

      const harvest = await this.unifiedRouter.execute(
        decision,
        ctx,
        this.buildHarvestPrompt(url)
      );

      const result: SiteHarvestResult = {
        url,
        analysis: {
          designPatterns: (harvest as any)?.designPatterns || [],
          contentStructure: (harvest as any)?.contentStructure || "",
          technologies: (harvest as any)?.technologies || [],
          opportunities: (harvest as any)?.opportunities || [],
        },
        screenshots: (harvest as any)?.screenshots || [],
      };

      this.results.set(`harvest_${url}`, result);

      this.logger.info(`Labs harvest completed`, {
        url,
        opportunities: result.analysis.opportunities.length,
      });

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Labs harvest failed`, { error: msg, url });
      throw error;
    }
  }

  /**
   * Execute lead scoring
   */
  async executeLeadScore(url: string, company: string): Promise<LeadScoreResult> {
    this.logger.info(`Scoring lead`, { url, company, workflowId: this.workflowId });

    try {
      const classification = await this.unifiedRouter.classify({
        task: "labs_lead_score",
        url,
        company,
      });

      const decision = this.unifiedRouter.route(classification);
      const ctx = this.unifiedRouter.assembleContext({ url, company, mode: "labs" });

      const scoring = await this.unifiedRouter.execute(
        decision,
        ctx,
        this.buildLeadScorePrompt(url, company)
      );

      const score = (scoring as any)?.score || 0;
      const recommendation =
        score >= 80
          ? "high_priority"
          : score >= 60
            ? "medium_priority"
            : score >= 40
              ? "low_priority"
              : "pass";

      const result: LeadScoreResult = {
        url,
        company,
        score,
        factors: {
          design_quality: (scoring as any)?.design_quality || 0,
          mobile_friendliness: (scoring as any)?.mobile_friendliness || 0,
          content_freshness: (scoring as any)?.content_freshness || 0,
          conversion_readiness: (scoring as any)?.conversion_readiness || 0,
        },
        recommendation,
      };

      this.results.set(`lead_score_${url}`, result);

      this.logger.info(`Lead scoring completed`, {
        url,
        company,
        score,
        recommendation,
      });

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lead scoring failed`, { error: msg, url, company });
      throw error;
    }
  }

  /**
   * Execute full site redesign
   */
  async executeRedesign(url: string): Promise<RedesignResult> {
    this.logger.info(`Generating redesign`, { url, workflowId: this.workflowId });

    try {
      const classification = await this.unifiedRouter.classify({
        task: "labs_redesign",
        url,
      });

      const decision = this.unifiedRouter.route(classification);
      const ctx = this.unifiedRouter.assembleContext({ url, mode: "labs" });

      const redesign = await this.unifiedRouter.execute(
        decision,
        ctx,
        this.buildRedesignPrompt(url)
      );

      const result: RedesignResult = {
        url,
        components: (redesign as any)?.components || [],
        globalTokens: (redesign as any)?.globalTokens || {},
        layoutChanges: (redesign as any)?.layoutChanges || [],
        explanation: (redesign as any)?.explanation || "",
      };

      this.results.set(`redesign_${url}`, result);

      this.logger.info(`Redesign generated`, {
        url,
        components: result.components.length,
      });

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redesign generation failed`, { error: msg, url });
      throw error;
    }
  }

  /**
   * Execute outreach composition
   */
  async executeOutreach(url: string, company: string): Promise<OutreachResult> {
    this.logger.info(`Composing outreach`, { url, company, workflowId: this.workflowId });

    try {
      const classification = await this.unifiedRouter.classify({
        task: "labs_outreach",
        url,
        company,
      });

      const decision = this.unifiedRouter.route(classification);
      const ctx = this.unifiedRouter.assembleContext({ url, company, mode: "labs" });

      const outreach = await this.unifiedRouter.execute(
        decision,
        ctx,
        this.buildOutreachPrompt(url, company)
      );

      const result: OutreachResult = {
        url,
        company,
        pitch: (outreach as any)?.pitch || "",
        followUpSequence: (outreach as any)?.followUpSequence || [],
      };

      this.results.set(`outreach_${url}`, result);

      this.logger.info(`Outreach composed`, {
        url,
        company,
        followUps: result.followUpSequence.length,
      });

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Outreach composition failed`, { error: msg, url, company });
      throw error;
    }
  }

  /**
   * Get workflow results
   */
  getResults(): Map<string, any> {
    return new Map(this.results);
  }

  /**
   * Get workflow metadata
   */
  getMetadata() {
    return {
      workflowId: this.workflowId,
      phasesCompleted: this.results.size,
      createdAt: new Date().toISOString(),
    };
  }

  private buildDiscoveryPrompt(url: string): string {
    return `Analyze ${url} and provide discovery metrics.
Return JSON with: industry, designScore (0-100), mobileScore, contentFreshness, conversionReadiness`;
  }

  private buildHarvestPrompt(url: string): string {
    return `Perform deep analysis of ${url}.
Return JSON with: designPatterns (array), contentStructure, technologies (array), opportunities (array), screenshots`;
  }

  private buildLeadScorePrompt(url: string, company: string): string {
    return `Score ${company} at ${url} as a redesign lead (0-100).
Return JSON with: score, design_quality, mobile_friendliness, content_freshness, conversion_readiness`;
  }

  private buildRedesignPrompt(url: string): string {
    return `Generate a comprehensive redesign for ${url}.
Return JSON with: components [{name, before, after, designTokens}], globalTokens, layoutChanges, explanation`;
  }

  private buildOutreachPrompt(url: string, company: string): string {
    return `Compose personalized outreach for ${company} regarding redesign opportunities at ${url}.
Return JSON with: pitch (paragraph), followUpSequence [{day, message}]`;
  }
}

export { SiteDiscoveryResult, SiteHarvestResult, LeadScoreResult, RedesignResult, OutreachResult };
