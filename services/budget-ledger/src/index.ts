// Schema and types
export * from './schema/types';

// Database client
export { initializeDb, query, transaction, closeDb, getPool } from './db/client';
export type { DbConfig } from './db/client';

// Write path
export { writeLedgerEntry } from './write/writeLedgerEntry';

// Read path
export {
  readLatestEntry,
  readRollingWindow,
  readCumulative,
  readByQuery,
} from './read/readLedgerEntry';

// Governance
export { onGovernanceEvent, offGovernanceEvent, emitGovernanceEvent } from './governance/governanceEvents';

// Metrics
export {
  recordWriteMetric,
  recordReadMetric,
  recordGovernanceEvent,
  recordDrift,
  getMetrics,
  resetMetrics,
  getPrometheusMetrics,
} from './metrics/ledgerMetrics';

// Logging
export {
  createStructuredLog,
  logError,
  logWarning,
  logInfo,
  logDebug,
} from './utils/logging';
export type { StructuredLogEntry } from './utils/logging';
