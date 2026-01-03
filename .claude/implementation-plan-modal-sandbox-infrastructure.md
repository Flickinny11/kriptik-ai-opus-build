# KripTik AI - Modal Sandbox Infrastructure Implementation Plan

> **THE COMPUTE LAYER**: This document specifies the complete implementation plan for Modal-based sandboxing that enables KripTik to run autonomous, long-running builds at Lovable-scale.
>
> **Created**: 2026-01-03
> **Status**: IMPLEMENTATION PLAN (Awaiting Approval)
> **Reference**: [Modal Lovable Case Study](https://modal.com/blog/lovable-case-study) - 1M sandboxes, 20K concurrent

---

## EXECUTIVE SUMMARY

This plan transforms KripTik from a Vercel-limited system (10-60s timeouts) to a Modal-powered autonomous build platform capable of:

- **Multi-sandbox parallel builds** - Multiple orchestrations of 3-5 agents each
- **Hours/days-long autonomous execution** - Builds until "done", respawns as needed
- **Real-time context sharing** - All sandboxes share memory via Redis/WebSocket
- **Per-sandbox verification swarm** - Complete verification in each sandbox
- **Tournament mode** - Multiple implementations compared by AI judge
- **Merge verification** - Pre-merge testing in main-test sandbox
- **Lovable-scale** - Support for 20K+ concurrent sandboxes

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER ENTERS NLP                                     │
│                    (Builder View or Feature Agent)                          │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VERCEL FLUID COORDINATOR                                 │
│                    (Up to 800s, manages lifecycle)                          │
│                                                                             │
│  • Receives NLP, creates Intent Lock                                        │
│  • Spawns Modal sandboxes via API                                           │
│  • Manages Redis pub/sub for context sync                                   │
│  • Streams progress to frontend via SSE                                     │
│  • Handles merge orchestration                                              │
│  • Long-running via waitUntil() background processing                       │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ Modal API
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MODAL SANDBOX FLEET                                 │
│                    (Unlimited duration, auto-scaling)                       │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  SANDBOX A      │  │  SANDBOX B      │  │  SANDBOX C      │             │
│  │  (Frontend)     │  │  (Backend)      │  │  (Database)     │             │
│  │                 │  │                 │  │                 │             │
│  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │             │
│  │  │ Agent 1   │  │  │  │ Agent 4   │  │  │  │ Agent 7   │  │             │
│  │  │ Agent 2   │  │  │  │ Agent 5   │  │  │  │ Agent 8   │  │             │
│  │  │ Agent 3   │  │  │  │ Agent 6   │  │  │  │           │  │             │
│  │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │             │
│  │                 │  │                 │  │                 │             │
│  │  Verification   │  │  Verification   │  │  Verification   │             │
│  │  Swarm (6)      │  │  Swarm (6)      │  │  Swarm (6)      │             │
│  │                 │  │                 │  │                 │             │
│  │  Dev Server     │  │  API Server     │  │  Migrations     │             │
│  │  (Vite/Next)    │  │  (Express)      │  │  (Drizzle)      │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    MAIN-TEST SANDBOX                                 │   │
│  │                    (Merge verification)                              │   │
│  │                                                                     │   │
│  │  • Receives merged code from component sandboxes                    │   │
│  │  • Runs full verification swarm                                     │   │
│  │  • Visual verification (headless browser)                           │   │
│  │  • Intent satisfaction check                                        │   │
│  │  • Only if ALL pass → merge to MAIN                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                │                                            │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    MAIN SANDBOX                                      │   │
│  │                    (Live UI Preview)                                 │   │
│  │                                                                     │   │
│  │  • User sees this via Sandpack in browser                           │   │
│  │  • Only receives verified, merged code                              │   │
│  │  • Exposed via Modal tunnel → Preview URL                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REDIS CONTEXT SYNC                                  │
│                    (Real-time memory sharing)                               │
│                                                                             │
│  pub/sub channels:                                                          │
│  • build:{buildId}:context      - Unified context updates                   │
│  • build:{buildId}:file-change  - File modifications                        │
│  • build:{buildId}:errors       - Error discoveries                         │
│  • build:{buildId}:progress     - Phase progress                            │
│  • build:{buildId}:merge        - Merge requests                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: MODAL SANDBOX SERVICE

### Prompt 1.1: Create Modal Sandbox Runner (Python)

```
PROMPT FOR CLAUDE CODE:

[ULTRATHINK REQUIRED - This is the core compute layer]

Create a new Python module for Modal that runs KripTik build sandboxes.

Location: server/modal/kriptik_sandbox.py

Requirements:
1. Define a Modal App with dynamic image configuration
2. Support Node.js 20+, npm, git, Playwright for browser automation
3. Implement sandbox lifecycle: create → run → checkpoint → terminate
4. Support WebSocket communication back to Vercel coordinator
5. Implement TTL extension (keep-alive pings)
6. Support filesystem snapshots for long-running builds

Reference Modal's SDK (https://modal.com/docs/guide/sandboxes):
- Use Sandbox.create() with custom image
- Use encrypted_ports for WebSocket tunnels
- Use filesystem snapshotting for persistence

Key features:
- sandbox_create(config) → Returns sandbox_id and tunnel URLs
- sandbox_exec(sandbox_id, command) → Runs command, returns output
- sandbox_file_write(sandbox_id, path, content) → Writes file
- sandbox_file_read(sandbox_id, path) → Reads file
- sandbox_snapshot(sandbox_id) → Creates filesystem snapshot
- sandbox_terminate(sandbox_id) → Cleanup

The sandbox must:
- Have full Node.js environment (npm, npx, git)
- Run Vite/Next.js dev servers
- Run Playwright for browser automation
- Communicate via WebSocket to coordinator
- Auto-extend TTL while active
- Support up to 24-hour builds with checkpointing

DO NOT modify any auth files (auth.ts, schema.ts auth tables, middleware/auth.ts, auth-client.ts).

After implementation, verify Modal SDK usage is current by checking https://modal.com/docs/reference/modal.Sandbox
```

### Prompt 1.2: Create Modal TypeScript Client

```
PROMPT FOR CLAUDE CODE:

Create a TypeScript client for the Modal sandbox service.

Location: server/src/services/modal/modal-sandbox-client.ts

This client will be called by the Vercel coordinator to manage Modal sandboxes.

Requirements:
1. Use Modal's REST API or libmodal (https://github.com/modal-labs/libmodal)
2. Implement all sandbox operations:
   - createSandbox(config: SandboxConfig): Promise<SandboxInstance>
   - execCommand(sandboxId: string, command: string): Promise<ExecResult>
   - writeFile(sandboxId: string, path: string, content: string): Promise<void>
   - readFile(sandboxId: string, path: string): Promise<string>
   - listFiles(sandboxId: string, pattern: string): Promise<string[]>
   - getSnapshot(sandboxId: string): Promise<SnapshotId>
   - restoreSnapshot(snapshotId: string): Promise<SandboxInstance>
   - getTunnelUrl(sandboxId: string, port: number): Promise<string>
   - terminate(sandboxId: string): Promise<void>

3. Implement connection management:
   - WebSocket connection to each sandbox
   - Heartbeat/keep-alive every 30 seconds
   - Automatic reconnection on disconnect
   - Event streaming for real-time updates

4. Environment variables required:
   - MODAL_TOKEN_ID
   - MODAL_TOKEN_SECRET
   - MODAL_WORKSPACE (optional)

Integrate with existing server/src/services/cloud/modal.ts but DO NOT replace it.
Create as a NEW service that the orchestrator will use.

DO NOT modify any auth files.
```

---

## PHASE 2: COORDINATOR LAYER (VERCEL FLUID)

### Prompt 2.1: Create Build Coordinator Service

```
PROMPT FOR CLAUDE CODE:

[ULTRATHINK REQUIRED - This orchestrates the entire build]

Create a coordinator service that runs on Vercel Fluid and manages Modal sandboxes.

Location: server/src/services/orchestration/modal-build-coordinator.ts

This coordinator:
1. Receives NLP from frontend
2. Creates Intent Lock (Phase 0)
3. Spawns Modal sandboxes for each component
4. Manages real-time context sync via Redis
5. Orchestrates merge flow
6. Streams progress to frontend

Architecture:
- Runs on Vercel Fluid (up to 800s active)
- Uses waitUntil() for background processing
- Long builds continue via Modal (Modal handles persistence)
- Coordinator can restart and reconnect to existing sandboxes

Key methods:
- startBuild(config: BuildConfig): Promise<BuildSession>
- getSandboxStatus(buildId: string): Promise<SandboxStatus[]>
- requestMerge(sandboxId: string): Promise<MergeResult>
- getPreviewUrl(buildId: string): Promise<string>
- cancelBuild(buildId: string): Promise<void>
- resumeBuild(buildId: string): Promise<BuildSession>

Integration points:
- Use existing BuildLoopOrchestrator (server/src/services/automation/build-loop.ts)
  but delegate actual execution to Modal sandboxes
- Use existing VerificationSwarm (server/src/services/verification/swarm.ts)
  but run it INSIDE each Modal sandbox
- Use existing context-sync-service (server/src/services/agents/context-sync-service.ts)
  for real-time updates

Critical: The coordinator MUST be resumable. If Vercel restarts:
- Reconnect to existing Modal sandboxes via stored sandbox_ids
- Resume context sync via Redis
- Continue from last known state

DO NOT modify any auth files.
Read the unified orchestrator spec (.claude/rules/07-unified-orchestrator-spec.md) first.
```

### Prompt 2.2: Create Redis Context Sync Adapter

```
PROMPT FOR CLAUDE CODE:

Extend the existing Redis infrastructure to support multi-sandbox context sync.

Location: server/src/services/infrastructure/redis-sandbox-sync.ts

Use existing Redis connection (server/src/services/infrastructure/redis.ts).

Implement pub/sub channels for sandbox communication:

1. Context Updates:
   - publish: sandbox:context:update
   - subscribe: Each sandbox listens for updates from others

2. File Changes:
   - publish: sandbox:file:changed
   - Payload: { sandboxId, path, action, hash }

3. Error Discovery:
   - publish: sandbox:error:found
   - Other sandboxes can learn from and avoid same errors

4. Merge Requests:
   - publish: sandbox:merge:request
   - Coordinator receives and processes

5. Progress Updates:
   - publish: sandbox:progress:{buildId}
   - Frontend subscribes for UI updates

Key features:
- Message ordering guarantees (use Redis Streams if needed)
- Dead letter handling for failed messages
- Replay capability for sandbox reconnection
- Context compression for large payloads

Integration:
- Works with existing ContextSyncService
- Works with existing WebSocketSyncService
- All existing context-sharing code continues to work

DO NOT modify any auth files.
```

---

## PHASE 3: MULTI-SANDBOX ORCHESTRATION

### Prompt 3.1: Create Sandbox Fleet Manager

```
PROMPT FOR CLAUDE CODE:

[ULTRATHINK REQUIRED - This manages the entire sandbox fleet]

Create a fleet manager that orchestrates multiple sandboxes working together.

Location: server/src/services/orchestration/sandbox-fleet-manager.ts

Requirements:

1. Component-Based Allocation:
   Based on Intent Lock, determine components:
   - frontend (React/Vue/etc)
   - backend (Express/FastAPI/etc)
   - database (Drizzle/Prisma migrations)
   - api-integrations (third-party APIs)
   - auth (if needed - but NEVER modify KripTik's auth)
   - payments (Stripe/etc)

2. Sandbox Creation per Component:
   - Each component gets its own Modal sandbox
   - 3-5 agents work WITHIN each sandbox
   - All sandboxes share context via Redis

3. Tournament Mode Support:
   - When enabled, create 2-3 sandboxes PER component
   - Each sandbox builds the same component differently
   - AI Judge compares results, picks winner
   - Winner sandbox continues, others terminated

4. Merge Orchestration:
   - Track component dependencies (frontend needs backend API)
   - Merge in dependency order
   - Before each merge: run verification swarm in main-test
   - Only merge if all checks pass

5. Resource Management:
   - Track active sandboxes per user
   - Enforce budget limits
   - Auto-terminate idle sandboxes (configurable TTL)
   - Support priority queuing

Interface:
```typescript
interface SandboxFleetManager {
  createFleet(buildId: string, intentContract: IntentContract): Promise<Fleet>;
  getSandbox(sandboxId: string): Promise<ManagedSandbox>;
  getAllSandboxes(buildId: string): Promise<ManagedSandbox[]>;
  requestMerge(sandboxId: string): Promise<MergeRequest>;
  processMerge(mergeRequest: MergeRequest): Promise<MergeResult>;
  enableTournamentMode(componentId: string): Promise<TournamentSession>;
  selectTournamentWinner(tournamentId: string): Promise<SandboxId>;
  terminateFleet(buildId: string): Promise<void>;
}
```

Read tournament mode implementation in server/src/services/ai/tournament.ts
Integrate with existing ParallelAgentManager (server/src/services/automation/parallel-agent-manager.ts)

DO NOT modify any auth files.
```

### Prompt 3.2: Create Per-Sandbox Build Runner

```
PROMPT FOR CLAUDE CODE:

Create the build runner that executes INSIDE each Modal sandbox.

Location: server/src/services/sandbox/sandbox-build-runner.ts

This code runs WITHIN Modal, not on Vercel.

Requirements:

1. Context Loading:
   - Subscribe to Redis context channels
   - Load unified context (14 sections)
   - Continuously update as other sandboxes share discoveries

2. Agent Execution:
   - Use existing CodingAgentWrapper (server/src/services/ai/coding-agent-wrapper.ts)
   - Spawn 3-5 agents per sandbox
   - Agents work on tasks from artifact system

3. File Operations:
   - Write files to sandbox filesystem
   - Run npm install, npm run build
   - Start dev servers (Vite, Next.js)

4. Verification Swarm:
   - Run full verification swarm (6 agents) in sandbox
   - Error Checker, Code Quality, Visual Verifier, Security Scanner, Placeholder Eliminator, Design Style
   - Run continuously in background

5. Done Criteria Check:
   - Compare progress against Intent Lock success criteria
   - Only signal "done" when ALL criteria met
   - Never give up - escalate errors up to level 4

6. Merge Signaling:
   - When component is verified and done
   - Signal coordinator via Redis
   - Wait for merge approval
   - After merge, continue with next tasks or terminate

Integration:
- Reuse existing build-loop.ts phase logic
- Reuse existing verification swarm
- Reuse existing error escalation
- All existing features must work inside sandbox

DO NOT modify any auth files.
```

---

## PHASE 4: MERGE AND VERIFICATION PIPELINE

### Prompt 4.1: Create Main-Test Sandbox Manager

```
PROMPT FOR CLAUDE CODE:

Create the main-test sandbox that verifies merges before they go to main.

Location: server/src/services/orchestration/main-test-sandbox-manager.ts

The main-test sandbox:
1. Receives code from component sandboxes
2. Performs pre-merge verification
3. Tests integration between components
4. Visual verification via headless browser
5. Intent satisfaction check
6. Only approves merge if ALL pass

Flow:
1. Component sandbox signals "ready to merge"
2. Coordinator creates merge request
3. Main-test sandbox:
   a. Creates git branch for merge
   b. Applies changes from component
   c. Runs full verification swarm
   d. Runs Playwright tests for all user workflows
   e. Takes screenshots, compares to expectations
   f. Checks Intent Lock success criteria
4. If ALL pass → Approve merge → Apply to main
5. If ANY fail → Reject → Return errors to component sandbox

Key features:
- Isolated merge testing (no pollution of main)
- Full verification before merge (not after)
- Visual regression detection
- Intent satisfaction gate

Integration:
- Use existing VerificationSwarm
- Use existing BrowserAutomationService
- Use existing IntentLockEngine.checkSatisfaction()

DO NOT modify any auth files.
```

### Prompt 4.2: Create Live Preview Sync

```
PROMPT FOR CLAUDE CODE:

Create the service that syncs the main sandbox to the user's live preview.

Location: server/src/services/preview/live-preview-sync.ts

The live preview is what users see in the Builder View.

Requirements:

1. File Sync:
   - After each approved merge, sync files to preview
   - Use WebSocket to push updates to frontend
   - Frontend uses Sandpack to render preview

2. Preview URL Management:
   - Each build gets a preview URL via Modal tunnel
   - URL is stable for the build session
   - Supports hot reload

3. User Takeover:
   - "Take Control" button in UI
   - User can interact with preview
   - User interactions don't affect sandbox builds

4. Screenshot Capture:
   - Periodic screenshots of preview
   - Used for visual verification
   - Stored for tournament comparison

Integration:
- Works with existing Sandpack provider (src/lib/sandpack-provider.tsx)
- Works with existing FeaturePreviewWindow
- SSE streaming for real-time updates

DO NOT modify any auth files.
```

---

## PHASE 5: LONG-RUNNING BUILD SUPPORT

### Prompt 5.1: Create Build Persistence Manager

```
PROMPT FOR CLAUDE CODE:

[ULTRATHINK REQUIRED - Enables hours/days-long builds]

Create the persistence manager for long-running builds.

Location: server/src/services/orchestration/build-persistence-manager.ts

Requirements:

1. Session Persistence:
   - Store build state in database (Turso)
   - Include: sandbox_ids, phase, progress, artifacts
   - Enable resume from any point

2. Sandbox Checkpointing:
   - Trigger Modal filesystem snapshots periodically
   - Store snapshot_ids with build session
   - Enable sandbox respawn from snapshot

3. Agent Respawn:
   - If sandbox terminates unexpectedly
   - Load checkpoint, restore context
   - Respawn agents, continue from last task

4. Budget Tracking:
   - Track compute costs per build
   - Warn user when approaching budget
   - Pause (not terminate) when budget exceeded
   - Resume when user adds budget

5. Ghost Mode Integration:
   - Works with existing GhostModeController
   - User can leave, build continues
   - Notifications when complete/error

Database schema additions (NEW TABLES - DO NOT MODIFY AUTH TABLES):
- build_sessions: { id, userId, status, sandboxIds, checkpointIds, startedAt, lastActivityAt }
- sandbox_checkpoints: { id, sessionId, sandboxId, snapshotId, phase, createdAt }
- build_costs: { id, sessionId, computeSeconds, estimatedCost, createdAt }

Integration:
- Works with existing GhostModeController
- Works with existing Time Machine (checkpoints)
- Updates build_session_progress table

DO NOT modify any auth files.
DO NOT modify existing auth-related tables in schema.ts.
```

### Prompt 5.2: Create Coordinator Resumption Handler

```
PROMPT FOR CLAUDE CODE:

Create the handler for coordinator resumption after Vercel restarts.

Location: server/src/services/orchestration/coordinator-resumption.ts

When Vercel Fluid times out or restarts:
1. Active builds must be resumable
2. Sandboxes continue running on Modal
3. New coordinator instance must reconnect

Requirements:

1. On Startup:
   - Check for active build sessions in database
   - For each active session:
     a. Check sandbox health via Modal API
     b. Reconnect WebSocket to each sandbox
     c. Resubscribe to Redis channels
     d. Resume from last known state

2. Heartbeat System:
   - Coordinator sends heartbeat every 60s
   - If missed heartbeat detected, trigger resumption
   - Sandboxes continue independently

3. State Recovery:
   - Load last known phase, progress
   - Load pending merge requests
   - Resume verification if interrupted

4. Edge Cases:
   - Sandbox died while coordinator was down → Respawn from checkpoint
   - Merge was pending → Re-verify and continue
   - User cancelled while down → Clean terminate

Integration:
- Called from server startup (server/src/index.ts)
- Uses build-persistence-manager
- Uses modal-sandbox-client

DO NOT modify any auth files.
```

---

## PHASE 6: INTEGRATION WITH EXISTING SYSTEMS

### Prompt 6.1: Modify Build Loop Orchestrator

```
PROMPT FOR CLAUDE CODE:

[ULTRATHINK REQUIRED - Core integration point]

Modify the existing BuildLoopOrchestrator to delegate execution to Modal sandboxes.

File: server/src/services/automation/build-loop.ts

CRITICAL: DO NOT rewrite from scratch. MODIFY EXISTING CODE.

Changes needed:

1. Phase 2 (Parallel Build):
   - BEFORE: Agents run locally, write to filesystem
   - AFTER: Spawn Modal sandboxes, agents run in sandboxes

2. Replace local execution with Modal calls:
   - fs.writeFile → modalClient.writeFile(sandboxId, ...)
   - spawn('npm', ...) → modalClient.exec(sandboxId, 'npm ...')
   - Start dev server → modalClient.exec(sandboxId, 'npm run dev')

3. Add sandbox management:
   - Create sandboxes at Phase 1
   - Track sandbox health throughout
   - Handle sandbox failures (respawn)

4. Preserve ALL existing features:
   - Intent Lock (Phase 0)
   - Verification Swarm (Phase 6)
   - Error Escalation
   - Learning Capture (Phase 8)
   - All 91 features from unified-orchestrator-spec.md

5. Integration points:
   - Use ModalBuildCoordinator for sandbox management
   - Use SandboxFleetManager for multi-sandbox orchestration
   - Use RedisSandboxSync for context sharing

Backward compatibility:
   - If MODAL_TOKEN_ID not set, fall back to local execution
   - Existing tests continue to pass

DO NOT modify any auth files.
Read the file carefully before making changes.
```

### Prompt 6.2: Update API Routes

```
PROMPT FOR CLAUDE CODE:

Update the execute API route to support Modal-based builds.

File: server/src/routes/execute.ts

Changes:

1. Add build_mode parameter:
   - 'local' (default if Modal not configured)
   - 'modal' (use Modal sandboxes)
   - 'hybrid' (coordinator on Vercel, execution on Modal)

2. For Modal mode:
   - Create build session in database
   - Spawn coordinator (handles Modal sandboxes)
   - Return session_id for status polling

3. For long-running builds:
   - Use Vercel waitUntil() for background processing
   - Return immediately with session_id
   - Client polls /api/build/status/{sessionId}

4. New endpoints needed:
   - GET /api/build/status/:sessionId
   - GET /api/build/preview/:sessionId
   - POST /api/build/cancel/:sessionId
   - POST /api/build/resume/:sessionId

5. SSE streaming endpoint:
   - GET /api/build/stream/:sessionId
   - Streams progress, phase changes, errors
   - Client can display real-time updates

DO NOT modify any auth files.
Preserve existing functionality.
```

---

## PHASE 7: ENVIRONMENT AND DEPLOYMENT

### Prompt 7.1: Environment Variables and Configuration

```
PROMPT FOR CLAUDE CODE:

Create/update configuration for Modal integration.

Files to update:
- server/src/config/modal.ts (create new)
- server/.env.example (update)
- SETUP.md (update)

Required environment variables:
```
# Modal Configuration
MODAL_TOKEN_ID=              # From modal token new
MODAL_TOKEN_SECRET=          # From modal token new
MODAL_WORKSPACE=             # Optional, defaults to 'default'
MODAL_SANDBOX_TTL=3600       # Default sandbox TTL in seconds
MODAL_MAX_CONCURRENT=100     # Max concurrent sandboxes per user

# Redis for Sandbox Sync
REDIS_URL=                   # Already exists, reuse
REDIS_SANDBOX_PREFIX=kriptik:sandbox

# Build Persistence
BUILD_SESSION_TTL=86400      # Max build session duration (24h default)
BUILD_CHECKPOINT_INTERVAL=300 # Checkpoint every 5 minutes
```

Configuration object:
```typescript
export const modalConfig = {
  enabled: !!process.env.MODAL_TOKEN_ID,
  tokenId: process.env.MODAL_TOKEN_ID,
  tokenSecret: process.env.MODAL_TOKEN_SECRET,
  workspace: process.env.MODAL_WORKSPACE || 'default',
  sandbox: {
    ttl: parseInt(process.env.MODAL_SANDBOX_TTL || '3600'),
    maxConcurrent: parseInt(process.env.MODAL_MAX_CONCURRENT || '100'),
  },
  persistence: {
    sessionTtl: parseInt(process.env.BUILD_SESSION_TTL || '86400'),
    checkpointInterval: parseInt(process.env.BUILD_CHECKPOINT_INTERVAL || '300'),
  },
};
```

DO NOT modify any auth-related environment variables.
```

### Prompt 7.2: Modal Deployment Script

```
PROMPT FOR CLAUDE CODE:

Create deployment script for Modal sandbox infrastructure.

Location: server/modal/deploy.py

This script:
1. Validates Modal credentials
2. Builds and deploys the sandbox image
3. Verifies deployment is working
4. Outputs sandbox endpoint URL

Usage: python server/modal/deploy.py

Include:
- Pre-flight checks (Node.js version, required packages)
- Image build with caching
- Deployment verification (create test sandbox, run command, verify)
- Rollback on failure

Also create:
- server/modal/requirements.txt (Modal Python dependencies)
- server/modal/README.md (deployment instructions)

DO NOT include any auth credentials in scripts.
```

---

## PHASE 8: TESTING AND VERIFICATION

### Prompt 8.1: Integration Tests

```
PROMPT FOR CLAUDE CODE:

Create integration tests for Modal sandbox infrastructure.

Location: server/src/tests/modal-sandbox.test.ts

Tests:
1. Sandbox lifecycle (create → exec → terminate)
2. File operations (write → read → list)
3. Multi-sandbox communication (Redis sync)
4. Merge verification flow
5. Checkpoint and restore
6. Coordinator resumption
7. Long-running build simulation

Use existing test infrastructure.
Mock Modal API for unit tests.
Create separate e2e tests that use real Modal (run manually).

DO NOT modify any auth tests.
```

### Prompt 8.2: Verification Checklist

```
PROMPT FOR CLAUDE CODE:

Create verification checklist for Modal integration.

Location: .claude/memory/modal-verification-checklist.md

Checklist:
[ ] Modal credentials configured and validated
[ ] Sandbox creation works (test sandbox starts in <2s)
[ ] File operations work (write, read, list)
[ ] Command execution works (npm install, npm run build)
[ ] Dev server starts and is accessible via tunnel
[ ] WebSocket communication works (coordinator ↔ sandbox)
[ ] Redis pub/sub works (sandbox ↔ sandbox)
[ ] Verification swarm runs in sandbox
[ ] Merge flow works (component → main-test → main)
[ ] Checkpoint/restore works
[ ] Coordinator resumption works
[ ] Long-running build completes (test 10-minute build)
[ ] Ghost Mode works with Modal builds
[ ] Tournament Mode works with Modal builds
[ ] All existing tests pass
[ ] Auth still works (CRITICAL - run full auth test suite)

DO NOT skip auth verification.
```

---

## IMPLEMENTATION ORDER

Execute prompts in this order:

### Week 1: Foundation
1. **Prompt 1.1** - Modal Sandbox Runner (Python)
2. **Prompt 1.2** - Modal TypeScript Client
3. **Prompt 7.1** - Environment Configuration
4. **Prompt 7.2** - Modal Deployment Script

### Week 2: Coordinator
5. **Prompt 2.1** - Build Coordinator Service
6. **Prompt 2.2** - Redis Context Sync Adapter
7. **Prompt 5.2** - Coordinator Resumption Handler

### Week 3: Multi-Sandbox
8. **Prompt 3.1** - Sandbox Fleet Manager
9. **Prompt 3.2** - Per-Sandbox Build Runner
10. **Prompt 5.1** - Build Persistence Manager

### Week 4: Merge Pipeline
11. **Prompt 4.1** - Main-Test Sandbox Manager
12. **Prompt 4.2** - Live Preview Sync

### Week 5: Integration
13. **Prompt 6.1** - Modify Build Loop Orchestrator
14. **Prompt 6.2** - Update API Routes

### Week 6: Testing
15. **Prompt 8.1** - Integration Tests
16. **Prompt 8.2** - Verification Checklist

---

## FILES NOT TO MODIFY

These files are LOCKED and must NOT be modified:

```
server/src/auth.ts
server/src/schema.ts (auth tables only: users, sessions, accounts, verifications)
server/src/middleware/auth.ts
src/lib/auth-client.ts
```

See `.claude/rules/AUTH-IMMUTABLE-SPECIFICATION.md` for details.

---

## SUCCESS CRITERIA

The Modal integration is complete when:

1. [ ] User enters NLP → Build runs on Modal (not local)
2. [ ] Multiple sandboxes work in parallel (3+ components)
3. [ ] Context syncs in real-time between sandboxes
4. [ ] Verification swarm runs in each sandbox
5. [ ] Tournament mode creates competing sandboxes
6. [ ] Main-test sandbox verifies before merge
7. [ ] User sees live preview of merged code
8. [ ] Builds can run for hours (tested 4+ hour build)
9. [ ] Coordinator survives Vercel restarts
10. [ ] Ghost Mode works (user leaves, build continues)
11. [ ] All existing features work (91 features preserved)
12. [ ] Auth continues to work (CRITICAL)
13. [ ] No regressions in existing tests

---

## REFERENCES

- [Modal Sandboxes Documentation](https://modal.com/docs/guide/sandboxes)
- [Modal Lovable Case Study](https://modal.com/blog/lovable-case-study)
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)
- [KripTik Unified Orchestrator Spec](.claude/rules/07-unified-orchestrator-spec.md)
- [KripTik Master Orchestrator Spec](.claude/rules/09-master-orchestrator-spec.md)
- [Auth Immutable Specification](.claude/rules/AUTH-IMMUTABLE-SPECIFICATION.md)

---

*This implementation plan transforms KripTik from a prototype to a Lovable-scale production system.*

*Created: 2026-01-03*
