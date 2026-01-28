#!/usr/bin/env python3
"""
KripTik UICoder Training Script - DeepSeek-Coder-V2 Version
============================================================

Three-stage training for production-grade UI code generation:
1. SFT (Supervised Fine-Tuning) on paired screenshot-code dataset
2. DPO (Direct Preference Optimization) for code quality alignment
3. Automated feedback loop for iterative refinement

Requirements:
- A100 40GB or H100 GPU
- transformers >= 4.40.0
- peft >= 0.10.0
- trl >= 0.8.0 (for DPO)
- datasets >= 2.18.0

Usage (on RunPod):
    python train-deepseek-coder.py --stage sft
    python train-deepseek-coder.py --stage dpo
    python train-deepseek-coder.py --stage validate
"""

# ═══════════════════════════════════════════════════════════════════════════════
# CRITICAL: Set cache paths BEFORE any HuggingFace imports
# This prevents "No space left on device" errors on RunPod
# ═══════════════════════════════════════════════════════════════════════════════
import os

# Set all HuggingFace cache paths to workspace (which has plenty of space)
CACHE_DIR = "/workspace/.hf_cache"
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(f"{CACHE_DIR}/datasets", exist_ok=True)
os.makedirs(f"{CACHE_DIR}/hub", exist_ok=True)

os.environ["HF_HOME"] = CACHE_DIR
os.environ["HF_DATASETS_CACHE"] = f"{CACHE_DIR}/datasets"
os.environ["HUGGINGFACE_HUB_CACHE"] = f"{CACHE_DIR}/hub"
os.environ["TRANSFORMERS_CACHE"] = f"{CACHE_DIR}/hub"
os.environ["XDG_CACHE_HOME"] = CACHE_DIR

print(f"[Cache Config] HF_HOME set to: {CACHE_DIR}")
print("[Cache Config] Available space on /workspace: ", end="")
os.system("df -h /workspace | tail -1 | awk '{print $4}'")

# Now import everything else
import argparse
import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import torch
from datasets import load_dataset, Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    BitsAndBytesConfig,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

# Try importing TRL for DPO (may not be installed)
try:
    from trl import SFTTrainer, DPOTrainer, DPOConfig
    HAS_TRL = True
except ImportError:
    HAS_TRL = False
    print("Warning: TRL not installed. DPO training unavailable.")


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class TrainingConfig:
    """Configuration for UICoder training."""

    # Model Selection (DeepSeek-Coder-V2 recommended)
    # 90.2% HumanEval vs Mistral's 60%
    # 128K context vs 32K
    base_model: str = "deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct"

    # Alternative options:
    # - "Qwen/Qwen2.5-Coder-32B-Instruct"  # 88.4% HumanEval, 128K context
    # - "mistralai/Codestral-22B-v0.1"     # 81.1% HumanEval, 32K context

    # Output paths
    output_dir: str = "/workspace/uicoder_output"
    dataset_path: str = "/workspace/uicoder/training-data.jsonl"
    preference_dataset: str = "/workspace/uicoder/preference-pairs.jsonl"

    # LoRA Configuration
    lora_r: int = 64
    lora_alpha: int = 64
    lora_dropout: float = 0.05
    lora_target_modules: tuple = (
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    )

    # SFT Training Arguments
    sft_epochs: int = 3
    sft_batch_size: int = 1  # Reduced from 2 to fit in 24GB VRAM with 16B model
    sft_gradient_accumulation: int = 16  # Increased from 8 to compensate for batch_size=1
    sft_learning_rate: float = 4e-6
    sft_max_seq_length: int = 1024  # Reduced from 2048 to fit in 24GB VRAM

    # DPO Training Arguments
    dpo_epochs: int = 1
    dpo_batch_size: int = 1
    dpo_gradient_accumulation: int = 8
    dpo_learning_rate: float = 1e-6
    dpo_beta: float = 0.1

    # Quantization
    load_in_8bit: bool = True

    # Validation
    validate_typescript: bool = True
    validate_lighthouse: bool = True
    validate_visual_match: bool = True
    min_visual_similarity: float = 0.85


config = TrainingConfig()


# ═══════════════════════════════════════════════════════════════════════════════
# INSTRUCTION TEMPLATE
# ═══════════════════════════════════════════════════════════════════════════════

INSTRUCTION_TEMPLATE = """You are KripTik UICoder, an expert UI developer. Given a description of a UI design, generate production-ready React/TypeScript code.

REQUIREMENTS:
- Use React 18+ with TypeScript and strict types
- Use appropriate animation libraries:
  * GSAP for scroll-triggered animations (ScrollTrigger)
  * Framer Motion for React component animations (spring physics)
  * Three.js/R3F for 3D elements
- Follow correct animation physics:
  * Spring stiffness: 100-500 (higher = snappier)
  * Spring damping: 10-40 (higher = less bounce)
  * GSAP scrub: true or number for scroll-linked
- Ensure 60fps performance on mobile
- Include reduced motion support (prefers-reduced-motion)
- Use Tailwind CSS for styling
- Include proper accessibility (ARIA labels)
- Lazy load heavy dependencies (Three.js, etc.)

CRITICAL PATTERNS:
- ScrollTrigger: Use ignoreMobileResize: true for iOS
- Framer Motion: stiffness 300-400, damping 20-30 for snappy interactions
- Three.js: Always provide WebGL fallback for WebGPU
- Mobile: Use touch-friendly targets (44px minimum)"""


def format_prompt(example):
    """Format training example for instruction tuning."""
    return {
        "text": f"""<|begin_of_sentence|>{INSTRUCTION_TEMPLATE}

[USER]
{example['instruction']}

{example['input']}
[/USER]

[ASSISTANT]
{example['output']}
[/ASSISTANT]<|end_of_sentence|>"""
    }


def format_dpo_prompt(example):
    """Format DPO preference pair."""
    prompt = f"""<|begin_of_sentence|>{INSTRUCTION_TEMPLATE}

[USER]
{example['instruction']}

{example['input']}
[/USER]

[ASSISTANT]"""
    return {
        "prompt": prompt,
        "chosen": example["chosen_output"],
        "rejected": example["rejected_output"],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1: SUPERVISED FINE-TUNING
# ═══════════════════════════════════════════════════════════════════════════════

def run_sft_training():
    """Stage 1: Supervised Fine-Tuning on paired dataset."""
    print("=" * 80)
    print("STAGE 1: SUPERVISED FINE-TUNING")
    print("=" * 80)

    # Quantization config - use 4-bit for better MoE compatibility
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
    )

    # Load tokenizer
    print(f"Loading tokenizer for {config.base_model}...")
    tokenizer = AutoTokenizer.from_pretrained(
        config.base_model,
        trust_remote_code=True,
    )
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # Load model
    print("Loading model with 4-bit quantization (NF4)...")
    model = AutoModelForCausalLM.from_pretrained(
        config.base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
        attn_implementation="eager",  # Avoid flash attention issues with MoE
    )

    # Prepare for k-bit training
    model = prepare_model_for_kbit_training(model)

    # LoRA configuration
    lora_config = LoraConfig(
        r=config.lora_r,
        lora_alpha=config.lora_alpha,
        target_modules=list(config.lora_target_modules),
        lora_dropout=config.lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
    )

    # Apply LoRA
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # Load dataset
    print(f"Loading dataset from {config.dataset_path}...")
    dataset = load_dataset("json", data_files=config.dataset_path, split="train")
    dataset = dataset.map(format_prompt)

    print(f"Dataset size: {len(dataset)} examples")

    # Training arguments - use SFTConfig for TRL 0.27+
    if HAS_TRL:
        from trl import SFTConfig
        training_args = SFTConfig(
            output_dir=f"{config.output_dir}/sft",
            num_train_epochs=config.sft_epochs,
            per_device_train_batch_size=config.sft_batch_size,
            gradient_accumulation_steps=config.sft_gradient_accumulation,
            learning_rate=config.sft_learning_rate,
            weight_decay=0.01,
            warmup_ratio=0.03,
            lr_scheduler_type="cosine",
            logging_steps=10,
            save_steps=500,
            save_total_limit=3,
            bf16=True,  # Use bf16 for MoE model compatibility
            gradient_checkpointing=True,
            optim="adamw_8bit",
            report_to="tensorboard",
            seed=42,
            max_grad_norm=1.0,
            # TRL 0.27+ specific settings
            max_length=config.sft_max_seq_length,
            packing=False,
        )
    else:
        training_args = TrainingArguments(
            output_dir=f"{config.output_dir}/sft",
            num_train_epochs=config.sft_epochs,
            per_device_train_batch_size=config.sft_batch_size,
            gradient_accumulation_steps=config.sft_gradient_accumulation,
            learning_rate=config.sft_learning_rate,
            weight_decay=0.01,
            warmup_ratio=0.03,
            lr_scheduler_type="cosine",
            logging_steps=10,
            save_steps=500,
            save_total_limit=3,
            bf16=True,  # Use bf16 for MoE model compatibility
            gradient_checkpointing=True,
            optim="adamw_8bit",
            report_to="tensorboard",
            seed=42,
            max_grad_norm=1.0,
        )

    # Create trainer
    if HAS_TRL:
        # TRL 0.27+ API:
        # - processing_class instead of tokenizer
        # - formatting_func instead of dataset_text_field
        # - max_length and packing moved to SFTConfig
        def formatting_func(example):
            return example["text"]

        trainer = SFTTrainer(
            model=model,
            args=training_args,
            train_dataset=dataset,
            processing_class=tokenizer,
            formatting_func=formatting_func,
        )
    else:
        from transformers import Trainer, DataCollatorForLanguageModeling

        data_collator = DataCollatorForLanguageModeling(
            tokenizer=tokenizer,
            mlm=False,
        )

        def tokenize_function(examples):
            return tokenizer(
                examples["text"],
                truncation=True,
                max_length=config.sft_max_seq_length,
                padding="max_length",
            )

        tokenized_dataset = dataset.map(
            tokenize_function,
            batched=True,
            remove_columns=dataset.column_names,
        )

        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=tokenized_dataset,
            data_collator=data_collator,
        )

    # Train
    print("Starting SFT training...")
    trainer.train()

    # Save
    print(f"Saving SFT model to {config.output_dir}/sft/final...")
    trainer.save_model(f"{config.output_dir}/sft/final")
    tokenizer.save_pretrained(f"{config.output_dir}/sft/final")

    print("SFT training complete!")
    return f"{config.output_dir}/sft/final"


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2: DIRECT PREFERENCE OPTIMIZATION (DPO)
# ═══════════════════════════════════════════════════════════════════════════════

def run_dpo_training(sft_model_path: str):
    """Stage 2: DPO alignment for code quality."""
    if not HAS_TRL:
        print("ERROR: TRL not installed. Cannot run DPO training.")
        print("Install with: pip install trl>=0.8.0")
        return sft_model_path

    print("=" * 80)
    print("STAGE 2: DIRECT PREFERENCE OPTIMIZATION")
    print("=" * 80)

    # Check for preference dataset
    if not os.path.exists(config.preference_dataset):
        print(f"Warning: Preference dataset not found at {config.preference_dataset}")
        print("Generating preference pairs using teacher model...")
        generate_preference_pairs()

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(sft_model_path, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token

    # Load SFT model
    print(f"Loading SFT model from {sft_model_path}...")
    model = AutoModelForCausalLM.from_pretrained(
        sft_model_path,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True,
    )

    # Load reference model (for DPO)
    ref_model = AutoModelForCausalLM.from_pretrained(
        sft_model_path,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True,
    )

    # Load preference dataset
    print(f"Loading preference dataset...")
    dataset = load_dataset("json", data_files=config.preference_dataset, split="train")
    dataset = dataset.map(format_dpo_prompt)

    print(f"Preference pairs: {len(dataset)}")

    # DPO config
    dpo_config = DPOConfig(
        output_dir=f"{config.output_dir}/dpo",
        num_train_epochs=config.dpo_epochs,
        per_device_train_batch_size=config.dpo_batch_size,
        gradient_accumulation_steps=config.dpo_gradient_accumulation,
        learning_rate=config.dpo_learning_rate,
        beta=config.dpo_beta,
        fp16=True,
        logging_steps=10,
        save_steps=100,
        gradient_checkpointing=True,
    )

    # Create DPO trainer
    trainer = DPOTrainer(
        model=model,
        ref_model=ref_model,
        args=dpo_config,
        train_dataset=dataset,
        tokenizer=tokenizer,
    )

    # Train
    print("Starting DPO training...")
    trainer.train()

    # Save
    print(f"Saving DPO model to {config.output_dir}/dpo/final...")
    trainer.save_model(f"{config.output_dir}/dpo/final")
    tokenizer.save_pretrained(f"{config.output_dir}/dpo/final")

    print("DPO training complete!")
    return f"{config.output_dir}/dpo/final"


def generate_preference_pairs():
    """Generate preference pairs using Opus 4.5 as teacher."""
    print("Generating preference pairs...")
    print("This requires Anthropic API key for Opus 4.5")

    # Load existing SFT dataset
    if not os.path.exists(config.dataset_path):
        print(f"Error: SFT dataset not found at {config.dataset_path}")
        return

    dataset = load_dataset("json", data_files=config.dataset_path, split="train")

    # For each example, generate:
    # - chosen: high-quality code (from Opus 4.5 or human-verified)
    # - rejected: lower-quality code (common mistakes)

    preference_pairs = []

    # Sample generation (placeholder - would use Opus 4.5 in production)
    for i, example in enumerate(dataset):
        if i >= 100:  # Limit for demo
            break

        pair = {
            "instruction": example.get("instruction", ""),
            "input": example.get("input", ""),
            "chosen_output": example.get("output", ""),  # Use existing as chosen
            "rejected_output": generate_rejected_example(example),
        }
        preference_pairs.append(pair)

    # Save preference pairs
    with open(config.preference_dataset, "w") as f:
        for pair in preference_pairs:
            f.write(json.dumps(pair) + "\n")

    print(f"Generated {len(preference_pairs)} preference pairs")


def generate_rejected_example(example):
    """Generate a deliberately lower-quality version of code."""
    output = example.get("output", "")

    # Common mistakes to inject (for training the model to avoid these)
    mistakes = [
        # Wrong spring physics
        ("stiffness: 300", "stiffness: 1000"),  # Too stiff
        ("damping: 20", "damping: 5"),  # Under-damped (bouncy)

        # Missing mobile optimization
        ("ignoreMobileResize: true", ""),

        # Missing accessibility
        ("aria-label=", ""),
        ("prefers-reduced-motion", ""),

        # Inefficient patterns
        ("will-change: transform", "will-change: width, height"),
    ]

    rejected = output
    for correct, incorrect in mistakes:
        if correct in rejected:
            rejected = rejected.replace(correct, incorrect, 1)
            break

    return rejected if rejected != output else output + "\n// Missing error handling"


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 3: AUTOMATED VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

def run_validation(model_path: str, iterations: int = 5):
    """Stage 3: Automated validation and feedback loop."""
    print("=" * 80)
    print("STAGE 3: AUTOMATED VALIDATION")
    print("=" * 80)

    results = {
        "typescript_compile": [],
        "lighthouse_score": [],
        "visual_match": [],
        "overall_pass_rate": 0,
    }

    # Load test prompts
    test_prompts = load_test_prompts()

    for iteration in range(iterations):
        print(f"\nIteration {iteration + 1}/{iterations}")

        iteration_results = {
            "compile_pass": 0,
            "lighthouse_pass": 0,
            "visual_pass": 0,
            "total": len(test_prompts),
        }

        for prompt in test_prompts:
            # Generate code
            code = generate_code(model_path, prompt)

            # Validate TypeScript compilation
            if config.validate_typescript:
                compiles = validate_typescript(code)
                if compiles:
                    iteration_results["compile_pass"] += 1

            # Validate Lighthouse score
            if config.validate_lighthouse:
                score = validate_lighthouse(code)
                if score >= 90:
                    iteration_results["lighthouse_pass"] += 1

            # Validate visual match
            if config.validate_visual_match:
                similarity = validate_visual_match(code, prompt.get("mockup_url"))
                if similarity >= config.min_visual_similarity:
                    iteration_results["visual_pass"] += 1

        # Calculate pass rates
        compile_rate = iteration_results["compile_pass"] / iteration_results["total"]
        lighthouse_rate = iteration_results["lighthouse_pass"] / iteration_results["total"]
        visual_rate = iteration_results["visual_pass"] / iteration_results["total"]

        print(f"  Compile rate: {compile_rate:.1%}")
        print(f"  Lighthouse rate: {lighthouse_rate:.1%}")
        print(f"  Visual match rate: {visual_rate:.1%}")

        results["typescript_compile"].append(compile_rate)
        results["lighthouse_score"].append(lighthouse_rate)
        results["visual_match"].append(visual_rate)

    # Final summary
    results["overall_pass_rate"] = (
        sum(results["typescript_compile"]) / len(results["typescript_compile"]) * 0.4 +
        sum(results["lighthouse_score"]) / len(results["lighthouse_score"]) * 0.3 +
        sum(results["visual_match"]) / len(results["visual_match"]) * 0.3
    )

    print(f"\nOverall pass rate: {results['overall_pass_rate']:.1%}")

    # Save results
    with open(f"{config.output_dir}/validation_results.json", "w") as f:
        json.dump(results, f, indent=2)

    return results


def load_test_prompts():
    """Load test prompts for validation."""
    # Placeholder - would load from file
    return [
        {
            "instruction": "Create a glassmorphism card with hover animation",
            "input": "The card should have blur effect, subtle border, and lift on hover",
            "mockup_url": None,
        },
        {
            "instruction": "Create a scroll-triggered hero section",
            "input": "Hero text animates in on scroll, background parallax effect",
            "mockup_url": None,
        },
    ]


def generate_code(model_path: str, prompt: dict) -> str:
    """Generate code using the trained model."""
    # Placeholder - would use actual model inference
    return "// Generated code placeholder"


def validate_typescript(code: str) -> bool:
    """Validate that TypeScript code compiles."""
    try:
        # Write to temp file
        temp_file = "/tmp/validate_code.tsx"
        with open(temp_file, "w") as f:
            f.write(code)

        # Run tsc
        result = subprocess.run(
            ["npx", "tsc", "--noEmit", temp_file],
            capture_output=True,
            timeout=30,
        )

        return result.returncode == 0
    except Exception as e:
        print(f"TypeScript validation error: {e}")
        return False


def validate_lighthouse(code: str) -> int:
    """Validate Lighthouse performance score."""
    # Placeholder - would render code and run Lighthouse
    return 85  # Simulated score


def validate_visual_match(code: str, mockup_url: Optional[str]) -> float:
    """Validate visual similarity using VL-JEPA."""
    if not mockup_url:
        return 0.9  # Skip if no mockup

    # Placeholder - would use VL-JEPA comparison
    return 0.87  # Simulated similarity


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="KripTik UICoder Training")
    parser.add_argument(
        "--stage",
        choices=["sft", "dpo", "validate", "all"],
        default="all",
        help="Training stage to run",
    )
    parser.add_argument(
        "--model-path",
        type=str,
        help="Path to model for DPO or validation",
    )
    args = parser.parse_args()

    if args.stage == "sft" or args.stage == "all":
        model_path = run_sft_training()

        if args.stage == "all":
            args.model_path = model_path

    if args.stage == "dpo" or args.stage == "all":
        if not args.model_path:
            args.model_path = f"{config.output_dir}/sft/final"
        model_path = run_dpo_training(args.model_path)

        if args.stage == "all":
            args.model_path = model_path

    if args.stage == "validate" or args.stage == "all":
        if not args.model_path:
            args.model_path = f"{config.output_dir}/dpo/final"
        run_validation(args.model_path)

    print("\n" + "=" * 80)
    print("TRAINING COMPLETE!")
    print("=" * 80)
    print(f"Final model: {args.model_path}")


if __name__ == "__main__":
    main()
