# CIC Memory Spine — Confidence Calibration

## 1. Purpose

Ensure `confidence` emitted by MemoryQuery matches empirical correctness:
- A 0.8 score should mean ≈80% of answers are correct.
- Used for:
  - Agent fallback decisions.
  - UI trust indicators.
  - Monitoring drift.

## 2. Calibration dataset

- Use held-out test set from `memory-dataset-vN`.
- For each example:
  - Run MemoryQuery with `memory-vN`.
  - Record:
    - `predicted_answer`
    - `confidence`
    - `is_correct` (exact/semantic match).

## 3. Binning and curves

1. Bin predictions by confidence:
   - `[0.0–0.1)`, `[0.1–0.2)`, …, `[0.9–1.0]`.

2. For each bin:
   - Compute empirical accuracy: `accuracy = correct / total`.

3. Plot:
   - x-axis: predicted confidence.
   - y-axis: empirical accuracy.
   - Ideal line: `y = x`.

4. Store results in `calibration.json`:

```json
{
  "bins": [
    { "lower": 0.0, "upper": 0.1, "accuracy": 0.12 },
    { "lower": 0.1, "upper": 0.2, "accuracy": 0.19 }
  ]
}
```

## 4. Runtime usage

When MemoryQuery returns `confidence = c`:
- Map `c` to nearest bin.
- Use calibrated accuracy for:
  - Deciding whether to trust the answer.
  - Triggering fallback (TorqueQuery / RAG) if below threshold.

Example:
- Raw confidence: `0.65`.
- Calibrated accuracy for bin `[0.6–0.7)`: `0.52`.
- Agent policy: if calibrated < `0.6` → call fallback tool.

## 5. Monitoring

- Recompute calibration curves for each `memory-vN`.
- Track drift over time as corpus and usage evolve.
- Use curves to adjust agent thresholds without changing model weights.
