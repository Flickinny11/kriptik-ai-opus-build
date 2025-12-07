# Autonomous Learning Engine - Implementation Plan

## Overview

The Autonomous Learning Engine transforms KripTik AI from a static tool into an **evolving intelligence**. Every build makes it smarter. Every failure teaches it. Every success reinforces what works.

This is **learning as a runtime feature** - the system actively improves while operating.

---

## Architecture Integration with Existing KripTik AI

### Existing Services to Leverage (NO BREAKING CHANGES)

| Service | File | Integration Point |
|---------|------|-------------------|
| InteractionTracker | `learning/interaction-tracker.ts` | Extend for experience capture |
| InfiniteReflectionEngine | `ai/reflection-engine.ts` | Add pattern learning |
| OpenRouterClient | `ai/openrouter-client.ts` | AI judgment calls |
| VerificationSwarm | `verification/swarm.ts` | Quality signals |
| ErrorEscalation | `automation/error-escalation.ts` | Error recovery traces |
| ArtifactManager | `ai/artifacts.ts` | Build state persistence |
| TimeMachine | `checkpoints/time-machine.ts` | State snapshots |
| Turso/Drizzle | `schema.ts` + `db.ts` | Storage layer |

---

## Layer 1: Experience Capture System

### New Database Tables (Additive)

```sql
-- Decision traces from builds
learning_decision_traces
  - id, trace_id, build_id, project_id, user_id
  - phase (intent_lock, build, verification, etc.)
  - decision_type (architecture_choice, component_structure, etc.)
  - context (JSON: intent_snippet, code_state, error, attempts)
  - decision (JSON: chosen, rejected, reasoning, confidence)
  - outcome (JSON: result, scores, fixes, production, satisfaction)
  - created_at

-- Code artifact traces
learning_code_artifacts
  - id, artifact_id, build_id, project_id
  - file_path, versions (JSON array)
  - quality_trajectory (JSON array)
  - patterns_used (JSON array)
  - created_at

-- Design choice traces
learning_design_choices
  - id, choice_id, build_id, project_id
  - app_soul, typography (JSON), color_system (JSON)
  - motion_language (JSON), layout_decisions (JSON)
  - visual_scores (JSON)
  - created_at

-- Error recovery traces
learning_error_recoveries
  - id, error_id, build_id, project_id
  - error (JSON: type, message, stack, location)
  - recovery_journey (JSON array of attempts)
  - successful_fix (JSON or null)
  - created_at
```

### Experience Capture Service

**File:** `server/src/services/learning/experience-capture.ts`

Hooks into existing build flow to capture:
- Decision traces from IntentLockEngine, BuildLoop
- Code artifacts from file operations
- Design choices from AppSoulMapper, AntiSlopDetector
- Error recoveries from ErrorEscalation

---

## Layer 2: AI Judgment Layer (RLAIF)

### New Database Tables

```sql
-- AI judgments on decisions/outputs
learning_judgments
  - id, judgment_id, trace_id (links to decision/code/design)
  - judge_type (code_quality, design_quality, success_predictor, anti_slop)
  - model_used, thinking_trace
  - scores (JSON: overall, categories)
  - issues (JSON array)
  - recommendations (JSON array)
  - created_at

-- Preference pairs for training
learning_preference_pairs
  - id, pair_id, domain (code, design, architecture, error_fix)
  - prompt, chosen, rejected
  - judgment_reasoning, margin
  - used_in_training (boolean)
  - created_at
```

### Judgment Services

**File:** `server/src/services/learning/judges/code-quality-judge.ts`
- Uses Claude Opus 4.5 with HIGH effort
- Evaluates: correctness, style, efficiency, best practices
- Scores 0-100 with detailed breakdown

**File:** `server/src/services/learning/judges/design-quality-judge.ts`
- Uses Claude Opus 4.5 with vision capability
- Evaluates against Anti-Slop Manifesto
- Scores: depth, motion, typography, soul match

**File:** `server/src/services/learning/judges/success-predictor.ts`
- Learns to predict build success from early signals
- Features: intent clarity, plan quality, early errors, trajectories
- Triggers interventions when probability < 60%

**File:** `server/src/services/learning/preference-pair-generator.ts`
- Generates training pairs from judgments
- Tracks successful vs failed attempts
- Creates chosen/rejected pairs with reasoning

---

## Layer 3: Shadow Model Architecture

### Model Registry

**File:** `server/src/services/learning/shadow-models/model-registry.ts`

```typescript
interface ShadowModel {
  name: string;
  baseModel: string;  // Qwen 3 32B, Llama 4 Scout, DeepSeek R1
  adapterName: string;
  trainingFocus: string[];
  currentVersion: string;
  evalScore: number;
}
```

### Training Pipeline Interface

**File:** `server/src/services/learning/shadow-models/training-pipeline.ts`

- Interfaces with Modal Labs / RunPod for GPU compute
- Uses LLaMA-Factory or Unsloth for LoRA training
- DPO (Direct Preference Optimization) from preference pairs
- Anti-forgetting via EWC and experience replay

### Database Tables

```sql
-- Shadow model versions
learning_shadow_models
  - id, model_name, base_model, adapter_name
  - version, eval_score, metrics (JSON)
  - training_data_count, training_date
  - status (training, ready, promoted, deprecated)
  - created_at

-- Training runs
learning_training_runs
  - id, run_id, model_name
  - config (JSON: hyperparams, data config)
  - status (pending, running, completed, failed)
  - metrics (JSON: loss, eval results)
  - started_at, completed_at
```

---

## Layer 4: Meta-Learning Framework

### Strategy Evolution Engine

**File:** `server/src/services/learning/meta/strategy-evolution.ts`

Tracks and evolves build strategies:
- Component-first vs skeleton-first
- Isolate-and-fix vs rewrite-component
- Soul-first design approach

Uses Thompson sampling for exploration/exploitation.

### Pattern Library (Voyager-Inspired)

**File:** `server/src/services/learning/meta/pattern-library.ts`

Accumulates reusable patterns from successful builds:
- Code patterns
- Design patterns
- Architecture patterns
- Error fix patterns

Embedding-based retrieval for similar context.

### Learning-How-To-Learn Engine

**File:** `server/src/services/learning/meta/learning-optimizer.ts`

- Self-reflection on learning progress
- Curriculum learning (progressive difficulty)
- Active learning (identify gaps, synthesize data)

### Database Tables

```sql
-- Evolved strategies
learning_strategies
  - id, strategy_id, domain
  - description, success_rate, confidence
  - contexts_effective (JSON array)
  - derived_from, is_experimental
  - created_at, updated_at

-- Learned patterns
learning_patterns
  - id, pattern_id, category
  - name, problem, solution_template
  - conditions (JSON), anti_conditions (JSON)
  - code_template, embedding (BLOB)
  - usage_count, success_rate
  - created_at, updated_at

-- Learning insights
learning_insights
  - id, insight_id
  - observation, evidence, action, impact
  - implemented (boolean)
  - created_at
```

---

## Layer 5: Evolution Flywheel

**File:** `server/src/services/learning/evolution-orchestrator.ts`

Coordinates the continuous improvement cycle:

```
BUILD → CAPTURE → JUDGE → GENERATE PAIRS → TRAIN → PROMOTE → INJECT PATTERNS → BUILD
```

### Cycle Configuration

```typescript
interface EvolutionConfig {
  // Training triggers
  preferenceThreshold: 500;      // Train when 500 new pairs
  evaluationInterval: 'weekly';  // Evaluate shadow models weekly
  patternUpdateInterval: 'daily';

  // Quality gates
  minJudgmentConfidence: 0.7;
  promotionImprovementThreshold: 0.05;  // 5% improvement
  regressionTolerance: 0.02;            // 2% regression allowed
}
```

---

## Integration Points

### 1. Build Loop Integration

Modify `server/src/services/automation/build-loop.ts`:
- Capture decision traces at each phase
- Record code artifacts on file operations
- Feed verification results to judgment pipeline

### 2. Fix My App Integration

Modify `server/src/services/fix-my-app/enhanced-fix-executor.ts`:
- Capture error recovery traces
- Learn from successful fixes
- Inject learned patterns for similar errors

### 3. Developer Mode Integration

Modify `server/src/services/developer-mode/agent-service.ts`:
- Capture per-agent decision traces
- Learn agent-specific patterns
- Track multi-agent coordination patterns

### 4. Verification Swarm Integration

Modify `server/src/services/verification/swarm.ts`:
- Feed verification results to judges
- Track verification success trajectories
- Learn optimal verification configurations

---

## API Routes

**File:** `server/src/routes/learning.ts`

```typescript
// Experience capture
POST /api/learning/traces/decision - Record decision trace
POST /api/learning/traces/code - Record code artifact
POST /api/learning/traces/design - Record design choice
POST /api/learning/traces/error - Record error recovery

// Judgments
GET /api/learning/judgments/:buildId - Get judgments for build
POST /api/learning/judgments/run - Run judgment pipeline

// Preference pairs
GET /api/learning/preference-pairs - List preference pairs
GET /api/learning/preference-pairs/export - Export for training

// Shadow models
GET /api/learning/models - List shadow models
GET /api/learning/models/:name/status - Get model status
POST /api/learning/models/:name/train - Trigger training
POST /api/learning/models/:name/evaluate - Run evaluation

// Patterns
GET /api/learning/patterns - List patterns
GET /api/learning/patterns/search - Search by context
POST /api/learning/patterns/extract - Extract from trace

// Strategies
GET /api/learning/strategies - List strategies
GET /api/learning/strategies/:domain - Get domain strategies

// Insights
GET /api/learning/insights - Get learning insights
GET /api/learning/insights/recommendations - Get recommendations

// Metrics
GET /api/learning/metrics - Get learning metrics
GET /api/learning/metrics/improvement - Get improvement over time
```

---

## UI Components

### Learning Insights Panel

**File:** `src/components/builder/LearningInsightsPanel.tsx`

Shows:
- Current model performance vs baseline
- Learned patterns relevant to current build
- Success probability prediction
- Recommended strategies

### Learning Dashboard

**File:** `src/pages/LearningDashboard.tsx`

Shows:
- Overall system improvement over time
- Pattern library growth
- Shadow model evolution
- Training pipeline status

---

## Implementation Order

### Phase 1: Database & Types (Week 1)
1. Add schema tables to `schema.ts`
2. Create migration file
3. Define TypeScript interfaces

### Phase 2: Experience Capture (Week 1-2)
1. Implement experience-capture.ts
2. Hook into build-loop.ts
3. Hook into error-escalation.ts
4. Test trace recording

### Phase 3: AI Judgment (Week 2-3)
1. Implement code-quality-judge.ts
2. Implement design-quality-judge.ts
3. Implement success-predictor.ts
4. Implement preference-pair-generator.ts
5. Test judgment pipeline

### Phase 4: Meta-Learning (Week 3-4)
1. Implement strategy-evolution.ts
2. Implement pattern-library.ts
3. Implement learning-optimizer.ts
4. Hook into build flow for pattern injection

### Phase 5: Shadow Models (Week 4-5)
1. Implement model-registry.ts
2. Implement training-pipeline.ts
3. Set up Modal Labs / RunPod integration
4. Create evaluation benchmarks

### Phase 6: Evolution Flywheel (Week 5-6)
1. Implement evolution-orchestrator.ts
2. Connect all layers
3. Set up scheduled jobs
4. Test full cycle

### Phase 7: Integration & UI (Week 6-7)
1. Add API routes
2. Implement UI components
3. End-to-end testing
4. Documentation

---

## Feature List Additions

```json
{
  "autonomous_learning": {
    "features": [
      { "id": "F065", "name": "Experience Capture", "phase": 20 },
      { "id": "F066", "name": "Decision Trace System", "phase": 20 },
      { "id": "F067", "name": "Code Artifact Tracking", "phase": 20 },
      { "id": "F068", "name": "Design Choice Tracking", "phase": 20 },
      { "id": "F069", "name": "Error Recovery Tracking", "phase": 20 },
      { "id": "F070", "name": "Code Quality Judge", "phase": 21 },
      { "id": "F071", "name": "Design Quality Judge", "phase": 21 },
      { "id": "F072", "name": "Success Predictor", "phase": 21 },
      { "id": "F073", "name": "Preference Pair Generator", "phase": 21 },
      { "id": "F074", "name": "Strategy Evolution Engine", "phase": 22 },
      { "id": "F075", "name": "Pattern Library", "phase": 22 },
      { "id": "F076", "name": "Learning Optimizer", "phase": 22 },
      { "id": "F077", "name": "Shadow Model Registry", "phase": 23 },
      { "id": "F078", "name": "Training Pipeline", "phase": 23 },
      { "id": "F079", "name": "Evolution Flywheel", "phase": 24 },
      { "id": "F080", "name": "Learning API Routes", "phase": 25 },
      { "id": "F081", "name": "Learning Insights UI", "phase": 25 }
    ]
  }
}
```

---

## Expected Outcomes

After 6 months of operation:

| Metric | Baseline | 3 Months | 6 Months |
|--------|----------|----------|----------|
| First-attempt success rate | 45% | 62% | 78% |
| Error fix attempts needed | 3.2 avg | 2.1 avg | 1.4 avg |
| Anti-slop design score | 72 avg | 81 avg | 89 avg |
| User satisfaction | 7.2/10 | 8.1/10 | 9.0/10 |
| Build time (standard) | 12 min | 9 min | 7 min |
| Patterns in library | 0 | 847 | 3,200+ |

---

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| Experience storage (Turso) | $20-50 |
| AI Judgment (OpenRouter) | $200-500 |
| Training compute (Modal) | $300-800 |
| Shadow inference (vLLM) | $100-300 |
| **Total** | **$620-1,650/month** |

This investment creates an exponentially improving competitive moat.

