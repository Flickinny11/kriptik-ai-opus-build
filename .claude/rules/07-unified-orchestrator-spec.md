# Unified Orchestrator Specification - KripTik AI

> **THE BLUEPRINT**: This document specifies the unified orchestration system that will power both Builder View and Feature Agent workflows.

**Created**: 2025-12-20
**Status**: SPECIFICATION (Implementation Pending)

---

## EXECUTIVE SUMMARY

KripTik AI will have **ONE unified orchestrator** that handles ALL building workflows:
- Builder View (full apps from NLP)
- Feature Agent (features for existing apps)
- Fix My App (import and repair)

This unified orchestrator combines:
- **BuildLoopOrchestrator** (2,502 lines) - 6-phase core architecture
- **EnhancedBuildLoopOrchestrator** (743 lines) - Cursor 2.1+ features
- **All 30 features** preserved and integrated

---

## PART 1: UNIFIED ORCHESTRATOR ARCHITECTURE

### Core Phases (Extended from 6 to 8+)

```
Phase 0: INTENT LOCK
  └─ Create immutable Sacred Contract (Opus 4.5, 64K thinking)
  └─ Define success criteria, user workflows, visual identity
  └─ CANNOT proceed until contract is locked

Phase 1: INITIALIZATION
  └─ Memory Harness setup (InitializerAgent)
  └─ Artifact creation for context persistence
  └─ Component sandbox allocation
  └─ Credential collection (if needed)

Phase 2: PARALLEL BUILD (with continuous feedback)
  └─ Component-based sandboxes (see Part 2)
  └─ Unlimited agents per component
  └─ Streaming feedback channel (real-time)
  └─ Continuous verification (background)
  └─ Browser-in-the-loop (visual during build)
  └─ Error pattern library (Level 0 fixes)
  └─ Agents share context/memory, update each other

Phase 3: COMPONENT INTEGRATION
  └─ Merge component sandboxes → main sandbox
  └─ Integration testing
  └─ Orphan scan, dead code detection
  └─ Cross-component dependency verification

Phase 4: FUNCTIONAL TEST
  └─ Browser automation (Playwright)
  └─ User workflow simulation
  └─ Console error detection
  └─ Network request verification
  └─ Gap closers run (accessibility, adversarial, etc.)

Phase 5: INTENT SATISFACTION (CRITICAL GATE)
  └─ Verify ALL success criteria from Phase 0
  └─ Anti-slop score must be 85+
  └─ Zero placeholders
  └─ All features marked as passed
  └─ If NOT satisfied → escalate → retry (unlimited retries)
  └─ CANNOT proceed until ACTUALLY DONE

Phase 6: VERIFICATION SWARM
  └─ All 6 verification agents run
  └─ Error Checker (5s) - BLOCKING
  └─ Code Quality (30s) - 80+ required
  └─ Visual Verifier (60s) - 85+ required
  └─ Security Scanner (60s) - BLOCKING
  └─ Placeholder Eliminator (10s) - ZERO tolerance
  └─ Design Style (85+ required)
  └─ 7 Gap Closers (stage-appropriate)

Phase 7: BROWSER DEMO
  └─ Agent-controlled browser shows working app
  └─ User can take control
  └─ If breaks → agents fix → re-demo
  └─ Only shown when ACTUALLY working

Phase 8: LEARNING CAPTURE
  └─ Experience capture (decisions, artifacts)
  └─ AI judgment (RLAIF)
  └─ Pattern extraction
  └─ Strategy evolution
  └─ Shadow model updates
```

### Continuous Systems (Run Throughout All Phases)

1. **Streaming Feedback Channel** - Real-time verification → agents
2. **Continuous Verification** - TypeScript, ESLint, tests running constantly
3. **Browser-in-the-Loop** - Visual verification during build (not just at end)
4. **Error Pattern Library** - Level 0 instant fixes
5. **Context/Memory Sharing** - All agents have same context, update each other
6. **Time Machine** - Checkpoints at phase boundaries + on-demand

---

## PART 2: PHASE-BASED SANDBOX ARCHITECTURE

### The Problem with Agent-Based Sandboxes
- Each agent isolated = merge conflicts within same component
- Agents can't see each other's changes until merge
- More merges = more risk

### The Solution: Component-Based Sandboxes

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT SANDBOXES                          │
│  (Multiple agents work TOGETHER in each sandbox)                │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   FRONTEND      │  │    BACKEND      │  │    DATABASE     │ │
│  │    Sandbox      │  │    Sandbox      │  │    Sandbox      │ │
│  │                 │  │                 │  │                 │ │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │ │
│  │ │ Agent A     │ │  │ │ Agent D     │ │  │ │ Agent G     │ │ │
│  │ │ Agent B     │ │  │ │ Agent E     │ │  │ │ Agent H     │ │ │
│  │ │ Agent C     │ │  │ │ Agent F     │ │  │ │             │ │ │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │ │
│  │                 │  │                 │  │                 │ │
│  │ [Test UI]       │  │ [Test APIs]     │  │ [Test Schema]   │ │
│  │ [Hot Reload]    │  │ [Integration]   │  │ [Migrations]    │ │
│  │ [Visual Check]  │  │ [Error Handle]  │  │ [Connections]   │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                ↓                                │
│                    ┌───────────────────────┐                    │
│                    │     MAIN SANDBOX      │                    │
│                    │                       │                    │
│                    │  • Integrated App     │                    │
│                    │  • Full E2E Tests     │                    │
│                    │  • Intent Satisfaction│                    │
│                    │  • Final Verification │                    │
│                    └───────────┬───────────┘                    │
│                                ↓                                │
│                    ┌───────────────────────┐                    │
│                    │   BROWSER DEMO        │                    │
│                    │   (Agent-Controlled)  │                    │
│                    └───────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

### Component Sandbox Rules

1. **Agents in same sandbox share immediate state** - Changes visible instantly
2. **All agents share master context/memory** - Via artifact system
3. **Sandboxes work in parallel** - Different components simultaneously
4. **Merge to main when component verified** - Not before
5. **Integration testing after each merge** - Catch issues early
6. **Final verification on complete app** - In main sandbox

### Dynamic Component Allocation

The orchestrator determines components based on Intent Lock:

```typescript
interface ComponentSandbox {
  id: string;
  name: string;  // "frontend", "backend", "database", "api-integrations", etc.
  agents: Agent[];
  status: 'building' | 'testing' | 'verified' | 'merged';
  sandbox: SandboxInstance;
  mergeOrder: number;  // Order to merge into main
}

// Example for an AI video generation app:
const components: ComponentSandbox[] = [
  { name: 'landing-page', mergeOrder: 1 },
  { name: 'auth-system', mergeOrder: 2 },
  { name: 'api-integrations', mergeOrder: 3 },  // OpenAI, Replicate, etc.
  { name: 'video-ui', mergeOrder: 4 },
  { name: 'database-storage', mergeOrder: 5 },
  { name: 'payment-system', mergeOrder: 6 },
];
```

---

## PART 3: UNIFIED ORCHESTRATOR MODES

### Mode: `full_app` (Builder View)

```typescript
const config: UnifiedOrchestratorConfig = {
  mode: 'full_app',

  // Model routing
  modelSelection: 'kriptoenite',  // Kriptoenite auto-selects optimal models

  // Agent management
  agents: {
    unlimited: true,  // Spawn as many as needed
    visibility: 'internal',  // User sees progress bar, not individual agents
    parallelization: 'automatic',  // Orchestrator decides
  },

  // Sandboxing
  sandboxing: {
    strategy: 'component-based',
    mergeToMain: 'on-verification',
  },

  // Context
  context: {
    source: 'fresh',  // Starts fresh, builds up via artifacts
    shareAcrossAgents: true,
    injectUnifiedContext: true,  // All 14 sections
  },

  // Gates
  gates: {
    intentSatisfaction: true,  // Must pass Phase 5
    antiSlopMinimum: 85,
    placeholderTolerance: 0,
    unlimitedEscalation: true,  // Never give up
  },
};
```

### Mode: `feature` (Feature Agent)

```typescript
const config: UnifiedOrchestratorConfig = {
  mode: 'feature',

  // Model routing
  modelSelection: 'user-selected',  // User picks model (e.g., "Sonnet 4.5")
  selectedModel: 'claude-sonnet-4-5-20241022',

  // Agent management
  agents: {
    unlimited: true,  // Orchestration spawns as many as needed of selected model
    visibility: 'tiles',  // Each orchestration gets a tile
    parallelization: 'orchestration',  // Up to 6 orchestrations
  },

  // Sandboxing
  sandboxing: {
    strategy: 'component-based',
    mergeToMain: 'on-verification',
    inheritFromProject: true,  // Build on existing app
  },

  // Context
  context: {
    source: 'existing',  // Inherit from parent project
    shareAcrossAgents: true,
    shareAcrossOrchestrations: true,  // All 6 orchestrations share
    injectUnifiedContext: true,
  },

  // Gates
  gates: {
    intentSatisfaction: true,
    antiSlopMinimum: 85,
    placeholderTolerance: 0,
    unlimitedEscalation: true,
  },
};
```

### Mode: `fix` (Fix My App)

```typescript
const config: UnifiedOrchestratorConfig = {
  mode: 'fix',

  // Model routing
  modelSelection: 'kriptoenite',

  // Agent management
  agents: {
    unlimited: true,
    visibility: 'internal',
    parallelization: 'automatic',
  },

  // Sandboxing
  sandboxing: {
    strategy: 'component-based',
    inheritFromImport: true,  // Start with imported project
  },

  // Context
  context: {
    source: 'imported',  // From vision capture
    errorHistory: true,  // Include imported errors
  },

  // Gates
  gates: {
    intentSatisfaction: true,
    antiSlopMinimum: 85,
    placeholderTolerance: 0,
    unlimitedEscalation: true,
  },
};
```

---

## PART 4: ALL 30 FEATURES PRESERVED

### Feature Integration Matrix

| # | Feature | Integration Point | Status |
|---|---------|-------------------|--------|
| 1 | Soft Interrupt | Phase 2 (during build), Ghost Mode | PRESERVE |
| 2 | Time Machine | Phase boundaries, on-demand | PRESERVE |
| 3 | Fix My App | Mode: `fix`, uses same orchestrator | PRESERVE |
| 4 | Credential Vault | Phase 1 (initialization) | PRESERVE |
| 5 | Credential Collection UI | Phase 1, before build starts | PRESERVE |
| 6 | Context Injection | ALL phases, via UnifiedContext | PRESERVE + FIX |
| 7 | Verification Swarm | Phase 6, continuous during Phase 2 | PRESERVE |
| 8 | Bug Finder | Part of verification swarm | PRESERVE |
| 9 | Bug Fixer | Part of error escalation | PRESERVE |
| 10 | Error Checker | Verification swarm agent | PRESERVE |
| 11 | Error Escalation | Phase 2+ (on any error) | PRESERVE |
| 12 | Anti-Slop | Phase 5, Phase 6 | PRESERVE |
| 13 | Learning Engine | Phase 8, after completion | PRESERVE |
| 14 | Ghost Mode | Wraps unified orchestrator | PRESERVE |
| 15 | Speed Dial | Config for unified orchestrator | PRESERVE |
| 16 | Intelligence Dial | Per-request settings | PRESERVE |
| 17 | Tournament Mode | Special Phase 2 variant | PRESERVE |
| 18 | Sandbox Service | Component-based sandboxing | ENHANCE |
| 19 | Browser Automation | Phase 4, Phase 7 | PRESERVE |
| 20 | Preview Service | Phase 7 (Show Me) | PRESERVE |
| 21 | Gap Closers | Phase 4, Phase 6 | PRESERVE |
| 22 | Predictive Error Prevention | Phase 2 (before generation) | PRESERVE |
| 23 | Shadow Models | Phase 2 (pattern injection) | PRESERVE |
| 24 | Multi-Agent Judging | Phase 2 (parallel results) | PRESERVE |
| 25 | Human Checkpoints | Phase 2+ (critical decisions) | PRESERVE |
| 26 | Streaming Feedback | Phase 2 (continuous) | PRESERVE |
| 27 | Continuous Verification | Phase 2 (background) | PRESERVE |
| 28 | Browser-in-the-Loop | Phase 2 (visual during build) | PRESERVE |
| 29 | Runtime Debug Context | Error escalation L2+ | PRESERVE |
| 30 | Error Pattern Library | Phase 2 (Level 0 fixes) | PRESERVE |

---

## PART 5: CONTEXT/MEMORY SHARING

### How Agents Share Context

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED CONTEXT SYSTEM                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              UNIFIED CONTEXT (14 Sections)               │   │
│  │                                                         │   │
│  │  • Intent Lock Contract    • Learned Patterns           │   │
│  │  • App Soul Template       • Active Strategies          │   │
│  │  • Build Phase Status      • Project Analysis           │   │
│  │  • Verification Results    • Project Rules              │   │
│  │  • Tournament Results      • User Preferences           │   │
│  │  • Error History           • Anti-Slop Rules            │   │
│  │  • Success Fixes           • Provider Hints             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  ARTIFACT SYSTEM                         │   │
│  │                                                         │   │
│  │  .cursor/progress.txt         → Progress log            │   │
│  │  .cursor/tasks/task_list.json → Task queue              │   │
│  │  .cursor/tasks/current_task   → Current task            │   │
│  │  feature_list.json            → Feature tracking        │   │
│  │  intent.json                  → Sacred Contract         │   │
│  │  .cursor/memory/build_state   → Build state             │   │
│  │  .cursor/memory/verification  → Verification history    │   │
│  │  .cursor/memory/decisions     → Technical decisions     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    AGENT INJECTION                       │   │
│  │                                                         │   │
│  │  Every agent receives:                                  │   │
│  │  1. formatUnifiedContextForCodeGen() - Full context     │   │
│  │  2. Current artifacts - What's been done                │   │
│  │  3. Other agents' updates - Real-time sync              │   │
│  │  4. Component sandbox state - Immediate changes         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Real-Time Agent Communication

```typescript
// Every agent call includes:
const agentContext = {
  // From unified context
  intentContract: loadedContext.intentLock,
  appSoul: loadedContext.appSoulTemplate,
  learnedPatterns: loadedContext.learnedPatterns,
  antiSlopRules: loadedContext.antiSlopRules,

  // From artifacts
  whatsDone: artifacts.progress,
  currentTasks: artifacts.taskList,
  featureStatus: artifacts.featureList,

  // From component sandbox
  componentState: sandbox.currentFiles,
  otherAgentChanges: sandbox.recentChanges,

  // Real-time updates
  streamingFeedback: feedbackChannel.getRecent(),
  verificationIssues: continuousVerification.getIssues(),
};
```

---

## PART 6: "NEVER DONE UNTIL DONE" PHILOSOPHY

### Intent Satisfaction Gate (Phase 5)

```typescript
async executePhase5_IntentSatisfaction(): Promise<void> {
  let attempts = 0;
  const maxAttempts = Infinity;  // NEVER give up

  while (true) {
    attempts++;

    // Check all success criteria from Intent Lock
    const satisfaction = await this.checkIntentSatisfaction();

    if (satisfaction.satisfied) {
      // Mark all criteria as passed
      for (const criterion of this.intentContract.successCriteria) {
        await this.markCriterionPassed(criterion.id);
      }
      return;  // Only exit when ACTUALLY done
    }

    // NOT satisfied - escalate and retry
    await this.escalateAndFix(satisfaction.missingCriteria);

    // Re-run Phase 2-4 for affected components
    await this.rebuildAffectedComponents(satisfaction.affectedComponents);

    // Continue loop - try again
  }
}
```

### Error Escalation (Never Gives Up)

```typescript
async escalateError(error: Error): Promise<void> {
  // Level 0: Pattern Library (instant fixes)
  const patternFix = await this.patternLibrary.findFix(error);
  if (patternFix) {
    await this.applyFix(patternFix);
    return;
  }

  // Level 1-4: Escalation
  for (let level = 1; level <= 4; level++) {
    const fixed = await this.attemptFix(error, level);
    if (fixed) return;
  }

  // Level 5+: Rebuild from Intent (nuclear option)
  await this.rebuildFromIntent(error.affectedComponent);

  // Loop continues - never gives up
}
```

---

## PART 7: IMPLEMENTATION PLAN

### Step 1: Fix Context Injection Gap (Quick Win)
**File**: `server/src/services/automation/build-loop.ts`
**Change**: Add `projectPath` to all KTN calls

```typescript
// BEFORE (line 1257-1262)
const result = await ktn.buildFeature(prompt, {
  projectId: this.state.projectId,
  userId: this.state.userId,
  framework: 'React',
  language: 'TypeScript',
});

// AFTER
const result = await ktn.buildFeature(prompt, {
  projectId: this.state.projectId,
  userId: this.state.userId,
  projectPath: this.projectPath,  // ADD THIS
  framework: 'React',
  language: 'TypeScript',
});
```

### Step 2: Merge EnhancedBuildLoop INTO BuildLoop
**Source**: `server/src/services/automation/enhanced-build-loop.ts` (743 lines)
**Target**: `server/src/services/automation/build-loop.ts` (2,502 lines)

Features to merge:
- StreamingFeedbackChannel initialization
- ContinuousVerificationService integration
- RuntimeDebugContext for errors
- BrowserInLoopService during Phase 2
- HumanCheckpointService for critical fixes
- MultiAgentJudgeService for parallel results
- ErrorPatternLibrary for Level 0 fixes

### Step 3: Add Component-Based Sandboxing
**File**: `server/src/services/automation/build-loop.ts`
**New**: Component sandbox allocation and management

### Step 4: Wire Builder View
**File**: `server/src/routes/orchestrate.ts`
**Change**: Route to unified orchestrator instead of DevelopmentOrchestrator

### Step 5: Update Feature Agent
**File**: `server/src/services/feature-agent/feature-agent-service.ts`
**Change**: Use unified orchestrator with mode: 'feature'

### Step 6: Deprecate Separate Orchestrators
- Keep files but mark as deprecated
- All new code uses unified orchestrator

---

## PART 8: SUCCESS CRITERIA

The unified orchestrator is complete when:

1. [ ] Builder View NLP → 8-phase loop → working app in browser
2. [ ] Feature Agent NLP → 8-phase loop → working feature in browser
3. [ ] Fix My App → 8-phase loop → fixed app in browser
4. [ ] All 30 features working
5. [ ] Component-based sandboxing operational
6. [ ] Context injection to ALL agents
7. [ ] "Never done until done" philosophy enforced
8. [ ] No functionality lost from current system

---

*This specification is the single source of truth for the unified orchestrator.*

*Last Updated: 2025-12-20*
