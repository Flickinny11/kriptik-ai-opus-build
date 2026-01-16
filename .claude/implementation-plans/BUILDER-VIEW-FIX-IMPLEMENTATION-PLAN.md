# KripTik AI Builder View Fix Implementation Plan
## Structured Prompts for Opus 4.5 Production Deployment

**Created**: January 16, 2026
**Status**: Ready for Production Implementation
**Estimated Prompts**: 22 Structured Prompts in 9 Phases

---

## EXECUTIVE SUMMARY

This implementation plan addresses all critical issues in the Builder View:
1. **Database Issues**: Missing tables requiring migration
2. **Performance Issues**: 218,992ms plan generation due to token mismatch
3. **Nango Integration**: 404 errors and missing_public_key
4. **UX Flow Issues**: Incorrect order, missing credential inputs, developer-facing content exposed
5. **Implementation Plan UI**: Not human-readable, missing expand/collapse
6. **Design Issues**: Need liquid glass 3D premium styling
7. **BuildLoopOrchestrator Integration**: Plan/stream endpoint not using orchestrator

### Correct Flow Order (To Be Implemented):
```
1. NLP Input → Intent Lock (Sacred Contract with Opus 4.5)
2. Intent Lock Confirmed → Implementation Plan (Human-Readable, Expandable)
3. Plan Approved → Stack/Dependency Connection UI (Tiles with Connect/Credentials)
4. All Connected → Build Starts with Streaming Tokens
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

File structure to create:
server/src/db/migrations/0001_add_missing_tables.sql
server/src/db/migrate.ts (update existing)
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
    "projects": { "exists": true, "rowCount": number },
    ...
  },
  "migrationsRun": string[],
  "errors": string[]
}

Add a startup check in server/src/index.ts that calls this health check and fails fast if critical tables are missing.
```

---

## PHASE 2: PERFORMANCE FIX - TOKEN CONFIGURATION (3 Prompts)

### Prompt 2.1: Fix Extended Thinking Token Mismatch

```
You are fixing a critical performance issue in KripTik AI. The logs show:

"Thinking budget (16000) too close to max_tokens (2000). Disabling extended thinking."

This caused plan generation to take 218,992ms (3.6 minutes) because extended thinking was disabled.

Your task:
1. Read server/src/services/ai/claude-service.ts to understand the current token configuration
2. Read server/src/services/ai/unified-client.ts to see how thinking budget and max_tokens are passed
3. Fix the configuration so that:
   - thinking_budget is set to 64000 (as defined in CLAUDE.md for Intent Lock)
   - max_tokens is set appropriately higher than thinking_budget
   - The extended thinking is NEVER disabled for planning operations

Update the following files:
- server/src/services/ai/claude-service.ts
- server/src/services/ai/unified-client.ts
- server/src/routes/execute.ts (specifically the /plan/stream endpoint)

Correct configuration:
{
  model: 'claude-opus-4-5-20251101',
  max_tokens: 128000,
  thinking: {
    type: 'enabled',
    budget_tokens: 64000
  }
}

Add validation that throws an error if thinking_budget >= max_tokens to prevent this misconfiguration in the future.
```

### Prompt 2.2: Implement BuildLoopOrchestrator Integration for Plan/Stream

```
You are integrating the /api/execute/plan/stream endpoint with BuildLoopOrchestrator.

Current problem: The endpoint at server/src/routes/execute.ts line 2073 uses createClaudeService directly instead of BuildLoopOrchestrator. This bypasses:
- Intent Lock system
- Verification Swarm
- Anti-slop detection
- Proper phase management
- Budget management

Your task:
1. Read server/src/services/automation/build-loop.ts to understand BuildLoopOrchestrator
2. Modify /api/execute/plan/stream to:
   - Create a new BuildLoopOrchestrator instance for plan generation
   - Use Phase 0 (Intent Lock) to generate the plan with Sacred Contract
   - Stream the Intent Lock creation process to the client
   - Include thinking tokens in the stream
   - Properly handle the orchestrator lifecycle

Replace the current direct Claude service call:
```typescript
// OLD - DO NOT USE
const claude = createClaudeService({
    agentType: 'planning',
    systemPrompt: '...'
});
```

With BuildLoopOrchestrator:
```typescript
// NEW - CORRECT
const orchestrator = new BuildLoopOrchestrator({
    projectId: projectId,
    userId: userId,
    prompt: prompt,
    model: 'claude-opus-4-5-20251101',
    thinkingBudget: 64000,
    streamCallback: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
});

// Run only Intent Lock phase for plan generation
const intentLock = await orchestrator.runIntentLockPhase();
```

Ensure the SSE stream sends:
- Thinking tokens (prefixed with type: 'thinking')
- Text tokens (prefixed with type: 'text')
- Phase status updates
- Completion event with full Intent Lock
```

### Prompt 2.3: Add Vercel Timeout Handling

```
You are implementing proper timeout handling for Vercel serverless functions in KripTik AI.

Problem: Vercel has strict timeout limits:
- Hobby: 30 seconds
- Pro: 60 seconds
- Enterprise: 900 seconds

The plan generation can take longer than these limits.

Your task:
1. Create a chunked response system for long-running operations
2. Implement a job queue for plan generation that:
   - Starts the plan generation
   - Returns immediately with a job ID
   - Client polls for status/results
   - Results are cached in database

Create the following:

1. server/src/services/job-queue.ts:
```typescript
export interface PlanGenerationJob {
  id: string;
  userId: string;
  projectId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  result?: IntentLock;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  streamUrl?: string; // WebSocket URL for real-time updates
}
```

2. New endpoints in server/src/routes/execute.ts:
   - POST /api/execute/plan/start - Start job, return job ID
   - GET /api/execute/plan/status/:jobId - Get job status
   - GET /api/execute/plan/result/:jobId - Get completed result
   - GET /api/execute/plan/stream/:jobId - SSE stream for real-time updates

3. Add database table for job queue in schema.ts

This allows the frontend to handle timeouts gracefully by polling for results.
```

---

## PHASE 3: NANGO INTEGRATION FIX (2 Prompts)

### Prompt 3.1: Fix Nango Auth URL 404 Error

```
You are fixing the Nango integration 404 error in KripTik AI.

Error from logs:
- 404 on /api/nango/auth-url
- "missing_public_key" error

Root cause analysis:
1. The endpoint exists at server/src/routes/nango.ts line 323
2. The error occurs when NANGO_PUBLIC_KEY environment variable is not set
3. The route returns 503 when nangoService.isConfigured() returns false

Your task:
1. Read server/src/routes/nango.ts to understand the current implementation
2. Read server/src/services/integrations/nango-service.ts to see isConfigured() logic
3. Fix the error handling to return proper error messages:

Update nango.ts auth-url endpoint:
```typescript
router.get('/auth-url', async (req: Request, res: Response) => {
    // Check authentication first
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }

    // Check Nango configuration
    if (!nangoService.isConfigured()) {
        const missingKeys = [];
        if (!process.env.NANGO_PUBLIC_KEY) missingKeys.push('NANGO_PUBLIC_KEY');
        if (!process.env.NANGO_SECRET_KEY) missingKeys.push('NANGO_SECRET_KEY');

        return res.status(503).json({
            success: false,
            error: 'Nango integration not configured',
            code: 'NANGO_NOT_CONFIGURED',
            missingEnvironmentVariables: missingKeys,
            setupInstructions: 'Set NANGO_PUBLIC_KEY and NANGO_SECRET_KEY in your environment'
        });
    }

    // ... rest of implementation
});
```

4. Add a frontend-visible status indicator when Nango is not configured
5. Create a fallback to manual credential entry when OAuth is unavailable
```

### Prompt 3.2: Add Nango Configuration Validation

```
You are adding startup validation for Nango configuration in KripTik AI.

Your task:
1. Create server/src/services/integrations/nango-validator.ts:

```typescript
export interface NangoConfigStatus {
    configured: boolean;
    publicKey: boolean;
    secretKey: boolean;
    testConnection: boolean;
    supportedIntegrations: number;
    error?: string;
}

export async function validateNangoConfiguration(): Promise<NangoConfigStatus> {
    const status: NangoConfigStatus = {
        configured: false,
        publicKey: !!process.env.NANGO_PUBLIC_KEY,
        secretKey: !!process.env.NANGO_SECRET_KEY,
        testConnection: false,
        supportedIntegrations: 0
    };

    if (status.publicKey && status.secretKey) {
        try {
            // Test connection to Nango API
            const response = await fetch('https://api.nango.dev/config', {
                headers: {
                    'Authorization': `Bearer ${process.env.NANGO_SECRET_KEY}`
                }
            });
            status.testConnection = response.ok;
            status.configured = response.ok;

            if (response.ok) {
                const data = await response.json();
                status.supportedIntegrations = data.integrations?.length || 0;
            }
        } catch (error) {
            status.error = error.message;
        }
    }

    return status;
}
```

2. Call this validation on server startup in server/src/index.ts
3. Log clear warnings if Nango is not configured (don't fail, just warn)
4. Add endpoint GET /api/nango/config-status for frontend to check
```

---

## PHASE 4: CREDENTIAL INPUT UX FIX (3 Prompts)

### Prompt 4.1: Fix Missing Input Boxes After "Get API Key"

```
You are fixing the credential input UX in KripTik AI.

Problem: After clicking "Get API Key", no input boxes appear for users to enter credentials.

Current flow (broken):
1. User clicks tile
2. Modal opens
3. User clicks "Get API Key"
4. External page opens
5. User returns but sees no input field

Correct flow (to implement):
1. User clicks tile
2. Modal opens showing:
   - Integration name and icon
   - "Get API Key" button that opens platform URL in new tab
   - Input fields ALREADY VISIBLE below the button
   - Clear labels for each required credential
   - Placeholder text showing expected format
   - "Save Credentials" button (disabled until all required fields filled)

Your task:
1. Read src/components/credentials/CredentialAcquisitionModal.tsx
2. Modify the component to always show input fields:

```typescript
// Inside CredentialAcquisitionModal.tsx

const CredentialInputSection = ({ integration, fields, onSave }) => {
    const [values, setValues] = useState<Record<string, string>>({});
    const [isValid, setIsValid] = useState(false);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '20px'
        }}>
            {/* Platform Link - Always show */}
            <a
                href={integration.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    color: '#3b82f6',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: 500
                }}
            >
                <ExternalLinkGeometric size={16} />
                Open {integration.name} Dashboard to get credentials
            </a>

            {/* Input Fields - Always visible */}
            {fields.map(field => (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.7)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {field.label}
                        {field.required && <span style={{ color: '#dc2626' }}> *</span>}
                    </label>
                    <input
                        type={field.type || 'text'}
                        placeholder={field.placeholder}
                        value={values[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        style={{
                            padding: '12px 16px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '14px'
                        }}
                    />
                    {field.hint && (
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                            {field.hint}
                        </span>
                    )}
                </div>
            ))}

            {/* Save Button */}
            <button
                disabled={!isValid}
                onClick={() => onSave(values)}
                style={{
                    padding: '14px 24px',
                    background: isValid
                        ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                        : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isValid ? 'pointer' : 'not-allowed',
                    opacity: isValid ? 1 : 0.5
                }}
            >
                Save Credentials
            </button>
        </div>
    );
};
```

3. Ensure this pattern is used for ALL integrations, not just some
4. Add proper validation for each credential type
5. Show success state after credentials are saved
```

### Prompt 4.2: Add Connect Buttons to Cloud Storage Tiles

```
You are adding connect buttons to cloud storage tiles in KripTik AI.

Problem: Cloud storage tiles (S3, Google Cloud Storage, Cloudflare R2) are missing connect buttons.

Your task:
1. Read src/components/stack-selection/StackSelectionPanel.tsx
2. Ensure ALL tiles, including cloud storage, have proper connect UI:

For OAuth-supported services:
- Show "Connect with [Service]" button
- Use OAuthConnectButton component

For non-OAuth services (S3, GCS, R2):
- Show "Add Credentials" button
- Opens CredentialAcquisitionModal with appropriate fields

Update DependencyTile component:
```typescript
const DependencyTile = ({ dependency, onConnect, isConnected }) => {
    const handleClick = () => {
        if (isConnected) return; // Already connected

        // All tiles must trigger credential acquisition
        onConnect(dependency);
    };

    return (
        <motion.div
            onClick={handleClick}
            style={{
                // ... existing styles
                cursor: isConnected ? 'default' : 'pointer'
            }}
        >
            {/* ... existing content */}

            {/* Connect Button - ALWAYS show for unconnected */}
            {!isConnected && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: dependency.supportsOAuth
                        ? 'rgba(59, 130, 246, 0.2)'
                        : 'rgba(220, 38, 38, 0.2)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600
                }}>
                    {dependency.supportsOAuth ? (
                        <>
                            <LinkGeometric size={14} />
                            Connect
                        </>
                    ) : (
                        <>
                            <KeyGeometric size={14} />
                            Add Credentials
                        </>
                    )}
                </div>
            )}
        </motion.div>
    );
};
```

3. Add cloud storage integrations to INTEGRATION_CONFIGS in CredentialAcquisitionModal.tsx:
- AWS S3 (access key, secret key, region, bucket)
- Google Cloud Storage (project ID, service account JSON, bucket)
- Cloudflare R2 (account ID, access key, secret key, bucket)
- Azure Blob Storage (connection string, container)
```

### Prompt 4.3: Remove Developer-Facing Content from UI

```
You are removing developer-facing content from the user UI in KripTik AI.

Problem: Users see:
- npm commands they shouldn't have to run manually
- .env template that exposes internal implementation

Your task:
1. Search the codebase for any UI that displays npm commands or .env content
2. Remove or hide these from the user-facing UI
3. If the information is needed internally, move it to admin-only views

Specific fixes:

1. Find and update components that show npm commands:
   - If showing "npm install" - remove it, KripTik handles installation internally
   - If showing "npm run dev" - remove it, KripTik manages the dev server
   - If showing any CLI commands - either remove or convert to a "Copy Command" button for advanced users only

2. Find and update components that show .env templates:
   - Remove any raw .env file content from UI
   - Instead show a "Credentials Status" panel:
     - Green checkmark: "Stripe - Connected"
     - Yellow warning: "OpenAI - Not Connected"
   - Never show actual environment variable names to users

3. Update any "Save and Install" buttons to "Save Selections":
   - Installation happens automatically in the background
   - Users don't need to know about npm

Search patterns to find offending code:
- grep -r "npm install" src/
- grep -r "npm run" src/
- grep -r "\.env" src/components/
- grep -r "VITE_" src/components/ (except config files)
- grep -r "process.env" src/components/

For each instance:
- If it's user-facing UI: remove or hide behind admin flag
- If it's documentation: keep but move to /docs route
- If it's developer tools: hide behind developerMode flag
```

---

## PHASE 5: FLOW ORDER CORRECTION (3 Prompts)

### Prompt 5.1: Implement Correct Builder View Flow

```
You are restructuring the Builder View flow in KripTik AI.

Current flow (wrong):
1. User enters prompt
2. Stack detection runs
3. User connects services
4. Plan generates
5. Build starts

Correct flow (to implement):
1. User enters NLP prompt
2. Intent Lock generates (Sacred Contract with Opus 4.5)
3. User confirms Intent Lock
4. Implementation Plan displays (human-readable, expandable)
5. User approves Plan
6. Stack/Dependency Connection UI appears
7. User connects all required services
8. Build starts with streaming tokens

Your task:
1. Read src/components/builder/ChatInterface.tsx or equivalent main builder component
2. Implement a state machine for the flow:

```typescript
type BuilderPhase =
    | 'nlp_input'           // User typing prompt
    | 'intent_lock_generating' // AI generating Sacred Contract
    | 'intent_lock_review'   // User reviewing Intent Lock
    | 'plan_generating'      // AI generating implementation plan
    | 'plan_review'          // User reviewing/modifying plan
    | 'dependency_connection' // User connecting services
    | 'build_running'        // Build in progress
    | 'build_complete';      // Build finished

interface BuilderState {
    phase: BuilderPhase;
    prompt: string;
    intentLock?: IntentLock;
    implementationPlan?: ImplementationPlan;
    dependencies: DetectedDependency[];
    connectionStatuses: Map<string, boolean>;
    buildProgress?: BuildProgress;
}

const BuilderStateMachine = {
    transitions: {
        'nlp_input': ['intent_lock_generating'],
        'intent_lock_generating': ['intent_lock_review'],
        'intent_lock_review': ['plan_generating', 'nlp_input'], // Can go back
        'plan_generating': ['plan_review'],
        'plan_review': ['dependency_connection', 'plan_generating'], // Can regenerate
        'dependency_connection': ['build_running', 'plan_review'], // Can go back
        'build_running': ['build_complete'],
        'build_complete': ['nlp_input'] // Start new build
    }
};
```

3. Create UI components for each phase:
   - NLPInputPhase.tsx
   - IntentLockPhase.tsx
   - ImplementationPlanPhase.tsx
   - DependencyConnectionPhase.tsx
   - BuildRunningPhase.tsx

4. Ensure phase transitions are clear with animated transitions between phases
```

### Prompt 5.2: Create Intent Lock Review Component

```
You are creating the Intent Lock review component for KripTik AI.

The Intent Lock is a "Sacred Contract" between the user and AI that defines exactly what will be built.

Your task:
1. Create src/components/builder/phases/IntentLockPhase.tsx:

```typescript
interface IntentLockPhaseProps {
    intentLock: IntentLock;
    isGenerating: boolean;
    thinkingTokens?: string;
    onConfirm: () => void;
    onReject: () => void;
    onModify: (modifications: string) => void;
}

const IntentLockPhase: React.FC<IntentLockPhaseProps> = ({
    intentLock,
    isGenerating,
    thinkingTokens,
    onConfirm,
    onReject,
    onModify
}) => {
    return (
        <GlassPanel style={{ padding: '32px' }}>
            <h2 style={{
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <LockGeometric size={28} />
                Intent Lock - Sacred Contract
            </h2>

            {isGenerating ? (
                <div>
                    <StreamingThinkingDisplay tokens={thinkingTokens} />
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                        Claude Opus 4.5 is analyzing your requirements with 64K thinking tokens...
                    </p>
                </div>
            ) : (
                <>
                    {/* Project Understanding */}
                    <Section title="What I Understand">
                        <p>{intentLock.understanding}</p>
                    </Section>

                    {/* Core Features */}
                    <Section title="Core Features to Build">
                        <ul>
                            {intentLock.features.map(f => (
                                <li key={f.id}>{f.name}: {f.description}</li>
                            ))}
                        </ul>
                    </Section>

                    {/* Technical Approach */}
                    <Section title="Technical Approach">
                        <p>{intentLock.technicalApproach}</p>
                    </Section>

                    {/* Out of Scope */}
                    <Section title="Explicitly Out of Scope">
                        <ul>
                            {intentLock.outOfScope.map(item => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </Section>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                        <button onClick={onConfirm} className="primary-button">
                            Confirm Intent Lock
                        </button>
                        <button onClick={onModify} className="secondary-button">
                            Request Modifications
                        </button>
                        <button onClick={onReject} className="danger-button">
                            Start Over
                        </button>
                    </div>
                </>
            )}
        </GlassPanel>
    );
};
```

2. Add streaming support for thinking tokens during generation
3. Include clear visual hierarchy showing what will be built
4. Add modification flow where user can request changes without starting over
```

### Prompt 5.3: Create Dependency Connection Phase Component

```
You are creating the Dependency Connection phase component for KripTik AI.

This phase appears AFTER the implementation plan is approved, showing users which services need to be connected.

Your task:
1. Create src/components/builder/phases/DependencyConnectionPhase.tsx:

```typescript
interface DependencyConnectionPhaseProps {
    dependencies: DetectedDependency[];
    connectionStatuses: Map<string, ConnectionStatus>;
    onAllConnected: () => void;
    onBack: () => void;
}

const DependencyConnectionPhase: React.FC<DependencyConnectionPhaseProps> = ({
    dependencies,
    connectionStatuses,
    onAllConnected,
    onBack
}) => {
    const requiredDeps = dependencies.filter(d => d.priority === 'required');
    const optionalDeps = dependencies.filter(d => d.priority !== 'required');
    const allRequiredConnected = requiredDeps.every(d =>
        connectionStatuses.get(d.id)?.connected
    );

    return (
        <GlassPanel style={{ padding: '32px' }}>
            <h2 style={{
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '8px'
            }}>
                Connect Your Services
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
                Connect the services needed to build your project. Required services must be connected before building.
            </p>

            {/* Progress Indicator */}
            <ProgressBar
                connected={Array.from(connectionStatuses.values()).filter(s => s.connected).length}
                total={dependencies.length}
                required={requiredDeps.length}
            />

            {/* Required Services */}
            <Section title="Required Services" badge={`${connectedRequired}/${requiredDeps.length}`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {requiredDeps.map(dep => (
                        <ServiceTile
                            key={dep.id}
                            service={dep}
                            status={connectionStatuses.get(dep.id)}
                            onConnect={() => openCredentialModal(dep)}
                        />
                    ))}
                </div>
            </Section>

            {/* Optional Services */}
            {optionalDeps.length > 0 && (
                <Section title="Optional Services" collapsible defaultCollapsed>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {optionalDeps.map(dep => (
                            <ServiceTile
                                key={dep.id}
                                service={dep}
                                status={connectionStatuses.get(dep.id)}
                                onConnect={() => openCredentialModal(dep)}
                            />
                        ))}
                    </div>
                </Section>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                <button
                    onClick={onAllConnected}
                    disabled={!allRequiredConnected}
                    className="primary-button"
                    style={{ opacity: allRequiredConnected ? 1 : 0.5 }}
                >
                    {allRequiredConnected ? 'Start Build' : `Connect ${requiredDeps.length - connectedRequired} More Required`}
                </button>
                <button onClick={onBack} className="secondary-button">
                    Back to Plan
                </button>
            </div>
        </GlassPanel>
    );
};
```

2. Add real-time polling for connection status (every 5 seconds)
3. Show clear visual distinction between required and optional
4. Animate tiles when connection status changes
5. Prevent proceeding until all required services are connected
```

---

## PHASE 6: IMPLEMENTATION PLAN UI REDESIGN (3 Prompts)

### Prompt 6.1: Create Human-Readable Implementation Plan Structure

```
You are redesigning the Implementation Plan display in KripTik AI to be human-readable with proper hierarchy.

Current problem: Plans are shown as raw JSON or flat lists that users can't understand.

Your task:
1. Define the ImplementationPlan type structure:

```typescript
interface ImplementationPlan {
    id: string;
    projectName: string;
    summary: string; // 1-2 sentence overview
    estimatedComplexity: 'simple' | 'moderate' | 'complex';
    phases: Phase[];
}

interface Phase {
    id: string;
    number: number; // 1, 2, 3...
    name: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    tasks: Task[];
}

interface Task {
    id: string;
    number: string; // "1.1", "1.2", "2.1"
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    subtasks?: Subtask[];
    affectedFiles?: string[];
    dependencies?: string[]; // Task IDs this depends on
}

interface Subtask {
    id: string;
    number: string; // "1.1.1", "1.1.2"
    title: string;
    completed: boolean;
}
```

2. Create the plan generation prompt that produces this structure:

```typescript
const PLAN_GENERATION_PROMPT = `
You are generating an implementation plan for a software project.

Output a structured plan with:
- 2-5 phases (logical groupings of work)
- 2-8 tasks per phase
- 1-5 subtasks per task (optional)

Format each phase as:
## Phase {number}: {name}
{description}

### Task {phase}.{task}: {title}
{description}

Files affected:
- path/to/file.ts
- path/to/another.ts

Subtasks:
- [ ] {subtask description}
- [ ] {another subtask}

---

Be specific about file paths and code changes. Users should understand exactly what will be built.
`;
```

3. Update the backend to parse this into the structured format
```

### Prompt 6.2: Create Expandable Implementation Plan Component

```
You are creating an expandable, interactive Implementation Plan component for KripTik AI.

Your task:
1. Create src/components/builder/phases/ImplementationPlanPhase.tsx:

```typescript
interface ImplementationPlanPhaseProps {
    plan: ImplementationPlan;
    isGenerating: boolean;
    streamingContent?: string;
    onApprove: () => void;
    onModify: (modifications: string) => void;
    onRegenerate: () => void;
}

const ImplementationPlanPhase: React.FC<ImplementationPlanPhaseProps> = ({
    plan,
    isGenerating,
    streamingContent,
    onApprove,
    onModify,
    onRegenerate
}) => {
    const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['phase-1']));
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

    const togglePhase = (phaseId: string) => {
        setExpandedPhases(prev => {
            const next = new Set(prev);
            if (next.has(phaseId)) next.delete(phaseId);
            else next.add(phaseId);
            return next;
        });
    };

    const toggleTask = (taskId: string) => {
        setExpandedTasks(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    return (
        <GlassPanel style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700 }}>
                    Implementation Plan
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setExpandedPhases(new Set(plan.phases.map(p => p.id)))}>
                        Expand All
                    </button>
                    <button onClick={() => setExpandedPhases(new Set())}>
                        Collapse All
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div style={{
                padding: '16px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '8px',
                marginBottom: '24px'
            }}>
                <p style={{ fontSize: '16px', lineHeight: 1.6 }}>{plan.summary}</p>
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                    Complexity: {plan.estimatedComplexity} | {plan.phases.length} phases | {totalTasks} tasks
                </div>
            </div>

            {/* Phases */}
            {plan.phases.map(phase => (
                <PhaseAccordion
                    key={phase.id}
                    phase={phase}
                    isExpanded={expandedPhases.has(phase.id)}
                    onToggle={() => togglePhase(phase.id)}
                    expandedTasks={expandedTasks}
                    onToggleTask={toggleTask}
                />
            ))}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                <button onClick={onApprove} className="primary-button">
                    Approve Plan & Continue
                </button>
                <button onClick={onModify} className="secondary-button">
                    Request Changes
                </button>
                <button onClick={onRegenerate} className="tertiary-button">
                    Regenerate Plan
                </button>
            </div>
        </GlassPanel>
    );
};
```

2. Create PhaseAccordion component:
```typescript
const PhaseAccordion = ({ phase, isExpanded, onToggle, expandedTasks, onToggleTask }) => (
    <motion.div
        style={{
            marginBottom: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            overflow: 'hidden'
        }}
    >
        {/* Phase Header - Clickable */}
        <div
            onClick={onToggle}
            style={{
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}
        >
            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
                <ChevronRightGeometric size={16} />
            </motion.div>
            <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#3b82f6',
                background: 'rgba(59,130,246,0.2)',
                padding: '4px 8px',
                borderRadius: '4px'
            }}>
                PHASE {phase.number}
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600 }}>
                {phase.name}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                {phase.tasks.length} tasks
            </span>
        </div>

        {/* Phase Content - Collapsible */}
        <AnimatePresence>
            {isExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ padding: '0 20px 16px' }}
                >
                    <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
                        {phase.description}
                    </p>
                    {phase.tasks.map(task => (
                        <TaskAccordion
                            key={task.id}
                            task={task}
                            isExpanded={expandedTasks.has(task.id)}
                            onToggle={() => onToggleTask(task.id)}
                        />
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    </motion.div>
);
```

3. Create TaskAccordion component with subtasks
4. Add file path highlighting
5. Add status indicators (pending/in_progress/completed)
```

### Prompt 6.3: Add Plan Modification Interface

```
You are adding a plan modification interface to KripTik AI.

Users should be able to request changes to the implementation plan without starting over.

Your task:
1. Create src/components/builder/PlanModificationModal.tsx:

```typescript
interface PlanModificationModalProps {
    currentPlan: ImplementationPlan;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (modifications: PlanModification) => void;
}

interface PlanModification {
    type: 'add_task' | 'remove_task' | 'modify_task' | 'reorder' | 'general';
    targetPhaseId?: string;
    targetTaskId?: string;
    description: string;
}

const PlanModificationModal: React.FC<PlanModificationModalProps> = ({
    currentPlan,
    isOpen,
    onClose,
    onSubmit
}) => {
    const [modificationType, setModificationType] = useState<PlanModification['type']>('general');
    const [selectedPhase, setSelectedPhase] = useState<string>('');
    const [selectedTask, setSelectedTask] = useState<string>('');
    const [description, setDescription] = useState('');

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <GlassPanel style={{ padding: '32px', maxWidth: '600px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>
                    Request Plan Changes
                </h3>

                {/* Modification Type Selection */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                        What would you like to change?
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {[
                            { value: 'add_task', label: 'Add a Task' },
                            { value: 'remove_task', label: 'Remove a Task' },
                            { value: 'modify_task', label: 'Modify a Task' },
                            { value: 'reorder', label: 'Reorder Tasks' },
                            { value: 'general', label: 'General Feedback' }
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setModificationType(opt.value)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: modificationType === opt.value
                                        ? '2px solid #3b82f6'
                                        : '1px solid rgba(255,255,255,0.1)',
                                    background: modificationType === opt.value
                                        ? 'rgba(59,130,246,0.2)'
                                        : 'transparent'
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Phase/Task Selection (for targeted modifications) */}
                {['add_task', 'remove_task', 'modify_task'].includes(modificationType) && (
                    <>
                        <div style={{ marginBottom: '16px' }}>
                            <label>Select Phase</label>
                            <select
                                value={selectedPhase}
                                onChange={(e) => setSelectedPhase(e.target.value)}
                            >
                                <option value="">Choose a phase...</option>
                                {currentPlan.phases.map(p => (
                                    <option key={p.id} value={p.id}>
                                        Phase {p.number}: {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {['remove_task', 'modify_task'].includes(modificationType) && selectedPhase && (
                            <div style={{ marginBottom: '16px' }}>
                                <label>Select Task</label>
                                <select
                                    value={selectedTask}
                                    onChange={(e) => setSelectedTask(e.target.value)}
                                >
                                    <option value="">Choose a task...</option>
                                    {currentPlan.phases
                                        .find(p => p.id === selectedPhase)
                                        ?.tasks.map(t => (
                                            <option key={t.id} value={t.id}>
                                                Task {t.number}: {t.title}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        )}
                    </>
                )}

                {/* Description Input */}
                <div style={{ marginBottom: '24px' }}>
                    <label>Describe your requested change</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={getPlaceholder(modificationType)}
                        rows={4}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: 'white',
                            resize: 'vertical'
                        }}
                    />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} className="secondary-button">Cancel</button>
                    <button
                        onClick={() => onSubmit({
                            type: modificationType,
                            targetPhaseId: selectedPhase || undefined,
                            targetTaskId: selectedTask || undefined,
                            description
                        })}
                        className="primary-button"
                        disabled={!description.trim()}
                    >
                        Submit Changes
                    </button>
                </div>
            </GlassPanel>
        </Modal>
    );
};
```

2. Add backend endpoint to process modifications and update plan
3. Show diff between old and new plan after modifications
4. Allow users to accept or reject the modified plan
```

---

## PHASE 7: LIQUID GLASS 3D PREMIUM STYLING (2 Prompts)

### Prompt 7.1: Create Liquid Glass 3D Design System

```
You are implementing a premium "Liquid Glass 3D" design system for KripTik AI.

Your task:
1. Create src/styles/liquid-glass.ts with the design tokens:

```typescript
export const liquidGlass = {
    // Primary Glass Panel
    panel: {
        background: `
            linear-gradient(
                145deg,
                rgba(15, 15, 20, 0.95) 0%,
                rgba(8, 8, 12, 0.98) 50%,
                rgba(15, 15, 20, 0.95) 100%
            )
        `,
        backdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        boxShadow: `
            0 4px 30px rgba(0, 0, 0, 0.3),
            0 8px 60px rgba(0, 0, 0, 0.2),
            inset 0 1px 1px rgba(255, 255, 255, 0.05),
            inset 0 -1px 1px rgba(0, 0, 0, 0.2)
        `
    },

    // Elevated Glass Card
    card: {
        background: `
            linear-gradient(
                135deg,
                rgba(25, 25, 35, 0.8) 0%,
                rgba(15, 15, 22, 0.9) 100%
            )
        `,
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        boxShadow: `
            0 2px 20px rgba(0, 0, 0, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.04)
        `
    },

    // Interactive Button
    button: {
        primary: {
            background: `
                linear-gradient(
                    135deg,
                    #dc2626 0%,
                    #b91c1c 50%,
                    #991b1b 100%
                )
            `,
            boxShadow: `
                0 4px 20px rgba(220, 38, 38, 0.4),
                0 2px 8px rgba(0, 0, 0, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.2)
            `,
            hover: {
                transform: 'translateY(-2px)',
                boxShadow: `
                    0 8px 30px rgba(220, 38, 38, 0.5),
                    0 4px 12px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.25)
                `
            }
        },
        secondary: {
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            hover: {
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)'
            }
        }
    },

    // 3D Depth Layers
    depth: {
        level1: 'translateZ(0px)',
        level2: 'translateZ(10px)',
        level3: 'translateZ(20px)',
        perspective: '1000px'
    },

    // Glass Input
    input: {
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
        focus: {
            border: '1px solid rgba(59, 130, 246, 0.5)',
            boxShadow: `
                inset 0 2px 4px rgba(0, 0, 0, 0.2),
                0 0 20px rgba(59, 130, 246, 0.15)
            `
        }
    },

    // Accent Colors
    accents: {
        primary: '#dc2626',
        success: '#22c55e',
        warning: '#f59e0b',
        info: '#3b82f6',
        error: '#ef4444'
    },

    // Text Hierarchy
    text: {
        heading: {
            color: 'rgba(255, 255, 255, 0.95)',
            fontWeight: 700,
            letterSpacing: '-0.02em'
        },
        body: {
            color: 'rgba(255, 255, 255, 0.8)',
            fontWeight: 400,
            lineHeight: 1.6
        },
        muted: {
            color: 'rgba(255, 255, 255, 0.5)',
            fontWeight: 400
        },
        label: {
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
        }
    },

    // Animation Presets
    animations: {
        glassReveal: {
            initial: { opacity: 0, y: 20, scale: 0.95 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: -10, scale: 0.98 },
            transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
        },
        hover3D: {
            whileHover: {
                y: -4,
                scale: 1.02,
                boxShadow: '0 12px 40px rgba(0,0,0,0.3)'
            },
            whileTap: { scale: 0.98 }
        },
        shimmer: {
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite linear',
            keyframes: `
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `
        }
    }
};
```

2. Create reusable components in src/components/ui/glass/:
   - LiquidGlassPanel.tsx
   - LiquidGlassCard.tsx
   - LiquidGlassButton.tsx
   - LiquidGlassInput.tsx
```

### Prompt 7.2: Apply Liquid Glass Styling to Builder View

```
You are applying the Liquid Glass 3D design system to the Builder View in KripTik AI.

Your task:
1. Update all Builder View phases to use LiquidGlass components
2. Add 3D perspective effects to phase transitions
3. Implement the shimmer loading effect for generating states
4. Add depth layers for visual hierarchy

Update these components:
1. IntentLockPhase.tsx - Use LiquidGlassPanel with depth level 3
2. ImplementationPlanPhase.tsx - Use LiquidGlassCard for phase accordions
3. DependencyConnectionPhase.tsx - Use LiquidGlassCard for service tiles
4. BuildRunningPhase.tsx - Use shimmer effect for progress indicators

Example update for IntentLockPhase:
```typescript
import { motion } from 'framer-motion';
import { liquidGlass } from '@/styles/liquid-glass';
import { LiquidGlassPanel } from '@/components/ui/glass/LiquidGlassPanel';

const IntentLockPhase = ({ intentLock, isGenerating }) => {
    return (
        <motion.div
            style={{ perspective: liquidGlass.depth.perspective }}
            {...liquidGlass.animations.glassReveal}
        >
            <LiquidGlassPanel
                depth={3}
                style={{
                    transform: liquidGlass.depth.level3,
                    transformStyle: 'preserve-3d'
                }}
            >
                {isGenerating ? (
                    <motion.div
                        style={{
                            background: `linear-gradient(
                                90deg,
                                rgba(255,255,255,0) 0%,
                                rgba(255,255,255,0.05) 50%,
                                rgba(255,255,255,0) 100%
                            )`,
                            ...liquidGlass.animations.shimmer
                        }}
                    >
                        <StreamingThinkingDisplay />
                    </motion.div>
                ) : (
                    <IntentLockContent intentLock={intentLock} />
                )}
            </LiquidGlassPanel>
        </motion.div>
    );
};
```

Add 3D card flip animation for phase transitions:
```typescript
const PhaseTransition = ({ children, phase }) => (
    <motion.div
        key={phase}
        initial={{
            rotateY: 90,
            opacity: 0,
            transformPerspective: 1200
        }}
        animate={{
            rotateY: 0,
            opacity: 1
        }}
        exit={{
            rotateY: -90,
            opacity: 0
        }}
        transition={{
            duration: 0.6,
            ease: [0.25, 0.1, 0.25, 1]
        }}
        style={{ transformStyle: 'preserve-3d' }}
    >
        {children}
    </motion.div>
);
```
```

---

## PHASE 8: STREAMING TOKEN IMPLEMENTATION (2 Prompts)

### Prompt 8.1: Implement Proper SSE Token Streaming

```
You are implementing proper Server-Sent Events (SSE) token streaming for KripTik AI.

Current problem: The streaming is slow and doesn't show thinking tokens properly.

Your task:
1. Update server/src/routes/execute.ts /plan/stream endpoint:

```typescript
router.post('/plan/stream', async (req: Request, res: Response) => {
    const { prompt, projectId } = req.body;
    const userId = req.user!.id;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 10000);

    try {
        // Create Anthropic client with streaming
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });

        // Start streaming request
        const stream = await anthropic.messages.stream({
            model: 'claude-opus-4-5-20251101',
            max_tokens: 128000,
            thinking: {
                type: 'enabled',
                budget_tokens: 64000
            },
            messages: [{
                role: 'user',
                content: prompt
            }],
            system: INTENT_LOCK_SYSTEM_PROMPT
        });

        // Process stream events
        for await (const event of stream) {
            if (event.type === 'content_block_start') {
                if (event.content_block.type === 'thinking') {
                    res.write(`data: ${JSON.stringify({
                        type: 'thinking_start',
                        index: event.index
                    })}\n\n`);
                } else if (event.content_block.type === 'text') {
                    res.write(`data: ${JSON.stringify({
                        type: 'text_start',
                        index: event.index
                    })}\n\n`);
                }
            }

            if (event.type === 'content_block_delta') {
                if (event.delta.type === 'thinking_delta') {
                    res.write(`data: ${JSON.stringify({
                        type: 'thinking',
                        content: event.delta.thinking
                    })}\n\n`);
                } else if (event.delta.type === 'text_delta') {
                    res.write(`data: ${JSON.stringify({
                        type: 'text',
                        content: event.delta.text
                    })}\n\n`);
                }
            }

            if (event.type === 'message_stop') {
                res.write(`data: ${JSON.stringify({
                    type: 'complete',
                    usage: stream.usage
                })}\n\n`);
            }
        }

    } catch (error) {
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message
        })}\n\n`);
    } finally {
        clearInterval(heartbeat);
        res.write('data: [DONE]\n\n');
        res.end();
    }
});
```

2. Ensure response is flushed immediately after each write
3. Add proper error handling for disconnections
4. Add request timeout handling (max 15 minutes)
```

### Prompt 8.2: Create Frontend Streaming Display Component

```
You are creating the frontend streaming display component for KripTik AI.

Your task:
1. Create src/components/builder/StreamingDisplay.tsx:

```typescript
interface StreamingDisplayProps {
    endpoint: string;
    payload: any;
    onComplete: (result: any) => void;
    onError: (error: string) => void;
    showThinking?: boolean;
}

const StreamingDisplay: React.FC<StreamingDisplayProps> = ({
    endpoint,
    payload,
    onComplete,
    onError,
    showThinking = true
}) => {
    const [thinkingContent, setThinkingContent] = useState('');
    const [textContent, setTextContent] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [phase, setPhase] = useState<'connecting' | 'thinking' | 'generating' | 'complete'>('connecting');

    useEffect(() => {
        const controller = new AbortController();

        const startStream = async () => {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAuthToken()}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const reader = response.body!.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                setPhase('complete');
                                continue;
                            }

                            try {
                                const event = JSON.parse(data);
                                handleEvent(event);
                            } catch (e) {
                                // Skip malformed JSON
                            }
                        }
                    }
                }

            } catch (error) {
                if (error.name !== 'AbortError') {
                    onError(error.message);
                }
            }
        };

        const handleEvent = (event: any) => {
            switch (event.type) {
                case 'thinking_start':
                    setIsThinking(true);
                    setPhase('thinking');
                    break;
                case 'thinking':
                    setThinkingContent(prev => prev + event.content);
                    break;
                case 'text_start':
                    setIsThinking(false);
                    setPhase('generating');
                    break;
                case 'text':
                    setTextContent(prev => prev + event.content);
                    break;
                case 'complete':
                    setPhase('complete');
                    onComplete({ thinking: thinkingContent, text: textContent });
                    break;
                case 'error':
                    onError(event.error);
                    break;
            }
        };

        startStream();

        return () => controller.abort();
    }, [endpoint, payload]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Phase Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <motion.div
                    animate={{ rotate: phase !== 'complete' ? 360 : 0 }}
                    transition={{ repeat: phase !== 'complete' ? Infinity : 0, duration: 1 }}
                >
                    <BrainGeometric size={20} />
                </motion.div>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                    {phase === 'connecting' && 'Connecting to Claude Opus 4.5...'}
                    {phase === 'thinking' && 'Claude is thinking deeply (64K tokens)...'}
                    {phase === 'generating' && 'Generating response...'}
                    {phase === 'complete' && 'Complete'}
                </span>
            </div>

            {/* Thinking Display (collapsible) */}
            {showThinking && thinkingContent && (
                <Collapsible title="Thinking Process" defaultOpen={isThinking}>
                    <div style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.6)',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        padding: '12px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px'
                    }}>
                        {thinkingContent}
                    </div>
                </Collapsible>
            )}

            {/* Main Content Display */}
            <div style={{
                padding: '20px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px',
                minHeight: '100px'
            }}>
                <ReactMarkdown>{textContent || 'Waiting for response...'}</ReactMarkdown>
            </div>
        </div>
    );
};
```

2. Add auto-scroll behavior
3. Add copy button for generated content
4. Add token usage display
```

---

## PHASE 9: INTEGRATION TESTING & VALIDATION (2 Prompts)

### Prompt 9.1: Create Integration Tests for Builder View Flow

```
You are creating integration tests for the Builder View flow in KripTik AI.

Your task:
1. Create server/src/tests/integration/builder-flow.test.ts:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '../helpers/test-app';
import { createTestUser, createTestProject } from '../helpers/test-data';

describe('Builder View Flow Integration Tests', () => {
    let app: any;
    let authToken: string;
    let userId: string;
    let projectId: string;

    beforeAll(async () => {
        app = await createTestApp();
        const user = await createTestUser(app);
        authToken = user.token;
        userId = user.id;
        const project = await createTestProject(app, userId);
        projectId = project.id;
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Phase 1: Intent Lock Generation', () => {
        it('should generate Intent Lock with extended thinking enabled', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/execute/plan/stream',
                headers: { Authorization: `Bearer ${authToken}` },
                payload: {
                    prompt: 'Build a simple todo app',
                    projectId
                }
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toContain('text/event-stream');

            // Parse SSE events
            const events = parseSSEEvents(response.body);

            // Should have thinking events
            const thinkingEvents = events.filter(e => e.type === 'thinking');
            expect(thinkingEvents.length).toBeGreaterThan(0);

            // Should complete successfully
            const completeEvent = events.find(e => e.type === 'complete');
            expect(completeEvent).toBeDefined();
        });

        it('should use 64K thinking budget', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/execute/plan/stream',
                headers: { Authorization: `Bearer ${authToken}` },
                payload: { prompt: 'Build a complex e-commerce platform', projectId }
            });

            const events = parseSSEEvents(response.body);
            const completeEvent = events.find(e => e.type === 'complete');

            // Verify thinking was not disabled
            expect(completeEvent.usage).toBeDefined();
            // Thinking tokens should be substantial (not disabled)
            expect(completeEvent.usage.thinking_tokens || 0).toBeGreaterThan(1000);
        });
    });

    describe('Phase 2: Dependency Detection', () => {
        it('should detect required dependencies from prompt', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/dependencies/analyze',
                headers: { Authorization: `Bearer ${authToken}` },
                payload: {
                    prompt: 'Build a Stripe payment integration with Supabase database'
                }
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);

            expect(data.dependencies).toContainEqual(
                expect.objectContaining({ id: 'stripe', priority: 'required' })
            );
            expect(data.dependencies).toContainEqual(
                expect.objectContaining({ id: 'supabase', priority: 'required' })
            );
        });
    });

    describe('Phase 3: Nango Integration', () => {
        it('should return proper error when Nango not configured', async () => {
            // Temporarily unset Nango keys
            const originalPublicKey = process.env.NANGO_PUBLIC_KEY;
            process.env.NANGO_PUBLIC_KEY = '';

            const response = await app.inject({
                method: 'GET',
                url: '/api/nango/auth-url?integrationId=stripe',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            expect(response.statusCode).toBe(503);
            const data = JSON.parse(response.body);
            expect(data.code).toBe('NANGO_NOT_CONFIGURED');
            expect(data.missingEnvironmentVariables).toContain('NANGO_PUBLIC_KEY');

            // Restore
            process.env.NANGO_PUBLIC_KEY = originalPublicKey;
        });
    });

    describe('Database Health', () => {
        it('should have all required tables', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/health/database'
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);

            expect(data.tables.credit_pool.exists).toBe(true);
            expect(data.tables.learning_context_priorities.exists).toBe(true);
        });
    });
});

function parseSSEEvents(body: string): any[] {
    return body
        .split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => {
            const data = line.slice(6);
            if (data === '[DONE]') return { type: 'done' };
            try {
                return JSON.parse(data);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}
```

2. Add test for full flow from prompt to build start
3. Add test for credential persistence
4. Add test for plan modification flow
```

### Prompt 9.2: Create Flow Validation Checklist

```
You are creating a validation checklist for the Builder View flow in KripTik AI.

Your task:
1. Create a manual testing checklist at docs/testing/builder-view-checklist.md:

```markdown
# Builder View Flow Validation Checklist

## Pre-Requisites
- [ ] Database migrations have run successfully
- [ ] All required environment variables are set
- [ ] Anthropic API has sufficient credits
- [ ] Nango is configured (or graceful fallback works)

## Phase 1: NLP Input
- [ ] User can enter natural language prompt
- [ ] Placeholder text guides user on what to type
- [ ] Submit button is disabled until text is entered
- [ ] Character count or limit indicator visible

## Phase 2: Intent Lock Generation
- [ ] Streaming begins within 3 seconds of submission
- [ ] "Claude is thinking" indicator appears
- [ ] Thinking tokens stream in real-time (if enabled)
- [ ] Text generation streams smoothly
- [ ] No timeout errors for complex prompts
- [ ] Total generation time < 60 seconds for simple prompts

## Phase 3: Intent Lock Review
- [ ] Clear display of what AI understood
- [ ] Features list is readable
- [ ] Technical approach is explained
- [ ] Out of scope items are listed
- [ ] "Confirm" button is prominent
- [ ] "Request Modifications" button available
- [ ] "Start Over" option available

## Phase 4: Implementation Plan
- [ ] Plan shows in human-readable format
- [ ] Phases are clearly numbered (1, 2, 3...)
- [ ] Tasks are indented under phases
- [ ] Subtasks are indented under tasks
- [ ] Expand/collapse works for all levels
- [ ] "Expand All" / "Collapse All" buttons work
- [ ] Affected files are listed for each task
- [ ] "Approve Plan" button is visible
- [ ] "Request Changes" opens modification modal
- [ ] "Regenerate Plan" starts new generation

## Phase 5: Plan Modification (if used)
- [ ] Modification modal opens correctly
- [ ] Can select modification type
- [ ] Can select specific phase/task
- [ ] Description textarea works
- [ ] Submit processes modification
- [ ] Plan updates with changes
- [ ] Diff/changes highlighted

## Phase 6: Dependency Connection
- [ ] Required services shown prominently
- [ ] Optional services in collapsible section
- [ ] Each tile shows service icon
- [ ] "Connect" button visible for unconnected
- [ ] Connected services show green checkmark
- [ ] Progress bar shows X/Y connected
- [ ] "Start Build" disabled until required connected

## Phase 7: Credential Input (for each service)
- [ ] Modal opens when tile clicked
- [ ] Service name and icon displayed
- [ ] "Get API Key" link opens correct URL in new tab
- [ ] Input fields are ALWAYS visible (not hidden)
- [ ] Labels are clear
- [ ] Placeholder text shows expected format
- [ ] Required fields marked with asterisk
- [ ] "Save Credentials" validates input
- [ ] Success state shown after save
- [ ] Modal closes and tile updates

## Phase 8: Build Execution
- [ ] Build starts automatically after all connected
- [ ] Or "Start Build" button triggers it
- [ ] Streaming log appears
- [ ] Phase indicators show progress
- [ ] File generation visible
- [ ] No npm commands shown to user
- [ ] No .env templates shown to user
- [ ] Errors are handled gracefully
- [ ] Build completes successfully

## Design Validation
- [ ] Liquid glass styling applied
- [ ] 3D depth effects visible
- [ ] Animations are smooth (60fps)
- [ ] Dark theme consistent
- [ ] No emojis anywhere
- [ ] Custom geometric icons used
- [ ] Typography hierarchy correct
- [ ] Responsive on different screen sizes

## Error Handling
- [ ] Network errors show user-friendly message
- [ ] API credit exhaustion shows clear instruction
- [ ] Nango not configured shows fallback to manual entry
- [ ] Timeout errors offer retry option
- [ ] Invalid credentials show specific error

## Performance
- [ ] Intent Lock generation < 60s (simple prompts)
- [ ] Plan generation < 30s
- [ ] Dependency detection < 5s
- [ ] Credential validation < 3s
- [ ] No UI freezing during streaming
- [ ] Memory usage stable over time
```

2. Create automated smoke test that runs through happy path
3. Create performance benchmarks for each phase
```

---

## EXECUTION ORDER

1. **Phase 1**: Database Migration Fix (critical - blocks everything)
2. **Phase 2**: Performance Fix - Token Configuration (critical - causes 3+ min delays)
3. **Phase 3**: Nango Integration Fix (important - blocks OAuth)
4. **Phase 4**: Credential Input UX Fix (important - UX broken)
5. **Phase 5**: Flow Order Correction (important - wrong sequence)
6. **Phase 6**: Implementation Plan UI Redesign (enhancement)
7. **Phase 7**: Liquid Glass 3D Styling (enhancement)
8. **Phase 8**: Streaming Token Implementation (enhancement)
9. **Phase 9**: Integration Testing & Validation (quality assurance)

---

## CRITICAL NOTES

1. **DO NOT** disable extended thinking - it's required for quality Intent Locks
2. **DO NOT** show npm commands or .env templates to users
3. **DO NOT** allow build to start before all required services are connected
4. **DO NOT** use emojis - use custom geometric SVG icons only
5. **ALWAYS** use Opus 4.5 (claude-opus-4-5-20251101) for Intent Lock generation
6. **ALWAYS** use 64K thinking budget for Intent Lock
7. **ALWAYS** stream tokens in real-time
8. **ALWAYS** follow the correct phase order: NLP → Intent Lock → Plan → Dependencies → Build

---

## FILES TO MODIFY

### Server-Side
- server/src/routes/execute.ts (plan/stream endpoint)
- server/src/routes/nango.ts (auth-url error handling)
- server/src/services/ai/claude-service.ts (token configuration)
- server/src/services/ai/unified-client.ts (thinking budget)
- server/src/db/migrations/0001_add_missing_tables.sql (NEW)
- server/src/db/migrate.ts (migration runner)
- server/src/index.ts (startup checks)
- server/src/services/integrations/nango-validator.ts (NEW)
- server/src/services/job-queue.ts (NEW)

### Client-Side
- src/components/builder/ChatInterface.tsx (flow state machine)
- src/components/builder/phases/IntentLockPhase.tsx (NEW)
- src/components/builder/phases/ImplementationPlanPhase.tsx (NEW)
- src/components/builder/phases/DependencyConnectionPhase.tsx (NEW)
- src/components/builder/PlanModificationModal.tsx (NEW)
- src/components/builder/StreamingDisplay.tsx (NEW)
- src/components/credentials/CredentialAcquisitionModal.tsx (input visibility)
- src/components/stack-selection/StackSelectionPanel.tsx (connect buttons)
- src/styles/liquid-glass.ts (NEW)
- src/components/ui/glass/*.tsx (NEW)

---

## SUCCESS CRITERIA

1. ✅ Database health check passes on startup
2. ✅ Plan generation completes in < 60 seconds with thinking enabled
3. ✅ Nango errors show clear, actionable messages
4. ✅ Credential input fields are always visible
5. ✅ Flow follows correct order: NLP → Intent → Plan → Dependencies → Build
6. ✅ No npm commands or .env templates visible to users
7. ✅ Implementation plan is human-readable with expand/collapse
8. ✅ Liquid glass 3D styling applied throughout
9. ✅ All integration tests pass
10. ✅ Manual checklist validation complete
