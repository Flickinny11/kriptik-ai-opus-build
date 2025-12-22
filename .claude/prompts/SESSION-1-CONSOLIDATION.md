# SESSION 1: CONSOLIDATION & FOUNDATION
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Remove legacy paths, consolidate orchestrators, establish single source of truth for all builds.

**Success Criteria**: After this session, ALL NLP inputs (Builder View and Feature Agents) MUST flow through BuildLoopOrchestrator with NO fallback to legacy systems.

---

## PROMPT (Copy and paste into Claude Code)

```
I need you to consolidate Kriptik AI's orchestration system so that Builder View (Kriptoenite/Multi-Agent) and Feature Agents use the EXACT SAME BuildLoopOrchestrator path with ALL advanced features enabled.

## CONTEXT
- BuildLoopOrchestrator is the canonical 6-phase build system with Intent Lock, Verification Swarm, Learning Engine, etc.
- DevelopmentOrchestrator and AgentOrchestrator (in agents/) are legacy/duplicate systems that must be deprecated
- There's a fallback in ChatInterface.tsx (line ~570) that uses old /api/orchestrate routes
- Feature Agents correctly use BuildLoopOrchestrator but Builder View has inconsistent paths

## TASKS

### 1. Remove Legacy Fallback in Builder View
File: `src/components/builder/ChatInterface.tsx`

Find the fallback code around line 567-573 that looks like:
```typescript
// Fall back to client-side orchestrator
await orchestrator.start(prompt);
```

Replace the entire error handling with retry logic that stays on /api/execute:
- Add exponential backoff retry (3 attempts: 2s, 4s, 8s)
- On final failure, show user-friendly error with retry button
- NEVER fall back to /api/orchestrate

### 2. Deprecate Legacy Routes
File: `server/src/routes/orchestrate.ts`

Add deprecation at the top of each route handler:
```typescript
console.warn('[DEPRECATED] /api/orchestrate/* routes are deprecated. Use /api/execute instead.');
```

Add response header to all routes:
```typescript
res.setHeader('X-Deprecated', 'Use /api/execute instead');
```

### 3. Mark Legacy Orchestrators as Deprecated
File: `server/src/services/orchestration/development-orchestrator.ts`

Add JSDoc deprecation at class level:
```typescript
/**
 * @deprecated Use BuildLoopOrchestrator from automation/build-loop.ts instead.
 * This orchestrator is maintained only for backward compatibility.
 * All new code should use BuildLoopOrchestrator.
 */
```

File: `server/src/services/agents/orchestrator.ts` (AgentOrchestrator)

Same deprecation notice.

### 4. Add Server-Side Agent Limit Enforcement
File: `server/src/routes/feature-agent.ts`

In the POST /api/feature-agent/create handler, add BEFORE creating agent:
```typescript
// Enforce server-side 6-agent limit
const activeAgents = await db.select()
  .from(developerModeAgents)
  .where(and(
    eq(developerModeAgents.userId, userId),
    inArray(developerModeAgents.status, ['pending', 'running', 'building'])
  ));

if (activeAgents.length >= 6) {
  return res.status(429).json({
    error: 'Maximum 6 concurrent agents allowed',
    activeCount: activeAgents.length,
    suggestion: 'Wait for an agent to complete or cancel one'
  });
}
```

### 5. Ensure Builder View Uses Same Config as Feature Agents
File: `server/src/routes/execute.ts`

In the executeBuilderMode function, ensure BuildLoopOrchestrator is created with FULL production config:
```typescript
const buildLoop = new BuildLoopOrchestrator(
  context.projectId,
  context.userId,
  context.orchestrationRunId,
  'production' as BuildMode, // NOT 'standard' - use full production mode
  {
    enableLattice: true,           // Parallel cell building
    enableBrowserInLoop: true,     // Real-time visual verification
    enableLearningEngine: true,    // Pattern injection
    enableVerificationSwarm: true, // 6-agent verification
    maxParallelAgents: 6,          // Allow full parallelism
  }
);
```

### 6. Update AgentOrchestrator.ts (Client-Side) to Use /api/execute
File: `src/lib/AgentOrchestrator.ts`

This file currently calls /api/orchestrate. Update ALL fetch calls:
- Change `/api/orchestrate/analyze` → `/api/execute` with mode: 'builder'
- Change `/api/orchestrate/{projectId}/execute` → same /api/execute endpoint
- Remove pause/resume calls to /api/orchestrate (handle via WebSocket instead)

If this file is only used as fallback, consider deleting it entirely after updating ChatInterface.tsx.

### 7. Verify the Wiring
After making changes, trace the flow:

1. User enters NLP in Builder View chat
2. ChatInterface.tsx calls /api/execute with mode: 'builder'
3. execute.ts routes to executeBuilderMode()
4. BuildLoopOrchestrator is created with production config
5. 6-phase loop runs with all features enabled

Create a simple test:
File: `server/src/routes/__tests__/execute-builder.test.ts`
```typescript
describe('Builder View Flow', () => {
  it('should use BuildLoopOrchestrator for all builds', async () => {
    const response = await request(app)
      .post('/api/execute')
      .send({ mode: 'builder', prompt: 'Create a todo app', userId: 'test', projectId: 'test' });

    expect(response.status).toBe(200);
    // Verify BuildLoopOrchestrator was used (check logs or response)
  });
});
```

## VERIFICATION CHECKLIST
Before completing this session, verify:

- [ ] ChatInterface.tsx has NO fallback to orchestrator.start()
- [ ] /api/orchestrate routes show deprecation warnings
- [ ] DevelopmentOrchestrator has @deprecated JSDoc
- [ ] AgentOrchestrator (agents/) has @deprecated JSDoc
- [ ] Server-side 6-agent limit is enforced
- [ ] Builder View uses 'production' mode with all features enabled
- [ ] npm run build passes with no errors
- [ ] No TypeScript errors

## FILES MODIFIED
- src/components/builder/ChatInterface.tsx
- server/src/routes/orchestrate.ts
- server/src/routes/execute.ts
- server/src/routes/feature-agent.ts
- server/src/services/orchestration/development-orchestrator.ts
- server/src/services/agents/orchestrator.ts
- src/lib/AgentOrchestrator.ts (or delete if unused)

## COMMIT MESSAGE
```
feat(orchestration): Consolidate all builds to BuildLoopOrchestrator

- Remove legacy fallback to /api/orchestrate in Builder View
- Mark DevelopmentOrchestrator and AgentOrchestrator as deprecated
- Add server-side 6-agent limit enforcement
- Enable all production features by default (LATTICE, BrowserInLoop, etc.)
- Ensure Builder View and Feature Agents use identical orchestration path

BREAKING: /api/orchestrate routes are now deprecated
```
```

---

## EXPECTED OUTCOME

After this session:
1. ALL NLP inputs go through /api/execute → BuildLoopOrchestrator
2. No legacy fallbacks exist
3. Server enforces 6-agent limit
4. All builds use production-grade features by default
