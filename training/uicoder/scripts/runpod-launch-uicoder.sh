#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# KRIPTIK UICODER: PRODUCTION TRAINING LAUNCH SCRIPT
# ═══════════════════════════════════════════════════════════════════════════════
#
# Launches UICoder training on RunPod with:
# - DeepSeek-Coder-V2 16B base model (90.2% HumanEval)
# - Three-stage training: SFT → DPO → Validation
# - Automated feedback loop
#
# Requirements:
# - RunPod API key
# - A100 40GB GPU pod
# - Paired dataset uploaded to volume
#
# Usage:
#   ./runpod-launch-uicoder.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
RUNPOD_API_KEY="${RUNPOD_API_KEY:?RUNPOD_API_KEY environment variable must be set}"
POD_NAME="kriptik-uicoder-training"
GPU_TYPE="NVIDIA A100 40GB"
IMAGE="runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04"
VOLUME_SIZE=100

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  KripTik UICoder Production Training"
echo "  Base Model: DeepSeek-Coder-V2 (90.2% HumanEval)"
echo "  Training: SFT + DPO + Automated Validation"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Check for existing pods
echo "📊 Checking existing pods..."
EXISTING_PODS=$(curl -s "https://api.runpod.io/graphql?api_key=${RUNPOD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { myself { pods { id name } } }"}' | \
  python3 -c "import sys,json; pods=json.load(sys.stdin).get('data',{}).get('myself',{}).get('pods',[]); print('\n'.join([f\"{p['id']}: {p['name']}\" for p in pods]))")

if [ -n "$EXISTING_PODS" ]; then
  echo "Existing pods:"
  echo "$EXISTING_PODS"
  echo ""
fi

# Function to create pod
create_pod() {
  echo "🚀 Creating new A100 40GB pod for UICoder training..."

  # Get available A100 40GB GPU
  AVAILABLE_GPU=$(curl -s "https://api.runpod.io/graphql?api_key=${RUNPOD_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"query":"query { gpuTypes { id displayName memoryInGb } }"}' | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
gpus = data.get('data', {}).get('gpuTypes', [])
a100 = next((g for g in gpus if 'A100' in g.get('displayName', '') and g.get('memoryInGb', 0) >= 40), None)
if a100:
    print(a100['id'])
else:
    # Fallback to any available high-memory GPU
    high_mem = next((g for g in gpus if g.get('memoryInGb', 0) >= 40), None)
    print(high_mem['id'] if high_mem else '')
")

  if [ -z "$AVAILABLE_GPU" ]; then
    echo "❌ No A100 40GB or equivalent GPU available"
    echo "   Please check RunPod dashboard for availability"
    exit 1
  fi

  echo "   Using GPU: $AVAILABLE_GPU"

  # Create pod
  POD_RESPONSE=$(curl -s "https://api.runpod.io/graphql?api_key=${RUNPOD_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"mutation { podFindAndDeployOnDemand(input: { name: \\\"${POD_NAME}\\\", imageName: \\\"${IMAGE}\\\", gpuTypeId: \\\"${AVAILABLE_GPU}\\\", volumeInGb: ${VOLUME_SIZE}, containerDiskInGb: 50, minVcpuCount: 8, minMemoryInGb: 64, ports: \\\"22/tcp,8888/http,6006/http\\\", supportPublicIp: true }) { id name machine { gpuDisplayName } } }\"}")

  POD_ID=$(echo "$POD_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('podFindAndDeployOnDemand',{}).get('id',''))")

  if [ -z "$POD_ID" ]; then
    echo "❌ Failed to create pod"
    echo "$POD_RESPONSE"
    exit 1
  fi

  echo "   ✅ Pod created: $POD_ID"
  echo "$POD_ID"
}

# Function to wait for pod to be ready
wait_for_pod() {
  local POD_ID=$1
  echo "⏳ Waiting for pod to be ready..."

  for i in {1..60}; do
    STATUS=$(curl -s "https://api.runpod.io/graphql?api_key=${RUNPOD_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"query\":\"query { pod(input: {podId: \\\"${POD_ID}\\\"}) { runtime { uptimeInSeconds } } }\"}" | \
      python3 -c "import sys,json; r=json.load(sys.stdin).get('data',{}).get('pod',{}).get('runtime'); print('ready' if r else 'waiting')")

    if [ "$STATUS" = "ready" ]; then
      echo "   ✅ Pod is ready!"
      return 0
    fi

    echo "   Waiting... ($i/60)"
    sleep 10
  done

  echo "❌ Pod failed to start within 10 minutes"
  exit 1
}

# Function to get SSH info
get_ssh_info() {
  local POD_ID=$1

  SSH_INFO=$(curl -s "https://api.runpod.io/graphql?api_key=${RUNPOD_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"query { pod(input: {podId: \\\"${POD_ID}\\\"}) { runtime { ports { ip publicPort privatePort type } } } }\"}" | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
ports = data.get('data', {}).get('pod', {}).get('runtime', {}).get('ports', [])
ssh_port = next((p for p in ports if p.get('privatePort') == 22 and p.get('type') == 'tcp'), None)
if ssh_port:
    print(f\"{ssh_port['ip']}:{ssh_port['publicPort']}\")
")

  echo "$SSH_INFO"
}

# Function to setup training environment
setup_training() {
  local SSH_HOST=$1
  local SSH_PORT=$2

  echo "📦 Setting up training environment..."

  # Install dependencies
  ssh root@${SSH_HOST} -p ${SSH_PORT} -o StrictHostKeyChecking=no << 'SETUP_EOF'
#!/bin/bash
set -e

cd /workspace

echo "Installing Python dependencies..."
pip install -q transformers>=4.40.0 peft>=0.10.0 accelerate>=0.29.0 \
  bitsandbytes>=0.43.0 datasets>=2.18.0 trl>=0.8.0 \
  tensorboard scipy einops flash-attn

echo "Downloading DeepSeek-Coder-V2..."
python3 -c "
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id='deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct',
    local_dir='/workspace/models/deepseek-coder-v2',
    ignore_patterns=['*.bin', '*.h5'],
)
print('Model downloaded!')
"

# Create directory structure
mkdir -p /workspace/uicoder
mkdir -p /workspace/uicoder_output

echo "✅ Environment ready!"
SETUP_EOF

  echo "   ✅ Training environment configured"
}

# Function to upload training script and data
upload_training_files() {
  local SSH_HOST=$1
  local SSH_PORT=$2
  local SCRIPT_DIR=$(dirname "$0")

  echo "📤 Uploading training files..."

  # Upload training script
  scp -P ${SSH_PORT} -o StrictHostKeyChecking=no \
    "${SCRIPT_DIR}/train-deepseek-coder.py" \
    root@${SSH_HOST}:/workspace/

  # Upload paired dataset if exists
  if [ -f "${SCRIPT_DIR}/../training-data.jsonl" ]; then
    scp -P ${SSH_PORT} -o StrictHostKeyChecking=no \
      "${SCRIPT_DIR}/../training-data.jsonl" \
      root@${SSH_HOST}:/workspace/uicoder/
    echo "   ✅ Dataset uploaded"
  else
    echo "   ⚠️  No training-data.jsonl found - you'll need to upload this manually"
  fi

  echo "   ✅ Training files uploaded"
}

# Function to start training
start_training() {
  local SSH_HOST=$1
  local SSH_PORT=$2

  echo "🏋️ Starting UICoder training..."

  ssh root@${SSH_HOST} -p ${SSH_PORT} -o StrictHostKeyChecking=no << 'TRAIN_EOF'
#!/bin/bash
set -e

cd /workspace

# Start TensorBoard
tensorboard --logdir=/workspace/uicoder_output --port=6006 --bind_all &

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  STARTING UICODER TRAINING"
echo "  Base Model: DeepSeek-Coder-V2 (90.2% HumanEval)"
echo "  Training: SFT + DPO + Validation"
echo "═══════════════════════════════════════════════════════════════════════════════"

# Check for dataset
if [ ! -f "/workspace/uicoder/training-data.jsonl" ]; then
  echo "⚠️  Dataset not found at /workspace/uicoder/training-data.jsonl"
  echo "Please upload the paired dataset first:"
  echo "  scp training-data.jsonl root@HOST:/workspace/uicoder/"
  exit 1
fi

EXAMPLES=$(wc -l < /workspace/uicoder/training-data.jsonl)
echo "Dataset: $EXAMPLES training examples"

# Run training
nohup python /workspace/train-deepseek-coder.py --stage all \
  > /workspace/uicoder_training.log 2>&1 &

echo ""
echo "Training started in background!"
echo ""
echo "Monitor with:"
echo "  tail -f /workspace/uicoder_training.log"
echo ""
echo "TensorBoard:"
echo "  http://YOUR_POD_IP:6006"
echo ""
TRAIN_EOF

  echo "   ✅ Training started!"
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
read -p "Create new UICoder training pod? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  POD_ID=$(create_pod)
  wait_for_pod "$POD_ID"

  SSH_INFO=$(get_ssh_info "$POD_ID")
  SSH_HOST=$(echo "$SSH_INFO" | cut -d: -f1)
  SSH_PORT=$(echo "$SSH_INFO" | cut -d: -f2)

  echo ""
  echo "SSH Connection: ssh root@${SSH_HOST} -p ${SSH_PORT}"
  echo ""

  setup_training "$SSH_HOST" "$SSH_PORT"
  upload_training_files "$SSH_HOST" "$SSH_PORT"
  start_training "$SSH_HOST" "$SSH_PORT"

  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo "  UICODER TRAINING LAUNCHED!"
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo ""
  echo "Pod ID: $POD_ID"
  echo "SSH: ssh root@${SSH_HOST} -p ${SSH_PORT}"
  echo ""
  echo "Monitor training:"
  echo "  ssh root@${SSH_HOST} -p ${SSH_PORT} 'tail -f /workspace/uicoder_training.log'"
  echo ""
  echo "Download model when complete:"
  echo "  scp -P ${SSH_PORT} root@${SSH_HOST}:/workspace/uicoder_output/dpo/final/*.safetensors ./"
  echo ""
else
  echo "Aborted."
fi
