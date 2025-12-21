# Critical Gaps Remaining - NLP to Completion

> **Status**: 95% infrastructure complete, 5% critical wiring missing
> **Last Updated**: 2025-12-21

---

## 🚨 P0 BLOCKERS - MUST FIX FIRST

### GAP #1: GENERATED CODE NEVER WRITTEN TO DISK

**Impact**: TOTAL BLOCKER - Nothing actually gets built

**Problem**: AI generates code → parsed into artifacts → BUT `fs.writeFile()` never called

**Current Flow**:
```
AI generates code (✅)
  → JSON extracted from response (✅)
  → Artifacts created with path + content (✅)
  → recordFileChange() called (✅) [ONLY RECORDS IN MEMORY]
  → ❌ NO fs.writeFile() CALL
  → Git commit finds nothing to add
  → User sees "complete" but files don't exist
```

**Location**: `server/src/services/orchestration/agents/worker-agent.ts`

**Fix** (add after line 172):
```typescript
// Write artifacts to disk
for (const artifact of artifacts) {
    const fullPath = path.join(this.projectPath, artifact.path);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, artifact.content, 'utf-8');
    console.log(`[WorkerAgent] Wrote file: ${artifact.path}`);
}
```

**Also needs fix in**: `build-loop.ts` Phase 2 - wherever CodingAgentWrapper returns artifacts

---

### GAP #2: BUILDER VIEW NOT WIRED TO BACKEND

**Impact**: "Multi-Agent Orchestration" selection does nothing on backend

**Current Flow**:
```
User selects 'orchestrator' in dropdown
  → confirmGeneration() called
  → orchestrator.start(prompt) [CLIENT-SIDE ONLY]
  → ❌ Backend /api/execute never called
```

**Location**: `src/components/builder/ChatInterface.tsx` - `confirmGeneration()` function

**Fix**:
```typescript
// In confirmGeneration(), when selectedModel === 'orchestrator':
if (selectedModel === 'orchestrator') {
    const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'builder',
            userId,
            projectId,
            prompt,
            options: { enableVisualVerification: true }
        })
    });
    // Handle SSE stream from response
}
```

---

## 🔴 P1 HIGH PRIORITY

### GAP #3: 8+ SEPARATE ORCHESTRATORS

**Problem**: Parallel implementations instead of unified orchestrator

**Orchestrators to Merge**:
| Orchestrator | Merge Strategy |
|--------------|----------------|
| EnhancedBuildLoopOrchestrator | Already mostly merged into BuildLoopOrchestrator |
| DevelopmentOrchestrator | Replace calls with BuildLoopOrchestrator |
| FixOrchestrator | Add `mode: 'fix'` to BuildLoopOrchestrator |
| CaptureOrchestrator | Add import phase to BuildLoopOrchestrator |
| AgentOrchestrator | Use BuildLoopOrchestrator's agent management |
| DeveloperModeOrchestrator | Thin wrapper over BuildLoopOrchestrator |

---

### GAP #4: FEATURE AGENTS USE WRONG ORCHESTRATOR

**Current**: `FeatureAgentService.startImplementation()` uses `DevelopmentOrchestrator`

**Required**: Should create and use `BuildLoopOrchestrator`

**Location**: `server/src/services/feature-agent/feature-agent-service.ts`

---

### GAP #5: FIX MY APP SEPARATE FROM BUILD LOOP

**Current**: `FixOrchestrator` has its own logic

**Required**: `BuildLoopOrchestrator` with `mode: 'fix'` that:
1. Imports project (from ZIP, GitHub, other AI builder)
2. Analyzes chat history to determine original intent
3. Creates Intent Lock from inferred intent
4. Runs 6-phase build to complete/fix the app

---

## 🟡 P2 MEDIUM PRIORITY

### GAP #6: ORPHANED ADVANCED FEATURES

These exist but aren't called during builds:

```
Phase 0 Integration Points:
  - Voice Architect (voice input)
  - Clone Mode (video input)
  - User Twin (persona)

Phase 1 Integration Points:
  - Context Bridge (external code import)

Phase 2 Integration Points:
  - Image-to-Code (when images in prompt)
  - API Autopilot (API integrations)

Phase 5 Integration Points:
  - Market Fit Oracle (validation)
```

---

### GAP #7: CREDENTIAL COLLECTION NOT IN BUILD

**Current**: CredentialVault methods exist but not called in build flow

**Required**: Phase 1 should:
```typescript
// In executePhase1_Initialization():
await this.loadProjectCredentials();
await this.writeCredentialsToEnv(this.projectPath);
```

---

### GAP #8: EXPERIENCE CAPTURE NOT INSTANTIATED

**Current**: `createExperienceCaptureService` imported but not used

**Required**: Phase 8 should capture build experience:
```typescript
// After build completion:
await this.experienceCapture.captureExperience({
    buildId: this.state.id,
    intentContract: this.state.intentContract,
    featuresBuilt: this.state.featureSummary,
    verificationResults: swarmResults,
    duration: this.state.completedAt - this.state.startedAt
});
```

---

## 🟢 P3 LOW PRIORITY

### GAP #9: KTN STREAMING DOESN'T WRITE FILES

The `/api/krip-toe-nite/generate` endpoint streams code for display but doesn't write files.

**Options**:
1. Add file writing after KTN stream completes
2. Document that KTN is presentation-only (actual builds use Feature Agent flow)

---

### GAP #10: DUPLICATE FEATURE AGENT ROUTES

Both exist:
- `/api/developer-mode/feature-agent/*`
- `/api/feature-agent/*`

**Fix**: Consolidate to one route, deprecate the other

---

## COMPLETION CHECKLIST

### Infrastructure (95% Done ✅)
- [x] Intent Lock Engine
- [x] Feature List Manager
- [x] Verification Swarm (6 agents)
- [x] Error Escalation (4 levels)
- [x] Anti-Slop Detection
- [x] Learning Engine (5 layers)
- [x] Ghost Mode Controller
- [x] Speed Dial (4 modes)
- [x] Time Machine Checkpoints
- [x] Credential Vault (storage)
- [x] Browser Automation Service
- [x] Preview Service
- [x] Gap Closer Agents (7)
- [x] Streaming Feedback Channel
- [x] Continuous Verification
- [x] Human Checkpoints
- [x] Multi-Agent Judging
- [x] Error Pattern Library

### Wiring (5% Missing ❌)
- [ ] **P0**: fs.writeFile() for generated artifacts
- [ ] **P0**: Builder View → /api/execute wiring
- [ ] **P1**: Merge all orchestrators into one
- [ ] **P1**: Feature Agents use BuildLoopOrchestrator
- [ ] **P1**: Fix My App uses BuildLoopOrchestrator
- [ ] **P2**: Orphaned features integrated
- [ ] **P2**: Credential collection in build flow
- [ ] **P2**: Experience capture instantiated

---

## QUICK WINS (Can Fix Today)

1. **Add fs.writeFile() in worker-agent.ts** - 10 lines of code
2. **Wire Builder View to /api/execute** - Change one function call
3. **Add credential loading to Phase 1** - Methods already exist, just call them

These 3 fixes would make the system actually work end-to-end.
