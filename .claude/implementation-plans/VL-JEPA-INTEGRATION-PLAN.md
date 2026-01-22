# VL-JEPA Integration Implementation Plan

> **Created**: 2026-01-21
> **Purpose**: Comprehensive, actionable implementation plan for VL-JEPA concepts integration into KripTik AI
> **Format**: Structured prompts that can be pasted into Claude Code for execution

---

## Executive Summary

### Current State (Honest Assessment)
| Component | Status | Details |
|-----------|--------|---------|
| VL-JEPA Handler | **EXISTS** | `handler.py` uses SigLIP as substitute (V-JEPA 2 is video-only) |
| VL-JEPA Provider | **EXISTS** | `runpod-vl-jepa-provider.ts` with embed, predict, video methods |
| Deploy Script | **EXISTS** | `deploy.ts` GraphQL-based RunPod deployment |
| Build Script | **EXISTS** | `build-images.sh` Docker image building |
| Integration Points | **31 FILES** | VL-JEPA referenced throughout codebase |
| Docker Images | **NOT BUILT** | Need to build and push to Docker Hub |
| RunPod Endpoints | **NOT DEPLOYED** | Need RUNPOD_API_KEY and deployment |
| Model-Agnostic Memory | **NOT EXISTS** | Needs to be created from scratch |

### Recommended Model Stack
Based on research (January 2026), here's the optimal model selection:

| Use Case | Recommended Model | Alternative | Why |
|----------|-------------------|-------------|-----|
| **Text Embeddings** | BGE-M3 (1024 dims) | Voyage AI | Multi-lingual, state-of-the-art |
| **Visual Embeddings** | SigLIP 2 (1152 dims) | CLIP | Better text-image alignment |
| **Intent Understanding** | SigLIP + BGE-M3 hybrid | - | Cross-modal fusion |
| **Video Understanding** | V-JEPA 2 (Meta) | VideoMAE v2 | True temporal reasoning |
| **Code Embeddings** | Voyage-code-3 | BGE-M3 | Code-specific optimization |

---

## Implementation Prompts

### Phase 1: RunPod Deployment Infrastructure

#### Prompt 1.1: Build and Push Docker Images

```
Task: Build and push all KripTik AI embedding worker Docker images to Docker Hub.

Prerequisites:
1. Docker must be running
2. Must be logged into Docker Hub (docker login)
3. Docker Hub username should be set as DOCKER_HUB_USERNAME environment variable

Steps:
1. Navigate to the runpod-workers directory
2. Build all three images (bge-m3, siglip, vl-jepa) for linux/amd64 platform
3. Push each image to Docker Hub with tag "v4-safetensors"
4. Verify all images are pushed successfully

Execute:
cd /Volumes/Logan\ T7\ Touch/KripTik\ AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/embeddings/runpod-workers

# Check Docker is running
docker info

# Build and push all images
./build-images.sh all

# Verify images exist on Docker Hub
docker images | grep kriptik

Expected outputs:
- kriptikai/kriptik-bge-m3:v4-safetensors pushed
- kriptikai/kriptik-siglip:v4-safetensors pushed
- kriptikai/kriptik-vl-jepa:v4-safetensors pushed
```

---

#### Prompt 1.2: Deploy RunPod Serverless Endpoints

```
Task: Deploy all embedding models to RunPod Serverless using the deploy script.

Prerequisites:
1. RUNPOD_API_KEY must be set in environment
2. Docker images must be pushed to Docker Hub
3. DOCKER_HUB_USERNAME must be set

Steps:
1. Verify RUNPOD_API_KEY is set
2. Run the deployment script
3. Save the endpoint IDs to .env file
4. Verify endpoints are responding

Execute:
# Set environment (replace with actual values)
export RUNPOD_API_KEY="your-runpod-api-key"
export DOCKER_HUB_USERNAME="kriptikai"

cd /Volumes/Logan\ T7\ Touch/KripTik\ AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/embeddings/runpod-workers

# Deploy all endpoints
npx tsx deploy.ts

# The script will output environment variables to add to .env
# Copy those lines to your .env file

Expected output:
RUNPOD_ENDPOINT_BGE_M3=<endpoint_id>
RUNPOD_ENDPOINT_SIGLIP=<endpoint_id>
RUNPOD_ENDPOINT_VL_JEPA=<endpoint_id>
```

---

#### Prompt 1.3: Update Environment Configuration

```
Task: Update the .env and .env.example files with RunPod configuration.

Read the current .env.example file and add these RunPod configuration variables if not present:

# RunPod Configuration
RUNPOD_API_KEY=
DOCKER_HUB_USERNAME=kriptikai

# Embedding Endpoints (populated by deploy.ts)
RUNPOD_ENDPOINT_BGE_M3=
RUNPOD_ENDPOINT_SIGLIP=
RUNPOD_ENDPOINT_VL_JEPA=

# Full URLs (auto-constructed if endpoint IDs set)
RUNPOD_URL_BGE_M3=
RUNPOD_URL_SIGLIP=
RUNPOD_URL_VL_JEPA=

# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

File: /Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/.env.example
```

---

### Phase 2: Enhanced VL-JEPA Handler with Actual V-JEPA 2

#### Prompt 2.1: Upgrade VL-JEPA Handler for True Video Understanding

```
Task: Upgrade the VL-JEPA handler to use actual V-JEPA 2 for video understanding while keeping SigLIP for text/image.

The current handler at:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/embeddings/runpod-workers/vl-jepa/handler.py

Currently uses SigLIP for all modalities. We need to:
1. Add V-JEPA 2 model loading from facebook/vjepa-vitl-16
2. Use V-JEPA 2 ONLY for video/temporal understanding (its specialty)
3. Keep SigLIP for text and static images (better for those)
4. Implement intelligent routing based on input type:
   - type="intent" → SigLIP (text)
   - type="visual_text" → SigLIP (image+text)
   - type="video" → V-JEPA 2 (temporal reasoning)
   - type="predictive" → SigLIP (pattern matching)

Implementation requirements:
- Load V-JEPA 2 with safetensors to bypass CVE-2025-32434
- V-JEPA 2 outputs 1024-dimensional embeddings (matches our standard)
- Implement temporal frame sampling for videos (16 frames default)
- Add attention pooling for video frame aggregation
- Handle cold starts gracefully (V-JEPA 2 has ~60s cold start)

The handler should detect CUDA availability and use GPU if present.
Model weights should be cached to /models volume for faster cold starts.

DO NOT use placeholder code. This must be production-ready.
```

---

#### Prompt 2.2: Create Jina Embeddings v4 Provider (Alternative)

```
Task: Create a Jina Embeddings v4 provider as a cloud API fallback when RunPod has cold starts.

Create file:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/embeddings/providers/jina-embeddings-provider.ts

Jina v4 capabilities:
- Multi-modal (text, image, text+image)
- 1024 dimensions (matches our standard)
- Fast API with no cold starts
- Supports late interaction retrieval

Implementation requirements:
1. Implement EmbeddingProvider interface
2. Support text embedding via /v1/embeddings
3. Support image embedding via /v1/embeddings with images
4. Support hybrid text+image embedding
5. Add retry logic with exponential backoff
6. Cost tracking per 1K tokens
7. Health check endpoint

API details:
- Base URL: https://api.jina.ai
- API Key: JINA_API_KEY env var
- Model: jina-embeddings-v4
- Rate limit: 1000 req/min on paid plans

Use this as a fallback when:
- RunPod endpoints have cold starts (502/503)
- Latency is critical (Jina is faster but more expensive)
- RunPod is down

DO NOT use placeholder code. This must be production-ready.
```

---

### Phase 3: Model-Agnostic Memory System

#### Prompt 3.1: Design and Create Model-Agnostic Memory Architecture

```
Task: Create a model-agnostic persistent memory system for KripTik AI users that works across all AI models and improves with use.

Create the following files:

1. /server/src/services/memory/model-agnostic-memory.ts
   - Core memory service with storage abstraction
   - Works with ANY AI model (OpenAI, Anthropic, OpenRouter, local)
   - Uses Qdrant for vector storage, Turso for metadata

2. /server/src/services/memory/memory-encoder.ts
   - Converts memories to model-agnostic format
   - BGE-M3 embeddings for semantic search (1024 dims)
   - Structured metadata for filtering

3. /server/src/services/memory/collective-learning.ts
   - Anonymized pattern extraction from user builds
   - Contributes successful patterns to global knowledge base
   - Privacy-preserving (no PII in collective memory)

4. /server/src/services/memory/types.ts
   - TypeScript interfaces for memory system

Architecture based on research:
- MAGMA pattern: multi-graph (semantic, temporal, causal, entity)
- A-Mem pattern: Zettelkasten-style interconnected knowledge
- Google ADK pattern: ephemeral working view, model-agnostic storage

Memory types to support:
1. Session Memory - within current build session
2. User Memory - persists across sessions, user-specific
3. Project Memory - shared within a project
4. Collective Memory - anonymized global patterns

Key requirements:
- Model-agnostic: Store as structured data, not model-specific tokens
- Queryable: Semantic search + structured filters
- Compressible: Summarization for context limits
- Contributive: Learn from all users to improve platform
- Private: User data stays private, only patterns shared

Database schema additions needed in schema.ts:
- user_memories table
- memory_connections table (graph edges)
- collective_patterns table

DO NOT use placeholder code. This must be production-ready.
```

---

#### Prompt 3.2: Integrate Memory System with Build Loop

```
Task: Integrate the model-agnostic memory system into BuildLoopOrchestrator.

File to modify:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/automation/build-loop.ts

Integration points:

1. Phase 0 (Intent Lock) - Load relevant memories:
   - Query user memory for similar past intents
   - Query collective memory for successful patterns
   - Add to context before Intent Lock generation

2. Phase 2 (Parallel Build) - Use memory for decisions:
   - Retrieve architecture patterns from collective memory
   - Load user preferences from user memory
   - Use patterns to inform LATTICE agent decisions

3. Phase 5 (Intent Satisfaction) - Learn from outcomes:
   - On success: Store patterns in user memory
   - Extract anonymized patterns for collective memory
   - Update memory connections (what led to success)

4. Post-Build - Memory maintenance:
   - Compress session memories
   - Update memory embeddings if intent changed
   - Contribute successful patterns to collective

Required imports:
import { ModelAgnosticMemory } from '../memory/model-agnostic-memory.js';
import { CollectiveLearning } from '../memory/collective-learning.js';

Add memory property to BuildLoopOrchestrator class.
Initialize in constructor from singleton.

DO NOT use placeholder code. This must be production-ready.
```

---

### Phase 4: HyperThinking Integration

#### Prompt 4.1: Add VL-JEPA Visual Context to HyperThinking

```
Task: Integrate VL-JEPA visual understanding into the HyperThinking reasoning system.

Files to modify:
1. /server/src/services/hyper-thinking/orchestrator.ts
2. /server/src/services/hyper-thinking/tree-of-thought/tot-evaluator.ts
3. /server/src/services/hyper-thinking/multi-agent/agent-spawner.ts

Integration strategy:

1. In orchestrator.ts - Add visual context before strategy selection:
   - If task involves UI/UX, fetch visual context from VL-JEPA
   - Include visual embeddings in complexity analysis
   - Pass visual context to selected strategy

2. In tot-evaluator.ts - Score nodes with visual consistency:
   - For UI-related thoughts, check visual coherence
   - Use VL-JEPA to compare proposed UI with intent
   - Boost nodes with high visual-intent alignment
   - Prune nodes with visual inconsistency

3. In agent-spawner.ts - Spawn based on visual complexity:
   - Analyze visual requirements with VL-JEPA
   - Spawn design-specialist agents for complex UIs
   - Include visual context in agent prompts

Required imports:
import { getVLJEPAProvider } from '../../embeddings/providers/runpod-vl-jepa-provider.js';
import { VisualUnderstandingService } from '../../embeddings/visual-understanding-service.js';

New method needed in orchestrator:
async analyzeVisualContext(task: string, screenshots?: string[]): Promise<VisualContext>

The visual context should include:
- visualComplexity: number (0-100)
- designPatterns: string[]
- colorScheme?: string
- layoutType?: string
- similarDesigns: DesignMatch[]

DO NOT use placeholder code. This must be production-ready.
```

---

### Phase 5: Continuous Learning Enhancement

#### Prompt 5.1: Enhance VL-JEPA Feedback Loop with Actual Predictions

```
Task: Enhance the VL-JEPA feedback loop to use actual predictive embeddings for build outcome prediction.

File to modify:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/continuous-learning/vl-jepa-feedback.ts

Current state:
- Records build outcomes with BGE-M3 embeddings
- Predicts satisfaction using pattern similarity
- Returns optimization flags

Enhancements needed:

1. Use actual VL-JEPA predictive mode:
   - Call provider.predict() with intent + historical patterns
   - Use predictions.success_probability for confidence
   - Use predictions.potential_issues for warnings
   - Use predictions.recommended_patterns for optimization

2. Add visual outcome learning:
   - Store screenshots of successful builds
   - Use VL-JEPA visual_text mode to embed screenshots + intent
   - Build visual pattern library for each intent type
   - Compare new build screenshots against successful patterns

3. Implement prediction calibration:
   - Track prediction accuracy over time
   - Adjust confidence scores based on historical accuracy
   - Weight recent outcomes more heavily

4. Add pattern contribution to collective memory:
   - On build success, extract successful patterns
   - Anonymize and store in collective memory
   - Use for future predictions across all users

Integration with Evolution Flywheel:
- Feed prediction accuracy to meta-learning layer
- Use calibrated predictions for shadow model training
- Contribute patterns to continuous improvement

DO NOT use placeholder code. This must be production-ready.
```

---

### Phase 6: Context Compression with VL-JEPA

#### Prompt 6.1: Enhance Context Overflow with Semantic Compression

```
Task: Enhance the context overflow system to use VL-JEPA for semantic-aware compression.

File to modify:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/agents/context-overflow.ts

Current behavior:
- Triggers at 180K token threshold
- Compresses to ~20% using summarization
- Performs seamless agent handoff

Enhancements needed:

1. Semantic importance scoring with VL-JEPA:
   - Embed each context section with BGE-M3
   - Compare embeddings to current intent
   - Score sections by semantic relevance
   - Preserve high-relevance sections in full

2. Multi-modal context handling:
   - Detect images/screenshots in context
   - Embed with VL-JEPA visual_text mode
   - Store visual embeddings for later retrieval
   - Replace inline images with embedding references

3. Intelligent compression strategy:
   - Critical sections (intent, current errors): 100% preserved
   - Relevant code: 80% preserved
   - Historical context: Compressed to embeddings + summary
   - Visual content: Embeddings only (retrievable)

4. Compression quality metrics:
   - Measure semantic drift after compression
   - Track information loss using embedding similarity
   - Adjust compression ratio based on task complexity

New method:
async compressWithSemanticAwareness(
  context: AgentContext,
  targetRatio: number,
  intent: string
): Promise<CompressedContext>

The CompressedContext should include:
- compressedText: string
- preservedSections: Section[]
- embeddingReferences: EmbeddingRef[]
- retrievableContent: Map<string, string>
- compressionMetrics: CompressionMetrics

DO NOT use placeholder code. This must be production-ready.
```

---

### Phase 7: Builder View Frontend Integration

#### Prompt 7.1: Complete Builder View WebSocket Integration

```
Task: Complete the 6 missing frontend integrations in Builder View for full build loop visualization.

Files to create/modify:
1. /client/src/components/builder/BuildPhaseIndicator.tsx - Show current phase
2. /client/src/components/builder/IntentContractDisplay.tsx - Show Sacred Contract
3. /client/src/components/builder/AgentDemoOverlay.tsx - Auto-trigger on phase_complete
4. /client/src/hooks/useBuildWebSocket.ts - Handle all build events
5. /client/src/stores/buildStore.ts - Zustand store for build state

Gap 1 - WebSocket handler for phase_complete with browser_demo:
- Listen for phase_complete event
- If phase === 'browser_demo', extract demoUrl
- Auto-open AgentDemoOverlay with the URL
- Show "Take Control" button

Gap 2 - Auto-trigger AgentDemoOverlay:
- When browser_demo phase completes, overlay shows automatically
- User sees live preview of their built app
- Can interact with the demo
- "Take Control" button transfers to full editor

Gap 3 - BuildPhaseIndicator display:
- Show during all builds
- 6 phases with progress
- Current phase highlighted
- Phase timing displayed

Gap 4 - Intent Contract display:
- Show the Sacred Contract from Phase 0
- Display in collapsible panel
- Highlight must-have vs nice-to-have
- Show intent satisfaction score

Gap 5 - Speed Dial integration:
- Quick actions for common build operations
- Connect to existing SpeedDial component
- Add build-specific actions

Gap 6 - "Take Control" button:
- Visible during agent demo
- Transfers from demo to full editor
- Preserves all build state

WebSocket events to handle:
- build_started: { buildId, intent, phases }
- phase_started: { phase, phaseIndex, timestamp }
- phase_progress: { phase, progress, message }
- phase_complete: { phase, result, demoUrl? }
- build_complete: { buildId, success, artifacts }
- build_error: { phase, error, canRetry }

DO NOT use placeholder code. This must be production-ready.
```

---

### Phase 8: Deployment Automation

#### Prompt 8.1: Create One-Click Deployment Script

```
Task: Create a comprehensive deployment script that handles all infrastructure setup.

Create file:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/scripts/deploy-infrastructure.ts

The script should:

1. Verify prerequisites:
   - Docker installed and running
   - Docker Hub credentials
   - RunPod API key
   - Qdrant running (local or cloud)
   - Environment variables set

2. Build and push Docker images:
   - Build for linux/amd64
   - Tag with version and 'latest'
   - Push to Docker Hub
   - Verify push success

3. Deploy RunPod endpoints:
   - Create/update bge-m3 endpoint
   - Create/update siglip endpoint
   - Create/update vl-jepa endpoint
   - Configure scaling (0-3 workers)
   - Set idle timeout

4. Setup Qdrant collections:
   - Create all 7 collections if not exist
   - Configure proper dimensions
   - Set up indices for filtering

5. Update environment:
   - Write endpoint IDs to .env
   - Verify connectivity to all services
   - Run health checks

6. Generate deployment report:
   - List all deployed services
   - Show endpoint URLs
   - Display health status
   - Estimate monthly costs

Usage:
npx tsx scripts/deploy-infrastructure.ts --env=production

Flags:
--env: production | staging | development
--skip-docker: Skip Docker build/push
--skip-runpod: Skip RunPod deployment
--skip-qdrant: Skip Qdrant setup
--dry-run: Show what would be done

DO NOT use placeholder code. This must be production-ready.
```

---

## Execution Order

Execute prompts in this order for optimal results:

### Day 1: Infrastructure
1. Prompt 1.1 - Build Docker images
2. Prompt 1.2 - Deploy RunPod endpoints
3. Prompt 1.3 - Update environment configuration

### Day 2: Enhanced Models
4. Prompt 2.1 - Upgrade VL-JEPA handler
5. Prompt 2.2 - Create Jina fallback provider

### Day 3: Memory System
6. Prompt 3.1 - Create model-agnostic memory
7. Prompt 3.2 - Integrate with Build Loop

### Day 4: Intelligence Enhancements
8. Prompt 4.1 - HyperThinking integration
9. Prompt 5.1 - Continuous learning enhancement

### Day 5: Context & Frontend
10. Prompt 6.1 - Context compression
11. Prompt 7.1 - Builder View frontend

### Day 6: Automation & Testing
12. Prompt 8.1 - Deployment automation
13. End-to-end testing

---

## Cost Estimates

### RunPod (Monthly)
| Endpoint | GPU | Cost/hr | Est. Hours | Monthly |
|----------|-----|---------|------------|---------|
| BGE-M3 | A4000 | $0.24 | 100 | $24 |
| SigLIP | A4000 | $0.24 | 100 | $24 |
| VL-JEPA | A4000 | $0.24 | 50 | $12 |
| **Total** | | | | **$60** |

### Qdrant Cloud (Optional)
| Tier | Storage | Monthly |
|------|---------|---------|
| Free | 1GB | $0 |
| Starter | 25GB | $25 |
| Growth | 100GB | $100 |

### API Fallbacks
| Provider | Cost/1M tokens |
|----------|----------------|
| Jina v4 | $0.20 |
| Voyage | $0.10 |
| OpenAI | $0.13 |

---

## Success Metrics

After implementation, verify:

1. **RunPod Health**: All 3 endpoints return healthy
2. **Embedding Quality**: Cosine similarity > 0.85 for similar intents
3. **Build Prediction**: Accuracy > 80% on build success prediction
4. **Memory Retrieval**: < 100ms for user memory queries
5. **Context Compression**: < 5% semantic drift after compression
6. **Frontend**: All 6 builder view gaps closed
7. **End-to-End**: Full build completes with demo in < 5 minutes

---

## References

- [RunPod Serverless Documentation](https://docs.runpod.io/serverless/overview)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [VL-JEPA Paper](https://arxiv.org/abs/2309.12347)
- [BGE-M3 Model Card](https://huggingface.co/BAAI/bge-m3)
- [SigLIP 2 Model Card](https://huggingface.co/google/siglip-so400m-patch14-384)
- [MAGMA Memory Architecture](https://arxiv.org/html/2601.03236v1)
- [A-Mem Agentic Memory](https://openreview.net/forum?id=FiM0M8gcct)

---

*This plan replaces all previous VL-JEPA implementation documents.*
