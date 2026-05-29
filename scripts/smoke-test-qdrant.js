// File: scripts/smoke-test-qdrant.js | Date: 2026-05-28
// §0.1-A — Qdrant Smoke Test

import { getQdrantClient, healthCheckQdrant, insertVector, queryVector } from '../src/providers/qdrant.js';
import { log, logError } from '../src/lib/logger.js';

async function runSmokeTest() {
  const collection = 'cic_test_vectors';
  const MODULE = 'SMOKE_TEST_QDRANT';

  try {
    log('INFO', MODULE, 'Starting Qdrant smoke test...');

    const isHealthy = await healthCheckQdrant();
    if (!isHealthy) {
      throw new Error('Qdrant health check failed.');
    }

    const qdrant = getQdrantClient();

    // 1. Create temporary collection
    log('INFO', MODULE, `Creating temporary collection: ${collection}`);
    await qdrant.createCollection(collection, {
      vectors: { size: 3, distance: 'Cosine' }
    });

    // 2. Insert test vector
    log('INFO', MODULE, 'Inserting test vector...');
    await insertVector(collection, 1, [0.1, 0.2, 0.3], { test: true });

    // 3. Query vector
    log('INFO', MODULE, 'Querying test vector...');
    const results = await queryVector(collection, [0.1, 0.2, 0.3], 1);
    if (results.length === 0 || results[0].id !== 1) {
      throw new Error('Query results mismatch.');
    }

    // 4. Delete collection
    log('INFO', MODULE, `Deleting temporary collection: ${collection}`);
    await qdrant.deleteCollection(collection);

    log('INFO', MODULE, '§0.1-A Qdrant smoke test COMPLETE.');
    process.exit(0);
  } catch (error) {
    logError(MODULE, 'Smoke test failed.', { error: error.message });
    process.exit(1);
  }
}

runSmokeTest();
