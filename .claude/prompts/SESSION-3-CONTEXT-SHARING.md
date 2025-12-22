# SESSION 3: REAL-TIME CONTEXT SHARING ("FINGERS OF THE SAME HAND")
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Create a central context synchronization system that makes ALL agents aware of what every other agent is doing in real-time.

**Success Criteria**: When Agent 1 solves a problem, Agents 2-6 immediately know the solution. When Agent 3 encounters an error, all agents learn from it. True collective intelligence.

---

## PROMPT (Copy and paste into Claude Code)

```
I need you to implement a real-time context synchronization system that makes all parallel agents work as "fingers of the same hand" - completely aware of each other's actions, discoveries, and solutions.

## CONTEXT
- Currently agents load context independently at startup
- No real-time sharing of discoveries, solutions, or errors between agents
- WebSocket infrastructure exists (websocket-sync.ts) but isn't used for agent-to-agent communication
- The goal: Agent 1 finds solution → Agents 2-6 know immediately (not after artifacts are written)

## TASKS

### 1. Create the Context Sync Service
Create new file: `server/src/services/agents/context-sync-service.ts`

```typescript
import { EventEmitter } from 'events';
import { WebSocketSyncService } from './websocket-sync';

interface ContextUpdate {
  type: 'discovery' | 'solution' | 'error' | 'file-change' | 'pattern' | 'warning';
  agentId: string;
  timestamp: number;
  data: {
    summary: string;
    details: any;
    relevantFiles?: string[];
    confidence?: number;
  };
}

interface SharedAgentContext {
  discoveries: ContextUpdate[];
  solutions: Map<string, ContextUpdate>; // errorType → solution
  recentErrors: ContextUpdate[];
  modifiedFiles: Map<string, { agentId: string; action: string; timestamp: number }>;
  learnedPatterns: ContextUpdate[];
  activeAgents: Map<string, { status: string; currentTask: string; lastUpdate: number }>;
}

export class ContextSyncService extends EventEmitter {
  private static instances: Map<string, ContextSyncService> = new Map();
  private context: SharedAgentContext;
  private wsSync: WebSocketSyncService;
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor(
    private buildId: string,
    private projectId: string
  ) {
    super();
    this.context = {
      discoveries: [],
      solutions: new Map(),
      recentErrors: [],
      modifiedFiles: new Map(),
      learnedPatterns: [],
      activeAgents: new Map()
    };
    this.wsSync = WebSocketSyncService.getInstance();
  }

  static getInstance(buildId: string, projectId: string): ContextSyncService {
    const key = `${buildId}:${projectId}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new ContextSyncService(buildId, projectId));
    }
    return this.instances.get(key)!;
  }

  // Register an agent to receive real-time updates
  registerAgent(agentId: string, initialTask: string): void {
    this.context.activeAgents.set(agentId, {
      status: 'active',
      currentTask: initialTask,
      lastUpdate: Date.now()
    });

    this.broadcast({
      type: 'agent-registered',
      agentId,
      timestamp: Date.now(),
      data: {
        summary: `Agent ${agentId} joined the build`,
        details: { task: initialTask }
      }
    });
  }

  // Agent shares a discovery (something useful learned)
  shareDiscovery(agentId: string, discovery: {
    summary: string;
    details: any;
    relevantFiles?: string[];
    confidence?: number;
  }): void {
    const update: ContextUpdate = {
      type: 'discovery',
      agentId,
      timestamp: Date.now(),
      data: discovery
    };

    this.context.discoveries.push(update);

    // Keep only last 50 discoveries
    if (this.context.discoveries.length > 50) {
      this.context.discoveries = this.context.discoveries.slice(-50);
    }

    this.broadcast(update);
  }

  // Agent shares a solution to a problem
  shareSolution(agentId: string, problemType: string, solution: {
    summary: string;
    code?: string;
    pattern?: string;
    relevantFiles?: string[];
  }): void {
    const update: ContextUpdate = {
      type: 'solution',
      agentId,
      timestamp: Date.now(),
      data: { summary: solution.summary, details: solution, problemType }
    };

    this.context.solutions.set(problemType, update);
    this.broadcast(update);

    // Also emit to learning engine for pattern extraction
    this.emit('solution-found', { problemType, solution, agentId });
  }

  // Agent reports an error (so others can avoid or help)
  reportError(agentId: string, error: {
    message: string;
    file?: string;
    line?: number;
    stack?: string;
    attemptedFix?: string;
  }): void {
    const update: ContextUpdate = {
      type: 'error',
      agentId,
      timestamp: Date.now(),
      data: { summary: error.message, details: error }
    };

    this.context.recentErrors.push(update);

    // Keep only last 20 errors
    if (this.context.recentErrors.length > 20) {
      this.context.recentErrors = this.context.recentErrors.slice(-20);
    }

    this.broadcast(update);
  }

  // Agent modified a file
  notifyFileChange(agentId: string, filePath: string, action: 'create' | 'modify' | 'delete'): void {
    this.context.modifiedFiles.set(filePath, {
      agentId,
      action,
      timestamp: Date.now()
    });

    this.broadcast({
      type: 'file-change',
      agentId,
      timestamp: Date.now(),
      data: {
        summary: `${action} ${filePath}`,
        details: { filePath, action }
      }
    });
  }

  // Get context relevant to a specific task
  getContextForTask(agentId: string, taskDescription: string, relevantFiles: string[]): string {
    const lines: string[] = [];

    // What other agents are working on
    lines.push('## ACTIVE AGENTS');
    this.context.activeAgents.forEach((info, id) => {
      if (id !== agentId) {
        lines.push(`- Agent ${id}: ${info.currentTask} (${info.status})`);
      }
    });

    // Recent discoveries that might be relevant
    const relevantDiscoveries = this.context.discoveries
      .filter(d => d.agentId !== agentId)
      .slice(-10);

    if (relevantDiscoveries.length > 0) {
      lines.push('\n## RECENT DISCOVERIES FROM OTHER AGENTS');
      relevantDiscoveries.forEach(d => {
        lines.push(`- [Agent ${d.agentId}]: ${d.data.summary}`);
      });
    }

    // Known solutions
    if (this.context.solutions.size > 0) {
      lines.push('\n## KNOWN SOLUTIONS (Use these if you encounter similar problems)');
      this.context.solutions.forEach((solution, problemType) => {
        lines.push(`- ${problemType}: ${solution.data.summary}`);
      });
    }

    // Files being worked on by others
    const otherAgentFiles = Array.from(this.context.modifiedFiles.entries())
      .filter(([_, info]) => info.agentId !== agentId)
      .slice(-10);

    if (otherAgentFiles.length > 0) {
      lines.push('\n## FILES BEING MODIFIED BY OTHER AGENTS (Avoid conflicts)');
      otherAgentFiles.forEach(([file, info]) => {
        lines.push(`- ${file}: ${info.action} by Agent ${info.agentId}`);
      });
    }

    // Recent errors (so this agent can avoid them)
    const recentErrors = this.context.recentErrors
      .filter(e => e.agentId !== agentId)
      .slice(-5);

    if (recentErrors.length > 0) {
      lines.push('\n## RECENT ERRORS FROM OTHER AGENTS (Avoid these)');
      recentErrors.forEach(e => {
        lines.push(`- ${e.data.summary}`);
        if (e.data.details.attemptedFix) {
          lines.push(`  Attempted fix: ${e.data.details.attemptedFix}`);
        }
      });
    }

    return lines.join('\n');
  }

  // Check if a file is being modified by another agent
  isFileLocked(filePath: string, requestingAgentId: string): { locked: boolean; byAgent?: string } {
    const fileInfo = this.context.modifiedFiles.get(filePath);
    if (!fileInfo || fileInfo.agentId === requestingAgentId) {
      return { locked: false };
    }

    // Check if lock is stale (older than 5 minutes)
    if (Date.now() - fileInfo.timestamp > 5 * 60 * 1000) {
      this.context.modifiedFiles.delete(filePath);
      return { locked: false };
    }

    return { locked: true, byAgent: fileInfo.agentId };
  }

  // Subscribe to real-time updates
  subscribe(agentId: string, callback: (update: ContextUpdate) => void): () => void {
    const handler = (update: ContextUpdate) => {
      // Don't send agent its own updates
      if (update.agentId !== agentId) {
        callback(update);
      }
    };

    this.on('update', handler);

    return () => {
      this.off('update', handler);
    };
  }

  private broadcast(update: ContextUpdate): void {
    this.emit('update', update);

    // Also broadcast via WebSocket for UI
    this.wsSync.broadcast(this.buildId, 'context-sync', update);
  }

  // Cleanup when build completes
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    ContextSyncService.instances.delete(`${this.buildId}:${this.projectId}`);
  }
}
```

### 2. Integrate ContextSyncService into BuildLoopOrchestrator
File: `server/src/services/automation/build-loop.ts`

Add import:
```typescript
import { ContextSyncService } from '../agents/context-sync-service';
```

Add property:
```typescript
private contextSync: ContextSyncService;
```

In start() or initialization:
```typescript
// Initialize shared context sync
this.contextSync = ContextSyncService.getInstance(this.buildId, this.projectId);
```

### 3. Integrate into CodingAgentWrapper
File: `server/src/services/ai/coding-agent-wrapper.ts`

Add import:
```typescript
import { ContextSyncService } from '../agents/context-sync-service';
```

Add property and initialization:
```typescript
private contextSync: ContextSyncService;
private unsubscribe: (() => void) | null = null;
private pendingUpdates: ContextUpdate[] = [];

constructor(options: CodingAgentOptions) {
  // ...existing code...

  // Connect to shared context
  this.contextSync = ContextSyncService.getInstance(options.buildId, options.projectId);
  this.contextSync.registerAgent(this.agentId, options.initialTask);

  // Subscribe to real-time updates
  this.unsubscribe = this.contextSync.subscribe(this.agentId, (update) => {
    this.pendingUpdates.push(update);

    // If update is high-priority (solution or critical error), log it
    if (update.type === 'solution' || (update.type === 'error' && update.data.details.severity === 'critical')) {
      console.log(`[Agent ${this.agentId}] Received ${update.type} from Agent ${update.agentId}: ${update.data.summary}`);
    }
  });
}
```

Modify executeTask to inject shared context:
```typescript
async executeTask(task: Task): Promise<TaskResult> {
  // Get shared context from other agents
  const sharedContext = this.contextSync.getContextForTask(
    this.agentId,
    task.description,
    task.relevantFiles || []
  );

  // Get pending real-time updates
  const realtimeUpdates = this.consumePendingUpdates();

  // Build enhanced prompt with full awareness
  const enhancedPrompt = this.buildEnhancedPrompt(task, sharedContext, realtimeUpdates);

  try {
    const result = await this.execute(enhancedPrompt);

    // Share discoveries with other agents
    if (result.discoveries && result.discoveries.length > 0) {
      result.discoveries.forEach(d => {
        this.contextSync.shareDiscovery(this.agentId, d);
      });
    }

    // Share solutions
    if (result.problemsSolved && result.problemsSolved.length > 0) {
      result.problemsSolved.forEach(p => {
        this.contextSync.shareSolution(this.agentId, p.type, p.solution);
      });
    }

    return result;
  } catch (error) {
    // Report error to other agents
    this.contextSync.reportError(this.agentId, {
      message: error.message,
      file: task.relevantFiles?.[0],
      stack: error.stack,
      attemptedFix: task.description
    });

    throw error;
  }
}

private buildEnhancedPrompt(
  task: Task,
  sharedContext: string,
  realtimeUpdates: ContextUpdate[]
): string {
  const parts: string[] = [];

  // Add shared context from other agents
  if (sharedContext) {
    parts.push('# SHARED CONTEXT FROM PARALLEL AGENTS\n');
    parts.push(sharedContext);
    parts.push('\n---\n');
  }

  // Add real-time updates since last execution
  if (realtimeUpdates.length > 0) {
    parts.push('# REAL-TIME UPDATES (Just happened)\n');
    realtimeUpdates.forEach(u => {
      parts.push(`- [${u.type.toUpperCase()}] Agent ${u.agentId}: ${u.data.summary}`);
    });
    parts.push('\n---\n');
  }

  // Add the actual task
  parts.push('# YOUR TASK\n');
  parts.push(task.description);

  return parts.join('\n');
}

private consumePendingUpdates(): ContextUpdate[] {
  const updates = [...this.pendingUpdates];
  this.pendingUpdates = [];
  return updates;
}
```

### 4. Share File Modifications
File: `server/src/services/ai/coding-agent-wrapper.ts`

In the recordFileChange method:
```typescript
recordFileChange(filePath: string, action: 'create' | 'modify' | 'delete'): void {
  // Existing tracking logic
  this.fileChanges.push({ path: filePath, action, timestamp: Date.now() });

  // Broadcast to other agents
  this.contextSync.notifyFileChange(this.agentId, filePath, action);
}
```

### 5. Check File Locks Before Modifying
File: `server/src/services/ai/coding-agent-wrapper.ts`

Add method:
```typescript
async canModifyFile(filePath: string): Promise<{ allowed: boolean; reason?: string }> {
  const lockStatus = this.contextSync.isFileLocked(filePath, this.agentId);

  if (lockStatus.locked) {
    return {
      allowed: false,
      reason: `File ${filePath} is being modified by Agent ${lockStatus.byAgent}. Wait or work on a different file.`
    };
  }

  return { allowed: true };
}
```

### 6. Wire Solution Sharing to Learning Engine
File: `server/src/services/automation/build-loop.ts`

Add listener for solutions:
```typescript
// In initialization
this.contextSync.on('solution-found', async ({ problemType, solution, agentId }) => {
  // Send to learning engine for pattern extraction
  if (this.learningEngine) {
    await this.learningEngine.capturePattern({
      type: 'solution',
      problemType,
      solution: solution.pattern || solution.summary,
      confidence: 0.8, // Verified solution from successful agent
      source: `agent:${agentId}`,
      timestamp: Date.now()
    });
  }
});
```

### 7. Add Context Summary to Build Logs
File: `server/src/services/automation/build-loop.ts`

In phase completion:
```typescript
private logPhaseCompletion(phase: string): void {
  const contextStats = {
    discoveries: this.contextSync.context.discoveries.length,
    solutions: this.contextSync.context.solutions.size,
    errors: this.contextSync.context.recentErrors.length,
    filesModified: this.contextSync.context.modifiedFiles.size,
    activeAgents: this.contextSync.context.activeAgents.size
  };

  console.log(`[Phase ${phase}] Context stats:`, contextStats);
  this.emit('phase-complete', { phase, contextStats });
}
```

## VERIFICATION CHECKLIST
Before completing this session, verify:

- [ ] ContextSyncService singleton is created per build
- [ ] Agents register themselves when starting
- [ ] Discoveries are broadcast to all agents
- [ ] Solutions are shared and can be queried
- [ ] File modifications are tracked and broadcast
- [ ] Agents receive real-time updates from others
- [ ] Enhanced prompts include shared context
- [ ] Learning engine receives solutions for pattern extraction
- [ ] npm run build passes

## FILES CREATED/MODIFIED
- server/src/services/agents/context-sync-service.ts (NEW)
- server/src/services/automation/build-loop.ts
- server/src/services/ai/coding-agent-wrapper.ts

## COMMIT MESSAGE
```
feat(agents): Implement real-time context sharing between parallel agents

- Create ContextSyncService for agent-to-agent communication
- Share discoveries, solutions, and errors in real-time
- Track file modifications to prevent conflicts
- Inject shared context into agent prompts
- Wire solutions to learning engine for pattern extraction

Agents now work as collective intelligence - "fingers of the same hand"
```
```

---

## EXPECTED OUTCOME

After this session:
1. Agent 1 finds a solution → Agents 2-6 know it immediately
2. Agent 3 encounters an error → All agents learn to avoid it
3. File modifications are broadcast to prevent conflicts
4. Shared context is injected into every agent's prompts
5. Solutions are captured by learning engine for future builds
