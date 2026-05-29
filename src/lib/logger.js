// File: src/lib/logger.js | Date: 2026-05-27 | v1.1.1

export function emitLog(agent, data) {
  return [{
    timestamp: new Date().toISOString(),
    agent: agent.name,
    version: agent.version,
    region: agent.region,
    ...data
  }];
}

/**
 * Standard structured logger.
 */
export function log(level, module, message, extra = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    module,
    message,
    ...extra
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

/**
 * Log error with structured format.
 */
export function logError(module, message, extra = {}) {
  log('ERROR', module, message, extra);
}

/**
 * Factory for creating modular loggers.
 */
export function createLogger(module) {
  return {
    info:  (message, extra) => log('INFO',  module, message, extra),
    warn:  (message, extra) => log('WARN',  module, message, extra),
    error: (message, extra) => log('ERROR', module, message, extra),
  };
}
