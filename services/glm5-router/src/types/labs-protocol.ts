/**
 * Rewrite Labs Redesign Protocol
 * Unified schemas for site redesign outputs from GLM-5.2
 */

export type LabsAction = "site_redesign" | "component_redesign" | "outreach" | "lead_score";

export interface LabsComponent {
  id: string;
  name: string;
  type: "hero" | "nav" | "card" | "form" | "cta" | "footer" | "section";
  new_design: {
    layout?: string;
    background?: string;
    color_scheme?: string;
    typography?: Record<string, unknown>;
    spacing?: Record<string, unknown>;
    cta_style?: string;
  };
  comparison?: {
    before: string;
    after: string;
  };
}

export interface SiteRedesignMessage {
  action: "site_redesign";
  site: string;
  current_state?: {
    design_age: string;
    major_issues: string[];
    strengths: string[];
  };
  components: LabsComponent[];
  global_tokens: {
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
    accent?: string;
    border?: string;
    [key: string]: unknown;
  };
  layout_changes?: {
    current: string;
    proposed: string;
  };
  estimated_impact?: {
    mobile_responsiveness: string;
    performance: string;
    user_engagement: string;
  };
  explanation?: string;
}

export interface ComponentRedesignMessage {
  action: "component_redesign";
  component_id: string;
  before_code?: string;
  after_code?: string;
  before_design?: string;
  after_design?: string;
  design_tokens: Record<string, unknown>;
  explanation?: string;
}

export interface OutreachMessage {
  action: "outreach";
  lead_id: string;
  site: string;
  company_name: string;
  contact: {
    name?: string;
    email?: string;
    title?: string;
  };
  pitch: {
    subject_line: string;
    body: string;
    cta: string;
  };
  follow_up_sequence?: Array<{
    day: number;
    message: string;
  }>;
  personalization_notes?: string;
}

export interface LeadScoreMessage {
  action: "lead_score";
  site: string;
  company_name: string;
  score: number; // 0-100
  factors: {
    design_quality: number;
    mobile_friendliness: number;
    content_freshness: number;
    conversion_readiness: number;
  };
  recommendation: "high_priority" | "medium" | "low_priority" | "skip";
  reason: string;
  estimated_redesign_time_hours: number;
  estimated_roi: string;
}

export type LabsProtocol =
  | SiteRedesignMessage
  | ComponentRedesignMessage
  | OutreachMessage
  | LeadScoreMessage;

/**
 * Labs context frame (extends UnifiedContextFrame)
 */
export interface LabsContextFrame {
  user_intent: string;
  site?: {
    url: string;
    title: string;
    description: string;
    screenshot?: string;
    dom_snapshot?: string;
    current_design_tokens?: Record<string, unknown>;
  };
  target_industry?: string;
  target_audience?: string;
  redesign_goals?: string[];
  competitor_analysis?: Array<{
    url: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  brand_guidelines?: {
    colors?: Record<string, string>;
    typography?: Record<string, unknown>;
    tone?: string;
  };
  lead_info?: {
    company: string;
    contact_name?: string;
    email?: string;
    industry?: string;
    estimated_traffic?: string;
  };
}

/**
 * Labs task types (for routing)
 */
export type LabsTaskType =
  | "labs_discovery"
  | "labs_harvest"
  | "labs_redesign"
  | "labs_component_redesign"
  | "labs_outreach"
  | "labs_lead_score"
  | "labs_delivery";

/**
 * Labs routing decision
 */
export interface LabsRoutingDecision {
  task_type: LabsTaskType;
  model: "glm-5.1" | "glm-5.2" | "glm-5";
  reasoning_effort: "low" | "high" | "max";
  enable_thinking: boolean;
  context_mode: "short" | "long";
  prompt_pack_id: string;
}

/**
 * Labs lead scoring result
 */
export interface Lead {
  id: string;
  site: string;
  company_name: string;
  score: number;
  recommendation: "high_priority" | "medium" | "low_priority" | "skip";
  contacted?: boolean;
  contacted_at?: number;
  response_status?: "no_response" | "interested" | "declined" | "scheduled_call";
}

/**
 * Labs campaign tracking
 */
export interface RewriteLabsCampaign {
  campaign_id: string;
  name: string;
  target_industry: string;
  leads: Lead[];
  redesigns_completed: number;
  contacted: number;
  interested: number;
  converted: number;
  created_at: number;
  updated_at: number;
}
