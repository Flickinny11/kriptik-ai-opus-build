# KripTik AI Flagship Training & Fine-Tuning Implementation Plan

> **Purpose**: Transform KripTik's training module into a flagship-level NLP-to-training platform capable of training Suno-quality music models, Veo-quality video models, and state-of-the-art models across ALL modalities.

> **Execution**: Copy each prompt sequentially into Cursor 2.2 with Claude Opus 4.5. Each prompt is self-contained but builds on previous work.

---

## IMPLEMENTATION OVERVIEW

### Current State
- Frontend: 6-step wizard with LoRA/QLoRA options, HuggingFace model selection
- Backend: Multi-modal orchestrator, 5 modality trainers, RunPod/Modal integration
- Gap: Users manually select training methods; no NLP-driven intent parsing; no flagship-level methods

### Target State
- NLP prompt → Deep Intent parsing → Automatic method selection → Implementation plan with tiles
- Support ALL flagship methods: DoRA, QDoRA, DPO, RLHF, GRPO, MoE, distributed training
- Real-time monitoring, budget management, freeze/resume, before/after comparison
- Test any model type (video, audio, image, text, code, embeddings) within KripTik UI

---

## PHASE 1: TRAINING INTENT LOCK SYSTEM

### Prompt 1.1: Create Training Intent Lock Engine

```
READ FIRST:
- /Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/CLAUDE.md (full file)
- /Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/ai/intent-lock.ts
- /Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/training and fine tuning.md

TASK: Create a new Training Intent Lock Engine that parses NLP prompts for training/fine-tuning requests and generates a "Training Sacred Contract" similar to how BuildLoopOrchestrator creates Intent Contracts.

CREATE: server/src/services/training/training-intent-lock.ts

The TrainingIntentLockEngine should:

1. PARSE NLP PROMPTS for training intent using Opus 4.5 with 64K thinking budget:
   - Detect target capability (music generation, video generation, coding, chat, etc.)
   - Detect quality benchmark (e.g., "Suno-level", "GPT-4-level", "Veo-level")
   - Detect base model requirements (if specified) or infer best base model
   - Detect training data requirements (what data is needed)
   - Detect output format requirements

2. GENERATE TrainingContract with these fields:
   ```typescript
   interface TrainingContract {
     id: string;
     userId: string;

     // Parsed Intent
     targetCapability: TrainingCapability; // 'music_generation' | 'video_generation' | 'image_generation' | 'voice_cloning' | 'text_generation' | 'code_generation' | 'chat' | 'embeddings' | 'multimodal' | 'custom';
     qualityBenchmark: string; // "suno-level", "gpt-4-level", "veo-level", etc.
     benchmarkModel?: string; // Specific model to match (e.g., "suno-v4", "veo-3.1")

     // Base Model Selection
     recommendedBaseModels: BaseModelRecommendation[];
     selectedBaseModel?: string;

     // Training Method Selection (AI-determined, not user-selected)
     recommendedMethods: TrainingMethodRecommendation[];
     selectedMethod?: TrainingMethod;

     // Data Requirements
     dataRequirements: DataRequirement[];
     estimatedDataVolume: string; // "10GB", "100GB", etc.
     dataSourceStrategy: 'user_upload' | 'web_search' | 'huggingface' | 'hybrid';

     // Technical Requirements
     technicalRequirements: TechnicalRequirement[];
     gpuRequirements: GPURequirement;
     estimatedTrainingTime: string;
     estimatedCost: CostEstimate;

     // Success Criteria
     successCriteria: TrainingSuccessCriterion[];
     evaluationStrategy: EvaluationStrategy;

     // Workflow
     implementationPlan: ImplementationStep[];

     // State
     locked: boolean;
     lockedAt?: string;
     thinkingTokensUsed: number;
   }
   ```

3. IMPLEMENT these TrainingCapability mappings:

   | Capability | Recommended Base Models | Recommended Methods | GPU Tier |
   |------------|------------------------|---------------------|----------|
   | music_generation | MusicGen-Large, AudioLDM2, Stable Audio | Full fine-tune + DPO, MoE | H100 cluster |
   | video_generation | Wan 2.2, HunyuanVideo, Open-Sora 2.0 | LoRA + temporal adaptation | A100-80GB x4 |
   | image_generation | FLUX.1-dev, SDXL, SD3.5 | DoRA, DreamBooth | A100-40GB |
   | voice_cloning | XTTS v2, WhisperSpeech, Bark | Full fine-tune, style transfer | A40 |
   | text_generation | Llama 3.3 70B, Qwen 2.5 72B, Mistral Large | QLoRA, DoRA, DPO | A100-80GB x2 |
   | code_generation | DeepSeek-Coder-V3, Qwen2.5-Coder-32B | QLoRA + RLVR | A100-80GB |
   | chat | Llama 3.3 70B Instruct, Qwen 2.5 Chat | DPO, ORPO | A100-40GB |
   | embeddings | E5-mistral-7b, BGE-M3 | Full fine-tune, contrastive | RTX 4090 |
   | multimodal | LLaVA-NeXT, Qwen2-VL | QLoRA + cross-modal alignment | A100-80GB x2 |

4. IMPLEMENT TrainingMethod enum with ALL flagship methods:
   ```typescript
   type TrainingMethod =
     // PEFT Methods
     | 'lora' | 'qlora' | 'dora' | 'qdora' | 'adalora' | 'vera' | 'relora' | 'mora' | 'galore' | 'longlora'
     // Full Training
     | 'full_finetune' | 'full_finetune_fsdp' | 'full_finetune_deepspeed'
     // Alignment Methods
     | 'dpo' | 'orpo' | 'rlhf_ppo' | 'grpo' | 'rlvr' | 'rlaif' | 'constitutional_ai'
     // Distributed
     | 'deepspeed_zero1' | 'deepspeed_zero2' | 'deepspeed_zero3' | 'deepspeed_infinity' | 'fsdp' | 'megatron_lm' | '3d_parallelism'
     // Specialized
     | 'moe_diffusion' | 'dreambooth' | 'textual_inversion' | 'voice_clone' | 'temporal_adaptation'
     // Hybrid
     | 'hybrid_lora_dpo' | 'hybrid_full_rlhf' | 'hybrid_moe_alignment';
   ```

5. IMPLEMENT the contract creation prompt template for Opus 4.5:
   - Include the full training methods reference from training and fine tuning.md
   - Ask the model to reason about which methods would achieve the user's benchmark
   - Consider multi-stage training pipelines for flagship quality
   - Consider multi-model orchestration for complex capabilities

6. INTEGRATE with existing IntentLockEngine patterns but specialized for training

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

### Prompt 1.2: Create Training Method Recommender

```
READ FIRST:
- server/src/services/training/training-intent-lock.ts (just created)
- /Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/training and fine tuning.md
- server/src/services/training/gpu-recommender.ts

TASK: Create a Training Method Recommender service that analyzes parsed training intent and recommends the optimal training method(s) and configuration.

CREATE: server/src/services/training/training-method-recommender.ts

The TrainingMethodRecommender should:

1. IMPLEMENT method selection logic based on:
   - Target capability (music vs video vs text vs code)
   - Quality benchmark (flagship vs standard vs quick)
   - Available GPU budget
   - Training data volume
   - Base model architecture

2. IMPLEMENT flagship-level method chains for complex capabilities:

   ```typescript
   // Example: Suno-level music generation
   const FLAGSHIP_MUSIC_PIPELINE: TrainingPipeline = {
     stages: [
       {
         name: 'Base Model Preparation',
         method: 'full_finetune_deepspeed',
         config: { zeroStage: 3, gradientCheckpointing: true },
         estimatedHours: 48,
       },
       {
         name: 'Style Specialization',
         method: 'lora',
         config: { r: 64, alpha: 128, targetModules: ['attention', 'feedforward'] },
         estimatedHours: 12,
       },
       {
         name: 'Quality Alignment',
         method: 'dpo',
         config: { beta: 0.1, referenceFree: false },
         estimatedHours: 24,
       },
       {
         name: 'Human Preference Tuning',
         method: 'rlhf_ppo',
         config: { rewardModel: 'music-quality-reward-v1', klCoef: 0.1 },
         estimatedHours: 36,
       },
     ],
     totalEstimatedHours: 120,
     requiredGPU: 'H100_CLUSTER_8',
     estimatedCost: { min: 2500, max: 4000, currency: 'USD' },
   };

   // Example: Veo-level video generation
   const FLAGSHIP_VIDEO_PIPELINE: TrainingPipeline = {
     stages: [
       {
         name: 'Temporal Adapter Training',
         method: 'temporal_adaptation',
         config: { frameCount: 120, fps: 24 },
         estimatedHours: 72,
       },
       {
         name: 'MoE Expert Specialization',
         method: 'moe_diffusion',
         config: { numExperts: 8, topK: 2, noiseSpecialization: true },
         estimatedHours: 96,
       },
       {
         name: 'Quality Alignment',
         method: 'dpo',
         config: { beta: 0.05, videoSpecific: true },
         estimatedHours: 48,
       },
     ],
     totalEstimatedHours: 216,
     requiredGPU: 'A100_80GB_CLUSTER_8',
     estimatedCost: { min: 5000, max: 8000, currency: 'USD' },
   };
   ```

3. IMPLEMENT quality tier system:
   ```typescript
   type QualityTier = 'consumer' | 'professional' | 'flagship' | 'research';

   // consumer: LoRA/QLoRA, single GPU, <$100
   // professional: DoRA/full fine-tune, multi-GPU, $100-$1000
   // flagship: Multi-stage pipelines, cluster, $1000-$10000
   // research: Custom architectures, multi-node, $10000+
   ```

4. IMPLEMENT automatic method selection based on user's NLP:
   - If user mentions "Suno-level" or "professional music" → flagship music pipeline
   - If user mentions "quick fine-tune" or "adapter" → LoRA/QLoRA
   - If user mentions "production-ready" → professional tier with DPO alignment
   - If user mentions specific method (rare) → use that method

5. IMPLEMENT cost-quality tradeoff recommendations:
   - Show user 2-3 options at different price points
   - Each with expected quality outcome
   - Let user choose via implementation plan tiles

6. EXPORT recommendTrainingMethod(contract: TrainingContract): TrainingMethodRecommendation[]

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

### Prompt 1.3: Create Training Data Strategist

```
READ FIRST:
- server/src/services/training/training-intent-lock.ts
- server/src/services/training/training-method-recommender.ts
- /Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/training and fine tuning.md

TASK: Create a Training Data Strategist service that determines what training data is needed based on the training intent and helps users acquire it.

CREATE: server/src/services/training/training-data-strategist.ts

The TrainingDataStrategist should:

1. IMPLEMENT data requirement analysis:
   ```typescript
   interface DataRequirement {
     type: 'text' | 'audio' | 'video' | 'image' | 'code' | 'pairs' | 'preferences';
     format: string; // 'jsonl', 'parquet', 'wav', 'mp4', etc.
     minSamples: number;
     recommendedSamples: number;
     flagshipSamples: number; // For flagship-level quality
     qualityRequirements: string[];
     exampleSchema?: object;
   }
   ```

2. IMPLEMENT data source strategies:

   a) **User Upload Strategy**:
      - Accept uploads: audio files, video files, images, text files, JSONL, CSV, Parquet
      - Validate format and quality
      - Estimate if volume is sufficient for target quality

   b) **Web Search Strategy** (for current data):
      - Integrate with WebSearch to find training data sources
      - Search HuggingFace datasets
      - Search academic datasets (arXiv, Papers with Code)
      - Search licensed data providers
      - Return options with licensing info

   c) **Synthetic Data Strategy**:
      - Use existing models to generate training data
      - Especially for preference pairs (DPO/RLHF)
      - Quality filtering with AI judgment

   d) **Hybrid Strategy**:
      - Combine user data + web sources + synthetic
      - Most common for flagship training

3. IMPLEMENT data volume recommendations by capability:
   ```typescript
   const DATA_REQUIREMENTS: Record<TrainingCapability, DataRequirement> = {
     music_generation: {
       type: 'audio',
       format: 'wav/flac',
       minSamples: 1000,
       recommendedSamples: 10000,
       flagshipSamples: 100000,
       qualityRequirements: ['44.1kHz+', 'stereo', 'no clipping', 'genre-labeled'],
     },
     video_generation: {
       type: 'video',
       format: 'mp4/webm',
       minSamples: 500,
       recommendedSamples: 5000,
       flagshipSamples: 50000,
       qualityRequirements: ['720p+', '24fps+', 'no watermarks', 'caption-labeled'],
     },
     voice_cloning: {
       type: 'audio',
       format: 'wav',
       minSamples: 50, // Voice cloning needs less data
       recommendedSamples: 200,
       flagshipSamples: 1000,
       qualityRequirements: ['clean speech', 'single speaker', 'transcribed'],
     },
     // ... other capabilities
   };
   ```

4. IMPLEMENT preference pair generation for alignment methods:
   ```typescript
   interface PreferencePairConfig {
     sourceData: string; // Path to base data
     generationMethod: 'model_comparison' | 'human_annotation' | 'synthetic_ai';
     pairsNeeded: number;
     qualityCriteria: string[];
   }

   async generatePreferencePairs(config: PreferencePairConfig): Promise<PreferencePair[]>
   ```

5. IMPLEMENT data pipeline creation:
   - Create data preprocessing configs
   - Handle format conversion
   - Implement quality filtering
   - Create train/val/test splits
   - Generate data statistics

6. IMPLEMENT real-time data search:
   ```typescript
   async searchTrainingData(query: string, capability: TrainingCapability): Promise<DataSource[]> {
     // Search HuggingFace datasets
     // Search web for licensed datasets
     // Return with licensing info, size, quality metrics
   }
   ```

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 2: TRAINING IMPLEMENTATION PLAN SYSTEM

### Prompt 2.1: Create Training Implementation Plan Generator

```
READ FIRST:
- server/src/services/training/training-intent-lock.ts
- server/src/services/training/training-method-recommender.ts
- server/src/services/training/training-data-strategist.ts
- server/src/services/automation/build-loop.ts (for implementation plan patterns)

TASK: Create a Training Implementation Plan Generator that creates user-facing implementation plans with approval tiles, similar to how Builder View shows implementation plans.

CREATE: server/src/services/training/training-plan-generator.ts

The TrainingPlanGenerator should:

1. GENERATE implementation plans from TrainingContract:
   ```typescript
   interface TrainingImplementationPlan {
     id: string;
     contractId: string;

     // Summary for user
     summary: {
       targetCapability: string;
       qualityBenchmark: string;
       estimatedTime: string;
       estimatedCost: CostRange;
       selectedMethod: string;
       gpuRequirement: string;
     };

     // Approval tiles
     tiles: ImplementationTile[];

     // Detailed steps (hidden by default)
     detailedSteps: ImplementationStep[];

     // User decisions needed
     pendingDecisions: UserDecision[];

     // State
     status: 'draft' | 'pending_approval' | 'approved' | 'modified' | 'rejected';
     userModifications: UserModification[];
   }

   interface ImplementationTile {
     id: string;
     category: 'model' | 'method' | 'data' | 'gpu' | 'config' | 'budget';
     title: string;
     description: string;
     recommendation: string;
     alternatives: Alternative[];
     isRecommended: boolean;
     requiresApproval: boolean;
     status: 'pending' | 'approved' | 'modified' | 'skipped';
     userSelection?: string;
   }
   ```

2. IMPLEMENT tile categories:

   a) **Model Selection Tile**:
      - Shows recommended base model
      - Shows 2-3 alternatives with pros/cons
      - Shows model size, capabilities, license

   b) **Training Method Tile**:
      - Shows recommended method (e.g., "Multi-stage: DoRA → DPO")
      - Explains why this method for their goal
      - Shows alternatives at different price points

   c) **Data Source Tile**:
      - Shows data requirements
      - Options: Upload, HuggingFace, Web Search, Synthetic
      - Shows current data status (uploaded vs needed)

   d) **GPU Configuration Tile**:
      - Shows recommended GPU setup
      - Shows alternatives (faster/cheaper tradeoffs)
      - Shows provider options (RunPod vs Modal)

   e) **Hyperparameter Tile**:
      - Shows recommended config (epochs, batch size, LR, etc.)
      - Advanced users can modify
      - "Use Recommended" default option

   f) **Budget Tile**:
      - Shows estimated cost range
      - Budget limit input
      - Notification preferences (freeze at X%, alert at Y%)
      - Authorization checkbox

3. IMPLEMENT modification handling:
   ```typescript
   async modifyTile(planId: string, tileId: string, modification: {
     type: 'select_alternative' | 'custom_value' | 'nlp_modification';
     value?: string;
     nlpPrompt?: string; // "I want to use a smaller model" → re-analyze
   }): Promise<TrainingImplementationPlan>
   ```

4. IMPLEMENT NLP modification parsing:
   - User can type NLP to modify any tile
   - Parse intent and update relevant tiles
   - Recalculate dependencies (cost, time, GPU)

5. IMPLEMENT plan approval flow:
   ```typescript
   async approvePlan(planId: string, budgetAuthorization: {
     maxBudget: number;
     notifyAt: number; // percentage
     freezeAt: number; // percentage
     notificationChannels: ('email' | 'sms' | 'in_app')[];
   }): Promise<ApprovedTrainingPlan>
   ```

6. GENERATE human-readable plan summary for display

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

### Prompt 2.2: Create Training Plan Frontend Components

```
READ FIRST:
- server/src/services/training/training-plan-generator.ts (just created)
- src/components/training/TrainingWizard.tsx
- src/store/useTrainingStore.ts
- src/components/feature-agent/FeatureAgentTile.tsx (for tile styling reference)

TASK: Create frontend components for the Training Implementation Plan UI. Keep the existing visual style but add the new tile-based approval system.

CREATE/MODIFY these files:

1. CREATE: src/components/training/TrainingIntentInput.tsx
   - Large NLP input box (similar to Builder View prompt box)
   - Placeholder: "Describe what you want to train... e.g., 'Train a model to generate Suno-quality music with expressive vocals'"
   - Submit button triggers intent parsing
   - Loading state while parsing with Opus 4.5

2. CREATE: src/components/training/TrainingImplementationPlan.tsx
   - Displays the implementation plan from backend
   - Grid of ImplementationTile components
   - Summary section at top
   - "Approve & Start Training" button at bottom
   - "Modify with AI" NLP input for changes

3. CREATE: src/components/training/ImplementationTile.tsx
   - Card component for each tile
   - Shows title, description, recommendation
   - Dropdown/radio for alternatives
   - "Recommended" badge on suggested option
   - Status indicator (pending/approved/modified)
   - Matches existing KripTik design (glassmorphism, depth, motion)

4. CREATE: src/components/training/TrainingMethodTile.tsx
   - Specialized tile for training method display
   - Shows multi-stage pipeline visualization if applicable
   - Visual representation of method (LoRA → DPO → RLHF flow)
   - Explains method in user-friendly terms

5. CREATE: src/components/training/DataSourceTile.tsx
   - Specialized tile for data configuration
   - File upload dropzone
   - HuggingFace dataset search
   - Web search trigger
   - Data volume indicator (current vs needed)

6. CREATE: src/components/training/BudgetAuthorizationTile.tsx
   - Budget input with slider
   - Notification threshold inputs
   - Freeze threshold input
   - Notification channel checkboxes (email, SMS, in-app)
   - "Authorize Charges" checkbox with terms

7. CREATE: src/components/training/GPUConfigTile.tsx
   - Visual GPU selection
   - Shows VRAM, speed, cost/hr
   - Provider toggle (RunPod/Modal)
   - Estimated time display

8. MODIFY: src/store/useTrainingStore.ts
   - Add state for implementation plan
   - Add actions for tile modifications
   - Add plan approval state
   - Add NLP modification handling

STYLING REQUIREMENTS:
- Use existing Tailwind classes from TrainingWizard.tsx
- Glassmorphism: bg-white/10 backdrop-blur-xl
- Depth: shadow-lg, shadow-xl
- Motion: Framer Motion for tile interactions
- NO purple-to-pink gradients
- NO emoji
- Premium feel matching existing KripTik design

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

### Prompt 2.3: Create Training Plan API Routes

```
READ FIRST:
- server/src/services/training/training-intent-lock.ts
- server/src/services/training/training-plan-generator.ts
- server/src/routes/training.ts

TASK: Add API routes for the training intent parsing and implementation plan system.

MODIFY: server/src/routes/training.ts

ADD these endpoints:

1. POST /api/training/parse-intent
   ```typescript
   // Request
   {
     prompt: string; // User's NLP describing training goal
     context?: {
       existingModel?: string; // If they have a model in mind
       existingData?: string; // If they've already uploaded data
     };
   }

   // Response
   {
     contract: TrainingContract;
     plan: TrainingImplementationPlan;
   }
   ```

   Implementation:
   - Validate user authentication
   - Call TrainingIntentLockEngine.createContract()
   - Call TrainingMethodRecommender.recommendMethods()
   - Call TrainingDataStrategist.analyzeRequirements()
   - Call TrainingPlanGenerator.generatePlan()
   - Store in database
   - Return contract and plan

2. GET /api/training/plans/:planId
   - Get implementation plan by ID
   - Include all tiles and their status

3. PUT /api/training/plans/:planId/tiles/:tileId
   ```typescript
   // Request
   {
     modification: {
       type: 'select_alternative' | 'custom_value' | 'nlp_modification';
       value?: string;
       nlpPrompt?: string;
     };
   }

   // Response
   {
     plan: TrainingImplementationPlan; // Updated plan
     affectedTiles: string[]; // IDs of tiles that changed due to dependency
   }
   ```

   Implementation:
   - If nlp_modification, re-parse with Opus 4.5
   - Update tile
   - Recalculate dependent tiles (cost, time, GPU)
   - Return updated plan

4. POST /api/training/plans/:planId/approve
   ```typescript
   // Request
   {
     budgetAuthorization: {
       maxBudget: number;
       notifyAtPercent: number;
       freezeAtPercent: number;
       notificationChannels: ('email' | 'sms' | 'in_app')[];
       termsAccepted: boolean;
     };
   }

   // Response
   {
     approvedPlan: ApprovedTrainingPlan;
     jobId: string; // Training job ID (starts setup)
   }
   ```

   Implementation:
   - Validate budget authorization
   - Lock the contract (immutable)
   - Create training job
   - Start environment setup (async)
   - Return job ID for tracking

5. POST /api/training/plans/:planId/modify-with-ai
   ```typescript
   // Request
   {
     nlpModification: string; // "Use a smaller model" or "Make it cheaper"
   }

   // Response
   {
     plan: TrainingImplementationPlan;
     changes: Change[]; // What was changed and why
   }
   ```

6. GET /api/training/search-data
   ```typescript
   // Request (query params)
   {
     query: string;
     capability: TrainingCapability;
     minSamples?: number;
   }

   // Response
   {
     sources: DataSource[];
   }
   ```

   Implementation:
   - Search HuggingFace datasets
   - Search web for datasets (if enabled)
   - Return with licensing, size, quality info

ADD database table for plans:

```typescript
// In schema.ts
export const trainingPlans = sqliteTable('training_plans', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  contractId: text('contract_id').notNull(),
  contract: text('contract').notNull(), // JSON
  plan: text('plan').notNull(), // JSON
  status: text('status').notNull().default('draft'),
  budgetAuthorization: text('budget_authorization'), // JSON
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  approvedAt: text('approved_at'),
});
```

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 3: TRAINING ENVIRONMENT ORCHESTRATOR

### Prompt 3.1: Create Training Environment Orchestrator

```
READ FIRST:
- server/src/services/training/multi-modal-orchestrator.ts
- server/src/services/training/index.ts
- /Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/training and fine tuning.md (distributed training section)

TASK: Create a Training Environment Orchestrator that automatically sets up the complete training environment based on the approved implementation plan.

CREATE: server/src/services/training/training-environment-orchestrator.ts

The TrainingEnvironmentOrchestrator should:

1. IMPLEMENT environment setup pipeline:
   ```typescript
   interface EnvironmentSetup {
     id: string;
     planId: string;

     stages: SetupStage[];
     currentStage: number;

     resources: {
       gpuPods: GPUPod[];
       storage: StorageMount[];
       network: NetworkConfig;
     };

     config: {
       trainingConfig: TrainingConfig;
       dataConfig: DataPipelineConfig;
       monitoringConfig: MonitoringConfig;
     };

     status: 'pending' | 'provisioning' | 'configuring' | 'ready' | 'failed';
     logs: SetupLog[];
   }

   interface SetupStage {
     name: string;
     status: 'pending' | 'running' | 'completed' | 'failed';
     progress: number;
     logs: string[];
   }
   ```

2. IMPLEMENT setup stages:

   a) **GPU Provisioning Stage**:
      - Connect to RunPod/Modal
      - Request GPU pods based on plan
      - Wait for pod availability
      - Return pod IDs and endpoints

   b) **Storage Setup Stage**:
      - Create storage volumes for:
        - Training data
        - Checkpoints
        - Outputs/models
        - Logs
      - Mount volumes to GPU pods

   c) **Training Framework Setup Stage**:
      - Install required packages based on method:
        - PEFT methods: transformers, peft, bitsandbytes
        - Full fine-tune: deepspeed, accelerate
        - Alignment: trl, openrlhf
        - Diffusion: diffusers, safetensors
      - Configure based on GPU count (single vs multi)

   d) **Data Pipeline Setup Stage**:
      - Create data loading scripts
      - Set up preprocessing pipeline
      - Configure data streaming (for large datasets)
      - Validate data format

   e) **Monitoring Setup Stage**:
      - Configure metrics collection
      - Set up SSE streaming endpoint
      - Configure checkpoint saving
      - Set up budget tracking hooks

   f) **Verification Stage**:
      - Run smoke test
      - Verify GPU access
      - Verify data loading
      - Verify checkpoint saving

3. IMPLEMENT distributed training setup for flagship:
   ```typescript
   async setupDistributedEnvironment(config: {
     numNodes: number;
     gpusPerNode: number;
     method: 'deepspeed' | 'fsdp' | 'megatron';
     zeroStage?: 1 | 2 | 3;
   }): Promise<DistributedEnvironment>
   ```

4. IMPLEMENT container image selection:
   ```typescript
   const TRAINING_IMAGES: Record<TrainingMethod, string> = {
     lora: 'kriptik/train-peft:latest',
     qlora: 'kriptik/train-peft-quantized:latest',
     dora: 'kriptik/train-peft:latest',
     full_finetune_deepspeed: 'kriptik/train-deepspeed:latest',
     dpo: 'kriptik/train-alignment:latest',
     rlhf_ppo: 'kriptik/train-rlhf:latest',
     moe_diffusion: 'kriptik/train-diffusion-moe:latest',
     // ... etc
   };
   ```

5. IMPLEMENT configuration generation:
   ```typescript
   async generateTrainingConfig(plan: ApprovedTrainingPlan): Promise<TrainingConfig> {
     // Generate accelerate config
     // Generate deepspeed config
     // Generate training script
     // Generate data config
     // All based on plan selections
   }
   ```

6. IMPLEMENT real-time setup progress streaming:
   ```typescript
   // SSE endpoint for setup progress
   async streamSetupProgress(setupId: string): AsyncGenerator<SetupProgressEvent>
   ```

7. INTEGRATE with existing MultiModalTrainingOrchestrator

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

### Prompt 3.2: Create Flagship Training Executors

```
READ FIRST:
- server/src/services/training/training-environment-orchestrator.ts (just created)
- server/src/services/training/trainers/ (all trainer files)
- /Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/training and fine tuning.md

TASK: Create specialized training executors for flagship-level methods that aren't yet implemented.

CREATE these executor files:

1. CREATE: server/src/services/training/executors/dora-executor.ts
   ```typescript
   // DoRA (Weight-Decomposed Low-Rank Adaptation)
   class DoRAExecutor {
     async execute(config: DoRAConfig): Promise<TrainingResult> {
       // 1. Decompose pretrained weights into magnitude + direction
       // 2. Train LoRA on direction component
       // 3. Train separate magnitude scaling
       // 4. Merge for inference
     }
   }
   ```

2. CREATE: server/src/services/training/executors/dpo-executor.ts
   ```typescript
   // DPO (Direct Preference Optimization)
   class DPOExecutor {
     async execute(config: DPOConfig): Promise<TrainingResult> {
       // 1. Load preference pairs (chosen, rejected)
       // 2. No reward model needed
       // 3. Direct optimization with reference model
       // 4. KL divergence constraint
     }
   }
   ```

3. CREATE: server/src/services/training/executors/rlhf-executor.ts
   ```typescript
   // RLHF with PPO
   class RLHFExecutor {
     async execute(config: RLHFConfig): Promise<TrainingResult> {
       // 1. Train/load reward model
       // 2. Initialize policy from SFT model
       // 3. PPO training loop:
       //    - Generate responses
       //    - Score with reward model
       //    - Update policy with PPO
       //    - KL penalty to reference
     }
   }
   ```

4. CREATE: server/src/services/training/executors/deepspeed-executor.ts
   ```typescript
   // DeepSpeed ZeRO training
   class DeepSpeedExecutor {
     async execute(config: DeepSpeedConfig): Promise<TrainingResult> {
       // 1. Generate ds_config.json based on ZeRO stage
       // 2. Launch with deepspeed launcher
       // 3. Handle multi-node if needed
       // 4. Stream metrics via callback
     }

     generateDeepSpeedConfig(stage: 1 | 2 | 3, modelSize: string): object {
       // ZeRO-1: Optimizer state partitioning
       // ZeRO-2: + Gradient partitioning
       // ZeRO-3: + Parameter partitioning
     }
   }
   ```

5. CREATE: server/src/services/training/executors/moe-diffusion-executor.ts
   ```typescript
   // MoE for Diffusion Models
   class MoEDiffusionExecutor {
     async execute(config: MoEDiffusionConfig): Promise<TrainingResult> {
       // 1. Replace FFN layers with expert modules
       // 2. Train router/gating function
       // 3. Noise-level expert specialization
       // 4. Balance loss to prevent expert collapse
     }
   }
   ```

6. CREATE: server/src/services/training/executors/multi-stage-executor.ts
   ```typescript
   // Multi-stage training pipelines (for flagship quality)
   class MultiStageExecutor {
     async execute(pipeline: TrainingPipeline): Promise<TrainingResult> {
       const results: StageResult[] = [];

       for (const stage of pipeline.stages) {
         // 1. Load checkpoint from previous stage (if any)
         // 2. Get appropriate executor for this stage's method
         // 3. Execute stage
         // 4. Save checkpoint
         // 5. Emit progress

         const executor = this.getExecutor(stage.method);
         const result = await executor.execute({
           ...stage.config,
           checkpoint: results[results.length - 1]?.checkpoint,
         });

         results.push(result);

         // Allow user to pause between stages
         if (stage.requiresApproval) {
           await this.waitForUserApproval(stage);
         }
       }

       return this.mergeResults(results);
     }
   }
   ```

7. CREATE: server/src/services/training/executors/index.ts
   - Export all executors
   - Factory function to get executor by method

8. IMPLEMENT executor interface:
   ```typescript
   interface TrainingExecutor {
     execute(config: any): Promise<TrainingResult>;
     getProgress(): TrainingProgress;
     pause(): Promise<void>;
     resume(): Promise<void>;
     stop(): Promise<void>;
   }
   ```

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 4: REAL-TIME MONITORING & BUDGET MANAGEMENT

### Prompt 4.1: Create Training Monitor Service

```
READ FIRST:
- server/src/services/training/multi-modal-orchestrator.ts
- server/src/routes/training.ts (streaming endpoints)
- src/components/training/TrainingProgress.tsx

TASK: Create an enhanced Training Monitor Service that provides comprehensive real-time monitoring for flagship training jobs.

CREATE: server/src/services/training/training-monitor.ts

The TrainingMonitorService should:

1. IMPLEMENT comprehensive metrics collection:
   ```typescript
   interface TrainingMetrics {
     // Progress
     currentEpoch: number;
     totalEpochs: number;
     currentStep: number;
     totalSteps: number;
     percentComplete: number;
     estimatedTimeRemaining: string;

     // Performance
     loss: number;
     lossHistory: number[];
     learningRate: number;
     gradientNorm: number;

     // Resources
     gpuUtilization: number[];
     gpuMemoryUsed: number[];
     gpuMemoryTotal: number[];
     cpuUtilization: number;
     ramUsed: number;

     // Cost
     currentCost: number;
     estimatedTotalCost: number;
     costPerHour: number;
     budgetUsedPercent: number;

     // Data
     samplesProcessed: number;
     totalSamples: number;
     currentBatch: object; // Sample of current training data
     dataSource: string;

     // Quality (for alignment methods)
     rewardScore?: number;
     preferenceAccuracy?: number;
     klDivergence?: number;

     // Checkpoints
     lastCheckpoint: string;
     checkpointHistory: CheckpointInfo[];
   }
   ```

2. IMPLEMENT real-time streaming:
   ```typescript
   async *streamMetrics(jobId: string): AsyncGenerator<TrainingMetrics> {
     // Connect to training pod
     // Stream metrics every 1-5 seconds
     // Include current data sample being trained on
     // Include cost updates
   }
   ```

3. IMPLEMENT data visibility:
   ```typescript
   interface CurrentDataSample {
     index: number;
     content: any; // Text, audio preview, image thumbnail
     source: string;
     timestamp: string;
   }

   async getCurrentDataSample(jobId: string): Promise<CurrentDataSample>
   ```
   - Show user what data is being used in real-time
   - For audio: show waveform preview
   - For video: show frame thumbnail
   - For text: show sample text

4. IMPLEMENT stage tracking (for multi-stage pipelines):
   ```typescript
   interface PipelineProgress {
     currentStage: number;
     totalStages: number;
     stageName: string;
     stageProgress: number;
     stageMetrics: TrainingMetrics;
     completedStages: StageResult[];
   }
   ```

5. IMPLEMENT quality checkpoints:
   ```typescript
   interface QualityCheckpoint {
     step: number;
     metrics: {
       loss: number;
       evalLoss?: number;
       customMetrics: Record<string, number>;
     };
     sample: {
       input: any;
       output: any;
       expected?: any;
     };
   }

   // Periodically generate and store quality samples
   async captureQualityCheckpoint(jobId: string): Promise<QualityCheckpoint>
   ```

6. IMPLEMENT log streaming:
   ```typescript
   async *streamLogs(jobId: string): AsyncGenerator<LogEntry> {
     // Stream training logs in real-time
     // Filter by severity
     // Include timestamps
   }
   ```

7. INTEGRATE with frontend for live updates

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

### Prompt 4.2: Create Budget Manager Service

```
READ FIRST:
- server/src/services/training/training-monitor.ts (just created)
- server/src/services/training/gpu-billing.ts (if exists)
- server/src/routes/training.ts

TASK: Create a Budget Manager Service that handles budget tracking, alerts, and freeze/resume functionality.

CREATE: server/src/services/training/budget-manager.ts

The BudgetManagerService should:

1. IMPLEMENT budget tracking:
   ```typescript
   interface BudgetState {
     jobId: string;
     userId: string;

     // Budget limits
     maxBudget: number;
     alertThreshold: number; // percentage
     freezeThreshold: number; // percentage

     // Current state
     currentSpend: number;
     estimatedTotalSpend: number;
     spendRate: number; // $/hour

     // Status
     status: 'within_budget' | 'approaching_alert' | 'alert_sent' | 'approaching_freeze' | 'frozen' | 'resumed' | 'completed';

     // Notifications
     notificationChannels: NotificationChannel[];
     notificationsSent: NotificationRecord[];
   }
   ```

2. IMPLEMENT threshold monitoring:
   ```typescript
   async monitorBudget(jobId: string): Promise<void> {
     const state = await this.getBudgetState(jobId);
     const percentUsed = (state.currentSpend / state.maxBudget) * 100;

     if (percentUsed >= state.freezeThreshold && state.status !== 'frozen') {
       await this.freezeTraining(jobId);
       await this.sendFreezeNotification(jobId);
     } else if (percentUsed >= state.alertThreshold && state.status !== 'alert_sent') {
       await this.sendAlertNotification(jobId);
       await this.updateStatus(jobId, 'alert_sent');
     }
   }
   ```

3. IMPLEMENT freeze functionality:
   ```typescript
   async freezeTraining(jobId: string): Promise<FreezeState> {
     // 1. Save current checkpoint (critical!)
     const checkpoint = await this.saveCheckpoint(jobId);

     // 2. Pause training process (don't terminate!)
     await this.pauseTrainingProcess(jobId);

     // 3. Keep GPU pod running but idle (optional: hibernate)
     await this.hibernateGPU(jobId);

     // 4. Store freeze state for resume
     const freezeState = {
       jobId,
       checkpoint,
       frozenAt: new Date().toISOString(),
       currentSpend: await this.getCurrentSpend(jobId),
       canResume: true,
       resumeUrl: this.generateResumeUrl(jobId),
     };

     await this.storeFreezeState(jobId, freezeState);

     return freezeState;
   }
   ```

4. IMPLEMENT resume functionality:
   ```typescript
   async resumeTraining(jobId: string, newBudget?: number): Promise<ResumeResult> {
     const freezeState = await this.getFreezeState(jobId);

     // 1. Update budget if provided
     if (newBudget) {
       await this.updateBudget(jobId, newBudget);
     }

     // 2. Reactivate GPU pod
     await this.reactivateGPU(jobId);

     // 3. Load checkpoint
     await this.loadCheckpoint(jobId, freezeState.checkpoint);

     // 4. Resume training
     await this.resumeTrainingProcess(jobId);

     // 5. Update status
     await this.updateStatus(jobId, 'resumed');

     return { success: true, resumedAt: new Date().toISOString() };
   }
   ```

5. IMPLEMENT notification sending:
   ```typescript
   async sendBudgetNotification(
     jobId: string,
     type: 'alert' | 'freeze' | 'complete',
     channels: NotificationChannel[]
   ): Promise<void> {
     const state = await this.getBudgetState(jobId);
     const resumeUrl = this.generateResumeUrl(jobId);

     for (const channel of channels) {
       switch (channel) {
         case 'email':
           await this.sendEmail({
             to: state.userEmail,
             subject: `Training Job ${type === 'freeze' ? 'Frozen' : 'Alert'}: Budget ${state.currentSpend}/${state.maxBudget}`,
             body: this.generateEmailBody(state, type, resumeUrl),
           });
           break;

         case 'sms':
           await this.sendSMS({
             to: state.userPhone,
             message: `KripTik Training ${type}: $${state.currentSpend}/$${state.maxBudget}. ${type === 'freeze' ? `Resume: ${resumeUrl}` : ''}`,
           });
           break;

         case 'in_app':
           await this.createInAppNotification({
             userId: state.userId,
             type: `training_${type}`,
             title: `Training ${type === 'freeze' ? 'Frozen' : 'Budget Alert'}`,
             message: `Your training job has ${type === 'freeze' ? 'been frozen' : 'reached'} ${Math.round(state.currentSpend / state.maxBudget * 100)}% of budget.`,
             actionUrl: `/training/jobs/${jobId}`,
             actionLabel: type === 'freeze' ? 'Adjust Budget & Resume' : 'View Training',
           });
           break;
       }
     }
   }
   ```

6. IMPLEMENT resume URL generation:
   ```typescript
   generateResumeUrl(jobId: string): string {
     // Generate secure, time-limited URL
     const token = this.generateSecureToken(jobId);
     return `${FRONTEND_URL}/training/resume/${jobId}?token=${token}`;
   }
   ```

7. ADD API routes for budget management:
   - GET /api/training/jobs/:jobId/budget
   - PUT /api/training/jobs/:jobId/budget (update budget)
   - POST /api/training/jobs/:jobId/freeze (manual freeze)
   - POST /api/training/jobs/:jobId/resume (resume from freeze)
   - GET /api/training/resume/:jobId (resume page endpoint)

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

### Prompt 4.3: Create Training Progress Frontend

```
READ FIRST:
- server/src/services/training/training-monitor.ts
- server/src/services/training/budget-manager.ts
- src/components/training/TrainingProgress.tsx (existing)

TASK: Enhance the Training Progress frontend to show comprehensive real-time monitoring with budget management.

MODIFY: src/components/training/TrainingProgress.tsx

ENHANCE with these features:

1. IMPLEMENT comprehensive progress display:
   ```tsx
   // Main progress header
   <ProgressHeader>
     <CircularProgress value={percentComplete} />
     <TimeEstimate remaining={estimatedTimeRemaining} />
     <CostTracker current={currentCost} max={maxBudget} />
   </ProgressHeader>
   ```

2. IMPLEMENT multi-stage pipeline visualization:
   ```tsx
   <PipelineProgress stages={stages}>
     {stages.map((stage, i) => (
       <StageCard
         key={i}
         name={stage.name}
         status={stage.status}
         progress={stage.progress}
         isCurrent={i === currentStage}
       />
     ))}
   </PipelineProgress>
   ```

3. IMPLEMENT real-time metrics dashboard:
   ```tsx
   <MetricsDashboard>
     <LossCurve data={lossHistory} />
     <GPUUtilization gpus={gpuMetrics} />
     <LearningRateSchedule lr={learningRate} history={lrHistory} />
     <GradientNormChart data={gradientHistory} />
   </MetricsDashboard>
   ```

4. IMPLEMENT data visibility panel:
   ```tsx
   <CurrentDataPanel>
     <DataSamplePreview sample={currentSample} />
     <DataSourceIndicator source={dataSource} />
     <SampleCounter current={samplesProcessed} total={totalSamples} />
   </CurrentDataPanel>
   ```
   - Show current training sample (text preview, audio waveform, image thumbnail)
   - Show data source name
   - Show samples processed counter

5. IMPLEMENT budget management UI:
   ```tsx
   <BudgetPanel status={budgetStatus}>
     <BudgetBar current={currentSpend} max={maxBudget} alert={alertThreshold} freeze={freezeThreshold} />
     <SpendRate rate={costPerHour} />

     {budgetStatus === 'frozen' && (
       <FrozenOverlay>
         <FreezeMessage>Training frozen at {freezePercent}% budget</FreezeMessage>
         <BudgetAdjuster onAdjust={handleBudgetAdjust} />
         <ResumeButton onClick={handleResume} />
         <TestCurrentButton onClick={handleTestCurrent} />
       </FrozenOverlay>
     )}
   </BudgetPanel>
   ```

6. IMPLEMENT checkpoint history:
   ```tsx
   <CheckpointList>
     {checkpoints.map(cp => (
       <CheckpointCard
         key={cp.id}
         step={cp.step}
         loss={cp.metrics.loss}
         timestamp={cp.timestamp}
         onTest={() => handleTestCheckpoint(cp)}
         onRollback={() => handleRollback(cp)}
       />
     ))}
   </CheckpointList>
   ```

7. IMPLEMENT log viewer:
   ```tsx
   <LogViewer logs={logs} filter={logFilter}>
     <LogFilterBar onFilterChange={setLogFilter} />
     <LogList logs={filteredLogs} />
   </LogViewer>
   ```

8. CREATE: src/components/training/BudgetFreezeOverlay.tsx
   - Full-screen overlay when training is frozen
   - Budget adjustment slider
   - Resume button
   - "Test Current Model" button
   - Cost breakdown

9. CREATE: src/components/training/TrainingResumePage.tsx
   - Page for resume URL (from email/SMS link)
   - Shows freeze state
   - Budget adjustment
   - Resume button
   - Direct link to test model

STYLING:
- Keep existing TrainingProgress.tsx styling patterns
- Glassmorphism for panels
- Smooth animations for progress updates
- NO purple-to-pink gradients
- NO emoji

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 5: MODEL TESTING & COMPARISON

### Prompt 5.1: Create Universal Model Tester Service

```
READ FIRST:
- server/src/services/training/model-inference.ts (if exists)
- server/src/services/training/comparison-engine.ts (if exists)
- server/src/routes/training.ts (comparison endpoints)

TASK: Create a Universal Model Tester Service that can test ANY type of trained model within KripTik, regardless of modality.

CREATE: server/src/services/training/universal-model-tester.ts

The UniversalModelTesterService should:

1. IMPLEMENT modality-specific testing:
   ```typescript
   interface TestRequest {
     modelId: string;
     modality: ModelModality;

     // Input (varies by modality)
     textPrompt?: string;
     imageInput?: Buffer;
     audioInput?: Buffer;
     videoInput?: Buffer;
     codeInput?: string;

     // Config
     maxTokens?: number;
     temperature?: number;
     steps?: number; // For diffusion
     guidance?: number;

     // Output preferences
     outputFormat?: string;
   }

   interface TestResult {
     output: any; // Varies by modality
     outputUrl?: string; // For media
     latency: number;
     tokensUsed?: number;
     cost: number;
     metadata: Record<string, any>;
   }
   ```

2. IMPLEMENT modality handlers:

   a) **Text Generation Testing**:
   ```typescript
   async testTextGeneration(request: TestRequest): Promise<TestResult> {
     // Deploy model to inference endpoint
     // Send text prompt
     // Return generated text
     // Track latency and tokens
   }
   ```

   b) **Code Generation Testing**:
   ```typescript
   async testCodeGeneration(request: TestRequest): Promise<TestResult> {
     // Similar to text but with code-specific formatting
     // Syntax highlighting in response
     // Optional: Run code in sandbox
   }
   ```

   c) **Image Generation Testing**:
   ```typescript
   async testImageGeneration(request: TestRequest): Promise<TestResult> {
     // Deploy diffusion model
     // Send text prompt (and optional image for img2img)
     // Return generated image URL
     // Track steps and time
   }
   ```

   d) **Audio Generation Testing** (music, speech, effects):
   ```typescript
   async testAudioGeneration(request: TestRequest): Promise<TestResult> {
     // Deploy audio model
     // Send prompt (and optional reference audio)
     // Return generated audio URL
     // Include waveform data for preview
   }
   ```

   e) **Video Generation Testing**:
   ```typescript
   async testVideoGeneration(request: TestRequest): Promise<TestResult> {
     // Deploy video model
     // Send prompt (and optional reference)
     // Return generated video URL
     // Include thumbnail and duration
   }
   ```

   f) **Voice Cloning Testing**:
   ```typescript
   async testVoiceCloning(request: TestRequest): Promise<TestResult> {
     // Send text to speak + reference voice
     // Return cloned speech audio
   }
   ```

   g) **Embedding Testing**:
   ```typescript
   async testEmbedding(request: TestRequest): Promise<TestResult> {
     // Send text/image for embedding
     // Return embedding vector
     // Include similarity search demo
   }
   ```

   h) **Multimodal Testing** (vision-language, etc.):
   ```typescript
   async testMultimodal(request: TestRequest): Promise<TestResult> {
     // Send image + text question
     // Return text answer
   }
   ```

3. IMPLEMENT temporary inference deployment:
   ```typescript
   async deployForTesting(modelId: string, modality: ModelModality): Promise<InferenceEndpoint> {
     // Deploy to RunPod/Modal with auto-expiry (10 min default)
     // Return endpoint URL
     // Start cleanup timer
   }
   ```

4. IMPLEMENT comparison testing:
   ```typescript
   async compareModels(
     pretrainedModelId: string,
     finetuedModelId: string,
     testInputs: TestRequest[]
   ): Promise<ComparisonResult> {
     // Run same inputs through both models
     // Return side-by-side results
     // Include latency, cost, quality metrics
   }
   ```

5. IMPLEMENT test session management:
   ```typescript
   async createTestSession(config: {
     pretrainedModel: string;
     finetunedModel: string;
     modality: ModelModality;
     expiryMinutes: number;
   }): Promise<TestSession>

   async extendTestSession(sessionId: string, minutes: number): Promise<void>

   async endTestSession(sessionId: string): Promise<void>
   ```

6. ADD API routes:
   - POST /api/training/test/deploy (deploy models for testing)
   - POST /api/training/test/run (run single test)
   - POST /api/training/test/compare (run comparison)
   - GET /api/training/test/sessions/:id (get session status)
   - DELETE /api/training/test/sessions/:id (cleanup)

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

### Prompt 5.2: Create Model Testing Frontend

```
READ FIRST:
- server/src/services/training/universal-model-tester.ts (just created)
- src/components/training/ModelComparisonUI.tsx (existing)
- src/components/training/TrainingReportView.tsx

TASK: Create comprehensive model testing UI that works for ALL model types.

CREATE/MODIFY these files:

1. CREATE: src/components/training/UniversalModelTester.tsx
   ```tsx
   // Main testing interface that adapts to modality
   interface UniversalModelTesterProps {
     pretrainedModelId: string;
     finetunedModelId: string;
     modality: ModelModality;
   }

   // Renders appropriate input controls based on modality
   // Renders appropriate output display based on modality
   // Side-by-side comparison view
   ```

2. CREATE: src/components/training/inputs/TextPromptInput.tsx
   - Text area for prompts
   - System prompt field (for chat models)
   - Temperature/max tokens controls
   - Submit button

3. CREATE: src/components/training/inputs/ImageInput.tsx
   - Image upload dropzone
   - Text prompt field (for img2img or captioning)
   - Steps/guidance controls
   - Resolution selector

4. CREATE: src/components/training/inputs/AudioInput.tsx
   - Audio upload dropzone
   - Text prompt field (for text-to-audio)
   - Reference audio field (for voice cloning)
   - Duration/quality controls
   - Waveform preview

5. CREATE: src/components/training/inputs/VideoInput.tsx
   - Video upload dropzone
   - Text prompt field
   - Reference video field
   - Duration/fps/resolution controls
   - Frame preview

6. CREATE: src/components/training/inputs/CodeInput.tsx
   - Monaco editor for code input
   - Language selector
   - Context/completion mode toggle

7. CREATE: src/components/training/outputs/TextOutput.tsx
   - Markdown rendering
   - Copy button
   - Token count display
   - Latency display

8. CREATE: src/components/training/outputs/ImageOutput.tsx
   - Image display with zoom
   - Download button
   - Generation params display
   - Side-by-side comparison slider

9. CREATE: src/components/training/outputs/AudioOutput.tsx
   - Audio player
   - Waveform visualization
   - Download button
   - Spectrogram view (optional)

10. CREATE: src/components/training/outputs/VideoOutput.tsx
    - Video player
    - Frame-by-frame view
    - Download button
    - Quality metrics display

11. CREATE: src/components/training/ComparisonView.tsx
    - Side-by-side layout for pre/post comparison
    - Sync controls (play both audio/video simultaneously)
    - Difference highlighting (for text)
    - Quality score comparison
    - "Which is better?" user feedback (for DPO data collection)

12. MODIFY: src/components/training/TrainingReportView.tsx
    - Add "Test Model" button
    - Opens UniversalModelTester in modal
    - Pre-populates with trained model

13. CREATE: src/components/training/QuickTestPanel.tsx
    - Collapsible panel during training
    - Test checkpoint at any point
    - Quick comparison with base model

STYLING:
- Consistent with existing training UI
- Glassmorphism panels
- Smooth transitions
- Responsive layout
- NO purple-to-pink gradients
- NO emoji

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 6: NOTIFICATION SYSTEM INTEGRATION

### Prompt 6.1: Integrate Training Notifications

```
READ FIRST:
- server/src/services/training/budget-manager.ts
- server/src/schema.ts (notifications table)
- server/src/routes/notifications.ts (if exists)
- src/components/notifications/ (if exists)

TASK: Integrate the training module with KripTik's notification system for budget alerts, completion notifications, and freeze notifications.

MODIFY/CREATE these files:

1. CREATE: server/src/services/training/training-notifications.ts
   ```typescript
   class TrainingNotificationService {
     // Budget alerts
     async sendBudgetAlert(jobId: string, percentUsed: number): Promise<void>

     // Freeze notifications
     async sendFreezeNotification(jobId: string, freezeState: FreezeState): Promise<void>

     // Completion notifications
     async sendCompletionNotification(jobId: string, result: TrainingResult): Promise<void>

     // Error notifications
     async sendErrorNotification(jobId: string, error: Error): Promise<void>

     // Stage completion (for multi-stage)
     async sendStageCompleteNotification(jobId: string, stage: StageResult): Promise<void>
   }
   ```

2. IMPLEMENT notification channels:

   a) **In-App Notifications**:
   ```typescript
   async sendInAppNotification(notification: {
     userId: string;
     type: 'training_alert' | 'training_freeze' | 'training_complete' | 'training_error';
     title: string;
     message: string;
     actionUrl: string;
     actionLabel: string;
     metadata: Record<string, any>;
   }): Promise<void> {
     // Insert into notifications table
     // Emit SSE event to connected clients
   }
   ```

   b) **Email Notifications**:
   ```typescript
   async sendEmailNotification(email: {
     to: string;
     subject: string;
     templateId: 'training_alert' | 'training_freeze' | 'training_complete';
     variables: Record<string, any>;
   }): Promise<void> {
     // Use existing email service
     // Include resume URL for freeze
     // Include test URL for complete
   }
   ```

   c) **SMS Notifications**:
   ```typescript
   async sendSMSNotification(sms: {
     to: string;
     message: string;
     includeUrl?: string;
   }): Promise<void> {
     // Use Twilio or existing SMS service
     // Keep message short
     // Include short URL
   }
   ```

3. IMPLEMENT notification preferences:
   ```typescript
   interface TrainingNotificationPreferences {
     userId: string;

     // Channel preferences
     emailEnabled: boolean;
     smsEnabled: boolean;
     inAppEnabled: boolean;

     // Event preferences
     alertOnBudgetPercent: number; // Default 80%
     alertOnStageComplete: boolean;
     alertOnError: boolean;
     alertOnComplete: boolean;

     // Quiet hours
     quietHoursEnabled: boolean;
     quietHoursStart: string; // "22:00"
     quietHoursEnd: string; // "08:00"
   }
   ```

4. CREATE frontend notification components:

   a) src/components/training/TrainingNotificationBell.tsx
      - Shows training-specific notifications
      - Badge with unread count
      - Quick actions (resume, test)

   b) src/components/training/NotificationPreferencesPanel.tsx
      - Configure notification preferences
      - Test notification button
      - Channel toggles

5. ADD click-to-action for notifications:
   - Budget alert → Opens budget adjustment panel
   - Freeze notification → Opens resume page with budget adjustment
   - Complete notification → Opens test page
   - Error notification → Opens error details with retry option

6. IMPLEMENT SSE for real-time notification delivery:
   ```typescript
   // In training routes
   app.get('/api/training/notifications/stream', async (req, res) => {
     // SSE stream for training notifications
     // Filter by user
     // Include all training events
   });
   ```

7. CREATE email templates:
   - training_alert.html - Budget approaching threshold
   - training_freeze.html - Training frozen, include resume link
   - training_complete.html - Training done, include test link
   - training_error.html - Error occurred, include retry link

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 7: MAIN TRAINING PAGE INTEGRATION

### Prompt 7.1: Integrate NLP-First Training Flow

```
READ FIRST:
- src/components/training/TrainingWizard.tsx
- src/components/training/TrainingIntentInput.tsx (created earlier)
- src/components/training/TrainingImplementationPlan.tsx (created earlier)
- src/store/useTrainingStore.ts

TASK: Modify the main training page to use the NLP-first flow while keeping the existing visual style.

MODIFY: src/pages/Training.tsx (or wherever the main training page is)

IMPLEMENT this flow:

1. **Landing State** (when no training job active):
   ```tsx
   <TrainingLanding>
     {/* Hero section with NLP input */}
     <NLPInputSection>
       <Title>Train Flagship-Level AI Models</Title>
       <Subtitle>Describe what you want to train in plain English</Subtitle>
       <TrainingIntentInput onSubmit={handleIntentSubmit} />
       <ExamplePrompts examples={EXAMPLE_PROMPTS} onClick={handleExampleClick} />
     </NLPInputSection>

     {/* Capability showcase */}
     <CapabilityShowcase>
       <CapabilityCard type="music" />
       <CapabilityCard type="video" />
       <CapabilityCard type="image" />
       <CapabilityCard type="voice" />
       <CapabilityCard type="text" />
       <CapabilityCard type="code" />
     </CapabilityShowcase>

     {/* Recent jobs */}
     <RecentJobs jobs={recentJobs} />
   </TrainingLanding>
   ```

2. **Plan Generation State** (after NLP submitted):
   ```tsx
   <PlanGenerationState>
     <LoadingAnimation />
     <StatusText>Analyzing your training requirements with AI...</StatusText>
     <StepIndicator steps={[
       'Parsing intent',
       'Selecting models',
       'Choosing methods',
       'Estimating costs',
       'Generating plan'
     ]} currentStep={currentStep} />
   </PlanGenerationState>
   ```

3. **Plan Review State** (showing implementation plan):
   ```tsx
   <PlanReviewState>
     <TrainingImplementationPlan
       plan={implementationPlan}
       onTileModify={handleTileModify}
       onApprove={handlePlanApprove}
       onModifyWithAI={handleModifyWithAI}
     />
   </PlanReviewState>
   ```

4. **Environment Setup State** (after approval):
   ```tsx
   <EnvironmentSetupState>
     <SetupProgress stages={setupStages} currentStage={currentSetupStage} />
     <SetupLogs logs={setupLogs} />
   </EnvironmentSetupState>
   ```

5. **Training In Progress State**:
   ```tsx
   <TrainingInProgressState>
     <TrainingProgress
       metrics={metrics}
       budgetState={budgetState}
       checkpoints={checkpoints}
       logs={logs}
       currentDataSample={currentSample}
     />

     {/* Quick test panel */}
     <QuickTestPanel
       model={currentCheckpoint}
       modality={modality}
       onTest={handleQuickTest}
     />
   </TrainingInProgressState>
   ```

6. **Frozen State** (budget exceeded):
   ```tsx
   <FrozenState>
     <BudgetFreezeOverlay
       freezeState={freezeState}
       onAdjustBudget={handleAdjustBudget}
       onResume={handleResume}
       onTestCurrent={handleTestCurrent}
     />
   </FrozenState>
   ```

7. **Complete State**:
   ```tsx
   <CompleteState>
     <CompletionSummary result={trainingResult} />
     <UniversalModelTester
       pretrainedModel={baseModel}
       finetunedModel={trainedModel}
       modality={modality}
     />
     <TrainingReportView report={report} />
     <DeploymentOptions model={trainedModel} />
   </CompleteState>
   ```

8. IMPLEMENT example prompts:
   ```typescript
   const EXAMPLE_PROMPTS = [
     {
       category: 'Music',
       prompt: 'Train a model to generate Suno-quality music with expressive vocals',
       icon: MusicIcon,
     },
     {
       category: 'Video',
       prompt: 'Fine-tune a video model to generate cinematic 4K footage',
       icon: VideoIcon,
     },
     {
       category: 'Voice',
       prompt: 'Clone my voice from 5 minutes of audio samples',
       icon: VoiceIcon,
     },
     {
       category: 'Code',
       prompt: 'Train a coding model specialized in React and TypeScript',
       icon: CodeIcon,
     },
     {
       category: 'Image',
       prompt: 'Train a model in my art style using 50 reference images',
       icon: ImageIcon,
     },
   ];
   ```

9. KEEP existing visual styling:
   - Same Tailwind classes
   - Same glassmorphism effects
   - Same animation patterns
   - Same color scheme (NO purple-to-pink)
   - NO emoji

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

### Prompt 7.2: Update Training Store for NLP Flow

```
READ FIRST:
- src/store/useTrainingStore.ts
- src/components/training/TrainingWizard.tsx
- Server routes for training

TASK: Update the training store to support the NLP-first flow while maintaining backward compatibility with the existing wizard.

MODIFY: src/store/useTrainingStore.ts

ADD these state and actions:

1. IMPLEMENT new state sections:
   ```typescript
   interface TrainingStore {
     // ... existing state ...

     // NLP Flow State
     nlpFlow: {
       prompt: string;
       status: 'idle' | 'parsing' | 'plan_ready' | 'modifying' | 'approved' | 'setting_up' | 'training' | 'frozen' | 'complete' | 'error';

       // Parsed contract
       contract: TrainingContract | null;

       // Implementation plan
       plan: TrainingImplementationPlan | null;

       // Setup progress
       setupProgress: EnvironmentSetup | null;

       // Training progress
       trainingProgress: TrainingMetrics | null;

       // Budget state
       budgetState: BudgetState | null;

       // Freeze state
       freezeState: FreezeState | null;

       // Result
       result: TrainingResult | null;

       // Current data sample being trained on
       currentDataSample: CurrentDataSample | null;

       // Checkpoints
       checkpoints: QualityCheckpoint[];

       // Logs
       logs: LogEntry[];

       // Error
       error: Error | null;
     };

     // Actions
     parseIntent: (prompt: string) => Promise<void>;
     modifyTile: (tileId: string, modification: TileModification) => Promise<void>;
     modifyPlanWithAI: (nlpModification: string) => Promise<void>;
     approvePlan: (budgetAuth: BudgetAuthorization) => Promise<void>;
     pauseTraining: () => Promise<void>;
     resumeTraining: (newBudget?: number) => Promise<void>;
     testCheckpoint: (checkpointId: string) => Promise<void>;
     subscribeToProgress: (jobId: string) => void;
     unsubscribeFromProgress: () => void;
     resetNlpFlow: () => void;
   }
   ```

2. IMPLEMENT parseIntent action:
   ```typescript
   parseIntent: async (prompt: string) => {
     set(state => ({
       nlpFlow: {
         ...state.nlpFlow,
         prompt,
         status: 'parsing',
         error: null,
       }
     }));

     try {
       const response = await fetch(`${API_URL}/api/training/parse-intent`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         credentials: 'include',
         body: JSON.stringify({ prompt }),
       });

       const data = await response.json();

       set(state => ({
         nlpFlow: {
           ...state.nlpFlow,
           status: 'plan_ready',
           contract: data.contract,
           plan: data.plan,
         }
       }));
     } catch (error) {
       set(state => ({
         nlpFlow: {
           ...state.nlpFlow,
           status: 'error',
           error: error as Error,
         }
       }));
     }
   }
   ```

3. IMPLEMENT SSE subscription for progress:
   ```typescript
   subscribeToProgress: (jobId: string) => {
     const eventSource = new EventSource(
       `${API_URL}/api/training/jobs/${jobId}/stream`,
       { withCredentials: true }
     );

     eventSource.onmessage = (event) => {
       const data = JSON.parse(event.data);

       set(state => ({
         nlpFlow: {
           ...state.nlpFlow,
           trainingProgress: data.metrics,
           currentDataSample: data.currentSample,
           budgetState: data.budget,
           checkpoints: data.checkpoints || state.nlpFlow.checkpoints,
         }
       }));

       // Handle freeze event
       if (data.type === 'frozen') {
         set(state => ({
           nlpFlow: {
             ...state.nlpFlow,
             status: 'frozen',
             freezeState: data.freezeState,
           }
         }));
       }

       // Handle completion
       if (data.type === 'complete') {
         set(state => ({
           nlpFlow: {
             ...state.nlpFlow,
             status: 'complete',
             result: data.result,
           }
         }));
       }
     };

     // Store reference for cleanup
     set({ eventSource });
   }
   ```

4. IMPLEMENT budget management actions:
   ```typescript
   pauseTraining: async () => {
     const { activeJobId } = get().nlpFlow;
     await fetch(`${API_URL}/api/training/jobs/${activeJobId}/pause`, {
       method: 'POST',
       credentials: 'include',
     });
   },

   resumeTraining: async (newBudget?: number) => {
     const { activeJobId, freezeState } = get().nlpFlow;
     await fetch(`${API_URL}/api/training/jobs/${activeJobId}/resume`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
       body: JSON.stringify({ newBudget }),
     });

     set(state => ({
       nlpFlow: {
         ...state.nlpFlow,
         status: 'training',
         freezeState: null,
       }
     }));
   }
   ```

5. KEEP backward compatibility:
   - Existing wizard state should still work
   - Add 'flowMode: 'wizard' | 'nlp'' to switch between modes
   - Default to 'nlp' for new training jobs

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 8: FINAL INTEGRATION & TESTING

### Prompt 8.1: Integration Testing & Validation

```
READ FIRST:
- All files created in previous prompts
- /Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/CLAUDE.md

TASK: Perform final integration testing and validation of the flagship training module.

VERIFY AND FIX:

1. **API Route Integration**:
   - Verify all new routes are registered in server/src/index.ts or routes/index.ts
   - Test each endpoint with curl/Postman
   - Verify auth middleware is applied to all routes
   - Verify error handling returns proper status codes

2. **Database Schema**:
   - Verify all new tables are created (trainingPlans, etc.)
   - Run migrations if needed
   - Verify foreign key relationships

3. **Frontend Integration**:
   - Verify all new components are exported
   - Verify store actions are called correctly
   - Verify SSE connections work
   - Test on different screen sizes

4. **Service Dependencies**:
   - Verify all services are properly imported
   - Verify EventEmitter events are properly handled
   - Verify error propagation works

5. **Credential Flow**:
   - Verify RunPod credentials are loaded from vault
   - Verify Modal credentials are loaded from vault
   - Verify HuggingFace credentials work

6. **Build Verification**:
   - Run `npm run build` in root
   - Run `npm run build` in server/
   - Fix any TypeScript errors
   - Fix any ESLint warnings

7. **End-to-End Test Scenarios**:

   a) **Music Training Flow**:
   - Enter: "Train a model to generate Suno-quality music"
   - Verify: Contract shows music_generation capability
   - Verify: Recommended method includes multi-stage pipeline
   - Verify: GPU recommendation shows H100/A100
   - Approve and verify setup starts

   b) **Quick LoRA Flow**:
   - Enter: "Quick fine-tune Llama for customer support"
   - Verify: Contract shows text_generation capability
   - Verify: Recommended method is QLoRA (not flagship)
   - Verify: Budget estimate is reasonable (<$50)

   c) **Budget Freeze Flow**:
   - Start training job
   - Simulate budget threshold reached
   - Verify freeze notification sent
   - Verify resume works
   - Verify no data lost

   d) **Model Comparison Flow**:
   - Complete a training job
   - Test comparison UI
   - Verify both models deploy
   - Verify side-by-side comparison works

8. **Document Any Issues**:
   - Update .claude/rules/02-gotchas.md with any new issues found
   - Update implementation_log.md with what was tested

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after all fixes.
```

---

### Prompt 8.2: Documentation & Memory Update

```
READ FIRST:
- All implementation from previous prompts
- .claude/rules/01-session-context.md
- .claude/memory/implementation_log.md

TASK: Document the flagship training module implementation and update memory files.

CREATE/UPDATE:

1. CREATE: docs/FLAGSHIP-TRAINING-MODULE.md
   ```markdown
   # KripTik AI Flagship Training Module

   ## Overview
   [Description of the NLP-first training system]

   ## Architecture
   [Diagram and explanation of components]

   ## User Flow
   [Step-by-step user journey]

   ## API Reference
   [All endpoints with examples]

   ## Training Methods Supported
   [List of all methods with use cases]

   ## GPU Requirements
   [GPU tiers and recommendations]

   ## Cost Estimation
   [How costs are calculated]

   ## Budget Management
   [Freeze/resume functionality]

   ## Notifications
   [Notification channels and configuration]

   ## Testing Models
   [How to test trained models]

   ## Troubleshooting
   [Common issues and solutions]
   ```

2. UPDATE: .claude/rules/01-session-context.md
   ```markdown
   ## Flagship Training Module Implementation

   ### What Was Done
   - Created Training Intent Lock system
   - Created Training Method Recommender
   - Created Training Data Strategist
   - Created Implementation Plan generator with tiles
   - Created Environment Orchestrator
   - Created Flagship Training Executors (DoRA, DPO, RLHF, DeepSpeed, MoE)
   - Created Training Monitor service
   - Created Budget Manager with freeze/resume
   - Created Universal Model Tester
   - Created all frontend components
   - Integrated notifications
   - Updated training store for NLP flow

   ### Files Created/Modified
   [List all files]

   ### Integration Points
   [Where this connects to existing systems]

   ### Known Issues
   [Any remaining issues]

   ### Next Steps
   [What should be done next]
   ```

3. UPDATE: .claude/memory/implementation_log.md
   ```markdown
   ## [Date] - Flagship Training Module

   **Files Changed**: [list]
   **Why**: Transform training module to flagship-level NLP-first platform
   **How**:
   - Training Intent Lock parses NLP with Opus 4.5
   - Method Recommender suggests optimal training pipeline
   - Implementation Plan shows tiles for user approval
   - Environment Orchestrator sets up GPU resources
   - Executors handle all training methods
   - Monitor tracks progress in real-time
   - Budget Manager handles freeze/resume
   - Universal Tester allows testing any model type

   **Integration Points**:
   - Uses existing Credential Vault for GPU provider keys
   - Uses existing notification system
   - Uses existing GPU billing
   - Uses existing RunPod/Modal services
   ```

4. UPDATE: .claude/rules/02-gotchas.md
   Add any gotchas discovered during implementation

5. UPDATE: feature_list.json
   Mark training module features as complete (if applicable)

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after all updates.
```

---

## EXECUTION ORDER

Execute these prompts in order. Each builds on the previous:

1. **Phase 1**: Training Intent Lock System (1.1 → 1.2 → 1.3)
2. **Phase 2**: Implementation Plan System (2.1 → 2.2 → 2.3)
3. **Phase 3**: Environment Orchestrator (3.1 → 3.2)
4. **Phase 4**: Monitoring & Budget (4.1 → 4.2 → 4.3)
5. **Phase 5**: Model Testing (5.1 → 5.2)
6. **Phase 6**: Notifications (6.1)
7. **Phase 7**: Main Page Integration (7.1 → 7.2)
8. **Phase 8**: Testing & Documentation (8.1 → 8.2)

---

## CRITICAL REMINDERS

- **DO NOT** modify auth files (auth.ts, schema.ts auth tables, auth-client.ts, middleware/auth.ts)
- **DO** run `npm run build` after each prompt
- **DO** use `${API_URL}` from centralized config, not hardcoded URLs
- **DO** include `credentials: 'include'` in all fetch calls
- **DO** follow existing visual styling (glassmorphism, no purple-pink gradients, no emoji)
- **DO** update memory files after significant changes
- **DO** use custom icons from src/components/icons/, not Lucide

---

*Implementation Plan Generated: January 16, 2026*
*Target: Flagship-Level NLP-to-Training Platform*
