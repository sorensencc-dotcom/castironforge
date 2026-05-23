// file: src/lib/logger.js
// created: 2026-05-03
// updated: 2026-05-03
// version: 1.0.0
// Structured JSON logger. All subsystems must use this — no console.log.

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[process.env.CIC_LOG_LEVEL ?? 'info'] ?? LEVELS.info;

/**
 * Emit a structured JSON log line to stdout (info/debug/warn) or stderr (error).
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} module  - subsystem name, e.g. 'harvester'
 * @param {string} message - human-readable description
 * @param {object} [context] - arbitrary key/value context
 */
export function log(level, module, message, context = {}) {
  if ((LEVELS[level] ?? 0) < MIN_LEVEL) return;

  const entry = JSON.stringify({
    ts:      new Date().toISOString(),
    level,
    module,
    message,
    ...context,
  });

  if (level === 'error') {
    process.stderr.write(entry + '\n');
  } else {
    process.stdout.write(entry + '\n');
  }
}

/**
 * Convenience wrappers.
 */
export const logDebug = (mod, msg, ctx) => log('debug', mod, msg, ctx);
export const logInfo  = (mod, msg, ctx) => log('info',  mod, msg, ctx);
export const logWarn  = (mod, msg, ctx) => log('warn',  mod, msg, ctx);
export const logError = (mod, msg, ctx) => log('error', mod, msg, ctx);
