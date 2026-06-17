import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LegacyDateTimeService, createDateTimeService } from './datetime.js';

const svc = new LegacyDateTimeService();

describe('LegacyDateTimeService.nowISO', () => {
  test('returns a valid ISO 8601 string', () => {
    const iso = svc.nowISO();
    assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
  });

  test('is monotonically non-decreasing', () => {
    const a = svc.nowISO();
    const b = svc.nowISO();
    assert.ok(new Date(b).getTime() >= new Date(a).getTime());
  });
});

describe('LegacyDateTimeService.parseISO', () => {
  test('parses UTC instant', () => {
    const { epochMs, zone } = svc.parseISO('2026-01-15T12:00:00.000Z');
    assert.equal(zone, 'UTC');
    assert.equal(new Date(epochMs).toISOString(), '2026-01-15T12:00:00.000Z');
  });

  test('DST boundary: spring-forward (America/New_York, 2026-03-08 02:00)', () => {
    // 07:00 UTC = 02:00 EST (clocks spring forward, so this instant exists)
    const iso = '2026-03-08T07:00:00.000Z';
    const { epochMs, zone } = svc.parseISO(iso);
    assert.equal(zone, 'UTC');
    assert.equal(epochMs, new Date(iso).getTime());
  });

  test('DST boundary: fall-back (America/New_York, 2025-11-02)', () => {
    // 06:00 UTC = 01:00 EST (after fall-back); 05:00 UTC = 01:00 EDT (before)
    const isoEDT = '2025-11-02T05:00:00.000Z';
    const isoEST = '2025-11-02T06:00:00.000Z';
    const a = svc.parseISO(isoEDT);
    const b = svc.parseISO(isoEST);
    assert.ok(b.epochMs > a.epochMs, 'fall-back: later UTC instant has higher epochMs');
  });

  test('leap day 2024-02-29 parses correctly', () => {
    const iso = '2024-02-29T00:00:00.000Z';
    const { epochMs } = svc.parseISO(iso);
    assert.equal(new Date(epochMs).toISOString(), iso);
  });
});

describe('LegacyDateTimeService.toUserZone', () => {
  test('converts UTC to America/Los_Angeles (UTC-8 in winter)', () => {
    // 2026-01-15 20:00 UTC = 2026-01-15 12:00 PST
    const result = svc.toUserZone('2026-01-15T20:00:00.000Z', 'America/Los_Angeles');
    assert.ok(result.includes('2026-01-15'), `expected 2026-01-15 in result, got: ${result}`);
    assert.ok(result.includes('12:00'), `expected 12:00 in result, got: ${result}`);
    assert.ok(result.includes('America/Los_Angeles'), `expected zone label in result, got: ${result}`);
  });

  test('converts UTC to Europe/London (UTC+1 in summer)', () => {
    // 2026-06-17 11:00 UTC = 2026-06-17 12:00 BST
    const result = svc.toUserZone('2026-06-17T11:00:00.000Z', 'Europe/London');
    assert.ok(result.includes('2026-06-17'), `expected 2026-06-17, got: ${result}`);
    assert.ok(result.includes('12:00'), `expected 12:00 BST, got: ${result}`);
  });

  test('falls back to UTC ISO on invalid zone', () => {
    const result = svc.toUserZone('2026-01-15T12:00:00.000Z', 'Not/AZone');
    assert.match(result, /2026-01-15T12:00:00/);
  });

  test('cross-zone range preserves date boundary', () => {
    // 2026-01-15 23:30 UTC = 2026-01-16 09:30 in Australia/Sydney (UTC+11 in summer)
    const result = svc.toUserZone('2026-01-15T22:30:00.000Z', 'Australia/Sydney');
    assert.ok(result.includes('2026-01-16'), `expected next day in Sydney, got: ${result}`);
  });
});

describe('LegacyDateTimeService.formatRange', () => {
  test('formats a range in UTC', () => {
    const result = svc.formatRange('2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', 'UTC');
    assert.ok(result.includes('[UTC]'), `expected [UTC] in: ${result}`);
    assert.ok(result.includes('–'), `expected dash separator in: ${result}`);
  });

  test('handles same-day leap day range', () => {
    const result = svc.formatRange(
      '2024-02-29T08:00:00.000Z',
      '2024-02-29T17:00:00.000Z',
      'UTC',
    );
    assert.ok(result.includes('2024-02-29'), `expected leap day in result: ${result}`);
  });

  test('handles cross-midnight DST range', () => {
    // Start just before DST spring-forward, end just after
    const result = svc.formatRange(
      '2026-03-08T06:59:00.000Z',
      '2026-03-08T07:01:00.000Z',
      'America/New_York',
    );
    assert.ok(result.includes('America/New_York'), `zone in: ${result}`);
    assert.ok(result.includes('–'), `separator in: ${result}`);
  });
});

describe('createDateTimeService', () => {
  test('returns a usable service regardless of Temporal availability', () => {
    const s = createDateTimeService();
    const iso = s.nowISO();
    assert.ok(typeof iso === 'string' && iso.length > 0);
    // Re-parsing our own output should work
    const { epochMs } = s.parseISO(iso);
    assert.ok(epochMs > 0);
  });
});
