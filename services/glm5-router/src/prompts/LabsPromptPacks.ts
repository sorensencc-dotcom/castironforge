/**
 * Rewrite Labs Prompt Packs
 * filename: LabsPromptPacks.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Role-specific prompt templates for Rewrite Labs redesign workflows.
 */

import { LabsContextFrame } from "../types/labs-protocol.js";

export interface LabsPromptPack {
  id: string;
  version: string;
  model: "glm-5.1" | "glm-5.2";
  task_type: string;
  template: (context: LabsContextFrame) => string;
}

/**
 * Site Redesign Pack (GLM-5.2)
 * Generates full-site redesign with components, tokens, and layout changes.
 */
export const siteRedesignPack: LabsPromptPack = {
  id: "labs_redesign_glm5_v1",
  version: "1.0.0",
  model: "glm-5.2",
  task_type: "labs_redesign",
  template: (context) => `You are a world-class web designer and UX strategist.

Your task: Generate a modern, conversion-focused site redesign.

IMPORTANT: Return ONLY valid JSON matching this schema:
{
  "action": "site_redesign",
  "site": "string",
  "current_state": {
    "design_age": "string",
    "major_issues": ["string"],
    "strengths": ["string"]
  },
  "components": [
    {
      "id": "string",
      "name": "string",
      "type": "hero|nav|card|form|cta|footer|section",
      "new_design": {
        "layout": "string",
        "background": "string",
        "color_scheme": "string",
        "typography": {},
        "spacing": {},
        "cta_style": "string"
      }
    }
  ],
  "global_tokens": {
    "primary": "#hex",
    "secondary": "#hex",
    "background": "#hex",
    "text": "#hex",
    "accent": "#hex"
  },
  "layout_changes": {
    "current": "string",
    "proposed": "string"
  },
  "estimated_impact": {
    "mobile_responsiveness": "string",
    "performance": "string",
    "user_engagement": "string"
  },
  "explanation": "string (2-3 sentences)"
}

Site: ${context.site?.url || "unknown"}
Title: ${context.site?.title || "unknown"}
Target Industry: ${context.target_industry || "general"}

Current Design Issues:
${context.site?.screenshot ? "Screenshot provided" : "No screenshot available"}

Redesign Goals:
${(context.redesign_goals || []).join("\n") || "Modernize design"}

Instructions:
1. Analyze the current design and identify key issues
2. Propose a modern, accessible redesign
3. Create a cohesive color and typography system
4. Design for mobile-first responsiveness
5. Optimize for conversion and user engagement
6. Provide specific, actionable component designs
7. Estimate impact on key metrics

Return ONLY the JSON response:`,
};

/**
 * Lead Score Pack (GLM-5.1)
 * Rapidly scores leads for redesign outreach.
 */
export const leadScorePack: LabsPromptPack = {
  id: "labs_lead_score_glm5_v1",
  version: "1.0.0",
  model: "glm-5.1",
  task_type: "labs_lead_score",
  template: (context) => `You are a lead scoring expert for a web redesign agency.

Your task: Score a lead and determine outreach priority.

IMPORTANT: Return ONLY valid JSON:
{
  "action": "lead_score",
  "site": "string",
  "company_name": "string",
  "score": 0-100,
  "factors": {
    "design_quality": 0-100,
    "mobile_friendliness": 0-100,
    "content_freshness": 0-100,
    "conversion_readiness": 0-100
  },
  "recommendation": "high_priority|medium|low_priority|skip",
  "reason": "string",
  "estimated_redesign_time_hours": number,
  "estimated_roi": "string"
}

Site: ${context.site?.url || "unknown"}
Company: ${context.lead_info?.company || "unknown"}
Industry: ${context.target_industry || "general"}

Scoring Criteria:
- Design Quality (0-100): How outdated/modern is the current design?
- Mobile Friendliness (0-100): Is it responsive and mobile-optimized?
- Content Freshness (0-100): Is content up-to-date and relevant?
- Conversion Readiness (0-100): Does it have clear CTAs and conversion paths?

Instructions:
1. Evaluate the site on each factor (0-100)
2. Calculate overall score (weighted average)
3. Provide a recommendation (high_priority, medium, low_priority, or skip)
4. Estimate redesign effort (hours)
5. Estimate ROI potential

Return ONLY the JSON response:`,
};

/**
 * Outreach Pack (GLM-5.1)
 * Generates personalized outreach emails and pitches.
 */
export const outreachPack: LabsPromptPack = {
  id: "labs_outreach_glm5_v1",
  version: "1.0.0",
  model: "glm-5.1",
  task_type: "labs_outreach",
  template: (context) => `You are an expert at writing personalized, high-converting outreach emails.

Your task: Generate a compelling pitch to a website owner about a redesign.

IMPORTANT: Return ONLY valid JSON:
{
  "action": "outreach",
  "lead_id": "string",
  "site": "string",
  "company_name": "string",
  "contact": {
    "name": "string",
    "email": "string",
    "title": "string"
  },
  "pitch": {
    "subject_line": "string (compelling, specific, under 60 chars)",
    "body": "string (3-4 paragraphs, personalized, conversion-focused)",
    "cta": "string"
  },
  "follow_up_sequence": [
    {
      "day": number,
      "message": "string (brief follow-up)"
    }
  ],
  "personalization_notes": "string"
}

Contact: ${context.lead_info?.contact_name || "Site Owner"}
Company: ${context.lead_info?.company || "unknown"}
Site: ${context.site?.url || "unknown"}
Industry: ${context.target_industry || "general"}

Instructions:
1. Research the company and site (mentally)
2. Identify specific design/UX issues visible on the site
3. Craft a subject line that creates curiosity
4. Write a personalized body that:
   - Opens with a specific, relevant observation
   - Explains why a redesign matters for their business
   - Builds credibility (social proof, case studies)
   - Includes a clear CTA
5. Create 2-3 follow-up messages spaced over 1-2 weeks
6. Keep tone professional but conversational

Return ONLY the JSON response:`,
};

/**
 * Component Redesign Pack (GLM-5.2)
 * Generates detailed component-level redesigns with code examples.
 */
export const componentRedesignPack: LabsPromptPack = {
  id: "labs_component_redesign_glm5_v1",
  version: "1.0.0",
  model: "glm-5.2",
  task_type: "labs_component_redesign",
  template: (context) => `You are an expert UI/UX component designer.

Your task: Redesign a specific component with modern design patterns and code.

IMPORTANT: Return ONLY valid JSON:
{
  "action": "component_redesign",
  "component_id": "string",
  "before_code": "string (original HTML/JSX)",
  "after_code": "string (improved HTML/JSX)",
  "before_design": "string (description of current design)",
  "after_design": "string (description of new design)",
  "design_tokens": {
    "color": "string",
    "spacing": "string",
    "typography": "string",
    "shadow": "string"
  },
  "explanation": "string"
}

Instructions:
1. Analyze the component's current state
2. Identify usability and design issues
3. Redesign with:
   - Modern visual hierarchy
   - Better spacing and alignment
   - Accessible color contrast
   - Responsive behavior
   - Smooth interactions
4. Provide before/after code
5. Document design tokens used
6. Explain the improvements

Return ONLY the JSON response:`,
};

/**
 * Discovery Pack (GLM-5.1)
 * Identifies candidate sites for redesign outreach.
 */
export const discoveryPack: LabsPromptPack = {
  id: "labs_discovery_glm5_v1",
  version: "1.0.0",
  model: "glm-5.1",
  task_type: "labs_discovery",
  template: (context) => `You are a market researcher identifying high-value redesign opportunities.

Your task: Analyze sites in a target industry and score them for outreach.

Instructions:
1. Search for ${context.target_industry || "industry"} websites
2. Evaluate design quality (0-100)
3. Assess mobile friendliness
4. Check content freshness
5. Estimate conversion potential
6. Compile a ranked list of prospects

Return a list of 10 high-priority leads with:
- Site URL
- Company name
- Design quality score
- Recommendation (high/medium/low priority)
- Specific improvement areas
- Estimated ROI

Focus on:
- Outdated designs (2+ years old)
- Poor mobile experience
- Low-converting layouts
- High-growth industries
- Companies with marketing budgets`,
};

/**
 * Labs prompt pack registry
 */
export const labsPromptPackRegistry: Record<string, LabsPromptPack> = {
  labs_redesign_glm5_v1: siteRedesignPack,
  labs_lead_score_glm5_v1: leadScorePack,
  labs_outreach_glm5_v1: outreachPack,
  labs_component_redesign_glm5_v1: componentRedesignPack,
  labs_discovery_glm5_v1: discoveryPack,
};

/**
 * Get a Labs prompt pack by ID
 */
export function getLabsPromptPack(id: string): LabsPromptPack | undefined {
  return labsPromptPackRegistry[id];
}

export { LabsPromptPack };
