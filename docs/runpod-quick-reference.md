# RunPod Quick Reference - EXACT WORKING COMMANDS

## What We Used (Verified Working)
- **RunPod REST API** via Python `requests` library
- **NOT** the `runpod` Python SDK
- **NOT** the GraphQL API

---

## Step 1: Upload to HuggingFace (PUBLIC dataset)

```python
from huggingface_hub import HfApi

api = HfApi(token="hf_YOUR_TOKEN")

# Create public repo
api.create_repo(
    repo_id="username/dataset-name",
    repo_type="dataset",
    private=False
)

# Upload training data
api.upload_file(
    path_or_fileobj="training-data.jsonl",
    path_in_repo="training-data.jsonl",
    repo_id="username/dataset-name",
    repo_type="dataset"
)

# Upload training script
api.upload_file(
    path_or_fileobj="train.sh",
    path_in_repo="train.sh",
    repo_id="username/dataset-name",
    repo_type="dataset"
)
```

---

## Step 2: Create RunPod Pod

```python
import requests

url = "https://rest.runpod.io/v1/pods"
headers = {
    "Authorization": "Bearer rpa_YOUR_KEY",
    "Content-Type": "application/json"
}

data = {
    "name": "training-job",
    "imageName": "runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04",
    "gpuTypeIds": ["NVIDIA RTX A5000"],
    "gpuCount": 1,
    "volumeInGb": 50,
    "volumeMountPath": "/workspace",
    "containerDiskInGb": 20,
    "cloudType": "SECURE",
    "dockerStartCmd": [
        "bash", "-c",
        "pip install -q huggingface_hub && python3 -c \"from huggingface_hub import hf_hub_download; hf_hub_download('username/dataset-name', 'train.sh', repo_type='dataset', local_dir='/workspace')\" && bash /workspace/train.sh"
    ]
}

response = requests.post(url, headers=headers, json=data)
pod = response.json()
print(f"Pod ID: {pod['id']}")
```

---

## Step 3: Monitor Pod

```python
import requests

pod_id = "YOUR_POD_ID"
url = f"https://rest.runpod.io/v1/pods/{pod_id}"
headers = {"Authorization": "Bearer rpa_YOUR_KEY"}

response = requests.get(url, headers=headers)
data = response.json()
print(data)
```

---

## Step 4: Terminate Pod

```python
import requests

pod_id = "YOUR_POD_ID"
url = f"https://rest.runpod.io/v1/pods/{pod_id}"
headers = {"Authorization": "Bearer rpa_YOUR_KEY"}

requests.delete(url, headers=headers)
```

---

## Critical Learnings

| Issue | Solution |
|-------|----------|
| 401 on HuggingFace | Dataset MUST be public |
| Mount error | Include `volumeMountPath: "/workspace"` |
| Cached 401 after making public | Delete pod, create NEW one (don't restart) |
| Module errors | Pin versions: `transformers==4.40.0 peft==0.10.0 bitsandbytes==0.43.0` |

---

## Current Training Pod
- **Pod ID**: `2drhxfioathq9r`
- **Dataset**: `alledged/kriptik-uicoder-training`
- **Total Steps**: 948
- **Epochs**: 3
- **Examples**: 5,063

---

*Last updated: 2026-01-28*
