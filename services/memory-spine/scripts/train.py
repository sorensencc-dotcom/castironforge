"""
Memory-v1 training script.

Reads train-config.json, fine-tunes a base LLM with LoRA via HuggingFace
transformers + trl + peft, and writes model artifacts to models/memory-v1/.

Flags:
  --dry_run   Validate dataset and config only; do not load model or train.
  --dataset   Override dataset path from config.
  --config    Override config file path (default: train-config.json).
  --output    Override output directory from config.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train memory-v1 with LoRA")
    p.add_argument("--dry_run", action="store_true", help="Validate only; skip training")
    p.add_argument("--config", default="train-config.json", help="Path to train-config.json")
    p.add_argument("--dataset", default=None, help="Override dataset path")
    p.add_argument("--output", default=None, help="Override output directory")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Config and dataset validation
# ---------------------------------------------------------------------------

BASE_MODEL_MAP = {
    "llama-3-8b-instruct": "meta-llama/Meta-Llama-3-8B-Instruct",
}

REQUIRED_CONFIG_KEYS = [
    "base_model", "parameter_efficiency", "train_data_path",
    "output_dir", "max_seq_length", "batch_size", "learning_rate",
    "num_epochs",
]

def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        _fatal(f"Config not found: {config_path}")
    with config_path.open() as f:
        cfg = json.load(f)
    missing = [k for k in REQUIRED_CONFIG_KEYS if k not in cfg]
    if missing:
        _fatal(f"Config missing required keys: {missing}")
    return cfg


def resolve_base_model(cfg: dict) -> str:
    name = cfg["base_model"]
    resolved = BASE_MODEL_MAP.get(name, name)
    _log(f"Base model: {name!r} → {resolved!r}")
    return resolved


def validate_dataset(dataset_path: Path) -> list[dict]:
    if not dataset_path.exists():
        _fatal(
            f"Dataset not found: {dataset_path}\n"
            "  Run: npm run generate-dataset  (or generate-dataset-hybrid)"
        )
    with dataset_path.open() as f:
        raw = json.load(f)

    # Both generator scripts wrap examples: { "examples": [...], "meta": {...} }
    # Accept that wrapper or a plain array.
    if isinstance(raw, dict):
        if "examples" not in raw:
            _fatal(f"Dataset object missing 'examples' key. Got keys: {list(raw.keys())}")
        records = raw["examples"]
    elif isinstance(raw, list):
        records = raw
    else:
        _fatal(f"Dataset must be a JSON array or object with 'examples' key; got {type(raw).__name__}")

    if len(records) == 0:
        _fatal("Dataset is empty")

    # Accept: instruction/output  |  question_text/answer_text  |  messages:[...]
    for i, record in enumerate(records[:5]):
        has_instruct  = "instruction" in record and "output" in record
        has_qa        = "question_text" in record and "answer_text" in record
        has_messages  = "messages" in record and isinstance(record["messages"], list)
        if not (has_instruct or has_qa or has_messages):
            _fatal(
                f"Record {i} missing required fields. "
                "Expected {instruction, output}, {question_text, answer_text}, or {messages: [...]}. "
                f"Got: {list(record.keys())}"
            )

    _log(f"Dataset validated: {len(records):,} records at {dataset_path}")
    return records


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(cfg: dict, dataset_path: Path, output_dir: Path, base_model_id: str) -> None:
    _log("Loading training dependencies...")
    import torch
    from datasets import Dataset
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    _log(f"Device: {device}" + (f" ({torch.cuda.get_device_name(0)})" if device == "cuda" else ""))

    # Tokenizer
    _log("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Model — 4-bit quantization when GPU available, fp32 fallback for CPU
    _log("Loading base model...")
    load_kwargs: dict = {"trust_remote_code": True}
    if device == "cuda":
        load_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
        )
    else:
        _warn("No GPU detected — training on CPU will be very slow. Use for validation only.")

    model = AutoModelForCausalLM.from_pretrained(base_model_id, **load_kwargs)
    model.config.use_cache = False

    # LoRA
    lora_cfg = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )
    model = get_peft_model(model, lora_cfg)
    model.print_trainable_parameters()

    # Dataset
    _log("Preparing dataset...")
    with dataset_path.open() as f:
        raw = json.load(f)

    def format_record(record: dict) -> str:
        if "messages" in record:
            parts = []
            for msg in record["messages"]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                parts.append(f"<|{role}|>\n{content}")
            return "\n".join(parts) + "\n<|end|>"
        # question_text/answer_text (from generate-dataset and generate-dataset-hybrid)
        if "question_text" in record:
            instruction = record["question_text"]
            output = record["answer_text"]
        else:
            instruction = record.get("instruction", "")
            output = record.get("output", "")
        return f"<|user|>\n{instruction}\n<|assistant|>\n{output}\n<|end|>"

    formatted = [{"text": format_record(r)} for r in raw]
    split_idx = int(len(formatted) * 0.95)
    train_dataset = Dataset.from_list(formatted[:split_idx])
    eval_dataset = Dataset.from_list(formatted[split_idx:])
    _log(f"Train: {len(train_dataset):,} | Eval: {len(eval_dataset):,}")

    # Trainer
    checkpoint_dir = output_dir / "checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    training_args = SFTConfig(
        output_dir=str(output_dir),
        num_train_epochs=cfg["num_epochs"],
        per_device_train_batch_size=min(cfg["batch_size"], 4),  # clamp for CPU
        gradient_accumulation_steps=cfg.get("gradient_accumulation_steps", 4),
        learning_rate=cfg["learning_rate"],
        weight_decay=cfg.get("weight_decay", 0.01),
        warmup_steps=cfg.get("warmup_steps", 500),
        lr_scheduler_type=cfg.get("lr_scheduler", "cosine"),
        max_seq_length=cfg["max_seq_length"],
        seed=cfg.get("seed", 42),
        logging_steps=50,
        save_steps=cfg.get("save_every_n_steps", 1000),
        eval_steps=cfg.get("eval_every_n_steps", 1000),
        eval_strategy="steps",
        save_total_limit=3,
        load_best_model_at_end=True,
        report_to="none",
        bf16=device == "cuda",
        fp16=False,
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        args=training_args,
    )

    _log("Starting training...")
    trainer.train()

    _log(f"Saving model to {output_dir}...")
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    _log("Training complete.")
    _log("")
    _log("Next steps:")
    _log("  1. Run calibration:  npm run calibrate-confidence")
    _log("  2. Activate (staging first): POST /v1/memory/admin/activate {\"target_version\":\"memory-v1\"}")
    _log("  See docs/memory-spine/ACTIVATION_PLAN.md for the full checklist.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log(msg: str) -> None:
    print(f"[memory-v1] {msg}", flush=True)


def _warn(msg: str) -> None:
    print(f"[memory-v1] WARN {msg}", file=sys.stderr, flush=True)


def _fatal(msg: str) -> None:
    print(f"[memory-v1] ERROR {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()

    # Resolve paths relative to this script's service root
    service_root = Path(__file__).parent.parent

    config_path = Path(args.config) if Path(args.config).is_absolute() else service_root / args.config
    cfg = load_config(config_path)

    dataset_path = (
        Path(args.dataset)
        if args.dataset
        else service_root / cfg["train_data_path"]
    )
    output_dir = (
        Path(args.output)
        if args.output
        else service_root / cfg["output_dir"]
    )
    base_model_id = resolve_base_model(cfg)

    _log(f"Config    : {config_path}")
    _log(f"Dataset   : {dataset_path}")
    _log(f"Output    : {output_dir}")
    _log(f"Dry run   : {args.dry_run}")

    # Always validate
    validate_dataset(dataset_path)
    _log("Config and dataset validation passed.")

    if args.dry_run:
        _log("--dry_run set. Stopping before model load.")
        return

    output_dir.mkdir(parents=True, exist_ok=True)
    train(cfg, dataset_path, output_dir, base_model_id)


if __name__ == "__main__":
    main()
