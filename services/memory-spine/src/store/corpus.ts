import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dateTimeService } from '../lib/datetime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.MEMORY_SPINE_DATA_DIR ?? join(__dirname, '../../data');
const CORPUS_DIR = join(DATA_DIR, 'corpus');

export interface CorpusDoc {
  doc_id: string;
  title: string;
  content: string;
  domain: string;
  tags: string[];
  chunks: Array<{ chunk_id: string; text: string }>;
  provenance_history: Array<{ version: string; timestamp: string }>;
  last_edited: string;
}

function ensureCorpusDir(): void {
  if (!existsSync(CORPUS_DIR)) mkdirSync(CORPUS_DIR, { recursive: true });
}

function docPath(doc_id: string): string {
  return join(CORPUS_DIR, `${doc_id}.json`);
}

export function getDoc(doc_id: string): CorpusDoc | null {
  const p = docPath(doc_id);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8')) as CorpusDoc;
}

export function upsertDoc(doc_id: string, fields: Partial<CorpusDoc>, version: string): CorpusDoc {
  ensureCorpusDir();
  const existing = getDoc(doc_id);
  const now = dateTimeService.nowISO();
  const doc: CorpusDoc = {
    doc_id,
    title: fields.title ?? existing?.title ?? '',
    content: fields.content ?? existing?.content ?? '',
    domain: fields.domain ?? existing?.domain ?? 'cic-core',
    tags: fields.tags ?? existing?.tags ?? [],
    chunks: existing?.chunks ?? [{ chunk_id: 'c0', text: fields.content ?? '' }],
    provenance_history: [
      ...(existing?.provenance_history ?? []),
      { version, timestamp: now },
    ],
    last_edited: now,
  };
  writeFileSync(docPath(doc_id), JSON.stringify(doc, null, 2));
  return doc;
}

export function deleteDoc(doc_id: string): boolean {
  const p = docPath(doc_id);
  if (!existsSync(p)) return false;
  unlinkSync(p);
  return true;
}

export function countDocs(): number {
  ensureCorpusDir();
  return readdirSync(CORPUS_DIR).filter(f => f.endsWith('.json')).length;
}

export function listDocs(): CorpusDoc[] {
  ensureCorpusDir();
  return readdirSync(CORPUS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(CORPUS_DIR, f), 'utf-8')) as CorpusDoc);
}

export function getLastEditTime(): string | null {
  ensureCorpusDir();
  const files = readdirSync(CORPUS_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) return null;
  return files
    .map(f => statSync(join(CORPUS_DIR, f)).mtime)
    .sort((a, b) => b.getTime() - a.getTime())[0]
    .toISOString();
}
