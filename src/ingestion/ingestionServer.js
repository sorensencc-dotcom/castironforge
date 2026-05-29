// filename: ingestionServer.js
// date: 2026-05-22
// version: 2.0.0
// Ingestion Server — uses busboy for secure multipart parsing.

import http from 'node:http';
import busboy from 'busboy';
import { ingest } from './ingestionAgent.js';
import { log, logError } from '../lib/logger.js';
import { healthCheckQdrant } from '../providers/qdrant.js';

const AGENT_ID = process.env.INGESTION_AGENT_ID;
const MODULE = 'ingestion-server';

/**
 * Starts the ingestion server.
 * @param {number} port 
 */
export function startServer(port) {
  const server = http.createServer(async (req, res) => {
    const start = Date.now();
    const url = new URL(req.url, `http://${req.headers.host}`);

    log('info', MODULE, 'Request received', { method: req.method, path: url.pathname });

    if (url.pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        agentId: AGENT_ID,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }));
      return;
    }

    if (url.pathname === '/health/qdrant' && req.method === 'GET') {
      try {
        const result = await healthCheckQdrant();
        if (!result.ok) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'degraded',
            error: result.error ? String(result.error) : 'unknown',
          }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', raw: result.raw }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'error',
          error: String(err),
        }));
      }
      return;
    }

    if (url.pathname === '/ingest' && req.method === 'POST') {
      try {
        const contentType = req.headers['content-type'] || '';
        let rawInput;

        if (contentType.includes('application/json')) {
          const body = await readBody(req);
          rawInput = JSON.parse(body);
        } else if (contentType.includes('multipart/form-data')) {
          rawInput = await parseMultipartWithBusboy(req);
        } else {
          res.writeHead(415, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unsupported Content-Type' }));
          return;
        }

        const result = await ingest(rawInput);
        
        const statusCode = result.status === 'ok' ? 200 : 
                           result.status === 'unsupported' ? 415 : 400;
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        
        log('info', MODULE, 'Response sent', { 
          method: req.method, 
          path: url.pathname, 
          status: statusCode, 
          durationMs: Date.now() - start 
        });
      } catch (err) {
        logError(MODULE, 'Server error', { error: err.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', detail: err.message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.listen(port, () => {
    log('info', MODULE, 'Server started', { port });
  });

  return server;
}

/**
 * Reads the request body as a string (for JSON).
 */
async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Parses multipart/form-data using busboy.
 * Provides protection against oversized fields and files.
 */
async function parseMultipartWithBusboy(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ 
      headers: req.headers,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        fields: 10,
        files: 1
      }
    });

    const result = { sourceMeta: {} };

    bb.on('file', (name, file, info) => {
      const { filename, encoding, mimeType } = info;
      const chunks = [];
      
      file.on('data', (data) => {
        chunks.push(data);
      }).on('close', () => {
        if (name === 'payload') {
          result.payload = Buffer.concat(chunks);
          result.mimeType = mimeType;
        }
      });
    });

    bb.on('field', (name, val) => {
      if (name === 'sourceMeta') {
        try {
          result.sourceMeta = JSON.parse(val);
        } catch (e) {
          reject(new Error('Invalid sourceMeta JSON'));
        }
      } else {
        result[name] = val;
      }
    });

    bb.on('finish', () => {
      if (!result.payload) {
        reject(new Error('Missing payload in multipart request'));
      } else {
        resolve(result);
      }
    });

    bb.on('error', reject);

    req.pipe(bb);
  });
}
