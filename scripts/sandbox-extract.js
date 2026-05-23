// file: scripts/sandbox-extract.js
// date: 2026-05-23
// Wrapper to run extraction logic inside a Docker sandbox.
// Expects input file at /data/input and writes output to stdout as JSON.

import { extract } from '../src/harvester/extractor.js';
import { basename } from 'node:path';

const filePath = process.argv[2] || '/data/input';
const category = process.argv[3] || 'documents';

try {
  const result = extract(filePath, category);
  console.log(JSON.stringify(result));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
