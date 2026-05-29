// File: src/providers/qdrant.js | Date: 2026-05-28 | v1.0.0
// §0.1-A — Qdrant Client Wiring + Connectivity

import { QdrantClient } from '@qdrant/js-client-rest';
import { log, logError } from '../lib/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

let client = null;

/**
 * Validates environment variables and initializes the Qdrant client.
 * @returns {QdrantClient}
 */
export function getQdrantClient() {
  if (client) return client;

  if (!QDRANT_URL) {
    throw new Error('QDRANT_URL environment variable is not defined.');
  }

  client = new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY,
  });

  return client;
}

/**
 * Deterministic connection and health check for Qdrant.
 * @returns {Promise<boolean>}
 */
export async function healthCheckQdrant() {
  try {
    const qdrant = getQdrantClient();
    // Use clusters/status or healthz for a lightweight check
    const health = await qdrant.api('health');
    if (health) {
      log('INFO', 'QDRANT_PROVIDER', 'Qdrant connectivity verified.');
      return true;
    }
    return false;
  } catch (error) {
    logError('QDRANT_PROVIDER', 'Qdrant health check failed.', { error: error.message });
    return false;
  }
}

/**
 * Insert a vector into a specified collection.
 * @param {string} collection 
 * @param {string|number} id 
 * @param {number[]} vector 
 * @param {object} payload 
 */
export async function insertVector(collection, id, vector, payload = {}) {
  try {
    const qdrant = getQdrantClient();
    await qdrant.upsert(collection, {
      wait: true,
      points: [{ id, vector, payload }]
    });
    log('INFO', 'QDRANT_PROVIDER', `Vector inserted into collection: ${collection}`, { id });
  } catch (error) {
    logError('QDRANT_PROVIDER', `Failed to insert vector into ${collection}`, { id, error: error.message });
    throw error;
  }
}

/**
 * Query nearest neighbors from a specified collection.
 * @param {string} collection 
 * @param {number[]} vector 
 * @param {number} limit 
 * @returns {Promise<object[]>}
 */
export async function queryVector(collection, vector, limit = 5) {
  try {
    const qdrant = getQdrantClient();
    const results = await qdrant.search(collection, {
      vector,
      limit,
      with_payload: true
    });
    return results;
  } catch (error) {
    logError('QDRANT_PROVIDER', `Failed to query vectors from ${collection}`, { error: error.message });
    throw error;
  }
}
