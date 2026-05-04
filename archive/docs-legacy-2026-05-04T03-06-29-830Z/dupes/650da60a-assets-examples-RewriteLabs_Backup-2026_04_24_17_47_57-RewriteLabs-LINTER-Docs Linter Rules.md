# Rewrite Labs — Documentation Style Linter Rules

## 1. Purpose
Ensure all documentation adheres to Rewrite Labs’ deterministic, operator‑grade writing standards.

## 2. Rule Categories
- Tone Rules
- Structure Rules
- Formatting Rules
- Versioning Rules
- Metadata Rules
- Prohibited Patterns

---

## 3. Tone Rules
- Must be direct, technical, and operator‑grade.
- No filler language.
- No rhetorical questions.
- No conversational fluff.
- No motivational tone.

---

## 4. Structure Rules
- H1: Document title
- H2: Major sections
- H3: Subsections
- Bullet lists preferred over long paragraphs.
- Steps must be numbered when sequential.

---

## 5. Formatting Rules
- No trailing spaces.
- No inconsistent indentation.
- No mixed heading styles.
- No broken internal links.
- All filenames must be referenced with correct paths.

---

## 6. Versioning Rules
- Every document must include:
  - Version number
  - Last updated date
- Every update must:
  - Increment version
  - Update CHANGELOG.md
  - Update version-manifest.json

---

## 7. Metadata Rules
- Title must match filename.
- Document must appear in INDEX.md.
- Document must appear in SITEMAP.md.

---

## 8. Prohibited Patterns
- “In today’s world”
- “At the end of the day”
- “Let’s explore”
- “Let’s dive in”
- “Game-changer”
- “Revolutionize”
- “Unlock”
- “Unleash”
- “As an AI”
- Any motivational or marketing phrasing.

---

## 9. Linter Output
- PASS → Document meets all rules.
- WARN → Minor issues (formatting, style).
- FAIL → Missing version, missing changelog, structural errors.
