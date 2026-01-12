# Builder View Production Blockers - Complete Analysis

> **CRITICAL DOCUMENT**: This comprehensive analysis identifies every blocker preventing KripTik AI's Builder View from achieving production-ready NLP-to-completion functionality.

**Analysis Date**: 2026-01-12
**Analyzed By**: Claude Opus 4.5
**Branch**: `claude/kristin-nlp-builder-analysis-iNQaf`

---

## EXECUTIVE SUMMARY

KripTik AI has **sophisticated architecture** with 91+ features implemented, but **critical wiring gaps** prevent the intended end-to-end autonomous building experience. The system has:

- Intent Lock (Sacred Contract) - **WORKING**
- 6-Phase Build Loop - **PARTIALLY WORKING**
- Verification Swarm - **WORKING**
- Deep Intent Satisfaction - **WORKING**
- Plan Approval Flow - **WORKING**
- Credential Collection - **WIRING ISSUES**
- File Writing to Disk - **CRITICAL GAP**

---

## INTENDED WORKFLOW (How It Should Work)

```
1. User enters NLP in Builder View chat
   ↓
2. User selects "Multi-Agent Orchestration" or "Kriptoenite"
   ↓
3. POST /api/execute/plan → Generate plan + create Deep Intent Lock
   ↓
4. User reviews and approves implementation plan
   ↓
5. ProductionStackWizard opens → User selects auth, database, storage, payments, email, hosting
   ↓
6. Credentials merged from: (a) Deep Intent detection + (b) Stack selection
   ↓
7. CredentialsCollectionView shows → User provides API keys
   ↓
8. POST /api/execute/plan/:sessionId/credentials → Write to .env + start build
   ↓
9. BuildLoopOrchestrator executes 6-phase build with all 91 features
   ↓
10. Files written to disk → Verification Swarm validates → Intent Satisfaction gate
   ↓
11. Browser Demo shows working app → User clicks "Take Control"
```

---

## PART 1: CRITICAL BLOCKERS (P0)

### BLOCKER #1: Generated Code NOT Written to Disk

**Severity**: P0 CRITICAL - Stops entire flow
**Location**: `server/src/services/automation/build-loop.ts` line 4379-4495

**The Problem**:

In `BuildLoopOrchestrator.buildFeature()`:
```typescript
// Line 4426: Parse files from AI response
const files = this.claudeService.parseFileOperations(responseContent);

// Lines 4430-4435: Store in MEMORY only
for (const file of files) {
    const content = file.content || '';
    generatedFiles.set(file.path, content);
    this.projectFiles.set(file.path, content);  // ← Memory only!
}
// NO fs.writeFile() CALL!
```

**Evidence**: Line 5181-5182 contains this comment:
```typescript
// In a real implementation, this would write to the filesystem
console.log(`[BuildLoop] Applied ${change.action} to ${change.path}`);
```

This **explicitly acknowledges files are NOT written to disk**.

**Contrast with Working Code**:
- `worker-agent.ts` line 260: Uses `fs.writeFile()` - BUT not used by BuildLoopOrchestrator
- `build-loop.ts` line 2483: LATTICE writes files - BUT LATTICE is optional
- `initializer-agent.ts` line 623: Uses `fs.writeFile()` - BUT only for scaffolding

**Impact**: AI generates code but nothing is saved. User ends up with empty project.

**Fix Required**:
```typescript
// After line 4435, add:
for (const file of files) {
    const fullPath = path.join(this.projectPath, file.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf-8');
    console.log(`[BuildLoop] Wrote file: ${file.path}`);
}
```

---

### BLOCKER #2: ArtifactManager Missing projectPath

**Severity**: P0 CRITICAL
**Location**: `server/src/services/automation/build-loop.ts` line 962

**The Problem**:

```typescript
// Line 962 - No projectPath passed!
this.artifactManager = createArtifactManager(projectId, orchestrationRunId, userId);
// Should be:
this.artifactManager = createArtifactManager(projectId, orchestrationRunId, userId, {
    projectPath: this.projectPath,
    syncToFilesystem: true,
});
```

**Why It Matters**:

`ArtifactManager.saveArtifact()` (artifacts.ts line 376) has HYBRID storage:
- Database: Always saves
- Filesystem: Only if `syncToFilesystem === true && projectPath` is set

Without `projectPath`, all artifacts go to database only - agents can't read them from filesystem.

---

### BLOCKER #3: ProductionStackWizard Opening But Not Integrated

**Severity**: P0 HIGH
**Location**: `src/components/builder/ChatInterface.tsx` line 757

**The Problem**:

```typescript
// Line 757: openWizard is called
openWizard(currentProjectId, currentStack);
```

The wizard OPENS but:
1. `currentStack` is undefined at this point (line 743)
2. No endpoint to submit stack selection to backend
3. Stack selection not merged with credential requirements on backend

**Current Flow**:
```
openWizard() called → Wizard opens → User configures stack → ???
```

The useEffect at lines 418-488 DOES handle wizard completion:
```typescript
useEffect(() => {
    if (buildWorkflowPhase === 'configuring_stack' && !isWizardOpen && currentStack?.isConfigured) {
        // Merge credentials from stack selection (lines 425-472)
        setBuildWorkflowPhase('awaiting_credentials');
    }
}, [...]);
```

**BUT**: Backend never receives the stack selection. It uses the original `requiredCredentials` from Deep Intent analysis, not the user's actual stack choices.

**Fix Required**:
1. Create `/api/execute/plan/:sessionId/stack` endpoint
2. Submit stack selection to backend
3. Recalculate credentials based on selected providers
4. Return updated credential list to frontend

---

## PART 2: HIGH PRIORITY BLOCKERS (P1)

### BLOCKER #4: Deep Intent Credential Detection vs Stack Selection Mismatch

**Severity**: P1 HIGH
**Location**: `server/src/routes/execute.ts` line 2070

**The Problem**:

```typescript
// Line 2070: Credentials from AI analysis of prompt
const requiredCredentials = extractCredentialsFromDeepIntent(deepIntent, prompt);
```

This uses AI analysis of the NLP prompt. But:
- User says "payments" → AI detects Stripe
- User selects Paddle in wizard → Still gets Stripe credentials

**Example**:
```
User: "Build a SaaS with payments and email"
AI detects: Stripe + SendGrid
User selects in wizard: Paddle + Resend
Build uses: Stripe + SendGrid (wrong!)
```

**Fix Required**:
After stack selection, call:
```typescript
const finalCredentials = mergeCredentialsWithStackSelection(
    deepIntentCredentials,
    stackSelection
);
```

---

### BLOCKER #5: Credentials Not Validated Against Stack

**Severity**: P1 HIGH
**Location**: `server/src/services/automation/build-loop.ts` line 1794-1800

**The Problem**:

```typescript
// Phase 1 loads whatever credentials were submitted
await this.loadProjectCredentials();
if (this.loadedCredentials.size > 0) {
    await this.writeCredentialsToEnv(this.projectPath);
}
```

No validation that:
1. All required credentials for selected stack are present
2. Credentials match the services being used
3. Critical credentials don't have placeholder values

**Impact**: Build proceeds with missing/wrong credentials → Runtime failures

---

### BLOCKER #6: No Build Feedback Loop for Credential Errors

**Severity**: P1 HIGH

**The Problem**:

When build fails due to missing credentials:
1. Error is logged server-side
2. User sees generic "build failed" message
3. No specific guidance on which credential is missing

**Fix Required**:
- Detect credential-related errors (401, 403, missing env var)
- Map error to specific credential name
- Send notification: "Build paused - STRIPE_API_KEY required"
- Allow user to add credential and resume

---

## PART 3: MEDIUM PRIORITY ISSUES (P2)

### ISSUE #7: ProjectPath Not Consistently Passed

**Severity**: P2 MEDIUM
**Location**: Multiple files

`projectPath` is used inconsistently:
- BuildLoopOrchestrator constructor receives it (line 916)
- KTN buildFeature receives it (line 4406) ✓
- ArtifactManager does NOT receive it (line 962) ✗
- InitializerAgent receives it ✓
- CodingAgentWrapper sometimes receives it

**Fix Required**: Audit all service instantiations and pass `projectPath` consistently.

---

### ISSUE #8: Speculative Results Have Same File Writing Problem

**Severity**: P2 MEDIUM
**Location**: `build-loop.ts` line 4291-4294

```typescript
for (const file of speculativeResult.files) {
    generatedFiles.set(file.path, file.content);
    this.projectFiles.set(file.path, file.content);  // Memory only!
    await this.artifactManager.saveArtifact(file.path, file.content);  // DB only if no projectPath!
}
```

Same problem - no `fs.writeFile()`.

---

### ISSUE #9: Build Mode Not Propagating Production Options

**Severity**: P2 MEDIUM
**Location**: `execute.ts` line 2271

```typescript
const buildLoop = new BuildLoopOrchestrator(
    context.projectId,
    context.userId,
    context.orchestrationRunId,
    'production',  // ← Hardcoded, not from user selection
    { ... }
);
```

User's Speed Dial selection (lightning/standard/tournament/production) isn't passed to build.

---

### ISSUE #10: WebSocket Channel Not Persisted

**Severity**: P2 MEDIUM

If user closes browser during build:
1. WebSocket disconnects
2. No way to reconnect to same channel
3. User loses visibility into build progress

Should: Store channel ID in database, allow reconnection.

---

## PART 4: THE COMPLETE FLOW (What Actually Happens)

### Current Flow (With Blockers Marked):

```
1. User enters NLP in Builder View chat
   ↓
2. User selects "Multi-Agent Orchestration"
   ↓
3. POST /api/execute/plan
   ✓ Generate plan
   ✓ Create Deep Intent Lock
   ✓ Extract credentials from AI analysis
   ↓
4. User reviews plan → Clicks Approve
   ↓
5. ProductionStackWizard opens
   ⚠️ currentStack undefined
   ⚠️ Stack selection not sent to backend
   ↓
6. Credentials merged (frontend only)
   ✓ useEffect detects wizard closed
   ✓ Merges credentials locally
   ⚠️ Backend still has original credentials
   ↓
7. CredentialsCollectionView shows
   ✓ User enters values
   ✓ Frontend submits to backend
   ↓
8. POST /api/execute/plan/:sessionId/credentials
   ✓ Credentials written to .env
   ✓ BuildLoopOrchestrator created
   ⚠️ ArtifactManager missing projectPath
   ↓
9. BuildLoopOrchestrator.start()
   ✓ Phase 0: Intent Lock verified
   ✓ Phase 1: Initialization (scaffolding written ✓)
   ✓ Phase 2: buildFeature() called
   ❌ Generated code NOT written to disk
   ✓ Verification runs (on empty files)
   ↓
10. Phase 3-5: Run on empty/missing files
   ❌ Integration check finds nothing
   ❌ Functional test fails
   ❌ Intent Satisfaction fails
   ↓
11. Build marked as failed
   User has empty project
```

---

## PART 5: FIX IMPLEMENTATION ORDER

### Phase 1: Critical Fixes (Day 1)

1. **Add fs.writeFile() to buildFeature()**
   - File: `build-loop.ts` after line 4435
   - Impact: Code actually persists

2. **Pass projectPath to ArtifactManager**
   - File: `build-loop.ts` line 962
   - Impact: Artifacts written to filesystem

3. **Add fs.writeFile() to applySpeculativeResult()**
   - File: `build-loop.ts` after line 4294
   - Impact: Speculative code persists

### Phase 2: Integration Fixes (Day 2)

4. **Create /api/execute/plan/:sessionId/stack endpoint**
   - File: `execute.ts`
   - Impact: Backend receives stack selection

5. **Merge stack credentials on backend**
   - File: `execute.ts`
   - Impact: Correct credentials for user's choices

6. **Validate credentials match stack**
   - File: `build-loop.ts`
   - Impact: Build fails early with clear message

### Phase 3: Polish (Day 3)

7. **Add credential error detection**
8. **Allow credential addition mid-build**
9. **Persist WebSocket channel for reconnection**
10. **Pass Speed Dial selection to build mode**

---

## VERIFICATION CHECKLIST

After implementing fixes, verify:

```
[ ] User enters NLP → Plan shows in 5 seconds
[ ] User approves plan → Wizard opens
[ ] User configures stack → Credentials show correct services
[ ] User enters credentials → Build starts
[ ] Build creates files on disk (not just database)
[ ] Files visible in project directory
[ ] Verification Swarm runs on real files
[ ] Intent Satisfaction checks real app
[ ] Browser Demo shows working app
[ ] "Take Control" works
```

---

## CODE LOCATIONS REFERENCE

| Component | File | Key Lines |
|-----------|------|-----------|
| Chat Entry | `src/components/builder/ChatInterface.tsx` | 610-719, 757, 799-830 |
| Plan Generation | `server/src/routes/execute.ts` | 2030-2101 |
| Plan Approval | `server/src/routes/execute.ts` | 2108-2383 |
| Credential Submit | `server/src/routes/execute.ts` | 2390-2600 |
| Build Loop | `server/src/services/automation/build-loop.ts` | 4379-4495 |
| Feature Build | `server/src/services/automation/build-loop.ts` | 4379-4495 |
| File Writing (Missing) | `server/src/services/automation/build-loop.ts` | After 4435 |
| Artifact Manager | `server/src/services/ai/artifacts.ts` | 376-430 |
| Worker Agent (Reference) | `server/src/services/orchestration/agents/worker-agent.ts` | 250-268 |
| Stack Wizard | `src/components/production-stack/ProductionStackWizard.tsx` | - |
| Stack Store | `src/store/useProductionStackStore.ts` | 610+ |

---

## CONCLUSION

The most critical issue is **files not being written to disk** in the main `buildFeature()` method. This single fix would allow the rest of the sophisticated architecture to function. The secondary issues around stack selection and credential merging can be fixed incrementally.

**Recommended approach**:
1. Fix file writing (30 minutes)
2. Test full flow with manual credential entry
3. Fix stack selection integration
4. Polish error handling

The architecture is sound. The wiring is incomplete. These are fixable gaps, not fundamental design problems.

---

*This document should be referenced when implementing the NLP-to-completion flow fixes.*

*Last Updated: 2026-01-12*
