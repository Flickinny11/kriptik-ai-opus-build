# Feature Agent Production-Ready Implementation Plan

> **Goal**: Complete NLP-to-production-ready feature implementation workflow
> **Date**: 2026-01-13
> **Status**: IMPLEMENTATION PLAN (Do Not Execute Yet)

---

## EXECUTIVE SUMMARY

The Feature Agent system is **85% built** but has **critical gaps** preventing production use:

| Gap | Severity | Impact |
|-----|----------|--------|
| Preview URL hardcoded to localhost:3100 | **CRITICAL** | "Show Me" button doesn't work |
| No sandbox creation during build | **CRITICAL** | No live preview available |
| Plan modifications not persisted | **HIGH** | User loses changes on refresh |
| Escalation limited to 3 rounds | **HIGH** | Features may fail that could be fixed |
| OAuth integration incomplete | **MEDIUM** | Manual credential entry required |
| Merge status not verified | **MEDIUM** | Can't confirm merge succeeded |

---

## PART 1: CRITICAL FIXES

### Fix 1.1: Wire Preview Window to Real Sandbox

**Problem**: `sandboxUrl={`http://localhost:3100`}` is hardcoded in FeatureAgentTile.tsx:559

**Current Flow** (Broken):
```
User clicks "See Feature In Browser"
  → FeaturePreviewWindow opens
  → sandboxUrl = "http://localhost:3100" (hardcoded!)
  → iframe shows nothing or wrong content
```

**Required Flow**:
```
User clicks "See Feature In Browser"
  → Fetch /api/feature-agent/:agentId/preview
  → If no sandbox, create one via /api/developer-mode/sandbox
  → Get actual sandbox URL (http://localhost:{port})
  → FeaturePreviewWindow opens with real URL
  → iframe shows the actual built feature
```

**Files to Modify**:

1. **`src/components/feature-agent/FeatureAgentTile.tsx`**
   - Add state: `const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);`
   - Add state: `const [isLoadingPreview, setIsLoadingPreview] = useState(false);`
   - Create function to fetch preview URL:
   ```typescript
   const fetchPreviewUrl = async () => {
     setIsLoadingPreview(true);
     try {
       // First check if sandbox exists
       const previewResp = await apiClient.get(`/api/feature-agent/${agentId}/preview`);
       if (previewResp.data.sandboxUrl) {
         setSandboxUrl(previewResp.data.sandboxUrl);
       } else if (previewResp.data.sessionId) {
         // Create sandbox if needed
         const sandboxResp = await apiClient.post('/api/developer-mode/sandbox', {
           sessionId: previewResp.data.sessionId,
           projectPath: tile.projectPath
         });
         if (sandboxResp.data.sandbox?.url) {
           setSandboxUrl(sandboxResp.data.sandbox.url);
         }
       }
     } catch (error) {
       console.error('[FeatureAgentTile] Failed to get preview URL:', error);
       addMessage(agentId, {
         type: 'error',
         content: 'Failed to load preview. Please try again.',
         timestamp: Date.now()
       });
     } finally {
       setIsLoadingPreview(false);
     }
   };
   ```
   - Update button click to call `fetchPreviewUrl()` before opening preview
   - Pass actual `sandboxUrl` to FeaturePreviewWindow instead of hardcoded value

2. **`server/src/routes/feature-agent.ts`** (Preview endpoint)
   - Currently returns `{ success: true, sessionId, note: "Use /api/developer-mode/sandbox..." }`
   - Should return actual sandbox URL or create sandbox if needed:
   ```typescript
   // GET /api/feature-agent/:agentId/preview
   router.get('/:agentId/preview', requireAuth, async (req, res) => {
     const agentId = req.params.agentId;
     const cfg = ensureOwner(req, res, agentId);
     if (!cfg) return;

     if (!cfg.sessionId) {
       return res.status(409).json({ error: 'No active session' });
     }

     // Get sandbox service
     const sandboxService = getSandboxService();
     await sandboxService.initialize();

     // Check for existing sandbox
     let sandbox = sandboxService.getSandbox(agentId);

     if (!sandbox) {
       // Get worktree path from Git branch manager
       const worktreePath = `/tmp/kriptik-sandboxes/${agentId}`;
       sandbox = await sandboxService.createSandbox(agentId, worktreePath);
     }

     if (sandbox.status === 'running') {
       return res.json({
         success: true,
         sandboxUrl: sandbox.url,
         status: sandbox.status
       });
     } else {
       return res.json({
         success: true,
         sandboxUrl: null,
         status: sandbox.status,
         error: sandbox.errorMessage
       });
     }
   });
   ```

3. **`src/components/feature-agent/FeaturePreviewWindow.tsx`**
   - Add loading state handling
   - Add error state for failed sandbox
   - Add retry button if sandbox fails to start

---

### Fix 1.2: Create Sandbox During Build (Phase 2)

**Problem**: No sandbox is created during the build, so there's nothing to preview.

**Current**: BuildLoopOrchestrator runs but doesn't create a sandbox for the feature agent.

**Required**: Sandbox should be created at start of Phase 2 (parallel_build) and kept running.

**Files to Modify**:

1. **`server/src/services/feature-agent/feature-agent-service.ts`**
   - After `startImplementation()` creates Git worktree, create sandbox:
   ```typescript
   // In startImplementation(), after Git branch creation (~line 1200):

   // Create sandbox for live preview during build
   const sandboxService = getSandboxService();
   await sandboxService.initialize();

   const sandbox = await sandboxService.createSandbox(
     agentId,
     rt.gitBranch.worktreePath
   );

   rt.sandboxId = sandbox.id;
   rt.sandboxUrl = sandbox.url;

   // Emit event so UI can show preview button early
   this.emitStreamEvent(agentId, {
     type: 'sandbox_ready',
     data: { sandboxUrl: sandbox.url }
   });
   ```

2. **`src/components/feature-agent/FeatureAgentTile.tsx`**
   - Listen for `sandbox_ready` event in SSE handler
   - Store sandboxUrl in tile state when received
   - Show "Preview" button as soon as sandbox is ready (not just when complete)

---

### Fix 1.3: Persist Plan Modifications to Database

**Problem**: User modifies implementation plan phases, but modifications only exist in UI state.

**Current**: Phase modifications stored in Zustand, lost on page refresh.

**Required**: Modifications should be persisted to database and restored on reload.

**Files to Modify**:

1. **`server/src/schema.ts`**
   - Add `modifiedPlan` column to featureAgents table (if not exists):
   ```typescript
   export const featureAgents = sqliteTable('feature_agents', {
     // ... existing columns ...
     modifiedPlan: text('modified_plan'), // JSON string of modified plan
   });
   ```

2. **`server/src/routes/feature-agent.ts`**
   - Add endpoint to persist plan modifications:
   ```typescript
   // POST /api/feature-agent/:agentId/plan/save
   router.post('/:agentId/plan/save', requireAuth, async (req, res) => {
     const agentId = req.params.agentId;
     const { modifiedPlan } = req.body;

     const cfg = ensureOwner(req, res, agentId);
     if (!cfg) return;

     // Save to database
     await db.update(featureAgents)
       .set({ modifiedPlan: JSON.stringify(modifiedPlan) })
       .where(eq(featureAgents.id, agentId));

     // Also update in-memory config
     cfg.implementationPlan = modifiedPlan;

     res.json({ success: true });
   });
   ```

3. **`src/components/feature-agent/ImplementationPlanView.tsx`**
   - After modifying a phase, call save endpoint:
   ```typescript
   const handlePhaseModification = async (phaseId: string, newContent: string) => {
     // Update local state
     const updatedPlan = { ...plan };
     // ... update the phase ...

     // Persist to backend
     await apiClient.post(`/api/feature-agent/${agentId}/plan/save`, {
       modifiedPlan: updatedPlan
     });
   };
   ```

4. **On agent reload**, fetch saved plan from database instead of regenerating.

---

### Fix 1.4: Remove Escalation Round Limit

**Problem**: `MAX_ESCALATION_ROUNDS = 3` in FeatureAgentService means builds fail after 3 escalation attempts.

**Philosophy**: "Never gives up" - should keep trying with exponential backoff.

**Files to Modify**:

1. **`server/src/services/feature-agent/feature-agent-service.ts`**
   - Change constant:
   ```typescript
   private readonly MAX_ESCALATION_ROUNDS = 10; // Was 3, now allows more attempts
   private readonly ESCALATION_DELAYS = [0, 5000, 10000, 20000, 40000, 60000, 120000]; // Exponential backoff
   ```
   - Add delay between escalation rounds:
   ```typescript
   // After failed escalation attempt:
   const delay = this.ESCALATION_DELAYS[Math.min(round, this.ESCALATION_DELAYS.length - 1)];
   if (delay > 0) {
     this.emitStreamEvent(agentId, {
       type: 'escalation_wait',
       data: { round, delay, message: `Waiting ${delay/1000}s before retry...` }
     });
     await sleep(delay);
   }
   ```
   - Add user notification after multiple failures:
   ```typescript
   if (round >= 5) {
     // Notify user via preferred channel
     await notificationService.notifyUser(rt.config.userId, {
       type: 'escalation_struggling',
       title: 'Build having difficulty',
       body: `Feature "${rt.config.name}" has attempted ${round} fixes. Consider modifying requirements.`,
       actionUrl: `/builder?project=${rt.config.projectId}&agent=${agentId}`
     });
   }
   ```

---

## PART 2: HIGH PRIORITY FIXES

### Fix 2.1: Wire OAuth Integration

**Problem**: OAuthConnectButton exists but integration with credential storage is unclear.

**Files to Check/Modify**:

1. **`src/components/feature-agent/OAuthConnectButton.tsx`**
   - Verify it calls `/api/oauth/connect/:provider`
   - Verify callback stores tokens in Credential Vault
   - Verify tokens are written to .env

2. **`server/src/routes/oauth.ts`** (if exists, or create)
   - Handle OAuth callbacks
   - Store tokens via `writeCredentialsToProjectEnv()`

3. **`src/components/feature-agent/CredentialsCollectionView.tsx`**
   - After successful OAuth, update UI to show connected status
   - Poll or use SSE to detect when OAuth completes

### Fix 2.2: Verify Merge Actually Succeeded

**Problem**: `acceptAndMerge()` returns success without verifying Git merge worked.

**Files to Modify**:

1. **`server/src/services/feature-agent/feature-agent-service.ts`**
   - In `acceptAndMerge()`, verify merge output:
   ```typescript
   const mergeResult = await rt.gitBranch.squashMerge(rt.featureBranchName);

   // Verify merge succeeded
   if (!mergeResult.success) {
     return {
       success: false,
       error: mergeResult.error || 'Merge failed',
       conflicts: mergeResult.conflicts
     };
   }

   // Verify files exist in main branch after merge
   const verifyResult = await this.verifyMerge(rt.config.projectPath, mergeResult.files);
   if (!verifyResult.allFilesPresent) {
     return {
       success: false,
       error: 'Merge verification failed - some files missing',
       missingFiles: verifyResult.missingFiles
     };
   }

   return {
     success: true,
     mergedFiles: mergeResult.files,
     commitHash: mergeResult.commitHash
   };
   ```

2. **`src/components/feature-agent/FeaturePreviewWindow.tsx`**
   - Handle merge failure gracefully:
   ```typescript
   const handleAccept = async () => {
     setIsAccepting(true);
     const result = await apiClient.post(`/api/feature-agent/${agentId}/accept-merge`);

     if (result.data.success) {
       onAccept();
     } else {
       // Show error to user
       setMergeError(result.data.error);
       setMergeConflicts(result.data.conflicts);
     }
     setIsAccepting(false);
   };
   ```

### Fix 2.3: Add Plan Rejection/Regeneration

**Problem**: User can only approve or modify individual phases, not reject entire plan.

**Files to Modify**:

1. **`src/components/feature-agent/ImplementationPlanView.tsx`**
   - Add "Reject & Regenerate" button:
   ```tsx
   <button
     onClick={handleRejectPlan}
     className="fa-plan__reject-btn"
   >
     Reject & Regenerate Plan
   </button>
   ```
   - Handler:
   ```typescript
   const handleRejectPlan = async () => {
     const newRequirements = await promptUserForFeedback();
     await apiClient.post(`/api/feature-agent/${agentId}/plan/regenerate`, {
       feedback: newRequirements,
       reason: 'user_rejected'
     });
     // Plan regeneration triggers status change back to 'pending_intent'
   };
   ```

2. **`server/src/routes/feature-agent.ts`**
   - Add regeneration endpoint:
   ```typescript
   // POST /api/feature-agent/:agentId/plan/regenerate
   router.post('/:agentId/plan/regenerate', requireAuth, async (req, res) => {
     const { feedback, reason } = req.body;

     const cfg = ensureOwner(req, res, agentId);
     if (!cfg) return;

     // Regenerate plan with feedback context
     await featureAgentService.regeneratePlan(agentId, feedback);

     res.json({ success: true });
   });
   ```

3. **`server/src/services/feature-agent/feature-agent-service.ts`**
   - Add `regeneratePlan()` method:
   ```typescript
   async regeneratePlan(agentId: string, feedback: string): Promise<void> {
     const rt = this.agents.get(agentId);
     if (!rt) throw new Error('Agent not found');

     // Reset status
     rt.config.status = 'pending_intent';

     // Regenerate with feedback
     const newPrompt = `${rt.config.taskPrompt}\n\nUser Feedback: ${feedback}`;
     await this.generateImplementationPlan(agentId, newPrompt);
   }
   ```

---

## PART 3: MEDIUM PRIORITY FIXES

### Fix 3.1: Show Escalation Progress in UI

**Files to Modify**:

1. **`src/components/feature-agent/FeatureAgentTile.tsx`**
   - Handle escalation events in SSE:
   ```typescript
   case 'escalation_started':
     addMessage(agentId, {
       type: 'action',
       content: `Escalation Round ${data.round}/${data.maxRounds}: Fixing ${data.errorCount} errors...`,
       timestamp: Date.now()
     });
     break;

   case 'escalation_progress':
     setTileProgress(agentId, data.progress);
     break;

   case 'escalation_wait':
     addMessage(agentId, {
       type: 'thinking',
       content: `Waiting ${data.delay/1000}s before retry attempt...`,
       timestamp: Date.now()
     });
     break;
   ```

### Fix 3.2: Add Rollback Mechanism

**Files to Create/Modify**:

1. **`server/src/services/feature-agent/feature-agent-service.ts`**
   - Store pre-merge commit hash:
   ```typescript
   // Before merge
   rt.preMergeCommitHash = await this.getMainBranchHead(rt.config.projectPath);
   ```
   - Add rollback method:
   ```typescript
   async rollbackMerge(agentId: string): Promise<{ success: boolean }> {
     const rt = this.agents.get(agentId);
     if (!rt?.preMergeCommitHash) {
       throw new Error('No rollback point available');
     }

     await execAsync(`git reset --hard ${rt.preMergeCommitHash}`, {
       cwd: rt.config.projectPath
     });

     return { success: true };
   }
   ```

2. **`server/src/routes/feature-agent.ts`**
   - Add rollback endpoint:
   ```typescript
   // POST /api/feature-agent/:agentId/rollback
   router.post('/:agentId/rollback', requireAuth, async (req, res) => {
     const result = await featureAgentService.rollbackMerge(agentId);
     res.json(result);
   });
   ```

3. **`src/components/feature-agent/FeaturePreviewWindow.tsx`**
   - Add rollback button after merge (shows for limited time):
   ```tsx
   {mergeComplete && (
     <button onClick={handleRollback} className="fa-preview__rollback-btn">
       Undo Merge (available for 5 minutes)
     </button>
   )}
   ```

### Fix 3.3: Test and Verify Ghost Mode

**Testing Checklist**:

1. [ ] Enable Ghost Mode for an agent
2. [ ] Close browser / navigate away
3. [ ] Verify build continues in background
4. [ ] Verify wake notifications sent correctly
5. [ ] Verify state restored on return
6. [ ] Verify budget limits respected

**Files to Audit**:
- `server/src/services/feature-agent/feature-agent-service.ts` - `enableGhostMode()` method
- `server/src/services/ghost-mode/ghost-controller.ts` - Controller logic
- Ghost Mode wake condition handlers

---

## PART 4: UI ENHANCEMENTS

### Enhancement 4.1: Better Credential Collection UI

**Files to Modify**:

1. **`src/components/feature-agent/CredentialsCollectionView.tsx`**
   - Add platform grouping with icons (use BrandIcons.tsx)
   - Add "Test Connection" button for each credential
   - Add progress indicator showing filled/total
   - Style with liquid glass aesthetic (matching Builder)

### Enhancement 4.2: Activity Stream Improvements

**Files to Modify**:

1. **`src/components/feature-agent/FeatureAgentTile.tsx`**
   - Add collapsible verification results section
   - Show real-time code diffs when files change
   - Add "View Full Log" button linking to detailed view

### Enhancement 4.3: Tile Status Badge Improvements

**Current Badges**: INTENT, PLAN, CREDENTIALS, IMPLEMENTING, VERIFYING, COMPLETE, FAILED

**Add Visual States**:
- ESCALATING (yellow pulse) - When in error escalation
- GHOST (amber glow) - When Ghost Mode active
- PREVIEW READY (green dot) - When sandbox is available

---

## PART 5: IMPLEMENTATION ORDER

### Phase A: Critical (Must Fix Before Production)

1. **Fix 1.1**: Wire Preview Window to Real Sandbox
   - Estimated: 2-3 hours
   - Files: FeatureAgentTile.tsx, feature-agent.ts route, FeaturePreviewWindow.tsx

2. **Fix 1.2**: Create Sandbox During Build
   - Estimated: 1-2 hours
   - Files: feature-agent-service.ts

3. **Fix 1.3**: Persist Plan Modifications
   - Estimated: 2 hours
   - Files: schema.ts, feature-agent.ts route, ImplementationPlanView.tsx

4. **Fix 1.4**: Remove Escalation Limit
   - Estimated: 1 hour
   - Files: feature-agent-service.ts

### Phase B: High Priority (Within 1 Week)

5. **Fix 2.1**: Verify OAuth Integration
   - Estimated: 2-3 hours (audit + fixes)

6. **Fix 2.2**: Verify Merge Success
   - Estimated: 1 hour

7. **Fix 2.3**: Add Plan Rejection
   - Estimated: 2 hours

### Phase C: Medium Priority (Within 2 Weeks)

8. **Fix 3.1**: Escalation Progress UI
   - Estimated: 1 hour

9. **Fix 3.2**: Rollback Mechanism
   - Estimated: 2 hours

10. **Fix 3.3**: Ghost Mode Testing
    - Estimated: 3 hours (testing + fixes)

### Phase D: Polish (Before Launch)

11. **Enhancement 4.1**: Better Credentials UI
12. **Enhancement 4.2**: Activity Stream
13. **Enhancement 4.3**: Status Badges

---

## PART 6: VERIFICATION CHECKLIST

After implementation, verify:

### Critical Path Test
```
1. [ ] User deploys Feature Agent with NLP prompt
2. [ ] Intent Lock created successfully
3. [ ] Implementation plan shows and can be approved
4. [ ] Credentials collected (if needed)
5. [ ] Build runs with all 6 phases
6. [ ] Sandbox created and preview available during build
7. [ ] Verification swarm runs (6 agents)
8. [ ] Deep Intent satisfaction checked
9. [ ] Error escalation works (if errors occur)
10. [ ] "See Feature In Browser" shows REAL preview
11. [ ] "Accept & Merge" actually merges to main
12. [ ] Feature code visible in main branch after merge
```

### Edge Case Tests
```
1. [ ] What happens if user refreshes during build?
2. [ ] What happens if sandbox fails to start?
3. [ ] What happens if merge has conflicts?
4. [ ] What happens if OAuth fails?
5. [ ] What happens if all escalation rounds fail?
6. [ ] What happens in Ghost Mode with no network?
```

---

## PART 7: SUCCESS CRITERIA

Feature Agent is **production-ready** when:

| Criterion | Metric |
|-----------|--------|
| NLP → Feature Working | 100% of approved plans result in working features |
| Preview Accuracy | Preview shows exactly what will be merged |
| Merge Reliability | 99%+ merges succeed without conflicts |
| User Experience | < 5 clicks from NLP to merged feature |
| Error Recovery | Automatic recovery from 90%+ of errors |
| Time to Feature | Simple features < 10 min, complex < 30 min |

---

## APPENDIX: FILE LOCATIONS

| Component | File Path |
|-----------|-----------|
| Feature Agent Service | `server/src/services/feature-agent/feature-agent-service.ts` |
| Feature Agent Routes | `server/src/routes/feature-agent.ts` |
| Feature Agent Tile | `src/components/feature-agent/FeatureAgentTile.tsx` |
| Preview Window | `src/components/feature-agent/FeaturePreviewWindow.tsx` |
| Plan View | `src/components/feature-agent/ImplementationPlanView.tsx` |
| Credentials View | `src/components/feature-agent/CredentialsCollectionView.tsx` |
| Ghost Mode Config | `src/components/feature-agent/GhostModeConfig.tsx` |
| Tile Store | `src/store/useFeatureAgentTileStore.ts` |
| Agent Store | `src/store/useFeatureAgentStore.ts` |
| Sandbox Service | `server/src/services/developer-mode/sandbox-service.ts` |
| Build Loop | `server/src/services/automation/build-loop.ts` |

---

*This implementation plan addresses all gaps preventing Feature Agent from being production-ready.*
*Estimated total effort: 15-20 hours of focused development.*

*Created: 2026-01-13*
