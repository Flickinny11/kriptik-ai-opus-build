# KripTik AI Enhancement Plan v3.0
## Production-Ready Implementation Prompts for Opus 4.5
### Last Updated: January 6, 2026
### Changes: v3.0 - Removed KripToeNite (merged into main flow), updated all model IDs to Jan 2026, corrected 8-Phase Build Loop, corrected 13-agent verification swarm, added two-stage Intent Lock, added Tournament Mode, enhanced Component 28 with VL-JEPA per ultimate plan

---

## Critical Implementation Notes

> **API ROUTING ARCHITECTURE (CRITICAL)**:
> - **OpenAI Models (GPT-5.2)** → Direct OpenAI API (api.openai.com)
> - **Anthropic Models (Claude)** → Direct Anthropic API (api.anthropic.com)
> - **All Other Models** → OpenRouter (openrouter.ai) - DeepSeek, Llama, Qwen, Mistral, GLM, Kimi
>
> **INFRASTRUCTURE OWNERSHIP MODEL**:
> - **KripTik's Account**: Training, testing, sandboxes (metered billing to users)
> - **User's Account**: Production deployment option (user manages own costs)
> - **Cleanup Required**: Auto-archive 30 days, auto-delete 90 days for abandoned apps
>
> **MODEL ROUTING CLARIFICATION**:
> The existing model-router.ts and openrouter-client.ts handle all routing.
> No new ModelOrchestrator needed. ENHANCE existing routing with new model IDs.
> The Build Loop calls existing routing services - all existing features remain unchanged.
>
> **NO MODEL SELECTOR ON BUILDER VIEW**:
> Users enter their NLP request and receive the BEST experience automatically.
> KripTik routes to optimal models based on task type - users don't choose models.

---

> **EXISTING FEATURES (DO NOT REPLACE)**:
> KripTik AI already has these features fully implemented:
> - Modal Sandboxing & Multi-Sandbox Orchestrator (20 parallel sandboxes)
> - AI Lab with 5 parallel orchestrations
> - Open Source Studio with HuggingFace integration (100K+ models)
> - Context Bridge (Redis-based real-time sharing)
> - RunPod GPU integration
> - Vercel deployment
> - Automated deployment workflows
> - Harness System (Artifact Manager, InitializerAgent, Context Loader)
> - **8-Phase Build Loop** (Init → Plan → Implement → Verify → Test → Deploy → Monitor → Learn)
> - **13-Agent Verification Swarm** (6 core + 7 gap closers)
> - **5-Layer Learning Engine** (L1-L5)
> - **Existing model-router.ts** (cost optimization routing)
> - **Existing openrouter-client.ts** (600+ lines, full OpenRouter integration)
>
> **NEW FEATURES (TO BE ADDED)**:
> - VL-JEPA semantic embedding system (dramatically enhances Component 28)
> - Hyper-Thinking cognitive pipeline
> - Qdrant vector database for embeddings (NO existing vector DB)
> - Extended/Interleaved Thinking integration
> - OpenAI Responses API integration (GPT-5.2 variants)
> - Two-Stage Intent Lock System (Plan Approval + Final Contract)
> - Tournament Mode with Hyper-Thinking (optional, costs more)
> - Context Compaction for 24-hour builds
> - Cleanup mechanism for abandoned apps
>
> **ENHANCEMENTS (EXTEND EXISTING)**:
> - Update model-router.ts with January 2026 model IDs
> - Add semantic verification as 14th agent in swarm
> - Error escalation enhances existing 4-Level system
>
> Always review existing code before implementing. Preserve existing functionality.

---

## Verified Model IDs (January 6, 2026)

| Model | Model ID | Provider | API Route | Best For | Cost (per 1M tokens) |
|-------|----------|----------|-----------|----------|---------------------|
| **Claude Opus 4.5** | `claude-opus-4-5-20251101` | Anthropic | Direct | Complex coding, extended thinking | $15 in / $75 out |
| **Claude Sonnet 4.5** | `claude-sonnet-4-5-20250929` | Anthropic | Direct | Balanced quality/cost | $3 in / $15 out |
| **Claude Haiku 4.5** | `claude-haiku-4-5` | Anthropic | Direct | Fast responses, simple tasks | $0.25 in / $1.25 out |
| **GPT-5.2 Thinking** | `gpt-5.2` | OpenAI | Direct | Complex reasoning, planning | $15 in / $60 out |
| **GPT-5.2 Instant** | `gpt-5.2-instant` | OpenAI | Direct | Fast responses | $1.75 in / $14 out |
| **GPT-5.2 Pro** | `gpt-5.2-pro` | OpenAI | Direct | Maximum reasoning (xhigh effort) | $30 in / $120 out |
| **DeepSeek V3.2** | `deepseek-chat` | DeepSeek | OpenRouter | Cost-effective general | $0.028 in / $0.14 out |
| **DeepSeek Reasoner** | `deepseek-reasoner` | DeepSeek | OpenRouter | Thinking mode | $0.55 in / $2.19 out |
| **GLM 4.7** | `glm-4-plus` | Zhipu AI | OpenRouter | 73.8% SWE-bench | ~$0.50 in / $0.75 out |
| **Kimi K2** | `moonshot/kimi-k2` | Moonshot AI | OpenRouter | 256K context, thinking | ~$0.60 in / $1.20 out |
| **Llama 3.3 70B** | `meta-llama/llama-3.3-70b-instruct` | Meta | OpenRouter | Open source, self-hostable | ~$0.50 in / $0.75 out |

---

## Table of Contents

1. [Architecture Overview & Integration Map](#section-1-architecture-overview--integration-map)
2. [VL-JEPA Semantic Understanding & Component 28 Enhancement](#section-2-vl-jepa-semantic-understanding--component-28-enhancement)
3. [Hyper-Thinking Cognitive Pipeline](#section-3-hyper-thinking-cognitive-pipeline)
4. [Model Enhancement Integration (2026 APIs)](#section-4-model-enhancement-integration-2026-apis)
5. [KripTik Cloud Infrastructure](#section-5-kriptik-cloud-infrastructure)
6. [Quality & Verification Enhancements](#section-6-quality--verification-enhancements)
7. [Two-Stage Intent Lock System](#section-7-two-stage-intent-lock-system)
8. [Tournament Mode with Hyper-Thinking](#section-8-tournament-mode-with-hyper-thinking)
9. [Context Compaction System](#section-9-context-compaction-system)
10. [Implementation Sequence & Dependencies](#section-10-implementation-sequence--dependencies)

---

# Section 1: Architecture Overview & Integration Map

## Current KripTik AI Architecture (As Implemented)

### Core Components
- **Frontend**: React 18.3.1 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express 5 + TypeScript + Drizzle ORM
- **Database**: Turso (SQLite) with 25+ tables
- **State**: TanStack Query + Zustand

### 8-Phase Build Loop (CORRECTED)
```
Phase 0: Initialization (Modal sandbox, project scaffold)
Phase 1: Planning (AI analysis, task breakdown)
Phase 2: Implementation (Code generation, file writes)
Phase 3: Verification (13-agent swarm validation)
Phase 4: Testing (Unit, integration, E2E)
Phase 5: Delivery (Build, deploy, artifacts)
Phase 6: Monitoring (Performance, errors, health)
Phase 7: Learning (Pattern extraction, L1-L5 updates)
```

### 13-Agent Verification Swarm (CORRECTED)

**6 Core Agents:**
1. Error Checker Agent
2. Code Quality Agent
3. Visual Verifier Agent
4. Security Scanner Agent
5. Placeholder Eliminator Agent
6. Design Style Agent

**7 Gap Closer Agents:**
7. Dependency Validator Agent
8. API Contract Agent
9. Type Safety Agent
10. Performance Profiler Agent
11. Accessibility Checker Agent
12. Documentation Agent
13. Test Coverage Agent

**NEW (14th Agent):**
14. Semantic Verifier Agent (VL-JEPA based)

### 5-Layer Learning Engine (Component 28)
```
L1: Session Memory (immediate context, current build)
L2: Pattern Library (extracted patterns, error→fix mappings)
L3: Project Intelligence (project-specific knowledge)
L4: User Preferences (individual user patterns)
L5: Global Evolution (cross-project, cross-user learning)
```

### Existing Advanced Features
1. **Modal Sandboxing** - Cloud-hosted ephemeral execution environments
2. **Multi-Sandbox Orchestrator** - Up to 20 parallel build sandboxes
3. **AI Lab** - 5 parallel orchestrations for multi-agent research
4. **Open Source Studio** - HuggingFace integration, 100K+ models
5. **Context Bridge** - Redis-based real-time context sharing
6. **Harness System** - Artifact Manager, InitializerAgent, Context Loader
7. **4-Level Error Escalation** - L1 (auto-fix) → L2 (context expand) → L3 (human assist) → L4 (full restart)
8. **Existing model-router.ts** - Intelligent model routing with cost optimization
9. **Existing openrouter-client.ts** - Full OpenRouter integration for non-OpenAI/Anthropic models
10. **Speculative Parallel Execution** - (from KripToeNite, now merged into main flow)

### Integration Points for Enhancements

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KRIPTIK AI ENHANCED ARCHITECTURE v3.0                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐   │
│  │   VL-JEPA    │───▶│ HYPER-THINK  │───▶│   TWO-STAGE INTENT LOCK      │   │
│  │  Embeddings  │    │   Pipeline   │    │ [Plan Approval→Final Contract]│   │
│  └──────────────┘    └──────────────┘    └──────────────────────────────┘   │
│         │                   │                         │                      │
│         ▼                   ▼                         ▼                      │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                    8-PHASE BUILD LOOP                             │       │
│  │  [Init]→[Plan]→[Impl]→[Verify]→[Test]→[Deploy]→[Monitor]→[Learn] │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│         │                   │                         │                      │
│         ▼                   ▼                         ▼                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   13-AGENT   │    │  TOURNAMENT  │    │  COMPONENT   │                   │
│  │    SWARM     │    │    MODE      │    │     28       │                   │
│  │  + Semantic  │    │  (Optional)  │    │  VL-JEPA     │                   │
│  │   Verifier   │    │              │    │  Enhanced    │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                         │                      │
│         ▼                   ▼                         ▼                      │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │           KRIPTIK CLOUD (RunPod + Qdrant + Modal)                 │       │
│  │  [GPU Inference] [Vector Storage] [Session State] [Sandboxes]     │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │              NO MODEL SELECTOR - AUTO BEST EXPERIENCE             │       │
│  │     User enters NLP → KripTik routes to optimal model(s)          │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# Section 2: VL-JEPA Semantic Understanding & Component 28 Enhancement

## Implementation Prompt 2.1: VL-JEPA Core Integration (Dramatically Enhances Component 28)

```
PROMPT FOR OPUS 4.5 - VL-JEPA SEMANTIC EMBEDDINGS FOR COMPONENT 28

Context: KripTik AI has an existing 5-Layer Learning Engine (Component 28). VL-JEPA
semantic embeddings will DRAMATICALLY enhance this learning system by adding:
- Semantic similarity for pattern matching (L2)
- Embedding-based experience capture (L1)
- Embedding cluster patterns via Qdrant (L4)
- Evolution flywheel with vector-based insights (L5)

Current Files to Integrate With:
- server/src/services/ai/modal-sandbox-service.ts (Modal integration)
- server/src/services/verification/verification-swarm.ts (13-agent verification)
- server/src/services/build/intent-lock-service.ts (Intent Lock - will be enhanced to two-stage)
- server/src/db/schema.ts (Database schema)
- server/src/services/learning/ (Existing 5-Layer Learning Engine)

Task: Implement VL-JEPA semantic embedding system that dramatically enhances Component 28

Requirements:
1. Create server/src/services/ai/vl-jepa/embedding-service.ts:
   - Use HuggingFace Inference API with Qwen3-Embedding-8B model (SOTA as of Jan 2026)
   - Endpoint: https://api-inference.huggingface.co/models/Alibaba-NLP/Qwen3-Embedding-8B
   - Generate 4096-dimensional embeddings for:
     a. User intent text (from Intent Lock sacred contracts)
     b. Generated code (per-file and aggregate)
     c. UI component descriptions
     d. Test case specifications
     e. Error patterns (for L2 pattern matching)
     f. Successful resolution patterns (for learning)
   - Implement cosine similarity scoring between intent and output embeddings
   - Cache embeddings in Turso with table: intent_embeddings (id, project_id, embedding_type,
     vector_blob, created_at, metadata_json)

2. Create server/src/services/ai/vl-jepa/semantic-drift-detector.ts:
   - Monitor embedding drift during build phases
   - Alert when cosine similarity drops below 0.85 threshold
   - Integrate with 4-Level Error Escalation:
     * Drift 0.85-0.80: L1 auto-correction prompt
     * Drift 0.80-0.70: L2 context expansion with original intent
     * Drift below 0.70: L3 human review required
   - Log all drift events to learning_events table for L2 pattern extraction

3. Create server/src/services/ai/vl-jepa/visual-embedding-service.ts:
   - Use Modal sandbox to run screenshot comparisons
   - Generate embeddings from Playwright screenshots during verification
   - Compare visual embeddings against design intent embeddings
   - Integration point: verification-swarm.ts Visual Verifier agent

4. **COMPONENT 28 ENHANCEMENT - L1 Session Memory:**
   Update server/src/services/learning/l1-session-memory.ts:
   - Store embeddings for all session artifacts (intent, code, errors, fixes)
   - Enable semantic retrieval of relevant context
   - Use embeddings to find similar past problems within session

5. **COMPONENT 28 ENHANCEMENT - L2 Pattern Library:**
   Update server/src/services/learning/l2-pattern-library.ts:
   - Store error→fix patterns with embeddings
   - When new error occurs, find semantically similar past errors
   - Apply successful fix patterns based on embedding similarity (not just text matching)
   - Dramatically improves pattern matching accuracy

6. **COMPONENT 28 ENHANCEMENT - L4 User Preferences:**
   Update server/src/services/learning/l4-user-preferences.ts:
   - Build embedding clusters per user
   - Identify user's coding style patterns via embeddings
   - Personalize suggestions based on semantic similarity to user's past work

7. **COMPONENT 28 ENHANCEMENT - L5 Global Evolution:**
   Update server/src/services/learning/l5-global-evolution.ts:
   - Cross-project embedding analysis
   - Discover global patterns via embedding clustering in Qdrant
   - Feed successful patterns back to all users
   - Evolution flywheel: more users → more embeddings → better patterns → better results

8. Update server/src/services/verification/verification-swarm.ts:
   - Add VL-JEPA semantic verification as 14th agent in swarm
   - Agent role: Compare intent embeddings vs output embeddings
   - Failure criteria: cosine_similarity < 0.85
   - Pass embedding scores to build_artifacts for traceability

9. Database migrations (server/src/db/migrations/):
   - Add intent_embeddings table
   - Add embedding_comparisons table (intent_id, output_id, similarity_score, phase, timestamp)
   - Add pattern_embeddings table for L2 patterns
   - Add user_embedding_clusters table for L4
   - Add indexes on project_id and similarity_score for drift queries

API Configuration (use environment variables):
- HUGGINGFACE_API_KEY: For Qwen3-Embedding-8B access
- VL_JEPA_SIMILARITY_THRESHOLD: 0.85 default
- VL_JEPA_CACHE_TTL: 3600 seconds

Do not use placeholders. Implement complete, production-ready code with proper error
handling, TypeScript types, and integration with existing KripTik services.
```

## Implementation Prompt 2.2: Intent-to-Output Semantic Verification

```
PROMPT FOR OPUS 4.5 - SEMANTIC VERIFICATION PIPELINE

Context: VL-JEPA embedding service is implemented. Now integrate semantic verification
into the 8-Phase Build Loop to ensure generated outputs match user intent.

Existing Integration Points:
- server/src/services/ai/vl-jepa/embedding-service.ts (from Prompt 2.1)
- server/src/services/build/build-loop-orchestrator.ts (8-phase loop)
- server/src/services/build/intent-lock-service.ts (will become two-stage)

Task: Create semantic verification pipeline that runs at each phase transition

**CRITICAL DECISION: Semantic Verification Position in Swarm**

The Semantic Verifier Agent should run AFTER the core verification agents but BEFORE
the gap closer agents. This allows it to:
1. Benefit from cleaned-up code (placeholders removed, errors fixed)
2. Provide drift feedback before gap closers run
3. Trigger re-verification if semantic drift exceeds threshold

Verification Order:
1. Error Checker Agent (catches compilation errors)
2. Code Quality Agent (cleans up code)
3. Security Scanner Agent (security checks)
4. Placeholder Eliminator Agent (removes placeholders)
5. **SEMANTIC VERIFIER AGENT** (VL-JEPA drift detection) ← NEW POSITION
6. Design Style Agent
7-13. Gap Closer Agents (run after semantic verification passes)

Requirements:
1. Create server/src/services/ai/vl-jepa/semantic-verification-pipeline.ts:

   interface SemanticVerificationResult {
     phase: BuildPhase;
     intentEmbedding: Float32Array;
     outputEmbedding: Float32Array;
     similarityScore: number;
     driftDetected: boolean;
     correctionSuggestions: string[];
     timestamp: Date;
   }

   class SemanticVerificationPipeline {
     // Run after each phase completes
     async verifyPhaseOutput(
       projectId: string,
       phase: BuildPhase,
       intentContract: IntentContract,
       phaseOutput: PhaseOutput
     ): Promise<SemanticVerificationResult>

     // Aggregate verification across all phases
     async getFinalSemanticScore(projectId: string): Promise<number>

     // Generate correction prompts when drift detected
     async generateCorrectionPrompt(
       originalIntent: string,
       driftedOutput: string,
       similarityScore: number
     ): Promise<string>
   }

2. Update server/src/services/build/build-loop-orchestrator.ts:
   - Add semantic verification hook after each phase
   - If drift detected, trigger appropriate escalation level
   - Store verification results in build_phase_metrics table
   - Add semantic_score column to builds table

3. Create server/src/services/ai/vl-jepa/correction-generator.ts:
   - Generate targeted correction prompts when semantic drift occurs
   - Use original intent embedding as anchor
   - Provide specific guidance to bring output back to intent
   - Format corrections for consumption by build loop retry logic

4. Integration with Two-Stage Intent Lock (Section 7):
   - When first intent lock (plan approval) is created, immediately generate intent embedding
   - When second intent lock (final contract) is created, verify embedding matches plan
   - Store embedding hash in intent_locks table for integrity verification
   - On any contract modification attempt, compare embeddings to detect unauthorized changes

5. Metrics and Observability:
   - Emit semantic_verification_completed event to event bus
   - Track average similarity scores per project, user, workflow type
   - Dashboard integration: Add semantic health indicator to build status

Implementation must be fully typed, use existing Drizzle ORM patterns, and integrate
with the TanStack Query frontend state management.
```

## Implementation Prompt 2.3: Visual Semantic Comparison

```
PROMPT FOR OPUS 4.5 - VISUAL EMBEDDING COMPARISON

Context: KripTik AI uses Playwright for screenshot verification in the Visual Verifier
agent. Enhance this with VL-JEPA visual embeddings for semantic UI comparison.

Existing Files:
- server/src/services/verification/agents/visual-verifier-agent.ts
- server/src/services/sandbox/modal-sandbox-service.ts
- server/src/services/ai/vl-jepa/embedding-service.ts

Task: Add visual embedding comparison to the verification pipeline

Requirements:
1. Update server/src/services/ai/vl-jepa/visual-embedding-service.ts:
   - Use CLIP model via HuggingFace for image embeddings
   - Model: openai/clip-vit-large-patch14-336
   - Generate 768-dimensional embeddings from screenshots
   - Compare against design mockup embeddings (if provided)
   - Compare against textual UI intent descriptions

2. Create server/src/services/verification/agents/semantic-visual-verifier-agent.ts:
   interface VisualSemanticVerification {
     screenshotPath: string;
     designIntent: string;
     visualEmbedding: Float32Array;
     intentEmbedding: Float32Array;
     crossModalSimilarity: number;
     layoutConsistency: number;
     colorSchemeMatch: number;
     componentPresence: Record<string, boolean>;
   }

   - Inherit from base VerificationAgent class
   - Run Playwright screenshot capture in Modal sandbox
   - Generate visual embedding from screenshot
   - Generate text embedding from UI intent description
   - Calculate cross-modal similarity (visual vs text intent)
   - Report detailed breakdown: layout, colors, components

3. Update verification-swarm.ts:
   - Replace basic Visual Verifier with Semantic Visual Verifier
   - Add visual_semantic_score to verification results
   - Threshold: cross_modal_similarity >= 0.80 for pass

4. Create server/src/services/ai/vl-jepa/design-intent-parser.ts:
   - Parse natural language UI descriptions into structured intent
   - Extract: components, layout, color scheme, interactions
   - Generate separate embeddings for each aspect
   - Enable granular comparison (e.g., "colors match but layout differs")

5. Frontend Integration (client/src/components/):
   - Add VisualVerificationReport component
   - Show side-by-side: expected (from intent) vs actual (screenshot)
   - Display similarity heatmap overlay
   - Allow user to approve/reject with feedback

Use Modal sandbox for all screenshot operations. Integrate with existing
verification-swarm event emission patterns.
```

---

# Section 3: Hyper-Thinking Cognitive Pipeline

## Implementation Prompt 3.1: 6-Phase Cognitive Pipeline Core

```
PROMPT FOR OPUS 4.5 - HYPER-THINKING PIPELINE

Context: KripTik AI has an 8-Phase Build Loop. We're adding a Hyper-Thinking cognitive
pipeline that runs BEFORE the build loop to deeply analyze requirements and plan
optimal implementation strategies.

Current Architecture:
- 8-Phase Build Loop: Init → Plan → Impl → Verify → Test → Deploy → Monitor → Learn
- Two-Stage Intent Lock: Plan approval (modifiable) + Final contract (immutable)
- AI Lab: 5 parallel orchestrations for research

Task: Implement 6-phase Hyper-Thinking cognitive pipeline

Requirements:
1. Create server/src/services/cognition/hyper-thinking-pipeline.ts:

   enum CognitivePhase {
     DECOMPOSE = 'decompose',     // Break down request into atomic requirements
     PRIOR_KNOWLEDGE = 'prior',   // Query learning layers for relevant patterns
     EXPLORE = 'explore',         // Generate multiple implementation approaches
     CRITIQUE = 'critique',       // Evaluate and score each approach
     SYNTHESIZE = 'synthesize',   // Combine best elements into optimal plan
     VERIFY = 'verify'            // Verify plan completeness and feasibility
   }

   interface CognitiveResult {
     phase: CognitivePhase;
     insights: string[];
     artifacts: Record<string, unknown>;
     confidence: number;
     duration: number;
   }

   class HyperThinkingPipeline {
     async execute(
       userRequest: string,
       projectContext: ProjectContext,
       constraints: BuildConstraints
     ): Promise<HyperThinkingResult>

     private async decompose(input: CognitiveInput): Promise<CognitiveResult>
     private async priorKnowledge(decomposition: CognitiveResult): Promise<CognitiveResult>
     private async explore(knowledge: CognitiveResult): Promise<CognitiveResult>
     private async critique(exploration: CognitiveResult): Promise<CognitiveResult>
     private async synthesize(critique: CognitiveResult): Promise<CognitiveResult>
     private async verify(synthesis: CognitiveResult): Promise<CognitiveResult>
   }

2. Phase Implementations:

   DECOMPOSE Phase:
   - Break user request into atomic requirements
   - Identify explicit and implicit requirements
   - Extract success criteria
   - Output: Structured requirement document

   PRIOR_KNOWLEDGE Phase:
   - Query L2-L5 learning layers for relevant patterns
   - Find similar past projects via VL-JEPA embeddings
   - Identify applicable error→fix patterns
   - Output: Relevant knowledge compilation

   EXPLORE Phase:
   - Generate 3-5 distinct implementation approaches
   - Each approach: architecture, file changes, estimated complexity
   - Use AI Lab parallel orchestration for concurrent exploration
   - Output: Ranked list of implementation hypotheses

   CRITIQUE Phase:
   - Score each hypothesis against criteria:
     * Intent alignment (VL-JEPA similarity to original request)
     * Code quality (maintainability, testability)
     * Risk level (breaking changes, security implications)
     * Effort estimate (file count, complexity score)
   - Output: Evaluation matrix with scores

   SYNTHESIZE Phase:
   - Select winning approach or combine best elements
   - Generate detailed implementation plan
   - Create FIRST Intent Lock (Plan Approval - modifiable)
   - Output: Implementation plan ready for user approval

   VERIFY Phase:
   - Verify plan covers all requirements from DECOMPOSE
   - Check for missing edge cases
   - Ensure plan is executable within constraints
   - Generate VL-JEPA embedding for plan verification
   - Output: Validated plan with confidence score

3. Integration with Build Loop:
   - Hyper-Thinking runs before Phase 0 (Init)
   - Output feeds into Phase 1 (Planning) after user approves
   - Store cognitive artifacts in cognition_sessions table
   - Link to build via cognition_session_id foreign key

4. Database Schema:
   CREATE TABLE cognition_sessions (
     id TEXT PRIMARY KEY,
     project_id TEXT REFERENCES projects(id),
     user_request TEXT NOT NULL,
     phases_completed TEXT[], -- Array of completed phase names
     final_plan JSONB,
     confidence_score REAL,
     duration_ms INTEGER,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE cognitive_artifacts (
     id TEXT PRIMARY KEY,
     session_id TEXT REFERENCES cognition_sessions(id),
     phase TEXT NOT NULL,
     artifact_type TEXT,
     content JSONB,
     created_at TIMESTAMP
   );

Implement complete pipeline with proper error handling, logging, and metrics emission.
```

## Implementation Prompt 3.2: Anthropic Extended Thinking Integration

```
PROMPT FOR OPUS 4.5 - EXTENDED THINKING INTEGRATION

Context: Anthropic Claude API now supports Extended Thinking which allows
models to use additional compute for complex reasoning. Integrate this into the
Hyper-Thinking pipeline for deeper analysis.

API Reference (January 2026):
- Extended Thinking: thinking.budget_tokens parameter
- Budget can exceed max_tokens (e.g., 128K thinking + 64K output)
- Interleaved Thinking Beta: anthropic-beta: interleaved-thinking-2025-05-14
- Enables thinking blocks interleaved with tool use

Model IDs (Verified January 6, 2026):
- claude-opus-4-5-20251101 (primary for extended thinking)
- claude-sonnet-4-5-20250929 (balanced)
- claude-haiku-4-5 (fast)

Task: Integrate Extended Thinking into Hyper-Thinking cognitive phases

Requirements:
1. Create server/src/services/cognition/extended-thinking-client.ts:

   interface ExtendedThinkingConfig {
     budgetTokens: number;        // Thinking budget (can exceed max_tokens)
     streamThinking: boolean;     // Stream thinking blocks
     interleavedThinking: boolean; // Use interleaved-thinking beta
   }

   class ExtendedThinkingClient {
     constructor(private anthropicApiKey: string) {}

     async think(
       prompt: string,
       config: ExtendedThinkingConfig
     ): Promise<ThinkingResult> {
       // Use Anthropic SDK with extended thinking
       const response = await anthropic.messages.create({
         model: 'claude-opus-4-5-20251101',
         max_tokens: 16000,
         thinking: {
           type: 'enabled',
           budget_tokens: config.budgetTokens // e.g., 50000
         },
         messages: [{ role: 'user', content: prompt }]
       });

       // Extract thinking blocks and final response
       return this.parseThinkingResponse(response);
     }

     async thinkWithTools(
       prompt: string,
       tools: Tool[],
       config: ExtendedThinkingConfig
     ): Promise<ThinkingResult> {
       // Use interleaved thinking beta for tool-use scenarios
       const response = await anthropic.beta.messages.create({
         model: 'claude-opus-4-5-20251101',
         betas: ['interleaved-thinking-2025-05-14'],
         max_tokens: 16000,
         thinking: {
           type: 'enabled',
           budget_tokens: config.budgetTokens
         },
         tools: tools,
         messages: [{ role: 'user', content: prompt }]
       });

       return this.parseInterleavedResponse(response);
     }
   }

2. Update Hyper-Thinking phases to use Extended Thinking:

   DECOMPOSE Phase:
   - Use 30,000 token thinking budget
   - Deep requirement analysis
   - Identify hidden requirements

   PRIOR_KNOWLEDGE Phase:
   - Use 20,000 token thinking budget
   - Reason about pattern applicability
   - Connect disparate knowledge

   EXPLORE Phase:
   - Use 80,000 token thinking budget
   - Generate diverse implementation approaches
   - Consider non-obvious solutions

   CRITIQUE Phase:
   - Use interleaved thinking with evaluation tools
   - Tools: code_complexity_analyzer, security_scanner, effort_estimator
   - 40,000 token thinking budget

3. Create server/src/services/cognition/thinking-budget-manager.ts:
   - Allocate thinking budgets based on task complexity
   - Track token usage across cognitive sessions
   - Adaptive budget: increase for failed builds, decrease for simple tasks
   - Cost tracking integration with existing billing system

4. Streaming Integration:
   - Stream thinking blocks to frontend during Hyper-Thinking
   - Display real-time cognitive progress
   - Allow user to see AI reasoning process
   - Update client/src/components/build/CognitiveProgress.tsx

5. Configuration:
   ANTHROPIC_API_KEY: Required
   EXTENDED_THINKING_DEFAULT_BUDGET: 50000
   EXTENDED_THINKING_MAX_BUDGET: 128000
   INTERLEAVED_THINKING_ENABLED: true

Ensure proper error handling for API rate limits and token budget exhaustion.
```

## Implementation Prompt 3.3: Parallel Cognitive Processing with AI Lab

```
PROMPT FOR OPUS 4.5 - PARALLEL COGNITIVE PROCESSING

Context: KripTik AI has AI Lab with 5 parallel orchestrations. Enhance Hyper-Thinking
to use parallel processing for faster, more comprehensive cognitive analysis.

Existing Integration Points:
- server/src/services/ai-lab/orchestration-manager.ts (5 parallel orchestrations)
- server/src/services/cognition/hyper-thinking-pipeline.ts (from Prompt 3.1)
- server/src/services/sandbox/multi-sandbox-orchestrator.ts (20 parallel sandboxes)

Task: Implement parallel cognitive processing for Hyper-Thinking

Requirements:
1. Update server/src/services/cognition/hyper-thinking-pipeline.ts:

   class ParallelHyperThinking extends HyperThinkingPipeline {
     constructor(
       private aiLabOrchestrator: OrchestrationManager,
       private extendedThinkingClient: ExtendedThinkingClient
     ) {}

     async exploreParallel(
       knowledge: CognitiveResult
     ): Promise<CognitiveResult[]> {
       // Use AI Lab's 5 parallel orchestrations
       // Each generates a distinct implementation hypothesis
       const explorationPrompts = this.generateExplorationPrompts(knowledge, 5);

       const results = await this.aiLabOrchestrator.executeParallel(
         explorationPrompts.map(prompt => ({
           type: 'exploration',
           prompt,
           thinkingBudget: 30000
         }))
       );

       return results;
     }

     async critiqueParallel(
       explorations: CognitiveResult[]
     ): Promise<EvaluationMatrix> {
       // Parallel evaluation of each exploration
       // Each evaluator focuses on different criteria
       const evaluators = [
         'intent_alignment_evaluator',
         'code_quality_evaluator',
         'security_evaluator',
         'performance_evaluator',
         'maintainability_evaluator'
       ];

       const evaluationResults = await Promise.all(
         evaluators.map(evaluator =>
           this.aiLabOrchestrator.evaluate(explorations, evaluator)
         )
       );

       return this.aggregateEvaluations(evaluationResults);
     }
   }

2. Create server/src/services/cognition/cognitive-orchestrator.ts:
   - Coordinate parallel cognitive processes
   - Manage resource allocation across AI Lab slots
   - Handle partial failures gracefully
   - Merge parallel results into coherent output

3. Implement Cognitive Agents:

   server/src/services/cognition/agents/requirement-decomposer-agent.ts
   - Deep requirement analysis
   - Dependency mapping
   - Ambiguity detection

   server/src/services/cognition/agents/knowledge-retriever-agent.ts
   - Query learning layers
   - Find similar patterns via embeddings
   - Compile relevant knowledge

   server/src/services/cognition/agents/approach-explorer-agent.ts
   - Generate architectural approaches
   - Consider existing patterns
   - Propose file structure changes

   server/src/services/cognition/agents/approach-critic-agent.ts
   - Security risk assessment
   - Breaking change detection
   - Performance impact analysis

   server/src/services/cognition/agents/synthesis-agent.ts
   - Combine best elements from explorations
   - Resolve conflicts between approaches
   - Generate final implementation plan

4. Integration with Multi-Sandbox Orchestrator:
   - Use sandboxes for exploration validation
   - Spin up test environments to verify feasibility
   - Run quick prototype tests for complex explorations
   - Max 5 sandboxes for cognitive validation (reserve 15 for build)

5. Metrics and Monitoring:
   - Track parallel efficiency (time saved vs sequential)
   - Monitor exploration diversity score
   - Log winning approach selection patterns
   - Feed into L3 project learning layer

Implement with proper TypeScript types, error boundaries, and integration with
existing AI Lab infrastructure.
```

---

# Section 4: Model Enhancement Integration (2026 APIs)

## API Routing Architecture (CRITICAL)

> **IMPORTANT: API Routing Rules**
>
> KripTik AI uses DIRECT API calls for providers we have direct relationships with:
> - **OpenAI Models** → Direct OpenAI API (api.openai.com)
> - **Anthropic Models** → Direct Anthropic API (api.anthropic.com)
>
> For all other models, use OpenRouter as the unified gateway:
> - **DeepSeek Models** → OpenRouter (openrouter.ai)
> - **Llama Models** → OpenRouter (openrouter.ai)
> - **Qwen Models** → OpenRouter (openrouter.ai)
> - **Mistral Models** → OpenRouter (openrouter.ai)
> - **GLM Models** → OpenRouter (openrouter.ai)
> - **Kimi/Moonshot Models** → OpenRouter (openrouter.ai)
>
> This ensures optimal pricing, reliability, and direct support from primary providers.

## Implementation Prompt 4.1: Update Existing Model Router with January 2026 Models

```
PROMPT FOR OPUS 4.5 - UPDATE MODEL ROUTER WITH 2026 MODELS

Context: KripTik AI already has:
- server/src/services/ai/model-router.ts (400+ lines, cost optimization routing)
- server/src/services/ai/openrouter-client.ts (600+ lines, full OpenRouter integration)

DO NOT create a new ModelOrchestrator. UPDATE existing model-router.ts with new model IDs.

Verified Model IDs (January 6, 2026):
- Anthropic: claude-opus-4-5-20251101, claude-sonnet-4-5-20250929, claude-haiku-4-5
- OpenAI: gpt-5.2 (thinking), gpt-5.2-instant, gpt-5.2-pro (xhigh effort)
- DeepSeek: deepseek-chat, deepseek-reasoner
- Zhipu AI: glm-4-plus (GLM 4.7)
- Moonshot AI: moonshot/kimi-k2

Task: Update existing model-router.ts with January 2026 model configurations

Requirements:
1. Update server/src/services/ai/model-router.ts:

   // Update model configurations
   const MODEL_CONFIGS = {
     // Anthropic (Direct API)
     'claude-opus-4-5': {
       modelId: 'claude-opus-4-5-20251101',
       provider: 'anthropic',
       apiRoute: 'direct',
       costPer1MInput: 15.00,
       costPer1MOutput: 75.00,
       contextWindow: 200000,
       bestFor: ['complex_coding', 'extended_thinking', 'verification'],
       supportsExtendedThinking: true,
       supportsInterleavedThinking: true
     },
     'claude-sonnet-4-5': {
       modelId: 'claude-sonnet-4-5-20250929',
       provider: 'anthropic',
       apiRoute: 'direct',
       costPer1MInput: 3.00,
       costPer1MOutput: 15.00,
       contextWindow: 200000,
       bestFor: ['balanced', 'general_coding', 'analysis'],
       supportsExtendedThinking: true
     },
     'claude-haiku-4-5': {
       modelId: 'claude-haiku-4-5',
       provider: 'anthropic',
       apiRoute: 'direct',
       costPer1MInput: 0.25,
       costPer1MOutput: 1.25,
       contextWindow: 200000,
       bestFor: ['fast', 'simple_tasks', 'summarization'],
       supportsExtendedThinking: false
     },

     // OpenAI (Direct API)
     'gpt-5.2-thinking': {
       modelId: 'gpt-5.2',
       provider: 'openai',
       apiRoute: 'direct',
       costPer1MInput: 15.00,
       costPer1MOutput: 60.00,
       contextWindow: 128000,
       bestFor: ['reasoning', 'planning', 'analysis'],
       supportsReasoningEffort: true
     },
     'gpt-5.2-instant': {
       modelId: 'gpt-5.2-instant',
       provider: 'openai',
       apiRoute: 'direct',
       costPer1MInput: 1.75,
       costPer1MOutput: 14.00,
       contextWindow: 128000,
       bestFor: ['fast_responses', 'simple_queries']
     },
     'gpt-5.2-pro': {
       modelId: 'gpt-5.2-pro',
       provider: 'openai',
       apiRoute: 'direct',
       costPer1MInput: 30.00,
       costPer1MOutput: 120.00,
       contextWindow: 128000,
       bestFor: ['maximum_reasoning', 'complex_problems'],
       supportsReasoningEffort: true,
       defaultEffort: 'xhigh'
     },

     // DeepSeek (OpenRouter)
     'deepseek-v3.2': {
       modelId: 'deepseek-chat',
       provider: 'deepseek',
       apiRoute: 'openrouter',
       costPer1MInput: 0.028,
       costPer1MOutput: 0.14,
       contextWindow: 64000,
       bestFor: ['cost_optimized', 'general_tasks', 'bulk_processing']
     },
     'deepseek-reasoner': {
       modelId: 'deepseek-reasoner',
       provider: 'deepseek',
       apiRoute: 'openrouter',
       costPer1MInput: 0.55,
       costPer1MOutput: 2.19,
       contextWindow: 64000,
       bestFor: ['reasoning', 'thinking_mode', 'complex_analysis']
     },

     // GLM (OpenRouter)
     'glm-4-7': {
       modelId: 'glm-4-plus',
       provider: 'zhipu',
       apiRoute: 'openrouter',
       costPer1MInput: 0.50,
       costPer1MOutput: 0.75,
       contextWindow: 128000,
       bestFor: ['coding', 'swe_bench_tasks'],
       sweBenchScore: 73.8
     },

     // Kimi (OpenRouter)
     'kimi-k2': {
       modelId: 'moonshot/kimi-k2',
       provider: 'moonshot',
       apiRoute: 'openrouter',
       costPer1MInput: 0.60,
       costPer1MOutput: 1.20,
       contextWindow: 256000,
       bestFor: ['long_context', 'thinking_mode', 'complex_analysis']
     },

     // Llama (OpenRouter)
     'llama-3.3-70b': {
       modelId: 'meta-llama/llama-3.3-70b-instruct',
       provider: 'meta',
       apiRoute: 'openrouter',
       costPer1MInput: 0.50,
       costPer1MOutput: 0.75,
       contextWindow: 128000,
       bestFor: ['open_source', 'self_hostable', 'general_tasks']
     }
   };

2. Update routing logic for task types:

   const TASK_ROUTING = {
     // Primary code generation
     CODE_GENERATION: {
       primary: 'claude-opus-4-5',
       fallback: ['gpt-5.2-pro', 'glm-4-7', 'deepseek-v3.2']
     },

     // Complex reasoning/planning
     COMPLEX_REASONING: {
       primary: 'gpt-5.2-pro',
       fallback: ['claude-opus-4-5', 'deepseek-reasoner', 'kimi-k2']
     },

     // Verification tasks
     VERIFICATION: {
       primary: 'claude-opus-4-5',
       fallback: ['claude-sonnet-4-5', 'gpt-5.2-thinking']
     },

     // Fast responses
     QUICK_RESPONSE: {
       primary: 'gpt-5.2-instant',
       fallback: ['claude-haiku-4-5', 'deepseek-v3.2']
     },

     // Cost optimized (high volume)
     COST_OPTIMIZED: {
       primary: 'deepseek-v3.2',
       fallback: ['llama-3.3-70b', 'claude-haiku-4-5']
     },

     // Extended thinking tasks
     EXTENDED_THINKING: {
       primary: 'claude-opus-4-5',
       fallback: ['gpt-5.2-pro', 'deepseek-reasoner']
     },

     // Long context tasks
     LONG_CONTEXT: {
       primary: 'kimi-k2',
       fallback: ['claude-opus-4-5', 'claude-sonnet-4-5']
     }
   };

3. Ensure NO model selector appears on builder view:
   - Remove any UI for model selection
   - User enters NLP request
   - KripTik auto-routes to optimal model based on task analysis
   - Model used is shown in build logs (for transparency) but not selectable

4. Update cost tracking:
   - Track costs per model per user
   - Apply appropriate pricing based on model used
   - Alert when approaching budget limits
```

## Implementation Prompt 4.2: OpenAI Responses API Integration (GPT-5.2)

```
PROMPT FOR OPUS 4.5 - OPENAI RESPONSES API WITH GPT-5.2

Context: OpenAI released GPT-5.2 on December 11, 2025 with multiple variants:
- GPT-5.2 (thinking): Complex reasoning with effort parameter
- GPT-5.2 Instant: Fast responses, low latency
- GPT-5.2 Pro: Maximum reasoning depth (xhigh effort)

The Responses API is the recommended approach for production applications.

API Updates (January 2026):
- Responses API: POST /v1/responses
- Built-in tools: web_search, code_interpreter, file_search
- Reasoning models: GPT-5.2 with reasoning_effort parameter
- xhigh effort: 0.95 compute ratio for maximum reasoning depth
- Reasoning summaries: reasoning.summary for cost-effective reasoning traces

Task: Integrate OpenAI Responses API with GPT-5.2 models

Requirements:
1. Create server/src/services/ai/openai/responses-client.ts:

   interface ResponsesConfig {
     model: 'gpt-5.2' | 'gpt-5.2-instant' | 'gpt-5.2-pro';
     reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh'; // For thinking models
     tools?: ('web_search' | 'code_interpreter' | 'file_search')[];
     includeReasoningSummary?: boolean;
   }

   class OpenAIResponsesClient {
     async createResponse(
       input: string | Message[],
       config: ResponsesConfig
     ): Promise<ResponseResult> {
       const response = await fetch('https://api.openai.com/v1/responses', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           model: config.model,
           input: input,
           reasoning: config.reasoningEffort ? {
             effort: config.reasoningEffort,
             summary: config.includeReasoningSummary ? 'auto' : 'none'
           } : undefined,
           tools: config.tools?.map(tool => ({ type: tool }))
         })
       });

       return response.json();
     }

     async createResponseStream(
       input: string | Message[],
       config: ResponsesConfig
     ): AsyncGenerator<ResponseChunk> {
       // Streaming implementation for real-time output
     }
   }

2. Create server/src/services/ai/openai/reasoning-orchestrator.ts:
   - Use GPT-5.2 Pro with xhigh effort for complex architectural decisions
   - Use GPT-5.2 Instant for routine tasks and quick responses
   - Dynamic effort selection based on task complexity
   - Cost tracking: xhigh uses ~0.95 compute ratio

3. Integration with Hyper-Thinking:

   EXPLORE Phase:
   - Use GPT-5.2 Pro with xhigh effort for novel architectural approaches
   - Request reasoning summaries for explainability

   CRITIQUE Phase:
   - Use GPT-5.2 (thinking) for evaluation iterations
   - Medium-high effort for scoring tasks requiring reasoning

4. Integration with Build Loop:

   Phase 1 (Planning):
   - Use Responses API with code_interpreter for dependency analysis
   - GPT-5.2 (thinking) for requirement analysis

   Phase 2 (Implementation):
   - Route code generation to Claude Opus 4.5 (primary) or GPT-5.2 Pro (fallback)

   Phase 4 (Testing):
   - Use code_interpreter for test execution analysis
   - GPT-5.2 (thinking) for test case generation

5. Configuration:
   OPENAI_API_KEY: Required
   OPENAI_DEFAULT_MODEL: gpt-5.2
   OPENAI_REASONING_MODEL: gpt-5.2-pro
   OPENAI_FAST_MODEL: gpt-5.2-instant
   OPENAI_MAX_REASONING_EFFORT: xhigh

Implement with proper error handling, rate limiting, and cost tracking integration.
```

## Implementation Prompt 4.3: Anthropic Interleaved Thinking Integration

```
PROMPT FOR OPUS 4.5 - INTERLEAVED THINKING

Context: Anthropic's Interleaved Thinking Beta (interleaved-thinking-2025-05-14) allows
thinking blocks to be interleaved with tool use, enabling deeper reasoning during
complex multi-step operations.

Current KripTik Integration Points:
- server/src/services/ai/anthropic-client.ts (existing Claude integration)
- server/src/services/verification/verification-swarm.ts (tool-using agents)
- server/src/services/cognition/extended-thinking-client.ts (from Prompt 3.2)

Model IDs (Verified January 6, 2026):
- claude-opus-4-5-20251101 (primary)
- claude-sonnet-4-5-20250929 (balanced)
- claude-haiku-4-5 (fast)

Task: Implement Interleaved Thinking for verification and complex reasoning tasks

Requirements:
1. Update server/src/services/ai/anthropic-client.ts:

   class AnthropicClient {
     async createMessageWithInterleavedThinking(
       messages: Message[],
       tools: Tool[],
       thinkingBudget: number
     ): Promise<InterleavedResponse> {
       const response = await this.client.beta.messages.create({
         model: 'claude-opus-4-5-20251101',
         betas: ['interleaved-thinking-2025-05-14'],
         max_tokens: 16000,
         thinking: {
           type: 'enabled',
           budget_tokens: thinkingBudget
         },
         tools: tools,
         messages: messages
       });

       return this.parseInterleavedResponse(response);
     }

     private parseInterleavedResponse(response: BetaMessage): InterleavedResponse {
       // Response contains interleaved: thinking → tool_use → thinking → tool_result → ...
       const blocks: ContentBlock[] = [];

       for (const block of response.content) {
         if (block.type === 'thinking') {
           blocks.push({ type: 'thinking', content: block.thinking });
         } else if (block.type === 'tool_use') {
           blocks.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
         } else if (block.type === 'text') {
           blocks.push({ type: 'text', content: block.text });
         }
       }

       return { blocks, usage: response.usage };
     }
   }

2. Create server/src/services/verification/thinking-verification-agent.ts:
   - Base class for verification agents that use interleaved thinking
   - Define standard tools: read_file, analyze_code, check_pattern, run_test
   - Thinking between tool calls for deeper analysis

3. Update Verification Swarm agents to use Interleaved Thinking:

   Error Checker Agent:
   - Tools: read_file, parse_ast, find_pattern
   - Thinking budget: 20000 tokens
   - Think between file reads to connect error patterns

   Code Quality Agent:
   - Tools: analyze_complexity, check_standards, measure_coverage
   - Thinking budget: 15000 tokens
   - Reason about quality trade-offs

   Security Scanner Agent:
   - Tools: scan_vulnerabilities, check_dependencies, analyze_flow
   - Thinking budget: 30000 tokens (security requires deep analysis)
   - Think about attack vectors between scans

   Semantic Verifier Agent (new from VL-JEPA):
   - Tools: generate_embedding, compare_embeddings, calculate_drift
   - Thinking budget: 25000 tokens
   - Reason about semantic alignment

4. Create server/src/services/ai/thinking-stream-handler.ts:
   - Stream thinking blocks to frontend in real-time
   - Allow users to observe AI reasoning process
   - Provide "peek behind the curtain" UX
   - Store thinking traces for debugging and learning

5. Frontend Integration:
   - Update client/src/components/verification/VerificationProgress.tsx
   - Show collapsible thinking traces per agent
   - Real-time streaming of reasoning process
   - Toggle: "Show AI Thinking" preference

6. Metrics:
   - Track thinking_tokens_used per verification
   - Measure correlation: more thinking → better verification accuracy
   - Feed into cost optimization (right-size thinking budgets)

Implement with TypeScript, integrate with existing verification infrastructure.
```

---

# Section 5: KripTik Cloud Infrastructure

## Infrastructure Ownership Model (CRITICAL)

> **IMPORTANT: Understanding KripTik vs User Infrastructure**
>
> KripTik AI operates on a dual-infrastructure model where both KripTik and users
> have their own cloud accounts. Understanding who owns what is critical:
>
> ### KripTik's Infrastructure (Billed to Users via Metered Billing)
> - **Training/Fine-tuning**: Models are trained on KripTik's RunPod/Modal accounts
> - **Testing/Verification**: Build verification runs on KripTik's infrastructure
> - **AI Lab Orchestrations**: 5 parallel orchestrations on KripTik's account
> - **Sandbox Execution**: Modal sandboxes during development on KripTik's account
> - **All usage is metered and billed to the user**
>
> ### User's Infrastructure (User's Own Accounts)
> - **Production Deployment**: Users can deploy to THEIR OWN RunPod/Modal accounts
> - **Backend Hosting**: User apps can run on user's infrastructure
> - **Open Source Models**: Deployed to user's account for inference
> - **User provides their own API keys/secrets for their accounts**
>
> ### Deployment Flow
> 1. **Development Phase**: Uses KripTik's infrastructure (metered billing)
> 2. **Testing Phase**: Uses KripTik's infrastructure (metered billing)
> 3. **Production Deployment**: User chooses:
>    - Option A: Deploy to KripTik's infrastructure (continued metered billing)
>    - Option B: Deploy to USER'S OWN accounts (user manages their own costs)
>
> ### Easy Deploy Feature
> - Allow users to connect their own RunPod/Modal/Vercel accounts
> - One-click deployment to user's infrastructure
> - User's secrets stored securely, never on KripTik's servers
>
> ### Cleanup Mechanism (REQUIRED)
> - Abandoned apps on KripTik's infrastructure must be cleaned up
> - Auto-archive after 30 days of inactivity
> - Auto-delete after 90 days (with warnings)
> - Prevents orphaned GPU/storage costs from abandoned projects

## Implementation Prompt 5.1: Qdrant Vector Database (New Addition)

```
PROMPT FOR OPUS 4.5 - QDRANT INTEGRATION

Context: VL-JEPA generates embeddings that need efficient storage and retrieval.
This is a NEW integration (Qdrant is not currently in KripTik). Qdrant v1.16 offers
tiered multitenancy, ACORN search, and excellent performance for embedding storage.

Qdrant Features (January 2026):
- v1.16: Tiered multitenancy, ACORN search algorithm
- Cloud: Managed service with auto-scaling
- Hybrid search: Dense + sparse vectors
- Filtering: Payload-based with indexes

Task: Integrate Qdrant for VL-JEPA embedding storage and similarity search

Requirements:
1. Create server/src/services/vector/qdrant-client.ts:

   interface QdrantConfig {
     url: string;
     apiKey: string;
     defaultCollection: string;
   }

   interface VectorPoint {
     id: string;
     vector: number[];
     payload: Record<string, unknown>;
   }

   class QdrantClient {
     async createCollection(
       name: string,
       vectorSize: number,
       distance: 'Cosine' | 'Euclid' | 'Dot'
     ): Promise<void> {
       await fetch(`${this.url}/collections/${name}`, {
         method: 'PUT',
         headers: this.headers,
         body: JSON.stringify({
           vectors: { size: vectorSize, distance },
           optimizers_config: {
             indexing_threshold: 20000,
             memmap_threshold: 50000
           },
           // Enable ACORN search for better accuracy
           hnsw_config: {
             m: 16,
             ef_construct: 100,
             full_scan_threshold: 10000
           }
         })
       });
     }

     async upsertPoints(collection: string, points: VectorPoint[]): Promise<void> {
       // Batch upsert with optimized batching
     }

     async search(
       collection: string,
       vector: number[],
       limit: number,
       filter?: PayloadFilter
     ): Promise<SearchResult[]> {
       const response = await fetch(`${this.url}/collections/${collection}/points/search`, {
         method: 'POST',
         headers: this.headers,
         body: JSON.stringify({
           vector,
           limit,
           filter,
           with_payload: true,
           with_vectors: false,
           // Use ACORN for better accuracy on large collections
           params: { exact: false, hnsw_ef: 128 }
         })
       });
       return response.json();
     }

     async searchWithTenancy(
       collection: string,
       vector: number[],
       tenantId: string,
       limit: number
     ): Promise<SearchResult[]> {
       // Tiered multitenancy: efficient per-tenant search
       return this.search(collection, vector, limit, {
         must: [{ key: 'tenant_id', match: { value: tenantId } }]
       });
     }
   }

2. Create server/src/services/vector/embedding-store.ts:

   class EmbeddingStore {
     constructor(private qdrant: QdrantClient) {}

     // Collections for different embedding types
     private collections = {
       intent: 'kriptik_intent_embeddings',      // 4096-dim (Qwen3)
       code: 'kriptik_code_embeddings',          // 4096-dim (Qwen3)
       visual: 'kriptik_visual_embeddings',      // 768-dim (CLIP)
       patterns: 'kriptik_pattern_embeddings',   // L2 learning patterns
       combined: 'kriptik_combined_embeddings'   // Multi-vector
     };

     async storeIntentEmbedding(
       projectId: string,
       intentId: string,
       embedding: Float32Array,
       metadata: IntentMetadata
     ): Promise<void> {
       await this.qdrant.upsertPoints(this.collections.intent, [{
         id: intentId,
         vector: Array.from(embedding),
         payload: {
           tenant_id: projectId,
           type: 'intent',
           ...metadata,
           created_at: new Date().toISOString()
         }
       }]);
     }

     async findSimilarIntents(
       projectId: string,
       queryEmbedding: Float32Array,
       limit: number = 10
     ): Promise<SimilarIntent[]> {
       return this.qdrant.searchWithTenancy(
         this.collections.intent,
         Array.from(queryEmbedding),
         projectId,
         limit
       );
     }

     async findSimilarPatterns(
       queryEmbedding: Float32Array,
       limit: number = 10
     ): Promise<SimilarPattern[]> {
       // Cross-project pattern search (L5 global)
       return this.qdrant.search(
         this.collections.patterns,
         Array.from(queryEmbedding),
         limit
       );
     }

     async calculateSemanticDrift(
       intentEmbedding: Float32Array,
       outputEmbedding: Float32Array
     ): Promise<number> {
       // Cosine similarity calculation
       const dotProduct = intentEmbedding.reduce(
         (sum, a, i) => sum + a * outputEmbedding[i], 0
       );
       const normA = Math.sqrt(intentEmbedding.reduce((sum, a) => sum + a * a, 0));
       const normB = Math.sqrt(outputEmbedding.reduce((sum, a) => sum + a * a, 0));
       return dotProduct / (normA * normB);
     }
   }

3. Create server/src/services/vector/semantic-search-service.ts:
   - Search across all embedding types
   - Hybrid search: combine intent + code + visual similarity
   - Support for "find similar projects" feature
   - Pattern discovery from historical embeddings

4. Integration with VL-JEPA:
   - Store all embeddings in Qdrant immediately after generation
   - Use Qdrant for similarity comparisons (faster than recomputing)
   - Enable historical drift analysis across builds

5. Integration with Learning Engine (Component 28):
   - L2 (Pattern): Query similar past patterns for new errors
   - L3 (Project): Project-specific embedding index
   - L5 (Global): Cross-project pattern discovery

6. Database Schema Updates:
   - Add qdrant_point_ids to relevant tables
   - Enable sync between Turso metadata and Qdrant vectors
   - Implement consistency checks

7. Configuration:
   QDRANT_URL: https://your-cluster.qdrant.tech
   QDRANT_API_KEY: Required
   QDRANT_COLLECTION_PREFIX: kriptik_
   QDRANT_BATCH_SIZE: 100

Implement with proper batching, error handling, and consistency guarantees.
```

## Implementation Prompt 5.2: RunPod GPU Enhancement (Extend Existing)

```
PROMPT FOR OPUS 4.5 - RUNPOD ENHANCEMENT

Context: KripTik AI ALREADY HAS RunPod integration. This prompt enhances the existing
implementation with new 2026 API features, NOT replaces it.

RunPod API (January 2026):
- Serverless endpoints: Sub-250ms cold starts (48% of requests)
- REST API for automation
- GPU options: RTX 4090, A100, H100
- Pay-per-second billing

Task: Enhance existing RunPod integration for GPU-accelerated AI workloads

Requirements:
1. Update existing RunPod client with new endpoint templates:

   embedding-generator:
   - GPU: A100
   - Model: Qwen3-Embedding-8B
   - Min workers: 0, Max workers: 5

   code-analyzer:
   - GPU: RTX 4090
   - Model: Fine-tuned code model
   - Min workers: 1, Max workers: 3

   visual-processor:
   - GPU: A100
   - Model: CLIP + custom vision models
   - Min workers: 0, Max workers: 2

2. Create server/src/services/cloud/runpod/gpu-workload-router.ts:
   - Route VL-JEPA batch embedding generation to RunPod
   - 10x faster than CPU-based inference
   - Cost-effective for high-volume embedding tasks

3. Configuration:
   RUNPOD_API_KEY: Required
   RUNPOD_DEFAULT_GPU: A100
   RUNPOD_MAX_SPEND_DAILY: 100 (USD)
   RUNPOD_AUTO_SCALE_THRESHOLD: 5 (queue depth)
```

## Implementation Prompt 5.3: Abandoned App Cleanup Mechanism (NEW)

```
PROMPT FOR OPUS 4.5 - CLEANUP MECHANISM FOR ABANDONED APPS

Context: KripTik AI operates a dual-infrastructure model where development/testing runs
on KripTik's accounts (metered to users) and production can optionally run on user accounts.
Apps abandoned on KripTik's infrastructure accumulate storage and GPU costs. We need an
automated cleanup mechanism to prevent orphaned resources.

Task: Implement automated cleanup for abandoned apps on KripTik's infrastructure

Requirements:
1. Create server/src/services/infrastructure/cleanup-service.ts:

   interface CleanupPolicy {
     inactiveDays: number;        // Days before archival (default: 30)
     deleteDays: number;          // Days before deletion (default: 90)
     warningDays: number;         // Days before deletion to warn (default: 7)
     exemptTiers: string[];       // User tiers exempt from auto-cleanup
   }

   class CleanupService {
     async scanForInactiveApps(): Promise<InactiveApp[]> {
       // Query apps with no activity in CLEANUP_INACTIVE_DAYS
     }

     async archiveApp(appId: string): Promise<ArchiveResult> {
       // 1. Create snapshot of app state
       // 2. Export to cold storage (S3/GCS)
       // 3. Stop all running services
       // 4. Mark as archived in database
       // 5. Send notification to user
     }

     async deleteApp(appId: string): Promise<DeleteResult> {
       // 1. Verify app has been archived
       // 2. Delete from RunPod, Modal, Qdrant
       // 3. Delete from Turso
       // 4. Final notification to user
     }

     async restoreApp(appId: string, userId: string): Promise<RestoreResult> {
       // Restore from archive within 60 days of deletion
     }
   }

2. User Notifications:
   - Email/in-app notification at 23 days (7 days before archive)
   - Email/in-app notification at archive (30 days)
   - Email/in-app notification at 83 days (7 days before delete)
   - Final email at deletion (90 days)
   - All notifications include one-click restore/extend option

3. Configuration:
   CLEANUP_INACTIVE_DAYS=30
   CLEANUP_DELETE_DAYS=90
   CLEANUP_WARNING_DAYS=7
   CLEANUP_EXEMPT_TIERS=enterprise,premium
```

---

# Section 6: Quality & Verification Enhancements

## Implementation Prompt 6.1: Deliberative Alignment Quality Specs

```
PROMPT FOR OPUS 4.5 - DELIBERATIVE ALIGNMENT

Context: KripTik AI needs a system to define, track, and enforce quality specifications
across all builds. This "Deliberative Alignment" system ensures outputs meet explicit
quality criteria defined upfront.

Task: Implement Deliberative Alignment quality specification system

Requirements:
1. Create server/src/services/quality/deliberative-alignment.ts:

   interface QualitySpec {
     id: string;
     name: string;
     category: QualityCategory;
     criteria: QualityCriterion[];
     weight: number;
     required: boolean;
   }

   enum QualityCategory {
     CODE_QUALITY = 'code_quality',
     SECURITY = 'security',
     PERFORMANCE = 'performance',
     ACCESSIBILITY = 'accessibility',
     MAINTAINABILITY = 'maintainability',
     INTENT_ALIGNMENT = 'intent_alignment'
   }

2. Create default quality specs:
   - No console.log in production code
   - No any types in TypeScript
   - Maximum cyclomatic complexity: 10
   - Input validation on all endpoints
   - VL-JEPA similarity >= 0.85

3. Integration with Verification Swarm:
   - Each verification agent receives relevant quality specs
   - Agents evaluate against specs, not just general rules
   - Spec violations trigger specific error escalation
```

## Implementation Prompt 6.2: Enhanced Error Escalation

```
PROMPT FOR OPUS 4.5 - ENHANCED ERROR ESCALATION

Context: KripTik AI has a 4-Level Error Escalation system. Enhance it with smarter
escalation decisions, better auto-fix capabilities, and learning from past errors.

Task: Enhance error escalation with ML-powered decisions and improved auto-fix

Requirements:
1. Update escalation to use VL-JEPA pattern matching:
   - Find similar past errors via embedding similarity
   - Apply successful fix patterns based on semantic matching
   - Dramatically improves auto-fix success rate

2. Integration with Extended Thinking:
   - L2 escalation: Use extended thinking for deeper analysis
   - 30,000 token thinking budget for complex errors
   - Generate comprehensive fix suggestions

3. Integration with VL-JEPA:
   - Check if error indicates semantic drift
   - If drift detected, suggest intent realignment
   - Generate correction prompts to bring back on track
```

---

# Section 7: Two-Stage Intent Lock System

## Implementation Prompt 7.1: Two-Stage Intent Lock

```
PROMPT FOR OPUS 4.5 - TWO-STAGE INTENT LOCK SYSTEM

Context: KripTik AI currently has a single Intent Lock (sacred contract) system.
We need to enhance this to a TWO-STAGE system:

Stage 1 - Plan Approval Lock (MODIFIABLE):
- Created after Hyper-Thinking SYNTHESIZE phase
- User can review and MODIFY the implementation plan
- Changes are tracked and re-analyzed
- User must explicitly approve before proceeding
- This is the "living document" phase

Stage 2 - Final Contract Lock (IMMUTABLE):
- Created AFTER user approves the plan
- Created AFTER user confirms production features, GPU, OAuth options
- This is the TRUE sacred contract
- IMMUTABLE once locked
- Any changes require starting a new build

Current Files to Modify:
- server/src/services/build/intent-lock-service.ts
- server/src/db/schema.ts

Task: Implement two-stage Intent Lock system

Requirements:
1. Update server/src/services/build/intent-lock-service.ts:

   enum IntentLockStage {
     PLAN_APPROVAL = 'plan_approval',    // Stage 1 - modifiable
     FINAL_CONTRACT = 'final_contract'   // Stage 2 - immutable
   }

   interface PlanApprovalLock {
     id: string;
     projectId: string;
     stage: IntentLockStage.PLAN_APPROVAL;
     plan: ImplementationPlan;
     userModifications: Modification[];
     approved: boolean;
     approvedAt: Date | null;
     embedding: Float32Array;  // VL-JEPA embedding of plan
     createdAt: Date;
   }

   interface FinalContractLock {
     id: string;
     projectId: string;
     stage: IntentLockStage.FINAL_CONTRACT;
     planApprovalId: string;  // Reference to approved plan
     sacredContract: SacredContract;
     productionFeatures: ProductionFeatures;
     gpuConfig: GPUConfig | null;
     oauthConfig: OAuthConfig | null;
     embedding: Float32Array;
     embeddingHash: string;  // For integrity verification
     lockedAt: Date;
     immutable: true;  // Always true for final contract
   }

   interface ProductionFeatures {
     deploymentTarget: 'kriptik' | 'user_infrastructure';
     scalingConfig: ScalingConfig;
     domainConfig: DomainConfig;
     sslConfig: SSLConfig;
   }

   class TwoStageIntentLockService {
     // Stage 1: Create plan approval lock
     async createPlanApproval(
       projectId: string,
       hyperThinkingResult: HyperThinkingResult
     ): Promise<PlanApprovalLock> {
       const plan = hyperThinkingResult.synthesizedPlan;
       const embedding = await this.vlJepa.generateEmbedding(plan);

       return this.db.insert({
         projectId,
         stage: IntentLockStage.PLAN_APPROVAL,
         plan,
         userModifications: [],
         approved: false,
         embedding,
         createdAt: new Date()
       });
     }

     // Stage 1: User modifies plan (allowed)
     async modifyPlan(
       lockId: string,
       modifications: Modification[]
     ): Promise<PlanApprovalLock> {
       const lock = await this.getLock(lockId);
       if (lock.stage !== IntentLockStage.PLAN_APPROVAL) {
         throw new Error('Cannot modify final contract');
       }
       if (lock.approved) {
         throw new Error('Cannot modify approved plan - create new build');
       }

       // Apply modifications and re-analyze
       const modifiedPlan = this.applyModifications(lock.plan, modifications);
       const newEmbedding = await this.vlJepa.generateEmbedding(modifiedPlan);

       return this.db.update(lockId, {
         plan: modifiedPlan,
         userModifications: [...lock.userModifications, ...modifications],
         embedding: newEmbedding
       });
     }

     // Stage 1: User approves plan
     async approvePlan(lockId: string): Promise<PlanApprovalLock> {
       const lock = await this.getLock(lockId);
       if (lock.stage !== IntentLockStage.PLAN_APPROVAL) {
         throw new Error('Not a plan approval lock');
       }

       return this.db.update(lockId, {
         approved: true,
         approvedAt: new Date()
       });
     }

     // Stage 2: Create final contract (after plan approval + production config)
     async createFinalContract(
       planApprovalId: string,
       productionFeatures: ProductionFeatures,
       gpuConfig: GPUConfig | null,
       oauthConfig: OAuthConfig | null
     ): Promise<FinalContractLock> {
       const planApproval = await this.getLock(planApprovalId);

       if (!planApproval.approved) {
         throw new Error('Plan must be approved before final contract');
       }

       const sacredContract = this.buildSacredContract(
         planApproval.plan,
         productionFeatures,
         gpuConfig,
         oauthConfig
       );

       const embedding = await this.vlJepa.generateEmbedding(sacredContract);
       const embeddingHash = this.hashEmbedding(embedding);

       return this.db.insert({
         projectId: planApproval.projectId,
         stage: IntentLockStage.FINAL_CONTRACT,
         planApprovalId,
         sacredContract,
         productionFeatures,
         gpuConfig,
         oauthConfig,
         embedding,
         embeddingHash,
         lockedAt: new Date(),
         immutable: true
       });
     }

     // Stage 2: Verify integrity (no modifications allowed)
     async verifyIntegrity(lockId: string): Promise<IntegrityResult> {
       const lock = await this.getLock(lockId);
       if (lock.stage !== IntentLockStage.FINAL_CONTRACT) {
         throw new Error('Not a final contract');
       }

       const currentHash = this.hashEmbedding(lock.embedding);
       return {
         valid: currentHash === lock.embeddingHash,
         contract: lock.sacredContract
       };
     }

     // Reject any modification to final contract
     async modifyFinalContract(lockId: string): Promise<never> {
       throw new Error('Final contract is IMMUTABLE. Create a new build to make changes.');
     }
   }

2. Database Schema Updates:

   CREATE TABLE intent_locks (
     id TEXT PRIMARY KEY,
     project_id TEXT REFERENCES projects(id),
     stage TEXT NOT NULL,  -- 'plan_approval' or 'final_contract'
     plan_approval_id TEXT REFERENCES intent_locks(id),  -- For final contracts
     content JSONB NOT NULL,
     embedding BLOB,
     embedding_hash TEXT,
     approved BOOLEAN DEFAULT false,
     approved_at TIMESTAMP,
     locked_at TIMESTAMP,
     immutable BOOLEAN DEFAULT false,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX idx_intent_locks_project ON intent_locks(project_id, stage);

3. UI Flow:

   Step 1: User enters NLP request
   Step 2: Hyper-Thinking runs → Plan generated
   Step 3: Plan Approval Lock created
   Step 4: User reviews plan in UI
   Step 5: User can MODIFY plan (changes tracked)
   Step 6: User clicks "Approve Plan" → Plan locked
   Step 7: User configures production features, GPU, OAuth
   Step 8: User clicks "Start Build" → Final Contract created (IMMUTABLE)
   Step 9: Build loop executes against immutable contract

4. Integration with Build Loop:
   - Build loop receives final_contract_id
   - All verification checks against final contract
   - Semantic drift detection uses final contract embedding
   - Any detected modifications abort build with integrity error

5. Audit Trail:
   - Log all plan modifications with user, timestamp, diff
   - Log final contract creation
   - Log any integrity check failures
   - Feed into L4 user learning for pattern analysis

Implement with comprehensive validation, audit logging, and VL-JEPA integration.
```

---

# Section 8: Tournament Mode with Hyper-Thinking

## Implementation Prompt 8.1: Tournament Mode

```
PROMPT FOR OPUS 4.5 - TOURNAMENT MODE WITH HYPER-THINKING

Context: Tournament Mode is an OPTIONAL feature that creates code multiple times
and selects the best result. It costs more but produces higher quality output.
When combined with Hyper-Thinking, it uses the full cognitive pipeline for each
tournament participant.

Task: Implement Tournament Mode as optional user-enabled feature

Requirements:
1. Create server/src/services/tournament/tournament-orchestrator.ts:

   interface TournamentConfig {
     enabled: boolean;
     participants: number;  // 2-5 parallel implementations
     useHyperThinking: boolean;  // Use full cognitive pipeline per participant
     evaluationCriteria: EvaluationCriterion[];
     userBudget: number;  // Max cost user willing to spend
   }

   interface TournamentParticipant {
     id: string;
     approach: string;  // From Hyper-Thinking EXPLORE phase
     implementation: Implementation;
     scores: EvaluationScores;
     cost: number;
     duration: number;
   }

   interface TournamentResult {
     winner: TournamentParticipant;
     allParticipants: TournamentParticipant[];
     totalCost: number;
     improvementOverSingle: number;  // % improvement vs single implementation
   }

   class TournamentOrchestrator {
     async runTournament(
       projectId: string,
       userRequest: string,
       config: TournamentConfig
     ): Promise<TournamentResult> {
       // 1. Run Hyper-Thinking to generate N approaches
       const hyperThinking = await this.hyperThinkingPipeline.execute(userRequest);
       const approaches = hyperThinking.explorations.slice(0, config.participants);

       // 2. Run parallel implementations (using AI Lab)
       const implementations = await this.runParallelImplementations(approaches);

       // 3. Evaluate each implementation
       const evaluations = await this.evaluateImplementations(
         implementations,
         config.evaluationCriteria
       );

       // 4. Select winner
       const winner = this.selectWinner(evaluations);

       // 5. Optionally combine best elements (synthesis)
       if (config.synthesizeBest) {
         const synthesized = await this.synthesizeBestElements(evaluations);
         return { winner: synthesized, ... };
       }

       return { winner, allParticipants: evaluations, ... };
     }

     private async runParallelImplementations(
       approaches: Approach[]
     ): Promise<Implementation[]> {
       // Use AI Lab 5 parallel orchestrations
       // Each approach gets its own build loop execution
       return Promise.all(
         approaches.map(approach =>
           this.aiLabOrchestrator.executeWithApproach(approach)
         )
       );
     }

     private async evaluateImplementations(
       implementations: Implementation[],
       criteria: EvaluationCriterion[]
     ): Promise<TournamentParticipant[]> {
       return Promise.all(
         implementations.map(async impl => {
           const scores = await this.evaluateAgainstCriteria(impl, criteria);
           return {
             id: impl.id,
             approach: impl.approach,
             implementation: impl,
             scores,
             cost: impl.cost,
             duration: impl.duration
           };
         })
       );
     }

     private selectWinner(participants: TournamentParticipant[]): TournamentParticipant {
       // Weighted scoring based on criteria importance
       const scored = participants.map(p => ({
         participant: p,
         totalScore: this.calculateWeightedScore(p.scores)
       }));

       return scored.sort((a, b) => b.totalScore - a.totalScore)[0].participant;
     }
   }

2. Evaluation Criteria:

   interface EvaluationCriterion {
     name: string;
     weight: number;
     evaluator: (impl: Implementation) => Promise<number>;
   }

   const DEFAULT_CRITERIA: EvaluationCriterion[] = [
     {
       name: 'intent_alignment',
       weight: 0.30,
       evaluator: async (impl) => {
         // VL-JEPA semantic similarity to original request
         return this.vlJepa.calculateSimilarity(impl.output, impl.intent);
       }
     },
     {
       name: 'code_quality',
       weight: 0.25,
       evaluator: async (impl) => {
         // Code quality metrics
         return this.codeQualityAnalyzer.analyze(impl.code);
       }
     },
     {
       name: 'test_coverage',
       weight: 0.20,
       evaluator: async (impl) => {
         // Test coverage percentage
         return impl.testCoverage;
       }
     },
     {
       name: 'security_score',
       weight: 0.15,
       evaluator: async (impl) => {
         // Security scan results
         return this.securityScanner.getScore(impl.code);
       }
     },
     {
       name: 'performance',
       weight: 0.10,
       evaluator: async (impl) => {
         // Bundle size, load time, etc.
         return this.performanceAnalyzer.analyze(impl);
       }
     }
   ];

3. Cost Estimation:

   class TournamentCostEstimator {
     estimateCost(config: TournamentConfig): CostEstimate {
       const singleBuildCost = this.estimateSingleBuild();
       const hyperThinkingCost = config.useHyperThinking
         ? this.estimateHyperThinking() * config.participants
         : 0;

       return {
         totalEstimate: (singleBuildCost * config.participants) + hyperThinkingCost,
         breakdown: {
           implementations: singleBuildCost * config.participants,
           hyperThinking: hyperThinkingCost,
           evaluation: this.estimateEvaluation(config.participants)
         },
         confidenceRange: { low: 0.8, high: 1.3 }  // Cost can vary ±30%
       };
     }
   }

4. UI Integration:

   // client/src/components/build/TournamentModeToggle.tsx
   interface TournamentModeToggleProps {
     enabled: boolean;
     onToggle: (enabled: boolean) => void;
     config: TournamentConfig;
     onConfigChange: (config: TournamentConfig) => void;
     costEstimate: CostEstimate;
   }

   // Show clear cost warning
   // "Tournament Mode: ~3x cost, typically 15-25% better results"
   // User must explicitly enable and confirm cost

5. Integration with Two-Stage Intent Lock:
   - Tournament runs AFTER plan approval (Stage 1)
   - Each participant uses same approved plan as base
   - Winner's implementation becomes basis for final contract (Stage 2)

6. Metrics and Learning:
   - Track tournament win patterns
   - Learn which approaches tend to win for which task types
   - Feed into Hyper-Thinking EXPLORE phase optimization
   - Store in L5 global learning for cross-user benefit

7. Configuration:
   TOURNAMENT_MAX_PARTICIPANTS: 5
   TOURNAMENT_DEFAULT_PARTICIPANTS: 3
   TOURNAMENT_HYPER_THINKING_DEFAULT: true
   TOURNAMENT_COST_MULTIPLIER_WARNING: 2.5

Implement with clear cost communication and user consent for higher costs.
```

---

# Section 9: Context Compaction System

## Implementation Prompt 9.1: 24-Hour Build Context Management

```
PROMPT FOR OPUS 4.5 - CONTEXT COMPACTION

Context: KripTik AI builds can run for extended periods (up to 24 hours for complex
projects). Context windows fill up, causing loss of critical information. Implement
a context compaction system to maintain relevant context throughout long builds.

Task: Implement context compaction for extended build sessions

Requirements:
1. Create server/src/services/context/context-compaction-service.ts:

   interface ContextWindow {
     maxTokens: number;
     currentTokens: number;
     segments: ContextSegment[];
   }

   interface ContextSegment {
     id: string;
     type: ContextType;
     content: string;
     tokenCount: number;
     importance: number;
     timestamp: Date;
     embedding?: Float32Array;
   }

   enum ContextType {
     INTENT = 'intent',
     SACRED_CONTRACT = 'sacred',  // From Two-Stage Intent Lock (Stage 2)
     PLAN_APPROVAL = 'plan',      // From Two-Stage Intent Lock (Stage 1)
     CODE_GENERATED = 'code',
     VERIFICATION = 'verify',
     ERROR = 'error',
     LEARNING = 'learning',
     CONVERSATION = 'convo'
   }

   class ContextCompactionService {
     async compact(
       window: ContextWindow,
       targetTokens: number
     ): Promise<ContextWindow> {
       // NEVER remove INTENT, SACRED_CONTRACT, or PLAN_APPROVAL segments
       const protected = window.segments.filter(
         s => s.type === ContextType.INTENT ||
              s.type === ContextType.SACRED_CONTRACT ||
              s.type === ContextType.PLAN_APPROVAL
       );

       // Sort compactable by importance * recency
       // Summarize instead of dropping
       // Use VL-JEPA embeddings for semantic retrieval
     }
   }

2. Protected Context Rules:
   - Intent Lock contracts (both stages): NEVER compact or summarize
   - Critical errors: Keep full detail for 1 hour
   - Verification failures: Keep until resolved
   - User feedback: Keep for entire session

3. Integration with Qdrant:
   - Store context segments with embeddings in Qdrant
   - Enable semantic retrieval of relevant context
   - Dynamic context loading: only load what's needed

4. Configuration:
   CONTEXT_MAX_TOKENS: 128000
   CONTEXT_COMPACT_THRESHOLD: 0.8
   CONTEXT_TARGET_UTILIZATION: 0.6
```

---

# Section 10: Implementation Sequence & Dependencies

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTATION DEPENDENCY GRAPH v3.0                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: Foundation (Parallel)                                             │
│  ├── 2.1 VL-JEPA Core + Component 28 Enhancement ────┐                      │
│  ├── 4.1 Update Model Router with Jan 2026 IDs ──────┼───────┐              │
│  ├── 4.2 OpenAI Responses API (GPT-5.2) ─────────────┤       │              │
│  ├── 4.3 Anthropic Interleaved Thinking ─────────────┤       │              │
│  └── 5.1 Qdrant Integration ─────────────────────────┘       │              │
│                                                               │              │
│  PHASE 2: Cognitive Layer (Sequential)                       │              │
│  ├── 3.1 Hyper-Thinking Core ◀───────────────────────────────┘              │
│  ├── 3.2 Extended Thinking (depends on 3.1, 4.3)                            │
│  └── 3.3 Parallel Cognitive (depends on 3.1, 3.2)                           │
│                                                                              │
│  PHASE 3: Intent Lock & Semantic (Sequential)                               │
│  ├── 7.1 Two-Stage Intent Lock (depends on 2.1, 3.1)                        │
│  ├── 2.2 Semantic Verification (depends on 2.1, 5.1, 7.1)                   │
│  └── 2.3 Visual Semantic (depends on 2.1, 2.2)                              │
│                                                                              │
│  PHASE 4: Infrastructure & Tournament (Parallel)                            │
│  ├── 5.2 RunPod Enhancement                                                  │
│  ├── 5.3 Cleanup Mechanism                                                   │
│  └── 8.1 Tournament Mode (depends on 3.1, 7.1)                              │
│                                                                              │
│  PHASE 5: Quality & Context (Parallel)                                       │
│  ├── 6.1 Deliberative Alignment (depends on 2.2)                            │
│  ├── 6.2 Enhanced Escalation (depends on 3.1, 2.1)                          │
│  └── 9.1 Context Compaction (depends on 5.1, 7.1)                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Order

### Phase 1: Foundation
Execute these prompts in parallel:
1. **Prompt 2.1**: VL-JEPA Core Integration + Component 28 Enhancement
2. **Prompt 4.1**: Update Model Router with January 2026 Model IDs
3. **Prompt 4.2**: OpenAI Responses API Integration (GPT-5.2)
4. **Prompt 4.3**: Anthropic Interleaved Thinking Integration
5. **Prompt 5.1**: Qdrant Vector Database Integration

### Phase 2: Cognitive Layer
Execute sequentially:
1. **Prompt 3.1**: Hyper-Thinking Pipeline Core
2. **Prompt 3.2**: Extended Thinking Integration
3. **Prompt 3.3**: Parallel Cognitive Processing

### Phase 3: Intent Lock & Semantic Layer
Execute sequentially:
1. **Prompt 7.1**: Two-Stage Intent Lock System
2. **Prompt 2.2**: Intent-to-Output Semantic Verification
3. **Prompt 2.3**: Visual Semantic Comparison

### Phase 4: Infrastructure & Tournament
Execute in parallel:
1. **Prompt 5.2**: RunPod GPU Enhancement
2. **Prompt 5.3**: Abandoned App Cleanup Mechanism
3. **Prompt 8.1**: Tournament Mode with Hyper-Thinking

### Phase 5: Quality & Context
Execute in parallel:
1. **Prompt 6.1**: Deliberative Alignment Quality Specs
2. **Prompt 6.2**: Enhanced Error Escalation
3. **Prompt 9.1**: Context Compaction System

## Verification Checkpoints

After each phase, verify:

1. **Phase 1 Complete**:
   - [ ] Embeddings generate correctly (Qwen3-Embedding-8B)
   - [ ] Qdrant stores and retrieves vectors
   - [ ] Model router uses correct January 2026 model IDs
   - [ ] OpenAI Responses API calls work
   - [ ] Interleaved thinking produces thinking blocks
   - [ ] Component 28 (L1-L5) enhanced with embeddings

2. **Phase 2 Complete**:
   - [ ] Hyper-Thinking produces cognitive artifacts
   - [ ] Extended thinking budgets are respected
   - [ ] AI Lab parallel orchestration works with cognitive agents

3. **Phase 3 Complete**:
   - [ ] Two-stage intent lock works (plan approval → final contract)
   - [ ] Plan modifications tracked and re-analyzed
   - [ ] Final contract is truly immutable
   - [ ] Semantic drift detection triggers at threshold
   - [ ] Semantic verifier is 14th agent in swarm (after core, before gap closers)

4. **Phase 4 Complete**:
   - [ ] RunPod endpoints enhanced for VL-JEPA workloads
   - [ ] Cleanup mechanism archives after 30 days
   - [ ] Tournament mode produces N implementations and selects winner

5. **Phase 5 Complete**:
   - [ ] Quality specs evaluate builds
   - [ ] Error escalation uses embedding similarity for pattern matching
   - [ ] Context compaction preserves sacred contracts

## Environment Variables Summary

```bash
# ============================================
# DIRECT API PROVIDERS (Primary)
# ============================================

# Anthropic (Direct API - api.anthropic.com)
ANTHROPIC_API_KEY=
EXTENDED_THINKING_DEFAULT_BUDGET=50000
INTERLEAVED_THINKING_ENABLED=true

# OpenAI (Direct API - api.openai.com)
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=gpt-5.2
OPENAI_REASONING_MODEL=gpt-5.2-pro
OPENAI_FAST_MODEL=gpt-5.2-instant

# ============================================
# OPENROUTER (Gateway for Other Providers)
# ============================================

# OpenRouter (for DeepSeek, Llama, Qwen, GLM, Kimi, etc.)
OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=deepseek-chat
OPENROUTER_FALLBACK_MODEL=meta-llama/llama-3.3-70b-instruct

# ============================================
# EMBEDDINGS & VECTOR DATABASE
# ============================================

# HuggingFace (Embeddings)
HUGGINGFACE_API_KEY=
VL_JEPA_SIMILARITY_THRESHOLD=0.85

# Qdrant (Vector Database - NEW)
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION_PREFIX=kriptik_

# ============================================
# GPU COMPUTE (KripTik + User Infrastructure)
# ============================================

# RunPod (KripTik's account - metered to users)
RUNPOD_API_KEY=
RUNPOD_DEFAULT_GPU=A100
RUNPOD_MAX_SPEND_DAILY=100

# Modal (KripTik's account - metered to users)
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=

# ============================================
# DATABASE & DEPLOYMENT
# ============================================

# Turso (existing)
DATABASE_URL=
DATABASE_AUTH_TOKEN=

# Vercel
VERCEL_TOKEN=

# ============================================
# COST MANAGEMENT
# ============================================

DAILY_COST_LIMIT=100
PER_BUILD_COST_LIMIT=10
COST_OPTIMIZED_THRESHOLD=0.5

# ============================================
# CONTEXT MANAGEMENT
# ============================================

CONTEXT_MAX_TOKENS=128000
CONTEXT_COMPACT_THRESHOLD=0.8

# ============================================
# CLEANUP MECHANISM (for abandoned apps)
# ============================================

CLEANUP_INACTIVE_DAYS=30
CLEANUP_DELETE_DAYS=90
CLEANUP_WARNING_DAYS=7

# ============================================
# TOURNAMENT MODE
# ============================================

TOURNAMENT_MAX_PARTICIPANTS=5
TOURNAMENT_DEFAULT_PARTICIPANTS=3
TOURNAMENT_HYPER_THINKING_DEFAULT=true
```

---

## Final Notes

This enhancement plan v3.0 integrates with KripTik AI's existing architecture:

**Corrected Architecture:**
- **8-Phase Build Loop** (not 6): Init → Plan → Impl → Verify → Test → Deploy → Monitor → Learn
- **13-Agent Verification Swarm** (6 core + 7 gap closers) + new Semantic Verifier (14th)
- **5-Layer Learning Engine** (Component 28) dramatically enhanced with VL-JEPA embeddings
- **Existing model-router.ts** updated with January 2026 model IDs
- **Existing openrouter-client.ts** for non-OpenAI/Anthropic models

**Key Changes from v2.1:**
- Removed KripToeNite entirely (speculative execution merged into main flow)
- No model selector on builder view (auto best experience)
- Two-Stage Intent Lock (Plan Approval → Final Contract)
- Tournament Mode with Hyper-Thinking (optional, higher cost)
- All model IDs verified as of January 6, 2026
- Semantic verification positioned after core agents, before gap closers
- Component 28 dramatically enhanced with embedding-based learning

**Verified Model IDs (January 6, 2026):**
- Claude: claude-opus-4-5-20251101, claude-sonnet-4-5-20250929, claude-haiku-4-5
- GPT-5.2: gpt-5.2, gpt-5.2-instant, gpt-5.2-pro
- DeepSeek: deepseek-chat, deepseek-reasoner
- GLM: glm-4-plus (GLM 4.7)
- Kimi: moonshot/kimi-k2

All prompts are production-ready for Opus 4.5 in Cursor or Claude Code. Each prompt contains complete requirements, TypeScript interfaces, and integration points.

---

*Generated: January 6, 2026*
*Version: 3.0*
*Target: Claude Opus 4.5 (claude-opus-4-5-20251101)*
