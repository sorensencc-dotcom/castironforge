import { Pool, QueryResult, PoolClient } from 'pg';

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
}

let pool: Pool | null = null;

export function initializeDb(config: DbConfig): void {
  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.max || 20,
  });

  pool.on('error', (err) => {
    console.error('Unexpected pool error:', err);
  });
}

export async function query<T = any>(text: string, values?: any[]): Promise<QueryResult<T>> {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDb() first.');
  }
  return pool.query<T>(text, values);
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDb() first.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDb() first.');
  }
  return pool;
}
