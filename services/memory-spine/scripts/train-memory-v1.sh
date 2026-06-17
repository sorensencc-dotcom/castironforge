#!/usr/bin/env bash
# train-memory-v1.sh — works on both Linux and Git Bash for Windows
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"

DATASET="${1:-${SERVICE_DIR}/datasets/memory-dataset-v1.json}"
CONFIG="${SERVICE_DIR}/train-config.json"
OUTDIR="${SERVICE_DIR}/models/memory-v1"
CHECKPOINT_DIR="${OUTDIR}/checkpoints"

if [ ! -f "$DATASET" ]; then
  echo "[error] Dataset not found: $DATASET"
  echo "  Run: npm run generate-dataset-hybrid"
  exit 1
fi

echo "[memory-v1] Validating dataset and config..."
python3 "$SCRIPT_DIR/train.py" \
  --config "$CONFIG" \
  --dataset "$DATASET" \
  --output_dir "$OUTDIR" \
  --checkpoint_dir "$CHECKPOINT_DIR" \
  --dry_run

echo ""
echo "[memory-v1] Starting training..."
python3 "$SCRIPT_DIR/train.py" \
  --config "$CONFIG" \
  --dataset "$DATASET" \
  --output_dir "$OUTDIR" \
  --checkpoint_dir "$CHECKPOINT_DIR"

echo ""
echo "Next steps:"
echo "  1. npm run calibrate-confidence"
echo "  2. POST /v1/memory/admin/activate {\"target_version\":\"memory-v1\"}"
echo "  See docs/memory-spine/ACTIVATION_PLAN.md"
