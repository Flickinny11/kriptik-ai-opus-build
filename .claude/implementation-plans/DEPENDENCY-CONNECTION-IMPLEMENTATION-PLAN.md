# Dependency Connection & Plan Modification Implementation Plan

**Version:** 1.0
**Created:** 2026-01-16
**Status:** Ready for Implementation

## Overview

This plan addresses the critical gaps identified in the builder view flow:
1. Modifiable implementation plan with per-task NLP editing
2. Dependency connection UI with Nango OAuth + credential input tiles
3. Auto webhook/endpoint creation wired into build loop
4. HuggingFace/RunPod automation with resource approval and metered billing

## Mandatory Requirements

- No placeholders in any implementation
- No mock data in any implementation
- No TODOs in any implementation
- No emojis anywhere
- No Lucide React icons
- Use simple-icons for branded dependency logos
- Custom 3D animated icons for all other icons
- All implementations must be production-ready
- Build must compile without errors after each phase
- Auth must remain intact throughout

## Style Requirements

All UI components must implement:
- Premium translucent photorealistic liquid glass aesthetic
- 3D textured surfaces with layered shadows
- Warm photorealistic glow effects
- High frame rate smooth animations (60fps minimum)
- 3D perspective with visible edges and depth
- Fast and responsive interactions (< 100ms feedback)
- Intuitive flow that operates in correct order

---

## PHASE 1: Modifiable Implementation Plan UI (4 Prompts)

### Prompt 1.1: Plan Modification State Management

Create the state management and types for plan modification in the frontend.

**File:** `src/stores/plan-modification-store.ts`

**Requirements:**
1. Create Zustand store for plan modification state
2. Track which phases have modifications
3. Track individual task modifications with NLP inputs
4. Store modification history for undo capability
5. Handle "Reconfigure Plan" action that sends all modifications to backend
6. Handle plan lock state after approval

**Types to implement:**
```typescript
interface PlanModification {
  phaseId: string;
  taskId: string;
  originalTask: string;
  modificationNlp: string;
  timestamp: number;
}

interface PlanModificationStore {
  modifications: Map<string, PlanModification>;
  isReconfiguring: boolean;
  reconfiguredPlan: ImplementationPlan | null;
  addModification: (phaseId: string, taskId: string, nlp: string) => void;
  removeModification: (taskId: string) => void;
  clearAllModifications: () => void;
  reconfigurePlan: (projectId: string) => Promise<void>;
  lockPlan: (projectId: string) => Promise<void>;
}
```

**Backend endpoint needed:** `POST /api/projects/:projectId/plan/reconfigure`
- Accepts: `{ modifications: PlanModification[], originalPlan: ImplementationPlan }`
- Returns: `{ reconfiguredPlan: ImplementationPlan, changesExplanation: string }`

---

### Prompt 1.2: Plan Phase Component with Modify Button

Create the individual phase component with modification capability.

**File:** `src/components/builder/plan/PlanPhaseCard.tsx`

**Requirements:**
1. Display phase title, description, and tasks
2. "Modify" button that expands the phase to show individual tasks
3. Each task becomes clickable when in modify mode
4. Clicking a task opens inline NLP input below the task
5. NLP input has "Save" button that stores modification
6. Visual indicator showing which tasks have pending modifications
7. 3D liquid glass card styling with warm glow

**Styling:**
- Card: `backdrop-blur-xl bg-white/5 border border-white/10`
- 3D transform on hover: `transform-gpu perspective-1000`
- Warm glow: `shadow-[0_0_30px_rgba(255,200,150,0.15)]`
- Task modification indicator: amber pulse animation

**Props:**
```typescript
interface PlanPhaseCardProps {
  phase: ImplementationPhase;
  phaseIndex: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  modifications: Map<string, PlanModification>;
  onTaskModify: (taskId: string, nlp: string) => void;
}
```

---

### Prompt 1.3: Reconfigure Plan Button and Modal

Create the reconfigure plan functionality with loading state.

**File:** `src/components/builder/plan/ReconfigurePlanButton.tsx`

**Requirements:**
1. Button appears at top of plan when any modifications exist
2. Shows count of pending modifications
3. On click, sends all modifications to backend for AI reconfiguration
4. Shows streaming "thinking" state while reconfiguring
5. Once complete, displays new plan with changes highlighted
6. User can continue modifying or approve the new plan
7. "Approve Plan" button locks the plan and proceeds to dependency connection

**Styling:**
- Button: 3D liquid glass with gradient border
- Loading state: animated gradient shimmer
- Changes highlight: subtle green glow on changed items

**Backend integration:**
```typescript
// POST /api/projects/:projectId/plan/reconfigure
const reconfigurePlan = async (projectId: string, modifications: PlanModification[]) => {
  const response = await fetch(`/api/projects/${projectId}/plan/reconfigure`, {
    method: 'POST',
    body: JSON.stringify({ modifications }),
  });
  return response.json();
};
```

---

### Prompt 1.4: Backend Plan Reconfiguration Endpoint

Create the backend endpoint that uses AI to reconfigure the entire plan based on modifications.

**File:** `server/src/routes/plan-reconfigure.ts`

**Requirements:**
1. Accept modifications array and original plan
2. Use Opus 4.5 to analyze ALL modifications holistically
3. Generate entirely new plan considering:
   - User's original intent
   - All modification NLPs together
   - What the user is actually trying to achieve
   - Best practices for the intended functionality
4. Return new plan with:
   - Updated phases and tasks
   - Updated dependencies list
   - Explanation of changes made
5. Must not use placeholders or mock responses

**AI Prompt Structure:**
```
You are reconfiguring an implementation plan based on user modifications.

Original Plan: [plan JSON]

User Modifications:
[list of {taskId, originalTask, modificationNlp}]

Analyze what the user is trying to achieve with these modifications.
Consider if the modifications suggest a fundamentally different approach is needed.
Generate a complete new implementation plan that:
1. Honors the user's stated modifications
2. Ensures technical coherence across all phases
3. Updates dependencies if the modifications require new integrations
4. Maintains production-quality standards

Return the complete reconfigured plan as JSON.
```

---

## PHASE 2: Dependency Connection UI (5 Prompts)

### Prompt 2.1: Nango Integration Service

Create the Nango OAuth integration service for one-click connections.

**File:** `server/src/services/integrations/nango-service.ts`

**Requirements:**
1. Initialize Nango client with KripTik's Nango credentials
2. Check which integrations Nango supports for one-click OAuth
3. Generate Nango connect URLs for supported integrations
4. Handle OAuth callback and store credentials in vault
5. Return connection status and credential keys stored

**Supported Nango Integrations (verify current list):**
- Stripe
- GitHub
- Google (various APIs)
- Slack
- Notion
- Airtable
- HubSpot
- Salesforce

**Interface:**
```typescript
interface NangoService {
  isSupported(integration: string): boolean;
  getConnectUrl(integration: string, userId: string, projectId: string): string;
  handleCallback(code: string, state: string): Promise<StoredCredentials>;
  getConnectionStatus(userId: string, integration: string): Promise<ConnectionStatus>;
}
```

**Environment Variables Required:**
- `NANGO_SECRET_KEY`
- `NANGO_PUBLIC_KEY`
- `NANGO_CALLBACK_URL`

---

### Prompt 2.2: Dependency Tile Component with 3D Liquid Glass

Create the individual dependency tile component with premium styling.

**File:** `src/components/builder/dependencies/DependencyTile.tsx`

**Requirements:**
1. 3D liquid glass card with photorealistic translucency
2. Branded simple-icon logo for the dependency (e.g., Stripe, Supabase)
3. Dependency name and brief description
4. Two modes based on Nango support:
   - **Nango supported:** Single "Connect" button
   - **Manual credentials:** "Get Credentials" link + labeled input boxes
5. "Get Credentials" opens new browser window to correct platform URL
6. Input boxes have correct labels (e.g., "Secret Key", "Publishable Key")
7. "Save" button validates and stores credentials
8. 3D explosion animation on successful save (tile disappears)

**Styling Specifications:**
```css
/* Base tile */
.dependency-tile {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 40px rgba(255, 200, 150, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transform: perspective(1000px) rotateX(2deg);
  transform-style: preserve-3d;
}

/* Warm glow on hover */
.dependency-tile:hover {
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 60px rgba(255, 200, 150, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}
```

**Props:**
```typescript
interface DependencyTileProps {
  dependency: {
    id: string;
    name: string;
    icon: string; // simple-icons slug
    description: string;
    nangoSupported: boolean;
    credentialsNeeded: CredentialField[];
    platformUrl: string;
  };
  onConnected: (dependencyId: string) => void;
  onCredentialsSaved: (dependencyId: string, credentials: Record<string, string>) => void;
}

interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  helpText?: string;
}
```

---

### Prompt 2.3: 3D Explosion Animation Component

Create the explosion animation for when tiles disappear after connection.

**File:** `src/components/builder/dependencies/TileExplosion.tsx`

**Requirements:**
1. High frame rate 3D particle explosion animation
2. Particles follow physics-based trajectories
3. Warm glow color scheme (amber, orange, gold)
4. Particles fade out with blur effect
5. Total animation duration: 600ms
6. Uses requestAnimationFrame for smooth 60fps
7. Cleans up properly after animation completes

**Animation Specifications:**
- 40-60 particles generated from tile center
- Particles have random velocities with upward bias
- Each particle: small glowing orb with motion blur
- Gravity simulation for realistic arc
- Opacity fades from 1.0 to 0 over animation
- Scale decreases as particles fade

**Implementation approach:**
- Use Canvas or WebGL for performance
- Precompute particle trajectories
- Use CSS transforms with will-change for GPU acceleration

---

### Prompt 2.4: Dependency Connection View Container

Create the main dependency connection view that displays all tiles.

**File:** `src/components/builder/dependencies/DependencyConnectionView.tsx`

**Requirements:**
1. Grid layout of dependency tiles (responsive: 1-3 columns)
2. Header showing "Connect Your Dependencies" with count remaining
3. Progress indicator showing connected vs total
4. Tiles animate in with staggered entrance
5. Connected tiles explode and disappear
6. "Continue and Install Dependencies" button appears when all connected
7. Button disabled until all dependencies connected
8. Clicking continue transitions to streaming installation view

**Layout:**
```
+--------------------------------------------------+
|  Connect Your Dependencies (3 of 5 remaining)    |
|  [=========>                    ] 40%            |
+--------------------------------------------------+
|                                                  |
|  +-------------+  +-------------+  +-------------+
|  |   Stripe    |  |  Supabase   |  |   OpenAI   |
|  |   [logo]    |  |   [logo]    |  |   [logo]   |
|  |  [Connect]  |  | [Get Creds] |  | [Get Creds]|
|  +-------------+  +-------------+  +-------------+
|                                                  |
|  +-------------+  +-------------+                |
|  |   Resend    |  |   Clerk     |                |
|  |   [logo]    |  |   [logo]    |                |
|  | [Get Creds] |  |  [Connect]  |                |
|  +-------------+  +-------------+                |
|                                                  |
|        [ Continue and Install Dependencies ]     |
+--------------------------------------------------+
```

**State management:**
```typescript
interface DependencyConnectionState {
  dependencies: Dependency[];
  connectedIds: Set<string>;
  isAllConnected: boolean;
  isInstalling: boolean;
}
```

---

### Prompt 2.5: Streaming Dependency Installation View

Create the view shown while dependencies are being installed.

**File:** `src/components/builder/dependencies/DependencyInstallationStream.tsx`

**Requirements:**
1. Returns user to chat-like streaming interface
2. Shows streaming "thinking" tokens as dependencies install
3. Each dependency installation step shows:
   - Branded simple-icon logo (animated pulse while installing)
   - Status text: "Installing [dependency]..."
   - Checkmark when complete
4. After all installed, shows "Dependencies installed. Starting build..."
5. Automatically transitions to build streaming view
6. Must handle errors gracefully with retry option

**Visual Flow:**
```
+--------------------------------------------------+
|  Installing Dependencies...                       |
+--------------------------------------------------+
|                                                  |
|  [Stripe logo]  Installing Stripe SDK...     [x] |
|                 Configuring webhooks...      [x] |
|                 Verifying connection...      [x] |
|                                                  |
|  [Supabase logo] Installing Supabase client... [ ]|
|                  > Connecting to database...     |
|                  > Setting up auth helpers...    |
|                                                  |
|  [OpenAI logo]  Pending...                       |
|                                                  |
+--------------------------------------------------+
```

**Streaming Integration:**
- Connect to SSE endpoint: `GET /api/projects/:projectId/install-dependencies`
- Parse events: `{ type: 'step', dependency: string, step: string, status: 'pending' | 'in_progress' | 'complete' | 'error' }`

---

## PHASE 3: Auto Webhook/Endpoint Creation Wiring (3 Prompts)

### Prompt 3.1: Integration Orchestrator Service

Create the orchestrator that coordinates all integration setup during build.

**File:** `server/src/services/integrations/integration-orchestrator.ts`

**Requirements:**
1. Called by BuildLoopOrchestrator after credentials are saved
2. Reads the locked implementation plan for integration requirements
3. For each integration, executes required setup steps:
   - Stripe: Create webhooks, configure products if needed
   - Supabase: Verify connection, run migrations if specified
   - OpenAI: Validate API key, check model access
   - Custom APIs: Create necessary endpoints
4. Uses MCP clients where available for platform operations
5. Falls back to direct API calls when MCP not available
6. Reports progress via SSE to frontend
7. Stores created resources (webhook IDs, endpoint URLs) in project metadata

**Interface:**
```typescript
interface IntegrationOrchestrator {
  setupIntegrations(
    projectId: string,
    userId: string,
    plan: LockedImplementationPlan,
    credentials: CredentialVault
  ): AsyncGenerator<IntegrationProgress>;
}

interface IntegrationProgress {
  integrationId: string;
  step: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  details?: string;
  createdResources?: CreatedResource[];
}

interface CreatedResource {
  type: 'webhook' | 'endpoint' | 'database_table' | 'api_key' | 'other';
  name: string;
  identifier: string;
  url?: string;
}
```

---

### Prompt 3.2: Wire WebhookGenerator into Build Loop

Modify BuildLoopOrchestrator to call WebhookGenerator during integration setup.

**File:** `server/src/services/automation/build-loop.ts`

**Requirements:**
1. After Phase 0 (Intent Lock), add integration setup phase
2. Call IntegrationOrchestrator.setupIntegrations()
3. For Stripe integrations:
   - Call WebhookGenerator.generateWebhook() with correct events
   - Store webhook secret in project credentials
   - Update .env.local in sandbox with webhook URL
4. For other integrations requiring webhooks (GitHub, Clerk, etc.):
   - Generate appropriate webhook endpoints
   - Register webhooks on the platform using MCP/API
5. Update implementation plan with created webhook URLs
6. Emit progress events for frontend streaming display

**New Phase Insert Point:**
```typescript
// In BuildLoopOrchestrator.execute()
// After: await this.executePhase0_IntentLock(prompt);
// Add: await this.executePhase0B_IntegrationSetup();

private async executePhase0B_IntegrationSetup(): Promise<void> {
  const plan = await this.getLockedPlan();
  const credentials = await this.credentialVault.getProjectCredentials(this.projectId);

  for await (const progress of this.integrationOrchestrator.setupIntegrations(
    this.projectId,
    this.userId,
    plan,
    credentials
  )) {
    this.emitProgress('integration_setup', progress);

    if (progress.createdResources) {
      await this.updatePlanWithResources(progress.createdResources);
    }
  }
}
```

---

### Prompt 3.3: MCP Integration for Platform Operations

Create MCP client wrappers for common platform operations.

**File:** `server/src/services/integrations/mcp-platform-clients.ts`

**Requirements:**
1. Stripe MCP client:
   - Create webhooks
   - Create products/prices
   - Configure customer portal
2. GitHub MCP client:
   - Create repository webhooks
   - Configure GitHub Actions secrets
3. Vercel MCP client:
   - Set environment variables
   - Configure domains
4. Supabase MCP client:
   - Run migrations
   - Configure RLS policies
5. Each client checks if MCP server is available
6. Falls back to direct API calls if MCP unavailable
7. All operations use user's stored credentials

**Interface:**
```typescript
interface MCPPlatformClient<T> {
  readonly platform: string;
  isAvailable(): Promise<boolean>;
  execute<R>(operation: T): Promise<R>;
}

// Example: Stripe operations
type StripeOperation =
  | { type: 'create_webhook'; events: string[]; url: string }
  | { type: 'create_product'; name: string; price: number }
  | { type: 'configure_portal'; features: string[] };
```

---

## PHASE 4: HuggingFace/RunPod Automation (4 Prompts)

### Prompt 4.1: GPU Resource Discovery Service

Create service to fetch real-time GPU availability from RunPod.

**File:** `server/src/services/gpu/gpu-resource-discovery.ts`

**Requirements:**
1. Query RunPod API for current GPU availability
2. Query pricing for each GPU type
3. Cache results for 60 seconds (GPU availability changes frequently)
4. Return formatted resource options with:
   - GPU name (e.g., "NVIDIA A100 80GB")
   - Current availability (available/limited/unavailable)
   - Price per hour
   - Recommended for (inference/training/both)
5. Filter to GPUs suitable for user's model requirements

**Interface:**
```typescript
interface GPUResourceDiscovery {
  getAvailableResources(modelRequirements: ModelRequirements): Promise<GPUResource[]>;
  getRealtimePricing(gpuType: string): Promise<PricingInfo>;
  estimateCost(gpuType: string, estimatedHours: number): Promise<CostEstimate>;
}

interface GPUResource {
  id: string;
  name: string;
  vram: number;
  availability: 'available' | 'limited' | 'unavailable';
  pricePerHour: number;
  recommended: boolean;
  recommendedFor: ('inference' | 'training')[];
}

interface CostEstimate {
  gpuType: string;
  estimatedHours: number;
  estimatedCost: number;
  currency: 'USD';
  breakdown: {
    compute: number;
    storage: number;
    bandwidth: number;
  };
}
```

---

### Prompt 4.2: Resource Approval UI Component

Create the GPU resource selection and approval component.

**File:** `src/components/builder/gpu/ResourceApprovalView.tsx`

**Requirements:**
1. Only shown when implementation plan includes GPU/model requirements
2. Header: "Recommended Resources for Your AI Features"
3. Display available GPU options as selectable cards
4. Each card shows:
   - GPU name and specifications
   - Real-time availability indicator
   - Price per hour
   - Estimated monthly cost based on projected usage
5. "Recommended" badge on AI-suggested option
6. "Approve Resources" button
7. After approval, show "Approve Charges" confirmation
8. Charges metered through KripTik API billing

**Styling:**
- Same 3D liquid glass aesthetic as dependency tiles
- Availability indicator: green/yellow/red glow
- Selected state: brighter warm glow with border highlight

**Component Structure:**
```typescript
interface ResourceApprovalViewProps {
  modelRequirements: ModelRequirements;
  onResourcesApproved: (selectedGpu: GPUResource, billingApproved: boolean) => void;
  onSkip: () => void; // If user wants to configure later
}
```

---

### Prompt 4.3: Billing Approval and Metering Integration

Create the billing approval flow and metering integration.

**File:** `server/src/services/billing/gpu-billing-service.ts`

**Requirements:**
1. Integrate with KripTik billing API
2. Create metered billing subscription for GPU usage
3. Track usage in real-time as builds run
4. Generate invoices based on actual usage
5. Handle pre-authorization for estimated charges
6. Provide usage dashboard data

**File:** `src/components/builder/gpu/ChargeApprovalModal.tsx`

**Requirements:**
1. Modal shown after resource selection
2. Display:
   - Selected GPU resource
   - Estimated cost breakdown
   - Billing terms (metered, charged after usage)
   - Link to billing settings
3. Checkbox: "I approve charges for GPU usage metered to my account"
4. "Approve and Continue" button
5. "Cancel" returns to resource selection

**Billing API Integration:**
```typescript
interface GPUBillingService {
  createMeteringSubscription(userId: string, projectId: string, gpuType: string): Promise<SubscriptionId>;
  recordUsage(subscriptionId: string, usage: GPUUsage): Promise<void>;
  getUsageSummary(userId: string, period: 'day' | 'week' | 'month'): Promise<UsageSummary>;
  estimateCharges(gpuType: string, estimatedHours: number): Promise<ChargeEstimate>;
}
```

---

### Prompt 4.4: Wire RunPod Deployer into Build Loop

Connect the RunPod deployment to the build loop for automatic model deployment.

**File:** `server/src/services/automation/build-loop.ts` (modification)

**Requirements:**
1. After billing approval, automatically deploy model to RunPod
2. Use stored HuggingFace credentials for model access
3. Call RunPodDeployer.deployModel() with:
   - Model URL/identifier
   - Approved GPU type
   - Scaling configuration from plan
4. Wait for deployment to be ready
5. Store endpoint URL in project environment
6. Update implementation plan with deployment details
7. Begin metering from deployment start time

**New method:**
```typescript
private async executeGPUDeployment(
  modelConfig: ModelDeploymentConfig,
  approvedGpu: GPUResource,
  billingSubscriptionId: string
): Promise<DeploymentResult> {
  // Start metering
  await this.billingService.startMetering(billingSubscriptionId);

  // Deploy to RunPod
  const deployment = await this.runPodDeployer.deployModel({
    userId: this.userId,
    modelUrl: modelConfig.huggingFaceUrl,
    modelType: modelConfig.modality,
    gpuType: approvedGpu.id,
    scalingConfig: {
      minWorkers: 0,
      maxWorkers: modelConfig.maxConcurrency || 3,
      idleTimeout: 300,
    },
  });

  // Store endpoint
  await this.projectService.setEnvironmentVariable(
    this.projectId,
    `${modelConfig.name.toUpperCase()}_ENDPOINT`,
    deployment.endpointUrl
  );

  return deployment;
}
```

---

## PHASE 5: Simple Icons Integration (1 Prompt)

### Prompt 5.1: Simple Icons Service and Components

Create the service and components for rendering branded dependency icons.

**File:** `src/services/simple-icons-service.ts`

**Requirements:**
1. Import simple-icons package
2. Create mapping of dependency names to simple-icons slugs
3. Handle icons that don't exist in simple-icons (use custom fallback)
4. Return SVG path data and brand color

**File:** `src/components/ui/BrandIcon.tsx`

**Requirements:**
1. Render simple-icons SVG with proper sizing
2. Support custom colors or use brand color
3. Support animation states (pulse, spin)
4. Fallback to custom icon if not found
5. Accessible with proper aria labels

**Icon Mapping:**
```typescript
const DEPENDENCY_ICON_MAP: Record<string, string> = {
  'stripe': 'stripe',
  'supabase': 'supabase',
  'openai': 'openai',
  'github': 'github',
  'vercel': 'vercel',
  'clerk': 'clerk',
  'resend': 'resend',
  'twilio': 'twilio',
  'aws': 'amazonaws',
  'google': 'google',
  'firebase': 'firebase',
  'mongodb': 'mongodb',
  'postgresql': 'postgresql',
  'redis': 'redis',
  'docker': 'docker',
  'kubernetes': 'kubernetes',
  'huggingface': 'huggingface',
  // Add more as needed
};
```

---

## PHASE 6: Flow Integration and Testing (2 Prompts)

### Prompt 6.1: Update Builder View Flow Controller

Integrate all new components into the main builder view flow.

**File:** `src/components/builder/BuilderView.tsx` (modification)

**Requirements:**
1. Add new flow states:
   - `plan_modification` - User is modifying plan
   - `plan_reconfiguring` - AI is reconfiguring plan
   - `dependency_connection` - User connecting dependencies
   - `dependency_installation` - Dependencies being installed
   - `resource_approval` - User approving GPU resources (if needed)
   - `billing_approval` - User approving charges (if needed)
2. Correct flow order:
   ```
   nlp_input -> intent_analysis -> plan_review -> [plan_modification] ->
   plan_approved -> dependency_connection -> dependency_installation ->
   [resource_approval -> billing_approval] -> build_streaming -> complete
   ```
3. Handle backward navigation (user wants to modify after approving)
4. Persist state across page refreshes
5. Show appropriate component for each state

**State Machine:**
```typescript
type BuilderFlowState =
  | 'idle'
  | 'nlp_input'
  | 'intent_analysis'
  | 'plan_review'
  | 'plan_modification'
  | 'plan_reconfiguring'
  | 'plan_approved'
  | 'dependency_connection'
  | 'dependency_installation'
  | 'resource_approval'
  | 'billing_approval'
  | 'build_streaming'
  | 'complete'
  | 'error';

interface FlowTransition {
  from: BuilderFlowState;
  to: BuilderFlowState;
  condition?: () => boolean;
}
```

---

### Prompt 6.2: End-to-End Flow Testing

Create comprehensive tests for the entire flow.

**File:** `src/__tests__/builder-flow.test.tsx`

**Requirements:**
1. Test plan modification flow:
   - Add modification to task
   - Reconfigure plan
   - Verify new plan reflects changes
2. Test dependency connection flow:
   - Mock Nango OAuth flow
   - Test manual credential input
   - Verify explosion animation triggers
   - Test "Continue" button enables correctly
3. Test GPU resource flow:
   - Mock RunPod API responses
   - Test resource selection
   - Test billing approval
4. Test complete flow from NLP to build start
5. Test error handling at each step
6. Test state persistence across refresh

**File:** `server/src/__tests__/integration-orchestrator.test.ts`

**Requirements:**
1. Test webhook creation for Stripe
2. Test MCP client fallback to API
3. Test credential vault integration
4. Test progress event emission
5. Test RunPod deployment flow

---

## Execution Order

Execute prompts in this order for incremental building:

1. **Phase 5.1** - Simple Icons (dependency for tiles)
2. **Phase 2.2** - Dependency Tile Component
3. **Phase 2.3** - Explosion Animation
4. **Phase 2.4** - Dependency Connection View
5. **Phase 2.1** - Nango Integration Service
6. **Phase 2.5** - Installation Stream View
7. **Phase 1.1** - Plan Modification Store
8. **Phase 1.2** - Plan Phase Card
9. **Phase 1.3** - Reconfigure Button
10. **Phase 1.4** - Backend Reconfigure Endpoint
11. **Phase 3.1** - Integration Orchestrator
12. **Phase 3.2** - Wire WebhookGenerator
13. **Phase 3.3** - MCP Platform Clients
14. **Phase 4.1** - GPU Resource Discovery
15. **Phase 4.2** - Resource Approval UI
16. **Phase 4.3** - Billing Integration
17. **Phase 4.4** - Wire RunPod Deployer
18. **Phase 6.1** - Flow Controller Update
19. **Phase 6.2** - E2E Testing

---

## Success Criteria

After all phases complete:

1. User can modify any task in the implementation plan with NLP
2. "Reconfigure Plan" generates entirely new plan considering all modifications
3. Dependency tiles display with 3D liquid glass styling
4. Nango one-click OAuth works for supported integrations
5. Manual credential input works with correct labels and URLs
6. Tiles explode and disappear when credentials saved
7. "Continue and Install" transitions to streaming installation
8. Webhooks are automatically created on platforms
9. GPU resources shown with real-time availability
10. Billing approval metering works correctly
11. Models deploy to RunPod automatically
12. Build loop runs until done contract satisfied
13. All UI feels fast, responsive, and premium
14. No placeholders, mock data, or TODOs anywhere
15. Build compiles without errors
16. Auth remains intact throughout

---

## Environment Variables Required

Add to `.env`:
```
# Nango OAuth
NANGO_SECRET_KEY=
NANGO_PUBLIC_KEY=
NANGO_CALLBACK_URL=

# RunPod
RUNPOD_API_KEY=

# KripTik Billing
KRIPTIK_BILLING_API_KEY=
KRIPTIK_BILLING_WEBHOOK_SECRET=
```
