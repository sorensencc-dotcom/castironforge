import * as Minio from 'minio';
import { getEnv } from '../runtimes/config';

const MINIO_HOST = getEnv('MINIO_HOST', 'localhost');
const MINIO_PORT = parseInt(getEnv('MINIO_PORT', '9000'), 10);
const MINIO_ACCESS_KEY = getEnv('MINIO_ACCESS_KEY', 'minioadmin');
const MINIO_SECRET_KEY = getEnv('MINIO_SECRET_KEY', 'minioadmin');
const MINIO_USE_SSL = getEnv('MINIO_USE_SSL', 'false') === 'true';

export const minioClient = new Minio.Client({
  endPoint: MINIO_HOST,
  port: MINIO_PORT,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
  useSSL: MINIO_USE_SSL
});

export async function putObject(
  bucket: string,
  objectName: string,
  buffer: Buffer,
  metadata?: Record<string, string>
): Promise<void> {
  try {
    await minioClient.putObject(bucket, objectName, buffer, buffer.length, {
      'Content-Type': metadata?.['Content-Type'] ?? 'application/octet-stream',
      ...(metadata ?? {})
    });
  } catch (error) {
    throw new Error(
      `MinIO put failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getObject(
  bucket: string,
  objectName: string
): Promise<Buffer> {
  try {
    const chunks: Buffer[] = [];
    const stream = await minioClient.getObject(bucket, objectName);

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  } catch (error) {
    throw new Error(
      `MinIO get failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function ensureBucket(bucket: string): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket, 'us-east-1');
    }
  } catch (error) {
    throw new Error(
      `MinIO bucket creation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
