// kgtemporaldrift-familysearch.js — 2026-06-22 — v1.0.0

export function detectFamilySearchTemporalDrift({ previous, current }) {
  const drift = [];

  const prevMap = new Map(previous.map(e => [e.type, e.normalizedDate]));
  const currMap = new Map(current.map(e => [e.type, e.normalizedDate]));

  for (const [type, prevDate] of prevMap.entries()) {
    const currDate = currMap.get(type);

    if (currDate && currDate !== prevDate) {
      drift.push({
        type,
        previous: prevDate,
        current: currDate,
        driftMagnitude:
          Math.abs(parseInt(currDate.slice(0, 4)) - parseInt(prevDate.slice(0, 4)))
      });
    }
  }

  return drift;
}
