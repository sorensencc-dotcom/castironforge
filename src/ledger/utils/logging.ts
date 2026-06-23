export interface StructuredLogEntry {
  [key: string]: any;
  timestamp?: string;
}

export function createStructuredLog(entry: StructuredLogEntry): void {
  const logEntry = {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  };

  console.log(JSON.stringify(logEntry));
}

export function logError(message: string, error: Error, context?: any): void {
  createStructuredLog({
    level: 'error',
    message,
    error_type: error.constructor.name,
    error_message: error.message,
    error_stack: error.stack,
    ...context,
  });
}

export function logWarning(message: string, context?: any): void {
  createStructuredLog({
    level: 'warning',
    message,
    ...context,
  });
}

export function logInfo(message: string, context?: any): void {
  createStructuredLog({
    level: 'info',
    message,
    ...context,
  });
}

export function logDebug(message: string, context?: any): void {
  createStructuredLog({
    level: 'debug',
    message,
    ...context,
  });
}
