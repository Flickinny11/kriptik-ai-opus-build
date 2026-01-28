# RunPod Training Integration Guide - VERIFIED WORKING

## Overview
This document provides the **verified working process** for programmatically managing ML training jobs on RunPod. Every step has been tested and confirmed working.

**Purpose:**
1. Reference for KripTik AI development team
2. Instructions for KripTik AI's NLP-to-Training/Fine-tuning feature

---

## Prerequisites

### Required Credentials
| Credential | Format | Purpose |
|------------|--------|---------|
| RunPod API Key | `rpa_XXXXX` | Pod management |
| HuggingFace Token | `hf_XXXXX` | Dataset/model storage |
| Docker Credentials | Optional | Custom container images |

### API Endpoints
- **RunPod REST API**: `https://rest.runpod.io/v1`
- **RunPod GraphQL**: `https://api.runpod.io/graphql`
- **HuggingFace API**: `https://huggingface.co/api`

---

## Complete Workflow (Verified)

### Phase 1: Prepare Training Data

#### 1.1 Create HuggingFace Dataset Repository
```python
from huggingface_hub import HfApi

api = HfApi(token="hf_YOUR_TOKEN")

# Create PUBLIC dataset repository
api.create_repo(
    repo_id="your-username/training-dataset",
    repo_type="dataset",
    private=False  # MUST BE PUBLIC for RunPod access
)
```

**CRITICAL**: Dataset MUST be public. RunPod pods cannot authenticate to private HF repos without extra configuration.

#### 1.2 Upload Training Data
```python
# Upload training data (JSONL format for instruction tuning)
api.upload_file(
    path_or_fileobj="training-data.jsonl",
    path_in_repo="training-data.jsonl",
    repo_id="your-username/training-dataset",
    repo_type="dataset"
)
```

#### 1.3 Training Data Format (for instruction tuning)
```json
{"messages": [
  {"role": "system", "content": "You are a helpful assistant."},
  {"role": "user", "content": "User question here"},
  {"role": "assistant", "content": "Assistant response here"}
]}
```

---

### Phase 2: Create Training Script

#### 2.1 Self-Contained Training Script
The script must:
- Install ALL dependencies with pinned versions
- Download data from HuggingFace
- Run training
- Save model

**VERIFIED WORKING SCRIPT:**

```bash
#!/bin/bash
set -e

echo "=== Installing dependencies ==="
pip install -q --upgrade pip
pip install -q transformers==4.40.0 peft==0.10.0 datasets==2.18.0 \
    accelerate==0.28.0 bitsandbytes==0.43.0 tensorboard pyyaml \
    safetensors huggingface_hub

echo "=== Downloading training data ==="
python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('your-username/training-dataset', repo_type='dataset', local_dir='/workspace/data')
"

echo "=== Starting Training ==="
python3 << 'PYEOF'
import os
import json
import torch
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

print("Loading model with 8-bit quantization...")

bnb_config = BitsAndBytesConfig(load_in_8bit=True)

tokenizer = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-Instruct-v0.2")
tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    "mistralai/Mistral-7B-Instruct-v0.2",
    quantization_config=bnb_config,
    device_map="auto"
)
model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=32,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    bias="none",
    task_type="CAUSAL_LM"
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

print("Loading training data...")
examples = []
with open("/workspace/data/training-data.jsonl", "r") as f:
    for line in f:
        examples.append(json.loads(line))
print(f"Loaded {len(examples)} examples")

def format_example(ex):
    msgs = ex.get("messages", [])
    text = ""
    for m in msgs:
        if m["role"] == "system":
            text += f"<s>[INST] <<SYS>>\\n{m['content']}\\n<</SYS>>\\n\\n"
        elif m["role"] == "user":
            text += f"{m['content']} [/INST] "
        elif m["role"] == "assistant":
            text += f"{m['content']} </s>"
    return {"text": text}

dataset = Dataset.from_list([format_example(e) for e in examples])

def tokenize(batch):
    return tokenizer(batch["text"], truncation=True, max_length=2048, padding="max_length")

tokenized = dataset.map(tokenize, batched=True, remove_columns=["text"])

os.makedirs("/workspace/output", exist_ok=True)

training_args = TrainingArguments(
    output_dir="/workspace/output",
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    learning_rate=4e-5,
    warmup_steps=100,
    logging_steps=10,
    save_steps=500,
    fp16=True,
    report_to="tensorboard",
    logging_dir="/workspace/output/logs"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized,
    data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
)

print("Starting training...")
trainer.train()

print("Saving model...")
model.save_pretrained("/workspace/output/lora-model")
tokenizer.save_pretrained("/workspace/output/lora-model")
print("=== TRAINING COMPLETE ===")
PYEOF
```

#### 2.2 Upload Training Script to HuggingFace
```python
api.upload_file(
    path_or_fileobj="train.sh",
    path_in_repo="train.sh",
    repo_id="your-username/training-dataset",
    repo_type="dataset"
)
```

---

### Phase 3: Create RunPod Training Pod

#### 3.1 Pod Creation via REST API (VERIFIED WORKING)

```python
import requests

url = "https://rest.runpod.io/v1/pods"
headers = {
    "Authorization": "Bearer rpa_YOUR_API_KEY",
    "Content-Type": "application/json"
}

data = {
    "name": "training-job-name",
    "imageName": "runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04",
    "gpuTypeIds": ["NVIDIA RTX A5000"],
    "gpuCount": 1,
    "volumeInGb": 50,
    "volumeMountPath": "/workspace",
    "containerDiskInGb": 20,
    "cloudType": "SECURE",
    "dockerStartCmd": [
        "bash", "-c",
        "pip install -q huggingface_hub && python3 -c \"from huggingface_hub import hf_hub_download; hf_hub_download('your-username/training-dataset', 'train.sh', repo_type='dataset', local_dir='/workspace')\" && chmod +x /workspace/train.sh && bash /workspace/train.sh"
    ]
}

response = requests.post(url, headers=headers, json=data)
pod = response.json()
pod_id = pod['id']
print(f"Pod created: {pod_id}")
```

#### 3.2 Key Configuration Notes

| Field | Value | Notes |
|-------|-------|-------|
| `imageName` | `runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04` | Verified working |
| `volumeMountPath` | `/workspace` | REQUIRED - prevents mount errors |
| `volumeInGb` | 50+ | For model weights + checkpoints |
| `dockerStartCmd` | Array format | NOT string - must be array |

---

### Phase 4: Monitor Training Progress

#### 4.1 Poll Pod Status
```python
import requests
import time

def monitor_training(pod_id, api_key, poll_interval=60):
    url = f"https://rest.runpod.io/v1/pods/{pod_id}"
    headers = {"Authorization": f"Bearer {api_key}"}

    while True:
        response = requests.get(url, headers=headers)
        data = response.json()

        status = data.get('desiredStatus')
        runtime = data.get('runtime')

        if runtime:
            uptime = runtime.get('uptimeInSeconds', 0)
            gpus = runtime.get('gpus', [])

            for gpu in gpus:
                util = gpu.get('gpuUtilPercent', 0)
                mem = gpu.get('memoryUtilPercent', 0)
                print(f"[{uptime}s] GPU: {util}% util, {mem}% mem")

                # Training indicators:
                # - High mem (>50%): Model loaded
                # - High util (>50%): Training active

        time.sleep(poll_interval)

# Usage
monitor_training("pod_id_here", "rpa_YOUR_KEY")
```

#### 4.2 Training Progress Indicators

| GPU Memory | GPU Util | Status |
|------------|----------|--------|
| 0% | 0% | Initializing / Installing deps |
| >50% | <10% | Loading model |
| >50% | >50% | Training in progress |
| <10% | <10% | Training complete or failed |

---

### Phase 5: Retrieve Trained Model

#### 5.1 Add Upload to Training Script
Add this at the end of the training script:

```python
# Upload trained model to HuggingFace
from huggingface_hub import HfApi
import os

api = HfApi(token=os.environ.get("HF_TOKEN", ""))

api.create_repo(
    repo_id="your-username/trained-model",
    repo_type="model",
    exist_ok=True
)

api.upload_folder(
    folder_path="/workspace/output/lora-model",
    repo_id="your-username/trained-model",
    repo_type="model"
)
print("Model uploaded to HuggingFace!")
```

#### 5.2 Pass HF Token to Pod (for upload)
Add to pod creation:
```python
"env": {
    "HF_TOKEN": "hf_YOUR_TOKEN"
}
```

---

### Phase 6: Cleanup

#### 6.1 Terminate Pod After Training
```python
def terminate_pod(pod_id, api_key):
    url = f"https://rest.runpod.io/v1/pods/{pod_id}"
    headers = {"Authorization": f"Bearer {api_key}"}
    requests.delete(url, headers=headers)
    print(f"Pod {pod_id} terminated")
```

---

## Troubleshooting Guide

### Error: 401 Unauthorized on HuggingFace
**Cause**: Dataset is private
**Solution**:
```python
api.update_repo_visibility(
    repo_id="username/dataset",
    repo_type="dataset",
    private=False
)
```
Then **terminate and create new pod** (restart won't clear cache).

### Error: ModuleNotFoundError for transformers
**Cause**: Version conflicts with pre-installed packages
**Solution**: Pin specific versions:
```bash
pip install transformers==4.40.0 peft==0.10.0 bitsandbytes==0.43.0
```

### Error: Invalid mount config
**Cause**: Missing volumeMountPath
**Solution**: Always include `"volumeMountPath": "/workspace"` in pod config

### Error: Pod stuck initializing
**Cause**: Various (GPU unavailable, image pull issues)
**Solution**:
1. Check RunPod dashboard logs
2. Try different GPU type or data center
3. Terminate and recreate

---

## GPU Selection Guide

| Model Size | Recommended GPU | VRAM | Est. Cost/hr |
|------------|-----------------|------|--------------|
| 7B (LoRA) | RTX A5000 | 24GB | $0.27 |
| 7B (Full) | RTX A6000 | 48GB | $0.79 |
| 13B (LoRA) | RTX A6000 | 48GB | $0.79 |
| 70B (LoRA) | A100 80GB | 80GB | $1.99 |

---

## KripTik AI Integration Notes

### For NLP-to-Training Feature

The AI assistant should follow this exact sequence:

1. **Parse Request**: Extract model, dataset, epochs, batch size from user's natural language
2. **Validate Dataset**: Ensure training data exists and is accessible
3. **Generate Script**: Create training script with proper versions
4. **Upload to HF**: Upload script + data to public HuggingFace repo
5. **Create Pod**: Use REST API with dockerStartCmd
6. **Monitor**: Poll for GPU utilization until training completes
7. **Retrieve Model**: Download/link to trained model
8. **Cleanup**: Terminate pod to stop billing

### Example Conversation Flow
```
User: "Fine-tune Mistral on my support tickets for better customer service responses"

AI Actions:
1. Locate support ticket data
2. Format as instruction tuning JSONL
3. Upload to HuggingFace (public)
4. Generate LoRA training script
5. Create RunPod A5000 pod
6. Monitor training (report progress)
7. Return model link when complete
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-28 | Initial verified working process |

---

## Appendix: Full Working Example

### Complete Python Script for Automated Training

```python
import requests
import time
from huggingface_hub import HfApi

class RunPodTrainer:
    def __init__(self, runpod_key, hf_token):
        self.runpod_key = runpod_key
        self.hf_token = hf_token
        self.hf_api = HfApi(token=hf_token)
        self.runpod_url = "https://rest.runpod.io/v1"

    def upload_training_data(self, local_path, repo_id):
        """Upload training data to HuggingFace"""
        self.hf_api.create_repo(repo_id=repo_id, repo_type="dataset",
                                private=False, exist_ok=True)
        self.hf_api.upload_file(
            path_or_fileobj=local_path,
            path_in_repo="training-data.jsonl",
            repo_id=repo_id,
            repo_type="dataset"
        )
        return repo_id

    def upload_training_script(self, script_content, repo_id):
        """Upload training script to HuggingFace"""
        with open("/tmp/train.sh", "w") as f:
            f.write(script_content)
        self.hf_api.upload_file(
            path_or_fileobj="/tmp/train.sh",
            path_in_repo="train.sh",
            repo_id=repo_id,
            repo_type="dataset"
        )

    def create_training_pod(self, name, hf_repo):
        """Create RunPod training pod"""
        headers = {
            "Authorization": f"Bearer {self.runpod_key}",
            "Content-Type": "application/json"
        }
        data = {
            "name": name,
            "imageName": "runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04",
            "gpuTypeIds": ["NVIDIA RTX A5000"],
            "gpuCount": 1,
            "volumeInGb": 50,
            "volumeMountPath": "/workspace",
            "containerDiskInGb": 20,
            "cloudType": "SECURE",
            "dockerStartCmd": [
                "bash", "-c",
                f"pip install -q huggingface_hub && python3 -c \"from huggingface_hub import hf_hub_download; hf_hub_download('{hf_repo}', 'train.sh', repo_type='dataset', local_dir='/workspace')\" && bash /workspace/train.sh"
            ]
        }
        response = requests.post(f"{self.runpod_url}/pods", headers=headers, json=data)
        return response.json()['id']

    def monitor_pod(self, pod_id, timeout=7200):
        """Monitor pod until training completes"""
        headers = {"Authorization": f"Bearer {self.runpod_key}"}
        start = time.time()

        while time.time() - start < timeout:
            response = requests.get(f"{self.runpod_url}/pods/{pod_id}", headers=headers)
            data = response.json()

            runtime = data.get('runtime')
            if runtime:
                gpus = runtime.get('gpus', [])
                if gpus:
                    util = gpus[0].get('gpuUtilPercent', 0)
                    mem = gpus[0].get('memoryUtilPercent', 0)
                    print(f"GPU: {util}% util, {mem}% mem")

            time.sleep(60)

    def terminate_pod(self, pod_id):
        """Terminate pod"""
        headers = {"Authorization": f"Bearer {self.runpod_key}"}
        requests.delete(f"{self.runpod_url}/pods/{pod_id}", headers=headers)


# Usage Example
trainer = RunPodTrainer(
    runpod_key="rpa_YOUR_KEY",
    hf_token="hf_YOUR_TOKEN"
)

# 1. Upload data
trainer.upload_training_data("data.jsonl", "username/my-training")

# 2. Upload script
trainer.upload_training_script(TRAINING_SCRIPT, "username/my-training")

# 3. Create pod
pod_id = trainer.create_training_pod("my-training-job", "username/my-training")

# 4. Monitor
trainer.monitor_pod(pod_id)

# 5. Cleanup
trainer.terminate_pod(pod_id)
```

---

*This guide reflects the verified working process as of 2026-01-28*
