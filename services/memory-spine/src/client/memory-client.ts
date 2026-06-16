/**
 * HTTP client for the Memory Spine service.
 * Used by calibration, smoke-test, and evaluation scripts.
 *
 * Env:
 *   MEMORY_SPINE_URL  default http://localhost:3100
 */

import type { MemoryQueryRequest, MemoryQueryResponse } from '../types.js';

const BASE = (process.env.MEMORY_SPINE_URL ?? 'http://localhost:3100').replace(/\/$/, '');

export async function queryMemory(
  queryText: string,
  opts: Partial<Omit<MemoryQueryRequest, 'query_text'>> = {},
): Promise<MemoryQueryResponse> {
  const body: MemoryQueryRequest = { query_text: queryText, ...opts };
  const res = await fetch(`${BASE}/v1/memory/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Memory Spine ${res.status}: ${text}`);
  }
  return res.json() as Promise<MemoryQueryResponse>;
}
