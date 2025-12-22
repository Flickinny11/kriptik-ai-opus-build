# SESSION 2: ENABLE TRUE PARALLEL EXECUTION
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Make LATTICE (parallel cell building) the DEFAULT, activate BrowserInLoopService during builds, and switch all agents to UnifiedContext.

**Success Criteria**: Multiple agents build simultaneously in different sandboxes, share context in real-time, and receive continuous visual verification feedback.

---

## PROMPT (Copy and paste into Claude Code)

```
I need you to enable TRUE parallel execution in Kriptik AI's build system. Currently, parallel building (LATTICE) is opt-in and BrowserInLoopService (real-time visual verification) is never instantiated. This session makes them default.

## CONTEXT
- LATTICE system exists in `lattice/lattice-orchestrator.ts` with Promise.all() for parallel cell building
- BrowserInLoopService exists (706 lines) but is NEVER instantiated during builds
- Agents currently load context independently via loadProjectContext() instead of the richer loadUnifiedContext()
- The goal is "fingers of the same hand" - all agents aware of each other in real-time

## TASKS

### 1. Make LATTICE the Default Build Mode
File: `server/src/services/automation/build-loop.ts`

Find where Phase 2 (PARALLEL_BUILD) is executed. Currently it checks for LATTICE opt-in.

Change from:
```typescript
if (this.options.speedEnhancements?.includes('lattice')) {
  // Use LATTICE
} else {
  // Sequential task processing
}
```

To:
```typescript
// LATTICE is now DEFAULT - parallel cell building for all builds
// Only disable if explicitly set to false
const useLattice = this.options.useLattice !== false;

if (useLattice) {
  await this.executePhase2WithLattice(context);
} else {
  await this.executePhase2Sequential(context);
}
```

### 2. Instantiate and Activate BrowserInLoopService
File: `server/src/services/automation/build-loop.ts`

At the top, add import:
```typescript
import { BrowserInLoopService } from '../verification/browser-in-loop';
```

In the class, add property:
```typescript
private browserInLoop: BrowserInLoopService | null = null;
```

In the start() method or Phase 2 initialization:
```typescript
// Activate Browser-in-the-Loop for real-time visual verification
if (this.options.enableBrowserInLoop !== false) {
  this.browserInLoop = new BrowserInLoopService({
    projectId: this.projectId,
    sandboxUrl: this.getSandboxUrl(),
    verificationInterval: 30000, // 30 seconds
    onVerificationResult: (result) => {
      // Stream results to building agents
      this.streamFeedbackToAgents(result);
      // Emit to frontend
      this.emit('visual-verification', result);
    }
  });

  await this.browserInLoop.start();
}
```

Create the feedback streaming method:
```typescript
private streamFeedbackToAgents(result: VisualVerificationResult) {
  // Inject into agent context so they can self-correct
  this.emit('agent-feedback', {
    type: 'visual-verification',
    passed: result.passed,
    score: result.score,
    issues: result.issues,
    suggestions: result.suggestions,
    timestamp: Date.now()
  });

  // If critical issues found, add to agent context
  if (result.score < 70) {
    this.addToAgentContext({
      type: 'visual-issue',
      severity: 'high',
      message: `Visual verification failed (score: ${result.score}). Issues: ${result.issues.join(', ')}`,
      fixSuggestions: result.suggestions
    });
  }
}
```

### 3. Switch Agents to UnifiedContext
File: `server/src/services/ai/coding-agent-wrapper.ts`

Find where context is loaded (in startSession or similar):
```typescript
// OLD - simpler context
const context = await loadProjectContext(projectPath, options);
```

Replace with:
```typescript
// NEW - rich context with patterns, strategies, error history
import { loadUnifiedContext } from './unified-context';

const context = await loadUnifiedContext(
  projectId,
  userId,
  projectPath,
  {
    includeIntentLock: true,
    includeLearnedPatterns: true,
    includeErrorHistory: true,
    includeVerificationHistory: true,
    includeAntiSlopPatterns: true,
    progressEntries: 50,
    gitLogEntries: 30
  }
);
```

### 4. Enable Real-Time Context Updates for Agents
File: `server/src/services/ai/coding-agent-wrapper.ts`

Add method to receive live updates:
```typescript
public subscribeToContextUpdates(callback: (update: ContextUpdate) => void) {
  // Subscribe to WebSocket sync for real-time updates
  const wsSync = WebSocketSyncService.getInstance();

  wsSync.subscribe(this.contextId, [
    'agent:completed',
    'file:modified',
    'error:resolved',
    'pattern:learned',
    'visual-verification'
  ], (event) => {
    callback({
      type: event.type,
      data: event.payload,
      fromAgentId: event.agentId,
      timestamp: event.timestamp
    });

    // Auto-inject into next prompt
    this.pendingContextUpdates.push(event);
  });
}
```

In the executeTask method, inject pending updates:
```typescript
async executeTask(task: Task): Promise<TaskResult> {
  // Inject any pending context updates from other agents
  const contextUpdates = this.consumePendingUpdates();
  const enhancedPrompt = this.injectContextUpdates(task.prompt, contextUpdates);

  // Now execute with full awareness of what other agents have done
  return await this.execute(enhancedPrompt);
}

private injectContextUpdates(prompt: string, updates: ContextUpdate[]): string {
  if (updates.length === 0) return prompt;

  const updateSummary = updates.map(u => {
    switch (u.type) {
      case 'agent:completed':
        return `Agent ${u.fromAgentId} completed: ${u.data.summary}`;
      case 'file:modified':
        return `File ${u.data.path} was modified by Agent ${u.fromAgentId}`;
      case 'error:resolved':
        return `Error "${u.data.error}" was resolved with: ${u.data.solution}`;
      case 'pattern:learned':
        return `New pattern learned: ${u.data.pattern}`;
      case 'visual-verification':
        return `Visual check: ${u.data.passed ? 'PASSED' : 'FAILED'} (score: ${u.data.score})`;
      default:
        return null;
    }
  }).filter(Boolean).join('\n');

  return `
## REAL-TIME CONTEXT FROM OTHER AGENTS
The following happened since your last action:
${updateSummary}

Take this into account as you work on your current task.

---

${prompt}
`;
}
```

### 5. Ensure LATTICE Orchestrator Uses Shared Context
File: `server/src/services/lattice/lattice-orchestrator.ts`

In the buildCell method, ensure each cell builder receives shared context:
```typescript
private async buildCellWithContext(cell: LatticeCell, sharedContext: SharedBuildContext) {
  // Create cell builder with shared context
  const builder = new CellBuilder({
    cell,
    projectId: this.projectId,
    sharedContext, // Pass shared context
    onProgress: (progress) => this.emitProgress(cell.id, progress),
    onFileModified: (file) => {
      // Broadcast to all other cells
      this.broadcastFileModification(cell.id, file);
    }
  });

  return builder.build();
}
```

Add broadcast method:
```typescript
private broadcastFileModification(cellId: string, file: FileModification) {
  // Notify all other active cell builders
  this.activeCells.forEach((builder, id) => {
    if (id !== cellId) {
      builder.notifyFileModified(file);
    }
  });

  // Also emit to WebSocket for UI
  this.emit('file-modified', { cellId, file });
}
```

### 6. Update BuildLoopOrchestrator Options Interface
File: `server/src/services/automation/build-loop.ts`

Update the options type to include all new defaults:
```typescript
interface BuildLoopOptions {
  useLattice?: boolean;           // Default: true
  enableBrowserInLoop?: boolean;  // Default: true
  enableLearningEngine?: boolean; // Default: true
  enableVerificationSwarm?: boolean; // Default: true
  maxParallelAgents?: number;     // Default: 6
  contextSyncInterval?: number;   // Default: 5000ms
  visualVerificationInterval?: number; // Default: 30000ms
}

const DEFAULT_OPTIONS: BuildLoopOptions = {
  useLattice: true,
  enableBrowserInLoop: true,
  enableLearningEngine: true,
  enableVerificationSwarm: true,
  maxParallelAgents: 6,
  contextSyncInterval: 5000,
  visualVerificationInterval: 30000
};
```

### 7. Cleanup BrowserInLoop on Phase Complete
File: `server/src/services/automation/build-loop.ts`

In phase transition or completion:
```typescript
private async cleanupPhase(phase: BuildPhase) {
  if (phase === 'PARALLEL_BUILD' && this.browserInLoop) {
    await this.browserInLoop.stop();
    this.browserInLoop = null;
  }
}
```

## VERIFICATION CHECKLIST
Before completing this session, verify:

- [ ] LATTICE is used by default (check build logs)
- [ ] BrowserInLoopService is instantiated in Phase 2
- [ ] Visual verification results are emitted to WebSocket
- [ ] Agents use loadUnifiedContext() not loadProjectContext()
- [ ] Context updates from other agents are injected into prompts
- [ ] File modifications are broadcast between parallel cells
- [ ] npm run build passes with no errors

## FILES MODIFIED
- server/src/services/automation/build-loop.ts
- server/src/services/ai/coding-agent-wrapper.ts
- server/src/services/lattice/lattice-orchestrator.ts

## COMMIT MESSAGE
```
feat(parallel): Enable true parallel execution with real-time context sharing

- Make LATTICE default for all builds (parallel cell building)
- Activate BrowserInLoopService during Phase 2 (continuous visual verification)
- Switch agents to UnifiedContext (rich context with patterns, history)
- Implement real-time context updates between agents
- Broadcast file modifications to all parallel builders
- Stream visual verification feedback to building agents

Agents now work as "fingers of the same hand" - fully aware of each other.
```
```

---

## EXPECTED OUTCOME

After this session:
1. Multiple agents build simultaneously in parallel
2. Agents receive visual verification feedback in real-time
3. When Agent 1 modifies a file, Agents 2-6 know immediately
4. Rich context (patterns, strategies, error history) available to all agents
5. Visual verification catches issues DURING build, not after
