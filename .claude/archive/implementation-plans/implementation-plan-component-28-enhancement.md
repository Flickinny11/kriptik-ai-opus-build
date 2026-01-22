# Component 28 Enhancement - Autonomous Learning Engine v2

## Implementation Plan for KripTik AI

**Created**: January 7, 2026
**Phase**: 3C - Component 28 Enhancement
**Priority**: HIGH (enables true self-improvement)

---

## Executive Summary

This plan enhances KripTik AI's existing 5-layer Autonomous Learning Engine (Component 28) with cutting-edge 2026 self-improving AI techniques. The current system captures experience, generates RLAIF preference pairs, trains shadow models, and evolves strategies - but lacks real-time learning, multi-agent knowledge sharing, direct-RLAIF, and automatic model deployment.

---

## Research Summary (January 2026)

### Latest RLAIF Advancements

**Direct-RLAIF (d-RLAIF)**:
- Bypasses reward model training by getting rewards directly from LLM labeler during RL
- Achieves superior performance to canonical RLAIF
- RLAIF-V 7B reduces hallucination by 82.9% using 34B labeler

**Multi-Judge RLAIF**:
- Multiple AI models provide feedback for consensus
- Reduces risk of reinforcing unwanted behaviors
- Higher reliability than single-judge systems

**Self-Verification / Auto-Judging**:
- Agents equipped with internal feedback loops
- Non-blocking error correction during execution
- Enables complex multi-hop workflows

### Self-Improving Agent Architectures

**Reflexion-Based Learning**:
- Turn feedback into textual "self-reflection notes"
- Append to memory for use in next attempt
- Language itself as the feedback mechanism

**Continuous Learning Without Forgetting**:
- Intelligent memory prioritization
- Avoid catastrophic forgetting
- Learn incrementally during operation

**Decentralized Agent Networks**:
- Agents learn from each other
- Share information across sessions
- Retain knowledge over long horizons (weeks/months)

### Meta-Learning 2026

**Few-Shot Learning**:
- Recognize patterns from limited examples
- Generalization over memorization
- Essential for rare error patterns

**Context Priority Learning**:
- Learn which context is most valuable
- Dynamic context window management
- Prioritize relevant information

---

## Current Implementation Analysis

### Existing 5-Layer Architecture

**Layer 1: Experience Capture** (`experience-capture.ts`)
- ✅ Decision traces with outcomes
- ✅ Code artifact tracking with versions
- ✅ Design choice recording
- ✅ Error recovery journey capture
- ❌ No real-time capture during builds
- ❌ No cross-build linking

**Layer 2: AI Judgment / RLAIF** (`ai-judgment.ts`)
- ✅ Code quality judge
- ✅ Design quality judge (Anti-Slop)
- ✅ Success predictor
- ✅ Preference pair generation
- ❌ Single model only (no consensus)
- ❌ No direct-RLAIF
- ❌ No vision-specific RLAIF

**Layer 3: Shadow Model Registry** (`shadow-model-registry.ts`)
- ✅ Model registration and versioning
- ✅ Training run management
- ✅ DPO training data preparation
- ❌ Models queued but never auto-deployed
- ❌ No automatic promotion after evaluation
- ❌ Outdated base models (need 2026 updates)

**Layer 4: Meta-Learning** (`pattern-library.ts`, `strategy-evolution.ts`)
- ✅ Pattern extraction from code/design/errors
- ✅ Strategy selection with epsilon-greedy
- ✅ Strategy evolution based on outcomes
- ❌ No Reflexion-based learning
- ❌ No few-shot pattern matching
- ❌ Limited pattern embedding/retrieval

**Layer 5: Evolution Flywheel** (`evolution-flywheel.ts`)
- ✅ 7-phase cycle orchestration
- ✅ Metrics collection and improvement calculation
- ✅ Dashboard data API
- ❌ Only batch cycles (no real-time)
- ❌ No cross-build knowledge transfer
- ❌ No auto-triggered cycles

### Gaps to Address

1. **Real-Time Learning**: Currently batch-only, need continuous learning during builds
2. **Multi-Judge Consensus**: Single judge is fragile, need ensemble
3. **Direct-RLAIF**: More efficient than reward model approach
4. **Shadow Model Auto-Deploy**: Models trained but never deployed
5. **Reflexion System**: No self-reflection notes mechanism
6. **Cross-Build Transfer**: Each build isolated, no shared learning
7. **Vision RLAIF**: Visual verification has no learning loop
8. **Agent Network**: Parallel agents don't share learnings
9. **Context Priority**: No learned prioritization of context
10. **Updated Base Models**: Shadow model configs use older models

---

## Enhancement Architecture

### New Components to Add

```
server/src/services/learning/
├── existing files... (enhance)
├── direct-rlaif.ts          # NEW: Direct RLAIF without reward models
├── multi-judge.ts           # NEW: Multi-model consensus judging
├── reflexion.ts             # NEW: Self-reflection note generation
├── real-time-learning.ts    # NEW: Learn during builds
├── cross-build-transfer.ts  # NEW: Knowledge sharing across builds
├── vision-rlaif.ts          # NEW: Visual verification learning
├── agent-network.ts         # NEW: Decentralized agent learning
├── context-priority.ts      # NEW: Learn context importance
├── shadow-model-deployer.ts # NEW: Auto-deploy trained models
└── enhanced-types.ts        # NEW: Extended type definitions
```

### Database Schema Additions

```sql
-- Reflexion notes for self-improvement
CREATE TABLE learning_reflexion_notes (
  id TEXT PRIMARY KEY,
  buildId TEXT,
  agentId TEXT,
  phase TEXT NOT NULL,
  failureDescription TEXT NOT NULL,
  rootCauseAnalysis TEXT NOT NULL,
  lessonLearned TEXT NOT NULL,
  suggestedApproach TEXT NOT NULL,
  appliedInBuild TEXT,
  effectiveness INTEGER,
  createdAt TEXT NOT NULL
);

-- Cross-build knowledge links
CREATE TABLE learning_knowledge_links (
  id TEXT PRIMARY KEY,
  sourceBuildId TEXT NOT NULL,
  targetBuildId TEXT,
  knowledgeType TEXT NOT NULL,  -- pattern, strategy, reflexion, preference
  knowledgeId TEXT NOT NULL,
  relevanceScore REAL,
  usedAt TEXT,
  effectivenessScore INTEGER,
  createdAt TEXT NOT NULL
);

-- Multi-judge consensus records
CREATE TABLE learning_judge_consensus (
  id TEXT PRIMARY KEY,
  judgmentId TEXT NOT NULL,
  judges TEXT NOT NULL,  -- JSON array of judge models
  individualScores TEXT NOT NULL,  -- JSON scores from each judge
  consensusScore REAL NOT NULL,
  disagreementLevel REAL,
  finalVerdict TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

-- Real-time learning events
CREATE TABLE learning_realtime_events (
  id TEXT PRIMARY KEY,
  buildId TEXT NOT NULL,
  eventType TEXT NOT NULL,  -- decision, error, fix, verification
  eventData TEXT NOT NULL,
  learningApplied TEXT,
  outcome TEXT,
  processingTimeMs INTEGER,
  createdAt TEXT NOT NULL
);

-- Vision RLAIF training data
CREATE TABLE learning_vision_pairs (
  id TEXT PRIMARY KEY,
  pairId TEXT NOT NULL UNIQUE,
  screenshotBefore TEXT,  -- Base64 or URL
  screenshotAfter TEXT,
  codeChanges TEXT NOT NULL,
  visualScore INTEGER NOT NULL,
  antiSlopScore INTEGER NOT NULL,
  judgmentReasoning TEXT,
  usedInTraining INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL
);

-- Deployed shadow model endpoints
CREATE TABLE learning_deployed_models (
  id TEXT PRIMARY KEY,
  modelName TEXT NOT NULL,
  modelVersion TEXT NOT NULL,
  provider TEXT NOT NULL,  -- runpod, modal
  endpointUrl TEXT NOT NULL,
  status TEXT NOT NULL,  -- deploying, active, stopped, failed
  deploymentConfig TEXT,
  lastHealthCheck TEXT,
  requestCount INTEGER DEFAULT 0,
  avgLatencyMs REAL,
  createdAt TEXT NOT NULL
);
```

---

## NLP Prompts for Implementation

### PROMPT 1: Direct-RLAIF System

```
You are building the Direct-RLAIF (d-RLAIF) system for KripTik AI's Component 28 Enhancement.

CONTEXT:
- KripTik AI has an existing RLAIF system that trains reward models on preference pairs
- Direct-RLAIF bypasses reward model training by getting rewards directly from an LLM
- This is more efficient and achieves superior results according to 2026 research
- The existing ai-judgment.ts generates preference pairs but uses indirect RLAIF

EXISTING FILES TO UNDERSTAND:
1. server/src/services/learning/ai-judgment.ts - Current RLAIF implementation
2. server/src/services/learning/shadow-model-registry.ts - Shadow model training
3. server/src/services/learning/types.ts - Type definitions
4. server/src/schema.ts - Database schema

CREATE: server/src/services/learning/direct-rlaif.ts

IMPLEMENTATION REQUIREMENTS:

1. DirectRLAIFService class:
   - getDirectReward(prompt, response, context) - Get reward score directly from LLM
   - batchEvaluate(candidates[]) - Score multiple responses for same prompt
   - selectBestCandidate(prompt, candidates[]) - Choose best response using direct scoring
   - generateWithDirectFeedback(prompt, iterations) - Iteratively improve responses

2. Direct reward scoring:
   - Use Claude Opus 4.5 (claude-opus-4-5-20251101) as the labeler model
   - Single API call per evaluation (no separate reward model)
   - Structured JSON response with score 0-100 and reasoning
   - Support for different evaluation criteria (code quality, design, etc.)

3. Scoring prompts by category:
   - CODE_REWARD_PROMPT: Evaluate code quality, correctness, patterns
   - DESIGN_REWARD_PROMPT: Evaluate against Anti-Slop principles
   - ERROR_FIX_REWARD_PROMPT: Evaluate fix quality and completeness
   - ARCHITECTURE_REWARD_PROMPT: Evaluate architectural decisions

4. Integration with existing system:
   - Can be used alongside preference pair generation
   - Direct rewards feed into shadow model training
   - Real-time scoring during build phases

5. Performance optimization:
   - Cache similar evaluations
   - Batch requests when possible
   - Track API costs for each evaluation

6. Database integration:
   - Store direct reward scores in learning_realtime_events
   - Link to decisions/artifacts being evaluated
   - Track effectiveness of direct vs indirect RLAIF

TECHNICAL REQUIREMENTS:
- Use existing createAnthropicClient() utility
- Implement proper error handling with retries
- Export singleton pattern like other learning services
- Full TypeScript with proper types

OUTPUT: Complete implementation ready for production use.
```

---

### PROMPT 2: Multi-Judge Consensus System

```
You are building the Multi-Judge Consensus System for KripTik AI's Component 28 Enhancement.

CONTEXT:
- Single AI judge can have biases or blind spots
- Multiple judges provide more reliable feedback
- Need consensus mechanism to combine multiple evaluations
- 2026 research shows multi-judge RLAIF reduces harmful reinforcement

EXISTING FILES TO UNDERSTAND:
1. server/src/services/learning/ai-judgment.ts - Current single-judge system
2. server/src/services/ai/model-router.ts - Model selection logic
3. server/src/services/ai/openrouter-client.ts - AI provider configuration

CREATE: server/src/services/learning/multi-judge.ts

IMPLEMENTATION REQUIREMENTS:

1. MultiJudgeService class:
   - configureJudgePanel(category) - Select appropriate judges for task type
   - evaluateWithConsensus(artifact, category) - Get consensus from multiple judges
   - resolveDisagreement(scores[]) - Handle significant score divergence
   - getConsensusStats() - Analytics on judge agreement

2. Judge Panel Configuration:
   ```typescript
   const JUDGE_PANELS = {
     code_quality: [
       { model: 'claude-opus-4-5-20251101', weight: 0.4 },
       { model: 'claude-sonnet-4-5-20241022', weight: 0.3 },
       { model: 'gpt-4o', weight: 0.3 }
     ],
     design_quality: [
       { model: 'claude-opus-4-5-20251101', weight: 0.5 },
       { model: 'gpt-4o', weight: 0.3 },
       { model: 'gemini-3-pro', weight: 0.2 }
     ],
     // ... more panels
   };
   ```

3. Consensus algorithms:
   - Weighted average for numerical scores
   - Majority voting for categorical decisions
   - Outlier detection and handling
   - Confidence calculation based on agreement

4. Disagreement resolution:
   - When scores diverge >20 points, trigger analysis
   - Use highest-tier model to break ties
   - Record disagreements for learning improvement
   - Generate insights about judge reliability

5. Parallel evaluation:
   - Call all judges simultaneously
   - Handle partial failures gracefully
   - Timeout management per judge

6. Database schema usage:
   - Store in learning_judge_consensus table
   - Track individual scores, consensus, and disagreement
   - Link to original artifact/decision

TECHNICAL REQUIREMENTS:
- Use Promise.allSettled for parallel judge calls
- Respect rate limits for each provider
- Track costs by judge for optimization
- Full TypeScript with ConsensusResult types

OUTPUT: Complete multi-judge system with consensus logic.
```

---

### PROMPT 3: Reflexion-Based Learning System

```
You are building the Reflexion-Based Learning System for KripTik AI's Component 28 Enhancement.

CONTEXT:
- Reflexion is a 2026 technique where agents generate self-reflection notes after failures
- These notes are appended to memory and used as context in future attempts
- Language itself becomes the feedback mechanism
- Currently KripTik has no self-reflection capability

EXISTING FILES TO UNDERSTAND:
1. server/src/services/learning/experience-capture.ts - Captures error traces
2. server/src/services/learning/pattern-library.ts - Pattern extraction
3. server/src/services/learning/types.ts - ErrorRecoveryTrace type

CREATE: server/src/services/learning/reflexion.ts

IMPLEMENTATION REQUIREMENTS:

1. ReflexionService class:
   - generateReflexionNote(failure) - Create structured reflection from failure
   - retrieveRelevantReflexions(context, limit) - Find applicable past reflections
   - applyReflexionToPrompt(basePrompt, reflexions) - Augment prompts with learnings
   - scoreReflexionEffectiveness(reflexionId, outcome) - Track if reflection helped

2. Reflexion note structure:
   ```typescript
   interface ReflexionNote {
     reflexionId: string;
     buildId: string;
     agentId?: string;
     phase: string;
     // What happened
     failureDescription: string;
     errorType: string;
     errorMessage: string;
     attemptsMade: number;
     // Analysis
     rootCauseAnalysis: string;
     whatWentWrong: string;
     whatShouldHaveDone: string;
     // Learning
     lessonLearned: string;
     suggestedApproach: string;
     codePatternToAvoid?: string;
     codePatternToUse?: string;
     // Tracking
     appliedInBuild?: string;
     effectiveness?: number; // 0-100
     createdAt: Date;
   }
   ```

3. Generation prompt for Claude:
   ```
   You are analyzing a failure in an AI build system to generate a reflexion note.

   FAILURE DETAILS:
   [failure data]

   Generate a reflexion note that will help future attempts avoid this failure.
   Be specific about:
   1. What exactly went wrong (root cause, not symptoms)
   2. What approach should have been taken instead
   3. A clear lesson that can be applied to similar situations
   4. Any code patterns to use or avoid

   Respond with JSON:
   {
     "rootCauseAnalysis": "...",
     "whatWentWrong": "...",
     "whatShouldHaveDone": "...",
     "lessonLearned": "...",
     "suggestedApproach": "...",
     "codePatternToAvoid": "...",
     "codePatternToUse": "..."
   }
   ```

4. Retrieval system:
   - Semantic similarity search for relevant reflexions
   - Filter by phase, error type, and context
   - Rank by effectiveness score
   - Return top-k most relevant

5. Prompt augmentation:
   ```typescript
   function applyReflexionToPrompt(basePrompt: string, reflexions: ReflexionNote[]): string {
     const reflexionContext = reflexions.map(r =>
       `PAST LEARNING: ${r.lessonLearned}\n` +
       `SUGGESTED APPROACH: ${r.suggestedApproach}`
     ).join('\n\n');

     return `${basePrompt}\n\n` +
       `REFLEXION NOTES (learnings from similar past situations):\n${reflexionContext}`;
   }
   ```

6. Integration with build system:
   - Auto-generate reflexion after Level 3+ error escalation
   - Auto-retrieve reflexions when entering error recovery
   - Track which reflexions were applied and their effectiveness

DATABASE: Use learning_reflexion_notes table

OUTPUT: Complete reflexion system with generation and retrieval.
```

---

### PROMPT 4: Real-Time Learning Integration

```
You are building the Real-Time Learning Integration for KripTik AI's Component 28 Enhancement.

CONTEXT:
- Current learning system only runs batch cycles (daily/weekly)
- 2026 best practices emphasize continuous learning during operation
- Need to learn and apply learnings within the same build session
- Must avoid catastrophic forgetting while learning incrementally

EXISTING FILES TO UNDERSTAND:
1. server/src/services/learning/evolution-flywheel.ts - Batch cycle orchestration
2. server/src/services/automation/build-loop.ts - Build execution
3. server/src/services/feature-agent/feature-agent-service.ts - Feature agent flow

CREATE: server/src/services/learning/real-time-learning.ts

IMPLEMENTATION REQUIREMENTS:

1. RealTimeLearningService class:
   - processEvent(event) - Handle learning events as they occur
   - quickLearn(experience) - Immediate lightweight learning
   - deferToBackground(experience) - Queue for heavier processing
   - getActiveLearnings(context) - Retrieve applicable learnings

2. Event types to process:
   ```typescript
   type LearningEventType =
     | 'decision_made'      // Agent made a choice
     | 'code_generated'     // Code was produced
     | 'error_occurred'     // Error happened
     | 'error_fixed'        // Error was resolved
     | 'verification_passed'// Verification succeeded
     | 'verification_failed'// Verification failed
     | 'user_feedback'      // User provided feedback
     | 'phase_completed';   // Build phase finished
   ```

3. Quick learning (synchronous, <100ms):
   - Pattern recognition from recent successes
   - Error pattern caching for immediate reuse
   - Strategy effectiveness update
   - Context priority adjustment

4. Background learning (async, queued):
   - Full preference pair generation
   - Pattern extraction
   - Reflexion note generation
   - Shadow model training queue

5. In-build application:
   ```typescript
   async processAndApply(event: LearningEvent): Promise<LearningApplication> {
     // 1. Quick learn from event
     const quickLearnings = await this.quickLearn(event);

     // 2. Check if learnings apply to current phase
     const applicable = quickLearnings.filter(l => l.applicableNow);

     // 3. Return for immediate use
     return {
       patterns: applicable.patterns,
       strategies: applicable.strategies,
       reflexions: applicable.reflexions,
       warnings: applicable.warnings,
     };
   }
   ```

6. Anti-forgetting measures:
   - Only update, never delete patterns
   - Decay confidence slowly, not sharply
   - Preserve high-effectiveness learnings
   - Version control for strategies

7. Integration hooks:
   - Hook into build-loop.ts phase transitions
   - Hook into error-escalation.ts fix attempts
   - Hook into verification swarm results
   - Emit events for UI real-time updates

DATABASE: Use learning_realtime_events table

OUTPUT: Complete real-time learning system with immediate application.
```

---

### PROMPT 5: Cross-Build Knowledge Transfer

```
You are building the Cross-Build Knowledge Transfer System for KripTik AI's Component 28 Enhancement.

CONTEXT:
- Currently each build is isolated - learnings don't transfer
- 2026 research shows agents should share knowledge across sessions
- Need to identify what knowledge is transferable vs build-specific
- Enable "decentralized agent network" where agents learn from each other

EXISTING FILES TO UNDERSTAND:
1. server/src/services/learning/pattern-library.ts - Pattern storage
2. server/src/services/learning/strategy-evolution.ts - Strategy storage
3. server/src/services/ai/intent-lock.ts - Build intent contracts

CREATE: server/src/services/learning/cross-build-transfer.ts

IMPLEMENTATION REQUIREMENTS:

1. CrossBuildTransferService class:
   - identifyTransferableKnowledge(buildId) - Find knowledge worth sharing
   - matchKnowledgeToBuild(targetBuildId, knowledgePool) - Find relevant knowledge
   - transferKnowledge(sourceBuildId, targetBuildId) - Execute transfer
   - trackTransferEffectiveness(transferId, outcome) - Measure success

2. Knowledge transferability scoring:
   ```typescript
   interface TransferabilityScore {
     knowledgeId: string;
     knowledgeType: 'pattern' | 'strategy' | 'reflexion' | 'preference';
     score: number; // 0-100
     factors: {
       universality: number;      // Is it generalizable?
       successRate: number;       // Has it worked well?
       contextSimilarity: number; // Does context match?
       recency: number;           // Is it recent?
       uniqueness: number;        // Is it novel insight?
     };
   }
   ```

3. Build similarity matching:
   ```typescript
   async matchBuilds(targetIntent: IntentContract): Promise<SimilarBuild[]> {
     // Compare app souls
     // Compare feature sets
     // Compare tech stack
     // Compare user workflows
     // Return ranked similar builds
   }
   ```

4. Transfer types:
   - **Pattern Transfer**: Code/design patterns from similar apps
   - **Strategy Transfer**: Successful strategies for similar phases
   - **Reflexion Transfer**: Lessons learned from similar failures
   - **Preference Transfer**: Preference pairs for similar tasks

5. Transfer filtering:
   - Exclude build-specific knowledge (API keys, user data references)
   - Exclude low-confidence knowledge
   - Exclude frequently-failed knowledge
   - Prioritize high-impact knowledge

6. Application to new builds:
   ```typescript
   async applyTransferredKnowledge(buildId: string): Promise<void> {
     // 1. Get build intent
     const intent = await this.getIntent(buildId);

     // 2. Find similar past builds
     const similarBuilds = await this.matchBuilds(intent);

     // 3. Collect transferable knowledge
     const knowledge = await this.collectTransferableKnowledge(similarBuilds);

     // 4. Pre-load into current build's learning context
     await this.preloadKnowledge(buildId, knowledge);
   }
   ```

7. Effectiveness tracking:
   - Track which transferred knowledge was used
   - Measure outcome when used vs not used
   - Adjust transferability scores based on results

DATABASE: Use learning_knowledge_links table

OUTPUT: Complete cross-build knowledge transfer system.
```

---

### PROMPT 6: Vision RLAIF System

```
You are building the Vision RLAIF System for KripTik AI's Component 28 Enhancement.

CONTEXT:
- KripTik has visual verification (Anti-Slop detection) but no learning loop
- Screenshots are analyzed but analysis doesn't feed back into training
- 2026 RLAIF-V research shows vision models can learn from visual feedback
- Need to generate visual preference pairs for training

EXISTING FILES TO UNDERSTAND:
1. server/src/services/verification/anti-slop-detector.ts - Visual verification
2. server/src/services/verification/swarm.ts - Verification swarm
3. server/src/services/learning/ai-judgment.ts - RLAIF implementation

CREATE: server/src/services/learning/vision-rlaif.ts

IMPLEMENTATION REQUIREMENTS:

1. VisionRLAIFService class:
   - captureVisualPair(before, after, codeChanges) - Capture visual changes
   - judgeVisualImprovement(pair) - Score visual quality improvement
   - generateVisualPreferencePair(pair) - Create training data
   - getUnusedVisualPairs() - Get pairs for training

2. Visual pair structure:
   ```typescript
   interface VisualPair {
     pairId: string;
     screenshotBefore: string; // Base64 or URL
     screenshotAfter: string;
     codeChanges: string;
     componentPath: string;
     // Scores
     visualScoreBefore: number;
     visualScoreAfter: number;
     antiSlopScoreBefore: number;
     antiSlopScoreAfter: number;
     // Judgment
     improvement: number; // -100 to 100
     judgmentReasoning: string;
     // Training status
     usedInTraining: boolean;
     createdAt: Date;
   }
   ```

3. Visual judgment prompt:
   ```
   You are an elite UI designer evaluating visual changes against Anti-Slop principles.

   BEFORE IMAGE: [image]
   AFTER IMAGE: [image]
   CODE CHANGES: [code diff]

   Evaluate the visual improvement:
   1. Depth & Atmosphere (layering, shadows, backgrounds)
   2. Motion & Life (if animation changes visible)
   3. Typography (font choices, hierarchy)
   4. Color (palette, contrast, intentionality)
   5. Overall Design Quality

   Respond with JSON:
   {
     "improvement": <-100 to 100>,
     "categories": {
       "depth": <-100 to 100>,
       "typography": <-100 to 100>,
       "color": <-100 to 100>,
       "overall": <-100 to 100>
     },
     "reasoning": "..."
   }
   ```

4. Integration with visual verification:
   - Hook into anti-slop-detector.ts verification calls
   - Capture before/after screenshots automatically
   - Generate pairs when improvements detected
   - Track which code changes led to improvements

5. Training data generation:
   ```typescript
   async generateTrainingData(): Promise<VisionTrainingExample[]> {
     const pairs = await this.getUnusedVisualPairs();

     return pairs
       .filter(p => Math.abs(p.improvement) > 20) // Only clear wins/losses
       .map(p => ({
         prompt: `Improve the visual design of ${p.componentPath}`,
         chosen: p.improvement > 0 ? p.screenshotAfter : p.screenshotBefore,
         rejected: p.improvement > 0 ? p.screenshotBefore : p.screenshotAfter,
         codeChosen: p.improvement > 0 ? p.codeChanges : null,
       }));
   }
   ```

6. Screenshot handling:
   - Use existing browser MCP for screenshots
   - Store compressed/resized images
   - Support both local storage and S3

DATABASE: Use learning_vision_pairs table

OUTPUT: Complete vision RLAIF system for visual learning.
```

---

### PROMPT 7: Shadow Model Auto-Deployer

```
You are building the Shadow Model Auto-Deployer for KripTik AI's Component 28 Enhancement.

CONTEXT:
- KripTik trains shadow models but never automatically deploys them
- Models sit in HuggingFace Hub unused after training
- Need automatic deployment to RunPod/Modal for inference
- Need to actually USE trained models in production builds

EXISTING FILES TO UNDERSTAND:
1. server/src/services/learning/shadow-model-registry.ts - Model tracking
2. server/src/services/cloud/runpod.ts - RunPod deployment
3. server/src/services/cloud/modal.ts - Modal deployment
4. server/src/services/ml/training-orchestrator.ts - Training management

CREATE: server/src/services/learning/shadow-model-deployer.ts

IMPLEMENTATION REQUIREMENTS:

1. ShadowModelDeployerService class:
   - deployModel(modelName, version, provider) - Deploy trained model
   - getDeploymentStatus(deploymentId) - Check deployment health
   - routeToShadowModel(modelType, request) - Use deployed model for inference
   - autoDeployAfterTraining(trainingRunId) - Automatic post-training deploy
   - scaleDeployment(deploymentId, replicas) - Scale based on usage

2. Deployment configuration:
   ```typescript
   const DEPLOYMENT_CONFIGS: Record<ShadowModelType, DeploymentConfig> = {
     code_specialist: {
       provider: 'runpod',
       gpuType: 'nvidia-rtx-4090',
       containerImage: 'runpod/pytorch:2.2.0-py3.11-cuda12.1',
       minReplicas: 0,
       maxReplicas: 3,
       scaleDownDelay: 300, // 5 minutes
       healthCheckPath: '/health',
     },
     architecture_specialist: {
       provider: 'modal',
       gpuType: 'A10G',
       // ... config
     },
     // ... more configs
   };
   ```

3. Auto-deployment workflow:
   ```typescript
   async autoDeployAfterTraining(runId: string): Promise<void> {
     // 1. Get training run details
     const run = await this.shadowRegistry.getTrainingRun(runId);
     if (run.status !== 'completed') return;

     // 2. Get model evaluation score
     const model = await this.shadowRegistry.getModel(run.modelName, run.modelVersion);
     if (!model.evalScore || model.evalScore < 70) {
       console.log('Model eval score too low, skipping deployment');
       return;
     }

     // 3. Deploy to configured provider
     const deployment = await this.deployModel(
       run.modelName,
       run.modelVersion!,
       DEPLOYMENT_CONFIGS[run.modelName].provider
     );

     // 4. Health check and promote if healthy
     const healthy = await this.waitForHealthy(deployment.endpointUrl);
     if (healthy) {
       await this.shadowRegistry.promoteModel(run.modelName, run.modelVersion!);
       await this.updateDeploymentStatus(deployment.id, 'active');
     }
   }
   ```

4. Inference routing:
   ```typescript
   async routeToShadowModel(
     modelType: ShadowModelType,
     request: InferenceRequest
   ): Promise<InferenceResponse> {
     // 1. Get active deployment for model type
     const deployment = await this.getActiveDeployment(modelType);

     if (!deployment) {
       // Fall back to base model via OpenRouter
       return this.fallbackToBase(modelType, request);
     }

     // 2. Call deployed endpoint
     try {
       const response = await fetch(deployment.endpointUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(request),
       });

       // 3. Track usage
       await this.recordInferenceCall(deployment.id, response.ok);

       return response.json();
     } catch (error) {
       // Fall back on error
       return this.fallbackToBase(modelType, request);
     }
   }
   ```

5. Cost optimization:
   - Scale to 0 when no requests for 5 minutes
   - Track cost per inference
   - Compare shadow model cost vs OpenRouter cost
   - Auto-disable if shadow model is worse than base

6. Integration with build system:
   - Model router checks for available shadow models
   - Use shadow model for appropriate task types
   - Track performance comparison vs base models

DATABASE: Use learning_deployed_models table

OUTPUT: Complete auto-deployment system for trained shadow models.
```

---

### PROMPT 8: Agent Network Learning

```
You are building the Agent Network Learning System for KripTik AI's Component 28 Enhancement.

CONTEXT:
- KripTik runs up to 6 parallel Feature Agents
- Currently agents don't share learnings with each other
- 2026 research emphasizes "decentralized agent networks" that learn from each other
- Need agents to communicate discoveries in real-time

EXISTING FILES TO UNDERSTAND:
1. server/src/services/developer-mode/orchestrator.ts - Multi-agent coordination
2. server/src/services/feature-agent/feature-agent-service.ts - Feature agent
3. server/src/services/learning/real-time-learning.ts - Real-time learning (from Prompt 4)

CREATE: server/src/services/learning/agent-network.ts

IMPLEMENTATION REQUIREMENTS:

1. AgentNetworkService class:
   - registerAgent(agentId, buildId, capabilities) - Join network
   - broadcastLearning(agentId, learning) - Share discovery
   - subscribeToBroadcasts(agentId, callback) - Receive learnings
   - queryNetwork(agentId, query) - Ask other agents
   - getNetworkStats() - Network health metrics

2. Learning broadcast structure:
   ```typescript
   interface NetworkLearning {
     learningId: string;
     sourceAgentId: string;
     buildId: string;
     learningType: 'pattern' | 'error_fix' | 'strategy' | 'warning' | 'discovery';
     content: {
       summary: string;
       details: any;
       applicability: string[]; // What contexts this applies to
       confidence: number;
     };
     timestamp: Date;
   }
   ```

3. Broadcast channel using EventEmitter:
   ```typescript
   class AgentBroadcastChannel extends EventEmitter {
     private agents: Map<string, AgentInfo> = new Map();

     broadcast(learning: NetworkLearning): void {
       // Don't send to self
       for (const [agentId, info] of this.agents) {
         if (agentId !== learning.sourceAgentId) {
           // Check if learning is relevant to this agent
           if (this.isRelevant(learning, info)) {
             this.emit(`agent:${agentId}`, learning);
           }
         }
       }
     }
   }
   ```

4. Learning relevance scoring:
   ```typescript
   isRelevant(learning: NetworkLearning, targetAgent: AgentInfo): boolean {
     // Same build = always relevant
     if (learning.buildId === targetAgent.buildId) return true;

     // Check task overlap
     const overlap = this.calculateTaskOverlap(
       learning.content.applicability,
       targetAgent.currentTask
     );

     return overlap > 0.3;
   }
   ```

5. Query protocol for agents asking each other:
   ```typescript
   async queryNetwork(agentId: string, query: NetworkQuery): Promise<NetworkResponse[]> {
     const responses: NetworkResponse[] = [];

     // Ask all agents
     for (const [targetId, info] of this.agents) {
       if (targetId === agentId) continue;

       const response = await this.askAgent(targetId, query);
       if (response) {
         responses.push(response);
       }
     }

     // Aggregate and rank responses
     return this.rankResponses(responses);
   }
   ```

6. Example queries:
   - "Has anyone fixed TypeScript error TS2345?"
   - "Best approach for implementing auth?"
   - "Anyone have pattern for API pagination?"

7. Integration with Feature Agent:
   - Auto-broadcast successful error fixes
   - Auto-broadcast discovered patterns
   - Query network before attempting error fix
   - Receive warnings about pitfalls

OUTPUT: Complete agent network learning system for real-time knowledge sharing.
```

---

### PROMPT 9: Context Priority Learning

```
You are building the Context Priority Learning System for KripTik AI's Component 28 Enhancement.

CONTEXT:
- Context windows have limits (even with 200K tokens)
- Not all context is equally valuable
- Need to learn what context matters most for each task type
- 2026 meta-learning emphasizes learning WHAT to learn

EXISTING FILES TO UNDERSTAND:
1. server/src/services/ai/context-builder.ts - Context construction (if exists)
2. server/src/services/ai/model-router.ts - Model selection
3. server/src/services/learning/pattern-library.ts - Pattern system

CREATE: server/src/services/learning/context-priority.ts

IMPLEMENTATION REQUIREMENTS:

1. ContextPriorityService class:
   - scoreContextRelevance(context, task) - Score context items by relevance
   - optimizeContext(fullContext, maxTokens, task) - Select best context
   - learnFromOutcome(contextUsed, outcome) - Update priorities from results
   - getContextPriorities(taskType) - Get learned priority weights

2. Context item structure:
   ```typescript
   interface ContextItem {
     itemId: string;
     category: ContextCategory;
     content: string;
     tokenCount: number;
     sourceFile?: string;
     recency: Date;
     // Learned attributes
     relevanceScore?: number;
     usageCount?: number;
     successRate?: number;
   }

   type ContextCategory =
     | 'intent_contract'
     | 'current_code'
     | 'error_message'
     | 'past_pattern'
     | 'past_reflexion'
     | 'past_strategy'
     | 'file_structure'
     | 'related_files'
     | 'user_preference'
     | 'verification_result';
   ```

3. Category weight learning:
   ```typescript
   const DEFAULT_WEIGHTS: Record<ContextCategory, number> = {
     intent_contract: 100,      // Always important
     current_code: 90,          // Usually important
     error_message: 85,         // Critical for error tasks
     past_pattern: 70,          // Often helpful
     past_reflexion: 75,        // Helps avoid mistakes
     past_strategy: 60,         // Provides approach
     file_structure: 40,        // Sometimes useful
     related_files: 50,         // Often useful
     user_preference: 65,       // Important for personalization
     verification_result: 80,   // Important for fixes
   };

   // Weights are adjusted based on outcomes
   ```

4. Context optimization algorithm:
   ```typescript
   async optimizeContext(
     fullContext: ContextItem[],
     maxTokens: number,
     task: TaskInfo
   ): Promise<ContextItem[]> {
     // 1. Score all items
     const scored = await Promise.all(
       fullContext.map(async item => ({
         item,
         score: await this.scoreContextRelevance(item, task),
       }))
     );

     // 2. Sort by score
     scored.sort((a, b) => b.score - a.score);

     // 3. Greedily select until token limit
     const selected: ContextItem[] = [];
     let tokenCount = 0;

     for (const { item } of scored) {
       if (tokenCount + item.tokenCount <= maxTokens) {
         selected.push(item);
         tokenCount += item.tokenCount;
       }
     }

     return selected;
   }
   ```

5. Learning from outcomes:
   ```typescript
   async learnFromOutcome(
     contextUsed: ContextItem[],
     outcome: 'success' | 'partial' | 'failure',
     taskType: string
   ): Promise<void> {
     const outcomeScore = outcome === 'success' ? 1 : outcome === 'partial' ? 0.5 : 0;

     for (const item of contextUsed) {
       // Update category weight
       await this.updateCategoryWeight(item.category, taskType, outcomeScore);

       // Update specific item stats
       await this.updateItemStats(item.itemId, outcomeScore);
     }
   }
   ```

6. Task-specific priorities:
   - Different weights for code generation vs error fixing
   - Learn which file types matter for which tasks
   - Learn optimal context order

7. Database storage:
   - Store learned weights per category per task type
   - Track context usage and outcomes
   - Support A/B testing of priority strategies

OUTPUT: Complete context priority learning system for intelligent context selection.
```

---

### PROMPT 10: Enhanced Evolution Flywheel with All Enhancements

```
You are building the Enhanced Evolution Flywheel for KripTik AI's Component 28 Enhancement.

CONTEXT:
- The existing evolution-flywheel.ts runs batch learning cycles
- We've added 8 new learning capabilities in Prompts 1-9
- Need to integrate all new systems into the flywheel
- Add real-time triggers and cross-build orchestration

EXISTING FILE TO ENHANCE:
server/src/services/learning/evolution-flywheel.ts

CHANGES REQUIRED:

1. Add new service integrations:
   ```typescript
   import { getDirectRLAIF } from './direct-rlaif.js';
   import { getMultiJudge } from './multi-judge.js';
   import { getReflexion } from './reflexion.js';
   import { getRealTimeLearning } from './real-time-learning.js';
   import { getCrossBuildTransfer } from './cross-build-transfer.js';
   import { getVisionRLAIF } from './vision-rlaif.js';
   import { getShadowModelDeployer } from './shadow-model-deployer.js';
   import { getAgentNetwork } from './agent-network.js';
   import { getContextPriority } from './context-priority.js';
   ```

2. Enhanced cycle phases:
   ```typescript
   async runEnhancedCycle(userId: string): Promise<EnhancedEvolutionCycle> {
     // Phase 1: Collect traces (existing)
     // Phase 2: Direct-RLAIF scoring
     // Phase 3: Multi-judge consensus
     // Phase 4: Generate preference pairs (existing + vision pairs)
     // Phase 5: Generate reflexion notes
     // Phase 6: Extract patterns (existing)
     // Phase 7: Evolve strategies (existing)
     // Phase 8: Cross-build knowledge transfer
     // Phase 9: Context priority updates
     // Phase 10: Queue shadow model training
     // Phase 11: Auto-deploy trained models
   }
   ```

3. Real-time learning integration:
   ```typescript
   // Subscribe to real-time events
   realTimeLearning.on('quick_learning', (learning) => {
     this.emit('learning_update', learning);
   });

   // Trigger mini-cycles for immediate learning
   async triggerMiniCycle(event: LearningEvent): Promise<void> {
     // Lightweight version of full cycle
     // Just pattern matching and strategy selection
   }
   ```

4. Auto-triggered cycles:
   ```typescript
   // Trigger full cycle when thresholds reached
   const AUTO_TRIGGERS = {
     newTraces: 1000,           // After 1000 new traces
     newReflexions: 50,         // After 50 new reflexion notes
     newVisualPairs: 100,       // After 100 new visual pairs
     timeElapsed: 24 * 60 * 60, // Every 24 hours
   };
   ```

5. Enhanced metrics:
   ```typescript
   interface EnhancedCycleMetrics extends CycleMetrics {
     // New metrics
     directRLAIFScores: number[];
     multiJudgeConsensus: number;
     reflexionCount: number;
     crossBuildTransfers: number;
     visionPairsGenerated: number;
     shadowModelsDeployed: number;
     agentNetworkBroadcasts: number;
     contextPriorityUpdates: number;
   }
   ```

6. System status dashboard data:
   ```typescript
   async getEnhancedSystemStatus(): Promise<EnhancedLearningStatus> {
     return {
       ...await this.getSystemStatus(), // Existing
       // New status
       directRLAIF: await this.directRLAIF.getStats(),
       multiJudge: await this.multiJudge.getStats(),
       reflexion: await this.reflexion.getStats(),
       realTimeLearning: await this.realTimeLearning.getStats(),
       crossBuildTransfer: await this.crossBuildTransfer.getStats(),
       visionRLAIF: await this.visionRLAIF.getStats(),
       deployedModels: await this.shadowDeployer.getStats(),
       agentNetwork: await this.agentNetwork.getStats(),
       contextPriority: await this.contextPriority.getStats(),
     };
   }
   ```

7. Build integration hooks:
   ```typescript
   // Called at build start
   async onBuildStart(buildId: string, userId: string): Promise<void> {
     // Initialize real-time learning
     this.initializeForBuild(userId, buildId, projectId);

     // Apply cross-build knowledge
     await this.crossBuildTransfer.applyTransferredKnowledge(buildId);

     // Register with agent network
     await this.agentNetwork.registerBuild(buildId);
   }

   // Called at build end
   async onBuildEnd(buildId: string, outcome: BuildOutcome): Promise<void> {
     // Finalize experience capture
     await this.finalizeForBuild();

     // Generate reflexions from failures
     if (outcome.errors.length > 0) {
       await this.reflexion.generateFromBuild(buildId, outcome.errors);
     }

     // Update context priorities
     await this.contextPriority.learnFromBuild(buildId, outcome);

     // Check if cycle should be triggered
     await this.checkAutoTriggers();
   }
   ```

OUTPUT: Enhanced evolution flywheel integrating all new learning capabilities.
```

---

## Implementation Order

### Week 1: Foundation
1. **Prompt 4**: Real-Time Learning (enables immediate feedback)
2. **Prompt 3**: Reflexion System (enables learning from failures)

### Week 2: Enhanced RLAIF
3. **Prompt 1**: Direct-RLAIF (more efficient training data)
4. **Prompt 2**: Multi-Judge Consensus (more reliable scoring)

### Week 3: Knowledge Systems
5. **Prompt 5**: Cross-Build Transfer (share learnings)
6. **Prompt 8**: Agent Network (parallel agent learning)

### Week 4: Advanced Learning
7. **Prompt 6**: Vision RLAIF (visual learning loop)
8. **Prompt 9**: Context Priority (intelligent context)

### Week 5: Deployment & Integration
9. **Prompt 7**: Shadow Model Auto-Deployer (use trained models)
10. **Prompt 10**: Enhanced Evolution Flywheel (tie it all together)

---

## Success Metrics

1. **Learning Speed**: Time from experience to applied learning < 1 second (real-time)
2. **Cross-Build Effectiveness**: 20% faster subsequent builds via transferred knowledge
3. **Shadow Model Usage**: 50% of appropriate tasks use deployed shadow models
4. **Reflexion Effectiveness**: 30% reduction in repeated errors
5. **Multi-Judge Agreement**: >80% consensus on quality scores
6. **Vision RLAIF**: 15% improvement in Anti-Slop scores over time
7. **Context Optimization**: 20% better task success with same context window

---

## Sources

- [RLAIF vs. RLHF: Scaling Reinforcement Learning from Human Feedback with AI Feedback](https://arxiv.org/abs/2309.00267)
- [RLAIF: What is Reinforcement Learning From AI Feedback? | DataCamp](https://www.datacamp.com/blog/rlaif-reinforcement-learning-from-ai-feedback)
- [Self-Learning AI Agents | Beam AI](https://beam.ai/agentic-insights/self-learning-ai-agents-transforming-automation-with-continuous-improvement)
- [7 Agentic AI Trends to Watch in 2026 | Machine Learning Mastery](https://machinelearningmastery.com/7-agentic-ai-trends-to-watch-in-2026/)
- [Self-Evolving Agents - A Cookbook for Autonomous Agent Retraining | OpenAI Cookbook](https://cookbook.openai.com/examples/partners/self_evolving_agents/autonomous_agent_retraining)
- [Meta Learning: 7 Techniques & Use Cases in 2026 | AIMultiple](https://research.aimultiple.com/meta-learning/)
- [Meta Learning: How Machines Learn to Learn | DataCamp](https://www.datacamp.com/blog/meta-learning)
