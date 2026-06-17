// DateTimeService for mesh-runtime: Temporal API with Date fallback.
// Mirrors the interface in memory-spine/src/lib/datetime.ts.

function hasTemporalSupport() {
  try {
    return typeof globalThis.Temporal?.Now?.instant === 'function' &&
           typeof globalThis.Temporal?.Instant?.from === 'function';
  } catch {
    return false;
  }
}

const temporal = hasTemporalSupport() ? globalThis.Temporal : null;

export function nowISO() {
  if (temporal) return temporal.Now.instant().toString();
  return new Date().toISOString();
}

export function parseISO(iso) {
  if (temporal) {
    const instant = temporal.Instant.from(iso);
    const bracketMatch = /\[([^\]]+)\]/.exec(iso);
    return { epochMs: Number(instant.epochMilliseconds), zone: bracketMatch?.[1] ?? 'UTC' };
  }
  return { epochMs: new Date(iso).getTime(), zone: 'UTC' };
}

export function toUserZone(iso, zone) {
  if (temporal) {
    return temporal.Instant.from(iso).toZonedDateTimeISO(zone).toString();
  }
  const d = new Date(iso);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = t => parts.find(p => p.type === t)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}[${zone}]`;
  } catch {
    return d.toISOString();
  }
}

export function formatRange(startISO, endISO, zone = 'UTC') {
  const fmt = iso => toUserZone(iso, zone).replace(/\[[^\]]+\]$/, '');
  return `${fmt(startISO)} – ${fmt(endISO)} [${zone}]`;
}
