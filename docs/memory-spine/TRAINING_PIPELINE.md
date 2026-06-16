# CIC Memory Spine — Training Pipeline

## 1. Goals

- Train a small (1–3B) parametric memory model on CIC corpus.
- Provide fixed-cost retrieval independent of corpus size.
- Enable versioned, hot-swappable memory (`memory-vN`) with rollback.
- Preserve provenance and confidence for every answer.

## 2. Data sources

- `cic/adr/` — Architecture Decision Records.
- `cic/docs/` — subsystem and architecture docs.
- `cic/build/` — self-healing build system specs.
- `cic/routing/` — model routing and budget-aware logic.
- `cic/roadmap/` — roadmap and planning docs.
- `cic/logs/agent/` — agent conversations and Q&A.

## 3. Dataset construction

1. **Ingest documents**
   - Normalize to UTF-8 text.
   - Attach metadata: `doc_id`, `path`, `domain`, `timestamp`.

2. **Chunking**
   - Split into semantic chunks (sections, functions, ADR entries).
   - Target size: 256–1024 tokens per chunk.
   - Store `chunk_id`, `doc_id`, `offset`, `domain`.

3. **Q&A generation**
   - For each chunk:
     - Generate 3–10 synthetic questions (titles, headings, summaries).
     - Extract human-authored questions from CIC logs where available.
   - Label each pair with:
     - `question_text`
     - `answer_text` (chunk summary or direct span)
     - `doc_id`, `chunk_id`, `domain`, `timestamp`.

4. **Multi-hop examples**
   - Build questions that require 2–3 related chunks (e.g., build + routing).
   - Compose answers that reference multiple docs.
   - Store `related_doc_ids` and `related_chunk_ids`.

5. **Train / val / test splits**
   - Split by `doc_id` to avoid leakage:
     - Train: 70%
     - Val: 15%
     - Test: 15%
   - Maintain domain balance across splits.

## 4. Model objective

- Conditional generation:
  - Input: `question_text` + metadata features.
  - Output: `answer_text`.
- Loss: standard cross-entropy over answer tokens.
- Auxiliary heads:
  - Confidence score (0–1).
  - Provenance pointer distribution over `doc_id` / `chunk_id`.

## 5. Training procedure

1. Tokenize questions and answers with target model tokenizer.
2. Encode metadata as special tokens or side-channel features.
3. Train for N epochs with early stopping on validation loss.
4. Save:
   - Model weights.
   - Tokenizer.
   - Confidence calibration data.
   - Provenance mapping rules.

## 6. Versioning

- Each trained model is a `memory-vN` artifact:
  - `model/weights.bin`
  - `model/tokenizer/`
  - `config.json`
  - `calibration.json`
  - `provenance_schema.json`
- Store under `models/memory-vN/`.
- Activation and rollback managed via `MemoryAdmin`.

## 7. Evaluation

- Per-domain accuracy on held-out Q&A.
- Multi-hop question performance.
- Confidence calibration (reliability curves).
- Latency and throughput under CIC load.

## 8. Deployment

- Export model as a service:
  - `POST /v1/memory/query` → uses `memory-vN`.
- Wire into CIC Memory Spine:
  - Router selects active `memory-vN`.
  - Fallback to keyword scorer if model unavailable.
