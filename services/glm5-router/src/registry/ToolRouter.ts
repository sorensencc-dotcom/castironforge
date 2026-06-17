/**
 * Tool Router
 * filename: ToolRouter.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Maps tasks to tools and models using the ToolRegistry.
 * Routes task requests to the best available tool + GLM-5 variant.
 */

import {
  ToolRouteRequest,
  ToolRouteResult,
  ToolCapability,
  ToolGroup,
  ModelVariant,
  ReasoningEffort,
} from "./types.js";
import { ToolRegistry } from "./ToolRegistry.js";

interface Logger {
  info(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
}

/**
 * Routes tasks to tools and determines appropriate GLM-5 variant
 */
export class ToolRouter {
  constructor(private registry: ToolRegistry, private logger: Logger) {}

  /**
   * Route a task request to a tool + model
   */
  route(request: ToolRouteRequest): ToolRouteResult {
    const { mode, taskType, capabilities, preferredGroups } = request;

    // Build filter for tool search
    const groupsToSearch = preferredGroups || this.getDefaultGroupsForMode(mode);

    // Find tools that match all required capabilities
    let candidateTools = this.registry.list();

    // Filter by group
    candidateTools = candidateTools.filter((t) => groupsToSearch.includes(t.group));

    // Filter by all required capabilities
    candidateTools = candidateTools.filter((t) =>
      capabilities.every((cap) => t.capabilities.includes(cap))
    );

    // Exclude deprecated tools
    candidateTools = candidateTools.filter((t) => !t.deprecated);

    if (candidateTools.length === 0) {
      const msg = `No tools found for task=${taskType}, capabilities=${capabilities.join(",")}`;
      this.logger.error(msg, { mode, taskType, capabilities });
      throw new Error(msg);
    }

    // Score and rank candidates
    const scores = candidateTools.map((tool) => ({
      tool,
      score: this.scoreTool(tool, mode, taskType, capabilities),
    }));

    scores.sort((a, b) => b.score - a.score);

    const selected = scores[0].tool;

    // Determine model variant and parameters
    const { model, reasoning_effort, enable_thinking } = this.selectModel(
      selected,
      mode,
      taskType
    );

    this.logger.debug(`Task routed to tool`, {
      taskType,
      mode,
      toolId: selected.id,
      model,
      reasoning_effort,
      score: scores[0].score,
    });

    return {
      tool: selected,
      model,
      modelParams: {
        reasoning_effort,
        enable_thinking,
      },
    };
  }

  /**
   * Score a tool based on how well it matches the request
   */
  private scoreTool(
    tool: typeof this.registry["get"],
    mode: string,
    taskType: string,
    requiredCapabilities: ToolCapability[]
  ): number {
    let score = 100;

    // Bonus for exact group match
    if (tool?.group === mode) {
      score += 50;
    }

    // Bonus for model hints match
    if (tool?.modelHints?.preferredModel) {
      score += 30;
    }

    // Bonus for exact capability match (not just subset)
    const exactMatch = tool?.capabilities.length === requiredCapabilities.length;
    if (exactMatch) {
      score += 20;
    }

    // Penalty for higher version numbers (prefer stable)
    // (Lower is better, so we subtract)
    const versionParts = (tool?.version || "0.0.0").split(".").map(Number);
    const versionScore = (versionParts[0] || 0) * 100 + (versionParts[1] || 0) * 10;
    score -= Math.min(versionScore, 20);

    return score;
  }

  /**
   * Select GLM-5 variant and parameters based on tool and mode
   */
  private selectModel(
    tool: ReturnType<typeof this.registry["get"]>,
    mode: string,
    taskType: string
  ): {
    model: ModelVariant;
    reasoning_effort: ReasoningEffort;
    enable_thinking: boolean;
  } {
    // Use tool hints if present
    if (tool?.modelHints?.preferredModel) {
      return {
        model: tool.modelHints.preferredModel,
        reasoning_effort: tool.modelHints.reasoningEffort || "high",
        enable_thinking: tool.modelHints.enableThinking ?? false,
      };
    }

    // Default selection based on mode and task type
    const defaultSelection = this.getDefaultModelSelection(mode, taskType);

    return defaultSelection;
  }

  /**
   * Get default model selection for a mode/task combination
   */
  private getDefaultModelSelection(
    mode: string,
    taskType: string
  ): {
    model: ModelVariant;
    reasoning_effort: ReasoningEffort;
    enable_thinking: boolean;
  } {
    // CIC mode
    if (mode === "cic") {
      if (taskType.includes("harvest") || taskType.includes("search")) {
        return { model: "glm-5.2", reasoning_effort: "high", enable_thinking: false };
      }
      if (taskType.includes("redesign") || taskType.includes("refactor")) {
        return { model: "glm-5.2", reasoning_effort: "max", enable_thinking: false };
      }
      return { model: "glm-5.1", reasoning_effort: "high", enable_thinking: false };
    }

    // Labs mode
    if (mode === "labs") {
      if (taskType.includes("redesign")) {
        return { model: "glm-5.2", reasoning_effort: "max", enable_thinking: false };
      }
      if (taskType.includes("harvest")) {
        return { model: "glm-5.2", reasoning_effort: "high", enable_thinking: false };
      }
      return { model: "glm-5.1", reasoning_effort: "high", enable_thinking: false };
    }

    // Chat mode (optimize for latency)
    if (mode === "chat") {
      if (taskType.includes("design") || taskType.includes("refactor")) {
        return { model: "glm-5.2", reasoning_effort: "high", enable_thinking: false };
      }
      return { model: "glm-5.1", reasoning_effort: "high", enable_thinking: false };
    }

    // Default
    return { model: "glm-5.1", reasoning_effort: "high", enable_thinking: false };
  }

  /**
   * Get default groups to search for a mode
   */
  private getDefaultGroupsForMode(mode: string): ToolGroup[] {
    switch (mode) {
      case "cic":
        return ["cic", "search", "system"];
      case "labs":
        return ["labs", "search", "system"];
      case "chat":
        return ["chat", "search", "system"];
      default:
        return ["search", "system"];
    }
  }

  /**
   * Find tools for a specific capability
   */
  findByCapability(
    capability: ToolCapability,
    mode?: string
  ): ReturnType<typeof this.registry["list"]> {
    const tools = this.registry.getByCapability(capability);

    if (mode) {
      return tools.filter((t) => t.group === mode);
    }

    return tools;
  }

  /**
   * Get tool recommendations for a task
   */
  getRecommendations(
    mode: string,
    taskType: string,
    capabilities: ToolCapability[]
  ): Array<{
    tool: ReturnType<typeof this.registry["get"]>;
    score: number;
    model: ModelVariant;
  }> {
    let tools = this.registry.list();

    // Basic filtering
    tools = tools.filter((t) =>
      capabilities.every((cap) => t.capabilities.includes(cap))
    );
    tools = tools.filter((t) => !t.deprecated);

    // Score and sort
    const scored = tools
      .map((tool) => ({
        tool,
        score: this.scoreTool(tool, mode, taskType, capabilities),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5

    // Add model selection
    return scored.map(({ tool, score }) => ({
      tool,
      score,
      model: this.selectModel(tool, mode, taskType).model,
    }));
  }
}
