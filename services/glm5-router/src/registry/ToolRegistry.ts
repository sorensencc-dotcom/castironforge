/**
 * Tool Registry
 * filename: ToolRegistry.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * In-memory registry of all available tools with validation and discovery.
 */

import {
  ToolDescriptor,
  ToolId,
  ToolGroup,
  ToolCapability,
  ToolFilter,
  IToolRegistry,
} from "./types.js";

interface Logger {
  info(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
}

/**
 * In-memory tool registry with persistence hooks.
 */
export class ToolRegistry implements IToolRegistry {
  private tools: Map<ToolId, ToolDescriptor> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a tool in the registry.
   */
  register(tool: ToolDescriptor): void {
    const { valid, errors } = this.validateDescriptor(tool);

    if (!valid) {
      const msg = `Cannot register invalid tool ${tool.id}: ${errors.join("; ")}`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    if (this.tools.has(tool.id)) {
      this.logger.info(`Tool already registered, overwriting`, { id: tool.id });
    }

    this.tools.set(tool.id, tool);

    this.logger.info(`Tool registered`, {
      id: tool.id,
      group: tool.group,
      version: tool.version,
      endpointType: tool.endpointType,
      capabilities: tool.capabilities,
    });
  }

  /**
   * Unregister a tool from the registry.
   */
  unregister(id: ToolId): boolean {
    const existed = this.tools.has(id);
    if (existed) {
      this.tools.delete(id);
      this.logger.info(`Tool unregistered`, { id });
    }
    return existed;
  }

  /**
   * Get a tool by ID.
   */
  get(id: ToolId): ToolDescriptor | undefined {
    return this.tools.get(id);
  }

  /**
   * List all tools, optionally filtered.
   */
  list(filter?: ToolFilter): ToolDescriptor[] {
    let results = Array.from(this.tools.values());

    // Filter by group
    if (filter?.group) {
      results = results.filter((t) => t.group === filter.group);
    }

    // Filter by capability
    if (filter?.capability) {
      results = results.filter((t) => t.capabilities.includes(filter.capability!));
    }

    // Filter by deprecated status
    if (filter?.deprecated !== undefined) {
      results = results.filter((t) => (t.deprecated ?? false) === filter.deprecated);
    }

    // Search in name/description
    if (filter?.search) {
      const search = filter.search.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search)
      );
    }

    return results;
  }

  /**
   * Get all tools with a specific capability.
   */
  getByCapability(capability: ToolCapability): ToolDescriptor[] {
    return this.list({ capability });
  }

  /**
   * Get all tools in a specific group.
   */
  getByGroup(group: ToolGroup): ToolDescriptor[] {
    return this.list({ group });
  }

  /**
   * Validate a tool descriptor.
   */
  validateDescriptor(tool: ToolDescriptor): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!tool.id || typeof tool.id !== "string") {
      errors.push("Tool must have a non-empty id string");
    }

    if (!tool.group || !["cic", "labs", "chat", "search", "system"].includes(tool.group)) {
      errors.push("Tool must have a valid group");
    }

    if (!tool.name || typeof tool.name !== "string") {
      errors.push("Tool must have a non-empty name string");
    }

    if (!tool.description || typeof tool.description !== "string") {
      errors.push("Tool must have a non-empty description string");
    }

    if (!tool.version || typeof tool.version !== "string") {
      errors.push("Tool must have a valid semantic version");
    }

    if (!tool.endpointType || !["http", "local", "mcp"].includes(tool.endpointType)) {
      errors.push("Tool must have a valid endpointType");
    }

    if (!tool.endpoint || typeof tool.endpoint !== "string") {
      errors.push("Tool must have a non-empty endpoint string");
    }

    if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
      errors.push("Tool must have a valid inputSchema object");
    }

    if (!tool.outputSchema || typeof tool.outputSchema !== "object") {
      errors.push("Tool must have a valid outputSchema object");
    }

    if (!Array.isArray(tool.capabilities) || tool.capabilities.length === 0) {
      errors.push("Tool must have at least one capability");
    }

    // Validate capabilities
    const validCapabilities = [
      "read",
      "write",
      "search",
      "refactor",
      "design",
      "build",
      "test",
      "harvest",
      "score",
      "outreach",
      "classify",
    ];
    for (const cap of tool.capabilities) {
      if (!validCapabilities.includes(cap)) {
        errors.push(`Invalid capability: ${cap}`);
      }
    }

    // Validate limits if present
    if (tool.limits) {
      if (
        tool.limits.maxCallsPerMinute !== undefined &&
        tool.limits.maxCallsPerMinute <= 0
      ) {
        errors.push("maxCallsPerMinute must be > 0");
      }

      if (tool.limits.maxConcurrent !== undefined && tool.limits.maxConcurrent <= 0) {
        errors.push("maxConcurrent must be > 0");
      }

      if (tool.limits.timeoutMs !== undefined && tool.limits.timeoutMs <= 0) {
        errors.push("timeoutMs must be > 0");
      }
    }

    // Validate modelHints if present
    if (tool.modelHints) {
      if (
        tool.modelHints.preferredModel &&
        !["glm-5.1", "glm-5.2", "glm-5"].includes(tool.modelHints.preferredModel)
      ) {
        errors.push("Invalid preferredModel");
      }

      if (
        tool.modelHints.reasoningEffort &&
        !["low", "high", "max"].includes(tool.modelHints.reasoningEffort)
      ) {
        errors.push("Invalid reasoningEffort");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    byGroup: Record<ToolGroup, number>;
    byCapability: Record<ToolCapability, number>;
  } {
    const stats = {
      totalTools: this.tools.size,
      byGroup: {
        cic: 0,
        labs: 0,
        chat: 0,
        search: 0,
        system: 0,
      } as Record<ToolGroup, number>,
      byCapability: {
        read: 0,
        write: 0,
        search: 0,
        refactor: 0,
        design: 0,
        build: 0,
        test: 0,
        harvest: 0,
        score: 0,
        outreach: 0,
        classify: 0,
      } as Record<ToolCapability, number>,
    };

    for (const tool of this.tools.values()) {
      stats.byGroup[tool.group]++;

      for (const cap of tool.capabilities) {
        stats.byCapability[cap]++;
      }
    }

    return stats;
  }

  /**
   * Export registry as JSON for persistence
   */
  toJSON(): ToolDescriptor[] {
    return Array.from(this.tools.values());
  }

  /**
   * Import registry from JSON
   */
  fromJSON(descriptors: ToolDescriptor[]): void {
    for (const descriptor of descriptors) {
      this.register(descriptor);
    }
  }
}

export { IToolRegistry };
