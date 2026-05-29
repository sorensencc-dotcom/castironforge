// src/providers/qdrant.js
// Deterministic Qdrant client (ESM)

import { createLogger } from '../lib/logger.js';

const log = createLogger('qdrant');

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

if (!QDRANT_URL) {
  throw new Error('QDRANT_URL is not set');
}

export class QdrantConnectionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QdrantConnectionError';
  }
}

export class QdrantSchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QdrantSchemaError';
  }
}

function qdrantHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (QDRANT_API_KEY) {
    headers['api-key'] = QDRANT_API_KEY;
  }
  return headers;
}

async function qdrantFetch(path, options = {}) {
  const url = `${QDRANT_URL.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...qdrantHeaders(),
      ...(options.headers || {}),
    },
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    log.error('Qdrant request failed', { status: res.status, body });
    throw new QdrantConnectionError(
      `Qdrant request failed: ${res.status} ${res.statusText}`,
    );
  }

  return body;
}

export async function healthCheckQdrant() {
  try {
    const body = await qdrantFetch('/health');
    const status = body?.status || 'unknown';
    return { ok: status === 'ok', raw: body };
  } catch (err) {
    log.warn('Qdrant health check failed', { error: String(err) });
    return { ok: false, error: err };
  }
}

export async function createCollectionIfMissing(collection, vectorSize) {
  const path = `/collections/${encodeURIComponent(collection)}`;
  try {
    const existing = await qdrantFetch(path, { method: 'GET' });
    if (existing?.result) {
      return existing;
    }
  } catch {
    // fall through to create
  }

  const body = {
    vectors: {
      size: vectorSize,
      distance: 'Cosine',
    },
  };

  const res = await qdrantFetch(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  if (!res?.result) {
    throw new QdrantSchemaError(
      `Failed to create collection ${collection}: ${JSON.stringify(res)}`,
    );
  }

  return res;
}

export async function insertVector(collection, id, vector, payload = {}) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new QdrantSchemaError('Vector must be a non-empty array');
  }

  const body = {
    points: [
      {
        id,
        vector,
        payload,
      },
    ],
  };

  const res = await qdrantFetch(
    `/collections/${encodeURIComponent(collection)}/points`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  );

  return res;
}

export async function queryVector(collection, vector, limit = 5, filter = null) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new QdrantSchemaError('Vector must be a non-empty array');
  }

  const body = {
    vector,
    limit,
  };

  if (filter) {
    body.filter = filter;
  }

  const res = await qdrantFetch(
    `/collections/${encodeURIComponent(collection)}/points/search`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );

  return res?.result || [];
}
