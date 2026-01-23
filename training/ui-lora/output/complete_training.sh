#!/bin/bash
# =============================================================================
# KripTik UI-LoRA Complete Training Script
# Run this on the RunPod pod: bash /workspace/complete_training.sh
# =============================================================================

set -e
cd /workspace

echo "═══════════════════════════════════════════════════════════"
echo "  KripTik UI-LoRA Training Pipeline"
echo "  FLUX.1-dev Fine-tuning for UI Generation"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Step 1: Extract dataset if compressed
echo "📦 Step 1: Preparing dataset..."
if [ -f "/workspace/kriptik-training-dataset.tar.gz" ]; then
  echo "   Extracting dataset..."
  tar -xzf /workspace/kriptik-training-dataset.tar.gz
  echo "   ✅ Dataset extracted"
fi

# Count images
if [ -d "/workspace/dataset/images" ]; then
  IMAGE_COUNT=$(ls -1 /workspace/dataset/images/*.{png,jpg,jpeg} 2>/dev/null | wc -l)
  echo "   ✅ Found $IMAGE_COUNT training images"
else
  echo "   ❌ Dataset not found! Please upload dataset to /workspace/dataset/"
  exit 1
fi

# Step 2: Clone SimpleTuner
echo ""
echo "📦 Step 2: Setting up SimpleTuner..."
if [ ! -d "/workspace/SimpleTuner" ]; then
  echo "   Cloning SimpleTuner repository..."
  git clone https://github.com/bghira/SimpleTuner.git
fi

# Step 3: Install dependencies
echo ""
echo "📦 Step 3: Installing dependencies..."
cd /workspace/SimpleTuner
pip install -q -r requirements.txt
pip install -q accelerate transformers diffusers peft safetensors bitsandbytes scipy einops
cd /workspace

# Step 4: Download FLUX.1-dev model
echo ""
echo "📦 Step 4: Downloading FLUX.1-dev model (this may take a few minutes)..."
if [ ! -d "/workspace/models/flux-dev" ]; then
  python3 << 'PYTHON_SCRIPT'
from huggingface_hub import snapshot_download
import os
os.makedirs("/workspace/models", exist_ok=True)
snapshot_download(
    'black-forest-labs/FLUX.1-dev',
    local_dir='/workspace/models/flux-dev',
    ignore_patterns=['*.bin', '*ema*']
)
print("✅ FLUX.1-dev model downloaded")
PYTHON_SCRIPT
else
  echo "   ✅ Model already downloaded"
fi

# Step 5: Create training config
echo ""
echo "📝 Step 5: Creating training configuration..."
cat > /workspace/train_config.toml << 'EOF'
# KripTik UI-LoRA SimpleTuner Configuration

[model]
pretrained_model_name_or_path = "/workspace/models/flux-dev"
model_family = "flux"

[dataset]
instance_data_dir = "/workspace/dataset/images"
caption_strategy = "textfile"
caption_extension = ".txt"
repeats = 1
resolution = 1024
center_crop = true

[training]
output_dir = "/workspace/output"
train_batch_size = 1
gradient_accumulation_steps = 4
gradient_checkpointing = true
mixed_precision = "bf16"
learning_rate = 1e-4
lr_scheduler = "cosine"
lr_warmup_steps = 100
max_train_steps = 3000
checkpointing_steps = 500
seed = 42

[lora]
use_lora = true
lora_rank = 64
lora_alpha = 64

[validation]
validation_prompts = [
  "kriptik_ui, mobile login screen, email password inputs, sign in button, modern dark theme, professional design",
  "kriptik_ui, dashboard interface, data cards, analytics charts, dark theme, professional layout, clean design",
  "kriptik_ui, iOS settings page, toggle switches, Apple design language, clean minimal interface, SF symbols",
  "kriptik_ui, e-commerce product page, product image gallery, add to cart button, modern web design",
  "kriptik_ui, chat messaging app, conversation bubbles, text input, send button, modern mobile interface"
]
validation_num_images = 2
validation_steps = 500
EOF
echo "   ✅ Configuration created"

# Step 6: Start training
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🏋️ Step 6: Starting LoRA Training"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Training will now begin. Expected timeline:"
echo "  - 500 steps (~15 min): Basic style learning"
echo "  - 1000 steps (~30 min): Good UI layouts"
echo "  - 2000 steps (~45 min): Refined text rendering"
echo "  - 3000 steps (~60 min): Production quality"
echo ""
echo "Monitor with: watch nvidia-smi"
echo "TensorBoard: tensorboard --logdir=/workspace/output/logs"
echo ""

mkdir -p /workspace/output

# Run training with nohup so it continues if terminal disconnects
cd /workspace/SimpleTuner
nohup accelerate launch \
  --mixed_precision=bf16 \
  --num_processes=1 \
  train.py \
  --config /workspace/train_config.toml \
  > /workspace/training.log 2>&1 &

TRAINING_PID=$!
echo "✅ Training started with PID: $TRAINING_PID"
echo ""
echo "Monitor progress:"
echo "  tail -f /workspace/training.log"
echo ""
echo "When complete, the model will be saved to:"
echo "  /workspace/output/pytorch_lora_weights.safetensors"
echo ""
echo "To download the trained model:"
echo "  On your local machine run:"
echo "  runpodctl receive POD_ID:/workspace/output/pytorch_lora_weights.safetensors ./"
echo ""

# Tail the log for initial output
echo "═══════════════════════════════════════════════════════════"
echo "📋 Training Log (Press Ctrl+C to detach, training continues)"
echo "═══════════════════════════════════════════════════════════"
sleep 5
tail -f /workspace/training.log
