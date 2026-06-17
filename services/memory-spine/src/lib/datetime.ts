// DateTimeService: Temporal API (TC39 Stage 4) backed implementation with Date fallback.
// All public methods accept and return ISO 8601 strings for deterministic interchange.

/* eslint-disable @typescript-eslint/no-explicit-any */
function temporalGlobal(): any {
  return (globalThis as any).Temporal;
}

function hasTemporalSupport(): boolean {
  try {
    const T = temporalGlobal();
    return typeof T?.Now?.instant === 'function' &&
           typeof T?.Instant?.from === 'function' &&
           typeof T?.ZonedDateTime !== 'undefined';
  } catch {
    return false;
  }
}

export interface DateTimeService {
  /** Returns current UTC instant as ISO 8601. */
  nowISO(): string;
  /** Parses an ISO 8601 string to epoch milliseconds and IANA zone (UTC if absent). */
  parseISO(iso: string): { epochMs: number; zone: string };
  /** Converts an ISO 8601 UTC instant to the given IANA zone, returns zoned ISO string. */
  toUserZone(iso: string, zone: string): string;
  /** Formats a closed date-time range in the given zone as a human-readable string. */
  formatRange(startISO: string, endISO: string, zone?: string): string;
}

export class TemporalDateTimeService implements DateTimeService {
  private T = temporalGlobal();

  nowISO(): string {
    return this.T.Now.instant().toString();
  }

  parseISO(iso: string): { epochMs: number; zone: string } {
    const instant = this.T.Instant.from(iso);
    const bracketMatch = /\[([^\]]+)\]/.exec(iso);
    const zone = bracketMatch ? bracketMatch[1] : 'UTC';
    return { epochMs: Number(instant.epochMilliseconds), zone };
  }

  toUserZone(iso: string, zone: string): string {
    return this.T.Instant.from(iso).toZonedDateTimeISO(zone).toString();
  }

  formatRange(startISO: string, endISO: string, zone = 'UTC'): string {
    const start = this.T.Instant.from(startISO).toZonedDateTimeISO(zone).toPlainDateTime().toString();
    const end   = this.T.Instant.from(endISO).toZonedDateTimeISO(zone).toPlainDateTime().toString();
    return `${start} – ${end} [${zone}]`;
  }
}

export class LegacyDateTimeService implements DateTimeService {
  nowISO(): string {
    return new Date().toISOString();
  }

  parseISO(iso: string): { epochMs: number; zone: string } {
    return { epochMs: new Date(iso).getTime(), zone: 'UTC' };
  }

  toUserZone(iso: string, zone: string): string {
    const d = new Date(iso);
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
        fractionalSecondDigits: 3,
      }).formatToParts(d);

      const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
      return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.${get('fractionalSecond')}[${zone}]`;
    } catch {
      return d.toISOString();
    }
  }

  formatRange(startISO: string, endISO: string, zone = 'UTC'): string {
    const fmt = (iso: string) => this.toUserZone(iso, zone).replace(/\[[^\]]+\]$/, '');
    return `${fmt(startISO)} – ${fmt(endISO)} [${zone}]`;
  }
}

export function createDateTimeService(): DateTimeService {
  return hasTemporalSupport() ? new TemporalDateTimeService() : new LegacyDateTimeService();
}

export const dateTimeService: DateTimeService = createDateTimeService();
