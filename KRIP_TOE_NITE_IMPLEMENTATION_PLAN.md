# Krip-Toe-Nite Implementation Plan

## Executive Summary

**Krip-Toe-Nite** is KripTik AI's proprietary intelligent model orchestration system that appears as a single model selection but internally orchestrates multiple frontier models for maximum speed, quality, and cost efficiency.

### Target Outcomes:
- **Simple tasks**: <500ms perceived latency (TTFT)
- **Complex tasks**: <3s perceived latency
- **Quality**: Matches or exceeds Claude Opus 4.5 on coding tasks
- **Cost**: 50-70% reduction vs. naive single-model approach
- **User perception**: "Faster AND smarter than any single model"

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     KRIPTIK AI - KRIP-TOE-NITE MODEL                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER INTERFACE                                                              │
│  ├─ Builder Mode: Auto-selects Krip-Toe-Nite for maximum speed              │
│  ├─ Agents Mode: Krip-Toe-Nite available in model selector                  │
│  └─ Developer Mode: Full model selector + Krip-Toe-Nite                     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │              KRIP-TOE-NITE ORCHESTRATION ENGINE                      │    │
│  │                                                                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐   │    │
│  │  │   INTENT    │  │ COMPLEXITY  │  │  STRATEGY   │  │   CACHE   │   │    │
│  │  │ CLASSIFIER  │→ │  ANALYZER   │→ │  SELECTOR   │→ │   CHECK   │   │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘   │    │
│  │                                                                      │    │
│  │  EXECUTION STRATEGIES:                                               │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │  SINGLE         SPECULATIVE      PARALLEL        ENSEMBLE    │   │    │
│  │  │  (trivial)      (medium)         (complex)       (expert)    │   │    │
│  │  │    ↓              ↓    ↓           ↓    ↓         ↓  ↓  ↓    │   │    │
│  │  │  Speed          Fast→Validate    Race→Best      Vote/Merge   │   │    │
│  │  │  Model          Models           Models         Models       │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  MODEL POOL (via OpenRouter - ALL models unified):                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  SPEED TIER              INTELLIGENCE TIER       SPECIALIST TIER    │    │
│  │  ├─ DeepSeek V3 (~300ms) ├─ Claude Opus 4.5     ├─ DeepSeek Coder  │    │
│  │  ├─ Haiku 3.5 (~400ms)   ├─ Claude Sonnet 4.5   ├─ Qwen Coder      │    │
│  │  ├─ GPT-4o-mini (~200ms) ├─ GPT-4o              ├─ Codestral       │    │
│  │  └─ Gemini Flash (~150ms)├─ Gemini 2 Pro        └─────────────────  │    │
│  │                          └─────────────────────                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  INTEGRATES WITH EXISTING KRIPTIK AI:                                       │
│  ├─ OpenRouterClient (existing) - All models via unified API                │
│  ├─ Learning Engine - Telemetry feeds improvement                           │
│  ├─ Verification Swarm - Quality checks                                     │
│  ├─ Error Escalation - 4-level fallback                                     │
│  └─ Speed Dial - Mode-specific optimization                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Use OpenRouter for ALL Models
- **No direct API keys** - OpenRouter provides unified access
- Existing `OpenRouterClient` already supports Anthropic SDK
- All models (Claude, GPT, Gemini, DeepSeek, Llama, Qwen) accessible via OpenRouter

### 2. Virtual Model Architecture
- "Krip-Toe-Nite" appears as a single model in UI
- Internally routes to optimal model(s) based on task analysis
- Transparent to users - they just see fast, high-quality results

### 3. Speculative Execution
- For medium complexity: Fast model streams immediately, smart model validates
- User sees response within 300ms, gets quality-checked output
- If smart model finds issues, enhanced response appended

### 4. Integration with Existing Systems
- Learning Engine captures routing decisions for future optimization
- Verification Swarm validates Krip-Toe-Nite outputs
- Error Escalation handles model failures
- Speed Dial modes influence routing aggressiveness

---

## Phase 1: Krip-Toe-Nite Core Engine (Week 1-2)

### Files to Create:

#### 1. `server/src/services/ai/krip-toe-nite/types.ts`
```typescript
// Task types for intelligent routing
export enum TaskType {
  CODE_GENERATION = 'code_generation',
  CODE_FIX = 'code_fix',
  CODE_REFACTOR = 'code_refactor',
  UI_COMPONENT = 'ui_component',
  API_DESIGN = 'api_design',
  DATABASE = 'database',
  EXPLANATION = 'explanation',
  DOCUMENTATION = 'documentation',
  SIMPLE_EDIT = 'simple_edit',
  COMPLEX_REASONING = 'complex_reasoning',
}

// Complexity levels
export enum Complexity {
  TRIVIAL = 1,    // Single line, formatting
  SIMPLE = 2,     // Standard boilerplate
  MEDIUM = 3,     // Feature implementation
  COMPLEX = 4,    // Multi-file, architecture
  EXPERT = 5,     // Novel problems, system design
}

// Execution strategies
export type ExecutionStrategy = 'single' | 'speculative' | 'parallel' | 'ensemble';
```

#### 2. `server/src/services/ai/krip-toe-nite/model-registry.ts`
```typescript
// Model definitions with performance characteristics via OpenRouter
export const KTN_MODELS = {
  // SPEED TIER - Ultra-fast responses
  'deepseek-v3-fast': {
    openRouterId: 'deepseek/deepseek-chat',
    tier: 'speed',
    avgTtftMs: 300,
    avgTpsMs: 6,
    costPer1MInput: 0.14,
    costPer1MOutput: 0.28,
    strengths: ['speed', 'code', 'reasoning'],
  },
  'haiku-fast': {
    openRouterId: 'anthropic/claude-3.5-haiku',
    tier: 'speed',
    avgTtftMs: 400,
    avgTpsMs: 8,
    costPer1MInput: 0.80,
    costPer1MOutput: 4.00,
    strengths: ['speed', 'general', 'code'],
  },
  // ... more models
};
```

#### 3. `server/src/services/ai/krip-toe-nite/classifier.ts`
- Task type classification from prompt
- Complexity estimation
- Uses existing Anti-Slop patterns for design detection

#### 4. `server/src/services/ai/krip-toe-nite/router.ts`
- Routing logic based on task + complexity
- Strategy selection matrix
- Integrates with existing Learning Engine for telemetry

#### 5. `server/src/services/ai/krip-toe-nite/executor.ts`
- Single model execution
- Speculative execution (fast + smart in parallel)
- Streaming response management
- Fallback handling

#### 6. `server/src/services/ai/krip-toe-nite/index.ts`
- Main KripToeNite class
- Public API for generation
- Integration with OpenRouterClient

### Integration Points:
- Add to `server/src/services/ai/index.ts` exports
- Register in existing model router as "krip-toe-nite" model
- Add telemetry hooks to Learning Engine

---

## Phase 2: Developer Mode Backend (Week 3-4)

### New Features:

#### 1. Project Import Service
**File**: `server/src/services/import/project-import.ts`
- ZIP file upload and extraction
- GitHub repository cloning
- External builder import (Lovable, v0, etc.)
- Project analysis and indexing

#### 2. Developer Mode Routes
**File**: `server/src/routes/developer-mode.ts` (extend existing)
- `POST /api/developer-mode/import/zip` - Upload ZIP
- `POST /api/developer-mode/import/github` - Clone from GitHub
- `POST /api/developer-mode/import/external` - Import from external builder
- `GET /api/developer-mode/project/:id/analysis` - Project structure analysis

#### 3. Database Schema Updates
**File**: `server/drizzle/0005_developer_mode_imports.sql`
- `imported_projects` table
- `external_builder_connections` table
- `project_analysis_cache` table

---

## Phase 3: Developer Mode Frontend (Week 5-6)

### UI Components:

#### 1. Update BuilderAgentsToggle
**File**: `src/components/builder/BuilderAgentsToggle.tsx`
- Add third "Developer" option
- Update styling for three-mode toggle
- Animate between modes

#### 2. Developer Mode View
**File**: `src/components/builder/DeveloperModeView.tsx`
- Project import panel (ZIP, GitHub, external)
- Model selector with Krip-Toe-Nite option
- Code editor integration
- Chat interface for NLP-based modifications

#### 3. Model Selector Component
**File**: `src/components/builder/ModelSelector.tsx`
- List all available models
- Krip-Toe-Nite highlighted as recommended
- Shows speed/quality/cost indicators
- Used in both Agents and Developer modes

#### 4. Import Project Modal
**File**: `src/components/builder/ImportProjectModal.tsx`
- ZIP drag-and-drop
- GitHub URL input
- External builder OAuth connections
- Progress tracking

---

## Phase 4: Speculative Execution (Week 7-8)

### Core Implementation:

#### 1. Speculative Executor
**File**: `server/src/services/ai/krip-toe-nite/speculative.ts`
```typescript
export class SpeculativeExecutor {
  async *execute(
    prompt: string,
    context: BuildContext,
    fastModel: ModelConfig,
    smartModel: ModelConfig
  ): AsyncGenerator<ExecutionChunk> {
    // 1. Start BOTH models in parallel
    // 2. Stream fast model immediately
    // 3. Wait for smart model
    // 4. Compare responses
    // 5. Enhance if needed
  }
}
```

#### 2. Response Comparison Logic
- Length difference check
- Code block count comparison
- Error handling presence
- Quality heuristics

#### 3. SSE Streaming Enhancement
- First-token-time tracking
- Strategy indicators in stream
- Enhancement notifications

---

## Phase 5: Caching Layer (Week 9-10)

### Implementation:

#### 1. Semantic Cache
**File**: `server/src/services/ai/krip-toe-nite/cache.ts`
- Uses existing Turso for storage
- Embedding-based similarity search (text-embedding-3-small via OpenRouter)
- Context compatibility checking
- TTL based on complexity

#### 2. Prompt Caching Integration
- Leverage Anthropic's prompt caching via OpenRouter
- System prompt caching for 90% cost reduction
- Cache context patterns

#### 3. Plan Template Cache
- Store successful execution patterns
- Reuse for similar prompts
- Integrates with Learning Engine's Pattern Library

---

## Phase 6: Telemetry & Learning (Week 11-12)

### Integration with Learning Engine:

#### 1. Telemetry Extension
**File**: `server/src/services/learning/experience-capture.ts` (extend)
- Log Krip-Toe-Nite routing decisions
- Track model performance metrics
- Capture user satisfaction signals

#### 2. A/B Testing
- Test different routing thresholds
- Compare strategies per task type
- Fast model comparison experiments

#### 3. Learning Feedback Loop
- Pattern Library learns optimal routes
- Strategy Evolution tracks success rates
- Shadow models trained on Krip-Toe-Nite data

---

## Model Selection UI

### Agents Mode Model Selector
```
┌─────────────────────────────────────────────────────────────┐
│  Select AI Model                                            │
├─────────────────────────────────────────────────────────────┤
│  ⚡ Krip-Toe-Nite (Recommended)                    [FAST]   │
│     Intelligent orchestration - fastest + best quality      │
│     Auto-selects optimal model per task                     │
├─────────────────────────────────────────────────────────────┤
│  🧠 Claude Opus 4.5                               [PREMIUM] │
│     Maximum quality for complex tasks                       │
├─────────────────────────────────────────────────────────────┤
│  💪 Claude Sonnet 4.5                            [BALANCED] │
│     Best balance of speed and quality                       │
├─────────────────────────────────────────────────────────────┤
│  🚀 Claude Haiku 3.5                                [FAST]  │
│     Fastest Anthropic model                                 │
├─────────────────────────────────────────────────────────────┤
│  🔥 DeepSeek V3                                  [ECONOMY]  │
│     Excellent value for code tasks                          │
├─────────────────────────────────────────────────────────────┤
│  🎯 GPT-4o                                       [BALANCED] │
│     OpenAI's flagship model                                 │
└─────────────────────────────────────────────────────────────┘
```

### Developer Mode View
```
┌─────────────────────────────────────────────────────────────┐
│  Import Your Project                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │    📦 ZIP     │  │    🐙 GitHub  │  │   🔗 External │   │
│  │    Upload     │  │    Clone      │  │    Builder    │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                             │
│  Or describe what you want to build:                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Add a user authentication system with OAuth...     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Model: [⚡ Krip-Toe-Nite ▼]                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

### Week 1-2: Foundation
1. Create `server/src/services/ai/krip-toe-nite/` directory structure
2. Implement types, model registry, classifier
3. Basic router with single-model execution
4. Integration with OpenRouterClient

### Week 3-4: Developer Mode Backend
1. Project import service
2. Extended API routes
3. Database schema updates
4. GitHub integration

### Week 5-6: Frontend
1. Three-mode toggle (Builder/Agents/Developer)
2. Developer Mode view
3. Model selector component
4. Import modal

### Week 7-8: Speculative Execution
1. Parallel model execution
2. Response comparison
3. Stream enhancement
4. SSE updates

### Week 9-10: Caching
1. Semantic cache with embeddings
2. Prompt caching integration
3. Plan template cache

### Week 11-12: Telemetry & Polish
1. Learning Engine integration
2. A/B testing framework
3. Dashboard metrics
4. Production hardening

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| TTFT (simple) | <300ms | Time to first token |
| TTFT (complex) | <1s | Time to first token |
| Task completion (simple) | <5s | Total generation time |
| Task completion (complex) | <15s | Total generation time |
| Quality | ≥95% acceptance | User edit rate |
| Cost savings | 50-70% | vs Claude-only baseline |
| Cache hit rate | >20% | Semantic cache hits |

---

## Risk Mitigation

### 1. Model Availability
- All models via OpenRouter (single API)
- Automatic fallback chains
- Circuit breakers per model

### 2. Quality Degradation
- Speculative execution validates fast responses
- Learning Engine tracks quality metrics
- Automatic promotion/demotion based on performance

### 3. Cost Control
- Per-request cost estimation before execution
- User-configurable cost limits
- Detailed usage analytics

---

## Integration with Existing KripTik AI

### Learning Engine (Component 28)
- Decision traces capture routing decisions
- Pattern Library stores successful route patterns
- Strategy Evolution learns optimal strategies

### Verification Swarm
- Validates Krip-Toe-Nite outputs
- Anti-Slop detection for design quality
- Code quality checks

### Error Escalation
- 4-level fallback for Krip-Toe-Nite failures
- Model-specific error recovery
- Graceful degradation

### Speed Dial
- Influences routing aggressiveness
- Lightning mode: Most aggressive speed optimization
- Production mode: Quality over speed

---

## Files to Create/Modify

### New Files:
```
server/src/services/ai/krip-toe-nite/
├── types.ts                    # Type definitions
├── model-registry.ts           # OpenRouter model configs
├── classifier.ts               # Intent + complexity classification
├── router.ts                   # Routing decision logic
├── executor.ts                 # Model execution
├── speculative.ts              # Speculative execution strategy
├── cache.ts                    # Semantic + prompt caching
├── telemetry.ts                # Metrics and logging
└── index.ts                    # Main service + exports

server/src/services/import/
├── project-import.ts           # ZIP/GitHub/external import
├── github-connector.ts         # GitHub API integration
├── external-connectors.ts      # Lovable, v0, etc.
└── index.ts

server/src/routes/
└── developer-import.ts         # Import API routes

server/drizzle/
└── 0005_developer_mode_imports.sql

src/components/builder/
├── BuilderAgentsToggle.tsx     # MODIFY: Add Developer mode
├── DeveloperModeView.tsx       # NEW: Developer mode UI
├── ModelSelector.tsx           # NEW: Model selection dropdown
├── ImportProjectModal.tsx      # NEW: Import modal
└── KripToeNiteIndicator.tsx    # NEW: Show routing status
```

### Modified Files:
```
server/src/services/ai/index.ts          # Add Krip-Toe-Nite exports
server/src/routes/index.ts               # Add import routes
src/pages/Builder.tsx                    # Add Developer mode
server/src/schema.ts                     # Add import tables
```

---

## API Keys Required

Only **OPENROUTER_API_KEY** is required (already configured).

All models accessible via OpenRouter:
- Claude Opus 4.5, Sonnet 4.5, Haiku 3.5
- GPT-4o, GPT-4o-mini
- Gemini 2 Pro, Gemini Flash
- DeepSeek V3, DeepSeek Coder
- Qwen Coder 32B
- Llama 3.3 70B
- Codestral
- Mistral Large

---

## Conclusion

The Krip-Toe-Nite model transforms KripTik AI from a single-model builder into an **intelligent orchestration platform** that:

1. **Appears simple** - Users just see "Krip-Toe-Nite" as a model option
2. **Runs fast** - Sub-second responses for simple tasks via speed tier
3. **Maintains quality** - Speculative execution validates with smart models
4. **Saves cost** - 50-70% reduction through intelligent routing
5. **Learns continuously** - Feeds Learning Engine for constant improvement

This makes KripTik AI **faster and smarter** than any single-model AI builder in the market.

