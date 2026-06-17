// Resolves ${{ path.to.value }} references against a context object.
// Supports: event.*, steps.<id>.output.*, now
export function resolveTemplates(value, context) {
  if (typeof value === 'string') {
    return value.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (_, expr) => {
      const path = expr.trim();
      if (path === 'now') return new Date().toISOString();
      const parts = path.split('.');
      let cur = context;
      for (const part of parts) {
        if (cur == null) return '';
        cur = cur[part];
      }
      return cur == null ? '' : typeof cur === 'object' ? JSON.stringify(cur) : String(cur);
    });
  }
  if (Array.isArray(value)) return value.map(v => resolveTemplates(v, context));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveTemplates(v, context)]),
    );
  }
  return value;
}
