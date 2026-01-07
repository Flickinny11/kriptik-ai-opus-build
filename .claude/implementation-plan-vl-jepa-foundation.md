# VL-JEPA Foundation Implementation Plan

> **KripTik AI - Semantic Intelligence Layer**
> **Created**: January 7, 2026
> **Status**: Ready for Implementation
> **Estimated Duration**: 2-3 weeks (Phases 2-4 in master plan)

---

## Executive Summary

This document provides the complete implementation plan for the VL-JEPA Foundation - the semantic intelligence layer that powers KripTik AI's understanding of user intent, code patterns, visual designs, and error resolutions. This foundation enables:

1. **Intent Lock Enhancement**: Semantic embedding verification beyond text matching
2. **Visual Understanding**: Screenshot/mockup analysis for design verification
3. **Code Pattern Recognition**: Intelligent code search and similarity detection
4. **Error Resolution Memory**: Learning from past fixes to prevent future issues
5. **Hyper-Thinking Support**: Embedding infrastructure for decomposition and reasoning

---

## Research Summary: Best Models (January 7, 2026)

### Vision/Multimodal Models (for Visual Understanding)

| Model | MMMU Score | Best For | Use Case in KripTik |
|-------|------------|----------|---------------------|
| **GPT-5.2** | 85.4-86.5% | UI comprehension (86.3% ScreenSpot-Pro), chart reasoning | Screenshot analysis, UI verification |
| **Gemini 3 Pro** | 87.6% Video-MMMU | Native multimodal, 1M context | Design mockup analysis, video tutorials |
| **Claude Opus 4.5** | 77.8% | Code screenshots, screen detail inspection | Code review screenshots, diagram analysis |

**KripTik Choice**: **Gemini 3 Pro** for visual understanding tasks due to native multimodal architecture and 1M context window. **GPT-5.2** as fallback for UI-specific tasks.

### Text Embedding Models (for Intent & Semantic Search)

| Model | Dimensions | Context | Strengths |
|-------|------------|---------|-----------|
| **BGE-M3** | 1024 | 8192 tokens | 100+ languages, hybrid dense/sparse, MIT license |
| **NVIDIA NV-Embed-v2** | 4096 | High | Tops MTEB, based on Llama-3.1-8B |
| **Qwen3-Embedding-8B** | Flexible | High | 0.6B-8B sizes, 100+ languages including code |

**KripTik Choice**: **BGE-M3** as primary (MIT license, production-proven, hybrid retrieval). **Qwen3-Embedding** for multilingual/code-aware contexts.

### Code Embedding Models (for Code Search & Similarity)

| Model | MRR Improvement | Context | Quantization |
|-------|-----------------|---------|--------------|
| **Voyage-code-3** | +16.81% vs CodeSage | 32K tokens | int8, binary, 256-2048 dims |
| **Nomic Embed Code** | Competitive | Standard | Apache-2.0, 768 dims |
| **CodeSage Large V2** | Baseline | 1K tokens | 1.3B params |

**KripTik Choice**: **Voyage-code-3** (via API) for superior retrieval and 32K context. **Nomic Embed Code** as open-source fallback.

### Visual Embedding Models (for Design/Screenshot Similarity)

| Model | Architecture | Strengths |
|-------|--------------|-----------|
| **SigLIP 2** | Google DeepMind | Best efficient training, multilingual, outperforms SigLIP |
| **EVA-CLIP / EVA-02** | ViT-based | High-resolution, fine-grained details |
| **OpenCLIP BigG/14** | Open source | Good for image generation workflows |

**KripTik Choice**: **SigLIP 2** as primary for efficiency and quality. **EVA-CLIP** for high-resolution detail analysis.

### VL-JEPA Architecture (for Concept Prediction)

| Component | Model | Purpose |
|-----------|-------|---------|
| **X-Encoder** | V-JEPA 2 (1.2B) | Visual input compression to embeddings |
| **Y-Encoder** | EmbeddingGemma | Text target embedding |
| **Predictor** | Llama 3 Transformer | Concept prediction from visual embeddings |

**Key Benefits**:
- 50% fewer trainable parameters than standard VLMs
- 2.85x faster via selective decoding
- Predicts continuous embeddings (not tokens) - more robust to variations

### Vector Database

| Feature | Qdrant 1.16 |
|---------|-------------|
| **Tiered Multitenancy** | Isolate heavy tenants, scale per-user |
| **ACORN Algorithm** | Improved filtered vector search |
| **Tenant Promotion** | Move tenants to dedicated shards without downtime |
| **HNSW Disk Mode** | Efficient disk-based vector search |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KripTik AI Semantic Layer                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │  Intent Lock    │     │  Build Loop     │     │  Verification   │       │
│  │  Service        │────▶│  Orchestrator   │────▶│  Swarm          │       │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘       │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    Embedding Service (Central)                    │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │       │
│  │  │ Intent      │  │ Code        │  │ Visual      │              │       │
│  │  │ Embedder    │  │ Embedder    │  │ Embedder    │              │       │
│  │  │ (BGE-M3)    │  │ (Voyage-3)  │  │ (SigLIP 2)  │              │       │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │       │
│  └─────────┼────────────────┼────────────────┼──────────────────────┘       │
│            │                │                │                              │
│            ▼                ▼                ▼                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                      Qdrant Vector Database                      │       │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │       │
│  │  │ intent_  │ │ visual_  │ │ code_    │ │ error_   │           │       │
│  │  │ embeddings│ │ embeddings│ │ patterns │ │ fixes    │           │       │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │       │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │       │
│  │  │ hyper_   │ │ decomp_  │ │ reasoning│                        │       │
│  │  │ thinking │ │ osition  │ │ skeletons│                        │       │
│  │  └──────────┘ └──────────┘ └──────────┘                        │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                   Visual Understanding Service                    │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │       │
│  │  │ Screenshot  │  │ Design      │  │ VL-JEPA     │              │       │
│  │  │ Analyzer    │  │ Comparator  │  │ Predictor   │              │       │
│  │  │ (Gemini 3)  │  │ (GPT-5.2)   │  │ (V-JEPA 2)  │              │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7 Qdrant Collections Schema

### Collection 1: `intent_embeddings`
```typescript
{
  name: "intent_embeddings",
  vectors: {
    size: 1024,           // BGE-M3 dimension
    distance: "Cosine"
  },
  payload_schema: {
    project_id: "keyword",
    build_intent_id: "keyword",
    intent_type: "keyword",      // "full_intent" | "component" | "workflow"
    semantic_component: "keyword", // "action" | "target" | "constraint"
    original_text: "text",
    created_at: "datetime",
    confidence: "float"
  }
}
```

### Collection 2: `visual_embeddings`
```typescript
{
  name: "visual_embeddings",
  vectors: {
    size: 768,            // SigLIP 2 dimension
    distance: "Cosine"
  },
  payload_schema: {
    project_id: "keyword",
    build_id: "keyword",
    image_type: "keyword",       // "screenshot" | "mockup" | "design_system" | "component"
    app_soul: "keyword",         // Matches Intent Lock soul
    phase: "keyword",            // Which build phase
    verification_score: "float",
    created_at: "datetime"
  }
}
```

### Collection 3: `code_patterns`
```typescript
{
  name: "code_patterns",
  vectors: {
    size: 1024,           // Voyage-code-3 dimension (configurable)
    distance: "Cosine"
  },
  payload_schema: {
    project_id: "keyword",
    file_path: "keyword",
    pattern_type: "keyword",     // "function" | "component" | "hook" | "api_route" | "schema"
    language: "keyword",
    framework: "keyword",        // "react" | "express" | "drizzle" | etc.
    complexity_score: "float",
    loc: "integer",
    created_at: "datetime"
  }
}
```

### Collection 4: `error_fixes`
```typescript
{
  name: "error_fixes",
  vectors: {
    size: 1024,           // Combined BGE-M3 + code context
    distance: "Cosine"
  },
  payload_schema: {
    error_type: "keyword",       // "typescript" | "eslint" | "runtime" | "build"
    error_code: "keyword",       // e.g., "TS2345", "ESLint/no-unused-vars"
    severity: "keyword",         // "error" | "warning" | "info"
    resolution_type: "keyword",  // "import_fix" | "type_fix" | "logic_fix" | "config_fix"
    success_rate: "float",       // How often this fix worked
    times_used: "integer",
    created_at: "datetime"
  }
}
```

### Collection 5: `hyper_thinking`
```typescript
{
  name: "hyper_thinking",
  vectors: {
    size: 1024,           // BGE-M3 for reasoning text
    distance: "Cosine"
  },
  payload_schema: {
    thinking_type: "keyword",    // "analysis" | "synthesis" | "evaluation" | "creation"
    problem_domain: "keyword",   // "architecture" | "ui" | "api" | "database" | "integration"
    complexity_level: "integer", // 1-10
    success_score: "float",      // How well this thinking pattern led to success
    parent_id: "keyword",        // For hierarchical thinking chains
    created_at: "datetime"
  }
}
```

### Collection 6: `decomposition`
```typescript
{
  name: "decomposition",
  vectors: {
    size: 1024,           // BGE-M3 for task decomposition
    distance: "Cosine"
  },
  payload_schema: {
    task_type: "keyword",        // "feature" | "bugfix" | "refactor" | "optimization"
    original_complexity: "integer",
    subtask_count: "integer",
    decomposition_strategy: "keyword", // "functional" | "architectural" | "data_flow"
    success_rate: "float",
    created_at: "datetime"
  }
}
```

### Collection 7: `reasoning_skeletons`
```typescript
{
  name: "reasoning_skeletons",
  vectors: {
    size: 1024,           // BGE-M3 for reasoning patterns
    distance: "Cosine"
  },
  payload_schema: {
    skeleton_type: "keyword",    // "chain_of_thought" | "tree_of_thought" | "graph_reasoning"
    problem_pattern: "keyword",  // "optimization" | "debugging" | "design" | "integration"
    reasoning_steps: "integer",
    validated: "bool",
    reuse_count: "integer",
    created_at: "datetime"
  }
}
```

---

## Integration Points

### 1. Intent Lock Integration
```
Intent Lock Creation → Generate BGE-M3 embedding → Store in Qdrant intent_embeddings
                    → Extract semantic components → Store individual embeddings
                    → Generate visual concept embedding → Store in visual_embeddings
```

### 2. Intent Satisfaction Integration
```
Build Output → Generate embeddings for each artifact
            → Compare to original intent embedding (cosine similarity)
            → If similarity < 0.85 → Mark as NEEDS_WORK
            → If similarity >= 0.85 → Pass Intent Satisfaction gate
```

### 3. Visual Verification Integration
```
Screenshot Capture → Generate SigLIP 2 embedding
                  → Compare to design system embeddings
                  → Compare to Intent visual concept
                  → Anti-slop visual pattern matching
                  → Return verification score
```

### 4. Error Escalation Integration
```
Error Occurs → Generate error embedding (BGE-M3 + code context)
            → Search error_fixes collection for similar errors
            → If match found (similarity > 0.9) → Apply known fix
            → If no match → Escalate through 4-level system
            → Store successful fix → Update error_fixes collection
```

### 5. Code Pattern Integration
```
Code Generation → Generate Voyage-code-3 embedding
               → Search code_patterns for similar implementations
               → Use similar patterns as context for generation
               → Store new successful patterns
```

---

## Implementation Phases

### Phase 1: Infrastructure Setup (PROMPT 1)
- Docker Compose for Qdrant
- Environment configuration
- Basic connectivity verification

### Phase 2: Embedding Service Core (PROMPT 2)
- Embedding service infrastructure
- BGE-M3, Voyage-code-3, SigLIP 2 integrations
- Redis caching layer
- Rate limiting and error handling

### Phase 3: Qdrant Collections Setup (PROMPT 3)
- Create all 7 collections
- Configure indexes and optimization
- Set up tiered multitenancy

### Phase 4: Intent Lock Integration (PROMPT 4)
- Modify Intent Lock to generate embeddings
- Store embeddings on contract creation
- Semantic component extraction and embedding

### Phase 5: Intent Satisfaction Integration (PROMPT 5)
- Embedding comparison in satisfaction checks
- Semantic distance verification
- Threshold configuration

### Phase 6: Visual Understanding Integration (PROMPT 6)
- Screenshot analyzer with Gemini 3 Pro
- Visual embedding comparison
- Anti-slop pattern detection via embeddings

---

## NLP PROMPTS FOR CURSOR 2.2 WITH OPUS 4.5

Below are 6 production-ready NLP prompts. Each prompt is designed to be copy/pasted into Cursor 2.2 with Opus 4.5 selected, using ultrathinking mode.

---

### PROMPT 1: Qdrant Infrastructure Setup

```
You are implementing the Qdrant vector database infrastructure for KripTik AI. This is the foundation for the VL-JEPA semantic intelligence layer.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode - think deeply before implementing
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code only
- All code must integrate with existing KripTik architecture
- Read existing files before modifying them
- Run npm run build after changes to verify no errors

## CONTEXT
KripTik AI uses:
- Backend: Express 5.1.0 + TypeScript 5.9.3 in server/src/
- Database: Turso SQLite via Drizzle ORM
- Existing schema in server/src/schema.ts already has:
  - intentEmbeddingId: text('intent_embedding_id')
  - visualEmbeddingId: text('visual_embedding_id')
  - semanticComponents: text('semantic_components', { mode: 'json' })

## TASK: Create Qdrant Infrastructure

### Step 1: Create Docker Compose for Qdrant
Create file: docker/docker-compose.qdrant.yml

Requirements:
- Qdrant version 1.16 (latest with tiered multitenancy)
- Persistent volume for data storage
- Health check configuration
- Environment variables for API key (optional for dev)
- Port 6333 for HTTP API, 6334 for gRPC
- Memory limits appropriate for development (2GB) and production (8GB)
- Include both development and production profiles

### Step 2: Create Qdrant Client Configuration
Create file: server/src/services/embeddings/qdrant-client.ts

Requirements:
- Use @qdrant/js-client-rest package
- Environment-based configuration (QDRANT_URL, QDRANT_API_KEY)
- Connection pooling for production
- Retry logic with exponential backoff
- Health check method
- Type-safe collection operations
- Support for tiered multitenancy (tenant promotion)

### Step 3: Create Environment Configuration
Update: server/.env.example and document in server/src/config/index.ts

Required variables:
- QDRANT_URL (default: http://localhost:6333)
- QDRANT_API_KEY (optional for local dev)
- QDRANT_COLLECTION_PREFIX (for environment isolation)

### Step 4: Create Collection Definitions
Create file: server/src/services/embeddings/collections.ts

Define TypeScript interfaces and schemas for all 7 collections:
1. intent_embeddings (1024 dims, BGE-M3)
2. visual_embeddings (768 dims, SigLIP 2)
3. code_patterns (1024 dims, Voyage-code-3)
4. error_fixes (1024 dims, combined)
5. hyper_thinking (1024 dims, BGE-M3)
6. decomposition (1024 dims, BGE-M3)
7. reasoning_skeletons (1024 dims, BGE-M3)

Include:
- Vector configuration per collection
- Payload field schemas with proper types
- Index configurations for filtered search
- Multitenancy configuration (tenant field)

### Step 5: Create Collection Migration Script
Create file: server/src/scripts/setup-qdrant-collections.ts

Requirements:
- Idempotent (can run multiple times safely)
- Creates collections if they don't exist
- Updates index configurations if needed
- Logs progress
- Can be run via npm script: npm run setup:qdrant

### Step 6: Add npm Scripts
Update package.json with:
- "qdrant:start": Start Qdrant via Docker Compose
- "qdrant:stop": Stop Qdrant
- "setup:qdrant": Run collection setup script

### Step 7: Create Health Check Endpoint
Add to existing server routes: GET /api/health/qdrant

Returns:
- Connection status
- Collection counts
- Memory usage
- Version info

## VERIFICATION
After implementation:
1. Run npm run build - must pass
2. Run npm run qdrant:start - verify Qdrant starts
3. Run npm run setup:qdrant - verify collections created
4. Test health endpoint - verify connectivity

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 2: Embedding Service Core Implementation

```
You are implementing the core Embedding Service for KripTik AI's VL-JEPA semantic layer. This service provides unified access to multiple embedding models.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode - think through architecture carefully
- NO placeholders, NO mock data, NO TODO comments
- Production-ready, error-resilient code
- Integrate with existing KripTik patterns (see model-router.ts for AI service patterns)
- Read existing files before modifying
- Run npm run build after changes

## CONTEXT
KripTik AI uses:
- OpenRouter as AI gateway (see server/src/services/ai/openrouter-client.ts)
- Model router for intelligent model selection (see server/src/services/ai/model-router.ts)
- Redis for caching (configure in server/src/config/redis.ts)
- Credit system for cost tracking (see server/src/services/billing/credits.ts)

## BEST MODELS (January 2026)
- Text/Intent: BGE-M3 (1024 dims, 8192 tokens, MIT license) - via HuggingFace Inference API
- Code: Voyage-code-3 (1024 dims configurable, 32K tokens) - via Voyage AI API
- Visual: SigLIP 2 (768 dims) - via HuggingFace or local inference
- Fallback: Qwen3-Embedding for multilingual

## TASK: Create Embedding Service

### Step 1: Create Embedding Service Interface
Create file: server/src/services/embeddings/embedding-service.ts

```typescript
export interface EmbeddingRequest {
  content: string | string[];      // Text or array of texts
  type: 'intent' | 'code' | 'visual' | 'error' | 'reasoning';
  projectId?: string;              // For cost attribution
  userId?: string;                 // For rate limiting
  options?: {
    dimensions?: number;           // For models that support variable dims
    quantization?: 'float32' | 'int8' | 'binary';
    cacheKey?: string;             // Custom cache key
    skipCache?: boolean;
  };
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
  tokensUsed: number;
  cached: boolean;
  latencyMs: number;
}

export interface EmbeddingService {
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
  embedBatch(requests: EmbeddingRequest[]): Promise<EmbeddingResult[]>;
  similarity(embedding1: number[], embedding2: number[]): number;
  healthCheck(): Promise<{ healthy: boolean; providers: Record<string, boolean> }>;
}
```

### Step 2: Create BGE-M3 Provider
Create file: server/src/services/embeddings/providers/bge-m3-provider.ts

Requirements:
- Use HuggingFace Inference API (BAAI/bge-m3 model)
- Handle batching (max 32 texts per request)
- Implement retry with exponential backoff
- Cache embeddings in Redis (24-hour TTL)
- Track token usage for billing
- Support hybrid retrieval (dense + sparse vectors)
- Environment: HUGGINGFACE_API_KEY

### Step 3: Create Voyage-code-3 Provider
Create file: server/src/services/embeddings/providers/voyage-code-provider.ts

Requirements:
- Use Voyage AI API (voyage-code-3 model)
- Support 256, 512, 1024, 2048 dimensions via input_type parameter
- Support quantization options (float, int8, binary)
- Handle 32K context intelligently (truncate with overlap for long files)
- Cache embeddings in Redis (24-hour TTL)
- Track token usage for billing
- Environment: VOYAGE_API_KEY

### Step 4: Create SigLIP 2 Provider
Create file: server/src/services/embeddings/providers/siglip-provider.ts

Requirements:
- Use HuggingFace Inference API (google/siglip-base-patch16-224)
- Handle image input (base64 or URL)
- Handle text input for text-image similarity
- Cache visual embeddings in Redis (1-hour TTL for screenshots)
- Track usage for billing
- Environment: HUGGINGFACE_API_KEY

### Step 5: Create Embedding Service Implementation
Create file: server/src/services/embeddings/embedding-service-impl.ts

Requirements:
- Route requests to appropriate provider based on type
- Implement caching layer with Redis
- Implement rate limiting per user/project
- Track costs and update credit system
- Provide similarity calculation utilities
- Handle provider fallbacks (e.g., if Voyage fails, use BGE-M3 for code)
- Log all embedding operations for debugging

### Step 6: Create Redis Cache Layer
Create file: server/src/services/embeddings/embedding-cache.ts

Requirements:
- Cache key generation based on content hash + model + options
- TTL configuration per embedding type
- Cache invalidation methods
- Cache statistics tracking
- Memory-efficient storage (compress large embeddings)

### Step 7: Create Cost Tracking Integration
Update: server/src/services/billing/credits.ts

Add embedding costs:
- BGE-M3: $0.00001 per 1K tokens
- Voyage-code-3: $0.00012 per 1K tokens
- SigLIP 2: $0.00005 per image

Track in existing credit system.

### Step 8: Create Embedding API Routes
Create file: server/src/routes/embeddings.ts

Endpoints:
- POST /api/embeddings/generate - Generate embeddings
- POST /api/embeddings/similarity - Compare two embeddings
- GET /api/embeddings/stats - Get usage statistics
- POST /api/embeddings/batch - Batch embedding generation

Add to server/src/index.ts router.

### Step 9: Environment Configuration
Update server/.env.example:
- HUGGINGFACE_API_KEY
- VOYAGE_API_KEY
- EMBEDDING_CACHE_TTL_HOURS=24
- EMBEDDING_RATE_LIMIT_PER_MINUTE=100

## VERIFICATION
After implementation:
1. Run npm run build - must pass
2. Test BGE-M3 embedding generation
3. Test Voyage-code-3 for code
4. Test SigLIP 2 for images
5. Verify caching works
6. Verify cost tracking

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 3: Qdrant Collections Full Setup with Tiered Multitenancy

```
You are implementing the complete Qdrant collection setup for KripTik AI with tiered multitenancy support for production scalability.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode
- NO placeholders, NO mock data, NO TODO comments
- Production-ready configuration
- Read existing files (server/src/services/embeddings/qdrant-client.ts, collections.ts) before modifying
- Run npm run build after changes

## CONTEXT
- Qdrant client already created in server/src/services/embeddings/qdrant-client.ts
- Collection definitions in server/src/services/embeddings/collections.ts
- Qdrant 1.16 supports tiered multitenancy with tenant promotion

## TASK: Implement Full Collection Setup

### Step 1: Create Collection Manager
Create file: server/src/services/embeddings/collection-manager.ts

Requirements:
- Methods for all CRUD operations on collections
- Automatic tenant field for multitenancy
- Shard configuration for production
- Index optimization per collection type
- Collection statistics tracking

```typescript
export interface CollectionManager {
  createCollection(name: string, config: CollectionConfig): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  upsertPoints(collection: string, points: Point[]): Promise<void>;
  search(collection: string, query: SearchQuery): Promise<SearchResult[]>;
  getCollectionInfo(name: string): Promise<CollectionInfo>;
  promoteTenant(collection: string, tenantId: string): Promise<void>;
  demoteTenant(collection: string, tenantId: string): Promise<void>;
}
```

### Step 2: Implement Intent Embeddings Collection
Update: server/src/services/embeddings/collections/intent-embeddings.ts

Full implementation:
- HNSW index configuration (m=16, ef_construct=128)
- Payload indexes on: project_id, build_intent_id, intent_type, semantic_component
- Full-text index on original_text
- Quantization configuration for production (scalar, int8)
- Write concern: majority for consistency

### Step 3: Implement Visual Embeddings Collection
Create file: server/src/services/embeddings/collections/visual-embeddings.ts

Full implementation:
- HNSW index for image similarity (m=32 for better recall)
- Payload indexes on: project_id, image_type, app_soul, phase
- On-disk storage for large embedding sets
- Binary quantization for efficient similarity search

### Step 4: Implement Code Patterns Collection
Create file: server/src/services/embeddings/collections/code-patterns.ts

Full implementation:
- HNSW with high precision settings (ef=200)
- Payload indexes on: project_id, file_path, pattern_type, language, framework
- Keyword index on file_path for exact matching
- Deduplication logic for similar patterns

### Step 5: Implement Error Fixes Collection
Create file: server/src/services/embeddings/collections/error-fixes.ts

Full implementation:
- HNSW index optimized for high recall
- Payload indexes on: error_type, error_code, severity, resolution_type
- Scoring integration (success_rate, times_used)
- Global collection (not per-project) for shared learning

### Step 6: Implement Hyper Thinking Collection
Create file: server/src/services/embeddings/collections/hyper-thinking.ts

Full implementation:
- HNSW index for reasoning similarity
- Payload indexes on: thinking_type, problem_domain, complexity_level
- Hierarchical support via parent_id index
- Success score weighting for search ranking

### Step 7: Implement Decomposition Collection
Create file: server/src/services/embeddings/collections/decomposition.ts

Full implementation:
- HNSW index
- Payload indexes on: task_type, decomposition_strategy
- Success rate tracking for strategy optimization

### Step 8: Implement Reasoning Skeletons Collection
Create file: server/src/services/embeddings/collections/reasoning-skeletons.ts

Full implementation:
- HNSW index
- Payload indexes on: skeleton_type, problem_pattern
- Validation tracking
- Reuse count for popularity ranking

### Step 9: Create Multitenancy Manager
Create file: server/src/services/embeddings/multitenancy-manager.ts

Requirements:
- Track tenant sizes (vector count per tenant)
- Automatic promotion threshold (e.g., >10K vectors)
- Promotion scheduling (off-peak hours)
- Fallback shard configuration
- Monitoring and alerting integration

### Step 10: Create Collection Setup Script (Enhanced)
Update: server/src/scripts/setup-qdrant-collections.ts

Full implementation:
- Create all 7 collections with full configuration
- Set up tiered multitenancy
- Create default fallback shards
- Verify indexes
- Run optimization
- Log completion stats

## PRODUCTION CONSIDERATIONS
- Replication factor: 2 for high availability
- Write consistency: majority
- Read consistency: local for speed, all for critical
- Shard number: start with 2, scale as needed
- Snapshot schedule: daily

## VERIFICATION
After implementation:
1. Run npm run build - must pass
2. Run npm run setup:qdrant - verify all collections created
3. Verify indexes via Qdrant dashboard (localhost:6333/dashboard)
4. Test multitenancy with sample data
5. Test search performance

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 4: Intent Lock VL-JEPA Integration

```
You are integrating the VL-JEPA semantic layer with KripTik AI's Intent Lock system. This is critical for semantic verification of builds against user intent.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode - this is a core system integration
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code that handles all edge cases
- Read existing Intent Lock implementation thoroughly before modifying:
  - server/src/services/ai/intent-lock.ts
  - server/src/schema.ts (buildIntents table)
- Run npm run build after changes

## CONTEXT
KripTik Intent Lock:
- Creates immutable "Sacred Contracts" before building
- Uses Claude Opus 4.5 with 64K extended thinking
- Stores in buildIntents table with columns:
  - intentEmbeddingId: text (Qdrant point ID)
  - visualEmbeddingId: text (Qdrant point ID)
  - semanticComponents: json

Intent Contract Structure:
```typescript
interface IntentContract {
  appSoul: AppSoulType;
  coreValueProp: string;
  successCriteria: SuccessCriteria;
  userWorkflows: UserWorkflow[];
  visualIdentity: VisualIdentity;
  antiPatterns: string[];
  locked: boolean;
}

interface SemanticComponents {
  action: string;      // What to DO (verb)
  target: string;      // What to BUILD (noun)
  constraints: string[]; // HOW to do it
  inferredRequirements: string[]; // What user didn't say but needs
}
```

## TASK: Integrate VL-JEPA with Intent Lock

### Step 1: Create Intent Embedding Generator
Create file: server/src/services/embeddings/intent-embedding-generator.ts

Requirements:
- Extract semantic components from Intent Contract
- Generate BGE-M3 embedding for:
  - Full intent text (coreValueProp + successCriteria)
  - Action component
  - Target component
  - Each constraint
  - Each inferred requirement
- Combine into hierarchical embedding structure
- Store all embeddings in Qdrant intent_embeddings collection
- Return primary embedding ID for database storage

```typescript
export interface IntentEmbeddingResult {
  primaryEmbeddingId: string;     // Main intent embedding
  componentEmbeddingIds: {
    action: string;
    target: string;
    constraints: string[];
    inferredRequirements: string[];
  };
  semanticFingerprint: string;    // Hash for quick comparison
}

export async function generateIntentEmbeddings(
  intentContract: IntentContract,
  projectId: string,
  buildIntentId: string
): Promise<IntentEmbeddingResult>;
```

### Step 2: Create Visual Concept Embedding Generator
Create file: server/src/services/embeddings/visual-embedding-generator.ts

Requirements:
- Generate text-based visual concept embedding from:
  - visualIdentity.soul
  - visualIdentity.emotion
  - visualIdentity.depth
  - visualIdentity.motion
  - appSoul type
- Use SigLIP 2 text encoder for visual concept embedding
- Store in Qdrant visual_embeddings collection
- Return embedding ID for database storage

```typescript
export interface VisualConceptEmbeddingResult {
  visualEmbeddingId: string;
  conceptDescription: string;     // Generated description
  appSoulVector: number[];        // Soul-specific embedding
}

export async function generateVisualConceptEmbedding(
  intentContract: IntentContract,
  projectId: string,
  buildIntentId: string
): Promise<VisualConceptEmbeddingResult>;
```

### Step 3: Update Intent Lock Service
Modify: server/src/services/ai/intent-lock.ts

Add after contract creation (in createIntentContract function):
1. Generate intent embeddings
2. Generate visual concept embeddings
3. Store embedding IDs in database
4. Add embedding generation timing to metrics

```typescript
// Add to existing createIntentContract function
const intentEmbeddings = await generateIntentEmbeddings(
  contract,
  projectId,
  buildIntentId
);

const visualEmbeddings = await generateVisualConceptEmbedding(
  contract,
  projectId,
  buildIntentId
);

// Update database record with embedding IDs
await db.update(buildIntents)
  .set({
    intentEmbeddingId: intentEmbeddings.primaryEmbeddingId,
    visualEmbeddingId: visualEmbeddings.visualEmbeddingId,
    semanticComponents: intentEmbeddings.componentEmbeddingIds
  })
  .where(eq(buildIntents.id, buildIntentId));
```

### Step 4: Create Semantic Component Extractor
Create file: server/src/services/embeddings/semantic-extractor.ts

Requirements:
- Use Claude Opus 4.5 to extract semantic components from user prompt
- Structure: action, target, constraints, inferredRequirements
- Cache extraction results
- Handle ambiguous prompts with confidence scoring

```typescript
export interface SemanticExtractionResult {
  action: {
    verb: string;
    confidence: number;
    alternatives: string[];
  };
  target: {
    noun: string;
    confidence: number;
    category: 'app' | 'feature' | 'component' | 'integration' | 'fix';
  };
  constraints: Array<{
    text: string;
    type: 'technical' | 'design' | 'performance' | 'security';
    priority: 'must' | 'should' | 'nice-to-have';
  }>;
  inferredRequirements: Array<{
    text: string;
    confidence: number;
    rationale: string;
  }>;
}

export async function extractSemanticComponents(
  userPrompt: string,
  projectContext?: ProjectContext
): Promise<SemanticExtractionResult>;
```

### Step 5: Create Intent Similarity Calculator
Create file: server/src/services/embeddings/intent-similarity.ts

Requirements:
- Compare new content against intent embeddings
- Support multiple comparison modes:
  - Full intent similarity
  - Component-level similarity (action, target, constraints)
  - Weighted combined score
- Return detailed similarity breakdown

```typescript
export interface IntentSimilarityResult {
  overallSimilarity: number;      // 0-1
  componentSimilarities: {
    action: number;
    target: number;
    constraints: number[];
    inferredRequirements: number[];
  };
  alignmentStatus: 'aligned' | 'partial' | 'misaligned';
  misalignmentDetails?: string[];
}

export async function calculateIntentSimilarity(
  buildIntentId: string,
  contentToVerify: string,
  verificationContext?: VerificationContext
): Promise<IntentSimilarityResult>;
```

### Step 6: Create Intent Embedding Search
Create file: server/src/services/embeddings/intent-search.ts

Requirements:
- Find similar intents across projects (for learning)
- Find similar semantic components
- Support filtered search by app_soul, intent_type
- Return ranked results with similarity scores

```typescript
export async function findSimilarIntents(
  query: string | number[],
  options: {
    limit?: number;
    minSimilarity?: number;
    appSoulFilter?: AppSoulType;
    excludeProjectId?: string;
  }
): Promise<SimilarIntent[]>;
```

### Step 7: Update Schema Types
Update: server/src/services/ai/intent-lock.ts (types section)

Ensure IntentEmbedding and SemanticComponents interfaces match implementation.

### Step 8: Create Integration Tests
Create file: server/src/services/embeddings/__tests__/intent-integration.test.ts

Test cases:
1. Create intent contract with embeddings
2. Retrieve and verify embeddings exist in Qdrant
3. Calculate similarity with matching content
4. Calculate similarity with mismatched content
5. Search for similar intents
6. Component-level similarity breakdown

## VERIFICATION
After implementation:
1. Run npm run build - must pass
2. Create test intent contract
3. Verify embeddings stored in Qdrant
4. Test similarity calculations
5. Test search functionality

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 5: Intent Satisfaction VL-JEPA Integration

```
You are integrating VL-JEPA semantic verification into KripTik AI's Intent Satisfaction gate (Phase 5 of the 6-Phase Build Loop). This ensures builds truly satisfy user intent through embedding comparison.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode - this is the critical quality gate
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code
- Read existing files before modifying:
  - server/src/services/automation/build-loop.ts (Phase 5 implementation)
  - server/src/services/verification/swarm.ts (verification agents)
  - server/src/services/embeddings/intent-similarity.ts (from PROMPT 4)
- Run npm run build after changes

## CONTEXT
KripTik Build Loop Phase 5 - Intent Satisfaction:
- CRITICAL GATE - prevents premature victory declaration
- Currently uses text-based verification
- Must pass ALL success criteria before completion
- If fails, loops back to Phase 2 (Parallel Build)

Current verification checks:
- Success criteria checklist
- Feature completion verification
- Anti-slop detection
- Error-free build

NEW: Semantic verification via embeddings adds:
- Intent-content similarity scoring
- Visual concept alignment
- Code pattern verification
- Confidence-based thresholds

## TASK: Integrate VL-JEPA with Intent Satisfaction

### Step 1: Create Semantic Verification Service
Create file: server/src/services/verification/semantic-verifier.ts

Requirements:
- Comprehensive semantic verification of build output
- Multiple verification dimensions:
  1. Intent alignment (text similarity)
  2. Visual concept alignment (design matches intent)
  3. Code pattern quality (follows best practices)
  4. Feature completeness (all requirements met)
- Weighted scoring system
- Detailed feedback for failures

```typescript
export interface SemanticVerificationConfig {
  intentSimilarityThreshold: number;      // Default: 0.85
  visualAlignmentThreshold: number;       // Default: 0.80
  codeQualityThreshold: number;           // Default: 0.75
  featureCompletenessThreshold: number;   // Default: 0.90
  weights: {
    intentAlignment: number;              // Default: 0.35
    visualAlignment: number;              // Default: 0.25
    codeQuality: number;                  // Default: 0.20
    featureCompleteness: number;          // Default: 0.20
  };
}

export interface SemanticVerificationResult {
  passed: boolean;
  overallScore: number;
  dimensions: {
    intentAlignment: DimensionResult;
    visualAlignment: DimensionResult;
    codeQuality: DimensionResult;
    featureCompleteness: DimensionResult;
  };
  failures: VerificationFailure[];
  recommendations: string[];
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface DimensionResult {
  score: number;
  threshold: number;
  passed: boolean;
  details: string;
  evidence: string[];
}

export class SemanticVerifier {
  constructor(config?: Partial<SemanticVerificationConfig>);

  async verify(
    buildIntentId: string,
    buildOutput: BuildOutput,
    options?: VerificationOptions
  ): Promise<SemanticVerificationResult>;

  async verifyIncremental(
    buildIntentId: string,
    changedFiles: string[],
    previousResult: SemanticVerificationResult
  ): Promise<SemanticVerificationResult>;
}
```

### Step 2: Create Intent Alignment Verifier
Create file: server/src/services/verification/verifiers/intent-alignment-verifier.ts

Requirements:
- Compare build artifacts against intent embeddings
- Generate embeddings for:
  - Component descriptions from code comments/JSDoc
  - Route purposes from API documentation
  - UI component intents from prop names/structure
- Calculate weighted similarity across all artifacts
- Identify specific misalignments

```typescript
export async function verifyIntentAlignment(
  buildIntentId: string,
  artifacts: BuildArtifact[]
): Promise<IntentAlignmentResult>;
```

### Step 3: Create Visual Alignment Verifier
Create file: server/src/services/verification/verifiers/visual-alignment-verifier.ts

Requirements:
- Capture screenshots of built UI
- Generate SigLIP 2 embeddings for screenshots
- Compare against visual concept embedding from Intent Lock
- Check for anti-slop patterns via embedding similarity
- Verify app soul alignment

```typescript
export interface VisualAlignmentResult {
  score: number;
  screenshots: ScreenshotAnalysis[];
  soulAlignment: number;
  antiSlopScore: number;
  issues: VisualIssue[];
}

export async function verifyVisualAlignment(
  buildIntentId: string,
  buildUrl: string
): Promise<VisualAlignmentResult>;
```

### Step 4: Create Code Quality Verifier (Embedding-based)
Create file: server/src/services/verification/verifiers/code-quality-verifier.ts

Requirements:
- Generate Voyage-code-3 embeddings for generated code
- Compare against high-quality code patterns in code_patterns collection
- Identify code that deviates from best practices
- Check for pattern consistency within project

```typescript
export interface CodeQualityResult {
  score: number;
  patternMatches: PatternMatch[];
  deviations: CodeDeviation[];
  consistencyScore: number;
  recommendations: string[];
}

export async function verifyCodeQuality(
  projectId: string,
  codeFiles: CodeFile[]
): Promise<CodeQualityResult>;
```

### Step 5: Create Feature Completeness Verifier
Create file: server/src/services/verification/verifiers/feature-completeness-verifier.ts

Requirements:
- Compare generated features against success criteria embeddings
- Check each inferred requirement is satisfied
- Verify user workflows are implementable
- Score completeness per requirement

```typescript
export interface FeatureCompletenessResult {
  score: number;
  criteriaResults: CriterionResult[];
  workflowResults: WorkflowResult[];
  missingFeatures: string[];
  partialFeatures: PartialFeature[];
}

export async function verifyFeatureCompleteness(
  buildIntentId: string,
  implementedFeatures: Feature[]
): Promise<FeatureCompletenessResult>;
```

### Step 6: Update Build Loop Phase 5
Modify: server/src/services/automation/build-loop.ts

Update Phase 5 (Intent Satisfaction) to include semantic verification:

```typescript
async function executePhase5IntentSatisfaction(
  buildContext: BuildContext
): Promise<PhaseResult> {
  const semanticVerifier = new SemanticVerifier();

  // Run semantic verification in parallel with existing checks
  const [
    existingCheckResult,
    semanticResult
  ] = await Promise.all([
    runExistingIntentSatisfactionChecks(buildContext),
    semanticVerifier.verify(
      buildContext.buildIntentId,
      buildContext.buildOutput
    )
  ]);

  // Combine results
  if (!semanticResult.passed) {
    return {
      phase: 5,
      status: 'needs_work',
      reason: 'Semantic verification failed',
      details: semanticResult,
      loopBackTo: 2  // Return to Parallel Build
    };
  }

  // Continue with existing logic if semantic verification passes
  // ...
}
```

### Step 7: Create Verification Feedback Generator
Create file: server/src/services/verification/feedback-generator.ts

Requirements:
- Generate actionable feedback from verification failures
- Prioritize issues by impact
- Provide specific file/line recommendations
- Format for agent consumption (can be used by build agents)

```typescript
export interface VerificationFeedback {
  summary: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  actions: ActionItem[];
  context: string;
  estimatedEffort: 'small' | 'medium' | 'large';
}

export function generateFeedback(
  verificationResult: SemanticVerificationResult
): VerificationFeedback[];
```

### Step 8: Update Verification Swarm Integration
Modify: server/src/services/verification/swarm.ts

Add new semantic verification agent to the 6-agent swarm:

```typescript
// Add to verification agent definitions
const SEMANTIC_VERIFIER_AGENT: VerificationAgent = {
  name: 'semantic_verifier',
  pollInterval: 30000,  // 30 seconds
  threshold: 0.85,
  blocking: true,       // Blocks completion if fails
  verifier: semanticVerifier
};
```

### Step 9: Create Verification Dashboard Data
Create file: server/src/services/verification/verification-metrics.ts

Requirements:
- Track semantic verification scores over time
- Identify common failure patterns
- Calculate improvement trends
- Export metrics for dashboard

## VERIFICATION
After implementation:
1. Run npm run build - must pass
2. Create test build with intent
3. Run semantic verification
4. Verify scores are calculated correctly
5. Test failure feedback generation
6. Verify build loop integration

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 6: Visual Understanding Service with Gemini 3 Pro

```
You are implementing the Visual Understanding Service for KripTik AI, powered by Gemini 3 Pro for native multimodal analysis and SigLIP 2 for visual embeddings.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode - visual understanding is complex
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code with proper error handling
- Read existing files:
  - server/src/services/verification/anti-slop-detector.ts
  - server/src/services/embeddings/siglip-provider.ts (from PROMPT 2)
  - server/src/services/ai/openrouter-client.ts (for API patterns)
- Run npm run build after changes

## CONTEXT
KripTik Visual Verification:
- Anti-slop detection ensures premium design quality
- Current implementation uses text-based prompts to vision models
- Need semantic understanding of visual elements

Best Models (January 2026):
- Gemini 3 Pro: 87.6% Video-MMMU, native multimodal, 1M context
- GPT-5.2: 86.3% ScreenSpot-Pro for UI comprehension
- SigLIP 2: Best visual embedding model

## TASK: Create Visual Understanding Service

### Step 1: Create Visual Understanding Service
Create file: server/src/services/visual/visual-understanding-service.ts

Requirements:
- Screenshot analysis with Gemini 3 Pro
- Design pattern detection
- Anti-slop visual scoring
- Component identification
- Color palette extraction
- Typography analysis
- Layout structure analysis

```typescript
export interface ScreenshotAnalysisRequest {
  imageUrl?: string;
  imageBase64?: string;
  analysisTypes: AnalysisType[];
  intentContext?: {
    appSoul: AppSoulType;
    visualIdentity: VisualIdentity;
    antiPatterns: string[];
  };
}

export type AnalysisType =
  | 'design_quality'
  | 'anti_slop'
  | 'component_structure'
  | 'color_analysis'
  | 'typography_analysis'
  | 'layout_analysis'
  | 'accessibility'
  | 'soul_alignment';

export interface ScreenshotAnalysisResult {
  overallScore: number;
  analyses: {
    designQuality?: DesignQualityResult;
    antiSlop?: AntiSlopResult;
    componentStructure?: ComponentStructureResult;
    colorAnalysis?: ColorAnalysisResult;
    typographyAnalysis?: TypographyResult;
    layoutAnalysis?: LayoutResult;
    accessibility?: AccessibilityResult;
    soulAlignment?: SoulAlignmentResult;
  };
  embedding: number[];           // SigLIP 2 embedding for storage
  recommendations: string[];
  criticalIssues: string[];
}

export class VisualUnderstandingService {
  async analyzeScreenshot(
    request: ScreenshotAnalysisRequest
  ): Promise<ScreenshotAnalysisResult>;

  async compareScreenshots(
    screenshot1: string,
    screenshot2: string,
    comparisonType: 'similarity' | 'diff' | 'regression'
  ): Promise<ScreenshotComparisonResult>;

  async extractDesignSystem(
    screenshots: string[]
  ): Promise<DesignSystemExtraction>;
}
```

### Step 2: Create Gemini 3 Pro Client
Create file: server/src/services/visual/gemini-client.ts

Requirements:
- Use Google AI API (gemini-3-pro-vision model)
- Support for images, videos, and multi-image analysis
- 1M token context for comprehensive analysis
- Structured JSON output mode
- Retry with exponential backoff
- Cost tracking integration
- Environment: GOOGLE_AI_API_KEY

```typescript
export interface GeminiAnalysisRequest {
  images: Array<{
    data: string;      // base64 or URL
    mimeType: string;
  }>;
  prompt: string;
  outputSchema?: object;     // For structured output
  maxTokens?: number;
  temperature?: number;
}

export class GeminiClient {
  async analyze(request: GeminiAnalysisRequest): Promise<GeminiResponse>;
  async analyzeVideo(videoUrl: string, prompt: string): Promise<GeminiResponse>;
}
```

### Step 3: Create Design Quality Analyzer
Create file: server/src/services/visual/analyzers/design-quality-analyzer.ts

Requirements:
- Score design quality on 7 dimensions (from anti-slop rules):
  1. Depth (shadows, layers, glass effects)
  2. Motion indication (animation states visible)
  3. Typography (hierarchy, premium fonts)
  4. Color (intentional palette, not defaults)
  5. Layout (purposeful spacing, rhythm)
  6. Polish (micro-interactions, hover states)
  7. Cohesion (consistent design language)
- Use Gemini 3 Pro for comprehensive analysis
- Return structured scores with evidence

```typescript
export interface DesignQualityResult {
  overallScore: number;
  dimensions: {
    depth: DimensionScore;
    motion: DimensionScore;
    typography: DimensionScore;
    color: DimensionScore;
    layout: DimensionScore;
    polish: DimensionScore;
    cohesion: DimensionScore;
  };
  evidence: EvidenceItem[];
  passesAntiSlop: boolean;
}

export async function analyzeDesignQuality(
  imageData: string,
  context?: DesignContext
): Promise<DesignQualityResult>;
```

### Step 4: Create Anti-Slop Visual Detector
Create file: server/src/services/visual/analyzers/anti-slop-visual-detector.ts

Requirements:
- Detect visual anti-patterns via Gemini 3 Pro:
  - Purple-to-pink gradients
  - Blue-to-purple gradients
  - Flat designs without depth
  - Default gray colors (#gray-200, #gray-300, #gray-400)
  - Generic system fonts
  - Emoji in UI
  - "Coming soon" / placeholder text
- Generate SigLIP 2 embedding for pattern matching
- Compare against known anti-slop pattern embeddings
- INSTANT FAIL for blocked patterns

```typescript
export interface AntiSlopResult {
  passed: boolean;
  score: number;                  // 0-100
  violations: AntiSlopViolation[];
  instantFails: string[];
  warnings: string[];
  embedding: number[];            // For pattern storage
}

export interface AntiSlopViolation {
  pattern: string;
  severity: 'instant_fail' | 'major' | 'minor';
  location: { x: number; y: number; width: number; height: number };
  description: string;
  suggestedFix: string;
}

export async function detectAntiSlopPatterns(
  imageData: string
): Promise<AntiSlopResult>;
```

### Step 5: Create Soul Alignment Analyzer
Create file: server/src/services/visual/analyzers/soul-alignment-analyzer.ts

Requirements:
- Analyze screenshot against app soul definition
- 8 app souls: immersive_media, professional, developer, creative, social, ecommerce, utility, gaming
- Each soul has distinct visual expectations
- Score alignment 0-100
- Use both Gemini 3 Pro analysis and SigLIP 2 embedding comparison

```typescript
export interface SoulAlignmentResult {
  score: number;
  matchedSoul: AppSoulType;
  intendedSoul: AppSoulType;
  alignmentDetails: {
    colorAlignment: number;
    layoutAlignment: number;
    motionAlignment: number;
    emotionAlignment: number;
  };
  deviations: string[];
  suggestions: string[];
}

export async function analyzeSoulAlignment(
  imageData: string,
  intendedSoul: AppSoulType,
  visualIdentity: VisualIdentity
): Promise<SoulAlignmentResult>;
```

### Step 6: Create Design System Extractor
Create file: server/src/services/visual/design-system-extractor.ts

Requirements:
- Extract design system from screenshots:
  - Color palette (primary, secondary, accent, neutrals)
  - Typography scale (headings, body, mono)
  - Spacing scale
  - Component patterns
  - Shadow/elevation system
- Use multiple screenshots for comprehensive extraction
- Generate embeddings for each design element
- Store in Qdrant for future comparison

```typescript
export interface DesignSystemExtraction {
  colors: ColorPalette;
  typography: TypographyScale;
  spacing: SpacingScale;
  shadows: ShadowSystem;
  components: ComponentPattern[];
  embeddings: {
    overall: number[];
    colors: number[];
    typography: number[];
    components: number[][];
  };
}

export async function extractDesignSystem(
  screenshots: string[]
): Promise<DesignSystemExtraction>;
```

### Step 7: Create Visual Comparison Service
Create file: server/src/services/visual/visual-comparator.ts

Requirements:
- Compare two screenshots for:
  - Visual similarity (embedding distance)
  - Layout changes (structural diff)
  - Color changes
  - Component changes
- Support regression detection (did we break something?)
- Generate visual diff overlay

```typescript
export interface VisualComparisonResult {
  similarity: number;            // 0-1 from embedding comparison
  structuralDiff: number;        // 0-1 layout difference
  changes: VisualChange[];
  isRegression: boolean;
  regressionDetails?: string;
}

export async function compareScreenshots(
  before: string,
  after: string,
  options?: ComparisonOptions
): Promise<VisualComparisonResult>;
```

### Step 8: Update Anti-Slop Detector Integration
Modify: server/src/services/verification/anti-slop-detector.ts

Add visual understanding integration:
- Use Gemini 3 Pro for screenshot analysis
- Store anti-slop embeddings for pattern learning
- Enhance existing text-based detection with visual

### Step 9: Create Visual Understanding API Routes
Create file: server/src/routes/visual.ts

Endpoints:
- POST /api/visual/analyze - Analyze screenshot
- POST /api/visual/compare - Compare screenshots
- POST /api/visual/extract-design-system - Extract design system
- POST /api/visual/check-anti-slop - Quick anti-slop check

### Step 10: Environment Configuration
Update server/.env.example:
- GOOGLE_AI_API_KEY
- VISUAL_ANALYSIS_CACHE_TTL_HOURS=1
- VISUAL_ANALYSIS_MAX_IMAGE_SIZE_MB=10

## VERIFICATION
After implementation:
1. Run npm run build - must pass
2. Test screenshot analysis with Gemini 3 Pro
3. Test anti-slop detection
4. Test soul alignment
5. Test screenshot comparison
6. Verify embedding storage in Qdrant

## DELIVERABLES
List all files created/modified when complete.
```

---

## Dependency Graph

```
PROMPT 1 ─────────────────┐
(Qdrant Infrastructure)   │
                          ▼
PROMPT 2 ─────────────────┤
(Embedding Service Core)  │
                          ▼
PROMPT 3 ─────────────────┤
(Collections Setup)       │
                          ▼
PROMPT 4 ─────────────────┤
(Intent Lock Integration) │
          │               │
          ▼               ▼
PROMPT 5 ◄────────────────┤
(Intent Satisfaction)     │
                          │
PROMPT 6 ─────────────────┘
(Visual Understanding)
```

## Implementation Notes

### Execution Order
1. **PROMPT 1** must complete first (infrastructure)
2. **PROMPT 2** depends on PROMPT 1 (needs Qdrant client)
3. **PROMPT 3** depends on PROMPT 1, 2 (uses client, creates collections)
4. **PROMPT 4** depends on PROMPT 2, 3 (uses embedding service, collections)
5. **PROMPT 5** depends on PROMPT 4 (uses intent embeddings)
6. **PROMPT 6** can run in parallel with PROMPT 5 (independent visual service)

### Critical Success Criteria
- [ ] All 7 Qdrant collections created and indexed
- [ ] BGE-M3, Voyage-code-3, SigLIP 2 providers working
- [ ] Intent Lock generates embeddings on contract creation
- [ ] Intent Satisfaction uses semantic verification
- [ ] Visual Understanding provides design analysis
- [ ] Anti-slop detection enhanced with visual embeddings
- [ ] All builds pass (`npm run build`)

### Cost Estimates (per 1000 operations)
- BGE-M3 embeddings: ~$0.01
- Voyage-code-3 embeddings: ~$0.12
- SigLIP 2 embeddings: ~$0.05
- Gemini 3 Pro analysis: ~$0.50
- Qdrant storage: ~$0.001

### Environment Variables Required
```bash
# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=           # Optional for local dev
QDRANT_COLLECTION_PREFIX=kriptik_

# Embedding Providers
HUGGINGFACE_API_KEY=      # For BGE-M3, SigLIP 2
VOYAGE_API_KEY=           # For Voyage-code-3

# Visual Understanding
GOOGLE_AI_API_KEY=        # For Gemini 3 Pro

# Caching
EMBEDDING_CACHE_TTL_HOURS=24
VISUAL_ANALYSIS_CACHE_TTL_HOURS=1
```

---

## Sources

### Vision/Multimodal Models
- [GPT-5.2 vs Gemini 3 Pro vs Claude Opus 4.5](https://blog.typingmind.com/gpt-5-2-vs-claude-opus-4-5-vs-gemini-3-pro/)
- [AI Model Benchmarks Dec 2025](https://lmcouncil.ai/benchmarks)
- [GPT-5.2 Benchmarks Explained](https://www.vellum.ai/blog/gpt-5-2-benchmarks)
- [January 2026's Top AI Models](https://www.thepromptbuddy.com/prompts/january-2026-s-top-ai-models-the-most-powerful-systems-compared)

### Text Embedding Models
- [Best Open-Source Embedding Models 2026](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)
- [Qwen3 Embedding Announcement](https://qwenlm.github.io/blog/qwen3-embedding/)
- [Top Embedding Models MTEB](https://modal.com/blog/mteb-leaderboard-article)

### Code Embedding Models
- [Voyage-code-3 Announcement](https://blog.voyageai.com/2024/12/04/voyage-code-3/)
- [6 Best Code Embedding Models Compared](https://modal.com/blog/6-best-code-embedding-models-compared)

### Visual Embedding Models
- [SigLIP 2 Paper](https://arxiv.org/pdf/2502.14786)
- [CLIP to SigLIP Guide](https://blog.ritwikraha.dev/choosing-between-siglip-and-clip-for-language-image-pretraining)

### VL-JEPA
- [VL-JEPA Paper](https://arxiv.org/abs/2512.10942)
- [VL-JEPA TechTalks](https://bdtechtalks.com/2026/01/03/meta-vl-jepa-vision-language-model/)
- [V-JEPA 2 Introduction](https://ai.meta.com/vjepa/)

### Qdrant
- [Qdrant 1.16 Release](https://qdrant.tech/blog/qdrant-1.16.x/)
- [Qdrant Tiered Multitenancy](https://qdrant.tech/documentation/guides/multitenancy/)

---

*Document Version: 1.0*
*Last Updated: January 7, 2026*
*Author: Claude Code (Opus 4.5)*
