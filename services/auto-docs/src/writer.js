import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a technical documentation writer for the CIC autonomous engineering mesh.

Given a source file, produce a concise, accurate Markdown documentation page covering:
1. Purpose — one sentence describing what the file does
2. Exports / public API — every exported function, class, or constant with a one-line description and its signature or shape
3. Key behaviours — non-obvious logic, invariants, edge cases, or constraints worth calling out
4. Dependencies — external packages and internal modules imported
5. Usage example — a minimal, concrete code or config snippet showing the most common use

Rules:
- Write for an engineer who hasn't read this file before
- Do NOT repeat what the code already says clearly; focus on WHY and constraints
- Keep each section tight — no padding, no filler
- Use Markdown with ## section headers
- Emit ONLY the Markdown; no preamble, no code fences around the whole document`;

function fileTypeLabel(ext) {
  return { '.js': 'JavaScript', '.ts': 'TypeScript', '.py': 'Python',
           '.yaml': 'YAML', '.yml': 'YAML' }[ext] ?? 'text';
}

export async function generateDoc(file) {
  const label = fileTypeLabel(file.ext);
  const prompt = `File: \`${file.rel}\`\nType: ${label}\n\n\`\`\`${label.toLowerCase()}\n${file.content}\n\`\`\``;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find(b => b.type === 'text')?.text ?? '';
  return text.trim();
}

export function docOutputPath(rel, repoRoot) {
  // services/mesh-runtime/src/loader.js → docs/auto/services/mesh-runtime/src/loader.md
  // workflows/pr_review_pipeline.yaml   → docs/auto/workflows/pr_review_pipeline.md
  const noExt = rel.replace(/\.[^.]+$/, '');
  return path.join(repoRoot, 'docs', 'auto', `${noExt}.md`);
}
