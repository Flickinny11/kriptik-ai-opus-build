# KripTik AI Builder View Fix Implementation Plan v2
## REVISED: Architectural Integration with BuildLoopOrchestrator

**Created**: January 16, 2026
**Revised**: January 16, 2026 (Major Architectural Fix)
**Status**: Ready for Production Implementation
**Estimated Prompts**: 28 Structured Prompts in 11 Phases

---

## CRITICAL DISCOVERY: WHY THE CURRENT SYSTEM IS SLOW AND BROKEN

### Root Cause Analysis

After deep analysis of the BuildLoopOrchestrator (3000+ lines), I discovered:

1. **BuildLoopOrchestrator is 99% PRODUCTION READY** - All 6 phases are fully implemented
2. **The `/api/execute/plan/stream` endpoint BYPASSES the orchestrator** - This is the root cause
3. **Token mismatch causes extended thinking to DISABLE** - Warning at claude-service.ts:515-517
4. **The orchestrator ALREADY HAS credential pause/resume** - Lines 2213-2222, 8130-8391
5. **Duplicate work** - Plan endpoint creates Intent Lock, then orchestrator creates ANOTHER

### The Architectural Problem

```
CURRENT (BROKEN) FLOW:
┌─────────────────────────────────────────────────────────────┐
│ 1. User enters NLP                                          │
│ 2. Frontend calls /api/execute/plan/stream                  │
│ 3. /plan/stream uses DIRECT Claude service ← NOT ORCHESTRATOR
│ 4. Token config WRONG: thinkingBudget=16000, max_tokens=2000│
│ 5. Extended thinking DISABLED → 218,992ms (3.6 minutes!)    │
│ 6. Plan returned                                            │
│ 7. User approves                                            │
│ 8. SEPARATE endpoint starts BuildLoopOrchestrator           │
│ 9. Orchestrator runs Phase 0 AGAIN (DUPLICATE Intent Lock!) │
│ 10. Build continues...                                      │
└─────────────────────────────────────────────────────────────┘

CORRECT FLOW (WHAT ORCHESTRATOR ALREADY SUPPORTS):
┌─────────────────────────────────────────────────────────────┐
│ 1. User enters NLP                                          │
│ 2. Frontend calls SINGLE endpoint that starts orchestrator  │
│ 3. Orchestrator Phase 0: Intent Lock (64K thinking) ← FAST  │
│ 4. Stream thinking tokens to frontend                       │
│ 5. Phase 0 complete: Deep Intent Contract created           │
│ 6. Frontend shows human-readable plan from contract         │
│ 7. User reviews/modifies (optional)                         │
│ 8. Orchestrator Phase 1: Detects required credentials       │
│ 9. Orchestrator PAUSES → Emits 'credentials_required'       │
│ 10. Frontend shows Dependency Connection UI                 │
│ 11. User connects services                                  │
│ 12. User clicks "Start Build" → orchestrator.resume()       │
│ 13. Orchestrator Phases 2-6: Build completes                │
│ 14. User sees working app in browser                        │
└─────────────────────────────────────────────────────────────┘
```

### What BuildLoopOrchestrator ALREADY Has (No Need to Implement)

| Feature | Status | Location |
|---------|--------|----------|
| Intent Lock with 64K thinking | ✅ READY | build-loop.ts:1876-1941 |
| Credential detection + pause | ✅ READY | build-loop.ts:2213-2222 |
| 'credentials_required' event | ✅ READY | build-loop.ts:656 |
| Pause/Resume with full context | ✅ READY | build-loop.ts:6865-6999 |
| Build Freeze Service | ✅ READY | build-loop.ts:6889-6999 |
| Verification Swarm (6 agents) | ✅ READY | build-loop.ts:805 |
| Anti-Slop (85 threshold, auto-fix) | ✅ READY | build-loop.ts:3706-3751 |
| Error Escalation (4 levels) | ✅ READY | build-loop.ts:3226-3257 |
| Streaming Events (40+ types) | ✅ READY | build-loop.ts:479-657 |
| Parallel Agents (3-5) | ✅ READY | build-loop.ts:2336-2401 |
| Gap Closers (7 agents) | ✅ READY | build-loop.ts:3066 |
| Browser Demo (Phase 6) | ✅ READY | build-loop.ts:4595-4728 |

---

## PHASE 0: CRITICAL ARCHITECTURAL FIX (3 Prompts) ⚠️ DO THIS FIRST

### Prompt 0.1: Replace /plan/stream with BuildLoopOrchestrator

```
READ FIRST (CRITICAL):
- server/src/routes/execute.ts (especially lines 2073-2350)
- server/src/services/automation/build-loop.ts (especially lines 1876-1941, 8815-8844)
- server/src/services/ai/claude-service.ts (especially lines 449-527, 695-760)

PROBLEM:
The /api/execute/plan/stream endpoint (line 2073 in execute.ts) uses direct Claude service calls instead of BuildLoopOrchestrator. This causes:
1. Wrong token configuration (thinkingBudget=16000 vs max_tokens=2000 somewhere)
2. Extended thinking gets DISABLED (warning at claude-service.ts:515-517)
3. Plan generation takes 218,992ms (3.6 minutes!)
4. Duplicate Intent Lock creation (once in /plan/stream, once in orchestrator)
5. Credential detection not integrated
6. Verification Swarm not running
7. All orchestrator features bypassed

SOLUTION:
Replace the entire /plan/stream endpoint to use BuildLoopOrchestrator with a new "plan-only" mode that:
1. Starts the orchestrator
2. Runs ONLY Phase 0 (Intent Lock)
3. Streams Phase 0 events to frontend
4. Returns the Deep Intent Contract
5. PAUSES the orchestrator (ready for resume after credentials)

TASK:
1. Create a new endpoint POST /api/execute/orchestrator/start that:

```typescript
router.post('/orchestrator/start', async (req: Request, res: Response) => {
    const { userId, projectId, prompt, mode = 'production' } = req.body;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (type: string, data: any) => {
        res.write(`data: ${JSON.stringify({ type, ...data, timestamp: Date.now() })}\n\n`);
    };

    try {
        // Create orchestrator with proper config
        const orchestrationRunId = uuidv4();
        const orchestrator = new BuildLoopOrchestrator(
            projectId,
            userId,
            orchestrationRunId,
            mode as BuildMode,
            {
                humanInTheLoop: false,
                credentials: req.body.credentials || {}
            }
        );

        // Store orchestrator reference for later resume
        activeOrchestrators.set(orchestrationRunId, orchestrator);

        // Forward ALL orchestrator events to SSE
        orchestrator.on('*', (event: BuildLoopEvent) => {
            sendEvent(event.type, event.data);
        });

        // Specifically handle key events
        orchestrator.on('intent_created', (data) => {
            sendEvent('intent_created', {
                contractId: data.contractId,
                appType: data.appType,
                appSoul: data.appSoul,
                successCriteria: data.successCriteriaCount,
                functionalChecklist: data.functionalChecklistCount,
                integrations: data.integrationsCount
            });
        });

        orchestrator.on('credentials_required', (data) => {
            sendEvent('credentials_required', {
                requiredCredentials: data.requiredCredentials,
                buildPaused: true
            });
        });

        orchestrator.on('phase_complete', (data) => {
            if (data.phase === 'intent_lock') {
                // Phase 0 complete - return Deep Intent Contract
                sendEvent('plan_ready', {
                    orchestrationRunId,
                    intentContract: orchestrator.getIntentContract(),
                    canResume: true
                });
            }
        });

        // Start the orchestrator (it will run Phase 0, then pause for credentials)
        await orchestrator.start(prompt);

        sendEvent('complete', { orchestrationRunId, status: 'paused_for_credentials' });

    } catch (error) {
        sendEvent('error', { message: error.message });
    }
});
```

2. Create resume endpoint POST /api/execute/orchestrator/resume:

```typescript
router.post('/orchestrator/resume', async (req: Request, res: Response) => {
    const { orchestrationRunId, credentials } = req.body;

    const orchestrator = activeOrchestrators.get(orchestrationRunId);
    if (!orchestrator) {
        return res.status(404).json({ error: 'Orchestrator not found' });
    }

    // Provide credentials
    if (credentials) {
        orchestrator.provideCredentials(credentials);
    }

    // Set up SSE for streaming build progress
    res.setHeader('Content-Type', 'text/event-stream');
    // ... same as above

    // Resume build
    orchestrator.resume();
});
```

3. Update the frontend to use the new endpoints instead of /plan/stream

4. Mark the old /plan/stream endpoint as DEPRECATED

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 0.2: Fix Token Configuration in Claude Service

```
READ FIRST:
- server/src/services/ai/claude-service.ts (entire file, especially lines 449-527, 695-760)

PROBLEM:
The generateStream() method has different defaults than generate():
- generate(): maxTokens = 32000, thinkingBudgetTokens = 16000
- generateStream(): maxTokens = 16000, thinkingBudgetTokens = 10000

The validation at line 515-517 DISABLES extended thinking when thinkingBudget is too close to maxTokens:
```typescript
if (effectiveBudget < 1000) {
    console.warn(`Warning: Thinking budget (${thinkingBudgetTokens}) too close to max_tokens (${maxTokens}). Disabling extended thinking.`);
}
```

The error log showed max_tokens=2000, but the code shows 64000. This means either:
1. An override is happening somewhere
2. The deployed code is different
3. There's a fallback path with wrong defaults

TASK:
1. Standardize ALL token defaults across the service:

```typescript
// At the top of the file, define STANDARD defaults
const STANDARD_TOKEN_CONFIG = {
    maxTokens: 128000,  // Full capacity for Opus 4.5
    thinkingBudgetTokens: 64000,  // Sacred 64K thinking
    minResponseTokens: 8192,  // Always leave room for response
};

// Validation function to use everywhere
function validateTokenConfig(maxTokens: number, thinkingBudget: number): { maxTokens: number, thinkingBudget: number } {
    // Ensure maxTokens > thinkingBudget + minResponseTokens
    const minRequired = thinkingBudget + STANDARD_TOKEN_CONFIG.minResponseTokens;
    if (maxTokens <= minRequired) {
        console.log(`[ClaudeService] Adjusting max_tokens from ${maxTokens} to ${minRequired + 1024} to accommodate thinking budget`);
        maxTokens = minRequired + 1024;
    }
    return { maxTokens, thinkingBudget };
}
```

2. Update generate() method (line 449):
```typescript
const {
    model = CLAUDE_MODELS.OPUS_4_5,  // Default to best model
    maxTokens = STANDARD_TOKEN_CONFIG.maxTokens,
    thinkingBudgetTokens = STANDARD_TOKEN_CONFIG.thinkingBudgetTokens,
    // ...
} = options;

// Validate and fix token configuration
const validatedConfig = validateTokenConfig(maxTokens, thinkingBudgetTokens);
```

3. Update generateStream() method (line 695):
```typescript
const {
    model = CLAUDE_MODELS.OPUS_4_5,
    maxTokens = STANDARD_TOKEN_CONFIG.maxTokens,
    thinkingBudgetTokens = STANDARD_TOKEN_CONFIG.thinkingBudgetTokens,
    // ...
} = options;

// Validate and fix token configuration
const validatedConfig = validateTokenConfig(maxTokens, thinkingBudgetTokens);
```

4. Update ALL other methods that use token configs to use the same validation

5. Add warning logs when defaults are overridden to help debug future issues

6. REMOVE the code that DISABLES extended thinking - instead, FIX the config:
```typescript
// OLD (line 515-517) - REMOVE THIS
if (effectiveBudget < 1000) {
    console.warn(`Disabling extended thinking.`);
}

// NEW - FIX the config instead
if (effectiveBudget < 1000) {
    const fixedMaxTokens = thinkingBudgetTokens + STANDARD_TOKEN_CONFIG.minResponseTokens;
    console.log(`[ClaudeService] Auto-fixing: max_tokens increased to ${fixedMaxTokens} to enable extended thinking`);
    requestParams.max_tokens = fixedMaxTokens;
}
```

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 0.3: Wire Orchestrator Events to Frontend SSE Format

```
READ FIRST:
- server/src/services/automation/build-loop.ts (lines 479-657 - all event types)
- Current frontend expectations from the plan/stream endpoint

TASK:
Create an event transformer that converts BuildLoopOrchestrator events to the format the frontend expects.

1. Create server/src/services/automation/event-transformer.ts:

```typescript
import { BuildLoopEvent } from './build-loop.js';

export interface FrontendEvent {
    type: string;
    content?: string;
    phase?: string;
    details?: any;
    timestamp: number;
}

export function transformOrchestratorEvent(event: BuildLoopEvent): FrontendEvent[] {
    const events: FrontendEvent[] = [];

    switch (event.type) {
        case 'phase_start':
            events.push({
                type: 'phase',
                content: getPhaseDescription(event.data.phase),
                phase: event.data.phase,
                timestamp: Date.now()
            });
            break;

        case 'thinking':
            events.push({
                type: 'thinking',
                content: event.data.content,
                phase: 'reasoning',
                timestamp: Date.now()
            });
            break;

        case 'intent_created':
            events.push({
                type: 'plan_ready',
                content: 'Implementation plan ready for review',
                details: {
                    appType: event.data.appType,
                    appSoul: event.data.appSoul,
                    successCriteria: event.data.successCriteriaCount,
                    functionalChecklist: event.data.functionalChecklistCount,
                    integrations: event.data.integrationsCount
                },
                timestamp: Date.now()
            });
            break;

        case 'credentials_required':
            events.push({
                type: 'credentials_required',
                content: 'Please connect required services',
                details: {
                    requiredCredentials: event.data.requiredCredentials,
                    buildPaused: true
                },
                timestamp: Date.now()
            });
            break;

        case 'file_write':
        case 'file_edit':
            events.push({
                type: 'code',
                content: `Writing ${event.data.filePath}`,
                details: event.data,
                timestamp: Date.now()
            });
            break;

        case 'verification_result':
            events.push({
                type: 'verification',
                content: event.data.passed ? 'Verification passed' : 'Issues found',
                details: event.data,
                timestamp: Date.now()
            });
            break;

        // Map all 40+ event types...
        default:
            events.push({
                type: event.type,
                content: JSON.stringify(event.data),
                timestamp: Date.now()
            });
    }

    return events;
}

function getPhaseDescription(phase: string): string {
    const descriptions: Record<string, string> = {
        'intent_lock': 'Creating Sacred Contract (Deep Intent Lock)...',
        'initialization': 'Setting up project structure and artifacts...',
        'parallel_build': 'Building features with parallel agents...',
        'integration_check': 'Checking integrations and merging code...',
        'functional_test': 'Running functional tests and Gap Closers...',
        'intent_satisfaction': 'Verifying all requirements are met...',
        'browser_demo': 'Preparing your app for demonstration...'
    };
    return descriptions[phase] || `Starting ${phase}...`;
}
```

2. Use this transformer in the new /orchestrator/start endpoint

3. Ensure frontend receives events it can understand and display

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 1: DATABASE MIGRATION FIX (2 Prompts)

### Prompt 1.1: Create Migration Script for Missing Tables

```
You are a database migration expert for KripTik AI. The following tables are defined in server/src/schema.ts but the database is throwing "no such table" errors:

1. credit_pool (line 2783 in schema.ts)
2. learning_context_priorities (line 4198 in schema.ts)

Your task:
1. Read the full table definitions from server/src/schema.ts for credit_pool and learning_context_priorities
2. Create a migration file at server/src/db/migrations/0001_add_missing_tables.sql that creates both tables with:
   - All columns exactly as defined in schema.ts
   - All foreign key relationships
   - All default values
   - All indexes
3. Update server/src/db/migrate.ts to run this migration on startup
4. Add a check in server/src/index.ts that verifies these tables exist before the server starts

Requirements:
- Use SQLite syntax (the project uses libsql/turso)
- Include IF NOT EXISTS to make migrations idempotent
- Add proper error handling with descriptive messages
- Log migration success/failure to console

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 1.2: Add Database Health Check Endpoint

```
You are implementing a database health check for KripTik AI.

Create a new endpoint at /api/health/database that:
1. Checks all critical tables exist: users, projects, builds, credit_pool, learning_context_priorities, userCredentials, integrationConnections
2. Returns a detailed status for each table
3. Attempts auto-repair by running migrations if tables are missing
4. Returns appropriate HTTP status codes:
   - 200: All tables healthy
   - 207: Some tables missing but auto-repaired
   - 503: Critical tables missing, cannot auto-repair

Add this route to server/src/routes/index.ts

Response format:
{
  "healthy": boolean,
  "tables": {
    "users": { "exists": true, "rowCount": number },
    ...
  },
  "migrationsRun": string[],
  "errors": string[]
}

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 2: NANGO INTEGRATION FIX (2 Prompts)

### Prompt 2.1: Fix Nango Auth URL 404 Error

```
READ FIRST:
- server/src/routes/nango.ts (line 323 - auth-url endpoint)
- server/src/services/integrations/nango-service.ts (isConfigured() method)

PROBLEM:
- 404 on /api/nango/auth-url
- "missing_public_key" error

TASK:
1. Update nango.ts auth-url endpoint to return proper error messages:

```typescript
router.get('/auth-url', async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }

    if (!nangoService.isConfigured()) {
        const missingKeys = [];
        if (!process.env.NANGO_PUBLIC_KEY) missingKeys.push('NANGO_PUBLIC_KEY');
        if (!process.env.NANGO_SECRET_KEY) missingKeys.push('NANGO_SECRET_KEY');

        return res.status(503).json({
            success: false,
            error: 'OAuth not configured - please use manual credential entry',
            code: 'NANGO_NOT_CONFIGURED',
            missingKeys,
            fallbackAvailable: true  // Tell frontend to show manual entry
        });
    }

    // ... rest of implementation
});
```

2. Add fallback in frontend: when Nango not configured, show manual credential entry

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 2.2: Add Nango Configuration Validation

```
READ FIRST:
- server/src/services/integrations/nango-service.ts

TASK:
1. Create server/src/services/integrations/nango-validator.ts with startup validation
2. Log clear warnings if Nango is not configured (don't fail, just warn)
3. Add endpoint GET /api/nango/config-status for frontend to check

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 3: CREDENTIAL INPUT UX FIX (3 Prompts)

### Prompt 3.1: Fix Missing Input Boxes After "Get API Key"

```
READ FIRST:
- src/components/credentials/CredentialAcquisitionModal.tsx

PROBLEM:
After clicking "Get API Key", no input boxes appear for users to enter credentials.

TASK:
Modify the component to ALWAYS show input fields:
1. "Get API Key" button opens platform URL in new tab
2. Input fields are ALREADY VISIBLE below the button
3. Clear labels for each required credential
4. Placeholder text showing expected format
5. "Save Credentials" button (disabled until all required fields filled)

See original implementation plan for detailed code.

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 3.2: Add Connect Buttons to Cloud Storage Tiles

```
READ FIRST:
- src/components/stack-selection/StackSelectionPanel.tsx

TASK:
Ensure ALL tiles, including cloud storage (S3, GCS, R2), have proper connect UI with either:
- OAuth button (for supported services)
- "Add Credentials" button (for non-OAuth services)

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 3.3: Remove Developer-Facing Content from UI

```
TASK:
Search and remove any UI that displays:
- npm commands users shouldn't see
- .env templates
- Internal environment variable names

Search patterns:
- grep -r "npm install" src/
- grep -r "npm run" src/
- grep -r "\.env" src/components/

Replace with user-friendly alternatives:
- "npm install" → (remove, installation happens internally)
- .env template → "Credentials Status" panel with checkmarks

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 4: FRONTEND FLOW ORDER CORRECTION (3 Prompts)

### Prompt 4.1: Implement Correct Builder View State Machine

```
READ FIRST:
- src/components/builder/ChatInterface.tsx (or main builder component)

TASK:
Implement a state machine for the correct flow:

```typescript
type BuilderPhase =
    | 'nlp_input'              // User typing prompt
    | 'intent_lock_generating' // Orchestrator Phase 0 running
    | 'intent_lock_review'     // User reviewing Deep Intent Contract
    | 'dependency_connection'  // User connecting services (orchestrator paused)
    | 'build_running'          // Orchestrator Phases 1-6 running
    | 'build_complete';        // Build finished

interface BuilderState {
    phase: BuilderPhase;
    prompt: string;
    orchestrationRunId?: string;
    intentContract?: DeepIntentContract;
    requiredCredentials: DetectedDependency[];
    connectedCredentials: Set<string>;
    buildProgress?: BuildProgress;
}
```

The frontend should:
1. Call /api/execute/orchestrator/start when user submits NLP
2. Show streaming thinking tokens during intent_lock_generating
3. Display human-readable plan from Deep Intent Contract
4. Show Dependency Connection UI when 'credentials_required' event received
5. Call /api/execute/orchestrator/resume when all credentials connected
6. Stream build progress during build_running
7. Show completed app in browser_demo phase

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 4.2: Create Intent Lock Review Component

```
TASK:
Create src/components/builder/phases/IntentLockPhase.tsx that displays the Deep Intent Contract in a human-readable format with:
- Project understanding section
- Core features list
- Technical approach
- Success criteria (functional checklist)
- Required integrations (from orchestrator's detection)
- Confirm/Modify/Start Over buttons

See original implementation plan for detailed code.

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 4.3: Create Dependency Connection Phase Component

```
TASK:
Create src/components/builder/phases/DependencyConnectionPhase.tsx that:
1. Receives requiredCredentials from orchestrator's 'credentials_required' event
2. Shows tiles for each required service
3. Tracks connection status via polling
4. Calls orchestrator.resume() when all required services connected
5. Prevents proceeding until all required connected

See original implementation plan for detailed code.

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 5: IMPLEMENTATION PLAN UI REDESIGN (3 Prompts)

### Prompt 5.1: Transform Deep Intent Contract to Human-Readable Plan

```
TASK:
Create a function that transforms DeepIntentContract (from orchestrator) into a human-readable ImplementationPlan structure:

```typescript
interface ImplementationPlan {
    id: string;
    projectName: string;
    summary: string;
    phases: Phase[];
}

interface Phase {
    id: string;
    number: number;
    name: string;
    description: string;
    tasks: Task[];
}

function transformContractToPlan(contract: DeepIntentContract): ImplementationPlan {
    // Map functionalChecklist to phases/tasks
    // Map technicalRequirements to implementation details
    // Map integrationRequirements to dependency tasks
}
```

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 5.2: Create Expandable Implementation Plan Component

```
TASK:
Create src/components/builder/phases/ImplementationPlanPhase.tsx with:
- Expandable phases (accordion style)
- Expandable tasks within phases
- Subtasks with checkboxes
- Affected files display
- Expand All / Collapse All buttons
- Approve / Request Changes / Regenerate buttons

See original implementation plan for detailed code.

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 5.3: Add Plan Modification Interface

```
TASK:
Create src/components/builder/PlanModificationModal.tsx that allows users to request changes without starting over:
- Add/Remove/Modify task options
- Text area for description
- Submit sends modification request to orchestrator
- Orchestrator adjusts plan and re-streams

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 6: LIQUID GLASS 3D PREMIUM STYLING (2 Prompts)

### Prompt 6.1: Create Liquid Glass 3D Design System

```
TASK:
Create src/styles/liquid-glass.ts with premium design tokens:
- Glass panel backgrounds with depth
- 3D shadow layers
- Premium button styles
- Input field glass effects
- Animation presets

See original implementation plan for detailed code.

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 6.2: Apply Liquid Glass Styling to Builder View

```
TASK:
Update all Builder View phases to use LiquidGlass components:
- IntentLockPhase
- ImplementationPlanPhase
- DependencyConnectionPhase
- BuildRunningPhase

Add 3D perspective effects and shimmer loading states.

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 7: STREAMING DISPLAY ENHANCEMENT (2 Prompts)

### Prompt 7.1: Create Unified Streaming Display Component

```
TASK:
Create src/components/builder/StreamingDisplay.tsx that:
1. Connects to the orchestrator SSE endpoint
2. Displays thinking tokens in real-time
3. Shows phase transitions with animations
4. Displays code being written
5. Shows verification results
6. Handles all 40+ orchestrator event types

See original implementation plan for detailed code.

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 7.2: Add Build Progress Dashboard

```
TASK:
Create src/components/builder/BuildProgressDashboard.tsx that shows:
1. Current phase (of 6)
2. Parallel agent activity
3. Files being modified
4. Verification swarm results
5. Error escalation level
6. Estimated completion

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 8: ENABLE DISABLED FEATURES (3 Prompts)

### Prompt 8.1: Wire Up Speculative Execution

```
READ FIRST:
- server/src/services/automation/build-loop.ts (lines 840-844)

PROBLEM:
Speculative execution variables exist but are never used:
- speculativeCache
- speculativeGenerationInProgress
- speculativeHitRate

TASK:
1. Implement speculative pre-generation during Phase 2
2. Cache likely next features while current ones build
3. Check cache before generating new code
4. Track hit rate metrics

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 8.2: Instantiate Browser-in-Loop

```
READ FIRST:
- server/src/services/automation/build-loop.ts (imports at top)
- server/src/services/verification/browser-in-loop.ts

PROBLEM:
BrowserInLoopService is imported but never instantiated in BuildLoopOrchestrator.

TASK:
1. Add browserInLoop property to BuildLoopOrchestrator
2. Initialize in constructor when enableBrowserInLoop is true
3. Call during Phase 2 for visual verification
4. Use for anti-slop pattern detection in DOM

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 8.3: Add VL-JEPA Integration (Optional)

```
READ FIRST:
- Comment at build-loop.ts line 416 mentioning VL-JEPA

TASK:
1. Create server/src/services/ai/vl-jepa-service.ts
2. Implement visual-semantic understanding for:
   - Screenshot analysis
   - UI component recognition
   - Layout understanding
3. Integrate with Verification Swarm

This is optional and can be deferred if not immediately needed.

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

---

## PHASE 9: INTEGRATION TESTING (2 Prompts)

### Prompt 9.1: Create Integration Tests for Full Flow

```
TASK:
Create server/src/tests/integration/builder-flow.test.ts that tests:
1. NLP → Orchestrator Start → Intent Lock generated (< 30s with proper tokens)
2. Credentials detected → Orchestrator pauses → Event emitted
3. Credentials provided → Orchestrator resumes
4. All 6 phases complete
5. App works in browser demo

See original implementation plan for detailed test code.

DO NOT modify any auth files. Follow all CLAUDE.md rules.
Run npm run build after implementation.
```

### Prompt 9.2: Create Flow Validation Checklist

```
TASK:
Create docs/testing/builder-view-checklist.md with manual testing checklist for:
1. Pre-requisites (env vars, database)
2. Each phase of the flow
3. Error handling scenarios
4. Performance benchmarks
5. Design validation

See original implementation plan for detailed checklist.
```

---

## EXECUTION ORDER (CRITICAL)

```
PHASE 0: ARCHITECTURAL FIX ← DO THIS FIRST!
├── 0.1: Replace /plan/stream with orchestrator
├── 0.2: Fix token configuration
└── 0.3: Wire events to frontend format

PHASE 1: DATABASE
├── 1.1: Migration script
└── 1.2: Health check endpoint

PHASE 2: NANGO
├── 2.1: Fix auth-url 404
└── 2.2: Configuration validation

PHASE 3: CREDENTIAL UX
├── 3.1: Fix missing input boxes
├── 3.2: Add cloud storage buttons
└── 3.3: Remove developer content

PHASE 4: FRONTEND FLOW
├── 4.1: State machine
├── 4.2: Intent Lock component
└── 4.3: Dependency Connection component

PHASE 5: PLAN UI
├── 5.1: Transform contract to plan
├── 5.2: Expandable plan component
└── 5.3: Modification interface

PHASE 6: STYLING
├── 6.1: Design system
└── 6.2: Apply styling

PHASE 7: STREAMING
├── 7.1: Streaming display
└── 7.2: Progress dashboard

PHASE 8: ENABLE FEATURES
├── 8.1: Speculative execution
├── 8.2: Browser-in-Loop
└── 8.3: VL-JEPA (optional)

PHASE 9: TESTING
├── 9.1: Integration tests
└── 9.2: Validation checklist
```

---

## SUCCESS CRITERIA

After implementing this plan:

1. ✅ NLP input → BuildLoopOrchestrator starts immediately
2. ✅ Phase 0 (Intent Lock) completes in < 30 seconds with 64K thinking
3. ✅ Deep Intent Contract shown as human-readable plan
4. ✅ Orchestrator pauses and emits 'credentials_required' event
5. ✅ Dependency Connection UI appears automatically
6. ✅ Build resumes after credentials connected
7. ✅ All 6 phases complete with streaming events
8. ✅ Verification Swarm runs continuously
9. ✅ Anti-Slop enforced at 85 threshold
10. ✅ Error Escalation works (4 levels, unlimited retries)
11. ✅ User sees working app in Browser Demo (Phase 6)
12. ✅ No placeholders, no mock data, no AI-slop
13. ✅ Production-ready app every time

---

## KEY INSIGHT

**The BuildLoopOrchestrator is 99% production ready. The problem is that we're not using it!**

The `/api/execute/plan/stream` endpoint bypasses all the amazing features:
- 64K thinking budget
- Credential pause/resume
- Verification Swarm
- Anti-Slop detection
- Error Escalation
- Gap Closers
- Browser Demo

By simply connecting the frontend to the orchestrator properly (Phase 0 of this plan), we unlock ALL of these features that are already implemented and working.
