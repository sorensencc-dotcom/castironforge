# Rewrite Labs Redesign Protocol

**Date:** 2026-06-17  
**Version:** 1.0.0  
**Status:** Specification

---

## Overview

The Rewrite Labs Redesign Protocol defines the JSON schemas for all outputs from GLM-5 when performing redesign tasks.

This ensures:
- **Determinism**: Identical input → identical redesign JSON
- **Parseability**: Automated validation and design system generation
- **Auditability**: Clear lineage of design decisions
- **Reusability**: Components and tokens can be applied to multiple sites

---

## Protocol Principles

1. **JSON-Only**: No prose, no markdown, no explanations in the response body
2. **Strict Schema**: Every response matches exactly one of the defined schemas
3. **Design Tokens**: All colors, spacing, typography defined as reusable tokens
4. **Component-Based**: Designs are decomposed into reusable components
5. **Reversibility**: Every design can be compared to the original

---

## Redesign Actions

### 1. Site Redesign

Complete site redesign with components, global design tokens, and layout strategy.

**Schema:**
```typescript
interface SiteRedesignMessage {
  action: "site_redesign";
  site: string;                    // URL
  current_state?: {
    design_age: string;            // "5+ years", "3 years", etc.
    major_issues: string[];        // Design problems
    strengths: string[];           // What works well
  };
  components: Array<{
    id: string;                    // "hero", "nav", "card", etc.
    name: string;                  // "Hero Section", "Navigation Bar"
    type: "hero" | "nav" | "card" | "form" | "cta" | "footer" | "section";
    new_design: {
      layout?: string;             // "flexbox", "grid", "centered", etc.
      background?: string;         // Color or gradient
      color_scheme?: string;       // "light", "dark", "high-contrast"
      typography?: {
        fontFamily?: string;
        fontSize?: string;
        fontWeight?: string;
        lineHeight?: string;
      };
      spacing?: {
        padding?: string;
        margin?: string;
        gap?: string;
      };
      cta_style?: string;          // "primary", "secondary", "ghost", etc.
    };
    comparison?: {
      before: string;              // Description of old design
      after: string;               // Description of new design
    };
  }>;
  global_tokens: {
    primary?: string;              // Primary action color (#hex)
    secondary?: string;            // Secondary color
    background?: string;           // Main background
    text?: string;                 // Text color
    accent?: string;               // Accent/highlight color
    border?: string;               // Border color
    shadow?: string;               // Shadow definition
    success?: string;              // Success state color
    error?: string;                // Error state color
    warning?: string;              // Warning state color
    info?: string;                 // Info state color
    [key: string]: unknown;        // Custom tokens
  };
  layout_changes?: {
    current: string;               // Current layout approach
    proposed: string;              // Proposed approach
  };
  estimated_impact?: {
    mobile_responsiveness: string; // "Significantly improved", "Good", etc.
    performance: string;           // "10% faster", "Optimized images", etc.
    user_engagement: string;       // "Higher CTR", "Increased scroll depth", etc.
  };
  explanation?: string;            // Why this redesign (2-3 sentences)
}
```

**Example:**
```json
{
  "action": "site_redesign",
  "site": "example-corp.com",
  "current_state": {
    "design_age": "5+ years",
    "major_issues": [
      "Outdated color palette",
      "Poor mobile responsiveness",
      "Weak call-to-action buttons",
      "Cluttered navigation"
    ],
    "strengths": [
      "Clear content hierarchy",
      "Good copy",
      "Trust signals present"
    ]
  },
  "components": [
    {
      "id": "hero",
      "name": "Hero Section",
      "type": "hero",
      "new_design": {
        "layout": "centered",
        "background": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "color_scheme": "dark",
        "typography": {
          "fontFamily": "Inter, sans-serif",
          "fontSize": "3.5rem",
          "fontWeight": "700",
          "lineHeight": "1.2"
        },
        "spacing": {
          "padding": "80px 20px",
          "margin": "0"
        }
      },
      "comparison": {
        "before": "Static image background with black text",
        "after": "Modern gradient with white text, better contrast"
      }
    },
    {
      "id": "nav",
      "name": "Navigation",
      "type": "nav",
      "new_design": {
        "layout": "flex",
        "background": "#ffffff",
        "spacing": {
          "padding": "16px 24px"
        }
      }
    }
  ],
  "global_tokens": {
    "primary": "#667eea",
    "secondary": "#764ba2",
    "background": "#f9fafb",
    "text": "#1f2937",
    "accent": "#fbbf24",
    "border": "#e5e7eb",
    "success": "#10b981",
    "error": "#ef4444",
    "warning": "#f59e0b",
    "info": "#3b82f6"
  },
  "layout_changes": {
    "current": "Fixed-width centered, sidebar navigation",
    "proposed": "Fluid container, mobile-first responsive grid"
  },
  "estimated_impact": {
    "mobile_responsiveness": "From poor to excellent (mobile-first approach)",
    "performance": "15% faster (optimized images, modern CSS)",
    "user_engagement": "Estimated 25% increase in CTA clicks"
  },
  "explanation": "This redesign modernizes the visual identity while maintaining trust and clarity. The gradient hero and improved color system create visual interest, while responsive layout ensures mobile users have a seamless experience."
}
```

---

### 2. Component Redesign

Detailed redesign of a single component with before/after code examples.

**Schema:**
```typescript
interface ComponentRedesignMessage {
  action: "component_redesign";
  component_id: string;            // "button", "card", "header", etc.
  before_code?: string;            // Original HTML/JSX
  after_code?: string;             // Improved HTML/JSX
  before_design?: string;          // Description of old design
  after_design?: string;           // Description of new design
  design_tokens: {
    [key: string]: unknown;        // Tokens used in this component
  };
  explanation?: string;            // Design rationale
}
```

**Example:**
```json
{
  "action": "component_redesign",
  "component_id": "cta_button",
  "before_code": "<button class=\"btn btn-primary\">Learn More</button>",
  "after_code": "<button class=\"btn btn-primary\" role=\"button\" aria-label=\"Learn more about our services\" data-testid=\"cta-primary\">\n  <span>Learn More</span>\n  <svg aria-hidden=\"true\" width=\"20\" height=\"20\" viewBox=\"0 0 20 20\">\n    <path fill=\"currentColor\" d=\"M...\"/>\n  </svg>\n</button>",
  "before_design": "Flat, minimal button with only text",
  "after_design": "Button with icon, hover states, smooth transitions, accessible focus indicator",
  "design_tokens": {
    "background": "#667eea",
    "text": "#ffffff",
    "hover_background": "#5568d3",
    "padding": "12px 24px",
    "border_radius": "8px",
    "font_weight": "600",
    "transition": "all 200ms ease-out"
  },
  "explanation": "Added icon to improve visual clarity, included accessibility attributes, and enhanced interactivity with smooth transitions and clear focus states."
}
```

---

### 3. Outreach

Personalized pitch for redesign outreach.

**Schema:**
```typescript
interface OutreachMessage {
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
    subject_line: string;          // Email subject (compelling, specific)
    body: string;                  // Email body (3-4 paragraphs)
    cta: string;                   // Call to action
  };
  follow_up_sequence?: Array<{
    day: number;                   // Days after initial email
    message: string;               // Brief follow-up message
  }>;
  personalization_notes?: string;  // Notes about what made it personal
}
```

**Example:**
```json
{
  "action": "outreach",
  "lead_id": "lead_12345",
  "site": "acmeindustries.com",
  "company_name": "Acme Industries",
  "contact": {
    "name": "Sarah Chen",
    "email": "sarah.chen@acmeindustries.com",
    "title": "Director of Marketing"
  },
  "pitch": {
    "subject_line": "Your site vs. competitors (design audit inside)",
    "body": "Hi Sarah,\n\nI noticed Acme Industries' website is a great platform for your technical products. I did a quick design audit and found three areas where your conversion rate could jump 20-30%:\n\n1. Your hero section lacks visual hierarchy (visitors need 3 seconds to understand your value prop)\n2. Your mobile navigation is hard to use on phones (70% of your traffic is mobile)\n3. Your CTA buttons don't stand out enough (they're getting lost in the layout)\n\nI've worked with companies like TechCorp and InnovateLabs to redesign their sites. Here's a before/after of what I'd do for Acme:\n\n[Visual comparison here]\n\nThe new design would give you a cleaner, more conversion-focused experience. Interested in a free 30-minute audit call?\n\nBest,\nDesign Team",
    "cta": "Schedule a free audit call"
  },
  "follow_up_sequence": [
    {
      "day": 3,
      "message": "Just wanted to follow up on my email from Monday. Quick question: is your main goal to increase conversions or brand perception?"
    },
    {
      "day": 7,
      "message": "Sarah, I'm helping 3 other companies in your industry right now. One just saw a 28% increase in qualified leads after redesigning. Happy to share more details if interested."
    }
  ],
  "personalization_notes": "Specific mention of their mobile traffic percentage (looked at analytics), referenced their exact pain points (hero, nav, CTAs), included case study from similar company."
}
```

---

### 4. Lead Score

Rapid qualification of a lead for redesign outreach.

**Schema:**
```typescript
interface LeadScoreMessage {
  action: "lead_score";
  site: string;
  company_name: string;
  score: number;                   // 0-100
  factors: {
    design_quality: number;        // 0-100 (how outdated)
    mobile_friendliness: number;   // 0-100
    content_freshness: number;     // 0-100
    conversion_readiness: number;  // 0-100
  };
  recommendation: "high_priority" | "medium" | "low_priority" | "skip";
  reason: string;
  estimated_redesign_time_hours: number;
  estimated_roi: string;           // "Strong", "Moderate", "Unclear"
}
```

**Example:**
```json
{
  "action": "lead_score",
  "site": "oldtech.io",
  "company_name": "OldTech Inc.",
  "score": 82,
  "factors": {
    "design_quality": 30,
    "mobile_friendliness": 45,
    "content_freshness": 60,
    "conversion_readiness": 25
  },
  "recommendation": "high_priority",
  "reason": "Severely outdated design (clearly pre-2018), poor mobile experience, but strong content and active business. Significant redesign opportunity with high ROI potential.",
  "estimated_redesign_time_hours": 120,
  "estimated_roi": "Strong (estimated 30-40% conversion increase)"
}
```

---

## Validation Rules

### All Actions

1. Must be valid JSON (UTF-8, no trailing commas)
2. Must have exactly one `action` field
3. Must match the schema for that action

### Site Redesign

1. `site` must be a valid URL or domain
2. `components` array must not be empty
3. Each component must have unique `id`
4. `global_tokens` must have at least primary, background, text colors
5. Color values must be valid hex, rgb, or named colors
6. All required fields must be present and non-empty

### Component Redesign

1. `component_id` must be a valid identifier
2. `design_tokens` must not be empty
3. Either `before_code` or `before_design` required
4. Either `after_code` or `after_design` required

### Outreach

1. `contact.email` must be valid email format (if present)
2. `pitch.subject_line` must be < 60 characters
3. `pitch.body` must be 300-800 characters
4. `follow_up_sequence` must be in chronological order
5. First follow-up must be at least 2 days later

### Lead Score

1. `score` must be 0-100
2. All factors must be 0-100
3. `recommendation` must be one of: high_priority, medium, low_priority, skip
4. `estimated_redesign_time_hours` must be > 0

---

## Application Flow

1. **Receive** GLM-5.2 response
2. **Parse** as JSON
3. **Validate** against schema
4. **Extract** components, tokens, or messaging
5. **Apply** to design system or outreach workflow
6. **Log** with call ID and timestamp
7. **Offer undo** or revision

---

## Error Handling

If GLM-5 produces invalid JSON:

1. Log error with call ID and original response
2. Request schema correction with specific feedback
3. Retry up to 2 times
4. If still invalid, escalate to user with explanation

If GLM-5 produces valid JSON but wrong schema:

1. Log schema mismatch
2. Request correction with list of valid actions
3. Retry once
4. If still wrong, escalate

---

## Examples

### Example 1: SaaS Site Redesign

Input: "Redesign a 4-year-old SaaS landing page for developer tools"

Output: `site_redesign` action with:
- Modern color scheme (purples/blues for tech credibility)
- Developer-focused copy and features
- Code snippet showcase components
- Fast, clean aesthetic
- Strong CTA for free trial

### Example 2: Lead Qualification

Input: "Score this agency website for redesign potential"

Output: `lead_score` action with:
- Score: 78 (high priority)
- Design quality: 35 (very outdated)
- Mobile: 52 (mediocre)
- Content: 80 (fresh, professional copy)
- Recommendation: high_priority
- ROI: Strong

### Example 3: Personalized Outreach

Input: "Create outreach for a local e-commerce business"

Output: `outreach` action with:
- Specific observations about their current site
- Mobile traffic and conversion rate context
- Relevant case studies (other e-commerce companies)
- Clear, benefit-driven CTA
- 2-3 follow-ups with different angles

---

## Testing

### Unit Tests

```typescript
describe("Labs Redesign Protocol Validation", () => {
  it("validates site_redesign schema", () => {
    const msg = {
      action: "site_redesign",
      site: "example.com",
      components: [...],
      global_tokens: {...}
    };
    expect(validateLabsProtocol(msg)).toBe(true);
  });

  it("rejects invalid color tokens", () => {
    const msg = {
      action: "site_redesign",
      ...,
      global_tokens: { primary: "not-a-color" }
    };
    expect(validateLabsProtocol(msg)).toThrow();
  });
});
```

### Integration Tests

1. Generate redesign from GLM-5.2
2. Validate schema
3. Extract components and tokens
4. Apply to design system
5. Verify CSS output
6. Test responsive behavior

---

## Future Extensions

- **Animation specifications**: Include transition and animation data
- **Accessibility notes**: Specific WCAG compliance improvements
- **Performance hints**: Optimization suggestions (lazy loading, etc.)
- **A/B testing variants**: Multiple redesign options
- **Competitor comparison**: Side-by-side with competitor sites
- **Asset specifications**: Image dimensions, formats, optimization

---

## References

- Unified Edit Protocol: EDIT_PROTOCOL.md
- CIC ↔ Labs Integration: CIC_LABS_INTEGRATION.md
- GLM-5 Integration: GLM5_INTEGRATION.md
