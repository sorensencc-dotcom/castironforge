// File: src/living-docs/diff.js | Date: 2026-05-18 | v1.0.0

/**
 * Very simple line-based diff summary.
 * @param {string} local 
 * @param {string} remote 
 * @returns {object}
 */
export function computeDiff(local, remote) {
  const localLines = (local || '').split('\n');
  const remoteLines = (remote || '').split('\n');
  
  const equal = local === remote;
  if (equal) {
    return { equal: true, added: 0, removed: 0, changed: 0, preview: 'Files are identical.' };
  }

  // Simple heuristic for added/removed lines
  let added = 0;
  let removed = 0;
  let changed = 0;

  // This is a very basic diff; in a real scenario, we might use a library like 'diff'
  // But for this operator-grade spec, we'll do a simple comparison for the summary.
  const maxLines = Math.max(localLines.length, remoteLines.length);
  const diffLines = [];

  for (let i = 0; i < maxLines; i++) {
    const l = localLines[i];
    const r = remoteLines[i];
    
    if (l !== r) {
      if (l === undefined) {
        added++;
        if (diffLines.length < 5) diffLines.push(`+ ${r}`);
      } else if (r === undefined) {
        removed++;
        if (diffLines.length < 5) diffLines.push(`- ${l}`);
      } else {
        changed++;
        if (diffLines.length < 5) diffLines.push(`~ ${l} -> ${r}`);
      }
    }
  }

  return {
    equal: false,
    added,
    removed,
    changed,
    preview: diffLines.join('\n') + (maxLines > 5 ? '\n...' : '')
  };
}
