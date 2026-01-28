#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# KripTik UI-LoRA: RunPod Volume Cleanup & Comprehensive Training
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script handles the 93% volume issue and launches comprehensive training.
#
# PROBLEM: RunPod pod at 93% volume capacity
# SOLUTION: Clean up old files before uploading new 3GB dataset
#
# Run this ON THE RUNPOD POD:
#   bash runpod-cleanup-and-train.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e
cd /workspace

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  KripTik Comprehensive UI-LoRA Training"
echo "  8,401 Premium UI Images | 5,000 Training Steps"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Check current disk usage
# ═══════════════════════════════════════════════════════════════════════════════

echo "📊 Current Disk Usage:"
df -h /workspace
echo ""
du -sh /workspace/* 2>/dev/null | sort -hr | head -10
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Clean up to free space
# ═══════════════════════════════════════════════════════════════════════════════

echo "🧹 Cleaning up to free space..."

# Remove old checkpoints (keep only latest)
if [ -d "/workspace/output" ]; then
  echo "  Cleaning old checkpoints..."
  cd /workspace/output
  ls -t *.safetensors 2>/dev/null | tail -n +2 | xargs rm -f 2>/dev/null || true
  rm -rf logs/* 2>/dev/null || true
  cd /workspace
fi

# Remove old datasets (will be replaced with comprehensive)
if [ -d "/workspace/dataset" ]; then
  echo "  Removing old dataset (will upload comprehensive)..."
  rm -rf /workspace/dataset
fi

# Clear pip cache
echo "  Clearing pip cache..."
pip cache purge 2>/dev/null || true

# Clear HuggingFace cache (keep models, remove cache)
if [ -d "/root/.cache/huggingface" ]; then
  echo "  Cleaning HuggingFace cache..."
  rm -rf /root/.cache/huggingface/hub/.locks 2>/dev/null || true
  rm -rf /root/.cache/huggingface/datasets 2>/dev/null || true
fi

# Clear old temp files
rm -rf /tmp/* 2>/dev/null || true
rm -rf /workspace/*.log 2>/dev/null || true
rm -rf /workspace/*.tar.gz 2>/dev/null || true

echo ""
echo "📊 Disk Usage After Cleanup:"
df -h /workspace
echo ""

# Check if we have enough space (need ~10GB for training)
AVAILABLE=$(df /workspace | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE" -lt 10 ]; then
  echo "⚠️  WARNING: Less than 10GB available. Consider:"
  echo "  1. Delete FLUX model and re-download during training"
  echo "  2. Resize the RunPod volume"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Extract new comprehensive dataset
# ═══════════════════════════════════════════════════════════════════════════════

if [ -f "/workspace/comprehensive-training-dataset.tar.gz" ]; then
  echo "📂 Extracting comprehensive dataset..."
  tar -xzf /workspace/comprehensive-training-dataset.tar.gz -C /workspace/
  mv /workspace/comprehensive-training-dataset /workspace/dataset
  rm /workspace/comprehensive-training-dataset.tar.gz

  IMAGE_COUNT=$(find /workspace/dataset/images -type f \( -name "*.png" -o -name "*.jpg" \) | wc -l)
  CAPTION_COUNT=$(find /workspace/dataset/captions -type f -name "*.txt" | wc -l)
  echo "  ✅ Dataset ready: $IMAGE_COUNT images, $CAPTION_COUNT captions"
else
  echo "⚠️  Dataset not found!"
  echo "Please upload the comprehensive dataset:"
  echo "  runpodctl send comprehensive-training-dataset.tar.gz POD_ID:/workspace/"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Install/Update dependencies
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "📦 Installing dependencies..."

# Clone ai-toolkit if not present
if [ ! -d "/workspace/ai-toolkit" ]; then
  git clone https://github.com/ostris/ai-toolkit.git
fi

cd /workspace/ai-toolkit
git pull origin main 2>/dev/null || true
pip install -q -r requirements.txt
pip install -q accelerate transformers diffusers peft safetensors bitsandbytes scipy einops tensorboard

cd /workspace

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Create optimized training config
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "📝 Creating training configuration..."

cat > /workspace/train_config.yaml << 'EOF'
# KripTik Comprehensive UI-LoRA Training Config
# Dataset: 8,401 premium UI images
# Steps: 5,000 (optimized for large dataset)

job: extension
config:
  name: kriptik-comprehensive-ui-lora
  process:
    - type: sd_trainer
      training_folder: /workspace/output
      device: cuda:0
      trigger_word: kriptik_ui

      network:
        type: lora
        linear: 64
        linear_alpha: 64

      save:
        save_every: 1000
        max_step_saves_to_keep: 3
        push_to_hub: false

      datasets:
        - folder_path: /workspace/dataset
          caption_ext: txt
          resolution: [1024, 1024]
          is_regularization: false
          cache_latents_to_disk: true

      train:
        steps: 5000
        lr: 1e-4
        batch_size: 1
        gradient_accumulation_steps: 4
        gradient_checkpointing: true
        optimizer: adamw8bit
        train_text_encoder: false
        noise_scheduler: flow_match

      sample:
        sample_every: 1000
        sample_steps: 20
        width: 1024
        height: 1024
        prompts:
          - "kriptik_ui, premium SaaS dashboard, dark theme, data visualization, modern 2026 aesthetic"
          - "kriptik_ui, mobile app login, iOS design, glassmorphism, professional layout"
          - "kriptik_ui, e-commerce product page, premium visual quality, clean interface"
          - "kriptik_ui, award-winning portfolio, WebGL effects, creative studio design"
          - "kriptik_ui, design system component library, modular UI, professional aesthetic"

      model:
        name_or_path: black-forest-labs/FLUX.1-dev
        is_flux: true
        quantize: true
EOF

echo "  ✅ Config created: /workspace/train_config.yaml"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Start training
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "🏋️ Starting comprehensive training..."
echo "   Dataset: 8,401 images"
echo "   Steps: 5,000"
echo "   LoRA Rank: 64"
echo "   Trigger Word: kriptik_ui"
echo ""
echo "📊 TensorBoard: Starting on port 6006..."
tensorboard --logdir=/workspace/output/logs --port=6006 --bind_all &

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  Training starting... This will take ~2-3 hours on RTX 4090"
echo "  Monitor: tail -f /workspace/training.log"
echo "  TensorBoard: http://YOUR_POD_IP:6006"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

cd /workspace/ai-toolkit
python run.py /workspace/train_config.yaml 2>&1 | tee /workspace/training.log

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: Copy final model
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "📦 Copying final model..."

LATEST=$(ls -t /workspace/output/*.safetensors 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
  cp "$LATEST" "/workspace/kriptik-comprehensive-ui-lora.safetensors"
  echo "✅ Model saved: /workspace/kriptik-comprehensive-ui-lora.safetensors"
  ls -lh /workspace/kriptik-comprehensive-ui-lora.safetensors
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  TRAINING COMPLETE!"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Download the trained model:"
echo "  runpodctl receive POD_ID:/workspace/kriptik-comprehensive-ui-lora.safetensors ./"
echo ""
echo "Then copy to your project:"
echo "  cp kriptik-comprehensive-ui-lora.safetensors docker/ui-generator/models/loras/"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
