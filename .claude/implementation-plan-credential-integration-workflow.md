# Credential & Integration Workflow Implementation Plan

> **Created**: 2026-01-15
> **Purpose**: Structured prompts for redesigning the credential acquisition and integration workflow
> **Status**: IMPLEMENTATION PLAN ONLY - DO NOT AUTO-EXECUTE

---

## EXECUTIVE SUMMARY

This plan redesigns KripTik's credential/integration workflow to provide:
1. **Notification-driven credential requests** - User notified via dashboard/SMS/email when credentials needed
2. **Dynamic stack selection UI** - Dependency tiles generated from NLP request analysis
3. **Dual acquisition paths** - Nango OAuth "Connect" vs manual "Fetch credentials" buttons
4. **Agent automation** - Programmatic webhook/endpoint creation after credentials saved
5. **Premium 3D liquid glass styling** - No emojis, simple-icons only, red accents

---

## CURRENT STATE ANALYSIS

### Existing Infrastructure (Strengths)

| Component | Location | Status |
|-----------|----------|--------|
| Nango OAuth Service | `server/src/services/integrations/nango-service.ts` | 60+ integrations, functional |
| Credential Vault | `server/src/services/security/credential-vault.ts` | AES-256-GCM encryption, PKCE support |
| Notification Service | `server/src/services/notifications/notification-service.ts` | Multi-channel, has 'credentials_needed' type |
| ProviderConnectionCard | `src/components/production-stack/ProviderConnectionCard.tsx` | OAuth vs Manual distinction exists |

### Current Gaps

1. **Notification → Modal flow not connected** - 'credentials_needed' notification exists but doesn't trigger credential modal
2. **No "Fetch credentials" browser window flow** - Manual entry is inline, not guided
3. **Stack selection is static** - Not dynamically generated from NLP analysis
4. **No agent notification on credential save** - Agent doesn't know when to proceed
5. **Styling uses green accents (#c8ff64)** - Should be red/black/white with 3D glass
6. **No RunPod GPU availability checking** - Static config without real-time data
7. **No simple-icons integration** - Uses custom SVGs

---

## PART 1: NOTIFICATION-DRIVEN CREDENTIAL REQUEST WORKFLOW

### Prompt 1A: Backend Notification Trigger

```
TASK: Implement credential request notification trigger in BuildLoopOrchestrator

CONTEXT:
- Location: server/src/services/automation/build-loop.ts
- The notification service already has 'credentials_needed' type
- Need to detect when integration requires credentials during Phase 2

REQUIREMENTS:
1. During Phase 2 (PARALLEL BUILD), when an integration dependency is detected:
   - Check if credentials exist in vault for that integration
   - If missing, pause build and trigger notification

2. Create function detectRequiredCredentials():
   - Analyze current build artifacts for integration patterns
   - Check against Nango catalog and manual entry providers
   - Return array of { integrationId, reason, urgency }

3. Send notification with payload:
   {
     type: 'credentials_needed',
     title: 'Credentials Required: {integrationName}',
     message: 'Your build requires {integrationName} credentials to continue.',
     enableReply: false,
     metadata: {
       integrationId: string,
       projectId: string,
       buildId: string,
       supportsOAuth: boolean,
       dashboardUrl: string
     },
     suggestedActions: [{ action: 'approve', label: 'Add Credentials' }]
   }

4. Store pending credential request in database for dashboard display

5. Emit SSE event 'credentials_requested' for real-time UI update

INTEGRATION POINTS:
- NotificationService.sendNotification() for multi-channel delivery
- CredentialVault.getCredential() to check existing credentials
- NangoService OAUTH_PROVIDERS set for OAuth detection
- MANUAL_ENTRY_PROVIDERS set from ProviderConnectionCard.tsx

DO NOT USE:
- Emojis in notification messages
- Lucide React icons
```

### Prompt 1B: Dashboard Notification Display

```
TASK: Create CredentialRequestNotification component for dashboard

CONTEXT:
- Location: src/components/notifications/CredentialRequestNotification.tsx
- Must integrate with existing NotificationsSection.tsx
- Opens credential modal when clicked

REQUIREMENTS:
1. Component displays:
   - Integration name with branded icon (simple-icons or custom SVG)
   - Brief reason why credential is needed
   - "Add Credentials" button that opens CredentialAcquisitionModal

2. Styling (MANDATORY):
   - Premium 3D liquid glass panel with depth
   - Background: rgba(0, 0, 0, 0.6) with backdrop-blur-xl
   - Border: 1px solid rgba(255, 255, 255, 0.1)
   - Red accent glow on hover: box-shadow with rgba(220, 38, 38, 0.3)
   - No emojis anywhere
   - Use simple-icons for branded icons OR custom geometric SVG

3. Animation:
   - Framer Motion entrance with scale and opacity
   - Subtle pulse animation on "Add Credentials" button
   - Smooth hover state transitions

4. Props interface:
   interface CredentialRequestNotificationProps {
     notification: {
       id: string;
       integrationId: string;
       integrationName: string;
       reason: string;
       supportsOAuth: boolean;
       projectId: string;
       buildId: string;
       createdAt: string;
     };
     onAddCredentials: (integrationId: string) => void;
     onDismiss: (notificationId: string) => void;
   }

ICON REQUIREMENTS:
- Import branded icons from simple-icons package
- Fallback to custom geometric shape (interlocking triangles, white/black with red accent)
- NO Lucide React, NO emojis
```

### Prompt 1C: Credential Acquisition Modal

```
TASK: Create CredentialAcquisitionModal component

CONTEXT:
- Location: src/components/credentials/CredentialAcquisitionModal.tsx
- Triggered from notification click or stack selection
- Handles both OAuth and manual credential flows

REQUIREMENTS:
1. Modal Structure:
   - Large modal (max-w-2xl) with 3D glass styling
   - Header: Integration name + branded icon
   - Body: Credential input fields OR OAuth connect button
   - Footer: Save button + Cancel button

2. For OAuth-supported integrations (check OAUTH_PROVIDERS):
   - Show "Connect with {Provider}" button
   - Opens OAuth popup using existing Nango flow
   - Polls for completion, then closes modal

3. For Manual Entry integrations (check MANUAL_ENTRY_PROVIDERS):
   - Show labeled credential input fields
   - "Fetch Credentials" button that opens provider dashboard in new window
   - Brief explanation: "Get your API key from {Provider}'s dashboard"
   - Input validation before save

4. Credential Fields by Provider:
   - Stripe: Publishable Key, Secret Key, Webhook Secret
   - OpenAI: API Key
   - Anthropic: API Key
   - RunPod: API Key, Pod Template ID (optional)
   - Supabase: Project URL, Anon Key, Service Role Key
   - Vercel: Access Token
   - HuggingFace: Access Token (with write access check)
   - Turso: Database URL, Auth Token
   - AWS: Access Key ID, Secret Access Key, Region
   - Google Auth: Client ID, Client Secret, Callback URL instruction

5. "Fetch Credentials" Flow:
   - Button click opens provider dashboard URL in new window
   - Show instruction overlay: "Copy your credentials from {Provider}"
   - Window focus returns, prompt user to paste
   - Validate credentials before save

6. On Save:
   - Call CredentialVault.storeCredential() via API
   - Emit 'credentials_saved' event to notify agent
   - Close modal
   - Update notification as resolved

STYLING (MANDATORY):
- 3D liquid glass: background rgba(10, 10, 10, 0.8), backdrop-blur-2xl
- Glass texture effect using CSS gradients
- Input fields: dark glass with white/gray text
- Save button: Red gradient (#dc2626 to #991b1b) with warm glow
- Cancel button: Transparent with white border
- No emojis, no Lucide icons
- Use simple-icons for provider brands
- Photorealistic depth shadows on modal
```

### Prompt 1D: Agent Notification on Credential Save

```
TASK: Implement credential save notification to BuildLoopOrchestrator

CONTEXT:
- Location: server/src/routes/credentials.ts (existing)
- Location: server/src/services/automation/build-loop.ts
- Agent must be notified when credentials become available

REQUIREMENTS:
1. In credentials route, after successful storeCredential():
   - Emit SSE event 'credentials_available' with:
     {
       integrationId: string,
       projectId: string,
       buildId: string,
       userId: string,
       timestamp: Date
     }

2. BuildLoopOrchestrator subscribes to 'credentials_available':
   - Check if waiting for this specific credential
   - If yes, resume build from Phase 2
   - Log credential acquisition to build history

3. Agent Action Sequence (after credential received):
   a. Load implementation plan and functional checklist
   b. Determine if integration requires setup:
      - Webhooks (Stripe, GitHub, etc.)
      - Callback URLs (OAuth providers)
      - Database schemas (Supabase, Turso)
      - Environment variables
   c. Execute programmatic setup using:
      - Provider MCP server if available
      - Provider CLI (via Bash tool)
      - Provider REST API (via fetch)
   d. Write .env file with credentials
   e. Continue build with integrated dependency

4. Store credential usage in audit log:
   - credentialAuditLogs table already exists
   - Log: access_time, integration_id, action, ip_address
```

---

## PART 2: DYNAMIC STACK SELECTION UI

### Prompt 2A: NLP Dependency Analyzer

```
TASK: Create DependencyAnalyzer service for NLP-based stack detection

CONTEXT:
- Location: server/src/services/ai/dependency-analyzer.ts
- Analyzes user's NLP prompt to extract required dependencies
- Feeds into dynamic Stack Selection UI

REQUIREMENTS:
1. Analyze NLP prompt for integration keywords:
   - Payment: "payment", "stripe", "paypal", "checkout", "subscription"
   - Auth: "authentication", "login", "oauth", "google sign-in", "github login"
   - Database: "database", "postgres", "mysql", "mongodb", "supabase", "turso"
   - AI: "ai", "openai", "gpt", "claude", "anthropic", "huggingface", "llm"
   - Storage: "storage", "s3", "cloudflare r2", "file upload"
   - Email: "email", "sendgrid", "resend", "notification"
   - Compute: "gpu", "runpod", "modal", "training", "fine-tune"

2. Return structured analysis:
   interface DependencyAnalysis {
     detectedDependencies: Array<{
       id: string;
       name: string;
       category: 'payments' | 'auth' | 'database' | 'ai' | 'storage' | 'email' | 'compute' | 'deployment';
       confidence: number;
       reason: string;
       supportsOAuth: boolean;
       nangoId?: string;
       requiredCredentials: string[];
     }>;
     suggestedStack: {
       frontend: string[];
       backend: string[];
       database: string[];
       infrastructure: string[];
     };
   }

3. Use AI model for fuzzy matching:
   - Call claude-haiku for fast analysis
   - Prompt: "Analyze this app description and list required integrations..."
   - Parse JSON response

4. Cross-reference with Nango catalog:
   - Check if detected integration is in NANGO_INTEGRATIONS
   - Set supportsOAuth accordingly
```

### Prompt 2B: Stack Selection Panel Component

```
TASK: Create StackSelectionPanel with dynamic dependency tiles

CONTEXT:
- Location: src/components/stack-selection/StackSelectionPanel.tsx
- Replaces current static stack selection
- Dynamically populated from DependencyAnalyzer results

REQUIREMENTS:
1. Panel Layout:
   - Grid of dependency tiles (responsive: 2-4 columns)
   - Category headers: "Payments", "Authentication", "Database", etc.
   - Each tile is a 3D card with depth

2. Dependency Tile Structure:
   - Branded icon (simple-icons)
   - Integration name
   - Status indicator (connected/not connected/pending)
   - Action button:
     - OAuth supported → "Connect" button (green outline, opens OAuth)
     - Manual entry → "Fetch Credentials" button (opens modal)

3. Dynamic Population:
   - Receive dependencies from DependencyAnalyzer
   - Filter by category
   - Show confidence indicator for AI-detected deps
   - Allow user to add/remove dependencies

4. Tile Interaction:
   - "Connect" button → Opens Nango OAuth popup
   - "Fetch Credentials" button → Opens CredentialAcquisitionModal
   - Status updates via SSE on connection complete

5. RunPod/GPU Section (Special):
   - Show available GPU types with real-time pricing
   - Display availability status (fetched from RunPod API)
   - Pod template selector dropdown
   - "Configure GPU" button opens detailed config modal

6. HuggingFace Section (Special):
   - Token validation status (read vs write access)
   - Model selector for deployment
   - Space configuration options

STYLING (MANDATORY):
- Container: 3D liquid glass panel
- Tiles: Dark glass cards with perspective transform
- Red accent on connected status: #dc2626
- White/gray text on dark backgrounds
- Visible tile edges for 3D effect (1px lighter border on top/left)
- Shadow layers for depth
- No emojis, simple-icons only
- Hover: Subtle lift with shadow increase
```

### Prompt 2C: OAuth Connect Flow (Nango Integration)

```
TASK: Implement OAuth connect flow using existing Nango service

CONTEXT:
- Location: src/components/stack-selection/OAuthConnectButton.tsx
- Uses server/src/services/integrations/nango-service.ts
- Handles popup flow with status polling

REQUIREMENTS:
1. Button Component:
   - Props: { integrationId, onSuccess, onError }
   - Shows "Connect with {Provider}" text
   - Branded icon from simple-icons

2. OAuth Flow:
   a. User clicks button
   b. Call API: POST /api/integrations/nango/auth-url
      - Body: { integrationId, redirectUrl }
   c. Open returned URL in popup window
   d. Poll for connection status every 2 seconds
   e. On success: Close popup, call onSuccess, update tile status
   f. On timeout (2 min): Show error, allow retry

3. Use existing NangoService methods:
   - getOAuthUrl() for auth URL generation
   - getConnection() for status polling
   - getUserConnections() for bulk status check

4. Handle edge cases:
   - Popup blocked → Show manual link option
   - OAuth denied → Show error with retry
   - Network error → Exponential backoff on polling

5. Styling:
   - Button: Outlined style with provider brand color
   - Loading state: Spinning geometric shape (not emoji)
   - Success state: Green checkmark (custom SVG)
   - Error state: Red X (custom SVG)
```

### Prompt 2D: RunPod GPU Availability Integration

```
TASK: Integrate RunPod API for real-time GPU availability

CONTEXT:
- Location: server/src/services/compute/runpod-availability.ts
- Location: src/components/stack-selection/RunPodGPUSelector.tsx
- Shows real-time GPU pricing and availability

REQUIREMENTS:
1. Backend Service (runpod-availability.ts):
   - Fetch GPU types from RunPod API
   - Cache results for 60 seconds
   - Return: { gpuType, available, pricePerHour, vram, location }

2. API Route: GET /api/compute/runpod/availability
   - Returns cached GPU availability data
   - Requires valid RunPod API key in vault

3. Frontend Component (RunPodGPUSelector.tsx):
   - Grid of GPU cards showing:
     - GPU name (RTX 4090, A100, H100, etc.)
     - VRAM amount
     - Price per hour
     - Availability status (available/limited/unavailable)
   - Selection stores preferred GPU in project config

4. Visual Indicators:
   - Available: Green dot + "Available"
   - Limited: Yellow dot + "Limited (X remaining)"
   - Unavailable: Red dot + "Unavailable"

5. Styling:
   - 3D glass cards for each GPU option
   - Selected card: Red border glow
   - Price displayed with $ prefix, 2 decimal places
   - No emojis
```

---

## PART 3: 3D LIQUID GLASS STYLING SYSTEM

### Prompt 3A: Glass Design System Components

```
TASK: Create reusable 3D liquid glass design system

CONTEXT:
- Location: src/components/ui/glass/
- Establishes consistent premium styling across credential UI
- Replaces current light-themed glass styling

REQUIREMENTS:
1. Create base components:

   a. GlassPanel.tsx
   - Props: { variant: 'dark' | 'darker', depth: 1-5, children }
   - Base styles:
     background: rgba(10, 10, 10, 0.85)
     backdrop-filter: blur(24px)
     border: 1px solid rgba(255, 255, 255, 0.08)
     border-radius: 16px
   - Depth levels add progressive shadow layers
   - Photorealistic glass texture via CSS gradient overlay

   b. GlassCard.tsx
   - 3D card with perspective transform
   - Visible edges (lighter border on top/left for depth illusion)
   - Hover: translateY(-4px) + shadow increase
   - Active: scale(0.98) feedback

   c. GlassButton.tsx
   - Variants: 'primary' (red gradient), 'secondary' (transparent), 'outline'
   - Primary: linear-gradient(135deg, #dc2626, #991b1b)
   - Warm photorealistic glow on hover
   - No emojis in button text

   d. GlassInput.tsx
   - Dark input field with subtle inner shadow
   - Focus: Red accent border glow
   - Placeholder: rgba(255, 255, 255, 0.4)
   - Text: white

2. Color Palette:
   - Primary: #dc2626 (red)
   - Background: #0a0a0a, #121212, #1a1a1a
   - Text: #ffffff, #a0a0a0, #606060
   - Border: rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.15)
   - Success: #22c55e
   - Warning: #eab308
   - Error: #ef4444

3. Glass Texture Effect:
   - CSS gradient overlay for glass refraction illusion
   - Subtle noise texture via SVG filter
   - Gradient: radial at top-left, rgba(255,255,255,0.05) to transparent

4. Shadow Layers (for depth):
   - Level 1: 0 4px 6px rgba(0,0,0,0.3)
   - Level 2: 0 8px 15px rgba(0,0,0,0.4)
   - Level 3: 0 12px 25px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.3)
   - Level 4: 0 20px 40px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.4)
   - Level 5: 0 30px 60px rgba(0,0,0,0.7), 0 15px 30px rgba(0,0,0,0.5)
```

### Prompt 3B: Simple-Icons Integration

```
TASK: Integrate simple-icons for branded provider icons

CONTEXT:
- Location: src/components/ui/icons/BrandIcon.tsx
- Replaces current custom icons with simple-icons package
- Fallback to geometric shapes for unsupported brands

REQUIREMENTS:
1. Install simple-icons:
   npm install simple-icons

2. Create BrandIcon component:
   interface BrandIconProps {
     brand: string;
     size?: number;
     className?: string;
   }

   - Lookup icon from simple-icons by slug
   - Apply brand color or custom color
   - Fallback: Custom geometric SVG (interlocking shapes)

3. Supported brands mapping:
   - stripe → siStripe
   - openai → siOpenai
   - anthropic → siAnthropic (or custom if not available)
   - supabase → siSupabase
   - vercel → siVercel
   - github → siGithub
   - google → siGoogle
   - aws → siAmazonaws
   - huggingface → siHuggingface
   - runpod → custom geometric SVG (not in simple-icons)

4. Fallback Geometric Icon:
   - Interlocking triangles/shapes
   - White and black with red accent
   - Rotate based on brand name hash for variety

5. Usage:
   <BrandIcon brand="stripe" size={24} />
   <BrandIcon brand="unknown-provider" size={24} /> // Shows geometric fallback
```

### Prompt 3C: Custom Geometric Icon System

```
TASK: Create custom geometric icon system for non-branded uses

CONTEXT:
- Location: src/components/ui/icons/GeometricIcon.tsx
- Used when simple-icons doesn't have brand OR for UI elements
- Replaces Lucide React icons entirely

REQUIREMENTS:
1. Base geometric shapes:
   - InterlockingTriangles
   - HexagonMesh
   - CubeFrame
   - DiamondGrid
   - CircuitPattern

2. Each shape:
   - Built with SVG paths
   - Primary color: white (#ffffff)
   - Secondary color: black (#000000)
   - Accent: red (#dc2626)
   - Accepts size and className props

3. Icon variants for common UI needs:
   - CheckGeometric (success indicator)
   - XGeometric (error/close indicator)
   - PlusGeometric (add action)
   - RefreshGeometric (loading/retry)
   - LockGeometric (security/credentials)
   - KeyGeometric (API key)
   - LinkGeometric (connection)
   - SettingsGeometric (configuration)

4. Animation support:
   - Spin variant for loading states
   - Pulse variant for attention
   - Scale on hover

5. Export from central location:
   export { CheckGeometric, XGeometric, ... } from './GeometricIcons';
```

---

## PART 4: AGENT INTEGRATION FOR PROGRAMMATIC SETUP

### Prompt 4A: Integration Setup Service

```
TASK: Create IntegrationSetupService for programmatic provider configuration

CONTEXT:
- Location: server/src/services/integrations/integration-setup-service.ts
- Called by agent after credentials are available
- Handles webhooks, callback URLs, database schemas, etc.

REQUIREMENTS:
1. Service Methods:

   a. setupStripeIntegration(credentials, projectId):
      - Create webhook endpoint using Stripe API
      - Configure webhook events (checkout.session.completed, etc.)
      - Store webhook secret in vault
      - Return { webhookId, webhookUrl, configuredEvents }

   b. setupSupabaseIntegration(credentials, projectId):
      - Verify connection using supabase-js
      - Create project-specific schema if needed
      - Configure RLS policies template
      - Return { connected, schemaReady }

   c. setupOAuthProvider(provider, credentials, projectId):
      - Validate client ID/secret
      - Generate callback URL for project
      - Return { callbackUrl, instructions }

   d. setupOpenAIIntegration(credentials, projectId):
      - Validate API key
      - Check rate limits and quotas
      - Return { valid, orgId, rateLimit }

   e. setupRunPodIntegration(credentials, projectId):
      - Validate API key
      - Fetch available pods
      - Return { valid, availablePods, balance }

2. MCP Integration Pattern:
   - Check if provider has MCP server available
   - If yes, use MCP tools for setup
   - If no, use REST API or CLI

3. Error Handling:
   - Invalid credentials → Return specific error message
   - Rate limit → Suggest retry timing
   - Missing permissions → List required permissions

4. Audit Logging:
   - Log all setup attempts
   - Store configuration changes
   - Track API calls made
```

### Prompt 4B: Webhook Endpoint Generator

```
TASK: Create dynamic webhook endpoint system

CONTEXT:
- Location: server/src/services/webhooks/webhook-generator.ts
- Generates unique webhook URLs for each project/integration
- Handles incoming webhook events

REQUIREMENTS:
1. Webhook URL Pattern:
   https://api.kriptik.app/webhooks/{projectId}/{integrationId}/{secret}

2. Generator Function:
   async generateWebhookEndpoint(projectId, integrationId):
     - Generate cryptographically secure secret
     - Store endpoint config in database
     - Return { url, secret, createdAt }

3. Webhook Event Handler:
   - Route: POST /webhooks/:projectId/:integrationId/:secret
   - Verify signature using integration-specific method
   - Parse event payload
   - Store event in database
   - Trigger relevant actions (e.g., payment received → update subscription)

4. Supported Integrations:
   - Stripe: Verify using stripe-signature header
   - GitHub: Verify using X-Hub-Signature-256
   - Supabase: Verify using custom header
   - Generic: HMAC-SHA256 verification

5. Event Processing:
   - Queue events for async processing
   - Retry failed handlers with exponential backoff
   - Store event history for debugging
```

### Prompt 4C: Environment Variable Writer

```
TASK: Create EnvWriter service for .env file management

CONTEXT:
- Location: server/src/services/env/env-writer.ts
- Writes credentials and config to project .env file
- Called after credential save and integration setup

REQUIREMENTS:
1. EnvWriter Methods:

   a. writeCredentialsToEnv(projectPath, credentials):
      - Read existing .env file (preserve non-conflicting vars)
      - Add/update credential vars
      - Write atomically (temp file → rename)

   b. generateEnvTemplate(dependencies):
      - Based on detected dependencies
      - Generate .env.example with placeholder values
      - Include comments explaining each variable

2. Variable Naming Convention:
   - Stripe: STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
   - OpenAI: OPENAI_API_KEY
   - Anthropic: ANTHROPIC_API_KEY
   - Supabase: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   - Vercel: VERCEL_TOKEN
   - RunPod: RUNPOD_API_KEY
   - HuggingFace: HUGGINGFACE_TOKEN

3. Security:
   - Never log credential values
   - Set file permissions to 600
   - Add .env to .gitignore if not present

4. Validation:
   - Check for duplicate keys
   - Validate value format (no newlines, proper escaping)
   - Warn on overwriting existing values
```

---

## PART 5: BUILD LOOP INTEGRATION

### Prompt 5A: Credential-Aware Build Phase

```
TASK: Modify BuildLoopOrchestrator to handle credential requirements

CONTEXT:
- Location: server/src/services/automation/build-loop.ts
- Phase 2 should pause when credentials missing
- Resume automatically when credentials saved

REQUIREMENTS:
1. Add credential check at Phase 2 start:
   async executePhase2_ParallelBuild() {
     // Before starting build:
     const requiredCreds = await this.detectRequiredCredentials();
     const missingCreds = await this.checkMissingCredentials(requiredCreds);

     if (missingCreds.length > 0) {
       await this.requestCredentials(missingCreds);
       this.state.status = 'waiting_credentials';
       return; // Will resume when credentials saved
     }

     // Continue with build...
   }

2. Add credential listener:
   - Subscribe to 'credentials_available' events
   - Match event to pending credential request
   - Resume build if waiting

3. Add state: 'waiting_credentials' to BuildLoopState

4. Emit events for UI:
   - 'credentials_required': { integrations: string[] }
   - 'credentials_received': { integrationId: string }
   - 'build_resuming': { fromPhase: number }

5. Store credential wait time in build metrics
```

### Prompt 5B: Post-Credential Integration Setup

```
TASK: Implement automatic integration setup after credential save

CONTEXT:
- Location: server/src/services/automation/build-loop.ts
- After credentials saved, agent should configure integration
- Before resuming code generation

REQUIREMENTS:
1. After credentials received, before resuming Phase 2:

   async setupIntegrationAfterCredential(integrationId) {
     const credentials = await credentialVault.getCredential(userId, integrationId);

     switch (integrationId) {
       case 'stripe':
         await integrationSetup.setupStripeIntegration(credentials, projectId);
         break;
       case 'supabase':
         await integrationSetup.setupSupabaseIntegration(credentials, projectId);
         break;
       // ... other integrations
     }

     // Write to .env
     await envWriter.writeCredentialsToEnv(projectPath, credentials);

     // Update build context with integration details
     this.context.integrations[integrationId] = { configured: true, ... };
   }

2. Pass integration config to code generation:
   - Webhook URLs
   - Callback URLs
   - Database connection strings
   - API endpoints

3. Validate integration before continuing:
   - Test API connection
   - Verify permissions
   - Check required scopes for OAuth
```

---

## PART 6: TESTING & VALIDATION

### Prompt 6A: Credential Flow E2E Tests

```
TASK: Create E2E tests for credential acquisition flow

CONTEXT:
- Location: server/src/tests/credentials/credential-flow.test.ts
- Tests complete flow from notification to build resume

TEST CASES:
1. OAuth Integration Flow:
   - Mock Nango OAuth response
   - Verify credential stored in vault
   - Verify agent notified
   - Verify build resumes

2. Manual Credential Flow:
   - Simulate credential modal submission
   - Verify validation runs
   - Verify credential encrypted and stored
   - Verify build resumes

3. Invalid Credential Handling:
   - Submit invalid API key
   - Verify error displayed
   - Verify not stored
   - Verify retry available

4. Build Resume After Credential:
   - Start build, pause for credentials
   - Add credentials
   - Verify Phase 2 resumes
   - Verify integration setup runs

5. Multi-Credential Flow:
   - Build requires Stripe + Supabase
   - Add both sequentially
   - Verify both configured
   - Verify build continues
```

---

## IMPLEMENTATION ORDER

### Phase 1: Foundation (Week 1)
1. 3A: Glass Design System Components
2. 3B: Simple-Icons Integration
3. 3C: Custom Geometric Icons
4. 2A: NLP Dependency Analyzer

### Phase 2: Core Credential Flow (Week 2)
1. 1A: Backend Notification Trigger
2. 1C: Credential Acquisition Modal
3. 1D: Agent Notification on Save
4. 4C: Environment Variable Writer

### Phase 3: Stack Selection UI (Week 3)
1. 2B: Stack Selection Panel
2. 2C: OAuth Connect Flow
3. 2D: RunPod GPU Availability
4. 1B: Dashboard Notification Display

### Phase 4: Agent Integration (Week 4)
1. 4A: Integration Setup Service
2. 4B: Webhook Endpoint Generator
3. 5A: Credential-Aware Build Phase
4. 5B: Post-Credential Integration Setup

### Phase 5: Testing & Polish (Week 5)
1. 6A: E2E Tests
2. UI polish and animations
3. Error handling edge cases
4. Documentation

---

## DEPENDENCIES

### NPM Packages to Add:
- simple-icons (for branded icons)
- No new packages for core functionality (using existing infrastructure)

### Existing Infrastructure to Leverage:
- NangoService (server/src/services/integrations/nango-service.ts)
- CredentialVault (server/src/services/security/credential-vault.ts)
- NotificationService (server/src/services/notifications/notification-service.ts)
- BuildLoopOrchestrator (server/src/services/automation/build-loop.ts)

### External APIs:
- Nango OAuth (existing integration)
- RunPod API (for GPU availability)
- Provider APIs (Stripe, Supabase, etc.)

---

## STYLING CHECKLIST

For every component created, verify:
- [ ] No emojis anywhere (text, icons, loading states)
- [ ] No Lucide React icons imported
- [ ] Simple-icons for branded icons OR custom geometric SVG
- [ ] 3D liquid glass styling (dark theme, depth shadows)
- [ ] Red accent color (#dc2626) for primary actions
- [ ] White/black/gray color palette
- [ ] Visible depth on cards (perspective, edge highlights)
- [ ] Framer Motion animations
- [ ] Backdrop blur applied
- [ ] Photorealistic glow on hover states

---

*This implementation plan provides structured prompts for the credential/integration workflow redesign. Execute prompts in order, verify styling requirements after each component.*

*Created: 2026-01-15*
*Status: PLAN ONLY - Awaiting approval for implementation*
