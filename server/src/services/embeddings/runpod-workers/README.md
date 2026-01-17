# KripTik AI - RunPod Serverless Embedding Workers

This directory contains the infrastructure for deploying ML embedding models to RunPod Serverless.

## Overview

KripTik AI uses three embedding models deployed as RunPod Serverless endpoints:

| Model | Use Case | Dimensions | Parameters |
|-------|----------|------------|------------|
| **BGE-M3** | Text/Intent embeddings | 1024 | 568M |
| **SigLIP-2** | Visual embeddings | 1152 | 400M |
| **VL-JEPA** | Vision-Language joint understanding | 1024 | 1.6B |

## Quick Start

### Prerequisites

1. RunPod account with API key
2. Docker installed and logged into Docker Hub
3. Node.js 18+

### Step 1: Build and Push Docker Images

```bash
# Set your Docker Hub username
export DOCKER_HUB_USERNAME=kriptikai

# Build and push all images
./build-images.sh

# Or build individual images
./build-images.sh bge-m3
./build-images.sh siglip
./build-images.sh vl-jepa
```

### Step 2: Deploy Endpoints

```bash
# Set your RunPod API key
export RUNPOD_API_KEY=your_api_key

# Run deployment script
npx tsx deploy.ts
```

### Step 3: Configure KripTik AI

Add the endpoint IDs to your `.env` file:

```env
# RunPod Endpoints
RUNPOD_ENDPOINT_BGE_M3=your_bge_m3_endpoint_id
RUNPOD_ENDPOINT_SIGLIP=your_siglip_endpoint_id
RUNPOD_ENDPOINT_VL_JEPA=your_vl_jepa_endpoint_id
```

## Architecture

### Fallback Strategy

Each provider has a built-in fallback to HuggingFace Inference API:

```
Request → RunPod Serverless → Success
                ↓ (failure)
        → HuggingFace API → Success
                ↓ (failure)
        → Error
```

### Cold Starts

RunPod Serverless uses scale-to-zero for cost efficiency:
- **BGE-M3**: ~15s cold start (model cached in container)
- **SigLIP-2**: ~20s cold start
- **VL-JEPA**: ~45s cold start (larger model)

To reduce cold starts:
- Set `workersMin: 1` for high-traffic endpoints
- Use smaller GPU types for faster startup

### GPU Selection

| Model | Recommended GPU | VRAM Required |
|-------|-----------------|---------------|
| BGE-M3 | NVIDIA RTX A4000 | 16GB |
| SigLIP-2 | NVIDIA RTX A4000 | 16GB |
| VL-JEPA | NVIDIA A100 80GB | 40GB+ |

## File Structure

```
runpod-workers/
├── bge-m3/
│   ├── handler.py      # BGE-M3 inference handler
│   └── Dockerfile      # Docker build instructions
├── siglip/
│   ├── handler.py      # SigLIP inference handler
│   └── Dockerfile      # Docker build instructions
├── vl-jepa/
│   ├── handler.py      # VL-JEPA inference handler
│   └── Dockerfile      # Docker build instructions
├── deploy.ts           # Deployment script
├── build-images.sh     # Docker build script
└── README.md           # This file
```

## API Reference

### BGE-M3 Endpoint

**Request:**
```json
{
  "input": {
    "texts": ["text1", "text2"],
    "options": {
      "return_dense": true,
      "return_sparse": false,
      "max_length": 8192
    }
  }
}
```

**Response:**
```json
{
  "embeddings": [[...], [...]],
  "dimensions": 1024,
  "tokens_used": 50,
  "model": "BAAI/bge-m3"
}
```

### SigLIP-2 Endpoint

**Image Request:**
```json
{
  "input": {
    "image": "base64_or_url",
    "type": "image"
  }
}
```

**Text Request:**
```json
{
  "input": {
    "texts": ["description1", "description2"],
    "type": "text"
  }
}
```

**Response:**
```json
{
  "embeddings": [[...]],
  "dimensions": 1152,
  "model": "google/siglip-so400m-patch14-384"
}
```

### VL-JEPA Endpoint

**Intent Understanding:**
```json
{
  "input": {
    "type": "intent",
    "text": "Build a React dashboard with charts",
    "context": "Optional project context"
  }
}
```

**Predictive Mode:**
```json
{
  "input": {
    "type": "predictive",
    "intent": "Add user authentication",
    "patterns": [[...], [...]],
    "context": {}
  }
}
```

**Response:**
```json
{
  "embedding": [...],
  "predictions": {
    "success_probability": 0.85,
    "complexity_score": 0.6,
    "recommended_patterns": [],
    "potential_issues": []
  }
}
```

## Cost Optimization

### Scale-to-Zero Benefits

With `workersMin: 0`, you only pay when processing requests:
- No idle costs
- Automatic scaling based on demand
- ~15-45s cold start penalty

### Billing

RunPod bills per-second GPU usage:
- RTX A4000: ~$0.20/hr
- A100 80GB: ~$1.89/hr

Estimated monthly costs (assuming 10K requests/day):
- BGE-M3: ~$15-30/month
- SigLIP-2: ~$15-30/month
- VL-JEPA: ~$50-100/month

## Troubleshooting

### Endpoint Not Responding

1. Check endpoint status in RunPod dashboard
2. Verify API key is correct
3. Check worker logs for errors

### High Latency

1. Cold starts can cause 15-45s delays
2. Consider setting `workersMin: 1`
3. Use smaller models if latency is critical

### Out of Memory

1. Reduce batch size
2. Upgrade to GPU with more VRAM
3. Enable model quantization

## Development

### Local Testing

```bash
# Test handler locally
cd bge-m3
python handler.py

# Test with sample request
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -d '{"input": {"texts": ["test"]}}'
```

### Adding New Models

1. Create new directory with `handler.py` and `Dockerfile`
2. Add entry to `deploy.ts` ENDPOINTS array
3. Create corresponding provider in `providers/`
4. Update `embedding-service-impl.ts`

## Support

For issues:
- RunPod Documentation: https://docs.runpod.io
- KripTik AI Issues: https://github.com/kriptik-ai/issues
