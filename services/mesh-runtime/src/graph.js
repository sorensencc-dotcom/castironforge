// Topological sort of workflow steps using Kahn's algorithm.
// Steps with empty depends_on run first and may execute in parallel.
export function buildExecutionOrder(steps) {
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const inDegree = new Map(steps.map(s => [s.id, (s.depends_on ?? []).length]));
  const queue = steps.filter(s => (s.depends_on ?? []).length === 0).map(s => s.id);
  const order = [];

  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);
    for (const step of steps) {
      if (!(step.depends_on ?? []).includes(id)) continue;
      const degree = inDegree.get(step.id) - 1;
      inDegree.set(step.id, degree);
      if (degree === 0) queue.push(step.id);
    }
  }

  if (order.length !== steps.length) {
    throw new Error(
      `Workflow step graph contains a cycle or unresolvable dependency. ` +
        `Unresolved: ${[...inDegree.entries()].filter(([, d]) => d > 0).map(([id]) => id).join(', ')}`,
    );
  }

  return order.map(id => stepMap.get(id));
}
