# Knowledge Currency Implementation Plan

> **Problem**: AI models use stale knowledge (~1 year training cutoff). KripTik must ensure ALL AI interactions use current, accurate information about APIs, libraries, frameworks, and best practices.

> **Goal**: Implement comprehensive knowledge currency system that:
> 1. Affects ALL NLP inputs across ALL entry points
> 2. Caches data efficiently with 3-tier cache (memory → Redis → database)
> 3. **CROSS-USER COLLECTIVE LEARNING**: All learning benefits ALL users globally
> 4. Integrates with training pipeline for continuous improvement
> 5. Supports viral traffic scale with millisecond Redis KV transfers

**Created**: 2026-01-08
**Updated**: 2026-01-08 (Cross-User Architecture + Cursor 2.2 Prompts)
**Status**: Implementation Plan (Ready for Development)
**Format**: Cursor 2.2 Prompts for Opus 4.5

---

## CRITICAL: CROSS-USER COLLECTIVE LEARNING ARCHITECTURE

### The Vision

When users A, B, C enter 100 NLPs that improve KripTik's knowledge, patterns, and accuracy:
- User D (who logs in later) **immediately benefits** from ALL that learning
- Learning is **cumulative across ALL users** - not siloed per-user
- Real-time propagation via **Redis pubsub** (milliseconds, not seconds)
- Viral traffic scale ready - handles millions of concurrent users

### Current Architecture Analysis

**✅ ALREADY GLOBAL (Working for cross-user):**
- `learningPatterns` table → NO userId column (global)
- `learningStrategies` table → NO userId column (global)
- `PatternLibraryService` → Singleton, shared across all users
- `StrategyEvolutionService` → Singleton, shared across all users

**⚠️ USER-SCOPED but feeds GLOBAL (Correct design):**
- `ExperienceCaptureService` → Captures per-user traces → Extracts to global patterns
- Evolution cycles run per-user but output to global storage

**❌ GAP: ContextSyncService is BUILD-SCOPED (Not Global):**
```typescript
// Current: BUILD-SCOPED (only within one build)
static getInstance(buildId: string, projectId: string): ContextSyncService {
    const key = `${buildId}:${projectId}`;  // Scoped to single build
}
```

**Needed: GLOBAL cross-user knowledge propagation layer**

### Cross-User Architecture Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CROSS-USER COLLECTIVE LEARNING                          │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │   USER A         │  │   USER B         │  │   USER C         │          │
│  │   Build Session  │  │   Build Session  │  │   Build Session  │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│           ▼                     ▼                     ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  GLOBAL KNOWLEDGE PUBSUB (Redis)                     │   │
│  │                                                                      │   │
│  │  Channel: kriptik:knowledge:global                                   │   │
│  │  • New patterns discovered                                           │   │
│  │  • API version changes detected                                      │   │
│  │  • Best practices learned                                            │   │
│  │  • Error solutions found                                             │   │
│  │  • Security vulnerabilities identified                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                │                                            │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  GLOBAL KNOWLEDGE STORE                              │   │
│  │                                                                      │   │
│  │  Tier 1: Redis (milliseconds) - Hot knowledge, ALL users            │   │
│  │  Tier 2: Database (persistent) - All patterns, strategies, currency │   │
│  │                                                                      │   │
│  │  NO USER SCOPING - Everything is global                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                │                                            │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  ALL USERS BENEFIT IMMEDIATELY                       │   │
│  │                                                                      │   │
│  │  User D logs in → Gets ALL knowledge from A, B, C instantly          │   │
│  │  User E starts build → Has all patterns learned by everyone          │   │
│  │  User F makes query → Current API knowledge from all previous users  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## CURSOR 2.2 PROMPTS FOR OPUS 4.5

> **Instructions**: Execute these prompts in Cursor 2.2 using Agent mode with Claude Opus 4.5.
> Each prompt is self-contained and should be executed sequentially.
> After each prompt, verify the changes work before proceeding to the next.

---

### PROMPT 1: Create Global Knowledge Currency Service

**Model**: Claude Opus 4.5 (claude-opus-4-5-20251101)
**Mode**: Agent
**Estimated Time**: 15-20 minutes

```
@workspace

Create a new Knowledge Currency Service at `server/src/services/knowledge/knowledge-currency-service.ts` that:

## Requirements

1. **GLOBAL SERVICE** - Singleton pattern, shared across ALL users (not per-user, not per-build)

2. **Core Interface**:
   ```typescript
   interface KnowledgeCurrencyService {
     // Fetch knowledge for topics (with 3-tier cache)
     fetchKnowledge(topics: string[]): Promise<KnowledgeBundle>;

     // Extract technology topics from any NLP prompt
     extractTopics(prompt: string): string[];

     // Inject knowledge into unified context
     injectIntoContext(context: UnifiedContext, prompt: string): Promise<UnifiedContext>;

     // Global pubsub for cross-user learning
     publishKnowledge(topic: string, knowledge: TopicKnowledge): Promise<void>;
     subscribeToKnowledge(callback: (topic: string, knowledge: TopicKnowledge) => void): void;

     // Training pipeline integration
     storeForTraining(knowledge: KnowledgeBundle, buildId: string): Promise<void>;

     // Cache management
     warmCache(topics: string[]): Promise<void>;
     getGlobalStats(): Promise<KnowledgeStats>;
   }
   ```

3. **Topic Extraction Patterns** - Detect these technologies from NLP:
   - Frameworks: react, vue, angular, svelte, next.js, nuxt, remix, astro
   - Services: stripe, supabase, firebase, auth0, clerk, vercel, aws, openai, anthropic
   - Libraries: prisma, drizzle, zod, tailwind, shadcn, radix, framer-motion, three.js
   - Runtimes: typescript, node.js, deno, bun, python, rust
   - Patterns: oauth, jwt, websocket, graphql, rest, trpc

4. **3-Tier Cache** (use existing Redis from `services/infrastructure/redis.ts`):
   - Tier 1: Memory - 5 minute TTL (CacheTTL.MEDIUM from redis.ts)
   - Tier 2: Redis - 1 hour TTL (CacheTTL.LONG)
   - Tier 3: Database - 24 hour TTL (CacheTTL.DAY)

5. **Global Pubsub** (for cross-user learning):
   - Use Redis pubsub channel `kriptik:knowledge:global`
   - When ANY user discovers new knowledge, publish to ALL users
   - All active builds subscribe to channel and update their context

6. **WebSearch Integration**:
   - Use the existing WebSearch tool pattern
   - Generate date-aware queries: `${topic} latest changes January 2026`
   - Parse results into structured TopicKnowledge

## Types to Define

```typescript
interface TopicKnowledge {
  topic: string;
  currentVersion: string;
  latestChanges: { type: 'NEW' | 'CHANGE' | 'FIX'; description: string; date: string }[];
  deprecations: { what: string; useInstead: string; deadline?: string }[];
  bestPractices: string[];
  codeExamples: { title: string; code: string }[];
  officialDocs: string;
  fetchedAt: Date;
  confidence: number; // 0-1
  sources: string[];
}

interface KnowledgeBundle {
  topics: TopicKnowledge[];
  fetchedAt: Date;
  isGlobal: true; // Always true - this is cross-user
}

interface KnowledgeStats {
  totalTopics: number;
  cacheHitRate: number;
  lastGlobalUpdate: Date;
  activeSubscribers: number;
}
```

## Implementation Notes

- Use singleton pattern: `getKnowledgeCurrencyService(): KnowledgeCurrencyService`
- Import Redis from `../infrastructure/redis.js`
- All knowledge is GLOBAL - no userId anywhere
- On server start, warm cache with common topics
- Export from `services/knowledge/index.ts`

Create the complete implementation file. Make it production-ready with proper error handling and logging.
```

---

### PROMPT 2: Add Database Schema for Knowledge Currency

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 5 minutes

```
@workspace

Add a new table to `server/src/schema.ts` for storing knowledge currency:

## Schema to Add

```typescript
// Knowledge Currency Storage (GLOBAL - no userId)
export const knowledgeCurrency = sqliteTable('knowledge_currency', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  topic: text('topic').notNull().unique(),
  currentVersion: text('current_version'),
  latestChanges: text('latest_changes', { mode: 'json' }), // JSON array
  deprecations: text('deprecations', { mode: 'json' }), // JSON array
  bestPractices: text('best_practices', { mode: 'json' }), // JSON array
  codeExamples: text('code_examples', { mode: 'json' }), // JSON array
  officialDocs: text('official_docs'),
  sources: text('sources', { mode: 'json' }), // JSON array
  confidence: real('confidence').default(0.8),
  fetchedAt: text('fetched_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// Knowledge Usage Tracking (for training pipeline)
export const knowledgeUsage = sqliteTable('knowledge_usage', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  topicId: text('topic_id').notNull().references(() => knowledgeCurrency.id),
  buildId: text('build_id'),
  usedAt: text('used_at').default(sql`(datetime('now'))`).notNull(),
  buildSuccess: integer('build_success', { mode: 'boolean' }),
  // NO userId - this is GLOBAL cross-user learning
});
```

## Notes

- NO userId columns - this is intentionally global for cross-user learning
- Add indexes for topic and expiresAt for fast queries
- Place near the other learning tables (learningPatterns, learningStrategies)
```

---

### PROMPT 3: Integrate Knowledge Currency into Unified Context

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 10 minutes

```
@workspace

Modify `server/src/services/ai/unified-context.ts` to integrate knowledge currency:

## Changes Required

1. **Add knowledgeCurrency to UnifiedContext interface**:
   ```typescript
   export interface UnifiedContext {
     // ... existing 14 sections ...

     // NEW Section 15: External Knowledge Currency (GLOBAL - benefits ALL users)
     knowledgeCurrency: {
       topics: TopicKnowledge[];
       fetchedAt: string;
       sources: string[];
       isGlobal: true;
     } | null;
   }
   ```

2. **Modify loadUnifiedContext() function**:
   - Import `getKnowledgeCurrencyService` from `../knowledge/knowledge-currency-service.js`
   - Extract topics from the prompt parameter
   - Fetch knowledge in parallel with other context loading
   - Add to returned context

3. **Update formatUnifiedContextForCodeGen() function**:
   - Add section 15 formatting for knowledge currency
   - Format with clear headers like:
     ```
     ## CURRENT TECHNOLOGY KNOWLEDGE (As of 2026-01-08)
     ### React v19.1 (Latest)
     - New: Server Components default
     - Deprecated: Legacy context API
     ### Stripe API v2024-12
     - New: PaymentIntent v3
     - Deprecated: /v1/charges
     ```

## Key Implementation Details

```typescript
// In loadUnifiedContext():
let knowledgeCurrency = null;
if (options?.prompt) {
  const knowledgeService = getKnowledgeCurrencyService();
  const topics = knowledgeService.extractTopics(options.prompt);
  if (topics.length > 0) {
    // This pulls from GLOBAL cache - benefits ALL users
    knowledgeCurrency = await knowledgeService.fetchKnowledge(topics);
  }
}

// Formatting function
function formatKnowledgeCurrencySection(knowledge: KnowledgeBundle): string {
  const lines = [
    '## CURRENT TECHNOLOGY KNOWLEDGE (GLOBAL - Cross-User Learning)',
    `Last Updated: ${knowledge.fetchedAt}`,
    `Sources: ${knowledge.sources.length} verified sources`,
    '',
  ];

  for (const topic of knowledge.topics) {
    lines.push(`### ${topic.topic.toUpperCase()} v${topic.currentVersion || 'latest'}`);

    if (topic.latestChanges?.length) {
      lines.push('**Recent Changes:**');
      topic.latestChanges.slice(0, 5).forEach(c =>
        lines.push(`- ${c.type}: ${c.description}`)
      );
    }

    if (topic.deprecations?.length) {
      lines.push('**⚠️ Deprecations:**');
      topic.deprecations.forEach(d =>
        lines.push(`- ${d.what} → Use: ${d.useInstead}`)
      );
    }

    if (topic.bestPractices?.length) {
      lines.push('**Best Practices:**');
      topic.bestPractices.slice(0, 3).forEach(bp =>
        lines.push(`- ${bp}`)
      );
    }

    lines.push('');
  }

  return lines.join('\n');
}
```

Make these changes to unified-context.ts. Ensure backward compatibility with existing code that doesn't pass a prompt.
```

---

### PROMPT 4: Integrate Knowledge Currency into KripToeNite Facade

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 10 minutes

```
@workspace

Modify `server/src/services/ai/krip-toe-nite/facade.ts` to use knowledge currency:

## Requirements

1. **Import knowledge currency service**:
   ```typescript
   import { getKnowledgeCurrencyService } from '../../knowledge/knowledge-currency-service.js';
   ```

2. **Modify generate() method**:
   - Extract topics from prompt FIRST
   - Fetch knowledge in PARALLEL with context loading (for speed)
   - Inject knowledge into context before generation
   - Store knowledge usage for training pipeline

3. **Implementation Pattern**:
   ```typescript
   async generate(prompt: string, ctx: RequestContext): Promise<KTNResult> {
     const knowledgeService = getKnowledgeCurrencyService();

     // Extract topics immediately
     const topics = knowledgeService.extractTopics(prompt);

     // Fetch knowledge AND context in PARALLEL (speed optimization)
     const [context, knowledge] = await Promise.all([
       loadUnifiedContext(ctx.projectId, ctx.userId, ctx.projectPath || '', { prompt }),
       topics.length > 0 ? knowledgeService.fetchKnowledge(topics) : null,
     ]);

     // Inject knowledge into context (this is GLOBAL - benefits all users)
     if (knowledge) {
       context.knowledgeCurrency = knowledge;
     }

     // ... rest of generation logic uses knowledge-enhanced context ...

     // After successful generation, track usage for training
     if (knowledge && ctx.buildId) {
       await knowledgeService.storeForTraining(knowledge, ctx.buildId);
     }
   }
   ```

4. **Speed Consideration**:
   - Use `Promise.all` for parallel fetching
   - Knowledge comes from cache 85%+ of the time (milliseconds)
   - Only web search on cache miss

Make these changes to the facade. KripToeNite is the main entry point for most AI operations, so this integration affects ALL NLP inputs.
```

---

### PROMPT 5: Integrate Knowledge Currency into Build Loop

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 10 minutes

```
@workspace

Modify `server/src/services/automation/build-loop.ts` to use knowledge currency:

## Requirements

1. **Import knowledge currency service** at top of file

2. **Pre-warm cache at Phase 1 start**:
   - Extract topics from all features in the build
   - Pre-fetch knowledge for ALL detected topics
   - This ensures cache is hot for Phase 2 parallel building

3. **Subscribe to global knowledge updates**:
   - On orchestrator initialization, subscribe to global pubsub
   - When ANY user discovers new knowledge, update our build's context
   - This enables real-time cross-user learning

4. **Implementation Points**:

   ```typescript
   // In constructor or start():
   private async initializeKnowledgeCurrency(): Promise<void> {
     const knowledgeService = getKnowledgeCurrencyService();

     // Extract topics from all features
     const allTopics = new Set<string>();
     for (const feature of this.state.features) {
       const topics = knowledgeService.extractTopics(feature.description);
       topics.forEach(t => allTopics.add(t));
     }

     // Pre-warm cache for all detected topics
     if (allTopics.size > 0) {
       await knowledgeService.warmCache(Array.from(allTopics));
       this.log(`[Knowledge] Pre-warmed cache for ${allTopics.size} topics`);
     }

     // Subscribe to GLOBAL knowledge updates (cross-user learning)
     knowledgeService.subscribeToKnowledge((topic, knowledge) => {
       this.log(`[Knowledge] Global update received: ${topic}`);
       // Automatically available to our agents via unified context
     });
   }

   // Call in start() method
   await this.initializeKnowledgeCurrency();
   ```

5. **At each phase transition**:
   - Check if any new topics were mentioned in artifacts
   - Pre-warm cache for new topics

Make these changes to build-loop.ts. The build loop orchestrates 3-5 parallel agents, so knowledge currency must be available to ALL of them via shared context.
```

---

### PROMPT 6: Integrate Knowledge Currency into Feature Agent Service

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 10 minutes

```
@workspace

Modify `server/src/services/feature-agent/feature-agent-service.ts` to use knowledge currency:

## Requirements

1. **Import knowledge currency service**

2. **Initialize knowledge currency when agent deploys**:
   - Extract topics from feature prompt
   - Pre-fetch knowledge before implementation starts
   - Subscribe to global updates

3. **Share knowledge between parallel Feature Agents**:
   - If user deploys 6 Feature Agents, they all share knowledge
   - When one agent discovers something, others benefit immediately

4. **Implementation**:

   ```typescript
   async startImplementation(agentId: string): Promise<void> {
     const runtime = this.agents.get(agentId);
     if (!runtime) throw new Error('Agent not found');

     const knowledgeService = getKnowledgeCurrencyService();

     // Extract and fetch knowledge for this feature
     const topics = knowledgeService.extractTopics(runtime.prompt);
     if (topics.length > 0) {
       await knowledgeService.warmCache(topics);
       this.emit('knowledge_loaded', { agentId, topics });
     }

     // Subscribe to global updates (cross-user + cross-agent learning)
     knowledgeService.subscribeToKnowledge((topic, knowledge) => {
       // Emit to all active agents in this session
       for (const [id, agent] of this.agents) {
         if (agent.status === 'running') {
           this.emit('knowledge_update', { agentId: id, topic, knowledge });
         }
       }
     });

     // ... rest of implementation ...
   }
   ```

5. **Track knowledge usage for training**:
   - On successful feature completion, record which knowledge was used
   - This feeds into training pipeline for model improvement

Make these changes to feature-agent-service.ts. Feature agents can run in parallel (up to 6), so knowledge sharing is critical.
```

---

### PROMPT 7: Integrate Knowledge Currency into Evolution Flywheel (Training Pipeline)

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 15 minutes

```
@workspace

Modify `server/src/services/learning/evolution-flywheel.ts` to integrate knowledge currency into the training pipeline:

## Requirements

1. **Store knowledge alongside build traces**:
   - When capturing experiences, include which knowledge was used
   - This creates training pairs that include knowledge context

2. **Generate knowledge-enriched preference pairs**:
   - Training prompts should include the knowledge that was available
   - Model learns to use current knowledge effectively

3. **Feed back discovered patterns to knowledge currency**:
   - When pattern library learns new patterns, publish to global knowledge
   - Cross-user learning: patterns learned by user A benefit user B

4. **Implementation**:

   ```typescript
   // In collectTraces():
   async collectTraces(userId: string): Promise<BuildTrace[]> {
     const experienceCapture = new ExperienceCaptureService(userId);
     const traces = await experienceCapture.getRecentTraces();

     // Enrich traces with knowledge that was used
     const knowledgeService = getKnowledgeCurrencyService();
     for (const trace of traces) {
       const topics = knowledgeService.extractTopics(trace.originalPrompt);
       trace.knowledgeUsed = await knowledgeService.fetchKnowledge(topics);
     }

     return traces;
   }

   // In generatePreferencePairs():
   async generatePreferencePairs(traces: BuildTrace[]): Promise<PreferencePair[]> {
     const pairs: PreferencePair[] = [];

     for (const trace of traces) {
       // Include knowledge in training prompt
       const knowledgeContext = trace.knowledgeUsed
         ? formatKnowledgeForTraining(trace.knowledgeUsed)
         : '';

       pairs.push({
         prompt: `${trace.originalPrompt}\n\n${knowledgeContext}`,
         chosen: trace.successfulCode,
         rejected: trace.failedAttempts?.[0]?.code,
       });
     }

     return pairs;
   }

   // In extractPatterns():
   async extractPatterns(traces: BuildTrace[]): Promise<void> {
     const patternLibrary = getPatternLibrary();
     const knowledgeService = getKnowledgeCurrencyService();

     for (const trace of traces) {
       const patterns = await patternLibrary.extractFromTrace(trace);

       for (const pattern of patterns) {
         // Persist pattern (already GLOBAL via pattern library)
         await patternLibrary.persistPattern(pattern);

         // ALSO publish to knowledge pubsub for cross-user real-time sharing
         await knowledgeService.publishKnowledge(`pattern:${pattern.category}`, {
           topic: `learned-pattern:${pattern.name}`,
           currentVersion: '1.0',
           latestChanges: [{ type: 'NEW', description: pattern.description, date: new Date().toISOString() }],
           deprecations: [],
           bestPractices: [pattern.solution],
           codeExamples: pattern.codeExamples || [],
           officialDocs: '',
           fetchedAt: new Date(),
           confidence: pattern.confidence,
           sources: ['kriptik-learning-engine'],
         });
       }
     }
   }
   ```

5. **Global Knowledge Stats**:
   - Track how knowledge currency affects build success rate
   - Report in evolution cycle results

Make these changes to evolution-flywheel.ts. This is the core of the training pipeline - knowledge integration here ensures models learn to use current information.
```

---

### PROMPT 8: Integrate Knowledge Currency into Verification Swarm

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 10 minutes

```
@workspace

Modify `server/src/services/verification/swarm.ts` to use knowledge currency for up-to-date verification:

## Requirements

1. **Security Scanner uses current vulnerability knowledge**:
   - Fetch OWASP, CVE database info before scanning
   - Detect vulnerabilities discovered recently (not in model training data)

2. **Code Quality uses current best practices**:
   - Libraries change their recommended patterns
   - Use knowledge currency to check against current standards

3. **Implementation for Security Scanner**:

   ```typescript
   async runSecurityScan(code: string): Promise<SecurityResult> {
     const knowledgeService = getKnowledgeCurrencyService();

     // Fetch current security knowledge
     const securityKnowledge = await knowledgeService.fetchKnowledge([
       'owasp-top-10',
       'npm-security-advisories',
       'node-security',
     ]);

     // Include in security analysis prompt
     const prompt = `
       Analyze this code for security vulnerabilities.

       CURRENT SECURITY KNOWLEDGE (January 2026):
       ${formatSecurityKnowledge(securityKnowledge)}

       CODE TO ANALYZE:
       \`\`\`
       ${code}
       \`\`\`

       Check for:
       - Recent vulnerabilities in dependencies
       - Deprecated security patterns
       - Current best practices for auth, input validation, etc.
     `;

     // ... rest of security scanning ...
   }
   ```

4. **Implementation for Code Quality**:

   ```typescript
   async runCodeQualityCheck(code: string, framework: string): Promise<QualityResult> {
     const knowledgeService = getKnowledgeCurrencyService();

     // Fetch current best practices for detected framework
     const knowledge = await knowledgeService.fetchKnowledge([framework]);

     // Use current best practices in quality check
     const currentPractices = knowledge?.topics[0]?.bestPractices || [];

     // ... include in quality analysis prompt ...
   }
   ```

Make these changes to swarm.ts. The verification swarm runs continuously during builds, so it needs current knowledge to catch issues with deprecated patterns.
```

---

### PROMPT 9: Create Global Knowledge Pubsub Service

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 15 minutes

```
@workspace

Create `server/src/services/knowledge/global-knowledge-pubsub.ts` for cross-user real-time learning:

## Requirements

1. **Redis Pubsub for GLOBAL knowledge sharing**:
   - Channel: `kriptik:knowledge:global`
   - When ANY user's build discovers knowledge, publish
   - ALL active builds receive updates immediately

2. **Interface**:
   ```typescript
   interface GlobalKnowledgePubsub {
     // Publish new knowledge (available to ALL users instantly)
     publish(topic: string, knowledge: TopicKnowledge): Promise<void>;

     // Subscribe to global knowledge updates
     subscribe(callback: KnowledgeCallback): () => void; // Returns unsubscribe function

     // Get subscriber count (for stats)
     getSubscriberCount(): number;

     // Publish pattern discovered
     publishPattern(pattern: LearnedPattern): Promise<void>;

     // Publish API change detected
     publishAPIChange(topic: string, change: APIChange): Promise<void>;

     // Publish error solution found
     publishSolution(error: string, solution: string): Promise<void>;
   }
   ```

3. **Implementation using existing Redis**:
   ```typescript
   import { getRedis } from '../infrastructure/redis.js';

   class GlobalKnowledgePubsubService {
     private readonly CHANNEL = 'kriptik:knowledge:global';
     private subscribers: Set<KnowledgeCallback> = new Set();
     private redis: Redis;

     constructor() {
       this.redis = getRedis();
       this.startSubscriber();
     }

     private async startSubscriber(): Promise<void> {
       // Subscribe to Redis channel
       // Note: Upstash REST Redis doesn't support traditional pub/sub
       // Use polling or server-sent events pattern instead

       // For Upstash, use a polling approach with LPOP from a list
       setInterval(async () => {
         const message = await this.redis.lpop(`${this.CHANNEL}:queue`);
         if (message) {
           const { topic, knowledge } = JSON.parse(message);
           this.notifySubscribers(topic, knowledge);
         }
       }, 100); // 100ms polling - very fast
     }

     async publish(topic: string, knowledge: TopicKnowledge): Promise<void> {
       const message = JSON.stringify({ topic, knowledge, timestamp: Date.now() });

       // Push to queue for subscribers to receive
       await this.redis.rpush(`${this.CHANNEL}:queue`, message);

       // Also update the global cache
       await this.redis.set(`knowledge:${topic}`, JSON.stringify(knowledge), { ex: 3600 });

       console.log(`[GlobalKnowledge] Published: ${topic}`);
     }

     subscribe(callback: KnowledgeCallback): () => void {
       this.subscribers.add(callback);
       return () => this.subscribers.delete(callback);
     }

     private notifySubscribers(topic: string, knowledge: TopicKnowledge): void {
       for (const callback of this.subscribers) {
         try {
           callback(topic, knowledge);
         } catch (error) {
           console.error('[GlobalKnowledge] Subscriber error:', error);
         }
       }
     }
   }

   // Singleton
   let instance: GlobalKnowledgePubsubService | null = null;
   export function getGlobalKnowledgePubsub(): GlobalKnowledgePubsubService {
     if (!instance) {
       instance = new GlobalKnowledgePubsubService();
     }
     return instance;
   }
   ```

4. **Cross-User Learning Flow**:
   - User A's build discovers Stripe API changed → publish
   - User B's build (running in parallel) receives update
   - User B's context now includes Stripe change
   - User C's next request gets cached knowledge from A+B

Create the complete implementation. This is the core of cross-user real-time learning - ALL users benefit from ALL other users' discoveries instantly.
```

---

### PROMPT 10: Create Knowledge Currency Warming Service

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 10 minutes

```
@workspace

Create `server/src/services/knowledge/knowledge-warmer.ts` for proactive cache warming:

## Requirements

1. **Warm cache on server startup**:
   - Pre-fetch knowledge for most common technologies
   - Ensures first requests are cache hits (fast)

2. **Background refresh of expiring knowledge**:
   - Check for knowledge expiring in next 15 minutes
   - Refresh in background before expiry

3. **Speculative warming from NLP patterns**:
   - When user starts typing, extract likely topics
   - Pre-warm cache speculatively

4. **Common topics to warm**:
   ```typescript
   const COMMON_TOPICS = [
     // Frameworks
     'react', 'next.js', 'vue', 'nuxt', 'svelte', 'astro',
     // Backend
     'express', 'fastify', 'hono', 'node.js', 'bun', 'deno',
     // Databases
     'prisma', 'drizzle', 'supabase', 'turso', 'postgres', 'mongodb',
     // Auth
     'better-auth', 'clerk', 'auth0', 'next-auth',
     // Payments
     'stripe', 'lemonsqueezy', 'paddle',
     // AI
     'openai', 'anthropic', 'claude', 'gpt-4', 'replicate',
     // Styling
     'tailwind', 'shadcn', 'radix', 'framer-motion',
     // Validation
     'zod', 'yup', 'valibot',
     // Deployment
     'vercel', 'cloudflare', 'aws', 'railway',
   ];
   ```

5. **Implementation**:
   ```typescript
   class KnowledgeWarmerService {
     private knowledgeService: KnowledgeCurrencyService;
     private refreshInterval: NodeJS.Timer | null = null;

     async startWarming(): Promise<void> {
       // Initial warm on startup
       console.log('[KnowledgeWarmer] Starting initial cache warm...');
       await this.warmCommonTopics();

       // Background refresh every 5 minutes
       this.refreshInterval = setInterval(async () => {
         await this.refreshExpiring();
       }, 5 * 60 * 1000);
     }

     private async warmCommonTopics(): Promise<void> {
       // Warm in batches of 5 for speed
       for (let i = 0; i < COMMON_TOPICS.length; i += 5) {
         const batch = COMMON_TOPICS.slice(i, i + 5);
         await Promise.all(batch.map(t => this.knowledgeService.warmCache([t])));
       }
       console.log(`[KnowledgeWarmer] Warmed ${COMMON_TOPICS.length} topics`);
     }

     private async refreshExpiring(): Promise<void> {
       const expiring = await this.getTopicsExpiringWithin(15 * 60 * 1000);
       if (expiring.length > 0) {
         console.log(`[KnowledgeWarmer] Refreshing ${expiring.length} expiring topics`);
         await Promise.all(expiring.map(t => this.knowledgeService.warmCache([t])));
       }
     }

     // Called speculatively as user types
     async warmSpeculative(partialPrompt: string): Promise<void> {
       const topics = this.knowledgeService.extractTopics(partialPrompt);
       if (topics.length > 0) {
         // Fire and forget - cache will be ready when user submits
         this.knowledgeService.warmCache(topics).catch(() => {});
       }
     }
   }
   ```

Create the complete implementation. This ensures cache is always warm and requests are fast.
```

---

### PROMPT 11: Wire Knowledge Currency to All Entry Points

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 15 minutes

```
@workspace

Wire knowledge currency to ALL remaining entry points that make AI calls:

## Files to Modify

1. **`server/src/services/ai/intent-lock.ts`**:
   - Extract topics from user's NLP prompt
   - Include current technology knowledge in intent generation
   - Sacred Contract should reflect CURRENT capabilities, not stale ones

2. **`server/src/services/ai/coding-agent-wrapper.ts`**:
   - Inject knowledge into every coding call
   - Agents work with current API patterns

3. **`server/src/services/automation/worker-agent.ts`**:
   - Workers need current knowledge for accurate code generation

4. **`server/src/services/fix-my-app/orchestrator.ts`**:
   - Fix My App needs current knowledge to fix imported projects
   - Detect outdated patterns in imported code

5. **`server/src/services/provisioning/research-agent.ts`**:
   - Replace hardcoded SERVICE_KNOWLEDGE with live knowledge currency
   - This was identified as using stale static data

6. **`server/src/services/ai-lab/research-agent.ts`**:
   - Replace simulateWork() with real knowledge fetching
   - This was identified as completely fake

## Pattern for Each File

```typescript
// At start of AI operation:
const knowledgeService = getKnowledgeCurrencyService();
const topics = knowledgeService.extractTopics(prompt);
const knowledge = topics.length > 0
  ? await knowledgeService.fetchKnowledge(topics)
  : null;

// Inject into context or prompt:
const enrichedPrompt = knowledge
  ? `${prompt}\n\n${formatKnowledge(knowledge)}`
  : prompt;
```

## Special: Fix research-agent.ts Static Knowledge

The `SERVICE_KNOWLEDGE` constant in provisioning/research-agent.ts is completely static:
```typescript
const SERVICE_KNOWLEDGE = {
  stripe: { /* stale info */ },
  supabase: { /* stale info */ },
  // etc
};
```

Replace with:
```typescript
async function getServiceKnowledge(service: string): Promise<ServiceInfo> {
  const knowledgeService = getKnowledgeCurrencyService();
  const knowledge = await knowledgeService.fetchKnowledge([service]);
  return transformToServiceInfo(knowledge);
}
```

Make all these changes. After this, ALL 81 files making AI calls will have access to current knowledge.
```

---

### PROMPT 12: Add Knowledge Currency Stats Endpoint

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 10 minutes

```
@workspace

Add API endpoints for knowledge currency stats and management:

## Create `server/src/routes/knowledge.ts`

```typescript
import { Router } from 'express';
import { getKnowledgeCurrencyService } from '../services/knowledge/knowledge-currency-service.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Get global knowledge stats (no auth needed - public stats)
router.get('/stats', async (req, res) => {
  const knowledgeService = getKnowledgeCurrencyService();
  const stats = await knowledgeService.getGlobalStats();

  res.json({
    success: true,
    stats: {
      totalTopics: stats.totalTopics,
      cacheHitRate: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
      lastGlobalUpdate: stats.lastGlobalUpdate,
      activeSubscribers: stats.activeSubscribers,
      isGlobal: true, // Always true - cross-user learning
    },
  });
});

// Get knowledge for specific topics (for debugging/inspection)
router.get('/topics/:topic', async (req, res) => {
  const knowledgeService = getKnowledgeCurrencyService();
  const knowledge = await knowledgeService.fetchKnowledge([req.params.topic]);

  res.json({
    success: true,
    knowledge: knowledge?.topics[0] || null,
    isGlobal: true,
  });
});

// Manually trigger cache warm (admin only)
router.post('/warm', authMiddleware, async (req, res) => {
  const { topics } = req.body;
  const knowledgeService = getKnowledgeCurrencyService();

  await knowledgeService.warmCache(topics || []);

  res.json({
    success: true,
    message: `Warmed cache for ${topics?.length || 0} topics`,
  });
});

// Force refresh a topic (admin only)
router.post('/refresh/:topic', authMiddleware, async (req, res) => {
  const knowledgeService = getKnowledgeCurrencyService();

  // Clear cache and refetch
  await knowledgeService.invalidateCache(req.params.topic);
  const knowledge = await knowledgeService.fetchKnowledge([req.params.topic]);

  res.json({
    success: true,
    knowledge: knowledge?.topics[0] || null,
    refreshedAt: new Date().toISOString(),
  });
});

export default router;
```

## Register in server/src/index.ts or main routes file:

```typescript
import knowledgeRoutes from './routes/knowledge.js';
app.use('/api/knowledge', knowledgeRoutes);
```

Create these files. The stats endpoint lets us monitor knowledge currency effectiveness.
```

---

### PROMPT 13: Initialize Knowledge Currency on Server Start

**Model**: Claude Opus 4.5
**Mode**: Agent
**Estimated Time**: 5 minutes

```
@workspace

Modify server startup to initialize knowledge currency system:

## Find the main server file (likely `server/src/index.ts` or similar)

Add initialization:

```typescript
import { getKnowledgeCurrencyService } from './services/knowledge/knowledge-currency-service.js';
import { getKnowledgeWarmerService } from './services/knowledge/knowledge-warmer.js';
import { getGlobalKnowledgePubsub } from './services/knowledge/global-knowledge-pubsub.js';

// During server startup:
async function initializeKnowledgeCurrency(): Promise<void> {
  console.log('[Server] Initializing Knowledge Currency System...');

  // Initialize singleton services
  getKnowledgeCurrencyService();
  getGlobalKnowledgePubsub();

  // Start cache warming
  const warmer = getKnowledgeWarmerService();
  await warmer.startWarming();

  console.log('[Server] Knowledge Currency System ready (GLOBAL - benefits ALL users)');
}

// Call during startup
await initializeKnowledgeCurrency();
```

## Also add graceful shutdown:

```typescript
process.on('SIGTERM', async () => {
  // ... existing shutdown logic ...

  // Stop knowledge warmer
  const warmer = getKnowledgeWarmerService();
  warmer.stop();
});
```

Make these changes. This ensures knowledge currency is ready before handling any requests.
```

---

## PART 3: VERIFICATION CHECKLIST

After implementing all prompts, verify:

### Cross-User Learning
- [ ] Knowledge currency has NO userId - it's truly global
- [ ] Pattern library entries benefit ALL users
- [ ] Redis pubsub broadcasts to all active builds
- [ ] User A's discovery immediately helps User B's build

### All Entry Points Covered
- [ ] KripToeNite facade uses knowledge currency
- [ ] Build loop pre-warms cache and subscribes to updates
- [ ] Feature agent service shares knowledge between parallel agents
- [ ] Intent lock uses current technology knowledge
- [ ] Verification swarm uses current security knowledge
- [ ] Training pipeline captures knowledge usage

### Performance
- [ ] Cache hit rate > 85%
- [ ] Knowledge fetch < 500ms on cache miss
- [ ] Cache warming completes on server start
- [ ] Background refresh prevents cache expiry

### Training Integration
- [ ] Knowledge usage tracked in knowledge_usage table
- [ ] Preference pairs include knowledge context
- [ ] Patterns learned are published to global knowledge

---

## APPENDIX: Architecture Decisions

### Why Global (Not Per-User)?

1. **Learning Multiplier**: 1000 users = 1000x learning, not 1x isolated learning
2. **Viral Ready**: New users instantly benefit from all previous knowledge
3. **Cost Efficient**: One cache serves all users (not N caches)
4. **Pattern Library Already Global**: Maintaining consistency with existing design

### Why Redis Pubsub (Not Database Polling)?

1. **Speed**: Milliseconds vs seconds
2. **Real-time**: Updates propagate immediately
3. **Scalable**: Redis handles millions of pub/sub operations
4. **Existing Infrastructure**: Already using Redis for other features

### Why 3-Tier Cache?

1. **Memory (5 min)**: Ultra-fast for hot topics within single request
2. **Redis (1 hour)**: Shared across all server instances
3. **Database (24 hours)**: Survives server restarts, persistent knowledge

---

*This implementation plan provides Cursor 2.2 prompts for Opus 4.5 to implement comprehensive knowledge currency with cross-user collective learning into KripTik AI.*

*Created: 2026-01-08*
*Updated: 2026-01-08 (Cross-User Architecture + Cursor 2.2 Prompts)*
*Author: Claude (Analysis Session)*
