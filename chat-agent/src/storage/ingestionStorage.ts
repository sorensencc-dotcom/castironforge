/**
 * Ingestion layer integration with MinIO
 *
 * This module provides utilities for storing ingestion artifacts (raw files, extracted text, screenshots, etc.)
 * in MinIO, giving CIC reproducible, versioned artifact storage.
 */

import { putObject, getObject, CIC_BUCKETS } from './MinioClient';
import { minioMetricsCollector } from './minioMetrics';

export interface IngestionArtifact {
  id: string;
  type: 'raw' | 'extracted' | 'screenshot' | 'html' | 'metadata';
  mimeType: string;
  size: number;
  timestamp: number;
  source?: string;
  metadata?: Record<string, string>;
}

export async function storeIngestionArtifact(
  artifact: IngestionArtifact,
  data: Buffer | string
): Promise<string> {
  const startTime = Date.now();
  const buffer = typeof data === 'string' ? Buffer.from(data) : data;

  // Construct S3-style key: type/timestamp/id
  const key = `${artifact.type}/${new Date(artifact.timestamp).toISOString().split('T')[0]}/${artifact.id}`;

  try {
    const metadata: Record<string, string> = {
      'content-type': artifact.mimeType,
      'original-size': artifact.size.toString(),
      'artifact-type': artifact.type,
      ...(artifact.source && { 'source': artifact.source }),
      ...(artifact.metadata && Object.fromEntries(
        Object.entries(artifact.metadata).map(([k, v]) => [k, v.toString()])
      )),
    };

    await putObject(CIC_BUCKETS.INGESTION, key, buffer, metadata);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordPutOperation(latencyMs, buffer.length);
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.INGESTION);

    console.log(`[Ingestion] Stored ${artifact.type} artifact: ${key} (${buffer.length} bytes)`);
    return key;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function retrieveIngestionArtifact(key: string): Promise<Buffer> {
  const startTime = Date.now();

  try {
    const buffer = await getObject(CIC_BUCKETS.INGESTION, key);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordGetOperation(latencyMs, buffer.length);
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.INGESTION);

    return buffer;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Store raw HTML from a browser capture
 */
export async function storeHTMLCapture(jobId: string, html: string, metadata?: Record<string, string>): Promise<string> {
  return storeIngestionArtifact(
    {
      id: jobId,
      type: 'html',
      mimeType: 'text/html',
      size: Buffer.byteLength(html),
      timestamp: Date.now(),
      metadata,
    },
    html
  );
}

/**
 * Store extracted text from a document
 */
export async function storeExtractedText(
  documentId: string,
  text: string,
  source?: string,
  metadata?: Record<string, string>
): Promise<string> {
  return storeIngestionArtifact(
    {
      id: documentId,
      type: 'extracted',
      mimeType: 'text/plain',
      size: Buffer.byteLength(text),
      timestamp: Date.now(),
      source,
      metadata,
    },
    text
  );
}

/**
 * Store a screenshot or image
 */
export async function storeScreenshot(
  screenshotId: string,
  imageBuffer: Buffer,
  mimeType: string = 'image/png',
  metadata?: Record<string, string>
): Promise<string> {
  return storeIngestionArtifact(
    {
      id: screenshotId,
      type: 'screenshot',
      mimeType,
      size: imageBuffer.length,
      timestamp: Date.now(),
      metadata,
    },
    imageBuffer
  );
}

/**
 * Store raw ingestion file (PDF, DOCX, etc.)
 */
export async function storeRawFile(
  fileId: string,
  fileBuffer: Buffer,
  mimeType: string,
  metadata?: Record<string, string>
): Promise<string> {
  return storeIngestionArtifact(
    {
      id: fileId,
      type: 'raw',
      mimeType,
      size: fileBuffer.length,
      timestamp: Date.now(),
      metadata,
    },
    fileBuffer
  );
}
