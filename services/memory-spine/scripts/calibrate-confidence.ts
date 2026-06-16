/**
 * CIC Memory Spine — Confidence Calibration Harness
 *
 * Runs a held-out test set against a live Memory Spine instance, bins
 * predictions by confidence, and writes calibration.json.
 *
 * Usage:
 *   node --loader ts-node/esm scripts/calibrate-confidence.ts [test-file] [out-file]
 *
 * Defaults:
 *   test-file : datasets/memory-dataset-test.json
 *   out-file  : models/memory-v1/calibration.json
 *
 * Env:
 *   MEMORY_SPINE_URL  default http://localhost:3100
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { queryMemory } from '../src/client/memory-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

type CalibrationBin = {
  lower: number;
  upper: number;
  total: number;
  correct: number;
  accuracy: number;
};

type TestExample = {
  question_text: string;
  answer_text: string;
  domain?: string;
};

function exactMatch(predicted: string, expected: string): boolean {
  return predicted.trim().toLowerCase() === expected.trim().toLowerCase();
}

function semanticMatch(predicted: string, expected: string): boolean {
  // Lightweight overlap heuristic: ≥40% token overlap counts as correct.
  // Replace with embedding-based match for production calibration.
  const a = new Set(predicted.toLowerCase().split(/\s+/));
  const b = new Set(expected.toLowerCase().split(/\s+/));
  const intersection = [...a].filter(t => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 && intersection / union >= 0.4;
}

async function runCalibration(testFile: string, outFile: string): Promise<void> {
  if (!existsSync(testFile)) {
    console.error(`Test file not found: ${testFile}`);
    process.exit(1);
  }

  const { examples } = JSON.parse(readFileSync(testFile, 'utf-8')) as { examples: TestExample[] };
  console.log(`Loaded ${examples.length} test examples from ${testFile}`);

  const bins: CalibrationBin[] = Array.from({ length: 10 }, (_, i) => ({
    lower: i / 10,
    upper: (i + 1) / 10,
    total: 0,
    correct: 0,
    accuracy: 0,
  }));

  let processed = 0;
  let errors = 0;

  for (const ex of examples) {
    let resp: Awaited<ReturnType<typeof queryMemory>>;
    try {
      resp = await queryMemory(ex.question_text, { domain: ex.domain });
    } catch (err) {
      console.error(`  [err] ${(err as Error).message}`);
      errors++;
      continue;
    }

    const c = resp.confidence ?? 0;
    const binIdx = Math.min(9, Math.floor(c * 10));
    const bin = bins[binIdx];
    bin.total++;

    const isCorrect =
      exactMatch(resp.answer_text, ex.answer_text) ||
      semanticMatch(resp.answer_text, ex.answer_text);
    if (isCorrect) bin.correct++;

    processed++;
    if (processed % 50 === 0) process.stdout.write(`  processed ${processed}/${examples.length}\n`);
  }

  for (const bin of bins) {
    bin.accuracy = bin.total > 0 ? bin.correct / bin.total : 0;
  }

  const calibration = {
    generated_at: new Date().toISOString(),
    total_examples: examples.length,
    processed,
    errors,
    bins: bins.map(({ lower, upper, accuracy, total, correct }) => ({
      lower,
      upper,
      accuracy: parseFloat(accuracy.toFixed(4)),
      total,
      correct,
    })),
  };

  const outDir = dirname(outFile);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(outFile, JSON.stringify(calibration, null, 2), 'utf-8');
  console.log(`\nWrote calibration → ${outFile}`);
  console.log(`Processed: ${processed}/${examples.length}  Errors: ${errors}`);
  console.log('\nBin summary (confidence → empirical accuracy):');
  for (const b of calibration.bins) {
    if (b.total === 0) continue;
    const bar = '█'.repeat(Math.round(b.accuracy * 20)).padEnd(20, '░');
    console.log(`  [${b.lower.toFixed(1)}–${b.upper.toFixed(1)}) ${bar} ${(b.accuracy * 100).toFixed(1)}% (n=${b.total})`);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const testFile = process.argv[2] ?? `${__dirname}/../datasets/memory-dataset-test.json`;
  const outFile  = process.argv[3] ?? `${__dirname}/../models/memory-v1/calibration.json`;
  runCalibration(testFile, outFile).catch(err => { console.error('Fatal:', err); process.exit(1); });
}
