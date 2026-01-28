#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# KripTik UICoder: RunPod Training Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Fine-tunes Mistral-7B-Instruct for UI code generation using LoRA.
# Requires A100 40GB GPU for optimal performance.
#
# Run this ON THE RUNPOD POD:
#   bash runpod-uicoder-train.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e
cd /workspace

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  KripTik UICoder Training"
echo "  Mistral-7B-Instruct + LoRA for UI Code Generation"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Check GPU and disk
# ═══════════════════════════════════════════════════════════════════════════════

echo "📊 System Information:"
nvidia-smi | head -15
echo ""
df -h /workspace
echo ""

# Verify we have enough VRAM (need ~40GB for Mistral-7B training)
VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
if [ "$VRAM" -lt 40000 ]; then
  echo "⚠️  WARNING: Less than 40GB VRAM detected ($VRAM MB)"
  echo "  UICoder training requires A100 40GB or larger."
  echo "  Consider using 8-bit quantization or smaller batch size."
  echo ""
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Install dependencies
# ═══════════════════════════════════════════════════════════════════════════════

echo "📦 Installing dependencies..."

pip install -q transformers>=4.40.0 peft>=0.10.0 accelerate>=0.29.0 \
  bitsandbytes>=0.43.0 datasets>=2.18.0 trl>=0.8.0 \
  tensorboard scipy einops

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Verify dataset
# ═══════════════════════════════════════════════════════════════════════════════

if [ ! -f "/workspace/uicoder/training-data.jsonl" ]; then
  echo "⚠️  Dataset not found!"
  echo "Please upload the UICoder training data:"
  echo "  runpodctl send uicoder-training-data.tar.gz POD_ID:/workspace/"
  exit 1
fi

EXAMPLES=$(wc -l < /workspace/uicoder/training-data.jsonl)
echo "  ✅ Dataset ready: $EXAMPLES training examples"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Create training script
# ═══════════════════════════════════════════════════════════════════════════════

echo "📝 Creating training script..."

cat > /workspace/train_uicoder.py << 'PYEOF'
"""
UICoder Training Script
Fine-tunes Mistral-7B-Instruct for UI code generation using LoRA.
"""

import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    BitsAndBytesConfig,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

# Configuration
MODEL_NAME = "mistralai/Mistral-7B-Instruct-v0.2"
OUTPUT_DIR = "/workspace/uicoder_output"
DATASET_PATH = "/workspace/uicoder/training-data.jsonl"
MAX_SEQ_LENGTH = 4096

# Quantization config for memory efficiency
bnb_config = BitsAndBytesConfig(
    load_in_8bit=True,
    bnb_8bit_compute_dtype=torch.float16,
    bnb_8bit_use_double_quant=True,
)

# Load tokenizer
print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

# Load model with quantization
print("Loading model with 8-bit quantization...")
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)

# Prepare model for training
model = prepare_model_for_kbit_training(model)

# LoRA configuration
lora_config = LoraConfig(
    r=32,
    lora_alpha=32,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

# Apply LoRA
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# Load dataset
print("Loading dataset...")
dataset = load_dataset("json", data_files=DATASET_PATH, split="train")

# Format prompt
def format_prompt(example):
    return {
        "text": f"""<s>[INST] {example['instruction']}

{example['input']} [/INST]
{example['output']}</s>"""
    }

dataset = dataset.map(format_prompt)

# Training arguments
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=5,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    learning_rate=4e-5,
    weight_decay=0.01,
    warmup_ratio=0.03,
    lr_scheduler_type="cosine",
    logging_steps=10,
    save_steps=500,
    save_total_limit=3,
    fp16=True,
    gradient_checkpointing=True,
    optim="adamw_8bit",
    report_to="tensorboard",
    seed=42,
)

# Create trainer
trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
    tokenizer=tokenizer,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    packing=False,
)

# Train
print("Starting training...")
trainer.train()

# Save final model
print("Saving model...")
trainer.save_model(f"{OUTPUT_DIR}/final")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/final")

print("Training complete!")
PYEOF

echo "  ✅ Training script created"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Start training
# ═══════════════════════════════════════════════════════════════════════════════

echo "🏋️ Starting UICoder training..."
echo "   Model: Mistral-7B-Instruct"
echo "   Method: LoRA (r=32)"
echo "   Epochs: 5"
echo "   Dataset: $EXAMPLES examples"
echo ""

# Start TensorBoard
tensorboard --logdir=/workspace/uicoder_output --port=6007 --bind_all &

echo "📊 TensorBoard running on port 6007"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  Training starting..."
echo "  Monitor: tail -f /workspace/uicoder_training.log"
echo "  TensorBoard: http://YOUR_POD_IP:6007"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

python /workspace/train_uicoder.py 2>&1 | tee /workspace/uicoder_training.log

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Copy final model
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "📦 Training complete!"
echo ""

if [ -d "/workspace/uicoder_output/final" ]; then
  echo "✅ Model saved: /workspace/uicoder_output/final"
  du -sh /workspace/uicoder_output/final
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  UICODER TRAINING COMPLETE!"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Download the trained model:"
echo "  runpodctl receive POD_ID:/workspace/uicoder_output/final ./kriptik-uicoder-lora"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
