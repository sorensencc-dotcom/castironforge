# CIC Memory Spine — Memory-v2 Evolution Plan

## 1. Goals

`memory-v2` targets the gaps observed in `memory-v1` production usage:

- Stronger multi-hop reasoning across CIC subsystems.
- Expanded domain coverage (roadmap, ingestion services, project-brain, incident reports).
- Tighter provenance: every answer traces to a specific doc + chunk.
- Reduced hallucination on questions at domain boundaries.

---

## 2. Inputs

### Production signal from memory-v1

Collect 4–8 weeks of production logs:

| Signal | Source | Use |
|--------|--------|-----|
| Low-confidence queries (`confidence < 0.6`) | Memory Spine logs | Hard negatives + supervision targets |
| Agent fallbacks (TorqueQuery triggered) | Orchestrator logs | Queries memory-v1 couldn't answer |
| Human overrides / corrections | CIC operator edits | Gold-label answer pairs |
| Provenance mismatch reports | Agent audit trail | Provenance training signal |

### New corpus

- Updated ADRs and architecture decisions.
- New CIC subsystems added since memory-v1 corpus freeze.
- Roadmap documents (scoped: confirmed features only).
- Post-incident reports and runbooks.

---

## 3. Dataset v2 construction

Starting from `memory-dataset-v1.json`:

1. **Append new domains** via `generate-dataset-hybrid.ts` on expanded corpus.

2. **Add hard negatives**: pairs where the question is similar to a v1 question but the correct answer differs (e.g., query about `memory-v1` vs `memory-v2` activation).

3. **Add multi-hop chains**: 2–3 hop questions derived from real agent incidents. Each hop must reference a different `doc_id`.

4. **Supervision labels**: replace low-quality draft answers with corrected answers from operator logs.

Build target: `datasets/memory-dataset-v2.json`

---

## 4. Objective adjustments

Update `train-config-v2.json`:

```json
{
  "model_name": "memory-llama-v2",
  "base_model": "memory-v1",
  "parameter_efficiency": "lora",
  "train_data_path": "datasets/memory-dataset-v2.json",
  "output_dir": "models/memory-v2",
  "loss": "cross_entropy",
  "aux_heads": {
    "confidence": true,
    "provenance_pointer": true,
    "multi_hop_chain": true
  },
  "multi_hop_loss_weight": 0.3,
  "provenance_loss_weight": 0.2
}
```

Key changes vs v1:
- Base on `memory-v1` weights (warm start) rather than `llama-3-8b-instruct`.
- Add `multi_hop_chain` aux head.
- Explicit loss weights for multi-hop and provenance objectives.

---

## 5. Evaluation vs v1

Run the standard eval suite (`eval_metrics` in train config) plus:

| Metric | Target vs v1 |
|--------|--------------|
| QA accuracy | +5 pp |
| Multi-hop accuracy | +10 pp |
| Confidence Brier score | ≤ v1 score |
| P99 latency | ≤ v1 latency |
| Provenance precision | ≥ 0.90 |

Calibrate v2 separately: `npm run calibrate-confidence -- datasets/memory-dataset-test-v2.json models/memory-v2/calibration.json`

---

## 6. Activation

Follow `ACTIVATION_PLAN.md` with `target_version: "memory-v2"`.

Keep `memory-v1` as rollback target for ≥2 weeks post-activation.

---

## 7. Iteration cadence

Treat memory versions like software releases:

```
memory-v1  →  memory-v2  →  memory-v3  …
```

Trigger a new version when any of:
- Corpus grows by ≥20% (new subsystems, major docs update).
- Production fallback rate exceeds 15% over a 7-day window.
- A major CIC architecture change invalidates ≥10% of v1 training data.
- Scheduled quarterly re-train.
