# NLP-to-Completion Gap Analysis - KripTik AI

> **CRITICAL DOCUMENT**: This file identifies all gaps between the current implementation and the intended workflow where a user enters an NLP prompt and receives a fully working, verified, production-ready application or feature.

**Analysis Date**: 2025-12-20
**Analysis Scope**: Complete end-to-end flow from NLP input to completion

---

## EXECUTIVE SUMMARY

KripTik AI has **sophisticated architecture** but **critical wiring gaps** that prevent the intended end-to-end autonomous building experience. The main issues are:

1. **Builder View uses wrong orchestrator** - Uses DevelopmentOrchestrator instead of BuildLoopOrchestrator
2. **Feature Agents work in isolation** - No context sharing between parallel agents
3. **No real-time preview during builds** - Users only see completed features, not building progress
4. **Extension credential capture broken** - Vision extraction endpoint missing
5. **Verification can be bypassed** - Fallback behaviors allow progression despite failures
6. **Context systems fragmented** - Two incompatible context architectures

---

## PART 1: BUILDER VIEW NLP ORCHESTRATION

### Intended Behavior
User enters NLP in Builder View chat → Multi-agent orchestration with 6-phase build loop → Intent Lock → Verification Swarm → Browser Demo → Production-ready app

### Current Reality

**The Builder View chat does NOT use the 6-Phase BuildLoopOrchestrator.**

| Selection | What Gets Called | What Should Be Called |
|-----------|------------------|----------------------|
| Krip-Toe-Nite | `/api/krip-toe-nite/generate` | OK for quick generation |
| Multi-Agent | `DevelopmentOrchestrator.processRequest()` | `BuildLoopOrchestrator.start()` |

### Gap B1: DevelopmentOrchestrator vs BuildLoopOrchestrator

**DevelopmentOrchestrator** (what's used):
- Task-based decomposition (Epic → Story → Task)
- Architecture Decision Records generation
- Quality gates after each phase
- **NO Intent Satisfaction gate**
- **NO Learning Engine integration**
- **NO Time Machine checkpoints**
- **NO Browser demo phase**

**BuildLoopOrchestrator** (what should be used):
- 6-phase immutable build loop
- Intent Lock contracts (Sacred Contract)
- Phase 5: Intent Satisfaction (critical gate)
- Phase 6: Browser Demo (show user the working app)
- Learning Engine integration
- Time Machine checkpoints
- Full error escalation pipeline

### Gap B2: No Route from Chat to BuildLoop

**Current flow:**
```
ChatInterface.tsx → orchestrator.start()
  → POST /api/orchestrate/analyze
  → DevelopmentOrchestrator.processRequest()
```

**Missing flow:**
```
ChatInterface.tsx → buildLoop.start()
  → POST /api/execute with 6-phase config
  → BuildLoopOrchestrator.start()
```

### Gap B3: No Production Options Selection

The intended workflow includes:
- User selects production options (deployment target, features, etc.)
- User approves implementation plan
- User provides credentials

**Current state:**
- No production options selection in Builder View
- No implementation plan approval before build
- No credential collection flow for Builder View (only Feature Agent has this)

---

## PART 2: FEATURE AGENT SYSTEM

### Intended Behavior
Up to 6 parallel agents share context/memory, communicate live, follow orchestration loop, verify before done, show user in agent-controlled browser

### Current Reality

### Gap F1: No Server-Side 6-Agent Limit

**Problem:**
- Only UI enforces max 6 agents (line 726 in FeatureAgentCommandCenter.tsx)
- No backend check in `/api/developer-mode/feature-agent`
- Direct API calls can bypass limit
- Multiple browser tabs can deploy >6 agents

**Impact:** Resource abuse, system instability

### Gap F2: Agents Work in Complete Isolation

**Current architecture:**
```typescript
// feature-agent-service.ts line 223
private agents: Map<string, FeatureAgentRuntime> = new Map();
```

Each agent has:
- Separate runtime instance
- Separate Intent Lock contract
- Separate Build Loop
- **NO shared state**
- **NO coordination**
- **NO learning transfer**

**Missing:**
- Shared error pattern library between agents
- File lock coordination
- Context merging from completed agents
- Priority/coordination for same-file modifications

### Gap F3: No Real Parallel Agent Spawning

**Plan recommends parallel agents:**
```typescript
parallelAgentsNeeded: Math.max(1, Math.min(6, 2)),  // Always 2
```

**But reality:**
- No mechanism to spawn sub-agents for phases
- Single agent does everything sequentially
- `parallelAgents: string[]` field unused

### Gap F4: "Show Me" Sandbox Route Missing

**UI exists:**
```typescript
// FeatureAgentTile.tsx lines 400-408
<button onClick={() => setShowPreviewWindow(true)}>
  See Feature In Browser
</button>
```

**Backend missing:**
- `/sandbox/:agentId` route NOT implemented
- FeaturePreviewWindow points to non-existent sandbox

### Gap F5: Plan Modifications Not Persisted

- Users can modify phases in ImplementationPlanView
- Modifications sent to API but not saved to database
- If user refreshes, modifications lost
- Build uses original plan, not modified plan

### Gap F6: Ghost Mode is UI Only

- Config saved to agent runtime
- Wake conditions registered
- **Build loop doesn't check ghost mode state**
- No actual "autonomous background execution"
- No pause/resume hooks
- No budget tracking mid-execution

### Gap F7: Merge/PR Integration is Stubbed

```typescript
// feature-agent-service.ts lines 1484-1527
async acceptAndMerge(agentId: string): Promise<MergeResult> {
  // Returns { mergeId, status: 'merged' }
  // NO actual GitHub PR creation!
}
```

---

## PART 3: BUILD LOOP & VERIFICATION

### Intended Behavior
Never done until actually done - verification gates cannot be bypassed, infinite escalation until fixed

### Current Reality

### Gap V1: Verification Fallback Bypasses Gates

**Visual Verifier** (swarm.ts, lines 833-842):
```typescript
catch (error) {
  return { passed: true, score: 70 };  // PASSES on error!
}
```

**Design Style Agent** (swarm.ts, lines 1075-1084):
```typescript
catch (error) {
  return { passed: true, score: 85 };  // PASSES on error!
}
```

**Impact:** Features can pass verification when checkers crash.

### Gap V2: Phase 5 Escalation Has Hard Limit

```typescript
// build-loop.ts lines 1659-1678
if (this.state.escalationLevel < 3) {
  // Retry
} else {
  throw new Error('Maximum escalation attempts reached');
}
```

**Problem:** Only 3 retries, then fails. Not "never done until done."

### Gap V3: Integration Check Doesn't Block

```typescript
const issues = await this.runIntegrationCheck();
// Even with issues, phase completes!
this.completePhase('integration_check');
```

**Impact:** Build continues despite unfixed integration issues.

### Gap V4: Error Escalation Level 4 Gets Only 1 Attempt

```typescript
// Level 4: Full feature rebuild
{ level: 4, maxAttempts: 1, model: 'opus' }
```

If rebuild fails → build fails. Not infinite until fixed.

### Gap V5: No Minimum Feature Pass Rate Enforced

Build can proceed to next stage even if only some features pass. No threshold check.

---

## PART 4: CREDENTIAL VAULT

### Intended Behavior
Extension helps fetch credentials, stored securely, injected into builds

### Current Reality

### Gap C1: Extension Vision Extraction Endpoint Missing

**Extension calls:**
```javascript
await this.sendToVisionAPI('/api/extension/vision-extract', screenshot)
```

**Server:** Endpoint doesn't exist. Vision capture goes to `/api/extension/vision-capture/*` but credential extraction is different.

### Gap C2: Extension Credentials Not Linked to Feature Agent

**Two separate systems:**
- Extension → `/api/extension/credentials` → filesystem (base64, not encrypted)
- Feature Agent → `/api/developer-mode/feature-agent/:id/credentials` → Credential Vault (AES-256-GCM)

**No bridge between them.**

### Gap C3: .ENV File Stores Plaintext Secrets

```typescript
// upsertProjectEnv() writes credentials to files table
// Unencrypted in database!
```

Anyone with database access can read build secrets.

### Gap C4: Weak Development Encryption Key Fallback

```typescript
if (!keyHex) {
  const devSecret = process.env.BETTER_AUTH_SECRET || 'dev-secret-key';
  return crypto.createHash('sha256').update(devSecret).digest();
}
```

No enforcement of strong VAULT_ENCRYPTION_KEY in production.

### Gap C5: Credential Linking Incomplete

POST `/api/credentials/:integrationId/link` returns success but doesn't actually save mappings.

---

## PART 5: LIVE UI PREVIEW

### Intended Behavior
User sees app being built in real-time, agent-controlled browser shows working feature

### Current Reality

### Gap P1: No Real-Time Preview During Building

- Sandbox exists but not shown during Phase 2 (Parallel Build)
- BrowserInLoopService architecture exists but NOT integrated
- Users only see completed features at Phase 6

**Current:** Screenshot-only at completion
**Intended:** Live streaming preview during build

### Gap P2: BrowserInLoopService Unused

706 lines of sophisticated browser-in-the-loop verification:
- Continuous visual verification every 30 seconds
- Anti-slop pattern detection in DOM
- Layout and accessibility checks
- Visual score calculation

**Status:** Not instantiated in build-loop.ts

### Gap P3: No Agent Visual Feedback Loop

Building agents work "blind":
- Don't receive visual verification scores during build
- Anti-slop detector feedback not streamed to agents
- Verification happens AFTER building, not during

### Gap P4: Screenshot Latency

AI demo uses base64 screenshots:
- ~300ms latency between action and visual
- Not true live preview
- Would need WebRTC or streaming video for real-time

---

## PART 6: MEMORY/CONTEXT HARNESS

### Intended Behavior
Agents share context, never run out of memory, use harness system for unlimited context

### Current Reality

### Gap M1: Two Incompatible Context Systems

**System A: File-Based (LoadedContext)**
- Used by agents
- Loads from `.cursor/` artifacts
- 9 artifact files

**System B: Database-Driven (UnifiedContext)**
- 14 data sources
- Rarely called
- Includes learning patterns, strategies, judge decisions

**Problem:** No sync between them. Learning data never reaches agents.

### Gap M2: Unified Context Unused

```typescript
// Defined but never called by CodingAgentWrapper:
loadUnifiedContext(projectId, userId, projectPath, options)

// What gets called instead:
loadProjectContext(projectPath, options)  // Only from .cursor/
```

### Gap M3: Token Management Not Enforced

"84% token reduction" via context editing rules:
```typescript
export const DEFAULT_CONTEXT_EDITS: ContextEditRule[] = [...]
```

**Problem:** Rules defined but no evidence they're applied to API calls.

### Gap M4: No Real-Time Context Sharing

If 6 agents run in parallel:
- Agent 1 finds solution
- Agents 2-6 don't know
- Each solves independently
- No learning transfer

### Gap M5: "Never Runs Out" Not Implemented

What EXISTS:
- Context editing rules (defined, unclear if applied)
- Summarization (Feature Agent only)
- File-based artifacts

What's MISSING:
- No token counting per session
- No automatic cleanup triggers
- No monitoring of context growth
- No fallback at limits

**Reality:** Agents reset context between sessions. Not "never runs out" but "resets on handoff."

---

## PART 7: INTENDED WORKFLOW vs CURRENT STATE

### INTENDED WORKFLOW (From User Description)

**Builder View (Full Apps):**
1. User enters NLP in builder view chat
2. Multiagent orchestration or Kriptoenite selection
3. Sacred Contract (Intent Lock) created
4. User presented with production options
5. User approves implementation plan
6. User asked for env variables (extension helps fetch)
7. Credentials stored in vault + .env
8. Full orchestration runs with verification, browser feedback, error checking
9. Agent-controlled browser shows working app
10. User can take control

**Feature Agent (Features):**
1. User clicks Feature Agent button on developer toolbar
2. Selects model, enters NLP
3. Deploy up to 6 parallel agents
4. Agents share context/memory, communicate live
5. Intent Lock creates implementation plan
6. User approves plan, provides credentials
7. Full orchestration with verification swarm
8. Each agent glows when done, "Show Me" button appears
9. Agent-controlled browser demonstrates feature
10. User takes control

### CURRENT STATE (What Actually Works)

**Builder View:**
- User enters NLP → DevelopmentOrchestrator runs (wrong orchestrator)
- No production options selection
- No implementation plan approval
- No credential collection
- No Intent Satisfaction gate (Phase 5)
- No Browser Demo (Phase 6)
- No agent-controlled browser

**Feature Agent:**
- User deploys agent → Intent Lock + Plan approval works
- Credential collection works (manual entry only)
- Build loop runs
- **6-agent limit UI only**
- **Agents don't share context**
- **"Show Me" sandbox route missing**
- **Merge doesn't create PR**
- **Ghost Mode UI only**

---

## PART 8: PRIORITY FIX LIST

### P0 - CRITICAL (Breaks Core Flow)

1. **Wire Builder View to BuildLoopOrchestrator**
   - Current: Uses DevelopmentOrchestrator
   - Fix: Add route from chat → `/api/execute` with 6-phase loop
   - Impact: Enables Intent Satisfaction gate, Browser Demo, Learning Engine

2. **Implement /sandbox/:agentId route**
   - Current: FeaturePreviewWindow points to non-existent route
   - Fix: Add preview routes for Feature Agent sandboxes
   - Impact: "Show Me" button works

3. **Add server-side 6-agent limit**
   - Current: UI-only enforcement
   - Fix: Check in POST `/api/developer-mode/feature-agent`
   - Impact: Prevents resource abuse

4. **Implement extension vision-extract endpoint**
   - Current: Extension calls non-existent endpoint
   - Fix: Add `/api/extension/vision-extract` with vision API
   - Impact: Extension credential capture works

### P1 - HIGH (Breaks Quality Guarantees)

5. **Fix verification fallback behaviors**
   - Current: Verifiers pass on crash
   - Fix: Return null/throw, escalate properly
   - Impact: Quality gates can't be bypassed

6. **Increase Phase 5 escalation limit**
   - Current: 3 retries then fail
   - Fix: 5-10 retries or exponential backoff
   - Impact: "Never done until done" philosophy

7. **Encrypt .env file storage**
   - Current: Plaintext in files table
   - Fix: Encrypt before storage
   - Impact: Secrets not exposed in database

8. **Bridge extension ↔ feature agent credentials**
   - Current: Two separate systems
   - Fix: Sync extension-captured credentials to vault
   - Impact: Extension credential flow works

### P2 - MEDIUM (Limits Capabilities)

9. **Activate BrowserInLoopService**
   - Current: 706 lines unused
   - Fix: Instantiate in build-loop Phase 2
   - Impact: Real-time visual feedback during build

10. **Implement inter-agent context sharing**
    - Current: Agents work in isolation
    - Fix: Shared error patterns, file locking
    - Impact: Parallel agents don't conflict

11. **Connect UnifiedContext to agents**
    - Current: Two incompatible context systems
    - Fix: Load UnifiedContext in CodingAgentWrapper
    - Impact: Learning patterns reach agents

12. **Implement actual merge/PR creation**
    - Current: Stubbed out
    - Fix: Use @octokit/rest for GitHub
    - Impact: Feature Agent merge actually works

### P3 - IMPROVEMENTS

13. **Add production options selection to Builder**
14. **Implement parallel sub-agent spawning**
15. **Add real-time preview streaming during build**
16. **Implement Ghost Mode background execution**
17. **Persist plan modifications to database**
18. **Add token usage monitoring**

---

## APPENDIX: FILE LOCATIONS

| System | Key Files |
|--------|-----------|
| Builder Chat | `src/components/builder/ChatInterface.tsx` |
| Orchestrators | `server/src/services/orchestration/development-orchestrator.ts`, `server/src/services/automation/build-loop.ts` |
| Feature Agent | `server/src/services/feature-agent/feature-agent-service.ts`, `src/components/feature-agent/` |
| Verification | `server/src/services/verification/swarm.ts`, `browser-in-loop.ts` |
| Credentials | `server/src/services/security/credential-vault.ts`, `server/src/routes/credentials.ts` |
| Preview | `server/src/services/preview/headless-preview-service.ts`, `src/components/feature-agent/FeaturePreviewWindow.tsx` |
| Context | `server/src/services/context/context-loader.ts`, `unified-context.ts`, `coding-agent-wrapper.ts` |

---

*This document should be referenced before any work on the NLP-to-completion flow. All agents should be aware of these gaps.*

*Last Updated: 2025-12-20*
