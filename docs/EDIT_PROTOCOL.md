# Unified Edit Protocol

**Date:** 2026-06-17  
**Version:** 1.0.0  
**Status:** Specification

---

## Overview

The Unified Edit Protocol defines the deterministic JSON schemas that GLM-5 must use for all user-facing edits.

This ensures:
- **Determinism**: Identical input → identical JSON output
- **Parseability**: Automated validation and application
- **Auditability**: Clear lineage of what changed and why
- **Testability**: Reproducible, scriptable testing

---

## Protocol Principles

1. **JSON-Only**: No prose, no markdown code blocks, no explanations in the response body
2. **Strict Schema**: Every response matches exactly one of the defined schemas
3. **One Action Per Response**: No bundled actions; one call = one JSON response
4. **Explanation Field**: Optional but recommended; explains the rationale
5. **Reversibility**: Every edit is reversible (can be undone)

---

## Edit Actions

### 1. DOM Edit

Modifies the DOM (HTML structure, inline styles, classes).

**Schema:**
```typescript
interface DOMEditMessage {
  action: "dom_edit";
  target: {
    selector: string;           // CSS selector to target element(s)
    component?: string;         // Optional: React/Vue component name
  };
  patches: Array<{
    path: string;              // "style.property" or "classList" or "textContent"
    value: string | number | boolean;
  }>;
  explanation?: string;        // Why this change improves UX/design
}
```

**Example:**
```json
{
  "action": "dom_edit",
  "target": {
    "selector": "#hero-header",
    "component": "HeroSection"
  },
  "patches": [
    { "path": "style.backgroundColor", "value": "#0f172a" },
    { "path": "style.color", "value": "#ffffff" },
    { "path": "classList.add", "value": "dark-mode" }
  ],
  "explanation": "Apply dark mode theme for reduced eye strain in evening viewing"
}
```

**Valid path formats:**
- `style.property` → Set inline CSS property
- `classList.add` → Add a CSS class
- `classList.remove` → Remove a CSS class
- `textContent` → Set element text
- `innerHTML` → Set element HTML (use with caution)
- `attribute.name` → Set HTML attribute

---

### 2. Design Variant

Proposes alternative design tokens and CSS variable sets for a component.

**Schema:**
```typescript
interface DesignVariantMessage {
  action: "design_variant";
  component: string;           // Component name (e.g., "Button", "Card")
  variants: Array<{
    id: string;               // Unique variant ID (e.g., "btn_dark_glass")
    tokens?: {
      [key: string]: unknown;  // Token key-value pairs
    };
    description: string;       // What this variant is for
  }>;
  explanation?: string;        // Overall design rationale
}
```

**Example:**
```json
{
  "action": "design_variant",
  "component": "Button",
  "variants": [
    {
      "id": "btn_dark_glass",
      "tokens": {
        "bg": "#1e293b",
        "border": "#334155",
        "text": "#f1f5f9",
        "hover_bg": "#334155",
        "shadow": "0 4px 20px rgba(0,0,0,0.3)"
      },
      "description": "Dark glassmorphism button for dark-mode contexts"
    },
    {
      "id": "btn_neon",
      "tokens": {
        "bg": "#7c3aed",
        "border": "#a78bfa",
        "text": "#ffffff",
        "hover_bg": "#a78bfa",
        "shadow": "0 0 20px #7c3aed"
      },
      "description": "Neon purple accent for high-contrast call-to-action"
    }
  ],
  "explanation": "Two design directions for modern, accessible button styling"
}
```

---

### 3. Code Edit

Modifies source code (TypeScript, JavaScript, HTML, CSS, etc.).

**Schema:**
```typescript
interface CodeEditMessage {
  action: "code_edit";
  file: string;               // Path to file (e.g., "src/components/Button.tsx")
  diff: string;               // Unified diff format (see below)
  explanation?: string;       // Why this change is necessary
}
```

**Diff Format:**
Uses standard unified diff format:
```
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -10,7 +10,9 @@
 export const Button = ({ label, onClick }: Props) => {
   return (
-    <button onClick={onClick}>{label}</button>
+    <button onClick={onClick} className="btn">
+      {label}
+    </button>
   );
 };
```

**Rules:**
- Must be valid unified diff
- Must include file header (`--- a/...` and `+++ b/...`)
- Must include hunk headers (`@@ -10,7 +10,9 @@`)
- Context lines start with space ` `
- Removed lines start with `-`
- Added lines start with `+`

**Example:**
```json
{
  "action": "code_edit",
  "file": "src/hooks/useAuth.ts",
  "diff": "--- a/src/hooks/useAuth.ts\n+++ b/src/hooks/useAuth.ts\n@@ -5,6 +5,8 @@\n export const useAuth = () => {\n   const [user, setUser] = useState(null);\n+  const [loading, setLoading] = useState(false);\n+  const [error, setError] = useState<string | null>(null);\n   \n   return { user, setUser };\n };",
  "explanation": "Add loading and error state management for better UX during authentication"
}
```

---

### 4. Refactor Plan

Proposes a multi-step refactoring plan for architectural changes.

**Schema:**
```typescript
interface RefactorPlanMessage {
  action: "refactor_plan";
  scope: "local" | "multi_file" | "repo_scale";
  steps: Array<{
    id: string;               // Step ID (e.g., "extract_layout")
    description: string;      // What to do
    files: string[];          // Affected files
    dependencies?: string[];  // Step dependencies (other step IDs)
  }>;
  explanation?: string;       // Overall refactoring strategy
}
```

**Example:**
```json
{
  "action": "refactor_plan",
  "scope": "multi_file",
  "steps": [
    {
      "id": "extract_layout",
      "description": "Extract shared layout wrapper into LayoutShell component",
      "files": ["src/components/LayoutShell.tsx"],
      "dependencies": []
    },
    {
      "id": "update_home",
      "description": "Refactor Home page to use LayoutShell",
      "files": ["src/pages/Home.tsx"],
      "dependencies": ["extract_layout"]
    },
    {
      "id": "update_about",
      "description": "Refactor About page to use LayoutShell",
      "files": ["src/pages/About.tsx"],
      "dependencies": ["extract_layout"]
    },
    {
      "id": "remove_duplication",
      "description": "Remove old layout code from individual pages",
      "files": ["src/pages/Home.tsx", "src/pages/About.tsx"],
      "dependencies": ["update_home", "update_about"]
    }
  ],
  "explanation": "Consolidate layout logic into a single, reusable component to reduce duplication and enable consistent styling"
}
```

---

### 5. Search Answer

Answers a query about the codebase and provides location references.

**Schema:**
```typescript
interface AnswerMessage {
  action: "answer";
  response: string;           // The answer (1-2 sentences)
  locations?: string[];       // File locations (e.g., "src/App.tsx:42")
}
```

**Example:**
```json
{
  "action": "answer",
  "response": "The NavBar component is imported and used in Home.tsx (line 8), About.tsx (line 12), and Footer.tsx (line 5). It's also exported from src/components/index.ts.",
  "locations": [
    "src/pages/Home.tsx:8",
    "src/pages/About.tsx:12",
    "src/layout/Footer.tsx:5",
    "src/components/index.ts:3"
  ]
}
```

---

## Validation Rules

### All Actions

1. Must be valid JSON (UTF-8, no trailing commas)
2. Must have exactly one `action` field
3. Must match the schema for that action

### DOM Edit

1. `selector` must be a valid CSS selector
2. `patches` array must not be empty
3. Each patch `path` must be one of: `style.*`, `classList`, `textContent`, `innerHTML`, `attribute.*`
4. Each patch `value` must be string, number, or boolean

### Code Edit

1. `file` must be a relative path (e.g., `src/components/Button.tsx`)
2. `diff` must be valid unified diff format
3. Diff must include file headers and hunk headers
4. Diff must match the actual file structure (can be validated by applying)

### Refactor Plan

1. `scope` must be one of: `local`, `multi_file`, `repo_scale`
2. `steps` array must not be empty
3. Each step `id` must be unique
4. Dependencies must reference valid step IDs
5. No circular dependencies

### Search Answer

1. `response` must be non-empty string
2. `locations` (if present) must be non-empty array
3. Each location must be in format `path:line` or `path:line:col`

---

## Error Handling

If GLM-5 produces invalid JSON:

1. Log the error with call ID
2. Request schema correction: *"Your response was invalid JSON. Please return only valid JSON matching the [action] schema."*
3. Retry up to 2 times
4. If still invalid, escalate to user with explanation

If GLM-5 produces valid JSON but wrong schema:

1. Log as schema mismatch
2. Request correction: *"Your action field must be one of: dom_edit, code_edit, refactor_plan, answer"*
3. Retry once
4. If still wrong, escalate

---

## Application Flow

1. **Receive** GLM-5 response
2. **Parse** as JSON
3. **Validate** against schema
4. **Apply** to target (DOM, code, or generate UI)
5. **Log** change with explanation
6. **Offer undo** to user

---

## Undo/Reversibility

Every edit must be reversible:

- **DOM Edit**: Store original values before patching
- **Code Edit**: Keep original file content, apply diff in reverse
- **Refactor Plan**: Mark as draft, require user approval before applying
- **Design Variant**: Keep current tokens, switch back on request

---

## Examples

### Example 1: Dark Mode Toggle

**User Request:** "Make the site dark mode"

**GLM-5.2 Response (Multiple Actions):**
```json
{
  "action": "dom_edit",
  "target": { "selector": "body" },
  "patches": [
    { "path": "style.backgroundColor", "value": "#0f172a" },
    { "path": "style.color", "value": "#f1f5f9" }
  ]
}
```

Follow up with design variant action for consistent theming.

### Example 2: Extract Component

**User Request:** "Extract the sidebar into its own component"

**GLM-5.2 Response:**
```json
{
  "action": "refactor_plan",
  "scope": "multi_file",
  "steps": [
    {
      "id": "create_sidebar",
      "description": "Create src/components/Sidebar.tsx with extracted sidebar code",
      "files": ["src/components/Sidebar.tsx"]
    },
    {
      "id": "import_sidebar",
      "description": "Import Sidebar in Layout.tsx and replace inline code",
      "files": ["src/layout/Layout.tsx"],
      "dependencies": ["create_sidebar"]
    }
  ]
}
```

### Example 3: Find Component Usage

**User Request:** "Where is the Card component used?"

**GLM-5.1 Response:**
```json
{
  "action": "answer",
  "response": "The Card component is used in 4 files: Dashboard.tsx (3 instances), ProfilePage.tsx (1), TestimonialSection.tsx (2), and exported from src/components/index.ts.",
  "locations": [
    "src/pages/Dashboard.tsx:12",
    "src/pages/Dashboard.tsx:28",
    "src/pages/Dashboard.tsx:45",
    "src/pages/ProfilePage.tsx:8",
    "src/components/TestimonialSection.tsx:20",
    "src/components/TestimonialSection.tsx:45",
    "src/components/index.ts:5"
  ]
}
```

---

## Testing

### Unit Tests

```typescript
describe("Edit Protocol Validation", () => {
  it("validates DOM edit schema", () => {
    const msg = {
      action: "dom_edit",
      target: { selector: "#header" },
      patches: [{ path: "style.backgroundColor", value: "#ff0000" }],
    };
    expect(validateEditProtocol(msg)).toBe(true);
  });

  it("rejects invalid patches", () => {
    const msg = {
      action: "dom_edit",
      target: { selector: "#header" },
      patches: [{ path: "invalid.path", value: "value" }],
    };
    expect(validateEditProtocol(msg)).toThrow();
  });
});
```

### Integration Tests

1. Generate edit from GLM-5
2. Validate schema
3. Apply to test DOM
4. Verify result matches expectation
5. Test undo

---

## Future Extensions

- **Multi-file DOM edits**: Coordinate changes across components
- **Performance annotations**: Mark edits with performance impact
- **Breakpoint targets**: Edit at specific viewport sizes
- **Animation specifications**: Include transition/animation data
- **A/B test variants**: Tag edits for experimentation

---

## References

- Unified Diff Format: https://en.wikipedia.org/wiki/Diff#Unified_format
- JSON Schema: https://json-schema.org/
- CSS Selectors: https://developer.mozilla.org/en-US/docs/Web/CSS/Selectors
