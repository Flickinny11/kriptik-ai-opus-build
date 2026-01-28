#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# KRIPTIK ENHANCED FLUX UI-LORA TRAINING
# Upgraded config: rank 128, 8000 steps
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
RUNPOD_SSH_KEY="${RUNPOD_SSH_KEY:-$HOME/.runpod/ssh/RunPod-Key-Go}"
RUNPOD_HOST="root@69.30.85.228"
RUNPOD_PORT="22192"
LOCAL_DATASET_DIR="${LOCAL_DATASET_DIR:-$(dirname $0)/../../premium-designs/images}"
REMOTE_WORKSPACE="/workspace"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     KripTik Enhanced FLUX UI-LoRA Training                      ║${NC}"
echo -e "${GREEN}║     Rank: 128 | Steps: 8000 | Trigger: kriptik_ui              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to run SSH command
ssh_run() {
    ssh -i "$RUNPOD_SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 -p "$RUNPOD_PORT" "$RUNPOD_HOST" "$@"
}

# Function to copy files
scp_upload() {
    scp -i "$RUNPOD_SSH_KEY" -o StrictHostKeyChecking=no -P "$RUNPOD_PORT" -r "$1" "$RUNPOD_HOST:$2"
}

# Check if premium dataset exists locally
check_dataset() {
    echo -e "${YELLOW}[1/6] Checking premium dataset...${NC}"

    if [ -d "$LOCAL_DATASET_DIR" ]; then
        IMAGE_COUNT=$(find "$LOCAL_DATASET_DIR" -name "*.png" -o -name "*.jpg" | wc -l)
        echo "  Found $IMAGE_COUNT images in local dataset"

        if [ "$IMAGE_COUNT" -lt 100 ]; then
            echo -e "${RED}  WARNING: Only $IMAGE_COUNT images found. Run premium capture first!${NC}"
            echo "  Run: cd training/premium-data-capture && ./run-capture.sh"
            exit 1
        fi
    else
        echo -e "${RED}  ERROR: Premium dataset directory not found${NC}"
        echo "  Expected: $LOCAL_DATASET_DIR"
        echo "  Run premium capture first: cd training/premium-data-capture && ./run-capture.sh"
        exit 1
    fi
}

# Check SSH connection
check_connection() {
    echo -e "${YELLOW}[2/6] Testing SSH connection to RunPod...${NC}"

    if ssh_run "echo 'Connection successful'" 2>/dev/null; then
        echo -e "  ${GREEN}Connected to RunPod${NC}"
    else
        echo -e "${RED}  ERROR: Cannot connect to RunPod${NC}"
        echo "  Check that pod hyhfzehdzkcqki is running"
        exit 1
    fi
}

# Check GPU status
check_gpu() {
    echo -e "${YELLOW}[3/6] Checking GPU status...${NC}"

    GPU_INFO=$(ssh_run "nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader" 2>/dev/null)
    echo "  $GPU_INFO"

    # Check if another training is running
    TRAINING_PROCESS=$(ssh_run "pgrep -f 'ai-toolkit|flux' || true" 2>/dev/null)
    if [ -n "$TRAINING_PROCESS" ]; then
        echo -e "  ${YELLOW}WARNING: Training process already running (PID: $TRAINING_PROCESS)${NC}"
        echo "  Kill existing process? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            ssh_run "pkill -f 'ai-toolkit|flux' || true"
            sleep 2
        else
            exit 1
        fi
    fi
}

# Upload premium dataset
upload_dataset() {
    echo -e "${YELLOW}[4/6] Uploading premium dataset...${NC}"

    # Create remote directories
    ssh_run "mkdir -p $REMOTE_WORKSPACE/enhanced_dataset/images $REMOTE_WORKSPACE/enhanced_dataset/captions"

    # Upload images
    echo "  Uploading images..."
    scp_upload "$LOCAL_DATASET_DIR/*" "$REMOTE_WORKSPACE/enhanced_dataset/images/"

    # Upload captions if they exist
    CAPTION_DIR=$(dirname "$LOCAL_DATASET_DIR")/captions
    if [ -d "$CAPTION_DIR" ]; then
        echo "  Uploading captions..."
        scp_upload "$CAPTION_DIR/*" "$REMOTE_WORKSPACE/enhanced_dataset/captions/"
    fi

    echo -e "  ${GREEN}Dataset uploaded${NC}"
}

# Create enhanced training config
create_config() {
    echo -e "${YELLOW}[5/6] Creating enhanced training config...${NC}"

    ssh_run "cat > $REMOTE_WORKSPACE/enhanced_config.yaml << 'CONFIGEOF'
# KripTik Enhanced FLUX UI-LoRA Training Config
# Upgraded: rank 128, 8000 steps

job: extension
config:
  name: kriptik_enhanced_ui
  process:
    - type: sd_trainer
      training_folder: $REMOTE_WORKSPACE/enhanced_output
      device: cuda:0
      trigger_word: kriptik_ui

      network:
        type: lora
        linear: 128          # Upgraded from 64
        linear_alpha: 128    # Match rank for stable training

      save:
        dtype: float16
        save_every: 1000
        max_step_saves_to_keep: 3

      datasets:
        - folder_path: $REMOTE_WORKSPACE/enhanced_dataset/images
          caption_ext: txt
          caption_dropout_rate: 0.05
          resolution: [1024, 1024]
          batch_size: 1

      train:
        steps: 8000          # Upgraded from 5000
        lr: 8e-5             # Slightly lower for stability with higher rank
        optimizer: adamw8bit
        lr_scheduler: cosine
        gradient_accumulation_steps: 4
        gradient_checkpointing: true
        mixed_precision: bf16
        seed: 42

      model:
        name_or_path: black-forest-labs/FLUX.1-dev
        is_flux: true
        quantize: true

      sample:
        sampler: euler
        steps: 20
        width: 1024
        height: 1024
        cfg_scale: 3.5
        every_n_steps: 1000
        prompts:
          - kriptik_ui, premium SaaS dashboard, dark mode, data visualization, modern 2026 aesthetic
          - kriptik_ui, mobile app onboarding flow, iOS design, glassmorphism, smooth animations
          - kriptik_ui, e-commerce product page, luxury brand, minimalist layout, elegant typography
          - kriptik_ui, fintech app interface, charts and graphs, professional, trustworthy design
CONFIGEOF"

    echo -e "  ${GREEN}Config created${NC}"
}

# Launch training
launch_training() {
    echo -e "${YELLOW}[6/6] Launching enhanced training...${NC}"

    ssh_run "cd $REMOTE_WORKSPACE/ai-toolkit && nohup python run.py $REMOTE_WORKSPACE/enhanced_config.yaml > $REMOTE_WORKSPACE/enhanced_training.log 2>&1 &"

    sleep 3

    # Verify training started
    TRAINING_PID=$(ssh_run "pgrep -f 'enhanced_config.yaml' || true" 2>/dev/null)

    if [ -n "$TRAINING_PID" ]; then
        echo -e "  ${GREEN}Training started successfully (PID: $TRAINING_PID)${NC}"
        echo ""
        echo "  Monitor progress:"
        echo "    ssh -i $RUNPOD_SSH_KEY -p $RUNPOD_PORT $RUNPOD_HOST 'tail -f $REMOTE_WORKSPACE/enhanced_training.log'"
        echo ""
        echo "  Check GPU usage:"
        echo "    ssh -i $RUNPOD_SSH_KEY -p $RUNPOD_PORT $RUNPOD_HOST 'watch -n 5 nvidia-smi'"
    else
        echo -e "${RED}  ERROR: Training failed to start${NC}"
        echo "  Check log:"
        ssh_run "tail -50 $REMOTE_WORKSPACE/enhanced_training.log"
        exit 1
    fi
}

# Main execution
main() {
    check_dataset
    check_connection
    check_gpu
    upload_dataset
    create_config
    launch_training

    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Enhanced training launched! Estimated completion: 4-6 hours${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
}

# Handle --dry-run flag
if [ "$1" == "--dry-run" ]; then
    echo "Dry run mode - showing config only"
    check_connection
    check_gpu
    echo ""
    echo "Would create config with:"
    echo "  - Rank: 128"
    echo "  - Steps: 8000"
    echo "  - Learning rate: 8e-5"
    echo "  - Trigger word: kriptik_ui"
    exit 0
fi

# Run main
main
