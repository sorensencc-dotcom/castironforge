// GLM-5 CIC Integration Types
// Unified, deterministic schemas for routing, context, and edit protocols

export type TaskType =
  | "dom_edit"
  | "design_variant"
  | "code_edit"
  | "refactor"
  | "search"
  | "cic_task";

export type ModelVariant = "glm-5.1" | "glm-5.2" | "glm-5";

export type ReasoningEffort = "low" | "high" | "max";

export type Scope = "local" | "multi_file" | "repo_scale";

export interface ChatRequestEnvelope {
  session_id: string;
  user_message: string;
  mode: "chat" | "edit" | "design" | "code";
  dom_snapshot?: {
    element_tree: unknown;
    active_selector?: string;
    computed_styles?: Record<string, string>;
  };
  active_file?: string;
  active_component?: string;
  recent_edits?: EditRecord[];
  cic_state?: {
    build_status: "passing" | "failing";
    open_prs?: string[];
    known_issues?: string[];
  };
}

export interface EditRecord {
  timestamp: number;
  type: "dom" | "code" | "design";
  target: string;
  patch: unknown;
}

export interface RouterClassification {
  task_type: TaskType;
  scope: Scope;
  needs_search: boolean;
  needs_orchestrator: boolean;
  context_budget: "short" | "long";
  confidence: number;
}

export interface UnifiedContextFrame {
  user_intent: string;
  dom_context?: DOMContext;
  code_context?: CodeContext;
  design_context?: DesignContext;
  cic_context?: CICContext;
  search_context?: SearchContext;
}

export interface DOMContext {
  element_tree: unknown;
  active_selector?: string;
  styles?: Record<string, string>;
  classes?: string[];
}

export interface CodeContext {
  active_file: string;
  file_content: string;
  nearby_files?: string[];
  component_tree?: unknown;
}

export interface DesignContext {
  tokens?: Record<string, unknown>;
  css_variables?: Record<string, string>;
  theme?: string;
}

export interface CICContext {
  build_status: "passing" | "failing";
  open_prs?: string[];
  known_issues?: string[];
  test_results?: unknown;
}

export interface SearchContext {
  query: string;
  results: SearchResult[];
  summaries?: string[];
  entities?: string[];
}

export interface SearchResult {
  doc_id: string;
  score: number;
  content: string;
  summary?: string;
}

// GLM-5 Edit Protocol Schemas

export interface EditProtocolMessage {
  action: "dom_edit" | "design_variant" | "code_edit" | "refactor_plan" | "answer";
  explanation?: string;
}

export interface DOMEditMessage extends EditProtocolMessage {
  action: "dom_edit";
  target: {
    selector: string;
    component?: string;
  };
  patches: Array<{
    path: string;
    value: unknown;
  }>;
}

export interface DesignVariantMessage extends EditProtocolMessage {
  action: "design_variant";
  component: string;
  variants: Array<{
    id: string;
    tokens?: Record<string, unknown>;
    description: string;
  }>;
}

export interface CodeEditMessage extends EditProtocolMessage {
  action: "code_edit";
  file: string;
  diff: string;
}

export interface RefactorPlanMessage extends EditProtocolMessage {
  action: "refactor_plan";
  scope: Scope;
  steps: Array<{
    id: string;
    description: string;
    files: string[];
  }>;
}

export interface AnswerMessage extends EditProtocolMessage {
  action: "answer";
  response: string;
  locations?: string[];
}

export type EditProtocol =
  | DOMEditMessage
  | DesignVariantMessage
  | CodeEditMessage
  | RefactorPlanMessage
  | AnswerMessage;

// Router Configuration & Routing Decisions

export interface RouterConfig {
  model_thresholds: {
    context_size_long: number; // 64k
    context_size_very_long: number; // 128k
  };
  default_reasoning_effort: ReasoningEffort;
  enable_thinking: boolean;
}

export interface RoutingDecision {
  task_type: TaskType;
  model: ModelVariant;
  reasoning_effort: ReasoningEffort;
  enable_thinking: boolean;
  context_mode: "short" | "long";
  prompt_pack_id: string;
  should_call_torquequery: boolean;
}

// TorqueQuery Adapter Types

export interface IngestionInput {
  corpus_id: string;
  slice_id: string;
  tokens_estimate: number;
  documents: Array<{
    doc_id: string;
    type: "code" | "doc" | "config" | "test";
    content: string;
  }>;
}

export interface IngestionOutput {
  corpus_id: string;
  slice_id: string;
  global_summary: string;
  files: Array<{
    doc_id: string;
    summary: string;
    entities: string[];
    relations: Array<{
      from: string;
      to: string;
      type: string;
    }>;
    index_hints: {
      bm25_terms: string[];
      semantic_anchors: string[];
    };
  }>;
}

export interface QueryInput {
  query_id: string;
  user_query: string;
  results: SearchResult[];
  metadata?: {
    global_summaries?: string[];
    entities?: string[];
    relations?: Array<{
      from: string;
      to: string;
      type: string;
    }>;
  };
}

export interface AdapterOutput {
  user_query: string;
  top_docs: Array<{
    doc_id: string;
    content: string;
  }>;
  summaries?: string[];
  entities?: string[];
}

// Observability

export interface CallObservability {
  call_id: string;
  timestamp: number;
  model: ModelVariant;
  reasoning_effort: ReasoningEffort;
  enable_thinking: boolean;
  prompt_template_id: string;
  context_size: number;
  task_type?: TaskType;
  scope?: Scope;
  mode?: "cic" | "labs" | "chat";
  latency_ms: number;
  success: boolean;
  error?: string;
}

// Unified Router Mode
export type RouterMode = "cic" | "labs" | "chat";

// Unified Context Frame (supports CIC, Labs, and Chat)
export interface UnifiedContextFrame {
  user_intent: string;
  mode: RouterMode;
  dom_context?: DOMContext;
  code_context?: CodeContext;
  design_context?: DesignContext;
  cic_context?: CICContext;
  search_context?: SearchContext;
  labs_context?: LabsContextFrame;
}

// Labs Context (extends core context)
export interface LabsContextFrame {
  site?: {
    url: string;
    title: string;
    screenshot?: string;
  };
  target_industry?: string;
  lead_info?: {
    company: string;
    contact_name?: string;
    email?: string;
  };
}

// Unified Router Configuration
export interface UnifiedRouterConfig {
  model_thresholds: {
    context_size_long: number;
    context_size_very_long: number;
  };
  default_reasoning_effort: ReasoningEffort;
  enable_thinking: boolean;
  modes: {
    cic: { enabled: boolean };
    labs: { enabled: boolean };
    chat: { enabled: boolean };
  };
}
