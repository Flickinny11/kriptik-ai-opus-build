# KripTik AI Builder View Fix Implementation Plan v3
## CRITICAL: Millisecond-Level Performance Architecture

**Created**: January 16, 2026
**Revised**: January 16, 2026 (Structured Prompts Format)
**Status**: Production-Ready Implementation Plan
**Total Prompts**: 42 Structured Prompts in 12 Phases
**Target Performance**: ~125ms TTFT (Time to First Token)

---

## MANDATORY INSTRUCTIONS FOR EVERY PHASE

```
⚠️ THE FOLLOWING RULES MUST BE FOLLOWED FOR EVERY PROMPT IN THIS PLAN:

**No placeholders shall be used in any implementation**
**No mock data shall be used in any implementation**
**No TODOs can be used in any implementation**
**All implementations must be for production only**

**Upon completing each phase, the build must compile without errors. Then, the phase
should be pushed to GitHub and verified that there are no conflicts to merge. Once
merged without conflicts and errors, you must monitor that the build deploys
successfully to Vercel for production without errors.**

**Auth must be analyzed prior to beginning and must be kept intact. Auth must be
validated to still be working and intact upon completion of each phase.**

**If errors are found during build, they must be resolved without removing any feature,
capability or enhancement. Resolving errors means FIXING the error, not removing
capability, design, feature, or enhancement. To fix errors, ultrathinking should be
used to determine the best way to make the fix, and then after the fix, it must be
verified to be resolved for production.**
```

---

## CRITICAL ARCHITECTURAL DECISION

### KripToeNite Must Be MERGED, Not Called Separately

**User Requirement**: Originally there were two "models" (KripToeNite vs MultiAgent Orchestration). The model selector was removed to offer ONE best-in-class experience. KripToeNite should NOT exist as a separate service - its enhancements must be **MERGED DIRECTLY INTO BuildLoopOrchestrator**.

**What This Means**:
1. ❌ DON'T call KripToeNite from BuildLoopOrchestrator
2. ✅ DO merge KripToeNite's dual-stream speculative execution INTO BuildLoopOrchestrator
3. ✅ DO deprecate/remove KripToeNite as a standalone service
4. ✅ EVERY NLP in Builder View automatically gets ALL enhancements

---

## EXECUTIVE SUMMARY

### Why 30 Seconds is UNACCEPTABLE

The current system takes 218,992ms (3.6 minutes) because:
1. `/plan/stream` uses DIRECT Claude service - no speculative execution at all
2. Token config mismatch DISABLES extended thinking entirely
3. Component 28's 8 learning services are BUILT but NOT CALLED
4. VL-JEPA semantic services are IMPLEMENTED but only used in Phase 5
5. Browser-in-Loop is IMPORTED but never instantiated
6. KripToeNite's dual-stream logic exists but is NEVER REACHED from Builder View

### What EXISTS and Must Be MERGED

| System | Status | Capability | Action Required |
|--------|--------|------------|-----------------|
| **KripToeNite Speculative** | ✅ IMPLEMENTED | ~125ms TTFT dual-stream | 🔀 MERGE into BuildLoopOrchestrator |
| **BuildLoop Speculative Cache** | ✅ Variables exist | Pre-build next features | 🔧 WIRE UP (different from dual-stream) |
| **VL-JEPA Services** | ✅ IMPLEMENTED | Semantic intent/satisfaction | 🔧 USE throughout all phases |
| **Component 28 (8 services)** | ✅ BUILT | Real-time learning | 🔧 CALL during builds |
| **Browser-in-Loop** | ✅ IMPLEMENTED | Visual verification | 🔧 INSTANTIATE |
| **BuildLoopOrchestrator** | ✅ 99% READY | 6-phase build | 🔧 USE (not bypass) |

---

## ARCHITECTURE: Unified Single-Path Flow

```
CURRENT (218,992ms - BROKEN):
┌──────────────────────────────────────────────────────────────────┐
│ User NLP → /plan/stream → Direct Claude Service → 218,992ms     │
│            (bypasses EVERYTHING including KripToeNite)           │
└──────────────────────────────────────────────────────────────────┘

TARGET (~125ms TTFT - UNIFIED):
┌──────────────────────────────────────────────────────────────────┐
│ User NLP in Builder View                                         │
│    ↓                                                             │
│ BuildLoopOrchestrator.start(prompt)  ← ONLY PATH, ALWAYS USED   │
│    ↓                                                             │
│ Phase 0 (Intent Lock) with MERGED Speculative Execution:         │
│    ├── Fast Model (Haiku) → IMMEDIATE stream ~125ms TTFT        │
│    ├── Smart Model (Opus) → Deep thinking in parallel            │
│    ├── Component 28 → Context priority, cross-build transfer     │
│    └── VL-JEPA → Semantic intent verification                    │
│                                                                  │
│ Phase 1-6: Full build with ALL enhancements baked in             │
│    ├── Speculative Pre-Building (cache next features)            │
│    ├── VL-JEPA Continuous Satisfaction Check                     │
│    ├── Browser-in-Loop Visual Verification                       │
│    └── Component 28 Real-Time Learning                           │
│                                                                  │
│ USER SEES: First token in ~125ms, unified best-in-class flow     │
│ NO MODEL SELECTOR: Just one path that's always optimal           │
└──────────────────────────────────────────────────────────────────┘
```

### Key Difference from v2 Plan:
- v2: "Call KripToeNite from /plan/stream"
- v3: "MERGE KripToeNite's logic INTO BuildLoopOrchestrator, then use orchestrator for everything"

---

## ABOUT HYPERTHINKING

**HyperThinking does NOT require a user command like "ultrathink".**

Unlike Claude's `ultrathink` command, HyperThinking in KripTik AI activates AUTOMATICALLY based on task complexity analysis:

| Complexity Score | Reasoning Strategy | Expected TTFT |
|-----------------|-------------------|---------------|
| < 0.5 | Fast speculative only | ~100ms |
| 0.5 - 0.7 | Speculative with validation | ~125ms |
| >= 0.7 | Full HyperThinking (ToT/MARS) | ~200ms+ |

The complexity analyzer examines:
- Token count and density
- Nested dependencies (API chains, state management)
- Domain-specific patterns (auth, payments, etc.)
- Historical success rates for similar prompts

**Result**: Users get the optimal reasoning depth automatically - simple tasks are lightning fast, complex tasks get deep thinking. No user intervention required.

---

# PHASE 0-A: MERGE SPECULATIVE EXECUTION INTO BUILDLOOPORCHESTRATOR

## Phase 0-A Overview
- **Prompts**: 9
- **Purpose**: Extract KripToeNite's speculative execution and MERGE it INTO BuildLoopOrchestrator
- **Critical**: This is the foundation for ms-level performance EVERYWHERE

---

### Prompt 0A.1: Extract and Merge Dual-Stream Logic from KripToeNite

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST (CRITICAL):
- server/src/services/ai/krip-toe-nite/executor.ts (lines 312-441 - executeSpeculative)
- server/src/services/automation/build-loop.ts (main orchestrator)
- server/src/services/ai/claude-service.ts

CONTEXT:
KripToeNite was originally a separate "model" option. The model selector was removed.
Now we need ONE unified path where BuildLoopOrchestrator ALWAYS uses speculative execution.
KripToeNite should NOT exist as a separate callable service - its logic must be MERGED.

TASK:
1. Create a new file: server/src/services/automation/speculative-executor.ts
   This extracts the dual-stream logic from KripToeNite and makes it reusable within BuildLoopOrchestrator.

IMPLEMENTATION:

// server/src/services/automation/speculative-executor.ts
/**
 * Speculative Executor - Merged from KripToeNite
 *
 * Provides ~125ms TTFT by running fast and smart models in parallel.
 * This is NOT a separate service - it's a capability built into BuildLoopOrchestrator.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { CLAUDE_MODELS } from '../ai/claude-service.js';

export interface SpeculativeConfig {
    fastModel: string;      // e.g., claude-3-5-haiku-20241022 or gpt-4o-mini
    smartModel: string;     // e.g., claude-opus-4-5-20251101
    enhanceThreshold: number; // When to append smart model's response (default: 0.3)
}

export interface SpeculativeChunk {
    type: 'text' | 'status' | 'enhancement_start' | 'done' | 'error';
    content: string;
    model: string;
    ttftMs?: number;
    isEnhancement?: boolean;
}

const DEFAULT_CONFIG: SpeculativeConfig = {
    fastModel: 'claude-3-5-haiku-20241022',
    smartModel: CLAUDE_MODELS.OPUS_4_5,
    enhanceThreshold: 0.3,
};

/**
 * Execute with speculative dual-stream strategy.
 * Fast model streams immediately (~125ms TTFT).
 * Smart model validates in parallel and enhances if needed.
 */
export async function* executeSpeculative(
    prompt: string,
    systemPrompt: string,
    config: Partial<SpeculativeConfig> = {}
): AsyncGenerator<SpeculativeChunk> {
    const { fastModel, smartModel, enhanceThreshold } = { ...DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    let ttftMs: number | undefined;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Start BOTH models simultaneously
    const fastPromise = collectFullResponse(anthropic, prompt, systemPrompt, fastModel);
    const smartPromise = collectFullResponse(anthropic, prompt, systemPrompt, smartModel);

    // Stream fast model immediately for ~125ms TTFT
    let fastResponse = '';

    try {
        const fastStream = anthropic.messages.stream({
            model: fastModel,
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
        });

        for await (const event of fastStream) {
            if (event.type === 'content_block_delta' && 'delta' in event) {
                const delta = event.delta as { type: string; text?: string };
                if (delta.type === 'text_delta' && delta.text) {
                    // Track TTFT
                    if (!ttftMs) {
                        ttftMs = Date.now() - startTime;
                        yield {
                            type: 'status',
                            content: `First token in ${ttftMs}ms`,
                            model: fastModel,
                            ttftMs,
                        };
                    }

                    fastResponse += delta.text;
                    yield {
                        type: 'text',
                        content: delta.text,
                        model: fastModel,
                    };
                }
            }
        }
    } catch (error) {
        // Fast model failed - wait for smart model
        yield {
            type: 'status',
            content: 'Fast model failed, using smart model',
            model: smartModel,
        };

        const smartResult = await smartPromise;
        yield { type: 'text', content: smartResult, model: smartModel };
        yield { type: 'done', content: '', model: smartModel };
        return;
    }

    // Wait for smart model to complete
    const smartResponse = await smartPromise;

    // Decide if enhancement is needed
    if (shouldEnhance(fastResponse, smartResponse, enhanceThreshold)) {
        yield {
            type: 'enhancement_start',
            content: '\n\n---\nEnhanced response:\n',
            model: smartModel,
            isEnhancement: true,
        };

        yield {
            type: 'text',
            content: smartResponse,
            model: smartModel,
            isEnhancement: true,
        };
    } else {
        yield {
            type: 'status',
            content: `Response validated by ${smartModel}`,
            model: smartModel,
        };
    }

    yield { type: 'done', content: '', model: fastModel, ttftMs };
}

async function collectFullResponse(
    client: Anthropic,
    prompt: string,
    systemPrompt: string,
    model: string
): Promise<string> {
    try {
        const response = await client.messages.create({
            model,
            max_tokens: 16000,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
        });

        return response.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map(block => block.text)
            .join('');
    } catch {
        return '';
    }
}

function shouldEnhance(fast: string, smart: string, threshold: number): boolean {
    if (!fast.trim()) return true;

    // Length difference check
    if (smart.length > fast.length * 1.5 && smart.length > fast.length + 500) {
        return true;
    }

    // Code completeness check
    const fastCodeBlocks = (fast.match(/```/g) || []).length / 2;
    const smartCodeBlocks = (smart.match(/```/g) || []).length / 2;
    if (smartCodeBlocks > fastCodeBlocks + 1) {
        return true;
    }

    return false;
}

2. This file will be imported by BuildLoopOrchestrator in the next prompt.

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0A.2: Integrate Speculative Execution into BuildLoopOrchestrator Phase 0

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/automation/speculative-executor.ts (just created)
- server/src/services/automation/build-loop.ts (Phase 0 Intent Lock section)

TASK:
Modify BuildLoopOrchestrator to use speculative execution for Phase 0 (Intent Lock).
This gives ~125ms TTFT for the initial planning response.

IMPLEMENTATION:

// In server/src/services/automation/build-loop.ts

// Add import at top
import { executeSpeculative, type SpeculativeChunk } from './speculative-executor.js';

// Find the executePhase0IntentLock method and modify it:

async executePhase0IntentLock(): Promise<void> {
    this.emit('phase_start', { phase: 'intent_lock', message: 'Creating Sacred Contract...' });
    const startTime = Date.now();

    // SPECULATIVE EXECUTION: Stream fast response immediately while smart model thinks deeply
    const systemPrompt = this.buildIntentLockSystemPrompt();
    const userPrompt = this.buildIntentLockUserPrompt(this.state.prompt);

    let fullResponse = '';
    let ttftMs: number | undefined;

    // Use speculative execution for ~125ms TTFT
    for await (const chunk of executeSpeculative(userPrompt, systemPrompt, {
        fastModel: 'claude-3-5-haiku-20241022',
        smartModel: CLAUDE_MODELS.OPUS_4_5,
    })) {
        switch (chunk.type) {
            case 'status':
                if (chunk.ttftMs) {
                    ttftMs = chunk.ttftMs;
                    this.emit('ttft', { ttftMs, message: `First token in ${ttftMs}ms` });
                }
                this.emit('status', { content: chunk.content });
                break;

            case 'text':
                fullResponse += chunk.content;
                this.emit('thinking', {
                    content: chunk.content,
                    phase: 'intent_lock',
                    isEnhancement: chunk.isEnhancement,
                });
                break;

            case 'enhancement_start':
                this.emit('enhancement_start', {
                    message: 'Smart model enhancing response...',
                });
                break;

            case 'done':
                break;
        }
    }

    // Parse the response into Deep Intent Contract
    const intentContract = this.parseIntentContract(fullResponse);

    // Store the contract
    this.state.deepIntentContract = intentContract;

    // Emit completion
    this.emit('intent_created', {
        contractId: intentContract.id,
        appType: intentContract.appType,
        appSoul: intentContract.appSoul,
        successCriteriaCount: intentContract.successCriteria?.length || 0,
        functionalChecklistCount: intentContract.functionalChecklist?.length || 0,
        integrationsCount: intentContract.integrations?.length || 0,
        ttftMs,
        totalTimeMs: Date.now() - startTime,
    });

    this.emit('phase_complete', { phase: 'intent_lock' });
}

private buildIntentLockSystemPrompt(): string {
    return `You are KripTik AI's Intent Engine creating a Sacred Contract.

Your task is to deeply understand the user's request and create a comprehensive Intent Contract that includes:

1. APP SOUL: The core purpose and essence of what the user wants
2. APP TYPE: Classification (web app, mobile, API, etc.)
3. TECHNICAL REQUIREMENTS: Frameworks, languages, integrations needed
4. SUCCESS CRITERIA: Specific, measurable outcomes that define success
5. FUNCTIONAL CHECKLIST: Every feature that must work
6. INTEGRATION REQUIREMENTS: External services, APIs, databases needed
7. RISKS AND MITIGATIONS: Potential issues and how to handle them

Be thorough. This contract is the foundation of the entire build.
Output in JSON format.`;
}

private buildIntentLockUserPrompt(prompt: string): string {
    return `Create a Deep Intent Contract for this request:

"${prompt}"

Analyze deeply. What does the user truly want? What would make them satisfied?
Include all implicit requirements they haven't explicitly stated but would expect.`;
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0A.3: Create speculativeGenerate() Utility Method for ALL Claude Calls

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/automation/build-loop.ts (all methods that call Claude)
- server/src/services/automation/speculative-executor.ts

TASK:
Create a utility method in BuildLoopOrchestrator that uses speculative execution for ALL Claude calls, not just Phase 0. This ensures ms-level TTFT throughout the entire build.

IMPLEMENTATION:

// In build-loop.ts, add this method:

/**
 * Execute any Claude call with speculative strategy for fast TTFT.
 * Uses fast model for immediate streaming, smart model validates in parallel.
 */
private async *speculativeGenerate(
    prompt: string,
    systemPrompt: string,
    options: {
        useSmartOnly?: boolean;  // For critical tasks, skip fast model
        emitThinking?: boolean;  // Emit thinking events to frontend
        context?: string;        // Additional context for logging
    } = {}
): AsyncGenerator<string> {
    const { useSmartOnly = false, emitThinking = true, context = 'generation' } = options;

    if (useSmartOnly) {
        // For critical tasks (like final code generation), use smart model only
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.OPUS_4_5,
            systemPrompt,
            maxTokens: 64000,
            thinkingBudget: 32000,
        });
        yield response;
        return;
    }

    // Use speculative execution for fast TTFT
    for await (const chunk of executeSpeculative(prompt, systemPrompt)) {
        if (chunk.type === 'text') {
            if (emitThinking) {
                this.emit('thinking', {
                    content: chunk.content,
                    context,
                    model: chunk.model,
                    isEnhancement: chunk.isEnhancement,
                });
            }
            yield chunk.content;
        }

        if (chunk.type === 'status' && chunk.ttftMs) {
            this.emit('ttft', { ttftMs: chunk.ttftMs, context });
        }
    }
}

// Also add a non-streaming version for internal calls:

/**
 * Speculative generate with full response (non-streaming).
 * Uses fast model for TTFT, smart model validates in parallel.
 */
private async speculativeGenerateFull(
    prompt: string,
    systemPrompt: string,
    options: {
        useSmartOnly?: boolean;
        context?: string;
        maxTokens?: number;
    } = {}
): Promise<string> {
    let result = '';
    for await (const chunk of this.speculativeGenerate(prompt, systemPrompt, {
        ...options,
        emitThinking: false,  // Don't emit for internal calls
    })) {
        result += chunk;
    }
    return result;
}

/**
 * Speculative generate structured output.
 * Smart model only for structured parsing reliability.
 */
private async speculativeGenerateStructured<T>(
    prompt: string,
    systemPrompt: string,
    schema: any
): Promise<T> {
    // Structured output needs smart model for reliability
    return await this.claudeService.generateStructured<T>(prompt, {
        model: CLAUDE_MODELS.OPUS_4_5,
        systemPrompt,
        maxTokens: 16000,
    });
}

// Example usage in feature building:
async buildFeature(feature: FeatureTask): Promise<FeatureResult> {
    const prompt = this.buildFeaturePrompt(feature);
    const systemPrompt = this.buildFeatureSystemPrompt(feature);

    let code = '';
    for await (const chunk of this.speculativeGenerate(prompt, systemPrompt, {
        context: `feature:${feature.name}`,
    })) {
        code += chunk;
    }

    return this.parseFeatureResult(code);
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0A.4: Deprecate KripToeNite as Standalone Service

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/ai/krip-toe-nite/ (entire directory)
- server/src/routes/krip-toe-nite.ts (if exists)

TASK:
KripToeNite's logic has been merged into BuildLoopOrchestrator. Now deprecate/remove it as a standalone service:

IMPLEMENTATION:

1. Mark the directory as deprecated by creating:
   server/src/services/ai/krip-toe-nite/DEPRECATED.md

Content:
# DEPRECATED: KripToeNite

**Status**: Deprecated as of January 2026
**Reason**: Logic merged into BuildLoopOrchestrator

The speculative execution, dual-stream, and routing logic from KripToeNite
has been merged directly into BuildLoopOrchestrator to provide a unified
single-path experience.

## What Was Merged
- executeSpeculative() -> speculative-executor.ts
- Dual-stream fast/smart model execution -> BuildLoopOrchestrator.speculativeGenerate()
- TTFT tracking -> Built into orchestrator events

## Do Not Use
- Do not import from this directory
- Do not call KripToeNite directly
- All NLP in Builder View goes through BuildLoopOrchestrator

## Future
This directory will be removed in a future release.

2. If server/src/routes/krip-toe-nite.ts exists, add deprecation comment at top:

/**
 * @deprecated KripToeNite routes are deprecated.
 * All functionality is now accessed through BuildLoopOrchestrator.
 * These routes will be removed in a future release.
 */

3. Search for and remove any UI components that reference KripToeNite model selection:
   - Search for "kriptoenite" (case-insensitive) in src/components/
   - Remove or update any model selectors that offered KripToeNite as an option
   - Ensure Builder View has NO model selection - just one unified best path

4. Update any imports in other files that import from krip-toe-nite:
   - Replace with imports from speculative-executor.ts or remove entirely

DO NOT delete the krip-toe-nite directory yet (keep for reference).

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0A.5: Add TTFT Telemetry to BuildLoopOrchestrator

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/automation/build-loop.ts

TASK:
Add TTFT telemetry directly into BuildLoopOrchestrator (not in a separate KripToeNite service):

IMPLEMENTATION:

// In build-loop.ts, add near the top with other properties:

// TTFT Telemetry
private ttftMetrics: Array<{
    timestamp: number;
    ttftMs: number;
    phase: string;
    context: string;
}> = [];

private readonly TARGET_TTFT_MS = 150;
private readonly CRITICAL_TTFT_MS = 500;

// Add method to record and monitor TTFT:
private recordTTFT(ttftMs: number, phase: string, context: string): void {
    this.ttftMetrics.push({
        timestamp: Date.now(),
        ttftMs,
        phase,
        context,
    });

    // Alert on regression
    if (ttftMs > this.CRITICAL_TTFT_MS) {
        console.error(`[BuildLoop CRITICAL] TTFT regression: ${ttftMs}ms in ${phase} (target: ${this.TARGET_TTFT_MS}ms)`);
        this.emit('ttft_critical', { ttftMs, phase, context });
    } else if (ttftMs > this.TARGET_TTFT_MS) {
        console.warn(`[BuildLoop WARN] TTFT above target: ${ttftMs}ms in ${phase}`);
    } else {
        console.log(`[BuildLoop] TTFT: ${ttftMs}ms in ${phase} ✓`);
    }

    // Keep only last 100 metrics per build
    if (this.ttftMetrics.length > 100) {
        this.ttftMetrics = this.ttftMetrics.slice(-100);
    }
}

// Add method to get telemetry:
getTTFTTelemetry(): {
    average: number;
    p50: number;
    p95: number;
    recent: typeof this.ttftMetrics;
} {
    if (this.ttftMetrics.length === 0) {
        return { average: 0, p50: 0, p95: 0, recent: [] };
    }

    const sorted = [...this.ttftMetrics].sort((a, b) => a.ttftMs - b.ttftMs);
    const average = sorted.reduce((sum, m) => sum + m.ttftMs, 0) / sorted.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)]?.ttftMs || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)]?.ttftMs || 0;

    return { average, p50, p95, recent: this.ttftMetrics.slice(-10) };
}

// Update the speculativeGenerate method to record TTFT:
if (chunk.type === 'status' && chunk.ttftMs) {
    this.recordTTFT(chunk.ttftMs, this.state.currentPhase, context);
    this.emit('ttft', { ttftMs: chunk.ttftMs, context });
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0A.6: Replace ALL claudeService.generate() Calls with Speculative Execution

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST (CRITICAL - grep results show 13+ locations):
- server/src/services/automation/build-loop.ts

PROBLEM:
There are 13+ places where claudeService.generate() is called DIRECTLY, bypassing speculative execution:

Line 1378: claudeService.generate() - Intent analysis
Line 3553: claudeService.generate() - Verification
Line 3866: claudeService.generate() - Anti-slop fix
Line 4123: claudeService.generateStructured() - Structured output
Line 4786: claudeService.generate() - Code generation
Line 4838: claudeService.generate() - Refinement
Line 5093: claudeService.generate() - Feature building
Line 5248: claudeService.generate() - Refinement prompt
Line 5314: claudeService.generate() - Code generation
Line 6102: claudeService.generate() - Gap closer fixes

ALL of these need speculative execution for ms-level TTFT throughout the ENTIRE build.

TASK:

1. For each of the 13+ locations, replace:

BEFORE (example - Line 3866 - anti-slop fix):
const fixedContent = await this.claudeService.generate(fixPrompt, {
    model: CLAUDE_MODELS.OPUS_4_5,
    maxTokens: 16000,
});

AFTER:
const fixedContent = await this.speculativeGenerateFull(
    fixPrompt,
    ANTI_SLOP_FIX_SYSTEM_PROMPT,
    { context: 'anti-slop-fix', maxTokens: 16000 }
);

2. Replace ALL instances:
   - claudeService.generate() → speculativeGenerateFull()
   - claudeService.generateStructured() → speculativeGenerateStructured()
   - Add appropriate context strings for telemetry

3. Add a lint rule comment at top of build-loop.ts:

/**
 * IMPORTANT: Do NOT call claudeService.generate() directly!
 * Always use speculativeGenerateFull() or speculativeGenerate()
 * for ms-level TTFT throughout the build.
 */

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Grep for remaining claudeService.generate() calls - should be none in this file
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0A.7: Integrate HyperThinking with Speculative Execution

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/hyper-thinking/orchestrator.ts (HyperThinkingOrchestrator)
- server/src/services/continuous-learning/hyper-thinking-integrator.ts
- server/src/services/automation/build-loop.ts (hyperThinkingIntegrator property)

CONTEXT:
HyperThinking is a sophisticated reasoning system that auto-activates based on complexity threshold (0.7).
It is NOT triggered by a user command like "ultrathink" - it automatically engages when tasks are complex.
However, HyperThinking currently makes its own direct AI calls without speculative execution.

TASK:

1. Update HyperThinkingOrchestrator to support speculative execution:

IMPLEMENTATION:

// In hyper-thinking/orchestrator.ts

import { executeSpeculative, type SpeculativeConfig } from '../../automation/speculative-executor.js';

export class HyperThinkingOrchestrator {
    private speculativeConfig: SpeculativeConfig = {
        fastModel: 'claude-3-5-haiku-20241022',
        smartModel: CLAUDE_MODELS.OPUS_4_5,
        enhanceThreshold: 0.3,
    };

    /**
     * Think with speculative execution for fast TTFT.
     * Auto-activates full hyper-thinking when complexity > threshold.
     */
    async *thinkSpeculative(
        input: HyperThinkingInput
    ): AsyncGenerator<{ type: string; content: string; ttftMs?: number }> {
        const analysis = await this.complexityAnalyzer.analyze(input.prompt, input.context);

        // Below complexity threshold: use speculative for speed
        if (analysis.complexity < this.config.complexityThreshold) {
            for await (const chunk of executeSpeculative(
                input.prompt,
                this.buildSystemPrompt(input),
                this.speculativeConfig
            )) {
                yield {
                    type: chunk.type,
                    content: chunk.content,
                    ttftMs: chunk.ttftMs,
                };
            }
            return;
        }

        // Above threshold: use full hyper-thinking with ToT/MARS
        // But still emit fast initial acknowledgment
        yield {
            type: 'status',
            content: `Complexity ${(analysis.complexity * 100).toFixed(0)}% - engaging deep reasoning...`,
        };

        // Run hyper-thinking (ToT, MARS, etc.)
        const result = await this.think(input);

        // Stream result
        yield {
            type: 'text',
            content: result.response,
        };

        yield {
            type: 'done',
            content: '',
        };
    }
}

2. Update BuildLoopOrchestrator to use speculative hyper-thinking:

// In build-loop.ts

// When complexity is detected, use hyper-thinking with speculative
private async handleComplexTask(task: string, context: any): Promise<string> {
    if (!this.hyperThinkingIntegrator) {
        // Fallback to regular speculative
        return await this.speculativeGenerateFull(task, context.systemPrompt, {});
    }

    let result = '';
    for await (const chunk of this.hyperThinkingIntegrator.thinkSpeculative({
        prompt: task,
        context,
    })) {
        if (chunk.type === 'text') {
            result += chunk.content;
        }
        if (chunk.ttftMs) {
            this.recordTTFT(chunk.ttftMs, 'hyper-thinking', task.substring(0, 50));
        }
    }
    return result;
}

3. Add documentation comment:

/**
 * HYPER-THINKING AUTO-ACTIVATION
 *
 * Unlike Claude's "ultrathink" command, HyperThinking activates AUTOMATICALLY
 * based on task complexity analysis:
 *
 * - Complexity < 0.7: Fast speculative execution (~125ms TTFT)
 * - Complexity >= 0.7: Full HyperThinking with Tree-of-Thought/MARS
 *
 * The complexity analyzer examines:
 * - Token count and density
 * - Nested dependencies
 * - Domain-specific patterns
 * - Historical success rates
 *
 * NO user command needed - system auto-selects optimal reasoning depth.
 */

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0A.8: Wire Learning Engine for Speed Improvement Over Time

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/continuous-learning/engine.ts (ContinuousLearningEngine)
- server/src/services/continuous-learning/auto-optimization.ts (AutoOptimizationSystem)
- server/src/services/learning/context-priority.ts (ContextPriorityService)

PROBLEM:
The learning engine exists but doesn't optimize for SPEED - it only tracks quality.
For the system to get FASTER over time, we need to:
1. Track TTFT and latency metrics in the learning feedback
2. Learn which prompts/contexts produce faster responses
3. Optimize context prioritization to reduce token count (faster)
4. Cache successful patterns for instant retrieval

TASK:

1. Add speed metrics to learning feedback:

IMPLEMENTATION:

// In continuous-learning/engine.ts

interface LearningFeedback {
    // Existing
    buildId: string;
    outcome: 'success' | 'failure';
    qualityScore: number;

    // NEW: Speed metrics
    ttftMs: number;
    totalLatencyMs: number;
    tokensUsed: number;
    contextTokens: number;
    modelUsed: string;
    wasSpeculative: boolean;
    speculativeHit: boolean;  // Did fast model response get used?
}

// Record speed alongside quality
async recordBuildFeedback(feedback: LearningFeedback): Promise<void> {
    // Track speed correlations
    await this.speedOptimizer.recordLatency({
        promptSignature: this.hashPrompt(feedback.prompt),
        contextSize: feedback.contextTokens,
        ttftMs: feedback.ttftMs,
        totalLatencyMs: feedback.totalLatencyMs,
        modelUsed: feedback.modelUsed,
    });

    // Learn context patterns that correlate with speed
    if (feedback.ttftMs < 150) {
        await this.contextPriority.recordFastContext({
            contextHash: this.hashContext(feedback.context),
            ttftMs: feedback.ttftMs,
        });
    }

    // Existing quality tracking...
}

2. Create speed optimization service:

// Create: server/src/services/continuous-learning/speed-optimizer.ts

export class SpeedOptimizer {
    private latencyPatterns: Map<string, {
        avgTtft: number;
        avgTotal: number;
        samples: number;
        optimalContextSize: number;
    }> = new Map();

    async recordLatency(data: LatencyData): Promise<void> {
        // Track patterns
        const existing = this.latencyPatterns.get(data.promptSignature) || {
            avgTtft: 0, avgTotal: 0, samples: 0, optimalContextSize: 0,
        };

        // Update running averages
        existing.avgTtft = (existing.avgTtft * existing.samples + data.ttftMs) / (existing.samples + 1);
        existing.avgTotal = (existing.avgTotal * existing.samples + data.totalLatencyMs) / (existing.samples + 1);
        existing.samples++;

        // Track context size that gave best speed
        if (data.ttftMs < existing.avgTtft) {
            existing.optimalContextSize = data.contextSize;
        }

        this.latencyPatterns.set(data.promptSignature, existing);
    }

    getOptimalContextSize(promptSignature: string): number | null {
        return this.latencyPatterns.get(promptSignature)?.optimalContextSize || null;
    }

    predictTTFT(promptSignature: string): number | null {
        return this.latencyPatterns.get(promptSignature)?.avgTtft || null;
    }
}

3. Wire speed optimizer into BuildLoopOrchestrator:

// In build-loop.ts

private speedOptimizer = new SpeedOptimizer();

// Before each generation, check for optimal context size
async prepareOptimizedContext(prompt: string, fullContext: any): Promise<any> {
    const signature = this.hashPrompt(prompt);
    const optimalSize = this.speedOptimizer.getOptimalContextSize(signature);

    if (optimalSize && this.getContextTokenCount(fullContext) > optimalSize * 1.5) {
        // Trim context to learned optimal size
        return this.trimContext(fullContext, optimalSize);
    }

    return fullContext;
}

// After each generation, record for learning
async recordGenerationSpeed(
    prompt: string,
    ttftMs: number,
    totalMs: number,
    contextTokens: number
): Promise<void> {
    await this.speedOptimizer.recordLatency({
        promptSignature: this.hashPrompt(prompt),
        ttftMs,
        totalLatencyMs: totalMs,
        contextSize: contextTokens,
        modelUsed: this.currentModel,
    });

    // Also send to continuous learning engine
    if (this.continuousLearningEngine) {
        await this.continuousLearningEngine.recordSpeedMetric({
            buildId: this.state.orchestrationRunId,
            ttftMs,
            totalMs,
            contextTokens,
        });
    }
}

4. The result: System gets FASTER over time by:
   - Learning optimal context sizes per prompt type
   - Caching successful fast patterns
   - Predicting which prompts need hyper-thinking vs speculative
   - Trimming unnecessary context that slows down responses

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0A.9: Wire VL-JEPA into Unified Pipeline for Quality Improvement Over Time

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/embeddings/semantic-intent-service.ts
- server/src/services/embeddings/semantic-satisfaction-service.ts
- server/src/services/embeddings/visual-understanding-service.ts
- server/src/services/continuous-learning/engine.ts

PROBLEM:
VL-JEPA services exist but don't feed back into the learning system.
For the system to get HIGHER QUALITY over time, VL-JEPA needs to:
1. Track which intent interpretations led to satisfied users
2. Learn semantic patterns that correlate with successful builds
3. Improve visual understanding based on anti-slop feedback
4. Create unified pipelines that combine speed + quality optimization

TASK:

1. Create VL-JEPA feedback loop into learning engine:

IMPLEMENTATION:

// Create: server/src/services/continuous-learning/vl-jepa-feedback.ts

import { getSemanticIntentService } from '../embeddings/semantic-intent-service.js';
import { getSemanticSatisfactionService } from '../embeddings/semantic-satisfaction-service.js';
import { getVisualUnderstandingService } from '../embeddings/visual-understanding-service.js';

export class VLJEPAFeedbackLoop {
    private semanticIntent = getSemanticIntentService();
    private semanticSatisfaction = getSemanticSatisfactionService();
    private visualUnderstanding = getVisualUnderstandingService();

    private successPatterns: Map<string, {
        intentEmbedding: number[];
        satisfactionScore: number;
        buildOutcome: 'success' | 'failure';
        ttftMs: number;
        samples: number;
    }> = new Map();

    /**
     * Record VL-JEPA metrics after each build for learning.
     */
    async recordBuildOutcome(data: {
        buildId: string;
        originalIntent: string;
        intentAnalysis: any;
        satisfactionScore: number;
        visualVerificationPassed: boolean;
        ttftMs: number;
        outcome: 'success' | 'failure';
    }): Promise<void> {
        // Get intent embedding
        const intentEmbedding = await this.semanticIntent.getEmbedding(data.originalIntent);
        const intentSignature = this.hashEmbedding(intentEmbedding);

        // Update success patterns
        const existing = this.successPatterns.get(intentSignature) || {
            intentEmbedding,
            satisfactionScore: 0,
            buildOutcome: data.outcome,
            ttftMs: 0,
            samples: 0,
        };

        // Running averages
        existing.satisfactionScore = (
            existing.satisfactionScore * existing.samples + data.satisfactionScore
        ) / (existing.samples + 1);
        existing.ttftMs = (
            existing.ttftMs * existing.samples + data.ttftMs
        ) / (existing.samples + 1);
        existing.samples++;

        // Track success correlation
        if (data.outcome === 'success' && data.satisfactionScore > 0.85) {
            await this.reinforcePattern(intentSignature, data);
        }

        this.successPatterns.set(intentSignature, existing);
    }

    /**
     * Reinforce successful patterns for future builds.
     */
    private async reinforcePattern(signature: string, data: any): Promise<void> {
        // Store in semantic intent service for future similarity matching
        await this.semanticIntent.recordSuccessfulIntent({
            signature,
            prompt: data.originalIntent,
            analysis: data.intentAnalysis,
            satisfactionScore: data.satisfactionScore,
        });

        // Update visual understanding with anti-slop success
        if (data.visualVerificationPassed) {
            await this.visualUnderstanding.recordSuccessfulVerification({
                buildId: data.buildId,
                slopScore: 100, // Passed = no slop
            });
        }
    }

    /**
     * Get predicted satisfaction for a new intent based on similar past intents.
     */
    async predictSatisfaction(intent: string): Promise<{
        predictedScore: number;
        confidence: number;
        similarSuccessfulBuilds: number;
    }> {
        const embedding = await this.semanticIntent.getEmbedding(intent);

        // Find similar patterns
        let bestMatch = { score: 0, confidence: 0, count: 0 };

        for (const [sig, pattern] of this.successPatterns) {
            const similarity = this.cosineSimilarity(embedding, pattern.intentEmbedding);
            if (similarity > 0.8 && pattern.samples > 2) {
                bestMatch = {
                    score: pattern.satisfactionScore,
                    confidence: Math.min(similarity, pattern.samples / 10),
                    count: pattern.samples,
                };
            }
        }

        return {
            predictedScore: bestMatch.score,
            confidence: bestMatch.confidence,
            similarSuccessfulBuilds: bestMatch.count,
        };
    }

    /**
     * Create unified optimization pipeline combining speed + quality.
     */
    async getOptimizedConfig(intent: string): Promise<{
        useSpeculative: boolean;
        useHyperThinking: boolean;
        optimalContextSize: number;
        expectedTTFT: number;
        expectedSatisfaction: number;
    }> {
        const prediction = await this.predictSatisfaction(intent);
        const intentComplexity = await this.semanticIntent.analyzeComplexity(intent);

        return {
            // Use speculative for speed when we're confident
            useSpeculative: prediction.confidence > 0.6,
            // Use HyperThinking for complex intents
            useHyperThinking: intentComplexity.score > 0.7,
            // Learned optimal context size
            optimalContextSize: this.getLearnedContextSize(intentComplexity.category),
            // Expected performance
            expectedTTFT: this.getExpectedTTFT(intentComplexity.category),
            expectedSatisfaction: prediction.predictedScore,
        };
    }

    private hashEmbedding(embedding: number[]): string {
        // Simple hash for deduplication
        return embedding.slice(0, 10).map(v => Math.round(v * 100)).join('_');
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private getLearnedContextSize(category: string): number {
        // Default optimal sizes by category (will be refined by learning)
        const defaults: Record<string, number> = {
            'simple_crud': 4000,
            'api_integration': 8000,
            'full_stack_app': 16000,
            'complex_system': 32000,
        };
        return defaults[category] || 8000;
    }

    private getExpectedTTFT(category: string): number {
        // Expected TTFT by category with speculative execution
        const defaults: Record<string, number> = {
            'simple_crud': 100,
            'api_integration': 125,
            'full_stack_app': 150,
            'complex_system': 200,
        };
        return defaults[category] || 125;
    }
}

// Singleton
let vlJepaFeedback: VLJEPAFeedbackLoop | null = null;
export function getVLJEPAFeedbackLoop(): VLJEPAFeedbackLoop {
    if (!vlJepaFeedback) {
        vlJepaFeedback = new VLJEPAFeedbackLoop();
    }
    return vlJepaFeedback;
}

2. Wire into BuildLoopOrchestrator:

// In build-loop.ts

import { getVLJEPAFeedbackLoop } from '../continuous-learning/vl-jepa-feedback.js';

// Add to class properties
private vlJepaFeedback = getVLJEPAFeedbackLoop();

// In Phase 0 - use optimized config based on learned patterns:
async executePhase0IntentLock(): Promise<void> {
    // Get optimized config based on VL-JEPA learning
    const optimizedConfig = await this.vlJepaFeedback.getOptimizedConfig(this.state.prompt);

    this.emit('optimization_applied', {
        useSpeculative: optimizedConfig.useSpeculative,
        useHyperThinking: optimizedConfig.useHyperThinking,
        expectedTTFT: optimizedConfig.expectedTTFT,
        expectedSatisfaction: optimizedConfig.expectedSatisfaction,
    });

    // Apply optimized context size
    this.state.optimalContextSize = optimizedConfig.optimalContextSize;

    // Continue with speculative execution...
}

// At build completion - record for learning:
async onBuildComplete(result: BuildResult): Promise<void> {
    // Record VL-JEPA feedback for unified pipeline learning
    await this.vlJepaFeedback.recordBuildOutcome({
        buildId: this.state.orchestrationRunId,
        originalIntent: this.state.prompt,
        intentAnalysis: this.state.semanticAnalysis,
        satisfactionScore: result.satisfactionScore,
        visualVerificationPassed: result.visualVerificationPassed,
        ttftMs: this.state.ttftMetrics[0]?.ttftMs || 0,
        outcome: result.success ? 'success' : 'failure',
    });
}

3. The result: System improves BOTH speed AND quality over time by:
   - Learning which intent patterns lead to high satisfaction
   - Predicting satisfaction before build starts
   - Optimizing context size based on intent complexity
   - Reinforcing visual verification success patterns
   - Creating unified pipelines that balance speed + quality

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 0-B: ACTIVATE COMPONENT 28 LEARNING SERVICES

## Phase 0-B Overview
- **Prompts**: 4
- **Purpose**: Wire the 8 unused Component 28 learning services into BuildLoopOrchestrator

---

### Prompt 0B.1: Wire Direct-RLAIF into Build Phases

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/learning/direct-rlaif.ts (634 lines - FULLY IMPLEMENTED)
- server/src/services/automation/build-loop.ts (where it should be called)

PROBLEM:
DirectRLAIFService is fully implemented but NEVER CALLED during builds:
- recordBuildOutcome() exists but no code calls it
- rewardSignals are computed but never applied
- Model preferences are tracked but unused

TASK:
Wire DirectRLAIF into BuildLoopOrchestrator:

IMPLEMENTATION:

// In build-loop.ts constructor (around line 900)
import { getDirectRLAIFService } from '../learning/direct-rlaif.js';

// Add to class properties
private directRLAIF = getDirectRLAIFService();

// Wire into Phase 2 (Parallel Build) - after each feature completes
// Around line 2450, after agent completes:
await this.directRLAIF.recordBuildOutcome({
    buildId: this.state.orchestrationRunId,
    userId: this.state.userId,
    projectId: this.state.projectId,
    feature: agentResult.feature,
    outcome: agentResult.success ? 'success' : 'failure',
    codeQuality: agentResult.metrics?.codeQuality,
    userSatisfaction: null, // Will be filled later
    timestamp: Date.now(),
});

// Wire into Phase 5 (Intent Satisfaction) - overall build reward
// Around line 3800, after satisfaction check:
await this.directRLAIF.recordRewardSignal({
    buildId: this.state.orchestrationRunId,
    satisfactionScore,
    intentAlignment: this.calculateIntentAlignment(),
    codeQualityAvg: this.getAverageCodeQuality(),
    errorRate: this.state.errorCount / this.state.totalAttempts,
});

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0B.2: Wire Multi-Judge Service into Verification

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/learning/multi-judge.ts (525 lines - FULLY IMPLEMENTED)
- server/src/services/automation/build-loop.ts (verification swarm section)

PROBLEM:
MultiJudgeService provides multi-model consensus for quality scoring but is NEVER CALLED.
The Verification Swarm runs but doesn't use multi-judge consensus.

TASK:
Wire MultiJudge into the Verification Swarm:

IMPLEMENTATION:

// In build-loop.ts
import { getMultiJudgeService } from '../learning/multi-judge.js';

// Add to class properties
private multiJudge = getMultiJudgeService();

// Wire into verifyCode() method (around line 3300):
async verifyCode(code: string, context: VerificationContext): Promise<VerificationResult> {
    // Existing verification swarm logic...

    // Add multi-judge consensus
    const multiJudgeResult = await this.multiJudge.evaluateCode({
        code,
        context,
        criteria: ['correctness', 'style', 'security', 'performance'],
    });

    // Combine with existing verification
    return {
        ...existingResult,
        multiJudgeScore: multiJudgeResult.consensusScore,
        multiJudgeAnalysis: multiJudgeResult.analysis,
        confidence: (existingResult.confidence + multiJudgeResult.confidence) / 2,
    };
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0B.3: Wire Context Priority and Real-Time Learning

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/learning/context-priority.ts (FULLY IMPLEMENTED)
- server/src/services/learning/real-time-learning.ts (FULLY IMPLEMENTED)

PROBLEM:
These services exist but are NEVER CALLED:
- Context Priority: Learns which context is most relevant for different task types
- Real-Time Learning: Applies learned patterns immediately during builds

TASK:
Wire both services into BuildLoopOrchestrator's context preparation:

IMPLEMENTATION:

// In build-loop.ts
import { getContextPriorityService } from '../learning/context-priority.js';
import { getRealTimeLearningService } from '../learning/real-time-learning.js';

// Add to class properties
private contextPriority = getContextPriorityService();
private realTimeLearning = getRealTimeLearningService();

// Wire into prepareAgentContext() method (called before each agent):
async prepareAgentContext(agentType: string, task: FeatureTask): Promise<AgentContext> {
    // Get base context
    const baseContext = await this.buildBaseContext();

    // Apply learned context priorities
    const prioritizedContext = await this.contextPriority.prioritize({
        baseContext,
        taskType: task.type,
        agentType,
        projectId: this.state.projectId,
    });

    // Apply real-time learned patterns
    const enhancedContext = await this.realTimeLearning.enhance({
        context: prioritizedContext,
        recentPatterns: await this.realTimeLearning.getRecentPatterns(this.state.projectId),
        taskSignature: this.getTaskSignature(task),
    });

    return enhancedContext;
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0B.4: Wire Cross-Build Transfer Service

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/learning/cross-build-transfer.ts (FULLY IMPLEMENTED)

PROBLEM:
Cross-Build Transfer enables knowledge sharing between builds but is NEVER CALLED.
Each build starts from scratch instead of leveraging patterns from similar past builds.

TASK:
Wire Cross-Build Transfer into Phase 0 (Intent Lock) to bootstrap from similar builds:

IMPLEMENTATION:

// In build-loop.ts
import { getCrossBuildTransferService } from '../learning/cross-build-transfer.js';

// Add to class properties
private crossBuildTransfer = getCrossBuildTransferService();

// Wire into Phase 0 (Intent Lock) at the start:
async executePhase0IntentLock(): Promise<void> {
    // Find similar past builds
    const similarBuilds = await this.crossBuildTransfer.findSimilarBuilds({
        projectId: this.state.projectId,
        userId: this.state.userId,
        intentSignature: this.extractIntentSignature(this.state.prompt),
        limit: 5,
    });

    if (similarBuilds.length > 0) {
        this.emit('status', {
            message: `Found ${similarBuilds.length} similar past builds to learn from`
        });

        // Transfer knowledge from successful builds
        const transferredKnowledge = await this.crossBuildTransfer.transferKnowledge({
            sourceBuilds: similarBuilds.filter(b => b.success),
            targetBuildId: this.state.orchestrationRunId,
            transferTypes: ['patterns', 'solutions', 'anti-patterns'],
        });

        // Apply transferred knowledge to intent analysis
        this.state.transferredKnowledge = transferredKnowledge;
    }

    // Continue with normal Intent Lock...
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 0-C: INTEGRATE VL-JEPA THROUGHOUT ALL PHASES

## Phase 0-C Overview
- **Prompts**: 3
- **Purpose**: Wire VL-JEPA semantic services throughout the entire build, not just Phase 5

---

### Prompt 0C.1: Wire SemanticIntentService into Phase 0

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/embeddings/semantic-intent-service.ts (585 lines - FULLY IMPLEMENTED)
- server/src/services/automation/build-loop.ts (Phase 0 Intent Lock)

PROBLEM:
SemanticIntentService exists and works (0.85 alignment threshold) but is only partially used.
Should verify intent understanding BEFORE creating the Deep Intent Contract.

TASK:
Wire SemanticIntentService into Phase 0:

IMPLEMENTATION:

// In build-loop.ts
import { getSemanticIntentService } from '../embeddings/semantic-intent-service.js';

// Add to class properties
private semanticIntent = getSemanticIntentService();

// Wire into Phase 0 BEFORE creating Deep Intent Contract:
async executePhase0IntentLock(): Promise<void> {
    // Step 1: Semantic analysis of user intent
    const semanticAnalysis = await this.semanticIntent.analyzeIntent({
        prompt: this.state.prompt,
        projectContext: await this.getProjectContext(),
        previousIntents: await this.getPreviousIntents(this.state.userId),
    });

    // Check alignment threshold
    if (semanticAnalysis.confidence < 0.85) {
        this.emit('intent_clarification_needed', {
            confidence: semanticAnalysis.confidence,
            ambiguities: semanticAnalysis.ambiguities,
            suggestions: semanticAnalysis.clarificationQuestions,
        });
        // Could pause here for clarification, or proceed with caveats
    }

    // Step 2: Create Deep Intent Contract with semantic understanding
    const deepContract = await this.intentEngine.createDeepContract(
        this.state.prompt,
        this.state.userId,
        this.state.projectId,
        this.state.orchestrationRunId,
        {
            model: CLAUDE_MODELS.OPUS_4_5,
            effort: 'high',
            thinkingBudget: 64000,
            fetchAPIDocs: true,
            // NEW: Include semantic analysis
            semanticAnalysis,
        }
    );

    // Emit with semantic confidence
    this.emit('intent_created', {
        ...deepContract,
        semanticConfidence: semanticAnalysis.confidence,
    });
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0C.2: Wire SemanticSatisfactionService into All Verification Steps

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/embeddings/semantic-satisfaction-service.ts (732 lines - FULLY IMPLEMENTED)
- Current usage only in Phase 5

PROBLEM:
SemanticSatisfactionService (Success 40%, Workflows 30%, Code Quality 30%) only runs in Phase 5.
Should run CONTINUOUSLY throughout the build to catch drift early.

TASK:
Wire SemanticSatisfaction into verification at multiple checkpoints:

IMPLEMENTATION:

// In build-loop.ts
import { getSemanticSatisfactionService } from '../embeddings/semantic-satisfaction-service.js';

// Add to class properties
private semanticSatisfaction = getSemanticSatisfactionService();

// Create continuous satisfaction monitoring:
async checkSatisfactionDrift(): Promise<SatisfactionCheck> {
    const currentState = await this.getCurrentBuildState();

    return await this.semanticSatisfaction.checkAlignment({
        originalIntent: this.state.deepIntentContract,
        currentState,
        completedFeatures: this.state.completedFeatures,
        remainingFeatures: this.state.pendingFeatures,
    });
}

// Wire into Phase 2 - after each feature completes:
async onFeatureComplete(feature: string, result: FeatureResult): Promise<void> {
    // Existing logic...

    // Check for satisfaction drift
    const satisfactionCheck = await this.checkSatisfactionDrift();

    if (satisfactionCheck.driftScore > 0.15) {
        this.emit('satisfaction_drift_warning', {
            feature,
            driftScore: satisfactionCheck.driftScore,
            driftDetails: satisfactionCheck.analysis,
        });

        // Optionally trigger correction
        if (satisfactionCheck.driftScore > 0.30) {
            await this.triggerDriftCorrection(satisfactionCheck);
        }
    }
}

// Wire into Phase 3 (Integration Check):
async executePhase3IntegrationCheck(): Promise<void> {
    // Before merging, verify semantic satisfaction
    const preMergeSatisfaction = await this.semanticSatisfaction.evaluateIntegration({
        components: this.state.completedFeatures,
        intent: this.state.deepIntentContract,
    });

    if (preMergeSatisfaction.score < 0.70) {
        this.emit('integration_satisfaction_low', {
            score: preMergeSatisfaction.score,
            issues: preMergeSatisfaction.issues,
        });
        // Trigger gap closers
    }

    // Continue with integration...
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0C.3: Wire VisualUnderstandingService for Anti-Slop Detection

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/embeddings/visual-understanding-service.ts (665 lines - FULLY IMPLEMENTED)
- Uses Gemini 2.0 Flash for visual analysis

PROBLEM:
VisualUnderstandingService can detect anti-slop patterns in screenshots but isn't used
for continuous visual verification during builds.

TASK:
Wire VisualUnderstanding into Browser-in-Loop verification:

IMPLEMENTATION:

// In build-loop.ts
import { getVisualUnderstandingService } from '../embeddings/visual-understanding-service.js';

// Add to class properties
private visualUnderstanding = getVisualUnderstandingService();

// Create visual anti-slop check:
async performVisualAntiSlopCheck(screenshot: Buffer): Promise<VisualVerification> {
    const analysis = await this.visualUnderstanding.analyzeScreenshot({
        screenshot,
        checkFor: [
            'placeholder_text',      // Lorem ipsum, TODO, etc.
            'broken_images',         // Missing image placeholders
            'layout_issues',         // Overlapping elements, overflow
            'mock_data_indicators',  // "John Doe", "123 Main St"
            'error_displays',        // Error boundaries, stack traces
            'loading_stuck',         // Infinite spinners
            'ai_slop_patterns',      // Generic descriptions, repetitive patterns
        ],
        intent: this.state.deepIntentContract,
    });

    if (analysis.slopScore > 15) {  // 85 threshold = 15 slop tolerance
        this.emit('visual_slop_detected', {
            slopScore: analysis.slopScore,
            violations: analysis.violations,
            screenshot: screenshot.toString('base64'),
        });
    }

    return analysis;
}

// Wire into Phase 6 (Browser Demo):
async executePhase6BrowserDemo(): Promise<void> {
    // Launch browser
    const browser = await this.browserInLoop.launch();

    // Take screenshot
    const screenshot = await browser.screenshot();

    // Visual anti-slop check
    const visualCheck = await this.performVisualAntiSlopCheck(screenshot);

    if (visualCheck.slopScore > 15) {
        // Don't pass - trigger fixes
        await this.triggerVisualSlopFixes(visualCheck.violations);
    }

    // Continue with demo...
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 0-D: INSTANTIATE BROWSER-IN-LOOP

## Phase 0-D Overview
- **Prompts**: 2
- **Purpose**: Instantiate the Browser-in-Loop service that is imported but never created

---

### Prompt 0D.1: Instantiate BrowserInLoopService in Orchestrator

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/verification/browser-in-loop.ts (FULLY IMPLEMENTED)
- server/src/services/automation/build-loop.ts (imports but doesn't instantiate)

PROBLEM:
BrowserInLoopService is imported at the top of build-loop.ts but NEVER instantiated.
The class has all the methods but they're never called.

TASK:
Instantiate and wire BrowserInLoop into BuildLoopOrchestrator:

IMPLEMENTATION:

// In build-loop.ts constructor
import { BrowserInLoopService } from '../verification/browser-in-loop.js';

// Add to class properties (around line 850)
private browserInLoop: BrowserInLoopService | null = null;

// Initialize in constructor:
constructor(
    projectId: string,
    userId: string,
    orchestrationRunId: string,
    mode: BuildMode,
    options: BuildOptions = {}
) {
    // ... existing initialization

    // Initialize Browser-in-Loop if enabled (default: true for production)
    if (options.enableBrowserInLoop !== false) {
        this.browserInLoop = new BrowserInLoopService({
            projectId,
            headless: mode === 'production', // Headless in production
            viewport: { width: 1920, height: 1080 },
        });
        console.log('[BuildLoop] Browser-in-Loop initialized');
    }
}

// Wire into Phase 2 for continuous visual verification:
async executePhase2ParallelBuild(): Promise<void> {
    // Start dev server if not running
    await this.ensureDevServerRunning();

    // Initialize browser for continuous verification
    if (this.browserInLoop) {
        await this.browserInLoop.initialize();
        this.emit('browser_initialized', {
            message: 'Browser-in-Loop ready for visual verification'
        });
    }

    // ... parallel build logic

    // After each significant change, verify visually
    for (const feature of features) {
        await this.buildFeature(feature);

        if (this.browserInLoop && feature.hasVisualComponent) {
            const screenshot = await this.browserInLoop.captureScreenshot(feature.route);
            const verification = await this.browserInLoop.verifyVisual(screenshot, feature.expectedElements);

            if (!verification.passed) {
                this.emit('visual_verification_failed', {
                    feature: feature.name,
                    issues: verification.issues,
                });
            }
        }
    }
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 0D.2: Wire Browser-in-Loop for Anti-Pattern Detection

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/verification/browser-in-loop.ts (visual verification methods)

TASK:
Use Browser-in-Loop for DOM-based anti-slop detection:

IMPLEMENTATION:

// In build-loop.ts

// Wire into verification swarm (around line 3350):
async runVerificationSwarm(): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    // Existing 6 verification agents...

    // Add Browser-in-Loop visual verification (7th agent)
    if (this.browserInLoop) {
        const visualResult = await this.browserInLoop.runComprehensiveCheck({
            checks: [
                'placeholder_detection',
                'mock_data_detection',
                'error_boundary_check',
                'responsive_verification',
                'accessibility_basic',
                'performance_metrics',
            ],
            slopThreshold: 85,
        });

        results.push({
            agent: 'browser_visual',
            passed: visualResult.slopScore >= 85,
            score: visualResult.slopScore,
            details: visualResult,
        });

        // Emit violations for immediate fixing
        if (visualResult.violations.length > 0) {
            this.emit('browser_violations_detected', {
                violations: visualResult.violations,
                autoFixAvailable: visualResult.autoFixSuggestions,
            });
        }
    }

    return results;
}

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 1: UNIFIED ENDPOINT ARCHITECTURE

## Phase 1 Overview
- **Prompts**: 3
- **Purpose**: Create unified /orchestrator endpoints that replace /plan/stream

---

### Prompt 1.1: Create Unified /orchestrator/start Endpoint

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/routes/execute.ts
- server/src/services/automation/build-loop.ts

TASK:
Create a new endpoint that uses BuildLoopOrchestrator with merged speculative execution for ms-level response:

IMPLEMENTATION:

// In server/src/routes/execute.ts

import { BuildLoopOrchestrator } from '../services/automation/build-loop.js';
import { v4 as uuidv4 } from 'uuid';

// Store active orchestrators for resume
const activeOrchestrators = new Map<string, BuildLoopOrchestrator>();

router.post('/orchestrator/start', async (req: Request, res: Response) => {
    const { userId, projectId, prompt, mode = 'production' } = req.body;
    const orchestrationRunId = uuidv4();
    const startTime = Date.now();

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (type: string, data: any) => {
        res.write(`data: ${JSON.stringify({ type, ...data, timestamp: Date.now() })}\n\n`);
    };

    try {
        // Create orchestrator with ALL enhancements enabled
        const orchestrator = new BuildLoopOrchestrator(
            projectId,
            userId,
            orchestrationRunId,
            mode as BuildMode,
            {
                humanInTheLoop: false,
                enableBrowserInLoop: true,
                enableVLJEPA: true,
                enableComponent28: true,
            }
        );

        // Store for later resume
        activeOrchestrators.set(orchestrationRunId, orchestrator);

        // Forward all orchestrator events to SSE
        orchestrator.on('*', (event: BuildLoopEvent) => {
            sendEvent(event.type, event.data);
        });

        sendEvent('orchestrator_started', {
            orchestrationRunId,
            message: 'Build orchestrator initialized with speculative execution',
        });

        // Start orchestrator (will run Phase 0 then pause for credentials if needed)
        await orchestrator.start(prompt);

        sendEvent('orchestrator_ready', {
            orchestrationRunId,
            canResume: true,
            totalTimeMs: Date.now() - startTime,
        });

    } catch (error) {
        sendEvent('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
});

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 1.2: Create /orchestrator/resume Endpoint

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create the resume endpoint for after credentials are connected:

IMPLEMENTATION:

router.post('/orchestrator/resume', async (req: Request, res: Response) => {
    const { orchestrationRunId, credentials } = req.body;

    const orchestrator = activeOrchestrators.get(orchestrationRunId);
    if (!orchestrator) {
        return res.status(404).json({
            error: 'Orchestrator not found',
            hint: 'Start a new build with /orchestrator/start'
        });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (type: string, data: any) => {
        res.write(`data: ${JSON.stringify({ type, ...data, timestamp: Date.now() })}\n\n`);
    };

    try {
        // Provide credentials if supplied
        if (credentials) {
            orchestrator.provideCredentials(credentials);
            sendEvent('credentials_received', { count: Object.keys(credentials).length });
        }

        // Forward events
        orchestrator.on('*', (event: BuildLoopEvent) => {
            sendEvent(event.type, event.data);
        });

        // Resume build
        await orchestrator.resume();

        sendEvent('build_complete', {
            orchestrationRunId,
            message: 'Build completed successfully'
        });

    } catch (error) {
        sendEvent('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
        // Cleanup
        activeOrchestrators.delete(orchestrationRunId);
        res.end();
    }
});

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 1.3: Fix Token Configuration Globally

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/services/ai/claude-service.ts (lines 449-527, 695-760)

PROBLEM:
Token configuration mismatch causes extended thinking to be DISABLED.

TASK:
Create standardized token configuration:

IMPLEMENTATION:

// At top of claude-service.ts

const STANDARD_TOKEN_CONFIG = {
    maxTokens: 128000,          // Full Opus 4.5 capacity
    thinkingBudgetTokens: 64000, // Sacred 64K thinking
    minResponseTokens: 8192,    // Always leave room for response
};

function validateAndFixTokenConfig(
    maxTokens: number,
    thinkingBudget: number
): { maxTokens: number; thinkingBudget: number } {
    const minRequired = thinkingBudget + STANDARD_TOKEN_CONFIG.minResponseTokens;

    if (maxTokens < minRequired) {
        console.log(`[ClaudeService] Auto-fixing: max_tokens ${maxTokens} -> ${minRequired + 1024}`);
        maxTokens = minRequired + 1024;
    }

    return { maxTokens, thinkingBudget };
}

// Update generate() and generateStream() to use this validation
// REMOVE the code that DISABLES extended thinking (lines 515-517) and instead FIX the config

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 2: DATABASE MIGRATION FIX

## Phase 2 Overview
- **Prompts**: 2
- **Purpose**: Create missing database tables and add health checks

---

### Prompt 2.1: Create Migration for Missing Tables

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/schema.ts (credit_pool at line 2783, learning_context_priorities at line 4198)

TASK:
Create server/src/db/migrations/0001_add_missing_tables.sql with both tables.
Include all columns, foreign keys, defaults, and indexes as defined in schema.ts.
Use IF NOT EXISTS for idempotency.

VALIDATION:
- Run: npm run build
- Run migration script
- Verify tables exist in database
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 2.2: Add Database Health Check

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create GET /api/health/database endpoint that checks all critical tables and returns detailed status.

VALIDATION:
- Run: npm run build
- Test endpoint manually
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 3: NANGO INTEGRATION FIX

## Phase 3 Overview
- **Prompts**: 2
- **Purpose**: Fix Nango auth URL 404 and add configuration validation

---

### Prompt 3.1: Fix Nango Auth URL 404

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- server/src/routes/nango.ts (line 323)

TASK:
Update auth-url endpoint to return proper error with fallback to manual entry when Nango not configured.

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 3.2: Add Nango Configuration Validation

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create startup validation for Nango config with clear warnings if not configured.
Add GET /api/nango/config-status endpoint.

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 4: CREDENTIAL INPUT UX FIX

## Phase 4 Overview
- **Prompts**: 3
- **Purpose**: Fix credential input UX issues

---

### Prompt 4.1: Fix Missing Input Boxes After "Get API Key"

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- src/components/credentials/CredentialAcquisitionModal.tsx

TASK:
Ensure input fields are ALWAYS visible (not hidden after clicking "Get API Key").

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 4.2: Add Connect Buttons to Cloud Storage Tiles

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

READ FIRST:
- src/components/stack-selection/StackSelectionPanel.tsx

TASK:
Ensure S3, GCS, R2 tiles have proper connect/credentials UI.

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 4.3: Remove Developer-Facing Content

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Remove npm commands, .env templates, and internal variable names from user-facing UI.

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 5: FRONTEND FLOW CORRECTION

## Phase 5 Overview
- **Prompts**: 3
- **Purpose**: Implement correct frontend state machine and components

---

### Prompt 5.1: Implement Builder State Machine

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create state machine for correct flow:
nlp_input → intent_lock_generating → intent_lock_review → dependency_connection → build_running → build_complete

Wire to new /orchestrator/start and /orchestrator/resume endpoints.

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 5.2: Create Intent Lock Review Component

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create IntentLockPhase.tsx that displays Deep Intent Contract in human-readable format.

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 5.3: Create Dependency Connection Phase Component

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create DependencyConnectionPhase.tsx that shows required services and calls resume when connected.

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 6: IMPLEMENTATION PLAN UI

## Phase 6 Overview
- **Prompts**: 3
- **Purpose**: Create human-readable implementation plan display

---

### Prompt 6.1: Transform Contract to Human-Readable Plan

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create function to transform DeepIntentContract into ImplementationPlan structure.

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 6.2: Create Expandable Plan Component

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create ImplementationPlanPhase.tsx with expandable phases, tasks, and subtasks.

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 6.3: Add Plan Modification Interface

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create PlanModificationModal.tsx for requesting changes without starting over.

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 7: LIQUID GLASS STYLING

## Phase 7 Overview
- **Prompts**: 2
- **Purpose**: Apply premium liquid glass design system

---

### Prompt 7.1: Create Liquid Glass Design System

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create src/styles/liquid-glass.ts with premium glass panel effects, 3D shadows, animations.

VALIDATION:
- Run: npm run build
- Verify no TypeScript errors
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 7.2: Apply Styling to Builder View

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Apply LiquidGlass components to all Builder View phases.

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 8: STREAMING DISPLAY

## Phase 8 Overview
- **Prompts**: 2
- **Purpose**: Create streaming display components for real-time build progress

---

### Prompt 8.1: Create Streaming Display Component

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create StreamingDisplay.tsx that handles all 40+ orchestrator event types.

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 8.2: Add Build Progress Dashboard

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create BuildProgressDashboard.tsx showing phase, agents, files, verification results.

VALIDATION:
- Run: npm run build
- Test in browser
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# PHASE 9: INTEGRATION TESTING

## Phase 9 Overview
- **Prompts**: 2
- **Purpose**: Create integration tests and validation checklist

---

### Prompt 9.1: Create Integration Tests

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create server/src/tests/integration/builder-flow.test.ts testing full flow including ms-level TTFT.

VALIDATION:
- Run: npm run build
- Run tests
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

### Prompt 9.2: Create Validation Checklist

```
⚠️ MANDATORY RULES:
- No placeholders shall be used in any implementation
- No mock data shall be used in any implementation
- No TODOs can be used in any implementation
- All implementations must be for production only
- Auth must be analyzed prior to beginning and kept intact
- Build must compile without errors before proceeding
- Push to GitHub and verify no merge conflicts
- Monitor Vercel deployment for production success
- If errors occur, use ultrathinking to FIX (not remove features)

TASK:
Create docs/testing/builder-view-checklist.md with comprehensive manual testing steps.

VALIDATION:
- Run: npm run build
- Review checklist for completeness
- Verify auth is still intact
- Push to GitHub
- Verify Vercel deployment succeeds
```

---

# EXECUTION ORDER

```
PHASE 0-A: MERGE SPECULATIVE INTO ORCHESTRATOR ← CRITICAL - DO FIRST!
├── 0A.1: Extract dual-stream logic from KripToeNite into speculative-executor.ts
├── 0A.2: Integrate speculative execution into Phase 0 (Intent Lock)
├── 0A.3: Create speculativeGenerate() utility method
├── 0A.4: Deprecate KripToeNite as standalone service
├── 0A.5: Add TTFT telemetry to BuildLoopOrchestrator
├── 0A.6: Replace ALL 13+ claudeService.generate() calls with speculative
├── 0A.7: Integrate HyperThinking with speculative (auto-activates at complexity 0.7)
├── 0A.8: Wire Learning Engine for speed improvement over time (SpeedOptimizer)
└── 0A.9: Wire VL-JEPA into unified pipeline for quality improvement over time

PHASE 0-B: COMPONENT 28 ACTIVATION
├── 0B.1: Wire Direct-RLAIF
├── 0B.2: Wire Multi-Judge
├── 0B.3: Wire Context Priority + Real-Time Learning
└── 0B.4: Wire Cross-Build Transfer

PHASE 0-C: VL-JEPA INTEGRATION
├── 0C.1: Wire SemanticIntent into Phase 0
├── 0C.2: Wire SemanticSatisfaction continuously
└── 0C.3: Wire VisualUnderstanding for anti-slop

PHASE 0-D: BROWSER-IN-LOOP
├── 0D.1: Instantiate in orchestrator
└── 0D.2: Wire for anti-pattern detection

PHASE 1: UNIFIED ENDPOINT
├── 1.1: Create /orchestrator/start (replaces /plan/stream)
├── 1.2: Create /orchestrator/resume
└── 1.3: Fix token configuration

PHASE 2: DATABASE MIGRATION
├── 2.1: Create migration for missing tables
└── 2.2: Add database health check

PHASE 3: NANGO FIX
├── 3.1: Fix auth-url 404
└── 3.2: Add configuration validation

PHASE 4: CREDENTIAL UX
├── 4.1: Fix missing input boxes
├── 4.2: Add cloud storage buttons
└── 4.3: Remove developer content

PHASE 5: FRONTEND FLOW
├── 5.1: Implement builder state machine
├── 5.2: Create Intent Lock component
└── 5.3: Create Dependency Connection component

PHASE 6: PLAN UI
├── 6.1: Transform contract to human-readable plan
├── 6.2: Create expandable plan component
└── 6.3: Add modification interface

PHASE 7: LIQUID GLASS STYLING
├── 7.1: Create design system
└── 7.2: Apply to Builder View

PHASE 8: STREAMING DISPLAY
├── 8.1: Create streaming display component
└── 8.2: Add build progress dashboard

PHASE 9: INTEGRATION TESTING
├── 9.1: Create integration tests
└── 9.2: Create validation checklist
```

**Total: 42 Prompts across 12 Phases**

---

# SUCCESS CRITERIA

After implementing this plan:

| Metric | Before | After |
|--------|--------|-------|
| **TTFT (Time to First Token)** | 218,992ms (3.6 min) | ~125ms |
| **Component 28 Services Used** | 2/14 (14%) | 14/14 (100%) |
| **VL-JEPA Integration** | Phase 5 only | All phases |
| **Browser-in-Loop** | Not instantiated | Continuous verification |
| **Speculative Execution** | Exists in KripToeNite (unused) | MERGED into orchestrator (always used) |
| **Intent Satisfaction** | End only | Continuous drift detection |
| **KripToeNite** | Separate service | DEPRECATED (merged) |
| **Model Selector** | Previously existed | REMOVED (one best path) |
| **HyperThinking** | Exists but not wired | Auto-activates at complexity 0.7 |
| **Speed Learning** | No speed optimization | SpeedOptimizer tracks and improves TTFT |
| **VL-JEPA Feedback** | No learning loop | Unified pipeline improves quality over time |

### Performance Targets:
- TTFT: < 150ms (target ~125ms)
- Full plan generation: < 5 seconds
- Build completion: Depends on complexity, but no blocking bottlenecks
- Visual verification: < 500ms per check

### Quality Targets:
- Anti-slop score: >= 85/100
- Intent alignment: >= 0.85
- Zero placeholders in production output
- Zero mock data in production output
- All integrations functional

---

# KEY INSIGHT

**Everything needed for ms-level performance ALREADY EXISTS in the codebase.**

The problem is NOT missing features - it's that:
1. KripToeNite's speculative execution is NEVER REACHED from Builder View (separate service)
2. Component 28's 8 learning services are built but not called
3. VL-JEPA services only run in Phase 5
4. Browser-in-Loop is imported but never instantiated
5. BuildLoopOrchestrator is bypassed by the /plan/stream endpoint
6. HyperThinking exists but isn't integrated with speculative execution
7. Learning engine tracks quality but NOT speed

**The solution is to MERGE KripToeNite's capabilities INTO BuildLoopOrchestrator, then use the orchestrator for EVERYTHING.**

After this merge:
- Every NLP in Builder View goes through BuildLoopOrchestrator
- BuildLoopOrchestrator now has speculative execution built-in (~125ms TTFT)
- No model selector, no separate services - just ONE optimal path
- KripToeNite is deprecated and will be removed
- HyperThinking auto-activates at complexity 0.7 (no user command needed)
- SpeedOptimizer learns optimal context sizes for faster TTFT over time
- VL-JEPA feedback loop improves quality predictions over time
- System gets FASTER AND BETTER with every build
