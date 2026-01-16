# KripTik AI Flagship Training Module

## Overview

The Flagship Training Module transforms KripTik AI into an NLP-first training platform capable of producing flagship-level AI models across all modalities: LLMs, Image, Video, Audio, and Multimodal models.

Users describe their training goals in natural language, and the system automatically:
1. Parses the intent and determines optimal training approach
2. Generates an implementation plan with approval tiles
3. Orchestrates GPU resources and training environments
4. Executes training with real-time monitoring and budget controls
5. Provides comprehensive model testing and comparison tools

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React/TypeScript)                      │
├─────────────────────────────────────────────────────────────────────┤
│  TrainingPage        │  TrainingImplementationPlan  │  Model Tester  │
│  (NLP Input)         │  (Approval Tiles)            │  (Comparison)  │
│                      │                               │                │
│  TrainingProgress    │  BudgetFreezeOverlay         │  QuickTest     │
│  Enhanced            │                               │  Panel         │
└─────────────────────┬───────────────────────────────┬───────────────┘
                      │                               │
                      ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API LAYER (Express.js)                          │
├─────────────────────────────────────────────────────────────────────┤
│  POST /parse-intent      │  GET/PUT /plans/:id         │            │
│  POST /plans/approve     │  POST /test/deploy          │            │
│  GET /jobs/:id/stream    │  GET /notifications/stream  │            │
└─────────────────────┬───────────────────────────────┬───────────────┘
                      │                               │
                      ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                                   │
├──────────────────┬──────────────────┬──────────────────┬────────────┤
│ Training Intent  │ Implementation   │ Environment      │ Training   │
│ Lock Engine      │ Plan Generator   │ Orchestrator     │ Monitor    │
├──────────────────┼──────────────────┼──────────────────┼────────────┤
│ Method           │ Data             │ Budget           │ Universal  │
│ Recommender      │ Strategist       │ Manager          │ Tester     │
├──────────────────┴──────────────────┴──────────────────┴────────────┤
│ Training Executors: LLM, Image, Video, Audio, Multimodal            │
└─────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GPU PROVIDERS                                   │
├──────────────────┬──────────────────┬──────────────────────────────┤
│    RunPod        │     Modal        │    HuggingFace Inference     │
└──────────────────┴──────────────────┴──────────────────────────────┘
```

## User Flow

### 1. Landing & NLP Input
- User navigates to `/training`
- Enters natural language description of training goal
- Example: "Train a model to generate Suno-quality music with expressive vocals"

### 2. Plan Generation
- System parses intent using Claude Opus 4.5
- Identifies: capability, quality tier, data strategy, base models, training methods
- Creates training contract with locked parameters

### 3. Plan Review
- User sees implementation plan with approval tiles:
  - **Model Tile**: Base model selection with alternatives
  - **Method Tile**: Training method (LoRA, DPO, RLHF, etc.)
  - **Data Tile**: Dataset configuration and sources
  - **GPU Tile**: GPU type and count recommendations
  - **Budget Tile**: Cost estimates and authorization

### 4. Environment Setup
- On approval, system provisions GPU resources
- Sets up training environment (Docker, dependencies)
- Loads model and datasets

### 5. Training Execution
- Real-time progress with metrics:
  - Loss curves, learning rate
  - GPU utilization, memory
  - ETA, cost tracking
- Automatic checkpointing
- Budget freeze/resume capability

### 6. Testing & Deployment
- Side-by-side comparison: pretrained vs finetuned
- Multi-modality testing interface
- Save to KripTik, HuggingFace Hub, or download
- One-click deployment to RunPod/Modal

## API Reference

### Intent Parsing
```
POST /api/training/parse-intent
Body: { prompt: string }
Response: { contract: TrainingContract, plan: TrainingImplementationPlan }
```

### Plan Management
```
GET /api/training/plans/:planId
PUT /api/training/plans/:planId/tiles/:tileId
POST /api/training/plans/:planId/approve
```

### Training Jobs
```
GET /api/training/jobs
POST /api/training/jobs
GET /api/training/jobs/:jobId
GET /api/training/jobs/:jobId/stream (SSE)
POST /api/training/jobs/:jobId/pause
POST /api/training/jobs/:jobId/resume
```

### Model Testing
```
POST /api/training/test/deploy
POST /api/training/test/run
POST /api/training/test/compare
GET /api/training/test/sessions/:id
DELETE /api/training/test/sessions/:id
```

### Notifications
```
GET /api/training/notifications/stream (SSE)
GET /api/training/notifications/preferences
PUT /api/training/notifications/preferences
```

## Training Methods Supported

| Method | Modality | Description | Use Case |
|--------|----------|-------------|----------|
| QLoRA | LLM | Quantized LoRA | Quick fine-tuning, low VRAM |
| LoRA | All | Low-Rank Adaptation | Balanced quality/cost |
| Full Fine-tune | LLM | Full parameter training | Maximum quality |
| DPO | LLM | Direct Preference Optimization | Alignment training |
| RLHF | LLM | Reinforcement Learning | Complex behaviors |
| DreamBooth | Image | Subject-driven generation | Custom subjects |
| Textual Inversion | Image | Concept learning | New concepts |
| Voice Clone | Audio | Voice replication | Custom voices |

## GPU Requirements

### Recommended by Modality

| Modality | GPU | VRAM | Use Case |
|----------|-----|------|----------|
| LLM (7B) | A100-40GB | 40GB | QLoRA fine-tuning |
| LLM (70B) | 4x A100-80GB | 320GB | Full fine-tuning |
| Image (SDXL) | RTX 4090 | 24GB | LoRA training |
| Video (Wan2.1) | A100-80GB | 80GB | Video generation |
| Audio (XTTS) | RTX 4090 | 24GB | Voice cloning |
| Flagship | H100 | 80GB | Multi-stage training |

## Cost Estimation

Costs are calculated based on:
- GPU type and hourly rate
- Estimated training duration
- Platform fees (10%)
- Storage costs

### Example Estimates
- Quick LoRA (7B LLM): $15-30
- Full Fine-tune (7B LLM): $100-300
- Image Style Training: $20-50
- Voice Cloning: $10-25
- Flagship Music Model: $500-2000

## Budget Management

### Alert Thresholds
- **80% Alert**: Notification sent, training continues
- **95% Warning**: Urgent notification
- **100% Freeze**: Training paused, checkpoint saved

### Freeze/Resume Flow
1. Training automatically pauses at budget limit
2. User receives notification with resume link
3. User can:
   - Test current checkpoint
   - Adjust budget and resume
   - Download current model
   - Terminate job

### Notification Channels
- In-app notifications
- Email alerts
- SMS for critical events (optional)

## Testing Models

### Comparison Testing
- Deploy both pretrained and finetuned models temporarily
- Send identical inputs to both
- View outputs side-by-side
- Metrics: latency, quality, cost

### Modality-Specific Testing
| Modality | Input | Output |
|----------|-------|--------|
| LLM | Text prompt | Generated text |
| Image | Text + optional image | Generated image |
| Video | Text + optional reference | Generated video |
| Audio | Text + optional voice sample | Generated audio |
| Code | Code context | Completed code |

## Troubleshooting

### Common Issues

**Training won't start**
- Check GPU availability in your region
- Verify credentials in Credential Vault
- Ensure sufficient credits/budget

**High loss values**
- Reduce learning rate
- Increase warmup steps
- Check dataset quality

**Out of memory**
- Enable gradient checkpointing
- Reduce batch size
- Use QLoRA instead of LoRA

**Budget exceeded too fast**
- Reduce epochs
- Use smaller batch size
- Choose more efficient GPU

**Model not improving**
- Check dataset diversity
- Increase training data
- Adjust hyperparameters

### Logs & Debugging
- Real-time logs in training progress view
- Detailed metrics in dashboard
- Checkpoint inspection available

## Integration Points

### Credential Vault
- RunPod API key
- Modal API key
- HuggingFace token

### Existing Services
- Notification service for alerts
- Billing service for cost tracking
- Cloud providers for GPU provisioning

### HuggingFace Hub
- Model discovery and search
- Auto-save trained models
- Dataset sourcing

---

*Last Updated: January 16, 2026*
*Version: 1.0.0*
