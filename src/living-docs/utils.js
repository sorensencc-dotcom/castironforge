// File: src/living-docs/utils.js | Date: 2026-05-18 | v1.0.0
import { createHash } from 'node:crypto';

/**
 * Computes SHA256 hash of a string.
 * @param {string} content 
 * @returns {string}
 */
export function sha256(content) {
  return createHash('sha256').update(content || '').digest('hex');
}
