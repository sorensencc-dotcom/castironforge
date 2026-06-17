/**
 * Tool Registry Types
 * filename: types.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Unified tool descriptor schema for CIC, Labs, Chat, and system tools.
 */

export type ToolId = string;

export type ToolGroup = "cic" | "labs" | "chat" | "search" | "system";

export type EndpointType = "http" | "local" | "mcp";

export type ToolCapability =
  | "read"
  | "write"
  | "search"
  | "refactor"
  | "design"
  | "build"
  | "test"
  | "harvest"
  | "score"
  | "outreach"
  | "classify";

export type ModelVariant = "glm-5.1" | "glm-5.2" | "glm-5";

export type ReasoningEffort = "low" | "high" | "max";

/**
 * Tool descriptor: complete metadata for a single tool.
 * Tools can be HTTP endpoints, local functions, or MCP tools.
 */
export interface ToolDescriptor {
  id: ToolId;
  group: ToolGroup;
  name: string;
  description: string;
  version: string; // semver (e.g., "0.1.0")

  // Endpoint information
  endpointType: EndpointType;
  endpoint: string; // URL, module path, or MCP tool name

  // I/O schemas
  inputSchema: Record<string, unknown>; // JSON Schema
  outputSchema: Record<string, unknown>; // JSON Schema

  // Capabilities and hints
  capabilities: ToolCapability[];
  modelHints?: {
    preferredModel?: ModelVariant;
    reasoningEffort?: ReasoningEffort;
    enableThinking?: boolean;
  };

  // Rate limiting and concurrency
  limits?: {
    maxCallsPerMinute?: number;
    maxConcurrent?: number;
    timeoutMs?: number;
  };

  // Metadata
  tags?: string[];
  deprecated?: boolean;
  deprecationMessage?: string;
}

/**
 * Tool invocation request
 */
export interface ToolInvocationRequest {
  toolId: ToolId;
  input: unknown;
  requestId: string;
  timeout?: number;
}

/**
 * Tool invocation response
 */
export interface ToolInvocationResponse {
  toolId: ToolId;
  requestId: string;
  output: unknown;
  success: boolean;
  error?: string;
  latencyMs: number;
}

/**
 * Tool discovery filter
 */
export interface ToolFilter {
  group?: ToolGroup;
  capability?: ToolCapability;
  deprecated?: boolean;
  search?: string; // Search in name/description
}

/**
 * Tool health status
 */
export interface ToolHealthStatus {
  toolId: ToolId;
  healthy: boolean;
  lastChecked: number;
  message?: string;
  responseTimeMs?: number;
}

/**
 * Tool registry interface
 */
export interface IToolRegistry {
  register(tool: ToolDescriptor): void;
  unregister(id: ToolId): boolean;
  get(id: ToolId): ToolDescriptor | undefined;
  list(filter?: ToolFilter): ToolDescriptor[];
  getByCapability(capability: ToolCapability): ToolDescriptor[];
  getByGroup(group: ToolGroup): ToolDescriptor[];
  validateDescriptor(tool: ToolDescriptor): { valid: boolean; errors: string[] };
}

/**
 * Tool loader interface
 */
export interface IToolLoader {
  load(): Promise<ToolDescriptor[]>;
}

/**
 * Route request for tool + model selection
 */
export interface ToolRouteRequest {
  mode: "cic" | "labs" | "chat";
  taskType: string;
  capabilities: ToolCapability[];
  preferredGroups?: ToolGroup[];
}

/**
 * Route result: selected tool + model
 */
export interface ToolRouteResult {
  tool: ToolDescriptor;
  model: ModelVariant;
  modelParams: {
    reasoning_effort: ReasoningEffort;
    enable_thinking: boolean;
  };
}

/**
 * Tool metrics
 */
export interface ToolMetrics {
  toolId: ToolId;
  callCount: number;
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  lastCalledAt?: number;
}
