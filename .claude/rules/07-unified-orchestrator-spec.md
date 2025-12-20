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

## PART 4: COMPLETE 66+ FEATURE INVENTORY

> **ALL features must be preserved and integrated into the unified orchestrator.**

### FOUNDATIONAL COMPONENTS (F001-F006)

| ID | Feature | Location | Integration Point |
|----|---------|----------|-------------------|
| F001 | Intent Lock Engine | `services/ai/intent-lock.ts` | Phase 0 - Sacred Contract |
| F002 | Feature List Manager | `services/ai/feature-list.ts` | All phases - tracking |
| F003 | Progress Artifacts | `services/ai/artifacts.ts` | All phases - Memory Harness |
| F004 | OpenRouter Beta Features | `services/ai/openrouter-client.ts` | All AI calls |
| F005 | Context Editing (84% reduction) | `services/ai/openrouter-client.ts` | All AI calls |
| F006 | 6-Phase Build Loop | `services/automation/build-loop.ts` | CORE - Expand to 8 phases |

### VERIFICATION SWARM (F007-F013)

| ID | Feature | Location | Integration Point |
|----|---------|----------|-------------------|
| F007 | Verification Swarm Coordinator | `services/verification/swarm.ts` | Phase 6 + continuous |
| F008 | Error Checker Agent (5s) | `services/verification/error-checker.ts` | BLOCKING |
| F009 | Code Quality Agent (30s) | `services/verification/code-quality.ts` | 80+ required |
| F010 | Visual Verifier Agent (60s) | `services/verification/visual-verifier.ts` | Anti-slop |
| F011 | Security Scanner Agent (60s) | `services/verification/security-scanner.ts` | BLOCKING |
| F012 | Placeholder Eliminator (10s) | `services/verification/placeholder-eliminator.ts` | ZERO tolerance |
| F013 | Design Style Agent | `services/verification/design-style-agent.ts` | 85+ required |

### DESIGN SYSTEM (F014-F015)

| ID | Feature | Location | Integration Point |
|----|---------|----------|-------------------|
| F014 | App Soul Mapper (8 types) | `services/ai/app-soul.ts` | Phase 0, design decisions |
| F015 | Anti-Slop Detection | `services/verification/anti-slop-detector.ts` | Phase 5, 6 |

### ERROR HANDLING (F016-F018)

| ID | Feature | Location | Integration Point |
|----|---------|----------|-------------------|
| F016 | Error Escalation (4 levels) | `services/automation/error-escalation.ts` | Phase 2+ (never gives up) |
| F017 | Enhanced Fix Executor | `services/fix-my-app/enhanced-fix-executor.ts` | Fix My App mode |
| F018 | Intent Lock Integration (Fix) | `services/fix-my-app/` | Fix My App mode |

### COMPETITIVE ENHANCEMENTS (F019-F023)

| ID | Feature | Location | Integration Point |
|----|---------|----------|-------------------|
| F019 | Speed Dial (4 modes) | `services/ai/speed-dial.ts` | Config layer |
| F020 | Tournament Mode | `services/ai/tournament.ts` | Phase 2 variant |
| F021 | Time Machine Checkpoints | `services/checkpoints/time-machine.ts` | Phase boundaries |
| F022 | Intelligence Dial | `services/ai/intelligence-dial.ts` | Per-request config |
| F023 | Infinite Reflection Engine | `services/ai/reflection-engine.ts` | Self-healing loop |

### UI COMPONENTS (F024-F027)

| ID | Feature | Location | Integration Point |
|----|---------|----------|-------------------|
| F024 | Speed Dial Selector UI | `components/builder/SpeedDialSelector.tsx` | Builder UI |
| F025 | Intelligence Toggles UI | `components/builder/IntelligenceToggles.tsx` | Builder UI |
| F026 | Build Phase Indicator | `components/builder/BuildPhaseIndicator.tsx` | Builder UI |
| F027 | Verification Swarm Status | `components/builder/VerificationSwarmStatus.tsx` | Builder UI |

### DEVELOPER MODE (F028-F045)

| ID | Feature | Location | Integration Point |
|----|---------|----------|-------------------|
| F028 | Database Migrations (10 tables) | `server/src/schema.ts` | Data layer |
| F029 | Developer View UI | `components/builder/` | Builder UI |
| F030 | Developer Mode Agent Service | `services/developer-mode/agent-service.ts` | Agent management |
| F031 | Developer Mode Orchestrator | `services/developer-mode/orchestrator.ts` | 6 concurrent agents |
| F033 | Verification Mode Scaling | `services/developer-mode/verification-modes.ts` | Quick/Standard/Thorough/Full |
| F034 | Developer Mode API Routes | `routes/developer-mode.ts` | REST API |
| F035 | Developer Mode DB Schema | `schema.ts` | 8 new tables |
| F036 | Developer Mode Store | `store/useDeveloperModeStore.ts` | Frontend state |
| F037 | AgentModeSidebar Connection | `components/builder/` | Real-time updates |
| F038 | Sandbox Preview Component | `components/builder/AgentSandboxPreview.tsx` | Live preview |
| F039 | Deploy Agent Modal | `components/builder/DeployAgentModal.tsx` | Agent config |
| F040 | SSE Event Streaming | `routes/developer-mode.ts` | Real-time |
| F041 | Git Branch Manager | `services/developer-mode/git-branch-manager.ts` | Worktree isolation |
| F042 | Sandbox Service | `services/developer-mode/sandbox-service.ts` | Isolated previews |
| F043 | Credit Calculator | `services/developer-mode/credit-calculator.ts` | Cost tracking |
| F044 | PR Creation Integration | `services/developer-mode/pr-integration.ts` | GitHub/GitLab/Bitbucket |
| F045 | Micro Intent Lock | `services/ai/intent-lock.ts` | Task-level contracts |

### ADVANCED OPTIONS (F046-F061)

| ID | Feature | Location | Integration Point |
|----|---------|----------|-------------------|
| F046 | Soft Interrupt System | `services/soft-interrupt/interrupt-manager.ts` | Phase 2, Ghost Mode |
| F047 | Pre-Deployment Validation | `services/validation/pre-flight-validator.ts` | Phase 4 |
| F048 | Ghost Mode Controller | `services/ghost-mode/ghost-controller.ts` | Wraps orchestrator |
| F049 | Ghost Session Events & Replay | `services/ghost-mode/event-recorder.ts` | Event capture |
| F057 | Time Machine Timeline UI | PENDING - `components/builder/TimeMachineTimeline.tsx` | Visual scrub |
| F061 | Advanced Developer Settings | `components/settings/DeveloperSettingsSection.tsx` | Settings UI |

### FEATURE AGENTS (F065-F066)

| ID | Feature | Location | Integration Point |
|----|---------|----------|-------------------|
| F065 | Feature Agent Command Center V2 | `components/feature-agent/` | UI + Backend |
| F066 | Notifications System | `services/notifications/notification-service.ts` | All modes |

### AUTONOMOUS LEARNING ENGINE (C28-L1 to C28-L5)

| ID | Feature | Location | Integration Point |
|----|---------|----------|-------------------|
| C28-L1 | Experience Capture | `services/learning/experience-capture.ts` | Phase 8 |
| C28-L2 | AI Judgment (RLAIF) | `services/learning/ai-judgment.ts` | Phase 8 |
| C28-L3 | Shadow Model Registry | `services/learning/shadow-model-registry.ts` | Pattern injection |
| C28-L4 | Pattern Library | `services/learning/pattern-library.ts` | Phase 2 |
| C28-L4 | Strategy Evolution | `services/learning/strategy-evolution.ts` | All phases |
| C28-L5 | Evolution Flywheel | `services/learning/evolution-flywheel.ts` | Orchestrator |

### CURSOR 2.1+ PARITY FEATURES

| Feature | Location | Integration Point |
|---------|----------|-------------------|
| Streaming Feedback Channel | `services/feedback/streaming-feedback-channel.ts` | Phase 2 continuous |
| Continuous Verification | `services/verification/continuous-verification.ts` | Background during build |
| Runtime Debug Context | `services/debug/runtime-debug-context.ts` | Error escalation L2+ |
| Browser-in-the-Loop | `services/verification/browser-in-loop.ts` | Phase 2 visual |
| Human Checkpoints | `services/verification/human-checkpoint.ts` | Critical decisions |
| Multi-Agent Judging | `services/verification/multi-agent-judge.ts` | Parallel results |
| Error Pattern Library | `services/automation/error-pattern-library.ts` | Level 0 fixes |
| Predictive Error Prevention | `services/ai/predictive-error-prevention.ts` | Before generation |

### GAP CLOSERS (7 Agents)

| Agent | Location | Integration Point |
|-------|----------|-------------------|
| Accessibility Verifier | `services/verification/gap-closers/accessibility-verifier.ts` | Phase 4, 6 |
| Adversarial Tester | `services/verification/gap-closers/adversarial-tester.ts` | Phase 4, 6 |
| Cross-Browser Tester | `services/verification/gap-closers/cross-browser-tester.ts` | Phase 4, 6 |
| Error State Tester | `services/verification/gap-closers/error-state-tester.ts` | Phase 4, 6 |
| Exploratory Tester | `services/verification/gap-closers/exploratory-tester.ts` | Phase 4, 6 |
| Performance Verifier | `services/verification/gap-closers/performance-verifier.ts` | Phase 4, 6 |
| Real Data Enforcer | `services/verification/gap-closers/real-data-enforcer.ts` | Stage 3 |

### VISION CAPTURE & IMPORT

| Feature | Location | Integration Point |
|---------|----------|-------------------|
| Vision Capture Service | `services/extension/vision-capture-service.ts` | Extension integration |
| Vision Capture Orchestrator | `services/vision-capture/capture-orchestrator.ts` | Import flow |
| Import Controller | `services/fix-my-app/import-controller.ts` | GitHub, ZIP, AI builders |
| Browser Extractor | `services/fix-my-app/browser-extractor.ts` | DOM/Vision extraction |
| Chat Parser | `services/fix-my-app/chat-parser.ts` | Extract from chat |
| Error Archaeologist | `services/fix-my-app/error-archaeologist.ts` | Find buried errors |
| Credential Collection (Extension) | `browser-extension/src/content/credentials/` | Extension capture |

### PREVIEW & BROWSER AUTOMATION

| Feature | Location | Integration Point |
|---------|----------|-------------------|
| Headless Preview Service | `services/preview/headless-preview-service.ts` | Phase 7 |
| Feature Preview Window | `components/feature-agent/FeaturePreviewWindow.tsx` | "Show Me" |
| Browser Automation Service | `services/automation/browser-service.ts` | Phase 4, 7 |

### CREDENTIAL SYSTEM

| Feature | Location | Integration Point |
|---------|----------|-------------------|
| Credential Vault (AES-256-GCM) | `services/security/credential-vault.ts` | Phase 1 |
| Credential Collection UI | `components/feature-agent/CredentialsCollectionView.tsx` | Phase 1 |
| Project Env Vars | `schema.ts` (projectEnvVars) | .env management |
| Credential Audit Logs | `schema.ts` (credentialAuditLogs) | Security audit |

### KRIPTOENITE SPEED ENHANCEMENTS

| Feature | Location | Integration Point |
|---------|----------|-------------------|
| KripToeNite Facade | `services/ai/krip-toe-nite/facade.ts` | Unified entry |
| KripToeNite Executor | `services/ai/krip-toe-nite/executor.ts` | Fast execution |
| Intelligent Routing | `services/ai/krip-toe-nite/` | Model selection |
| Speculative Strategy | `services/ai/krip-toe-nite/` | Parallel attempts |
| Context Enrichment | `services/ai/krip-toe-nite/facade.ts` | Full context injection |

---

### FEATURE COUNT SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| Foundational (F001-F006) | 6 | ✓ Complete |
| Verification Swarm (F007-F013) | 7 | ✓ Complete |
| Design System (F014-F015) | 2 | ✓ Complete |
| Error Handling (F016-F018) | 3 | ✓ Complete |
| Competitive (F019-F023) | 5 | ✓ Complete |
| UI Components (F024-F027) | 4 | ✓ Complete |
| Developer Mode (F028-F045) | 17 | ✓ Complete (F032 deferred) |
| Advanced Options (F046-F061) | 6 | ✓ Complete (6 pending) |
| Feature Agents (F065-F066) | 2 | ✓ Complete |
| Learning Engine (C28-L1-L5) | 6 | ✓ Complete |
| Cursor 2.1+ Parity | 8 | ✓ Complete |
| Gap Closers | 7 | ✓ Complete |
| Vision/Import | 6 | ✓ Complete |
| Preview/Browser | 3 | ✓ Complete |
| Credentials | 4 | ✓ Complete |
| KripToeNite Speed | 5 | ✓ Complete |
| **TOTAL** | **91** | **All must be preserved** |

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
