// Cross-service parity: these invariants, inputs, and expected patterns mirror
// services/memory-spine/src/lib/datetime.test.ts so both runtimes can be
// verified against the same spec without a monorepo cross-import.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nowISO, parseISO, toUserZone, formatRange } from './datetime.js';

describe('datetime.js — nowISO', () => {
  test('returns a parseable ISO 8601 string', () => {
    const iso = nowISO();
    assert.ok(!isNaN(new Date(iso).getTime()), `not parseable: ${iso}`);
  });

  test('is monotonically non-decreasing over 10 rapid reads', () => {
    const reads = Array.from({ length: 10 }, () => nowISO());
    for (let i = 1; i < reads.length; i++) {
      assert.ok(
        new Date(reads[i]).getTime() >= new Date(reads[i - 1]).getTime(),
        `read ${i} went backward: ${reads[i - 1]} > ${reads[i]}`,
      );
    }
  });
});

describe('datetime.js — parseISO', () => {
  test('parses UTC instant (parity: memory-spine parseISO UTC test)', () => {
    const { epochMs, zone } = parseISO('2026-01-15T12:00:00.000Z');
    assert.equal(zone, 'UTC');
    assert.equal(new Date(epochMs).toISOString(), '2026-01-15T12:00:00.000Z');
  });

  test('round-trips with nowISO without epoch loss', () => {
    const iso = nowISO();
    const { epochMs } = parseISO(iso);
    assert.ok(Math.abs(epochMs - new Date(iso).getTime()) <= 1);
  });

  test('DST spring-forward (America/New_York, 2026-03-08)', () => {
    const iso = '2026-03-08T07:00:00.000Z';
    const { epochMs } = parseISO(iso);
    assert.equal(epochMs, new Date(iso).getTime());
  });

  test('DST fall-back ordering (America/New_York, 2025-11-02)', () => {
    const a = parseISO('2025-11-02T05:00:00.000Z');
    const b = parseISO('2025-11-02T06:00:00.000Z');
    assert.ok(b.epochMs > a.epochMs, 'fall-back: later UTC instant must have higher epochMs');
  });

  test('leap day 2024-02-29', () => {
    const iso = '2024-02-29T00:00:00.000Z';
    const { epochMs } = parseISO(iso);
    assert.equal(new Date(epochMs).toISOString(), iso);
  });
});

describe('datetime.js — toUserZone', () => {
  test('UTC-8 winter: 20:00 UTC = 12:00 PST (America/Los_Angeles)', () => {
    const result = toUserZone('2026-01-15T20:00:00.000Z', 'America/Los_Angeles');
    assert.ok(result.includes('2026-01-15'), result);
    assert.ok(result.includes('12:00'), result);
  });

  test('UTC-4 summer: 12:00 UTC = 08:00 EDT (America/New_York)', () => {
    const result = toUserZone('2026-06-17T12:00:00.000Z', 'America/New_York');
    assert.ok(result.includes('08:00'), result);
  });

  test('UTC+1 summer: 11:00 UTC = 12:00 BST (Europe/London)', () => {
    const result = toUserZone('2026-06-17T11:00:00.000Z', 'Europe/London');
    assert.ok(result.includes('12:00'), result);
  });

  test('cross-midnight: 22:30 UTC = next day in Sydney (Australia/Sydney, UTC+11 summer)', () => {
    const result = toUserZone('2026-01-15T22:30:00.000Z', 'Australia/Sydney');
    assert.ok(result.includes('2026-01-16'), result);
  });

  test('invalid zone falls back gracefully without throwing', () => {
    const result = toUserZone('2026-01-15T12:00:00.000Z', 'Not/AZone');
    assert.ok(result.includes('2026-01-15'), result);
  });
});

describe('datetime.js — formatRange', () => {
  test('output format is cross-service compatible: "<dt> – <dt> [<zone>]"', () => {
    const result = formatRange('2026-01-01T00:00:00.000Z', '2026-01-01T06:00:00.000Z', 'UTC');
    assert.match(result, /^.+ – .+ \[[^\]]+\]$/);
    assert.ok(result.includes('[UTC]'), result);
  });

  test('start === end produces a valid single-point range', () => {
    const iso = '2026-06-17T00:00:00.000Z';
    const result = formatRange(iso, iso, 'UTC');
    assert.ok(result.includes('–'), result);
    assert.ok(result.includes('[UTC]'), result);
  });

  test('leap day range', () => {
    const result = formatRange('2024-02-29T08:00:00.000Z', '2024-02-29T17:00:00.000Z', 'UTC');
    assert.ok(result.includes('2024-02-29'), result);
  });

  test('cross-midnight DST range (America/New_York spring-forward 2026)', () => {
    const result = formatRange(
      '2026-03-08T06:59:00.000Z',
      '2026-03-08T07:01:00.000Z',
      'America/New_York',
    );
    assert.ok(result.includes('America/New_York'), result);
    assert.ok(result.includes('–'), result);
  });
});
