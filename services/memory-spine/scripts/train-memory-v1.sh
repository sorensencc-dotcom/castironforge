#!/usr/bin/env bash
# Train memory-v1 using the LoRA config in train-config.json.
# Requires a Python training environment with cic_memory installed.
# See docs/memory-spine/TRAINING_PIPELINE.md for full setup instructions.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"

DATASET="${1:-${SERVICE_DIR}/datasets/memory-dataset-v1.json}"
CONFIG="${SERVICE_DIR}/train-config.json"
OUTDIR="${SERVICE_DIR}/models/memory-v1"
CHECKPOINT_DIR="${OUTDIR}/checkpoints"

if [[ ! -f "$DATASET" ]]; then
  echo "[error] Dataset not found: $DATASET"
  echo "  Run: npm run generate-dataset  (or generate-dataset-hybrid)"
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "[error] Train config not found: $CONFIG"
  exit 1
fi

mkdir -p "$OUTDIR" "$CHECKPOINT_DIR"

echo "[memory-v1] Starting training..."
echo "  dataset   : $DATASET"
echo "  config    : $CONFIG"
echo "  output    : $OUTDIR"

python -m cic_memory.train \
  --config "$CONFIG" \
  --dataset "$DATASET" \
  --output_dir "$OUTDIR" \
  --checkpoint_dir "$CHECKPOINT_DIR"

echo "[memory-v1] Training complete. Artifacts in $OUTDIR"
echo ""
echo "Next steps:"
echo "  1. Run calibration:  npm run calibrate-confidence"
echo "  2. Activate (staging first): POST /v1/memory/admin/activate {\"target_version\":\"memory-v1\"}"
echo "  See docs/memory-spine/ACTIVATION_PLAN.md for the full checklist."
