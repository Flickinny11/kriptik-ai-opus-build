# KripTik AI - GPU & AI Lab Implementation Plan
## NLP Prompts for Claude Code Extension / Cursor 2.2 with Opus 4.5

> **Created**: January 6, 2026
> **Purpose**: Copy-paste ready NLP prompts for implementing GPU integration, Open Source Studio, Training/Fine-Tuning, and AI Lab features

---

## Overview

This document contains 10 structured NLP prompts designed for:
- Claude Code extension in Cursor 2.2
- Opus 4.5 model selection
- Ultrathink/deep think activation
- Async agent spawning when appropriate

Each prompt includes websearch instructions to ensure up-to-date (January 2026) implementations.

---

## PROMPT 1: GPU Resource Classifier Service

```
ULTRATHINK before implementing. This is critical infrastructure.

First, use websearch to find:
- "RunPod GraphQL API January 2026 mutations endpoints templates"
- "HuggingFace model requirements GPU memory VRAM estimation 2026"
- "CUDA compute capability GPU types comparison 2026"

TASK: Create a GPU Resource Classifier service for KripTik AI that:

1. ANALYZES user NLP input during Intent Lock phase to detect GPU requirements
2. CLASSIFIES workload type: inference-only, training, fine-tuning, video-generation, image-generation, audio, multimodal
3. ESTIMATES GPU memory requirements based on model size + batch size + precision
4. RECOMMENDS optimal GPU tier from RunPod's available options

INTEGRATION REQUIREMENTS:
- Integrate into existing Build Loop at Phase 0 (Intent Lock) in server/src/services/automation/build-loop.ts
- Use existing HuggingFaceService from server/src/services/ml/huggingface.ts for model analysis
- Use existing RunPodProvider from server/src/services/cloud/runpod.ts for GPU availability
- Add to Intent Lock contract structure in server/src/services/ai/intent-lock.ts

CREATE these files:
1. server/src/services/ml/gpu-classifier.ts - Main classification logic
2. server/src/services/ml/gpu-requirements.ts - GPU requirement estimation
3. Update server/src/schema.ts - Add gpuRequirements field to buildIntents table

The GPU Classifier MUST:
- Return structured GPURequirement object with: minVRAM, recommendedVRAM, computeCapability, estimatedCostPerHour, supportedQuantizations
- Detect model IDs from NLP (e.g., "use Wan 2.2 for video" → "Lightricks/Wan-2.2-i2v")
- Handle models up to 500GB+ by calculating distributed requirements
- Support quantization options: fp32, fp16, bf16, int8, int4, awq, gptq, gguf

When complete, the Intent Lock Sacred Contract should include GPU requirements automatically when detected.

Follow existing KripTik patterns - check server/src/services/ai/intent-lock.ts for contract structure.
No placeholders. No TODOs. Production ready.
```

---

## PROMPT 2: Open Source Studio - Model Browser & Dock

```
THINK HARD about component architecture before implementing.

First, use websearch to find:
- "HuggingFace API models search filter January 2026"
- "React drag and drop dnd-kit patterns 2026"
- "HuggingFace model cards metadata structure 2026"

TASK: Create the Open Source Studio UI for KripTik AI's developer toolbar.

This is a model browser with drag-and-drop Model Dock for selecting HuggingFace models.

UI REQUIREMENTS:
1. Developer Toolbar button "Open Source Studio" (use custom icon from src/components/icons/)
2. Full-screen modal with:
   - Left panel: HuggingFace model browser with search, filters (task type, library, size, license)
   - Right panel: Model Dock (max 5 models) for drag-and-drop collection
   - Bottom panel: Selected model details, requirements, estimated costs
3. Model cards show: name, downloads, likes, size estimate, license, task type, VRAM requirement
4. License filter with WARNING badge for models that "can't be modified" (check license field)
5. Drag model cards to dock, reorder dock, remove from dock

CREATE these files:
1. src/components/open-source-studio/OpenSourceStudio.tsx - Main container
2. src/components/open-source-studio/ModelBrowser.tsx - Search and filter UI
3. src/components/open-source-studio/ModelCard.tsx - Individual model display
4. src/components/open-source-studio/ModelDock.tsx - Drag-and-drop dock
5. src/components/open-source-studio/ModelDetails.tsx - Selected model info
6. src/store/useOpenSourceStudioStore.ts - Zustand store
7. src/components/icons/OpenSourceStudioIcon.tsx - Custom icon (NO Lucide)

INTEGRATE:
- Add button to developer toolbar in src/components/developer/DeveloperToolbar.tsx
- Use existing HuggingFaceService API calls (don't duplicate)
- Create API route: server/src/routes/open-source-studio.ts for model search
- Register route in server/src/routes/index.ts

DESIGN STANDARDS (mandatory):
- Premium depth with layered shadows and glassmorphism
- Framer Motion animations for drag-drop and transitions
- DM Sans typography
- NO flat designs, NO emoji, NO purple-to-pink gradients
- Cards must have depth, hover states with subtle glow

License warnings must clearly state: "This model's license may restrict commercial use or modifications"

Production ready. Wire up completely. No orphaned components.
```

---

## PROMPT 3: HuggingFace Token Connection Flow

```
THINK about security and UX flow before implementing.

First, use websearch to find:
- "HuggingFace user tokens write access API 2026"
- "HuggingFace push_to_hub authentication requirements 2026"
- "OAuth token scope validation patterns 2026"

TASK: Create mandatory HuggingFace token connection flow for Open Source Studio.

Before ANY training/fine-tuning can begin, user MUST have valid HuggingFace token with write access.

REQUIREMENTS:
1. Token connection modal that appears when user first opens Open Source Studio
2. Validate token has write scope (required for push_to_hub)
3. Store encrypted token in existing Credential Vault (server/src/services/credentials/*)
4. Show connected status with username and avatar
5. Allow disconnect/reconnect
6. Block training UI until valid token connected

CREATE these files:
1. src/components/open-source-studio/HuggingFaceConnect.tsx - Connection modal
2. src/components/open-source-studio/HuggingFaceStatus.tsx - Connected status display
3. server/src/routes/huggingface-auth.ts - Token validation endpoint
4. Update server/src/services/ml/huggingface.ts - Add token validation method

INTEGRATE:
- Use existing Credential Vault pattern from server/src/services/credentials/
- Add to user's credential store with type 'huggingface'
- Create database migration for huggingface_tokens if needed (check schema.ts)

VALIDATION FLOW:
1. User enters token
2. Backend calls HuggingFace /api/whoami endpoint
3. Verify "write" scope in response
4. If valid, encrypt and store
5. Return user info (username, avatar, email)
6. If invalid, show clear error message

UI must clearly explain WHY token is required:
"Your trained models and LoRA adapters will be saved to your HuggingFace account. This requires a token with write access."

Production ready. Handle all error cases.
```

---

## PROMPT 4: Training & Fine-Tuning Module

```
ULTRATHINK before implementing. Complex orchestration required.

First, use websearch to find:
- "LoRA QLoRA training parameters best practices January 2026"
- "RunPod serverless training job API 2026"
- "HuggingFace push_to_hub LoRA adapters 2026"
- "Hugging Face Trainer API streaming progress 2026"

TASK: Create Training & Fine-Tuning Module for Open Source Studio.

This module allows users to fine-tune models from their Model Dock on RunPod GPUs, with results auto-saved to their HuggingFace account.

TRAINING TYPES:
1. LoRA (Low-Rank Adaptation) - lightweight, saves adapter only
2. QLoRA (Quantized LoRA) - memory efficient, 4-bit base model
3. Full Fine-Tune - complete model weights (WARNING: storage intensive)

CREATE these files:
1. src/components/open-source-studio/TrainingConfig.tsx - Training parameters UI
2. src/components/open-source-studio/DatasetSelector.tsx - Dataset selection (HF datasets)
3. src/components/open-source-studio/TrainingProgress.tsx - Real-time progress display
4. src/components/open-source-studio/TrainingCostEstimator.tsx - Budget/cost calculator
5. server/src/services/ml/training-orchestrator.ts - Training job orchestration
6. server/src/services/ml/training-job.ts - Individual job management
7. server/src/routes/training.ts - Training API endpoints
8. Update server/src/schema.ts - Add trainingJobs table

TRAINING PARAMETERS UI:
- Training type dropdown (LoRA/QLoRA/Full)
- Epochs slider (1-100)
- Learning rate input with presets
- Batch size (auto-calculated based on VRAM)
- LoRA rank (for LoRA/QLoRA): 8, 16, 32, 64
- Target modules selection
- Dataset selection from HuggingFace
- Custom dataset upload option
- Budget limit input (USD)

COST ESTIMATION:
- Calculate based on: model size, dataset size, epochs, GPU type, RunPod pricing
- Show: estimated time, estimated cost, cost per epoch
- WARNING if estimated cost exceeds user's balance
- WARNING about RunPod volume storage costs for large models

RUNPOD INTEGRATION:
- Use existing RunPodProvider for serverless job creation
- Create training pod with appropriate GPU
- Mount volume for model weights
- Stream training logs via SSE
- Auto-terminate on completion or budget exceeded

HUGGINGFACE SAVE:
- On training completion, auto-upload to user's HF account
- For LoRA: upload adapter only (small)
- For Full: upload complete model (WARNING about size)
- Create model card with training parameters
- Make model private by default (user can publish later)

WARNINGS (mandatory):
1. "Full fine-tuning will save the complete model (potentially hundreds of GB) to your HuggingFace account"
2. "RunPod charges for volume storage. Large models stored on volumes incur ongoing costs."
3. "Training costs are estimates. Actual costs depend on training convergence."

The Training Module MUST follow Build Loop protocols:
- Use Verification Swarm (minus anti-slop which is for frontend only)
- Use Error Escalation for failed training jobs
- Report progress via SSE like Developer Mode

Production ready. All warnings in place. Full error handling.
```

---

## PROMPT 5: Inference Endpoint Deployment

```
THINK HARD about deployment flow and ownership transfer.

First, use websearch to find:
- "RunPod serverless endpoint creation GraphQL January 2026"
- "RunPod GitHub integration deploy without Docker Hub 2026"
- "RunPod endpoint scaling configuration 2026"

TASK: Create Inference Endpoint Deployment for trained models in Open Source Studio.

After training completes, user can deploy their model as an inference endpoint on their own RunPod account.

DEPLOYMENT FLOW:
1. User clicks "Deploy" on completed training job
2. Show deployment configuration modal
3. User enters RunPod API key (stored in Credential Vault)
4. KripTik creates serverless endpoint on user's RunPod account
5. User owns the endpoint completely
6. KripTik provides 30-minute test window
7. After 30 min, endpoint stays on user's RunPod (they pay directly)

CREATE these files:
1. src/components/open-source-studio/DeploymentConfig.tsx - Deployment settings UI
2. src/components/open-source-studio/EndpointTest.tsx - 30-min test interface
3. src/components/open-source-studio/EndpointManagement.tsx - Manage deployed endpoints
4. server/src/services/ml/endpoint-deployer.ts - Deployment orchestration
5. server/src/routes/endpoints.ts - Endpoint management API
6. Update server/src/schema.ts - Add deployedEndpoints table

DEPLOYMENT OPTIONS:
- GPU type selection (based on model requirements)
- Min/Max workers for scaling
- Idle timeout
- Custom environment variables
- Volume persistence (for model weights)

TEST WINDOW:
- 30 minutes of testing included
- Test UI with input/output visualization
- Request logging
- "Respin Endpoint" button if test window expires
- Clear timer display

OWNERSHIP TRANSFER:
- Endpoint is created on USER's RunPod account
- User's API key is used for all operations
- KripTik does NOT have ongoing access
- Billing goes directly to user's RunPod account

RUNPOD CREDENTIAL FLOW:
1. Prompt for RunPod API key if not stored
2. Validate API key with RunPod API
3. Store encrypted in Credential Vault
4. Use for all RunPod operations

IMPORTANT: Use RunPod GitHub integration when possible:
- If model code is in GitHub, deploy directly without Docker Hub
- Reduces deployment time
- Eliminates Docker Hub as middleman

Production ready. Clear ownership. No ongoing KripTik involvement after deployment.
```

---

## PROMPT 6: AI Lab - Multi-Agent Research Orchestration

```
ULTRATHINK extensively. This is the most complex feature.

First, use websearch to find:
- "Multi-agent LLM orchestration patterns January 2026"
- "Agent communication protocols real-time 2026"
- "Claude API streaming multiple parallel requests 2026"
- "Research agent architecture papers 2026"

TASK: Create the AI Lab for KripTik AI - an autonomous research module with up to 5 parallel orchestrations.

AI Lab is accessed from the Dashboard and allows users to submit complex research/development problems that require extensive autonomous work.

CORE CONCEPT:
- User submits research problem with budget
- Up to 5 parallel orchestrations work simultaneously
- Agents communicate in real-time to avoid redundancy
- Each orchestration follows Build Loop protocols
- Results are synthesized into final solution
- All within user-defined budget

CREATE these files:
1. src/components/ai-lab/AILab.tsx - Main container
2. src/components/ai-lab/ResearchPrompt.tsx - Problem input UI
3. src/components/ai-lab/BudgetConfig.tsx - Budget and constraints
4. src/components/ai-lab/OrchestrationGrid.tsx - 5 orchestration tiles
5. src/components/ai-lab/OrchestrationTile.tsx - Individual orchestration display
6. src/components/ai-lab/AgentCommunication.tsx - Real-time agent chat visualization
7. src/components/ai-lab/ResultsSynthesis.tsx - Final results display
8. src/store/useAILabStore.ts - Zustand store
9. server/src/services/ai-lab/lab-orchestrator.ts - Main orchestrator
10. server/src/services/ai-lab/research-agent.ts - Individual research agent
11. server/src/services/ai-lab/agent-communicator.ts - Inter-agent communication
12. server/src/services/ai-lab/result-synthesizer.ts - Results synthesis
13. server/src/routes/ai-lab.ts - AI Lab API endpoints
14. Update server/src/schema.ts - Add aiLabSessions, aiLabOrchestrations tables

ORCHESTRATION ARCHITECTURE:
Each of the 5 orchestrations is a full Build Loop instance:
- Phase 0: Intent Lock (problem-specific contract)
- Phase 1: Initialization (research setup)
- Phase 2: Parallel Research (agents gather information)
- Phase 3: Integration (combine findings)
- Phase 4: Verification (validate conclusions)
- Phase 5: Intent Satisfaction (problem solved?)
- Phase 6: Results Presentation

INTER-AGENT COMMUNICATION:
- Shared message bus for all 5 orchestrations
- Real-time updates: "I'm researching X, don't duplicate"
- Findings sharing: "I found Y, may be relevant to your work"
- Conflict resolution: "Our conclusions differ on Z, need synthesis"
- Use Server-Sent Events for frontend updates

COMMUNICATION PROTOCOL:
1. Each agent announces its current focus area
2. Agents listen for announcements and adjust
3. Periodic sync points for sharing findings
4. Final synthesis round for combining results

BUDGET CONTROLS:
- Total budget across all 5 orchestrations
- Per-orchestration budget limits
- Real-time cost tracking
- Auto-pause when 80% budget consumed
- Hard stop at budget limit
- Cost breakdown by: API calls, compute time, tokens

UI REQUIREMENTS:
- Grid of 5 orchestration tiles
- Each tile shows: status, current phase, progress, cost
- Agent communication feed (like a chat log)
- Expanding tile for detailed view
- Real-time SSE streaming updates
- Final synthesis panel with combined results

SPAWN ASYNC AGENTS:
When implementing the orchestrator, spawn agents asynchronously:
- Use Promise.all for parallel orchestration startup
- Each orchestration runs independently
- Communication via shared message bus
- Synthesizer waits for all to complete or timeout

VERIFICATION:
- Use Verification Swarm (Error Checker, Code Quality, Security Scanner)
- Skip Anti-Slop (frontend-only concern)
- Skip Visual Verifier unless UI is involved
- Add Research Quality agent specific to AI Lab

DESIGN:
- Premium visualization of 5 parallel processes
- Animated connections between communicating agents
- Pulse effects for active orchestrations
- Glass morphism panels
- Energy flow visualization between tiles

This is the most advanced feature in KripTik. Production ready with full error handling and budget controls.
```

---

## PROMPT 7: GPU Build Loop Integration

```
THINK about integration points carefully before modifying existing code.

First, use websearch to find:
- "RunPod serverless cold start optimization 2026"
- "GPU inference testing automation 2026"
- "Backend API testing patterns 2026"

TASK: Integrate GPU resources into the existing Build Loop for backend/AI workloads.

When a build requires GPU resources (detected by GPU Resource Classifier), the Build Loop must handle GPU deployment as part of the standard build process.

MODIFY these files:
1. server/src/services/automation/build-loop.ts - Add GPU phases
2. server/src/services/ai/intent-lock.ts - Include GPU requirements in contract
3. server/src/services/verification/swarm.ts - Add GPU-specific verification
4. server/src/services/automation/error-escalation.ts - GPU error handling

NEW GPU PHASES (integrated into existing 6-phase loop):

Phase 2 MODIFICATION (Parallel Build):
- If GPU required, spawn GPU deployment agent alongside code agents
- GPU agent provisions RunPod endpoint
- Code agents build API/frontend that will call the endpoint
- Agents share endpoint URL via context

Phase 4 MODIFICATION (Functional Test):
- Include GPU endpoint testing
- Verify endpoint responds correctly
- Test with sample inputs
- Measure latency and throughput
- Verify cost is within estimates

Phase 5 MODIFICATION (Intent Satisfaction):
- Verify GPU functionality meets requirements
- Check performance benchmarks
- Validate cost projections

VERIFICATION SWARM ADDITIONS:
- GPUEndpointChecker: Verify endpoint is healthy and responsive
- CostValidator: Ensure actual costs match estimates
- PerformanceValidator: Check latency/throughput requirements

ERROR ESCALATION FOR GPU:
Level 1: Retry deployment with same config
Level 2: Try different GPU type
Level 3: Try different quantization
Level 4: Manual intervention required

IMPORTANT: Backend/GPU development follows same Build Loop protocols as frontend, EXCEPT:
- No Anti-Slop detection (that's for UI only)
- No Visual Verifier (no UI to verify)
- Add GPU-specific verification instead

The GPU integration must be seamless - users just describe what they want in NLP, and KripTik handles all GPU provisioning automatically.

Production ready. Minimal changes to existing code. Follow existing patterns.
```

---

## PROMPT 8: Credential & Cost Management

```
THINK about security and user experience.

First, use websearch to find:
- "API key encryption at rest best practices 2026"
- "Cloud cost estimation APIs 2026"
- "Stripe usage-based billing patterns 2026"

TASK: Enhance credential management and add comprehensive cost tracking for GPU/training features.

CREDENTIAL REQUIREMENTS:
1. HuggingFace token (REQUIRED for Open Source Studio)
2. RunPod API key (required for deployment)
3. Both stored encrypted in Credential Vault

MODIFY/CREATE these files:
1. server/src/services/credentials/credential-vault.ts - Add HF/RunPod support
2. src/components/credentials/CredentialManager.tsx - Enhanced UI
3. server/src/services/billing/gpu-cost-tracker.ts - GPU cost tracking
4. server/src/routes/credentials.ts - Credential management endpoints

CREDENTIAL VAULT ENHANCEMENTS:
- Support for 'huggingface' credential type
- Support for 'runpod' credential type
- Validation on storage (verify tokens work)
- Refresh/rotation support
- Audit logging for credential access

COST TRACKING:
- Track all RunPod costs (training, inference, storage)
- Track HuggingFace Pro costs if applicable
- Real-time cost display during operations
- Historical cost analytics
- Budget alerts (80%, 90%, 100% thresholds)

WARNING SYSTEM:
1. "RunPod volume storage charges apply while your model is stored"
2. "Training estimated at $X.XX - actual cost may vary"
3. "You've used 80% of your set budget"
4. "Endpoint idle timeout will incur cold start latency"

INTEGRATION:
- Show cost warnings in Training UI
- Show cost warnings in Deployment UI
- Add cost column to AI Lab orchestrations
- Update existing credit system if needed

Production ready. Clear warnings. Encrypted storage.
```

---

## PROMPT 9: Dashboard Integration & Navigation

```
THINK about UX flow and discoverability.

TASK: Integrate all new features into KripTik's existing dashboard and navigation.

CREATE/MODIFY these files:
1. src/components/dashboard/Dashboard.tsx - Add AI Lab card
2. src/components/developer/DeveloperToolbar.tsx - Add Open Source Studio button
3. src/App.tsx or router - Add routes for new pages
4. src/components/navigation/* - Update navigation if needed

DASHBOARD ADDITIONS:
- "AI Lab" card in dashboard grid
- Shows: active research sessions, total cost, recent results
- Click to open AI Lab

DEVELOPER TOOLBAR:
- "Open Source Studio" button with custom icon
- Opens full-screen modal for model browser
- Quick access to recent models and training jobs

ROUTING:
- /ai-lab - AI Lab page
- /open-source-studio - Alternative route (modal can also work)
- /training/:jobId - Training job details
- /endpoints - Deployed endpoints management

NAVIGATION PATTERNS:
- Follow existing KripTik navigation patterns
- Consistent styling with existing components
- Premium design standards (depth, motion, typography)
- No emoji in navigation

Wire up completely. No orphaned routes.
```

---

## PROMPT 10: Final Integration & Testing

```
THINK about integration testing and edge cases.

TASK: Final integration pass ensuring all components work together.

VERIFICATION CHECKLIST:
1. GPU Resource Classifier integrates with Intent Lock
2. Open Source Studio opens from Developer Toolbar
3. HuggingFace token validation works
4. Training jobs create and track correctly
5. Endpoint deployment works with user's RunPod account
6. AI Lab spawns 5 parallel orchestrations
7. Agent communication is real-time
8. Cost tracking is accurate
9. All credentials stored securely
10. Error escalation handles GPU failures

CREATE these files:
1. server/src/services/ml/__tests__/gpu-classifier.test.ts
2. server/src/services/ai-lab/__tests__/lab-orchestrator.test.ts
3. Integration test plan document

RUN THESE CHECKS:
1. npm run build - Must pass
2. npm run typecheck - No TypeScript errors
3. npm run lint - No ESLint errors
4. All new routes registered and accessible
5. All new stores properly initialized
6. All components properly imported and rendered

DOCUMENTATION:
- Update feature_list.json with new features
- Update .claude/rules/01-session-context.md
- Add any gotchas to .claude/rules/02-gotchas.md

Production ready. Full integration. All tests passing.
```

---

## Implementation Order

Execute prompts in this order for best results:

| Order | Prompt | Description | Dependencies |
|-------|--------|-------------|--------------|
| 1 | Prompt 1 | GPU Resource Classifier | Foundation - no deps |
| 2 | Prompt 3 | HuggingFace Token Connection | Required first for training |
| 3 | Prompt 2 | Open Source Studio UI | Depends on 1, 3 |
| 4 | Prompt 4 | Training Module | Depends on 2, 3 |
| 5 | Prompt 5 | Endpoint Deployment | Depends on 4 |
| 6 | Prompt 8 | Credential & Cost Management | Parallel with 4-5 |
| 7 | Prompt 7 | GPU Build Loop Integration | Depends on 1 |
| 8 | Prompt 6 | AI Lab | Depends on 7 |
| 9 | Prompt 9 | Dashboard Integration | After core features |
| 10 | Prompt 10 | Final Integration | Last |

---

## Usage Notes

### For Cursor 2.2 with Opus 4.5:
1. Copy each prompt entirely including the websearch instructions
2. Select Opus 4.5 model in Cursor settings
3. Paste prompt into chat
4. Allow Claude to use ultrathink/think hard as instructed
5. Verify build passes after each prompt before proceeding

### For Claude Code Extension:
1. Copy prompt into Claude Code chat
2. Prompts will trigger appropriate thinking depth automatically
3. Allow async agent spawning for parallel work
4. Monitor token usage - these are substantial prompts

### General Guidelines:
- Each prompt is self-contained but builds on previous work
- Websearch ensures January 2026 current information
- All prompts enforce KripTik's design standards (no emoji, no flat designs, premium depth)
- Backend/GPU follows Build Loop protocols minus anti-slop (frontend-only)
- HuggingFace token is REQUIRED, not optional
- Users must be warned about RunPod storage costs

---

## Key Technical Decisions

### Storage
- **Model weights**: User's HuggingFace account (REQUIRED connection)
- **LoRA adapters**: User's HuggingFace account (small, easy to store)
- **Full fine-tunes**: User's HuggingFace account (WARNING about size)
- **No KripTik cloud storage**: Models can be hundreds of GB

### Ownership
- **RunPod endpoints**: Created on user's account with user's API key
- **Training jobs**: Run on user's RunPod, billed to user
- **Models**: Saved to user's HuggingFace, user owns completely

### Costs
- Users pay RunPod directly for GPU usage
- Users pay HuggingFace for storage (if exceeds free tier)
- KripTik provides estimation but actual costs may vary
- Volume storage costs are ongoing (warn users)

### AI Lab
- Up to 5 parallel orchestrations
- Real-time inter-agent communication
- Budget controls with hard stops
- Full Build Loop per orchestration (minus anti-slop for backend)

---

*Document created for KripTik AI GPU & AI Lab feature implementation*
*Last updated: January 6, 2026*
