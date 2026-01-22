# KripTik AI Model Enhancement Implementation Plan
## January 2, 2026 - Comprehensive Analysis & NLP Implementation Prompts

> **PURPOSE**: This document provides NLP prompts ready for paste into Claude Code or Cursor 2.2 with Opus 4.5
> **AUTH PROTECTION**: All auth files are LOCKED per AUTH-IMMUTABLE-SPECIFICATION.md - DO NOT MODIFY
> **BUILD REQUIREMENT**: Run `npm run build` after each implementation to verify success

---

## EXECUTIVE SUMMARY

This analysis compares:
1. **KripTik AI's current architecture** (dual Anthropic + OpenAI SDKs)
2. **research.md capabilities** (47 advances across 10 domains)
3. **Latest OpenAI updates** (January 2026 - NOT NOT NOT using o3/o4-mini or anything from openai that is o3 and o4 series, but will websearch to find newer models as of today january 19, 2026., GPT-5.2-Codex, Responses API)
4. **Latest Anthropic updates** (January 2026 - effort parameter, extended thinking, interleaved thinking)

### What Already Exists in KripTik (No Action Needed)
| Capability | Location | Status |
|------------|----------|--------|
| Extended Thinking | `openrouter-client.ts` | ✅ Implemented (up to 64K budget) |
| Effort Parameter | `PHASE_CONFIGS` | ✅ Implemented (low/medium/high) |
| Context Editing (84% reduction) | `DEFAULT_CONTEXT_EDITS` | ✅ Implemented |
| Dual SDK Architecture | `openrouter-client.ts`, `model-router.ts` | ✅ Anthropic + OpenAI direct |
| Intent Lock (Sacred Contracts) | `intent-lock.ts` | ✅ Complete |
| 6-Phase Build Loop | `build-loop.ts` | ✅ Complete (3000+ lines) |
| Verification Swarm (6 agents) | `swarm.ts` | ✅ Complete |
| Error Escalation (4 levels) | `error-escalation.ts` | ✅ Complete |
| Learning Engine (5 layers) | `services/learning/*` | ✅ Complete |
| MCP Integration | `.mcp.json` | ✅ Configured |
| Browser-in-Loop | `browser-in-loop.ts` | ✅ Complete (706 lines) |
| Gap Closers (7 agents) | `services/verification/gap-closers/` | ✅ Complete |

### What Needs Enhancement/Implementation
| Priority | Enhancement | Source | Impact |
|----------|-------------|--------|--------|
| P0 | OpenAI Responses API | OpenAI Jan 2026 | % SWE-bench improvement, % cache savings |
| P0 | *NOT using o3/o4-mini Reasoning Effort, but instead will websearch to find the newest, most capable models from openai because we will NOT NOT NOT use o3 and o4 series of any kind | OpenAI Jan 2026 | xhigh effort for critical phases |
| P0 | Interleaved Thinking Beta | Anthropic Jan 2026 | Think between tool calls |
| P1 | Context Compaction | GPT-5.2-Codex | 24-hour coding sessions |
| P1 | Preserved Thinking Blocks | Claude Opus 4.5 | Maintain reasoning across turns |
| P1 | Deliberative Alignment | research.md | 8.7% → 0.3% problematic outputs |
| P2 | Graphiti/Zep Memory | research.md | 94.8% DMR benchmark |
| P2 | SAMEP Protocol | research.md | Secure context sharing |
| P2 | Tree of Clarifications | research.md | Prompt disambiguation |
| P3 | EAGLE-3 Inference | research.md | 3.6x speedup |
| P3 | A2A Protocol | research.md | Agent-to-agent coordination |

---

## PART 1: KRIPTIK AI ORCHESTRATION ANALYSIS

### Current Architecture Overview

**Two Distinct Modes**:

1. **Builder View (Full Apps from NLP)**
   - Entry: Dashboard → Project Card → Builder View OR Dashboard → Prompt Box
   - Purpose: Build COMPLETE applications from NLP
   - Orchestrator: `BuildLoopOrchestrator` (6-phase)
   - Model Selection: Kriptoenite (auto-selects optimal models)
   - Agents: Unlimited internally coordinated

2. **Feature Agent (Features for Existing Apps)**
   - Entry: Developer Toolbar → Feature Agent Button
   - Purpose: Add features to EXISTING builds
   - Orchestrator: Same `BuildLoopOrchestrator` per agent
   - Model Selection: User-selected from dropdown
   - Agents: Up to 6 parallel orchestrations with tiles

### 6-Phase Build Loop (Current)

```
Phase 0: INTENT LOCK - Sacred Contract (Opus 4.5, 64K thinking)
Phase 1: INITIALIZATION - Artifacts, scaffolding, credentials
Phase 2: PARALLEL BUILD - 3-5 agents with continuous feedback
Phase 3: INTEGRATION CHECK - Orphan scan, dead code detection
Phase 4: FUNCTIONAL TEST - Browser automation as real user
Phase 5: INTENT SATISFACTION - Critical gate (never done until done)
Phase 6: BROWSER DEMO - Show user working app
```

### Current Phase Model Configuration

| Phase | Current Model | Thinking Budget |
|-------|---------------|-----------------|
| intent_lock | Opus 4.5 | 64K |
| initialization | GPT-5.2-Codex | 32K |
| build_agent | GPT-5.2-Codex | 32K |
| build_agent_complex | Opus 4.5 | 64K |
| intent_satisfaction | Opus 4.5 | 64K |
| tournament_judge | Opus 4.5 | 64K |
| visual_verify | Sonnet 4.5 | 32K |
| error_level_1 | Sonnet 4.5 | 16K |
| error_level_2 | GPT-5.2-Codex | 32K |
| error_level_3-4 | Opus 4.5 | 64K |

---

## PART 2: RESEARCH.MD CAPABILITY MAPPING

### Already Implemented in KripTik
| research.md Capability | KripTik Implementation |
|------------------------|------------------------|
| Process Reward Models | Error Escalation 4-level scoring |
| Spec-driven development | Intent Lock → implementation plan |
| Multi-agent orchestration | Parallel Agent Manager + Verification Swarm |
| MCP integration | `.mcp.json` with 5 servers configured |
| Browser automation | Playwright via browser-service.ts |
| Credential isolation | Credential Vault with AES-256-GCM |

### Needs Implementation
| research.md Capability | Implementation Path |
|------------------------|---------------------|
| Deliberative Alignment | Add code quality specs to system prompts |
| Graphiti bi-temporal memory | New memory service with temporal tracking |
| A-Mem Zettelkasten notes | Extend artifact system with atomic notes |
| SAMEP encrypted context | Enhance context-sync-service.ts |
| V-JEPA 2 intent capture | Integrate for visual intent understanding |
| Tree of Clarifications | Add disambiguation before Intent Lock |
| EAGLE-3 inference | Configure SGLang with RadixAttention |

---

## PART 3: OPENAI JANUARY 2026 UPDATES

### New Models Available
| Model | Capability | Pricing |
|-------|------------|---------|
| Do not use gpt-o3 OR 4 series variations -- only use the best models for this use-case as of today january 19, 2026, and they are NOT o4 or o3, and we will not use o3 or 4 series from gpt.
| GPT-5.2-Codex | Context compaction, 24-hr sessions, 56.4% SWE-Bench Pro | $1.75/$14 per 1M |

### New API Features
1. **Responses API** (replaces Chat Completions for agentic tasks)
   - Reasoning summaries for transparency
   - Preserved reasoning tokens around function calls
   - % SWE-bench improvement
   - % cache utilization improvement

2. **Reasoning Effort Parameter** (o3, o4-mini)
   - `minimal` (effort_ratio: 0.10)
   - `low` (effort_ratio: 0.20)
   - `medium` (effort_ratio: 0.50) - default
   - `high` (effort_ratio: 0.80)
   - `xhigh` (effort_ratio: 0.95) - NEW for critical tasks

3. **Context Compaction** (GPT-5.2-Codex)
   - Automatically compresses older context
   - Retains semantic faithfulness
   - Enables 24-hour coding sessions

4. **Agents SDK for TypeScript**
   - Built-in tools: web search, file search, code interpreter
   - Remote MCP server support

---

## PART 4: ANTHROPIC JANUARY 2026 UPDATES

### Claude Opus 4.5 Enhancements
1. **Effort Parameter** (Opus 4.5 only)
   - `low` - Quick replies, sub-second latency
   - `medium` - Matches Sonnet 4.5 quality with 76% fewer tokens
   - `high` - Exceeds Sonnet by 4.3% with 48% fewer tokens

2. **Extended Thinking Improvements**
   - Minimum budget: websearch using today's date january 19, 2026
   - Maximum budget: " "
   - Preserved thinking blocks across turns (new default in Opus 4.5)

3. **Interleaved Thinking Beta** (`interleaved-thinking-2025-05-14`)
   - Think BETWEEN tool calls
   - budget_tokens can exceed max_tokens
   - Better reasoning for multi-step tool use

4. **Tool Use During Extended Thinking**
   - Models can use tools while reasoning
   - Web search during thinking for real-time info

---

## PART 5: IMPLEMENTATION NLP PROMPTS

Each prompt below is designed for direct paste into Claude Code or Cursor 2.2.

---

### NLP PROMPT 1: OpenAI Responses API Integration

**Estimated Effort**: HIGH
**Files to Create/Modify**: 3 new, 2 modified
**Build Verification Required**: Yes

```
TASK: Implement OpenAI Responses API for reasoning models in KripTik AI

CONTEXT: OpenAI's Responses API provides increase % SWE-bench improvement and % cache savings - do NOT use gpt o3 or 4 series, use newer openai gpt models as of today january 19, 2026 that you find in websearch, over Chat Completions for agentic tasks. It supports reasoning summaries and preserved reasoning tokens around function calls.

REQUIREMENTS:
1. Create new file: server/src/services/ai/openai-responses-client.ts
   - Implement OpenAI Responses API client
   - Support reasoning summaries (reasoning.summary: "auto")
   - Support preserved reasoning items for function calls
   - Support reasoning effort levels: minimal, low, medium, high, xhigh
   - Handle previous_response_id for context continuity

2. Create types file: server/src/services/ai/openai-responses-types.ts
   - ResponsesAPIRequest interface
   - ResponsesAPIResponse interface
   - ReasoningItem interface
   - FunctionCallWithReasoning interface

3. Modify: server/src/services/ai/openrouter-client.ts
   - Add RESPONSES_API_MODELS constant for o3, o3-pro, o4-mini
   - Add getResponsesClient() factory function
   - Update PHASE_CONFIGS to use Responses API for reasoning models

4. Modify: server/src/services/automation/build-loop.ts
   - Use Responses API for phases using o3/o4-mini models
   - Capture and store reasoning summaries for transparency
   - Pass previous_response_id between function calls

IMPLEMENTATION DETAILS:
```typescript
// openai-responses-client.ts structure
interface ResponsesAPIConfig {
 not gpt-o3, not gpt-4 series, but instead websearch to find the newer models as of today january 19, 2026
  };
  max_output_tokens: number;
  tools?: ToolDefinition[];
}

// Usage in build-loop.ts
const response = await responsesClient.create({
  model: 'o4-mini',
  reasoning: { effort: 'high', summary: 'auto' },
  input: prompt,
  tools: [{ type: 'function', function: {...} }],
  previous_response_id: lastResponseId, // Preserve reasoning context
});
```

VERIFICATION:
- npm run build must pass
- Test with Phase 5 (Intent Satisfaction) using o3
- Verify reasoning summaries appear in logs
- Measure cache hit rate improvement

DO NOT MODIFY:
- Any auth files (auth.ts, middleware/auth.ts, auth-client.ts)
- Schema auth tables

STYLE REQUIREMENTS:
- Use TypeScript strict mode
- Add JSDoc comments
- Follow existing error handling patterns
- Log with [ResponsesAPI] prefix
```

---

### NLP PROMPT 2: Reasoning Effort xhigh Level

**Estimated Effort**: MEDIUM
**Files to Modify**: 2
**Build Verification Required**: Yes

```
TASK: Add xhigh reasoning effort level for critical phases in KripTik AI

CONTEXT: OpenAI's o3 and o4-mini models are not suitabe given they are outdated. Other openai models that you will find in websearch now support 'xhigh' effort level for maximum reasoning depth. This should be used for the most critical phases.

REQUIREMENTS:
1. Modify: server/src/services/ai/openrouter-client.ts
   - Update EffortLevel type to include 'xhigh'
   - Update effort descriptions in comments

2. Modify: server/src/services/ai/openrouter-client.ts PHASE_CONFIGS
   - intent_lock: Use 'xhigh' effort for o3 verification model
   - intent_satisfaction: Use 'xhigh' effort (this is the critical gate)
   - error_level_4: Use 'xhigh' (full feature rebuild)
   - tournament_judge: Use 'xhigh' for best-of-breed selection

IMPLEMENTATION:
```typescript
// Update type
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh';

// Update PHASE_CONFIGS
'intent_satisfaction': {
    model: ANTHROPIC_MODELS.OPUS_4_5,
    provider: 'anthropic',
    effort: 'high',
    thinkingBudget: 64000,
    description: 'Critical gate - Opus 4.5 maximum reasoning',
    use openai 5.2 models - search to find them because today is january 19, 2-26 - do NOT use gpt-4 series or o3 series.

VERIFICATION:
- npm run build must pass
- Verify xhigh effort is passed to OpenAI API calls

DO NOT MODIFY: Auth files
```

---

### NLP PROMPT 3: Interleaved Thinking Beta

**Estimated Effort**: MEDIUM
**Files to Create/Modify**: 1 new, 2 modified
**Build Verification Required**: Yes

```
TASK: Implement Anthropic Interleaved Thinking Beta for multi-step tool use

CONTEXT: Claude's interleaved-thinking-2025-05-14 beta allows thinking BETWEEN tool calls, improving reasoning for complex multi-step operations. budget_tokens can exceed max_tokens.

REQUIREMENTS:
1. Modify: server/src/services/ai/openrouter-client.ts
   - Add 'INTERLEAVED_THINKING_2025' to OPENROUTER_BETAS
   - Update getBetaHeaders to include interleaved thinking for tool-use phases

2. Modify: server/src/services/ai/claude-service.ts
   - Add interleavedThinking option to generate() method
   - Pass anthropic-beta header when enabled
   - Handle interleaved thinking response format

3. Create: server/src/services/ai/interleaved-thinking-handler.ts
   - Parse thinking blocks between tool calls
   - Aggregate total thinking tokens across interleaved blocks
   - Provide reasoning trace for debugging

IMPLEMENTATION:
```typescript
// In OPENROUTER_BETAS
INTERLEAVED_THINKING_2025: 'interleaved-thinking-2025-05-14',

// In claude-service.ts
interface GenerateOptions {
  // ... existing options
  interleavedThinking?: boolean;
  thinkingBudget?: number; // Can exceed max_tokens with interleaved
}

// API call with interleaved thinking
const response = await client.messages.create({
  model: 'claude-opus-4-5-20251101',
  messages,
  thinking: {
    type: 'enabled',
    budget_tokens: 64000, // Can exceed max_tokens
  },
}, {
  headers: {
    'anthropic-beta': 'interleaved-thinking-2025-05-14',
  },
});
```

PHASES TO ENABLE:
- build_agent_complex (multi-step architecture changes)
- error_level_3 (component rewrite with tool use)
- error_level_4 (full feature rebuild)

VERIFICATION:
- npm run build must pass
- Test with a multi-step tool-use scenario
- Verify thinking blocks appear between tool calls

DO NOT MODIFY: Auth files
```

---

### NLP PROMPT 4: Context Compaction for Long Sessions

**Estimated Effort**: HIGH
**Files to Create**: 2 new
**Build Verification Required**: Yes

```
TASK: Implement context compaction for 24-hour coding sessions

CONTEXT: GPT-5.2-Codex supports context compaction that automatically compresses older context while maintaining semantic faithfulness. This enables multi-hour builds without context loss.

REQUIREMENTS:
1. Create: server/src/services/context/context-compaction-service.ts
   - Implement automatic context compression
   - Preserve semantic meaning in compressed summaries
   - Track compression ratio and quality metrics
   - Integrate with GPT-5.2-Codex context management

2. Create: server/src/services/context/compaction-strategies.ts
   - ConversationCompaction: Summarize older turns
   - ToolOutputCompaction: Compress verbose tool outputs
   - FileContentCompaction: Summarize unchanged file contents
   - ReasoningCompaction: Extract key insights from thinking blocks

3. Integrate with: server/src/services/automation/build-loop.ts
   - Apply compaction when context exceeds threshold (150K tokens)
   - Maintain compaction history for debugging
   - Emit compaction events for monitoring

IMPLEMENTATION:
```typescript
// context-compaction-service.ts
interface CompactionConfig {
  triggerThreshold: number;    // Tokens before compaction (150K)
  targetRatio: number;         // Desired compression (0.5 = 50%)
  preserveRecentTurns: number; // Keep last N turns uncompressed
  preserveTools: string[];     // Never compress certain tools
}

interface CompactionResult {
  originalTokens: number;
  compactedTokens: number;
  ratio: number;
  summary: string;
  preservedContext: string[];
}

class ContextCompactionService {
  async compact(context: ConversationContext): Promise<CompactionResult>;
  async shouldCompact(tokenCount: number): boolean;
  getCompactionHistory(): CompactionEvent[];
}
```

INTEGRATION POINTS:
- Call before each AI generation if context exceeds threshold
- Store compaction summaries in artifacts for recovery
- Include compaction metrics in build events

VERIFICATION:
- npm run build must pass
- Simulate long session with 200K+ tokens
- Verify context is compressed without losing critical info
- Test recovery from compacted context

DO NOT MODIFY: Auth files
```

---

### NLP PROMPT 5: Preserved Thinking Blocks

**Estimated Effort**: MEDIUM
**Files to Modify**: 2
**Build Verification Required**: Yes

```
TASK: Enable preserved thinking blocks across turns for Claude Opus 4.5

CONTEXT: Claude Opus 4.5 preserves thinking blocks from previous assistant turns by default. This maintains reasoning continuity across multi-turn conversations.

REQUIREMENTS:
1. Modify: server/src/services/ai/claude-service.ts
   - Store thinking blocks from responses
   - Pass previous thinking blocks in subsequent requests
   - Handle thinking block references in error recovery

2. Modify: server/src/services/automation/build-loop.ts
   - Maintain thinking block history per phase
   - Pass accumulated thinking to escalation levels
   - Include thinking context in checkpoint snapshots

IMPLEMENTATION:
```typescript
// In claude-service.ts
interface ThinkingBlockCache {
  turnId: string;
  thinkingContent: string;
  timestamp: Date;
  phase: string;
}

class ClaudeService {
  private thinkingCache: Map<string, ThinkingBlockCache[]> = new Map();

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    // Include previous thinking blocks
    const previousThinking = this.thinkingCache.get(options.sessionId);

    const response = await client.messages.create({
      // ... other options
      // Opus 4.5 automatically includes thinking from previous turns
    });

    // Cache new thinking blocks
    if (response.thinking) {
      this.cacheThinking(options.sessionId, response.thinking);
    }

    return result;
  }
}
```

BENEFITS:
- Error escalation has full reasoning context
- Tournament judges can see contestant reasoning
- Intent satisfaction can verify reasoning chain

VERIFICATION:
- npm run build must pass
- Test multi-turn conversation with Opus 4.5
- Verify thinking blocks persist across turns

DO NOT MODIFY: Auth files
```

---

### NLP PROMPT 6: Deliberative Alignment for Code Quality

**Estimated Effort**: HIGH
**Files to Create**: 2 new
**Build Verification Required**: Yes

```
TASK: Implement deliberative alignment for code quality specifications

CONTEXT: Research shows deliberative alignment reduces problematic outputs from 8.7% to 0.3% by teaching models explicit quality specifications and having them reason over specs before generation.

REQUIREMENTS:
1. Create: server/src/services/ai/deliberative-alignment.ts
   - Define KripTik code quality specifications
   - Create spec injection for system prompts
   - Implement spec verification in responses

2. Create: server/src/services/ai/quality-specs.ts
   - NoPlaceholders: Never use TODO, FIXME, lorem ipsum
   - CompleteImplementations: Every function must be fully implemented
   - ErrorHandling: All async operations need error handling
   - SecurityPatterns: No exposed secrets, proper input validation
   - ProjectConventions: Match existing code style
   - AntiSlop: No purple-pink gradients, no flat designs
   - CustomIcons: Use src/components/icons/, not Lucide
   - IntegrationComplete: All code must be wired up, no orphans

3. Integrate into: server/src/services/ai/claude-service.ts
   - Inject quality specs into system prompt
   - Parse spec compliance from reasoning blocks
   - Score spec adherence in responses

IMPLEMENTATION:
```typescript
// quality-specs.ts
export const CODE_QUALITY_SPECS: QualitySpec[] = [
  {
    id: 'no-placeholders',
    name: 'No Placeholder Content',
    rule: 'NEVER use TODO, FIXME, lorem ipsum, "Coming soon", or mock data',
    severity: 'blocking',
    examples: {
      violation: 'function getData() { /* TODO: implement */ }',
      correct: 'async function getData() { return await api.fetch(...) }',
    },
  },
  {
    id: 'complete-implementations',
    name: 'Complete Implementations',
    rule: 'Every function must be fully implemented, no stubs or partial code',
    severity: 'blocking',
  },
  // ... more specs
];

// deliberative-alignment.ts
function injectQualitySpecs(systemPrompt: string): string {
  const specsBlock = formatSpecsForPrompt(CODE_QUALITY_SPECS);
  return `${systemPrompt}

## Code Quality Specifications (MUST FOLLOW)
Before generating ANY code, you MUST:
1. Review each specification below
2. Explicitly reason about how your code will comply
3. Verify compliance before outputting

${specsBlock}`;
}
```

VERIFICATION:
- npm run build must pass
- Test with known "slop" patterns, verify rejection
- Measure reduction in placeholder content

DO NOT MODIFY: Auth files
```

---

### NLP PROMPT 7: Graphiti Bi-Temporal Memory

**Estimated Effort**: VERY HIGH
**Files to Create**: 4 new
**Build Verification Required**: Yes

```
TASK: Implement Graphiti-style bi-temporal memory for codebase coherence

CONTEXT: Graphiti (94.8% DMR benchmark) uses bi-temporal knowledge graphs tracking both when facts are valid and when recorded. Critical for codebases where dependencies update and APIs deprecate.

REQUIREMENTS:
1. Create: server/src/services/memory/graphiti-memory-service.ts
   - Bi-temporal fact storage (valid_time, transaction_time)
   - Edge invalidation when new evidence emerges
   - Query facts as-of specific times

2. Create: server/src/services/memory/knowledge-graph.ts
   - Node types: File, Function, Component, API, Dependency
   - Edge types: imports, calls, depends_on, deprecated_by
   - Temporal edge properties

3. Create: server/src/services/memory/memory-sync.ts
   - Sync with artifact system
   - Sync with learning engine patterns
   - Background indexing of project changes

4. Database schema additions (server/src/schema.ts):
   - memoryNodes table
   - memoryEdges table
   - memorySnapshots table

IMPLEMENTATION:
```typescript
// graphiti-memory-service.ts
interface BiTemporalFact {
  id: string;
  subject: string;      // e.g., "UserService"
  predicate: string;    // e.g., "depends_on"
  object: string;       // e.g., "AuthService"
  validFrom: Date;      // When fact became true
  validTo?: Date;       // When fact stopped being true
  transactionTime: Date; // When we learned this
  confidence: number;
  source: string;       // Where we learned it
}

class GraphitiMemoryService {
  async addFact(fact: BiTemporalFact): Promise<void>;
  async invalidateFact(factId: string, newEvidence: Evidence): Promise<void>;
  async queryAsOf(query: Query, asOfTime: Date): Promise<Fact[]>;
  async getFactHistory(factId: string): Promise<FactVersion[]>;
}
```

INTEGRATION POINTS:
- Update on file changes (Phase 2)
- Query during context loading
- Invalidate on dependency updates
- Use for impact analysis in error escalation

VERIFICATION:
- npm run build must pass
- Test fact addition and invalidation
- Verify temporal queries work correctly

DO NOT MODIFY: Auth files
```

---

### NLP PROMPT 8: Tree of Clarifications for Disambiguation

**Estimated Effort**: MEDIUM
**Files to Create**: 2 new
**Build Verification Required**: Yes

```
TASK: Implement Tree of Clarifications for ambiguous prompt handling

CONTEXT: Tree of Clarifications (ToC) recursively constructs disambiguation trees for ambiguous prompts, generating targeted clarifying questions before generation. Improves accuracy from 70.96% to 80.80%.

REQUIREMENTS:
1. Create: server/src/services/ai/tree-of-clarifications.ts
   - Detect ambiguous prompts
   - Generate disambiguation tree
   - Create targeted clarifying questions
   - Refine prompt based on answers

2. Create: server/src/services/ai/ambiguity-detector.ts
   - Pattern-based ambiguity detection
   - Semantic ambiguity scoring
   - Domain-specific ambiguity rules

3. Integrate before Intent Lock (Phase 0):
   - Run ToC on initial NLP
   - Present questions to user if ambiguous
   - Create refined prompt for Intent Lock

IMPLEMENTATION:
```typescript
// tree-of-clarifications.ts
interface ClarificationNode {
  id: string;
  ambiguity: string;         // What's unclear
  interpretations: string[]; // Possible meanings
  question: string;          // Question to ask user
  children: ClarificationNode[];
}

interface ClarificationResult {
  isAmbiguous: boolean;
  tree?: ClarificationNode;
  questions?: string[];
  refinedPrompt?: string;
}

class TreeOfClarifications {
  async analyze(prompt: string): Promise<ClarificationResult>;
  async processAnswer(nodeId: string, answer: string): Promise<void>;
  async getRefinedPrompt(): Promise<string>;
}

// Example ambiguities to detect:
// "Add authentication" - OAuth? JWT? Magic links? Which providers?
// "Make it faster" - Frontend? Backend? Database? All?
// "Add dark mode" - Toggle? System preference? Per-component?
```

USER FLOW:
1. User enters NLP in Builder View
2. ToC analyzes for ambiguity
3. If ambiguous, show modal with clarifying questions
4. User answers, prompt is refined
5. Refined prompt goes to Intent Lock

VERIFICATION:
- npm run build must pass
- Test with known ambiguous prompts
- Verify clarifying questions are relevant
- Measure Intent Lock quality improvement

DO NOT MODIFY: Auth files
```

---

### NLP PROMPT 9: SAMEP Encrypted Context Sharing

**Estimated Effort**: HIGH
**Files to Create/Modify**: 2 new, 1 modified
**Build Verification Required**: Yes

```
TASK: Implement SAMEP protocol for secure persistent context sharing

CONTEXT: SAMEP (Secure Agent Memory Exchange Protocol) enables encrypted cross-agent context sharing with AES-256-GCM. Research shows 73% development time reduction and 94% consistency improvement.

REQUIREMENTS:
1. Create: server/src/services/agents/samep-protocol.ts
   - AES-256-GCM encryption for context
   - Agent identity verification
   - Secure context broadcast
   - Conflict resolution

2. Create: server/src/services/agents/context-encryption.ts
   - Key derivation per session
   - Context encryption/decryption
   - Integrity verification

3. Modify: server/src/services/agents/context-sync-service.ts
   - Use SAMEP for all context sharing
   - Add encryption layer
   - Verify sender identity

IMPLEMENTATION:
```typescript
// samep-protocol.ts
interface SAMEPMessage {
  senderId: string;
  recipientIds: string[];  // Or '*' for broadcast
  encryptedPayload: Buffer;
  signature: string;
  timestamp: Date;
  nonce: string;
}

interface SAMEPContext {
  discoveries: Discovery[];
  solutions: Solution[];
  errors: Error[];
  artifacts: Artifact[];
}

class SAMEPProtocol {
  private sessionKey: Buffer;

  async broadcastContext(context: SAMEPContext): Promise<void>;
  async receiveContext(message: SAMEPMessage): Promise<SAMEPContext>;
  async verifyIdentity(agentId: string): Promise<boolean>;
  async resolveConflict(a: SAMEPContext, b: SAMEPContext): Promise<SAMEPContext>;
}
```

BENEFITS:
- Secure multi-agent collaboration
- Prevent context tampering
- Audit trail for context changes

VERIFICATION:
- npm run build must pass
- Test multi-agent context sharing
- Verify encryption is applied
- Test conflict resolution

DO NOT MODIFY: Auth files
```

---

### NLP PROMPT 10: Model Configuration Updates for January 2026

**Estimated Effort**: LOW
**Files to Modify**: 2
**Build Verification Required**: Yes

```
TASK: Update model configurations to latest January 2026 IDs and capabilities

CONTEXT: Model IDs and capabilities have been updated. KripTik needs current model references.

REQUIREMENTS:
1. Modify: server/src/services/ai/openrouter-client.ts
   - Update ANTHROPIC_MODELS with correct IDs
   - Update OPENAI_MODELS with NOT NOT NOT o3-pro, o4-mini-high variants, will NEVER use gpt o3 or o4 series, but will use more recent, current models using today's date, january 19, 2026 in a websearch to find the newer more capable and better models.
   - Add model info for new models

2. Modify: server/src/services/ai/model-router.ts
   - Update model configs with current pricing
   - Add new model tiers

CURRENT MODEL IDs (January 2026):
```typescript
export const ANTHROPIC_MODELS = {
    OPUS_4_5: 'claude-opus 4.5, thinking and extended thinking (websearch to use correct names)
    SONNET_4: 'claude-sonnet-4.5-20250514' (thinking models and variants are available, websearch to find right model names),
    HAIKU_3_5: 'claude-4-5-haiku-20241022' (fid right model names),
} as const;

export const OPENAI_MODELS = {
    // Reasoning models

    // GPT-5.2 Series
    GPT_5_2_PRO: 'gpt-5.2-pro',
    GPT_5_2: 'gpt-5.2',
    GPT_5_2_INSTANT: 'gpt-5.2-instant',
    GPT_5_2_CODEX: 'gpt-5.2-codex',
    GPT_5_2_CODEX_PRO: 'gpt-5.2-codex-pro',
**will not use gpt-4, not use gpt-o3 - today is january 19, 2026, so make the models the best current to the day.
```

PRICING UPDATES:
| Model | Input (per 1M) | Output (per 1M) |
|-------|----------------|-----------------|
| Opus 4.5 | $5 | $25 |
| Sonnet 4.5 | $3 | $15 |
| GPT-5.2-Codex | $1.75 | $14 |

VERIFICATION:
- npm run build must pass
- Verify model IDs are correct in API calls

DO NOT MODIFY: Auth files
```

---

## PART 6: IMPLEMENTATION PRIORITY ORDER

### Phase 1: Critical API Integrations (Week 1)
1. **NLP PROMPT 10**: Model Configuration Updates (LOW - 2 hours)
2. **NLP PROMPT 2**: Reasoning Effort xhigh (MEDIUM - 4 hours)
3. **NLP PROMPT 1**: OpenAI Responses API (HIGH - 8 hours)

### Phase 2: Reasoning Enhancements (Week 2)
4. **NLP PROMPT 3**: Interleaved Thinking Beta (MEDIUM - 4 hours)
5. **NLP PROMPT 5**: Preserved Thinking Blocks (MEDIUM - 4 hours)
6. **NLP PROMPT 6**: Deliberative Alignment (HIGH - 8 hours)

### Phase 3: Context & Memory (Week 3)
7. **NLP PROMPT 4**: Context Compaction (HIGH - 8 hours)
8. **NLP PROMPT 8**: Tree of Clarifications (MEDIUM - 6 hours)
9. **NLP PROMPT 9**: SAMEP Encrypted Context (HIGH - 8 hours)

### Phase 4: Advanced Memory (Week 4)
10. **NLP PROMPT 7**: Graphiti Bi-Temporal Memory (VERY HIGH - 16 hours)

---

## PART 7: VERIFICATION CHECKLIST

After implementing each prompt:

```
[ ] npm run build passes
[ ] No TypeScript errors
[ ] No auth files modified
[ ] Test with relevant phase (Intent Lock, Build, Verification)
[ ] Measure improvement vs baseline
[ ] Update .claude/rules/01-session-context.md
[ ] Commit with descriptive message
[ ] Push to branch
```

---

## SOURCES

- [OpenAI Changelog](https://platform.openai.com/docs/changelog)
- [OpenAI Reasoning Models](https://platform.openai.com/docs/guides/reasoning)
- [GPT-5.2-Codex Introduction](https://openai.com/index/introducing-gpt-5-2-codex/)
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [Claude Extended Thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
- [Claude Opus 4.5](https://www.anthropic.com/news/claude-opus-4-5)
- [What's New in Claude 4.5](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-5)

---

*Document created: January 2, 2026*
*Last updated: January 2, 2026*
