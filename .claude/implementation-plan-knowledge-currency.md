# Knowledge Currency Implementation Plan

> **Problem**: AI models use stale knowledge (~1 year training cutoff). KripTik must ensure ALL AI interactions use current, accurate information about APIs, libraries, frameworks, and best practices.

> **Goal**: Implement comprehensive knowledge currency system that affects ALL NLP inputs, caches data efficiently for all users, integrates with training pipeline, and minimizes speed impact.

**Created**: 2026-01-08
**Status**: Implementation Plan (Ready for Development)

---

## EXECUTIVE SUMMARY

### Current State Analysis

**What Exists (But Doesn't Work)**:
1. `dynamic-model-discovery.ts` - Generates date-aware search queries but **never executes them**
2. `provisioning/research-agent.ts` - Uses **hardcoded static SERVICE_KNOWLEDGE** (stale)
3. `ai-lab/research-agent.ts` - Uses **simulateWork()** instead of actual research
4. `unified-context.ts` - Loads 14 context sections, **ALL internal** - zero external knowledge

**Critical Gap**: KripTik has NO real-time knowledge acquisition. All 81 files making AI calls operate on stale model knowledge.

### What This Plan Delivers

1. **Real-Time Knowledge Layer** - Fresh API/library/framework information injected into every AI call
2. **Intelligent Caching System** - 3-tier cache (memory → Redis → database) with smart TTLs
3. **Training Pipeline Integration** - Knowledge captured and stored for model fine-tuning
4. **Minimal Speed Impact** - Parallel fetching, pre-warming, and intelligent caching

---

## PART 1: ARCHITECTURE OVERVIEW

### Knowledge Currency Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NLP INPUT (Any Entry Point)                          │
│   Builder View | Feature Agent | Training | Open Source Studio | Iteration   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE CURRENCY GATEWAY                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    TOPIC EXTRACTION                                  │    │
│  │  • Parse NLP for technologies (React, Stripe, Supabase, etc.)       │    │
│  │  • Identify API integrations mentioned                               │    │
│  │  • Detect library/framework references                               │    │
│  │  • Extract version requirements                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    3-TIER CACHE LOOKUP                               │    │
│  │                                                                      │    │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐                       │    │
│  │  │ TIER 1   │ →  │ TIER 2   │ →  │ TIER 3   │                       │    │
│  │  │ Memory   │    │ Redis    │    │ Database │                       │    │
│  │  │ (5 min)  │    │ (1 hour) │    │ (24 hrs) │                       │    │
│  │  └──────────┘    └──────────┘    └──────────┘                       │    │
│  │                                                                      │    │
│  │  If MISS at all tiers → Trigger Knowledge Fetch                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    KNOWLEDGE FETCHER (Parallel)                      │    │
│  │                                                                      │    │
│  │  • WebSearch (latest docs, changelogs, deprecations)                │    │
│  │  • Official API docs crawling                                        │    │
│  │  • npm/PyPI version checking                                         │    │
│  │  • GitHub release notes                                              │    │
│  │  • Community best practices (Stack Overflow, Dev.to)                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    KNOWLEDGE COMPILER                                │    │
│  │                                                                      │    │
│  │  • Synthesize findings into structured context                      │    │
│  │  • Version-aware information (current vs deprecated)                │    │
│  │  • Breaking changes highlighted                                      │    │
│  │  • Migration guides extracted                                        │    │
│  │  • Store in all cache tiers                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED CONTEXT INJECTION                                 │
│                                                                              │
│  Existing 14 sections + NEW Section 15: External Knowledge                  │
│                                                                              │
│  Format:                                                                     │
│  ## CURRENT TECHNOLOGY KNOWLEDGE (As of 2026-01-08)                         │
│  ### React v19.1 (Latest)                                                   │
│  - New: Server Components are now default                                   │
│  - Deprecated: Legacy context API                                           │
│  - Breaking: useEffect behavior changed                                     │
│  ### Stripe API v2024-12                                                    │
│  - New: Payment Intents v3 endpoints                                        │
│  - Deprecated: /v1/charges endpoint                                         │
│  - Migration: Use PaymentIntent.create() instead                            │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI CODE GENERATION                                        │
│                                                                              │
│  Now generates code using CURRENT APIs, libraries, and best practices       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PART 2: COMPLETE GAP ANALYSIS

### A. Current Context System (unified-context.ts)

**What It Loads** (14 sections - ALL internal):

| # | Section | Source | Knowledge Type |
|---|---------|--------|----------------|
| 1 | Intent Lock Contract | Database | Internal |
| 2 | App Soul Template | Database | Internal |
| 3 | Anti-Slop Rules | Hardcoded | Static |
| 4 | Build Phase Status | Database | Internal |
| 5 | Verification Results | Database | Internal |
| 6 | Tournament Results | Database | Internal |
| 7 | Error History | Database | Internal |
| 8 | Learned Patterns | Database | Internal |
| 9 | Active Strategies | Database | Internal |
| 10 | Judge Decisions | Database | Internal |
| 11 | Project Analysis | Database | Internal |
| 12 | Project Rules | Files | Internal |
| 13 | User Preferences | Database | Internal |
| 14 | Provider Hints | Hardcoded | Static/Stale |

**MISSING**: Section 15 - External Knowledge Currency (real-time, fresh)

### B. All NLP Entry Points (81 Files Requiring Integration)

#### Tier 1: Critical Entry Points (Must Have Knowledge Currency)

| File | Purpose | Current Knowledge Source |
|------|---------|-------------------------|
| `krip-toe-nite/facade.ts` | Main AI gateway | Unified Context (internal only) |
| `krip-toe-nite/executor.ts` | Code execution | None |
| `build-loop.ts` | 6-phase orchestration | Unified Context (internal only) |
| `feature-agent-service.ts` | Feature building | Unified Context (internal only) |
| `fix-my-app/orchestrator.ts` | Fix broken apps | Static knowledge |
| `intent-lock.ts` | Sacred contracts | None |
| `coding-agent-wrapper.ts` | Direct coding | File context only |
| `worker-agent.ts` | Build workers | Unified Context (internal only) |

#### Tier 2: Planning & Research (Requires Fresh Knowledge)

| File | Purpose | Current Knowledge Source |
|------|---------|-------------------------|
| `provisioning/research-agent.ts` | Service research | **Hardcoded SERVICE_KNOWLEDGE** |
| `ai-lab/research-agent.ts` | AI lab research | **simulateWork() - fake** |
| `dynamic-model-discovery.ts` | Model discovery | **Queries generated, never executed** |
| `market-fit-oracle.ts` | Market analysis | None |
| `api-autopilot.ts` | API discovery | None |

#### Tier 3: Verification & Quality (Needs Current Standards)

| File | Purpose | Current Knowledge Source |
|------|---------|-------------------------|
| `swarm.ts` | Verification swarm | Internal rules only |
| `anti-slop-detector.ts` | Design quality | Hardcoded rules |
| `security-scanner.ts` | Security checks | OWASP (potentially stale) |
| `code-quality.ts` | Quality scoring | Static patterns |
| `accessibility-verifier.ts` | A11y checking | WCAG (static) |

#### Tier 4: Training Pipeline (Requires Knowledge for Fine-Tuning)

| File | Purpose | Current Knowledge Source |
|------|---------|-------------------------|
| `evolution-flywheel.ts` | Learning orchestrator | Internal traces only |
| `pattern-library.ts` | Pattern storage | Internal patterns only |
| `ai-judgment.ts` | RLAIF scoring | Internal judgments |
| `experience-capture.ts` | Trace collection | Internal builds only |
| `strategy-evolution.ts` | Strategy optimization | Internal strategies |

### C. Caching Infrastructure Analysis

**Existing Cache Mechanisms**:

1. **pattern-library.ts** (5-minute memory cache):
   ```typescript
   private patternCache: Map<string, LearnedPattern[]> = new Map();
   private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
   ```

2. **Redis** (already in codebase for multi-sandbox):
   - Used by `context-bridge.ts` with 24-hour TTL
   - Can be extended for knowledge currency

3. **Database**:
   - `learningPatterns` table exists for pattern storage
   - Need new `knowledgeCurrency` table for external knowledge

**Cache Strategy Recommendation**:
- Tier 1 (Memory): 5 minutes - hot data, per-instance
- Tier 2 (Redis): 1 hour - shared across instances
- Tier 3 (Database): 24 hours - persistent, survives restarts

---

## PART 3: IMPLEMENTATION SPECIFICATION

### New Files to Create

#### 1. `server/src/services/knowledge/knowledge-currency-service.ts`

**Purpose**: Central service for fetching, caching, and injecting external knowledge.

```typescript
interface KnowledgeCurrencyService {
  // Core methods
  fetchKnowledge(topics: string[]): Promise<KnowledgeBundle>;
  getCachedKnowledge(topics: string[]): Promise<KnowledgeBundle | null>;
  injectIntoContext(context: UnifiedContext, topics: string[]): Promise<UnifiedContext>;

  // Topic extraction
  extractTopics(prompt: string): string[];

  // Cache management
  warmCache(commonTopics: string[]): Promise<void>;
  invalidateCache(topic: string): void;

  // Training integration
  storeForTraining(knowledge: KnowledgeBundle): Promise<void>;
}

interface KnowledgeBundle {
  topics: TopicKnowledge[];
  fetchedAt: Date;
  sources: string[];
  confidence: number;
}

interface TopicKnowledge {
  topic: string;           // e.g., "stripe-api"
  currentVersion: string;  // e.g., "2024-12-01"
  latestChanges: Change[];
  deprecations: Deprecation[];
  migrationGuides: string[];
  bestPractices: string[];
  codeExamples: CodeExample[];
  officialDocs: string;
  lastVerified: Date;
}
```

#### 2. `server/src/services/knowledge/topic-extractor.ts`

**Purpose**: Extract technology topics from NLP prompts.

```typescript
// Technology patterns to detect
const TOPIC_PATTERNS = {
  // Frameworks
  frameworks: /\b(react|vue|angular|svelte|next\.?js|nuxt|remix|astro)\b/gi,

  // APIs & Services
  services: /\b(stripe|supabase|firebase|auth0|clerk|vercel|aws|gcp|azure|openai|anthropic|replicate|twilio|sendgrid|resend|neon|turso|planetscale|upstash)\b/gi,

  // Libraries
  libraries: /\b(prisma|drizzle|sequelize|mongoose|typeorm|zod|yup|joi|tailwind|shadcn|radix|framer-motion|three\.?js|socket\.io|redis|bull|agenda)\b/gi,

  // Languages & Runtimes
  runtimes: /\b(typescript|node\.?js|deno|bun|python|rust|go)\b/gi,

  // Patterns
  patterns: /\b(oauth|jwt|websocket|graphql|rest|trpc|grpc|sse|webhook)\b/gi,
};

function extractTopics(prompt: string): string[] {
  const topics = new Set<string>();

  for (const [category, pattern] of Object.entries(TOPIC_PATTERNS)) {
    const matches = prompt.match(pattern);
    if (matches) {
      matches.forEach(m => topics.add(m.toLowerCase()));
    }
  }

  return Array.from(topics);
}
```

#### 3. `server/src/services/knowledge/knowledge-fetcher.ts`

**Purpose**: Fetch fresh knowledge from multiple sources in parallel.

```typescript
interface KnowledgeFetcher {
  // Source-specific fetchers (run in parallel)
  fetchFromWebSearch(topic: string): Promise<WebSearchResult>;
  fetchFromNpmRegistry(packageName: string): Promise<NpmInfo>;
  fetchFromGitHubReleases(repo: string): Promise<Release[]>;
  fetchFromOfficialDocs(topic: string): Promise<DocContent>;

  // Aggregator
  fetchAll(topic: string): Promise<AggregatedKnowledge>;
}

// Example implementation
async function fetchAll(topic: string): Promise<AggregatedKnowledge> {
  // Run all fetches in parallel for speed
  const [webSearch, npm, github, docs] = await Promise.allSettled([
    fetchFromWebSearch(`${topic} latest changes ${getCurrentDate()}`),
    fetchFromNpmRegistry(topic),
    fetchFromGitHubReleases(getRepoForTopic(topic)),
    fetchFromOfficialDocs(topic),
  ]);

  return synthesize(webSearch, npm, github, docs);
}
```

#### 4. `server/src/services/knowledge/knowledge-cache.ts`

**Purpose**: 3-tier caching system for knowledge currency.

```typescript
class KnowledgeCache {
  private memoryCache: Map<string, CachedKnowledge> = new Map();
  private redis: Redis;

  private readonly MEMORY_TTL = 5 * 60 * 1000;      // 5 minutes
  private readonly REDIS_TTL = 60 * 60;             // 1 hour (seconds)
  private readonly DB_TTL = 24 * 60 * 60 * 1000;    // 24 hours

  async get(topic: string): Promise<TopicKnowledge | null> {
    // Tier 1: Memory (fastest)
    const memCached = this.memoryCache.get(topic);
    if (memCached && !this.isExpired(memCached, this.MEMORY_TTL)) {
      return memCached.knowledge;
    }

    // Tier 2: Redis (shared across instances)
    const redisCached = await this.redis.get(`knowledge:${topic}`);
    if (redisCached) {
      const parsed = JSON.parse(redisCached);
      this.memoryCache.set(topic, { knowledge: parsed, cachedAt: new Date() });
      return parsed;
    }

    // Tier 3: Database (persistent)
    const dbCached = await this.getFromDatabase(topic);
    if (dbCached && !this.isExpired(dbCached, this.DB_TTL)) {
      await this.redis.setex(`knowledge:${topic}`, this.REDIS_TTL, JSON.stringify(dbCached.knowledge));
      this.memoryCache.set(topic, dbCached);
      return dbCached.knowledge;
    }

    return null; // Cache miss at all tiers
  }

  async set(topic: string, knowledge: TopicKnowledge): Promise<void> {
    const cached = { knowledge, cachedAt: new Date() };

    // Store in all tiers
    this.memoryCache.set(topic, cached);
    await this.redis.setex(`knowledge:${topic}`, this.REDIS_TTL, JSON.stringify(knowledge));
    await this.saveToDatabase(topic, knowledge);
  }
}
```

### Database Schema Addition

```sql
-- New table for knowledge currency storage
CREATE TABLE knowledge_currency (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL UNIQUE,
  current_version TEXT,
  latest_changes JSON,        -- Array of changes
  deprecations JSON,          -- Array of deprecations
  migration_guides JSON,      -- Array of migration guides
  best_practices JSON,        -- Array of best practices
  code_examples JSON,         -- Array of code examples
  official_docs TEXT,         -- URL to official docs
  sources JSON,               -- Array of sources used
  confidence REAL,            -- 0-1 confidence score
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_knowledge_topic ON knowledge_currency(topic);
CREATE INDEX idx_knowledge_expires ON knowledge_currency(expires_at);
```

### Integration Points

#### 1. Unified Context Integration (unified-context.ts)

```typescript
// Add to UnifiedContext interface
export interface UnifiedContext {
  // ... existing 14 sections ...

  // NEW Section 15: External Knowledge Currency
  knowledgeCurrency: {
    topics: TopicKnowledge[];
    fetchedAt: string;
    sources: string[];
  } | null;
}

// Modify loadUnifiedContext() function
export async function loadUnifiedContext(
  projectId: string,
  userId: string,
  projectPath: string,
  options?: ContextLoadOptions
): Promise<UnifiedContext> {
  // ... existing loading logic ...

  // NEW: Load knowledge currency if topics detected
  let knowledgeCurrency = null;
  if (options?.prompt) {
    const knowledgeService = getKnowledgeCurrencyService();
    const topics = knowledgeService.extractTopics(options.prompt);
    if (topics.length > 0) {
      knowledgeCurrency = await knowledgeService.fetchKnowledge(topics);
    }
  }

  return {
    // ... existing sections ...
    knowledgeCurrency,
  };
}

// Modify formatUnifiedContextForCodeGen() function
export function formatUnifiedContextForCodeGen(context: UnifiedContext): string {
  const sections: string[] = [];

  // ... existing section formatting ...

  // NEW: Format knowledge currency section
  if (context.knowledgeCurrency?.topics.length) {
    sections.push(formatKnowledgeCurrencySection(context.knowledgeCurrency));
  }

  return sections.join('\n\n');
}

function formatKnowledgeCurrencySection(knowledge: KnowledgeBundle): string {
  const lines = [
    '## CURRENT TECHNOLOGY KNOWLEDGE',
    `As of: ${knowledge.fetchedAt}`,
    '',
  ];

  for (const topic of knowledge.topics) {
    lines.push(`### ${topic.topic} (v${topic.currentVersion})`);

    if (topic.latestChanges.length) {
      lines.push('**Recent Changes:**');
      topic.latestChanges.forEach(c => lines.push(`- ${c.type}: ${c.description}`));
    }

    if (topic.deprecations.length) {
      lines.push('**Deprecations:**');
      topic.deprecations.forEach(d => lines.push(`- ⚠️ ${d.what}: ${d.useInstead}`));
    }

    if (topic.bestPractices.length) {
      lines.push('**Current Best Practices:**');
      topic.bestPractices.forEach(bp => lines.push(`- ${bp}`));
    }

    lines.push('');
  }

  return lines.join('\n');
}
```

#### 2. KripToeNite Facade Integration (krip-toe-nite/facade.ts)

```typescript
// Modify generate() method to include knowledge currency
async generate(prompt: string, ctx: RequestContext): Promise<KTNResult> {
  // Extract topics from prompt
  const knowledgeService = getKnowledgeCurrencyService();
  const topics = knowledgeService.extractTopics(prompt);

  // Fetch knowledge in parallel with other setup
  const [context, knowledge] = await Promise.all([
    loadUnifiedContext(ctx.projectId, ctx.userId, ctx.projectPath || ''),
    topics.length > 0 ? knowledgeService.fetchKnowledge(topics) : null,
  ]);

  // Inject knowledge into context
  if (knowledge) {
    context.knowledgeCurrency = knowledge;
  }

  // ... rest of generation logic ...
}
```

#### 3. Build Loop Integration (build-loop.ts)

```typescript
// At start of each phase, refresh knowledge for relevant topics
private async refreshKnowledgeForPhase(phase: BuildPhase): Promise<void> {
  const knowledgeService = getKnowledgeCurrencyService();

  // Extract topics from current feature requirements
  const features = await this.getCurrentFeatures();
  const allTopics = new Set<string>();

  for (const feature of features) {
    const topics = knowledgeService.extractTopics(feature.description);
    topics.forEach(t => allTopics.add(t));
  }

  // Pre-fetch knowledge for all detected topics
  if (allTopics.size > 0) {
    await knowledgeService.warmCache(Array.from(allTopics));
  }
}
```

#### 4. Training Pipeline Integration (evolution-flywheel.ts)

```typescript
// Store knowledge alongside build traces for training
async captureExperienceWithKnowledge(trace: BuildTrace): Promise<void> {
  const knowledgeService = getKnowledgeCurrencyService();

  // Get knowledge that was used during this build
  const knowledgeUsed = trace.knowledgeCurrency;

  if (knowledgeUsed) {
    // Store for training data generation
    await knowledgeService.storeForTraining({
      traceId: trace.id,
      topics: knowledgeUsed.topics,
      usedAt: new Date(),
      buildSuccess: trace.success,
    });
  }
}

// Generate training pairs that include knowledge context
async generateTrainingPairs(): Promise<PreferencePair[]> {
  const pairs: PreferencePair[] = [];

  // Include knowledge currency in training prompts
  for (const trace of recentTraces) {
    const knowledgeContext = await getKnowledgeUsedInTrace(trace.id);

    pairs.push({
      prompt: `${trace.originalPrompt}\n\n${formatKnowledgeForTraining(knowledgeContext)}`,
      chosen: trace.successfulCode,
      rejected: trace.failedAttempts[0]?.code,
    });
  }

  return pairs;
}
```

#### 5. Verification Swarm Integration (swarm.ts)

```typescript
// Security scanner uses current vulnerability databases
async runSecurityScan(code: string): Promise<SecurityResult> {
  const knowledgeService = getKnowledgeCurrencyService();

  // Get current security knowledge
  const securityKnowledge = await knowledgeService.fetchKnowledge([
    'owasp-top-10-2024',
    'cve-database-current',
    'npm-advisories',
  ]);

  // Use current knowledge in security analysis
  const prompt = `
    Analyze this code for security vulnerabilities.

    CURRENT SECURITY KNOWLEDGE:
    ${formatKnowledgeForSecurity(securityKnowledge)}

    CODE:
    ${code}
  `;

  // ... rest of security scanning ...
}
```

---

## PART 4: SPEED OPTIMIZATION STRATEGIES

### 1. Parallel Fetching
All knowledge sources fetched simultaneously using `Promise.allSettled()`.

### 2. Cache Pre-Warming
```typescript
// Warm cache for common topics on server start
const COMMON_TOPICS = [
  'react', 'next.js', 'typescript', 'tailwind',
  'stripe', 'supabase', 'clerk', 'vercel',
  'prisma', 'drizzle', 'zod',
];

async function warmCacheOnStartup(): Promise<void> {
  const knowledgeService = getKnowledgeCurrencyService();
  await knowledgeService.warmCache(COMMON_TOPICS);
}
```

### 3. Background Refresh
```typescript
// Refresh expiring knowledge in background
setInterval(async () => {
  const expiringTopics = await getTopicsExpiringWithin(15 * 60 * 1000); // 15 min
  for (const topic of expiringTopics) {
    await refreshKnowledge(topic);
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

### 4. Speculative Fetching
```typescript
// When user starts typing, speculatively fetch likely topics
onPromptChange(partialPrompt: string) {
  const likelyTopics = extractTopics(partialPrompt);
  // Fire and forget - cache will be warm when needed
  knowledgeService.warmCache(likelyTopics);
}
```

### 5. Request Coalescing
```typescript
// Multiple requests for same topic share single fetch
private pendingFetches = new Map<string, Promise<TopicKnowledge>>();

async fetchKnowledge(topic: string): Promise<TopicKnowledge> {
  if (this.pendingFetches.has(topic)) {
    return this.pendingFetches.get(topic)!;
  }

  const fetchPromise = this.doFetch(topic);
  this.pendingFetches.set(topic, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    this.pendingFetches.delete(topic);
  }
}
```

---

## PART 5: TOPIC-SPECIFIC KNOWLEDGE SOURCES

### Technology → Source Mapping

| Topic Category | Primary Sources | Refresh Interval |
|----------------|-----------------|------------------|
| **React Ecosystem** | React blog, GitHub releases, npm | 6 hours |
| **Next.js** | Vercel blog, GitHub, npm | 6 hours |
| **Stripe** | Stripe changelog, API docs | 12 hours |
| **Supabase** | Supabase blog, GitHub | 12 hours |
| **Auth (Clerk, Auth0)** | Official changelogs | 24 hours |
| **ORMs (Prisma, Drizzle)** | GitHub releases, npm | 12 hours |
| **AI APIs (OpenAI, Anthropic)** | API changelogs | 6 hours |
| **Security (OWASP)** | OWASP feeds, CVE database | 24 hours |
| **Cloud (AWS, GCP, Vercel)** | Service changelogs | 24 hours |

### Example Knowledge Entry (Stripe)

```json
{
  "topic": "stripe",
  "currentVersion": "2024-12-18",
  "latestChanges": [
    {
      "type": "NEW",
      "description": "Payment Intent confirmation now supports 3DS2 by default",
      "date": "2024-12-15"
    },
    {
      "type": "CHANGE",
      "description": "Webhook signatures now use SHA-512",
      "date": "2024-12-01"
    }
  ],
  "deprecations": [
    {
      "what": "/v1/charges endpoint",
      "useInstead": "PaymentIntent.create()",
      "deadline": "2025-06-01"
    }
  ],
  "bestPractices": [
    "Always use PaymentIntent for new integrations",
    "Implement idempotency keys for all POST requests",
    "Use webhooks for async payment confirmation"
  ],
  "codeExamples": [
    {
      "title": "Create PaymentIntent (Current)",
      "code": "const paymentIntent = await stripe.paymentIntents.create({\n  amount: 1000,\n  currency: 'usd',\n  automatic_payment_methods: { enabled: true },\n});"
    }
  ],
  "officialDocs": "https://stripe.com/docs/api",
  "fetchedAt": "2026-01-08T10:30:00Z"
}
```

---

## PART 6: IMPLEMENTATION ORDER

### Phase 1: Foundation (Week 1)
1. Create `knowledge-currency-service.ts`
2. Create `topic-extractor.ts`
3. Create `knowledge-cache.ts`
4. Add database schema for knowledge storage
5. Basic WebSearch integration

### Phase 2: Integration (Week 2)
1. Integrate with `unified-context.ts` (Section 15)
2. Integrate with `krip-toe-nite/facade.ts`
3. Integrate with `build-loop.ts`
4. Add cache pre-warming

### Phase 3: Optimization (Week 3)
1. Parallel fetching implementation
2. Background refresh system
3. Request coalescing
4. Speculative fetching

### Phase 4: Training Pipeline (Week 4)
1. Integrate with `evolution-flywheel.ts`
2. Store knowledge with build traces
3. Include knowledge in training pairs
4. Add knowledge-aware pattern extraction

### Phase 5: Verification & Quality (Week 5)
1. Integrate with `swarm.ts`
2. Integrate with `security-scanner.ts`
3. Integrate with `code-quality.ts`
4. Add knowledge freshness monitoring

---

## PART 7: SUCCESS METRICS

### Quantitative Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Knowledge Cache Hit Rate | >85% | Cache tier where request was served |
| Knowledge Fetch Latency | <500ms | P95 for cache miss scenarios |
| API Correctness Rate | >95% | Code using current vs deprecated APIs |
| Training Data Quality | >90% | Knowledge-enriched pairs vs baseline |
| Build Success Rate | +10% | Before/after knowledge currency |

### Qualitative Metrics

- Generated code uses current API patterns (not deprecated)
- Security scans catch recent vulnerabilities
- Integrations use latest SDK methods
- Error messages reference current documentation

---

## PART 8: FALLBACK STRATEGIES

### When Knowledge Fetch Fails

1. **Use cached knowledge** (even if expired) - better than nothing
2. **Fall back to model knowledge** - with warning annotation
3. **Generate conservative code** - using well-known stable patterns
4. **Log failure for review** - track knowledge fetch reliability

```typescript
async function getKnowledgeWithFallback(topic: string): Promise<TopicKnowledge | null> {
  try {
    // Try fresh fetch
    return await fetchKnowledge(topic);
  } catch (error) {
    // Try expired cache
    const expired = await getCachedKnowledge(topic, { ignoreExpiry: true });
    if (expired) {
      console.warn(`[Knowledge] Using expired cache for ${topic}`);
      return { ...expired, isStale: true };
    }

    // Log failure
    console.error(`[Knowledge] Failed to fetch ${topic}:`, error);
    return null;
  }
}
```

---

## APPENDIX: FILE MODIFICATION SUMMARY

### New Files to Create

| File | Purpose | Lines (Est.) |
|------|---------|--------------|
| `services/knowledge/knowledge-currency-service.ts` | Main service | ~400 |
| `services/knowledge/topic-extractor.ts` | Topic extraction | ~150 |
| `services/knowledge/knowledge-cache.ts` | 3-tier caching | ~250 |
| `services/knowledge/knowledge-fetcher.ts` | Source fetching | ~300 |
| `services/knowledge/types.ts` | Type definitions | ~100 |
| `services/knowledge/index.ts` | Exports | ~20 |

### Existing Files to Modify

| File | Changes | Impact |
|------|---------|--------|
| `unified-context.ts` | Add Section 15 | Medium |
| `krip-toe-nite/facade.ts` | Inject knowledge | Low |
| `build-loop.ts` | Pre-warm cache | Low |
| `evolution-flywheel.ts` | Training integration | Medium |
| `swarm.ts` | Verification integration | Low |
| `schema.ts` | New table | Low |

### Total Estimated New Code
~1,200 lines of new implementation code

---

*This implementation plan provides the blueprint for comprehensive knowledge currency integration into KripTik AI. The system ensures all AI interactions use current information while maintaining speed through intelligent caching.*

*Created: 2026-01-08*
*Author: Claude (Analysis Session)*
