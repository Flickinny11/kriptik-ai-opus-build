# 3D Panel Enhancement Implementation Plan (Revised)

> **Goal**: Implement premium 3D visualizations for developer toolbar panels with FULL configuration options, proper integration, and NO redundancies.

**Created**: December 22, 2025
**Revised**: December 22, 2025 (Per user clarifications)
**Design Reference**: Liquid glass styling, 3D bar charts, splatting animations, vibrant colors

---

## CRITICAL CLARIFICATIONS FROM USER

Before implementing, understand these requirements:

### 1. Ghost Mode
- **NEEDS dedicated button in developer toolbar** (separate from Feature Agent)
- Opens full config panel with ALL options (email, SMS, Slack, Discord, webhooks)
- **Has TABS** for each Feature Agent that enabled Ghost Mode
- **Has TAB** for Builder View (Kriptoenite/multi-agent orchestration) Ghost Mode
- Must integrate with BOTH Feature Agents AND Builder View

### 2. Soft Interrupt
- **Keep floating** (as it is now)
- **ADD target selector** showing:
  - Builder View (Kriptoenite/multi-agent) - only if running
  - All currently running Feature Agents - dynamic list
- Only shows what's CURRENTLY RUNNING

### 3. Notifications
- **Keep on Dashboard** (already there)
- Add button/indicator somewhere for quick access
- Must allow incoming notifications that are selectable

### 4. Verification Swarm
- **Already has expandable button** with 6 verification agents
- Quality check is handled by verification swarm - NO separate button needed

### 5. Tournament Mode
- **NO BUTTON NEEDED** - automatic system
- Works within orchestration automatically
- AI judge determines best implementation
- User doesn't configure it - it just works

### 6. Integrations Button
- Show **REAL env variables** for each integration (not mock data)
- **"Click to install"** dependency into user's app
- **Select which app** to install to
- After install, show UI to input required env variables
- Each integration has unique env variable names

### 7. Voice Architect
- Allow natural conversation speeds
- **Real-time modifications** capability

### 8. GitHub Import
- Complete implementation (covered in LATTICE plan)

---

## FEATURES TO IMPLEMENT

### A. Ghost Mode Panel (NEW - Developer Toolbar Button)

**New File**: `src/components/developer-bar/panels/GhostModeControlPanel.tsx`

This is a DEDICATED Ghost Mode panel accessible from the developer toolbar.

```
┌─────────────────────────────────────────────────────────────────────┐
│  👻 GHOST MODE CONTROL CENTER                              [×]      │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────┬───────────────┬───────────────┬───────────────┐        │
│  │ Builder │ Feature #1    │ Feature #2    │ Feature #3    │        │
│  │ View    │ (Auth Flow)   │ (Dashboard)   │ (API Routes)  │        │
│  └─────────┴───────────────┴───────────────┴───────────────┘        │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                      │
│  GHOST MODE STATUS: ● ACTIVE                                        │
│  Currently building autonomously...                                  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  WAKE CONDITIONS                                             │    │
│  │  ┌─────────────────────────────────────────────────────────┐│    │
│  │  │ ☑ On completion         ☑ On error                      ││    │
│  │  │ ☑ On critical error     ☑ Decision needed               ││    │
│  │  │ ☐ Cost threshold        ☐ Time elapsed                  ││    │
│  │  │ ☐ Feature complete      ☐ Quality threshold             ││    │
│  │  └─────────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  NOTIFICATION CHANNELS                                       │    │
│  │                                                              │    │
│  │  📧 Email:     [user@example.com________________] ☑ Enable   │    │
│  │  📱 SMS:       [+1 555-123-4567__________________] ☐ Enable   │    │
│  │  💬 Slack:     [#kriptik-builds__________________] ☐ Enable   │    │
│  │  🎮 Discord:   [webhook URL______________________] ☐ Enable   │    │
│  │  🔗 Webhook:   [https://your-webhook.com_________] ☐ Enable   │    │
│  │  🔔 Push:      Browser notifications             ☑ Enable   │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  AUTONOMY SETTINGS                                           │    │
│  │                                                              │    │
│  │  Max autonomous time:    [2 hours_________▼]                 │    │
│  │  Quality floor:          [85___] (wake if drops below)       │    │
│  │  Cost ceiling:           [$10.00] (wake if exceeds)          │    │
│  │  Auto-fix retries:       [3____] per error                   │    │
│  │  Checkpoint frequency:   [5 min_________▼]                   │    │
│  │  ☑ Pause on security issue                                   │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   ⏸ Pause All    │  │   ▶ Resume All   │  │   🔔 Wake Now    │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Backend Integration**:
- `server/src/services/ghost-mode/ghost-controller.ts` (existing)
- `server/src/routes/ghost-mode.ts` (existing)

**Configuration Options**:

| Option | Type | Description |
|--------|------|-------------|
| `wakeConditions` | Multi-select | completion, error, critical_error, decision_needed, cost_threshold, time_elapsed, feature_complete, quality_threshold |
| `notificationChannels.email` | Text + Toggle | Email address for notifications |
| `notificationChannels.sms` | Text + Toggle | Phone number for SMS |
| `notificationChannels.slack` | Text + Toggle | Slack channel/webhook |
| `notificationChannels.discord` | Text + Toggle | Discord webhook URL |
| `notificationChannels.webhook` | Text + Toggle | Custom webhook URL |
| `notificationChannels.push` | Toggle | Browser push notifications |
| `maxAutonomousTime` | Duration | How long to build unattended |
| `qualityFloor` | Number (0-100) | Wake if quality drops below |
| `costCeiling` | Currency | Wake if spending exceeds |
| `autoFixRetries` | Number | Retries per error before wake |
| `checkpointFrequency` | Duration | How often to save state |
| `pauseOnSecurityIssue` | Toggle | Wake for security findings |

**Tab System**:
- Dynamically shows tabs for:
  - "Builder View" (if Kriptoenite/multi-agent is running)
  - Each Feature Agent that has Ghost Mode enabled
- Each tab has its own configuration
- Can control Ghost Mode per-target independently

---

### B. Soft Interrupt Enhancement (ENHANCE EXISTING)

**Modify**: `src/components/builder/FloatingSoftInterrupt.tsx`

Add target selector dropdown that shows only what's currently running.

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚡ SOFT INTERRUPT                                        [−]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TARGET: [▼ Select target to interrupt________________]          │
│          ┌─────────────────────────────────────────────┐        │
│          │ ● Builder View (Kriptoenite) - BUILDING     │        │
│          │ ● Feature Agent #1 - Auth Flow - RUNNING    │        │
│          │ ● Feature Agent #2 - Dashboard - RUNNING    │        │
│          │ ○ Feature Agent #3 - API Routes - IDLE      │ (hidden)│
│          └─────────────────────────────────────────────┘        │
│                                                                  │
│  [HALT] [Urgent] [Undo] [Redirect] [Add Info] [Clarify] [Later] │
│                                                                  │
│  Message: [Type your interrupt message...________________]       │
│                                                         [Send →] │
└─────────────────────────────────────────────────────────────────┘
```

**Changes Needed**:

```tsx
// Add to FloatingSoftInterrupt.tsx

interface InterruptTarget {
  id: string;
  type: 'builder' | 'feature-agent';
  name: string;
  status: 'running' | 'idle' | 'paused' | 'completed';
  featureAgentId?: string;
}

// Fetch running targets
const { data: runningTargets } = useRunningTargets();

// Filter to only show running targets
const availableTargets = runningTargets?.filter(t => t.status === 'running') || [];

// Add target selector before interrupt type grid
<div className="floating-interrupt__target-selector">
  <label>TARGET:</label>
  <select
    value={selectedTarget?.id || ''}
    onChange={(e) => setSelectedTarget(availableTargets.find(t => t.id === e.target.value))}
  >
    <option value="">Select target to interrupt...</option>
    {availableTargets.map(target => (
      <option key={target.id} value={target.id}>
        {target.type === 'builder' ? '● Builder View (Kriptoenite)' : `● Feature Agent - ${target.name}`}
        {' - '}{target.status.toUpperCase()}
      </option>
    ))}
  </select>
</div>
```

**Backend Hook**:
```tsx
// src/hooks/useRunningTargets.ts
export function useRunningTargets() {
  const { data: builderStatus } = useBuilderStatus();
  const { data: featureAgents } = useFeatureAgentTiles();

  const targets: InterruptTarget[] = [];

  // Add builder if running
  if (builderStatus?.isBuilding) {
    targets.push({
      id: 'builder',
      type: 'builder',
      name: 'Kriptoenite Multi-Agent',
      status: 'running',
    });
  }

  // Add running feature agents
  featureAgents?.forEach(agent => {
    if (agent.status === 'running') {
      targets.push({
        id: agent.id,
        type: 'feature-agent',
        name: agent.name,
        status: 'running',
        featureAgentId: agent.id,
      });
    }
  });

  return { data: targets };
}
```

---

### C. Integrations Panel (COMPLETE REWRITE)

**Modify**: `src/components/developer-bar/panels/IntegrationsPanel.tsx`

Replace mock data with REAL integration configurations.

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔌 INTEGRATIONS                                           [×]      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Select a project: [▼ My E-commerce App_____________________]       │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                      │
│  🔎 Search integrations...                                          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  STRIPE                                           [+ INSTALL]  │ │
│  │  Payment processing                                            │ │
│  │  Required env vars: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, │ │
│  │                     STRIPE_WEBHOOK_SECRET                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  SUPABASE                                        [✓ INSTALLED] │ │
│  │  Backend as a Service                                          │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │ SUPABASE_URL:        [https://xxx.supabase.co__________] │  │ │
│  │  │ SUPABASE_ANON_KEY:   [eyJhbGciOiJIUzI1NiIs...___________] │  │ │
│  │  │ SUPABASE_SERVICE_KEY:[eyJhbGciOiJIUzI1NiIs...___________] │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                              [Save] [Remove]   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  OPENAI                                          [+ INSTALL]   │ │
│  │  AI/ML APIs                                                    │ │
│  │  Required env vars: OPENAI_API_KEY                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  RESEND                                          [+ INSTALL]   │ │
│  │  Email delivery                                                │ │
│  │  Required env vars: RESEND_API_KEY                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [Show more integrations...]                                        │
└─────────────────────────────────────────────────────────────────────┘
```

**REAL Integration Definitions**:

```tsx
// src/data/integrations.ts

export interface IntegrationDefinition {
  id: string;
  name: string;
  description: string;
  category: 'payments' | 'database' | 'auth' | 'email' | 'ai' | 'storage' | 'analytics' | 'messaging';
  icon: string;
  npmPackages: string[];  // Packages to install
  envVariables: Array<{
    name: string;
    description: string;
    required: boolean;
    placeholder: string;
    sensitive: boolean;  // Hide value
    helpUrl?: string;    // Link to get this key
  }>;
  setupInstructions?: string;
  docsUrl: string;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing for internet businesses',
    category: 'payments',
    icon: 'stripe',
    npmPackages: ['stripe', '@stripe/stripe-js', '@stripe/react-stripe-js'],
    envVariables: [
      {
        name: 'STRIPE_SECRET_KEY',
        description: 'Server-side secret key',
        required: true,
        placeholder: 'sk_live_...',
        sensitive: true,
        helpUrl: 'https://dashboard.stripe.com/apikeys',
      },
      {
        name: 'STRIPE_PUBLISHABLE_KEY',
        description: 'Client-side publishable key',
        required: true,
        placeholder: 'pk_live_...',
        sensitive: false,
        helpUrl: 'https://dashboard.stripe.com/apikeys',
      },
      {
        name: 'STRIPE_WEBHOOK_SECRET',
        description: 'Webhook signing secret',
        required: false,
        placeholder: 'whsec_...',
        sensitive: true,
        helpUrl: 'https://dashboard.stripe.com/webhooks',
      },
    ],
    docsUrl: 'https://stripe.com/docs',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Open source Firebase alternative with PostgreSQL',
    category: 'database',
    icon: 'supabase',
    npmPackages: ['@supabase/supabase-js'],
    envVariables: [
      {
        name: 'SUPABASE_URL',
        description: 'Your Supabase project URL',
        required: true,
        placeholder: 'https://xxx.supabase.co',
        sensitive: false,
        helpUrl: 'https://app.supabase.com/project/_/settings/api',
      },
      {
        name: 'SUPABASE_ANON_KEY',
        description: 'Anonymous/public key for client-side',
        required: true,
        placeholder: 'eyJhbGciOiJIUzI1NiIs...',
        sensitive: false,
        helpUrl: 'https://app.supabase.com/project/_/settings/api',
      },
      {
        name: 'SUPABASE_SERVICE_ROLE_KEY',
        description: 'Service role key for server-side (never expose to client)',
        required: false,
        placeholder: 'eyJhbGciOiJIUzI1NiIs...',
        sensitive: true,
        helpUrl: 'https://app.supabase.com/project/_/settings/api',
      },
    ],
    docsUrl: 'https://supabase.com/docs',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'AI models including GPT-4, DALL-E, and Whisper',
    category: 'ai',
    icon: 'openai',
    npmPackages: ['openai'],
    envVariables: [
      {
        name: 'OPENAI_API_KEY',
        description: 'Your OpenAI API key',
        required: true,
        placeholder: 'sk-...',
        sensitive: true,
        helpUrl: 'https://platform.openai.com/api-keys',
      },
      {
        name: 'OPENAI_ORG_ID',
        description: 'Organization ID (optional)',
        required: false,
        placeholder: 'org-...',
        sensitive: false,
        helpUrl: 'https://platform.openai.com/account/organization',
      },
    ],
    docsUrl: 'https://platform.openai.com/docs',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude AI models for safe, helpful AI',
    category: 'ai',
    icon: 'anthropic',
    npmPackages: ['@anthropic-ai/sdk'],
    envVariables: [
      {
        name: 'ANTHROPIC_API_KEY',
        description: 'Your Anthropic API key',
        required: true,
        placeholder: 'sk-ant-...',
        sensitive: true,
        helpUrl: 'https://console.anthropic.com/settings/keys',
      },
    ],
    docsUrl: 'https://docs.anthropic.com',
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Email API for developers',
    category: 'email',
    icon: 'resend',
    npmPackages: ['resend'],
    envVariables: [
      {
        name: 'RESEND_API_KEY',
        description: 'Your Resend API key',
        required: true,
        placeholder: 're_...',
        sensitive: true,
        helpUrl: 'https://resend.com/api-keys',
      },
    ],
    docsUrl: 'https://resend.com/docs',
  },
  {
    id: 'clerk',
    name: 'Clerk',
    description: 'Complete user management and authentication',
    category: 'auth',
    icon: 'clerk',
    npmPackages: ['@clerk/nextjs', '@clerk/themes'],
    envVariables: [
      {
        name: 'CLERK_PUBLISHABLE_KEY',
        description: 'Frontend publishable key',
        required: true,
        placeholder: 'pk_live_...',
        sensitive: false,
        helpUrl: 'https://dashboard.clerk.com/last-active?path=api-keys',
      },
      {
        name: 'CLERK_SECRET_KEY',
        description: 'Backend secret key',
        required: true,
        placeholder: 'sk_live_...',
        sensitive: true,
        helpUrl: 'https://dashboard.clerk.com/last-active?path=api-keys',
      },
    ],
    docsUrl: 'https://clerk.com/docs',
  },
  {
    id: 'aws-s3',
    name: 'AWS S3',
    description: 'Object storage service',
    category: 'storage',
    icon: 'aws',
    npmPackages: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
    envVariables: [
      {
        name: 'AWS_ACCESS_KEY_ID',
        description: 'AWS access key',
        required: true,
        placeholder: 'AKIA...',
        sensitive: true,
        helpUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials',
      },
      {
        name: 'AWS_SECRET_ACCESS_KEY',
        description: 'AWS secret key',
        required: true,
        placeholder: '...',
        sensitive: true,
        helpUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials',
      },
      {
        name: 'AWS_REGION',
        description: 'AWS region (e.g., us-east-1)',
        required: true,
        placeholder: 'us-east-1',
        sensitive: false,
      },
      {
        name: 'AWS_S3_BUCKET',
        description: 'S3 bucket name',
        required: true,
        placeholder: 'my-bucket',
        sensitive: false,
      },
    ],
    docsUrl: 'https://docs.aws.amazon.com/s3/',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS, voice, and messaging APIs',
    category: 'messaging',
    icon: 'twilio',
    npmPackages: ['twilio'],
    envVariables: [
      {
        name: 'TWILIO_ACCOUNT_SID',
        description: 'Account SID',
        required: true,
        placeholder: 'AC...',
        sensitive: false,
        helpUrl: 'https://console.twilio.com/',
      },
      {
        name: 'TWILIO_AUTH_TOKEN',
        description: 'Auth token',
        required: true,
        placeholder: '...',
        sensitive: true,
        helpUrl: 'https://console.twilio.com/',
      },
      {
        name: 'TWILIO_PHONE_NUMBER',
        description: 'Your Twilio phone number',
        required: true,
        placeholder: '+1234567890',
        sensitive: false,
      },
    ],
    docsUrl: 'https://www.twilio.com/docs',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Frontend cloud platform',
    category: 'analytics',
    icon: 'vercel',
    npmPackages: ['@vercel/analytics', '@vercel/speed-insights'],
    envVariables: [
      {
        name: 'VERCEL_TOKEN',
        description: 'Vercel API token (for deployments)',
        required: false,
        placeholder: '...',
        sensitive: true,
        helpUrl: 'https://vercel.com/account/tokens',
      },
    ],
    docsUrl: 'https://vercel.com/docs',
  },
  {
    id: 'posthog',
    name: 'PostHog',
    description: 'Product analytics and feature flags',
    category: 'analytics',
    icon: 'posthog',
    npmPackages: ['posthog-js', 'posthog-node'],
    envVariables: [
      {
        name: 'POSTHOG_KEY',
        description: 'PostHog project API key',
        required: true,
        placeholder: 'phc_...',
        sensitive: false,
        helpUrl: 'https://app.posthog.com/project/settings',
      },
      {
        name: 'POSTHOG_HOST',
        description: 'PostHog host URL',
        required: false,
        placeholder: 'https://app.posthog.com',
        sensitive: false,
      },
    ],
    docsUrl: 'https://posthog.com/docs',
  },
];
```

**Install Flow**:

```tsx
// When user clicks "Install"
async function handleInstall(integration: IntegrationDefinition, targetProjectId: string) {
  // 1. Install npm packages to the project
  await installPackages(targetProjectId, integration.npmPackages);

  // 2. Show env variable input form
  setShowEnvForm(true);
  setCurrentIntegration(integration);

  // 3. After user fills env vars, save to project
  // Uses existing credential vault system
}

// When user saves env vars
async function handleSaveEnvVars(integration: IntegrationDefinition, values: Record<string, string>) {
  // Save to project's .env file AND credential vault
  await saveProjectEnvVars(targetProjectId, values);
  await saveToCredentialVault(integration.id, values);
}
```

---

### D. Voice Architect Enhancement (ENHANCE EXISTING)

**Modify**: `src/components/voice/VoiceArchitectPanel.tsx`

Add real-time conversation capability with natural pacing.

**New Features**:

```tsx
// Add to VoiceArchitectPanel.tsx

interface VoiceArchitectEnhancements {
  // Conversation mode
  conversationMode: 'command' | 'natural';  // natural = real-time back-and-forth

  // Real-time streaming
  streamingEnabled: boolean;

  // Response timing
  responseDelay: number;  // ms before agent responds (natural pacing)

  // Voice settings
  voiceSpeed: number;  // 0.5 - 2.0
  voicePitch: number;  // 0.5 - 2.0

  // Actions
  allowRealTimeModifications: boolean;  // Make code changes as user speaks
  autoApplyChanges: boolean;  // Apply without confirmation
}

// Configuration UI
<VoiceSettings>
  <ToggleOption
    label="Natural Conversation Mode"
    description="Speak naturally, agent responds in real-time"
    value={settings.conversationMode === 'natural'}
    onChange={(v) => setSettings({ ...settings, conversationMode: v ? 'natural' : 'command' })}
  />

  <ToggleOption
    label="Real-Time Modifications"
    description="Agent makes code changes as you speak"
    value={settings.allowRealTimeModifications}
    onChange={(v) => setSettings({ ...settings, allowRealTimeModifications: v })}
  />

  <SliderOption
    label="Voice Speed"
    min={0.5}
    max={2.0}
    step={0.1}
    value={settings.voiceSpeed}
    onChange={(v) => setSettings({ ...settings, voiceSpeed: v })}
  />
</VoiceSettings>
```

---

### E. Notifications Enhancement (ADD QUICK ACCESS)

**Add**: Quick access indicator in Developer Bar

```tsx
// In DeveloperBar.tsx, add notification indicator

// Add near the top of the toolbar
<NotificationIndicator
  unreadCount={unreadNotifications}
  onClick={() => {
    // Open notifications panel or navigate to dashboard
    if (isInBuilder) {
      openNotificationsOverlay();
    } else {
      navigate('/dashboard#notifications');
    }
  }}
/>

// NotificationIndicator component
function NotificationIndicator({ unreadCount, onClick }) {
  return (
    <button className="notification-indicator" onClick={onClick}>
      <IconBell size={16} />
      {unreadCount > 0 && (
        <span className="notification-badge">{unreadCount}</span>
      )}
    </button>
  );
}
```

---

## DO NOT IMPLEMENT (Already Handled)

| Feature | Why Skip |
|---------|----------|
| **Tournament Mode Button** | Automatic system - no user config needed |
| **Quality Check Button** | Handled by Verification Swarm (6 agents) |
| **Credential Vault Button** | Use Integrations panel instead |
| **New Notification Panel** | Already on Dashboard, just add indicator |

---

## Phase 1: 3D Visualization Library

### P1.1: Core 3D Components

Create shared components for all premium panels:

**Directory**: `src/components/visualizations/3d/`

| Component | Purpose | Used By |
|-----------|---------|---------|
| `Bar3DChart.tsx` | 3D bar chart with perspective | Health, Quality, Performance |
| `SplattingViz.tsx` | Particle clustering | Learning, User patterns |
| `NeuralNetworkViz.tsx` | Node/connection graph | Memory, Learning Engine |
| `TimelineViz3D.tsx` | 3D timeline scrubber | Time Machine, Ghost History |
| `RadarChart3D.tsx` | 3D radar/spider chart | Anti-Slop, Quality scores |
| `GaugeCluster3D.tsx` | Multiple 3D gauges | System Health, Performance |
| `FlowGraph3D.tsx` | Pipeline visualization | Build progress, Error escalation |
| `LiveStream3D.tsx` | Real-time data stream | Live metrics, Debug |

### P1.2: Shared CSS

**File**: `src/components/visualizations/3d/viz-3d.css`

(Include full CSS from original plan)

---

## Phase 2: Premium Panel Implementations

### P2.1: Memory/Learning Panel 3D

**File**: `src/components/developer-bar/panels/MemoryPanel3D.tsx`

- 3D neural network visualization of learned patterns
- Splatting viz for experience categories
- Real-time learning cycle indicator
- Pattern library browser

**Backend**: `/api/learning/*`

### P2.2: Live Health Panel 3D

**File**: `src/components/developer-bar/panels/LiveHealthPanel3D.tsx`

- 3D gauge cluster (CPU, Memory, API latency, Error rate)
- Real-time SSE streaming
- Alert thresholds with visual warnings
- Historical trend mini-charts

**Backend**: `/api/monitoring/health`, SSE stream

### P2.3: Predictive Engine Panel 3D

**File**: `src/components/developer-bar/panels/PredictivePanel3D.tsx`

- 3D bar chart of prediction confidences
- Error prevention stats
- Pattern match visualization
- Pre-generation queue status

**Backend**: existing `ai/predictive-error-prevention.ts`

### P2.4: AI-Slop Catch Panel 3D

**File**: `src/components/developer-bar/panels/AntiSlopPanel3D.tsx`

- 3D radar chart of 7 anti-slop principles
- Violation history timeline
- Current scan results
- Configuration toggles for each rule

**Backend**: existing `verification/anti-slop-detector.ts`

### P2.5: Self-Heal Panel 3D

**File**: `src/components/developer-bar/panels/SelfHealPanel3D.tsx`

- 3D escalation ladder visualization (4 levels)
- Current error status
- Fix attempt history
- Success rate gauges

**Backend**: existing `automation/error-escalation.ts`

### P2.6: Debug Panel 3D

**File**: `src/components/developer-bar/panels/DebugPanel3D.tsx`

- 3D call stack visualization
- Variable state tree
- Runtime context viewer
- Breakpoint visualization

**Backend**: existing `debug/runtime-debug-context.ts`

### P2.7: Database Panel 3D

**File**: `src/components/developer-bar/panels/DatabasePanel3D.tsx`

- 3D schema visualization
- Table relationships graph
- Query performance metrics
- Migration history

**Backend**: schema introspection

### P2.8: Deployment Panel 3D

**File**: `src/components/developer-bar/panels/DeploymentPanel3D.tsx`

- 3D deployment pipeline visualization
- Environment status (dev/staging/prod)
- Deploy history
- Rollback options

**Backend**: existing `deployment/`, `smart-deploy.ts`

### P2.9: Security Panel 3D

**File**: `src/components/developer-bar/panels/SecurityPanel3D.tsx`

- 3D vulnerability radar
- Security scan results
- Compliance status
- Threat detection alerts

**Backend**: existing `security.ts`

---

## Phase 3: Wiring & Integration

### P3.1: Update DeveloperBarPanel.tsx

Replace GenericPanel references with new premium panels:

```tsx
const FEATURE_PANELS: Record<string, PanelConfig> = {
  // Existing working panels - KEEP AS IS
  'feature-agent': { component: FeatureAgentCommandCenterWrapper, fullWidth: true },
  'time-machine': { component: TimeMachinePanel },
  'clone-mode': { component: CloneModePanel },
  'market-fit': { component: MarketFitDashboard },
  'voice-first': { component: VoiceArchitectPanel },  // Enhanced
  'api-autopilot': { component: APIAutopilotPanel },

  // NEW: Ghost Mode dedicated panel
  'ghost-mode': { component: GhostModeControlPanel, fullWidth: true },

  // UPGRADED: 3D Premium Panels
  'memory': { component: MemoryPanel3D },
  'integrations': { component: IntegrationsPanel },  // Rewritten
  'live-health': { component: LiveHealthPanel3D },
  'predictive-engine': { component: PredictivePanel3D },
  'ai-slop-catch': { component: AntiSlopPanel3D },
  'self-heal': { component: SelfHealPanel3D },
  'live-debug': { component: DebugPanel3D },
  'database': { component: DatabasePanel3D },
  'deployment': { component: DeploymentPanel3D },
  'zero-trust-sec': { component: SecurityPanel3D },

  // Note: quality-check uses verification swarm - no separate panel needed
};
```

### P3.2: Add Ghost Mode Button to Toolbar

```tsx
// In DeveloperBar.tsx FEATURE_BUTTONS array, add:
{ id: 'ghost-mode', name: 'Ghost Mode', icon: 'ghost', category: 'core' },
```

### P3.3: SSE Hooks for Real-Time Data

**File**: `src/hooks/useRealtimeData.ts`

```tsx
export function useHealthStream() {
  // SSE connection to /api/monitoring/stream
}

export function useLearningStream() {
  // SSE connection to /api/learning/stream
}

export function useRunningTargets() {
  // Real-time list of running builder/feature agents
}

export function useGhostModeStatus() {
  // SSE connection to /api/ghost-mode/status
}
```

---

## Implementation Order

### Week 1: Core Infrastructure
1. **P1.1**: Create 3D visualization library components
2. **P1.2**: Add shared CSS/styling
3. **Ghost Mode Panel**: Full implementation with tabs
4. **Soft Interrupt Enhancement**: Add target selector

### Week 2: Premium Panels (Part 1)
5. **Integrations Panel**: Complete rewrite with real env vars
6. **Memory/Learning Panel 3D**
7. **Live Health Panel 3D**
8. **Voice Architect Enhancement**

### Week 3: Premium Panels (Part 2)
9. **Predictive Engine Panel 3D**
10. **AI-Slop Catch Panel 3D**
11. **Self-Heal Panel 3D**
12. **Debug Panel 3D**

### Week 4: Final Panels & Polish
13. **Database Panel 3D**
14. **Deployment Panel 3D**
15. **Security Panel 3D**
16. **SSE hooks & real-time wiring**
17. Testing & polish

---

## Success Criteria

- [ ] Ghost Mode has dedicated toolbar button with full config panel
- [ ] Ghost Mode panel has tabs for Builder View + each Feature Agent
- [ ] Soft Interrupt shows target selector with only running targets
- [ ] Integrations shows REAL env variables (not mock)
- [ ] Integrations has "Click to Install" with project selector
- [ ] Voice Architect has natural conversation mode
- [ ] All panels have premium 3D visualizations
- [ ] Real-time data streaming via SSE
- [ ] No redundant features created
- [ ] Tournament Mode has NO button (automatic system)
- [ ] Quality Check uses Verification Swarm (no separate button)

---

## DO NOT CREATE (Already Exists & Working)

| Component | Location | Status |
|-----------|----------|--------|
| FloatingSoftInterrupt | Builder view (floating) | ENHANCE only |
| NotificationsSection | Dashboard | Keep, add indicator |
| GhostModeConfig | Feature Agent Command Center | Keep, ALSO add dedicated panel |
| FeatureAgentCommandCenter | Developer toolbar | Keep as is |
| SpeedDialSelector | Builder | Keep as is |
| TournamentPanel | Builder | Keep as is (NO button needed) |
| VerificationSwarm3D | Builder | Keep as is |
| TimeMachinePanel | Developer toolbar | Keep as is |
| CloneModePanel | Developer toolbar | Keep as is |
| MarketFitDashboard | Developer toolbar | Keep as is |
| VoiceArchitectPanel | Developer toolbar | ENHANCE only |
| APIAutopilotPanel | Developer toolbar | Keep as is |
| CredentialVault page | /credentials | Keep (use Integrations panel) |

---

*This plan implements premium 3D panels with FULL configuration options and proper integration.*
