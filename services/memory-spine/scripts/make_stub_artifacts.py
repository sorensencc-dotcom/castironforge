#!/usr/bin/env python3
"""
Generate stub model artifacts for testing the Memory Spine ops pipeline
(calibration, activation, rollback) without running full training.

Creates the expected file structure in models/memory-v1/ with placeholder
weights so the pipeline can be validated end-to-end on CPU.

Usage:
    python scripts/make_stub_artifacts.py
"""
import json
import os
import struct
from pathlib import Path

SERVICE_DIR = Path(__file__).parent.parent
OUTPUT_DIR = SERVICE_DIR / "models" / "memory-v1"


def make_stub_artifacts(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "checkpoints").mkdir(exist_ok=True)

    # LoRA adapter config
    adapter_config = {
        "base_model_name_or_path": "microsoft/Phi-3.5-mini-instruct",
        "bias": "none",
        "fan_in_fan_out": False,
        "inference_mode": True,
        "init_lora_weights": True,
        "lora_alpha": 32,
        "lora_dropout": 0.05,
        "modules_to_save": None,
        "peft_type": "LORA",
        "r": 16,
        "target_modules": ["q_proj", "v_proj"],
        "task_type": "CAUSAL_LM",
    }
    with open(output_dir / "adapter_config.json", "w") as f:
        json.dump(adapter_config, f, indent=2)

    # Minimal safetensors stub (8-byte header = empty tensor dict)
    # Format: 8-byte LE uint64 header length + JSON header
    header = json.dumps({"__metadata__": {"format": "pt"}}).encode("utf-8")
    header_len = struct.pack("<Q", len(header))
    with open(output_dir / "adapter_model.safetensors", "wb") as f:
        f.write(header_len + header)

    # Training provenance
    provenance = {
        "stub": True,
        "note": "Stub artifacts for ops pipeline testing. Replace with real training output.",
        "base_model": "microsoft/Phi-3.5-mini-instruct",
        "dataset_examples": 212,
        "train_examples": 190,
        "eval_examples": 22,
        "config": json.loads((SERVICE_DIR / "train-config.json").read_text(encoding="utf-8")),
    }
    with open(output_dir / "training_provenance.json", "w") as f:
        json.dump(provenance, f, indent=2)

    # Minimal tokenizer config
    tokenizer_dir = output_dir / "tokenizer"
    tokenizer_dir.mkdir(exist_ok=True)
    with open(tokenizer_dir / "tokenizer_config.json", "w") as f:
        json.dump({"model_type": "phi3", "stub": True}, f, indent=2)

    # Training args summary
    with open(output_dir / "training_args.json", "w") as f:
        json.dump({
            "stub": True,
            "num_train_epochs": 3,
            "learning_rate": 2e-4,
            "per_device_train_batch_size": 4,
        }, f, indent=2)

    print(f"[stub] Created artifacts in {output_dir}")
    for p in sorted(output_dir.rglob("*")):
        if p.is_file():
            print(f"  {p.relative_to(output_dir)}")


if __name__ == "__main__":
    make_stub_artifacts(OUTPUT_DIR)
    print("\nNext: npm run calibrate-confidence")
    print("Then: activate memory-v1 via POST /v1/memory/admin/activate")
