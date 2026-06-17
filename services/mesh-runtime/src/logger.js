export function log(level, event, data = {}) {
  process.stdout.write(
    JSON.stringify({ ts: new Date().toISOString(), level, event, ...data }) + '\n',
  );
}

export const logger = {
  info: (event, data) => log('info', event, data),
  warn: (event, data) => log('warn', event, data),
  error: (event, data) => log('error', event, data),
};
