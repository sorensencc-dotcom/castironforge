import { Client } from 'minio';
import { getEnv } from '../runtimes/config';

let minioClient: Client | null = null;

export function initializeMinIO(): Client {
  const endpoint = getEnv('MINIO_ENDPOINT', 'localhost');
  const port = parseInt(getEnv('MINIO_PORT', '9000'), 10);
  const accessKey = getEnv('MINIO_ACCESS_KEY', 'cic');
  const secretKey = getEnv('MINIO_SECRET_KEY', 'cic-secret');
  const useSSL = getEnv('MINIO_USE_SSL', 'false') === 'true';

  minioClient = new Client({
    endPoint: endpoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });

  return minioClient;
}

export function getMinIO(): Client {
  if (!minioClient) {
    throw new Error('MinIO client not initialized. Call initializeMinIO() first.');
  }
  return minioClient;
}

export async function putObject(
  bucket: string,
  key: string,
  data: Buffer | string,
  metadata?: Record<string, string>
): Promise<void> {
  const client = getMinIO();
  const buffer = typeof data === 'string' ? Buffer.from(data) : data;

  try {
    await client.putObject(bucket, key, buffer, buffer.length, metadata);
  } catch (error) {
    throw new Error(`Failed to put object ${key} in bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getObject(bucket: string, key: string): Promise<Buffer> {
  const client = getMinIO();

  try {
    const stream = await client.getObject(bucket, key);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Failed to get object ${key} from bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  const client = getMinIO();

  try {
    await client.removeObject(bucket, key);
  } catch (error) {
    throw new Error(`Failed to delete object ${key} from bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function ensureBucket(bucket: string): Promise<void> {
  const client = getMinIO();

  try {
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket, 'us-east-1');
      console.log(`[MinIO] Created bucket: ${bucket}`);
    } else {
      console.log(`[MinIO] Bucket already exists: ${bucket}`);
    }
  } catch (error) {
    throw new Error(`Failed to ensure bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function ensureAllBuckets(): Promise<void> {
  const buckets = [
    'cic-ingestion',
    'cic-world-corpus',
    'cic-agent-artifacts',
    'cic-memory',
    'cic-torquequery-raw',
    'cic-logs',
  ];

  for (const bucket of buckets) {
    await ensureBucket(bucket);
  }

  console.log('[MinIO] All buckets initialized');
}

export async function testMinIOHealth(): Promise<boolean> {
  const client = getMinIO();

  try {
    // Test write
    const testBucket = 'cic-ingestion';
    const testKey = '.health-check';
    const testData = Buffer.from(JSON.stringify({ timestamp: new Date().toISOString() }));

    await client.putObject(testBucket, testKey, testData, testData.length);

    // Test read
    const stream = await client.getObject(testBucket, testKey);
    await new Promise((resolve, reject) => {
      stream.on('data', () => {});
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    // Clean up
    await client.removeObject(testBucket, testKey);

    return true;
  } catch (error) {
    console.error('[MinIO] Health check failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

export const CIC_BUCKETS = {
  INGESTION: 'cic-ingestion',
  WORLD_CORPUS: 'cic-world-corpus',
  AGENT_ARTIFACTS: 'cic-agent-artifacts',
  MEMORY: 'cic-memory',
  TORQUEQUERY_RAW: 'cic-torquequery-raw',
  LOGS: 'cic-logs',
} as const;
