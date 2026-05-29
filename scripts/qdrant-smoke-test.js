// scripts/qdrant-smoke-test.js
// Node 20+ ESM: run with `node scripts/qdrant-smoke-test.js`

import { createCollectionIfMissing, insertVector, queryVector } from '../src/providers/qdrant.js';
import { createLogger } from '../src/lib/logger.js';

const log = createLogger('qdrant-smoke');

const COLLECTION = 'cic_test_vectors';
const TEST_ID = 'smoke-test-1';
const TEST_VECTOR = [0.1, 0.2, 0.3];

async function main() {
  try {
    log.info('Starting Qdrant smoke test');

    await createCollectionIfMissing(COLLECTION, TEST_VECTOR.length);
    log.info('Collection ready', { collection: COLLECTION });

    await insertVector(COLLECTION, TEST_ID, TEST_VECTOR, { type: 'smoke' });
    log.info('Inserted test vector', { id: TEST_ID });

    const results = await queryVector(COLLECTION, TEST_VECTOR, 1);
    log.info('Query results', { count: results.length });

    const match = results[0];
    if (!match || String(match.id) !== TEST_ID) {
      throw new Error('Smoke test failed: inserted point not returned as nearest neighbor');
    }

    log.info('Qdrant smoke test PASSED');
    process.exit(0);
  } catch (err) {
    log.error('Qdrant smoke test FAILED', { error: String(err) });
    process.exit(1);
  }
}

main();
