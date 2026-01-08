# Unified Learning Pipeline Implementation Plan

> **Goal**: Complete the "single pipeline" that funnels ALL learning from ALL systems into the code generator context injection.
>
> **Discovery**: The unified context system ALREADY EXISTS at `server/src/services/ai/unified-context.ts` and is being used by ALL code generation paths. However, there are critical gaps that need to be addressed.

---

## Executive Summary

### What Already Exists ✅

1. **UnifiedContext System** (`unified-context.ts` - 1,100 lines)
   - Loads 14 sections of context for ALL code generation
   - Learning patterns and strategies loaded **GLOBALLY** (no user filtering - shared across all users!)
   - `formatUnifiedContextForCodeGen()` injects everything into prompts

2. **All Code Gen Paths Use It**
   - `/api/execute` ✅
   - `/api/generate` ✅
   - `/api/feature-agent` ✅
   - `/api/orchestrate` ✅
   - KripToeNite facade ✅
   - `coding-agent-wrapper` ✅

3. **Global Learning DB Tables**
   - `learningPatterns` - Patterns shared across all users
   - `learningStrategies` - Strategies shared across all users
   - `learningJudgments` - Judge decisions (per-project but could be globalized)

### Critical Gaps to Fix ❌

| Gap | Severity | Impact |
|-----|----------|--------|
| Error Pattern Library IN-MEMORY ONLY | 🔴 CRITICAL | Learned error fixes lost on restart |
| Error Patterns not in UnifiedContext | 🔴 CRITICAL | Best fixes not injected into prompts |
| Shadow Model inference not captured | 🟡 MEDIUM | Specialized model outputs unused |
| Interaction patterns IN-MEMORY | 🟡 MEDIUM | User behavior patterns lost |

---

## PROMPT 1: Persist Error Pattern Library to Database

**Effort**: HIGH | **Impact**: CRITICAL | **LOC**: ~300

### Context

The `ErrorPatternLibraryService` at `server/src/services/automation/error-pattern-library.ts` has 20+ built-in patterns for instant error fixes (Level 0 escalation). It also has `learnPattern()` to learn from new errors. **BUT all learned patterns are stored in-memory and lost on restart.**

### Current Problem

```typescript
// error-pattern-library.ts
export class ErrorPatternLibraryService extends EventEmitter {
    private patterns: Map<string, ErrorPattern> = new Map();  // IN-MEMORY!

    learnPattern(errorMessage: string, ...): ErrorPattern {
        // Creates pattern but only adds to in-memory Map
        this.addPattern(pattern);  // NOT persisted to DB!
        return pattern;
    }
}
```

### Implementation Tasks

1. **Create `errorPatterns` table in schema.ts**

```typescript
// Add to server/src/schema.ts

export const errorPatterns = sqliteTable('error_patterns', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

    // Pattern identification
    patternId: text('pattern_id').notNull().unique(),  // e.g., "eslint_unused_var"
    name: text('name').notNull(),
    category: text('category').notNull(),  // 'syntax' | 'import' | 'type' | 'runtime' | 'build' | 'lint' | 'style'

    // Matching
    errorPattern: text('error_pattern').notNull(),  // Regex pattern
    filePattern: text('file_pattern'),  // Optional file pattern

    // Solution
    fixType: text('fix_type').notNull(),  // 'replace' | 'insert' | 'delete' | 'refactor' | 'multi_file'
    fixTemplate: text('fix_template').notNull(),  // Template with $1, $2 placeholders
    explanation: text('explanation').notNull(),

    // Confidence & tracking
    confidence: real('confidence').notNull().default(0.9),
    successCount: integer('success_count').notNull().default(0),
    failureCount: integer('failure_count').notNull().default(0),
    successRate: real('success_rate').notNull().default(1.0),

    // Metadata
    isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(false),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
    lastMatchedAt: text('last_matched_at'),
});
```

2. **Modify ErrorPatternLibraryService to use DB**

```typescript
// Modify server/src/services/automation/error-pattern-library.ts

import { db } from '../../db.js';
import { errorPatterns } from '../../schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';

export class ErrorPatternLibraryService extends EventEmitter {
    private cachedPatterns: Map<string, ErrorPattern> = new Map();  // Cache, not source of truth
    private lastCacheRefresh: Date = new Date(0);
    private readonly CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes

    constructor() {
        super();
        this.initializeBuiltInPatterns();
        this.loadPatternsFromDB();
    }

    // Load all active patterns from DB
    private async loadPatternsFromDB(): Promise<void> {
        try {
            const rows = await db.select()
                .from(errorPatterns)
                .where(eq(errorPatterns.isActive, true))
                .orderBy(desc(errorPatterns.successRate));

            this.cachedPatterns.clear();
            for (const row of rows) {
                this.cachedPatterns.set(row.patternId, this.mapRowToPattern(row));
            }

            this.lastCacheRefresh = new Date();
            console.log(`[ErrorPatternLibrary] Loaded ${this.cachedPatterns.size} patterns from DB`);
        } catch (error) {
            console.error('[ErrorPatternLibrary] Failed to load patterns from DB:', error);
        }
    }

    // Save a new learned pattern to DB
    async learnPattern(
        errorMessage: string,
        errorType: string,
        fix: PatternFix,
        context: { framework?: string; file?: string; stack?: string }
    ): Promise<ErrorPattern> {
        const patternId = `learned_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

        const pattern: ErrorPattern = {
            id: patternId,
            name: `Learned: ${errorType.substring(0, 50)}`,
            category: this.inferCategory(errorType, errorMessage),
            errorPattern: this.createRegexFromError(errorMessage),
            filePattern: context.file ? this.inferFilePattern(context.file) : undefined,
            fix,
            confidence: 0.7,  // Start lower for learned patterns
            metadata: {
                learnedFrom: errorMessage,
                framework: context.framework,
                learnedAt: new Date().toISOString(),
            },
        };

        // Persist to DB
        await db.insert(errorPatterns).values({
            patternId: pattern.id,
            name: pattern.name,
            category: pattern.category,
            errorPattern: pattern.errorPattern,
            filePattern: pattern.filePattern || null,
            fixType: pattern.fix.type,
            fixTemplate: pattern.fix.replacement,
            explanation: pattern.fix.explanation,
            confidence: pattern.confidence,
            isBuiltIn: false,
            isActive: true,
        });

        // Add to cache
        this.cachedPatterns.set(pattern.id, pattern);

        this.emit('pattern_learned', { patternId: pattern.id, category: pattern.category });
        return pattern;
    }

    // Update success/failure counts
    async recordMatch(patternId: string, success: boolean): Promise<void> {
        if (success) {
            await db.update(errorPatterns)
                .set({
                    successCount: sql`success_count + 1`,
                    successRate: sql`CAST(success_count + 1 AS REAL) / (success_count + failure_count + 1)`,
                    lastMatchedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(errorPatterns.patternId, patternId));
        } else {
            await db.update(errorPatterns)
                .set({
                    failureCount: sql`failure_count + 1`,
                    successRate: sql`CAST(success_count AS REAL) / (success_count + failure_count + 1)`,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(errorPatterns.patternId, patternId));
        }
    }

    // Deactivate patterns with low success rate
    async pruneFailingPatterns(minSuccessRate: number = 0.5): Promise<number> {
        const result = await db.update(errorPatterns)
            .set({ isActive: false, updatedAt: new Date().toISOString() })
            .where(and(
                eq(errorPatterns.isActive, true),
                eq(errorPatterns.isBuiltIn, false),
                gte(sql`failure_count`, 3),
                sql`success_rate < ${minSuccessRate}`
            ));

        await this.loadPatternsFromDB();  // Refresh cache
        return result.changes || 0;
    }

    // Get top patterns for injection into unified context
    async getTopPatterns(limit: number = 50): Promise<ErrorPattern[]> {
        if (this.shouldRefreshCache()) {
            await this.loadPatternsFromDB();
        }

        return Array.from(this.cachedPatterns.values())
            .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
            .slice(0, limit);
    }

    private shouldRefreshCache(): boolean {
        return Date.now() - this.lastCacheRefresh.getTime() > this.CACHE_TTL_MS;
    }
}
```

3. **Run migration to create table**

```bash
cd server
npx tsx src/run-migration.ts
```

### Verification

- [ ] `errorPatterns` table created in database
- [ ] Built-in patterns seeded on first startup
- [ ] `learnPattern()` persists to DB
- [ ] `recordMatch()` updates success/failure counts
- [ ] Patterns survive server restart
- [ ] Build passes: `npm run build`

---

## PROMPT 2: Add Error Patterns to Unified Context

**Effort**: MEDIUM | **Impact**: CRITICAL | **LOC**: ~100

### Context

Now that error patterns are persisted, we need to add them to the unified context so they're injected into ALL code generation prompts.

### Implementation Tasks

1. **Add to UnifiedContext interface**

```typescript
// In server/src/services/ai/unified-context.ts

// Add to interface
export interface UnifiedContext {
    // ... existing fields ...

    // NEW: Error patterns from library
    errorPatterns: Array<{
        name: string;
        category: string;
        errorPattern: string;
        fixType: string;
        fixTemplate: string;
        explanation: string;
        confidence: number;
        successRate: number;
    }>;
}
```

2. **Add loader function**

```typescript
// In server/src/services/ai/unified-context.ts

import { errorPatterns } from '../../schema.js';

async function loadErrorPatterns(context: UnifiedContext, limit: number = 30): Promise<void> {
    try {
        const patternRows = await db
            .select()
            .from(errorPatterns)
            .where(and(
                eq(errorPatterns.isActive, true),
                gte(errorPatterns.successRate, 0.6)  // Only high-success patterns
            ))
            .orderBy(desc(errorPatterns.successRate), desc(errorPatterns.successCount))
            .limit(limit);

        context.errorPatterns = patternRows.map(p => ({
            name: p.name,
            category: p.category,
            errorPattern: p.errorPattern,
            fixType: p.fixType,
            fixTemplate: p.fixTemplate,
            explanation: p.explanation,
            confidence: p.confidence,
            successRate: p.successRate,
        }));

        console.log(`[UnifiedContext] Loaded ${context.errorPatterns.length} error patterns`);
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load error patterns:', error);
        context.errorPatterns = [];
    }
}
```

3. **Call loader in loadUnifiedContext()**

```typescript
// In loadUnifiedContext() function, add:

await loadErrorPatterns(context, options.maxErrorPatterns || 30);
```

4. **Add to formatUnifiedContextForCodeGen()**

```typescript
// Add new section after anti-slop rules

// -------------------------------------------------------------------------
// SECTION 15: Error Patterns (Level 0 Instant Fixes)
// -------------------------------------------------------------------------
if (context.errorPatterns && context.errorPatterns.length > 0) {
    sections.push(`## 🔧 KNOWN ERROR PATTERNS (INSTANT FIXES)

These patterns have been learned from successful error fixes. Use them FIRST before attempting custom solutions.

${context.errorPatterns.map(p => `### ${p.name} (${p.category})
- **Pattern**: \`${p.errorPattern}\`
- **Fix Type**: ${p.fixType}
- **Template**: \`${p.fixTemplate}\`
- **Explanation**: ${p.explanation}
- **Success Rate**: ${(p.successRate * 100).toFixed(0)}%
`).join('\n')}
`);
}
```

### Verification

- [ ] `errorPatterns` field added to UnifiedContext interface
- [ ] `loadErrorPatterns()` function created
- [ ] Loader called in `loadUnifiedContext()`
- [ ] Section 15 added to `formatUnifiedContextForCodeGen()`
- [ ] Error patterns appear in code generation prompts
- [ ] Build passes: `npm run build`

---

## PROMPT 3: Shadow Model Inference Integration

**Effort**: HIGH | **Impact**: MEDIUM | **LOC**: ~200

### Context

The Shadow Model Registry (`server/src/services/learning/shadow-model-registry.ts`) tracks specialized models trained on KripTik data:
- `code_specialist` - Code generation and error fixing
- `architecture_specialist` - Architecture decisions
- `reasoning_specialist` - Complex reasoning
- `design_specialist` - Design decisions

Currently, shadow model outputs are NOT captured and injected into the unified context.

### Implementation Tasks

1. **Create `shadowModelInferences` table**

```typescript
// Add to server/src/schema.ts

export const shadowModelInferences = sqliteTable('shadow_model_inferences', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

    // Which model made the inference
    modelType: text('model_type').notNull(),  // 'code_specialist' | 'architecture_specialist' | etc.
    modelVersion: text('model_version').notNull(),

    // The inference
    domain: text('domain').notNull(),  // What area this applies to
    inputContext: text('input_context'),  // What was asked (truncated)
    inference: text('inference').notNull(),  // The model's recommendation
    confidence: real('confidence').notNull(),

    // Tracking
    wasUsed: integer('was_used', { mode: 'boolean' }).default(false),
    wasSuccessful: integer('was_successful', { mode: 'boolean' }),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});
```

2. **Add to UnifiedContext**

```typescript
// In unified-context.ts interface

shadowModelRecommendations: Array<{
    modelType: string;
    domain: string;
    recommendation: string;
    confidence: number;
}>;
```

3. **Add loader function**

```typescript
async function loadShadowModelRecommendations(
    context: UnifiedContext,
    limit: number = 10
): Promise<void> {
    try {
        // Get recent, high-confidence, successful inferences
        const inferenceRows = await db
            .select()
            .from(shadowModelInferences)
            .where(and(
                gte(shadowModelInferences.confidence, 0.7),
                or(
                    eq(shadowModelInferences.wasSuccessful, true),
                    isNull(shadowModelInferences.wasSuccessful)  // Include untested
                )
            ))
            .orderBy(desc(shadowModelInferences.createdAt))
            .limit(limit);

        context.shadowModelRecommendations = inferenceRows.map(i => ({
            modelType: i.modelType,
            domain: i.domain,
            recommendation: i.inference,
            confidence: i.confidence,
        }));
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load shadow model recommendations:', error);
        context.shadowModelRecommendations = [];
    }
}
```

4. **Add to format function**

```typescript
// Add new section

// -------------------------------------------------------------------------
// SECTION 16: Shadow Model Recommendations
// -------------------------------------------------------------------------
if (context.shadowModelRecommendations && context.shadowModelRecommendations.length > 0) {
    sections.push(`## 🤖 SHADOW MODEL RECOMMENDATIONS

These recommendations come from specialized models trained on successful KripTik builds:

${context.shadowModelRecommendations.map(r => `### ${r.modelType} on "${r.domain}"
${r.recommendation}
(Confidence: ${(r.confidence * 100).toFixed(0)}%)
`).join('\n')}
`);
}
```

### Verification

- [ ] `shadowModelInferences` table created
- [ ] Loader function implemented
- [ ] Section 16 added to format function
- [ ] Shadow model recommendations appear in prompts
- [ ] Build passes: `npm run build`

---

## PROMPT 4: Global Error Escalation History (Cross-User Learning)

**Effort**: MEDIUM | **Impact**: HIGH | **LOC**: ~100

### Context

Currently, `errorEscalationHistory` is queried per-project. We should also load GLOBAL successful fixes (from all projects) to benefit all users.

### Implementation Tasks

1. **Add `globalSuccessfulFixes` to UnifiedContext**

```typescript
// In interface
globalSuccessfulFixes: Array<{
    errorType: string;
    errorSignature: string;  // Anonymized error pattern
    fixApproach: string;
    successLevel: number;
    frequency: number;  // How often this fix worked
}>;
```

2. **Add global loader**

```typescript
async function loadGlobalSuccessfulFixes(context: UnifiedContext, limit: number = 20): Promise<void> {
    try {
        // Aggregate successful fixes across ALL projects (anonymized)
        const fixRows = await db
            .select({
                errorType: errorEscalationHistory.errorType,
                finalFix: errorEscalationHistory.finalFix,
                resolvedAtLevel: errorEscalationHistory.resolvedAtLevel,
                count: sql`count(*)`.as('count'),
            })
            .from(errorEscalationHistory)
            .where(and(
                eq(errorEscalationHistory.resolved, true),
                isNotNull(errorEscalationHistory.finalFix)
            ))
            .groupBy(errorEscalationHistory.errorType, errorEscalationHistory.finalFix)
            .orderBy(desc(sql`count(*)`))
            .limit(limit);

        context.globalSuccessfulFixes = fixRows.map(f => ({
            errorType: f.errorType,
            errorSignature: f.errorType,  // Could be improved to extract pattern
            fixApproach: f.finalFix!,
            successLevel: f.resolvedAtLevel || 1,
            frequency: Number(f.count),
        }));

        console.log(`[UnifiedContext] Loaded ${context.globalSuccessfulFixes.length} global fix patterns`);
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load global fixes:', error);
        context.globalSuccessfulFixes = [];
    }
}
```

3. **Add to format function**

```typescript
// -------------------------------------------------------------------------
// SECTION 17: Global Successful Fixes (Cross-User Learning)
// -------------------------------------------------------------------------
if (context.globalSuccessfulFixes && context.globalSuccessfulFixes.length > 0) {
    sections.push(`## 🌍 PROVEN FIXES (LEARNED FROM ALL USERS)

These fixes have worked successfully across multiple projects:

${context.globalSuccessfulFixes.map(f => `### ${f.errorType}
- **Fix Approach**: ${f.fixApproach.substring(0, 200)}...
- **Success Level**: L${f.successLevel}
- **Times Used**: ${f.frequency}
`).join('\n')}
`);
}
```

### Verification

- [ ] Global fixes loader implemented
- [ ] Section 17 added to format function
- [ ] Cross-user fixes appear in prompts
- [ ] Build passes: `npm run build`

---

## PROMPT 5: Complete Learning Pipeline Orchestration

**Effort**: MEDIUM | **Impact**: HIGH | **LOC**: ~150

### Context

Create a dedicated service that orchestrates the entire learning pipeline - ensuring ALL learning systems feed into the unified context.

### Implementation Tasks

1. **Create `learning-pipeline-orchestrator.ts`**

```typescript
// server/src/services/learning/learning-pipeline-orchestrator.ts

/**
 * Learning Pipeline Orchestrator
 *
 * Ensures ALL learning systems feed into the unified context:
 * 1. Experience Capture → Learning Patterns
 * 2. AI Judgment (RLAIF) → Quality Preferences
 * 3. Error Pattern Library → Instant Fixes
 * 4. Shadow Model Registry → Specialized Recommendations
 * 5. Strategy Evolution → Active Strategies
 *
 * This creates a SINGLE PIPELINE that is always referenced
 * when injecting context into code generation.
 */

import { EventEmitter } from 'events';
import { getErrorPatternLibrary } from '../automation/error-pattern-library.js';
import { getShadowModelRegistry } from './shadow-model-registry.js';
import { getEvolutionFlywheel } from './evolution-flywheel.js';
import { getPatternLibrary } from './pattern-library.js';
import { getStrategyEvolution } from './strategy-evolution.js';

export class LearningPipelineOrchestrator extends EventEmitter {
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialize all learning subsystems
        const errorPatternLib = getErrorPatternLibrary();
        const shadowRegistry = getShadowModelRegistry();
        const evolutionFlywheel = getEvolutionFlywheel();
        const patternLibrary = getPatternLibrary();
        const strategyEvolution = getStrategyEvolution();

        // Wire up events so learning flows into unified context
        errorPatternLib.on('pattern_learned', async ({ patternId, category }) => {
            console.log(`[LearningPipeline] New error pattern learned: ${patternId} (${category})`);
            // Pattern is already in DB, will be picked up by unified context loader
        });

        shadowRegistry.on('model_promoted', async ({ modelName, version }) => {
            console.log(`[LearningPipeline] Shadow model promoted: ${modelName} v${version}`);
            // Trigger inference capture for new model
        });

        evolutionFlywheel.on('cycle_completed', async ({ cycleId }) => {
            console.log(`[LearningPipeline] Evolution cycle completed: ${cycleId}`);
            // New patterns and strategies now in DB
        });

        this.initialized = true;
        console.log('[LearningPipeline] Orchestrator initialized - all learning systems connected');
    }

    // Get summary of all learning data available
    async getLearningPipelineStatus(): Promise<{
        errorPatterns: number;
        learnedPatterns: number;
        activeStrategies: number;
        shadowModels: number;
        totalLearningEvents: number;
    }> {
        const errorPatternLib = getErrorPatternLibrary();
        const shadowRegistry = getShadowModelRegistry();
        const evolutionFlywheel = getEvolutionFlywheel();

        const stats = await evolutionFlywheel.getSystemStats();
        const registryStats = await shadowRegistry.getRegistryStats();

        return {
            errorPatterns: (await errorPatternLib.getTopPatterns(1000)).length,
            learnedPatterns: stats.learningStats.totalPatterns,
            activeStrategies: stats.learningStats.activeStrategies,
            shadowModels: registryStats.activeModels,
            totalLearningEvents: stats.systemStats.totalExperiences,
        };
    }
}

// Singleton
let instance: LearningPipelineOrchestrator | null = null;

export function getLearningPipelineOrchestrator(): LearningPipelineOrchestrator {
    if (!instance) {
        instance = new LearningPipelineOrchestrator();
    }
    return instance;
}
```

2. **Initialize on server startup**

```typescript
// In server/src/index.ts, after DB init:

import { getLearningPipelineOrchestrator } from './services/learning/learning-pipeline-orchestrator.js';

// Initialize learning pipeline
const learningPipeline = getLearningPipelineOrchestrator();
await learningPipeline.initialize();
```

3. **Add API endpoint for status**

```typescript
// In routes/learning.ts

router.get('/pipeline-status', authMiddleware, async (req, res) => {
    const pipeline = getLearningPipelineOrchestrator();
    const status = await pipeline.getLearningPipelineStatus();
    res.json(status);
});
```

### Verification

- [ ] Pipeline orchestrator created
- [ ] Initialized on server startup
- [ ] All learning events connected
- [ ] Status endpoint working
- [ ] Build passes: `npm run build`

---

## Summary: The Complete Single Pipeline

After implementing all 5 prompts, the unified context will include:

| Section | Source | Scope |
|---------|--------|-------|
| 1. Intent Lock | DB | Per-project |
| 2. App Soul Template | Config | Per-app-type |
| 3. Anti-Slop Rules | Hardcoded | GLOBAL |
| 4. Build Phase Status | DB | Per-project |
| 5. Verification Results | DB | Per-project |
| 6. Tournament Results | DB | Per-project |
| 7. Error History | DB | Per-project |
| 8. Learned Patterns | DB | **GLOBAL** |
| 9. Active Strategies | DB | **GLOBAL** |
| 10. Project Analysis | DB | Per-project |
| 11. Project Rules | DB | Per-project |
| 12. User Preferences | DB | Per-user |
| 13. Judge Decisions | DB | Per-project |
| 14. Provider Hints | Hardcoded | GLOBAL |
| **15. Error Patterns** | DB (NEW!) | **GLOBAL** |
| **16. Shadow Model Recs** | DB (NEW!) | **GLOBAL** |
| **17. Global Fixes** | DB (NEW!) | **GLOBAL** |

**Total: 17 sections, 6 of which are GLOBAL cross-user learning!**

---

## Execution Order

1. **PROMPT 1**: Create `errorPatterns` table and persist Error Pattern Library
2. **PROMPT 2**: Add error patterns to unified context
3. **PROMPT 3**: Add shadow model inference tracking
4. **PROMPT 4**: Add global cross-user successful fixes
5. **PROMPT 5**: Create Learning Pipeline Orchestrator

Each prompt builds on the previous. Run them in order.

---

*Created: 2026-01-08*
*Purpose: Complete the single unified learning pipeline for KripTik AI*
