# KripTik UI Generator - RunPod Serverless Worker

Self-hosted UI mockup generation using FLUX.2-dev + custom UI-Design-LoRA.
Deployed on RunPod Serverless for unlimited auto-scaling.

## Architecture

```
Request → RunPod Serverless → ComfyUI Worker → FLUX.2-dev + UI-LoRA → UI Mockup
```

## Prerequisites

1. Docker installed locally (for building)
2. RunPod account with API key
3. Docker Hub account (or other container registry)
4. Trained UI-Design-LoRA model (see `training/ui-lora/`)

## Setup

### 1. Train the UI-Design-LoRA (if not done)

```bash
# Prepare training dataset
npx ts-node training/ui-lora/prepare-dataset.ts

# Train on RunPod GPU Pod (recommended: RTX 4090 or A100)
# Use SimpleTuner with training/ui-lora/config.yaml
```

### 2. Add Trained LoRA to Docker Image

```bash
# Copy trained LoRA to docker build context
cp /path/to/trained/ui-design-lora.safetensors \
   docker/ui-generator/models/ui-design-lora.safetensors
```

### 3. Build Docker Image

```bash
cd docker/ui-generator
docker build -t your-registry/kriptik-ui-generator:latest .
```

### 4. Push to Container Registry

```bash
docker push your-registry/kriptik-ui-generator:latest
```

### 5. Deploy to RunPod Serverless

1. Go to RunPod Console → Serverless
2. Create new endpoint
3. Select your pushed Docker image
4. Configure:
   - GPU: RTX 4090 (recommended) or A100
   - Min Workers: 0 (scale to zero when idle)
   - Max Workers: 50 (adjust based on expected load)
   - Idle Timeout: 30 seconds
5. Copy the endpoint ID and add to your `.env`:

```env
RUNPOD_UI_GENERATOR_ENDPOINT=your-endpoint-id
RUNPOD_API_KEY=your-api-key
```

## API Usage

### Generate UI Mockup

```bash
curl -X POST "https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync" \
  -H "Authorization: Bearer ${RUNPOD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "prompt": "kriptik_ui, mobile app login screen with email and password fields, sign in button, forgot password link, clean modern dark theme",
      "width": 430,
      "height": 932,
      "steps": 8,
      "cfg_scale": 3.5,
      "lora_strength": 0.85
    }
  }'
```

### Response

```json
{
  "output": {
    "images": ["base64_encoded_image..."],
    "seeds": [12345],
    "inference_time": 15.3,
    "prompt": "kriptik_ui, mobile app login screen...",
    "parameters": {
      "width": 430,
      "height": 932,
      "steps": 8,
      "cfg_scale": 3.5,
      "lora_strength": 0.85
    }
  }
}
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | required | UI description (auto-prepends `kriptik_ui` if missing) |
| `negative_prompt` | string | "blurry, low quality..." | What to avoid |
| `width` | int | 1024 | Output width (430 for mobile) |
| `height` | int | 1024 | Output height (932 for mobile) |
| `steps` | int | 8 | Inference steps (FLUX turbo) |
| `cfg_scale` | float | 3.5 | Guidance scale |
| `lora_strength` | float | 0.85 | UI-LoRA influence (0.0-1.0) |
| `seed` | int | -1 | Random seed (-1 for random) |
| `batch_size` | int | 1 | Number of images to generate |

## Workflows

- `ui-generation.json` - Standard 1024x1024 (web/tablet)
- `ui-generation-mobile.json` - 430x932 (iPhone 14 Pro aspect)

## Cost Estimates

| GPU | $/second | Time/Image | $/Image |
|-----|----------|------------|---------|
| RTX 4090 | $0.00031 | ~15s warm | ~$0.005 |
| A100 40GB | $0.00076 | ~10s warm | ~$0.008 |
| Cold start | - | +30-50s | - |

For viral traffic (10,000 images/day): ~$50-80/day

## Troubleshooting

### Cold starts are slow
- Set `min_workers: 1` to keep one worker warm
- Trade-off: ~$26/day for instant response

### Out of VRAM
- Reduce `batch_size` to 1
- Use A100 for larger batches

### LoRA not loading
- Verify path: `/comfyui/models/loras/ui-design/ui-design-lora.safetensors`
- Check LoRA format is `.safetensors`

### Poor text rendering
- FLUX is already best for text
- Increase `steps` to 12-20 for clearer text
- Try higher `cfg_scale` (4.0-5.0)
