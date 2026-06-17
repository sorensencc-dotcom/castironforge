#!/usr/bin/env python3
"""
CIC Memory Spine — LoRA fine-tuning script.

Uses HuggingFace TRL (SFTTrainer) + PEFT (LoRA) to fine-tune a base LLM
on the generated Q&A dataset. Reads train-config.json for all hyperparams.

Requirements:
    pip install -r requirements-train.txt

Usage:
    python scripts/train.py                          # uses train-config.json defaults
    python scripts/train.py --config train-config.json --dataset datasets/memory-dataset-v1.json
"""

import argparse
import json
import os
import random
import sys
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--config",       default="train-config.json")
    p.add_argument("--dataset",      default=None)
    p.add_argument("--output_dir",   default=None)
    p.add_argument("--checkpoint_dir", default=None)
    p.add_argument("--dry_run",      action="store_true",
                   help="Validate dataset and config only — do not train")
    return p.parse_args()


def load_config(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def load_examples(path: str) -> list[dict]:
    with open(path) as f:
        data = json.load(f)
    return data.get("examples", data) if isinstance(data, dict) else data


def format_example(ex: dict) -> str:
    domain = ex.get("domain", "general")
    q = ex["question_text"].strip()
    a = ex["answer_text"].strip()
    return (
        f"<|system|>\nYou are the CIC Memory Spine, a deterministic knowledge layer "
        f"for the Cast Iron Forge platform. Domain: {domain}.\n"
        f"<|user|>\n{q}\n"
        f"<|assistant|>\n{a}"
    )


def split_dataset(examples: list[dict], eval_ratio: float = 0.1, seed: int = 42):
    random.seed(seed)
    shuffled = examples[:]
    random.shuffle(shuffled)
    split = int(len(shuffled) * (1 - eval_ratio))
    return shuffled[:split], shuffled[split:]


def validate(cfg: dict, examples: list[dict]) -> None:
    required_cfg = ["base_model", "output_dir", "max_seq_length",
                    "learning_rate", "num_epochs", "batch_size"]
    missing = [k for k in required_cfg if k not in cfg]
    if missing:
        print(f"[error] Missing config keys: {missing}", file=sys.stderr)
        sys.exit(1)

    required_ex = ["question_text", "answer_text"]
    bad = [i for i, e in enumerate(examples) if any(k not in e for k in required_ex)]
    if bad:
        print(f"[error] {len(bad)} examples missing required fields", file=sys.stderr)
        sys.exit(1)

    train_ex, eval_ex = split_dataset(examples, seed=cfg.get("seed", 42))
    print(f"[validate] config OK — {len(examples)} examples "
          f"({len(train_ex)} train / {len(eval_ex)} eval)")
    domains = {}
    for e in examples:
        d = e.get("domain", "unknown")
        domains[d] = domains.get(d, 0) + 1
    for d, n in sorted(domains.items(), key=lambda x: -x[1]):
        print(f"  {d:<30} {n}")


def train(cfg: dict, examples: list[dict], output_dir: str, checkpoint_dir: str) -> None:
    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig, TaskType, get_peft_model
        from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
        from trl import SFTTrainer
    except ImportError as e:
        print(f"\n[error] Missing package: {e}", file=sys.stderr)
        print("Install with:  pip install -r requirements-train.txt", file=sys.stderr)
        sys.exit(1)

    base_model = cfg["base_model"]
    print(f"[train] Loading base model: {base_model}")

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True,
    )

    lora_cfg = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "v_proj"],
        bias="none",
    )
    model = get_peft_model(model, lora_cfg)
    model.print_trainable_parameters()

    train_ex, eval_ex = split_dataset(examples, seed=cfg.get("seed", 42))
    train_ds = Dataset.from_list([{"text": format_example(e)} for e in train_ex])
    eval_ds  = Dataset.from_list([{"text": format_example(e)} for e in eval_ex])

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    Path(checkpoint_dir).mkdir(parents=True, exist_ok=True)

    args = TrainingArguments(
        output_dir=checkpoint_dir,
        num_train_epochs=cfg.get("num_epochs", 3),
        per_device_train_batch_size=max(1, cfg.get("batch_size", 64) //
                                       max(1, torch.cuda.device_count())),
        gradient_accumulation_steps=cfg.get("gradient_accumulation_steps", 4),
        learning_rate=cfg.get("learning_rate", 2e-4),
        weight_decay=cfg.get("weight_decay", 0.01),
        warmup_steps=cfg.get("warmup_steps", 500),
        lr_scheduler_type=cfg.get("lr_scheduler", "cosine"),
        save_steps=cfg.get("save_every_n_steps", 1000),
        eval_steps=cfg.get("eval_every_n_steps", 1000),
        evaluation_strategy="steps",
        save_total_limit=3,
        logging_steps=50,
        fp16=torch.cuda.is_available(),
        seed=cfg.get("seed", 42),
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        dataset_text_field="text",
        max_seq_length=cfg.get("max_seq_length", 2048),
        tokenizer=tokenizer,
    )

    print(f"[train] Starting fine-tuning → {output_dir}")
    trainer.train()

    print(f"[train] Saving adapter to {output_dir}")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    # Write a provenance record
    provenance = {
        "base_model": base_model,
        "dataset_examples": len(examples),
        "train_examples": len(train_ex),
        "eval_examples": len(eval_ex),
        "config": cfg,
    }
    with open(Path(output_dir) / "training_provenance.json", "w") as f:
        json.dump(provenance, f, indent=2)

    print(f"[train] Done. Artifacts in {output_dir}")
    print("Next: npm run calibrate-confidence")


def main():
    args = parse_args()

    script_dir = Path(__file__).parent
    service_dir = script_dir.parent

    cfg = load_config(args.config if Path(args.config).is_absolute()
                      else service_dir / args.config)

    dataset_path = args.dataset or cfg.get("train_data_path", "datasets/memory-dataset-v1.json")
    if not Path(dataset_path).is_absolute():
        dataset_path = service_dir / dataset_path

    output_dir = args.output_dir or cfg.get("output_dir", "models/memory-v1")
    if not Path(output_dir).is_absolute():
        output_dir = str(service_dir / output_dir)

    checkpoint_dir = args.checkpoint_dir or str(Path(output_dir) / "checkpoints")

    if not Path(dataset_path).exists():
        print(f"[error] Dataset not found: {dataset_path}", file=sys.stderr)
        print("  Run: npm run generate-dataset-hybrid", file=sys.stderr)
        sys.exit(1)

    examples = load_examples(str(dataset_path))
    print(f"[info] Loaded {len(examples)} examples from {dataset_path}")

    validate(cfg, examples)

    if args.dry_run or os.environ.get("DRY_RUN") == "1":
        print("[dry-run] Validation passed. Skipping training.")
        return

    train(cfg, examples, output_dir, checkpoint_dir)


if __name__ == "__main__":
    main()
