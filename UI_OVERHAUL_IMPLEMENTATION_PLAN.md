# KripTik AI - UI Overhaul Implementation Plan

## Overview

This document provides detailed implementation specifications for overhauling the KripTik AI frontend to match the intended feature capabilities and provide a premium $2k app experience.

---

## Design System Foundation

### Color Palette

```css
:root {
  /* Primary Dark Glass */
  --glass-dark-bg: linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%);
  --glass-dark-border: rgba(255,255,255,0.08);
  --glass-dark-border-hover: rgba(255,255,255,0.15);

  /* Light Glass */
  --glass-light-bg: linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%);
  --glass-light-border: rgba(255,255,255,0.4);

  /* Accent Colors */
  --accent-primary: #c8ff64;        /* Fluorescent Yellow-Green */
  --accent-primary-glow: rgba(200,255,100,0.15);
  --accent-warm: #ff9b64;           /* Warm Orange */
  --accent-warm-glow: rgba(255,155,100,0.15);

  /* Status Colors */
  --status-success: #10b981;        /* Emerald */
  --status-warning: #f59e0b;        /* Amber */
  --status-error: #f43f5e;          /* Rose */
  --status-info: #3b82f6;           /* Blue */

  /* Text Colors */
  --text-primary: rgba(255,255,255,0.95);
  --text-secondary: rgba(255,255,255,0.70);
  --text-muted: rgba(255,255,255,0.40);

  /* Backdrop */
  --backdrop-blur: blur(40px) saturate(180%);
}
```

### Typography

```css
/* Headings - Use distinctive fonts, NOT Inter/Roboto */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-heading: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

h1 { font-weight: 700; letter-spacing: -0.02em; }
h2 { font-weight: 600; letter-spacing: -0.01em; }
h3 { font-weight: 600; }
```

---

## Feature-by-Feature Implementation Specifications

---

### 1. GHOST MODE - Complete Configuration Panel

**File:** `src/components/builder/GhostModePanel.tsx`

**Current State:** Basic task list, simple wake conditions, non-functional notification buttons

**Required Configuration Options:**

#### 1.1 Task Queue Management
```tsx
interface GhostModeConfig {
  // Task Queue
  tasks: {
    id: string;
    description: string;
    priority: 1 | 2 | 3;  // High, Medium, Low
    estimatedCredits: number;
    dependencies: string[];  // Task IDs
    assignedAgentType?: AgentType;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  }[];

  // Wake Conditions
  wakeConditions: {
    id: string;
    type: WakeConditionType;
    logic: 'AND' | 'OR';  // For combining conditions
    threshold?: number;
    channels: NotificationChannel[];
    priority: 'critical' | 'high' | 'normal' | 'low';
    customMessage?: string;
  }[];

  // Runtime Configuration
  runtime: {
    maxDuration: number;       // minutes (10-480)
    maxCredits: number;        // dollar limit
    checkpointInterval: number; // minutes (5-60)
    autonomyLevel: 'conservative' | 'moderate' | 'aggressive';
    pauseOnFirstError: boolean;
  };

  // Notification Configuration - CRITICAL
  notifications: {
    email: {
      enabled: boolean;
      address: string;
      verified: boolean;  // MUST be verified before enabling
    };
    sms: {
      enabled: boolean;
      phoneNumber: string;
      verified: boolean;  // Requires Twilio integration
      provider: 'twilio';
    };
    slack: {
      enabled: boolean;
      webhookUrl: string;
      verified: boolean;  // Test ping before enabling
      channel: string;
    };
    discord: {
      enabled: boolean;
      webhookUrl: string;
      verified: boolean;
    };
    push: {
      enabled: boolean;
      subscription: PushSubscription | null;
    };
  };

  // Session Settings
  session: {
    name: string;
    template?: string;  // Load from saved template
    autoResumeOnReconnect: boolean;
  };
}
```

#### 1.2 UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ 👻 Ghost Mode                                    [Settings] [?] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── Active Session ─────────────────────────────────────────┐ │
│  │ Running • 2h 34m • 47 credits used                         │ │
│  │ ████████████████████████░░░░░░░░  65% complete             │ │
│  │ Current: Implementing user authentication                   │ │
│  │                                                             │ │
│  │ [Pause] [Stop] [View Progress]                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ─── OR ─── Start New Session ─────────────────────────────────  │
│                                                                 │
│  📋 TASK QUEUE                                     [+ Add Task] │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ≡ 1. Build authentication system              [High] ⓧ      │ │
│  │     Est: ~$0.35 • Depends on: none                          │ │
│  │ ≡ 2. Create dashboard layout                  [High] ⓧ      │ │
│  │     Est: ~$0.25 • Depends on: #1                            │ │
│  │ ≡ 3. Implement data visualization            [Medium] ⓧ    │ │
│  │     Est: ~$0.45 • Depends on: #2                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  🔔 WAKE CONDITIONS                           [+ Add Condition] │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ✅ On completion        → Email, Push                       │ │
│  │ ⚠️ On any error        → Email, SMS, Slack                  │ │
│  │ 💰 Credits > $50       → Email                              │ │
│  │ ⏱️ Runtime > 2 hours   → Push                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📱 NOTIFICATION CHANNELS                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ✅ Email: logan@example.com           [Verified] [Test]     │ │
│  │ ❌ SMS: Not configured                 [Set Up]             │ │
│  │ ✅ Slack: #kriptik-alerts             [Verified] [Test]     │ │
│  │ ❌ Discord: Not configured             [Set Up]             │ │
│  │ ✅ Push: Browser notifications         [Enabled]            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ⚙️ RUNTIME SETTINGS                                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Max Duration: [  2 hours ▼ ]  Max Credits: [ $100 ▼ ]       │ │
│  │                                                             │ │
│  │ Checkpoint Interval: [ 15 min ▼ ]                           │ │
│  │                                                             │ │
│  │ Autonomy Level:                                             │ │
│  │ [Conservative] [◉ Moderate] [Aggressive]                    │ │
│  │ ℹ️ Moderate: AI makes routine decisions, alerts on major    │ │
│  │                                                             │ │
│  │ ☑️ Pause on first error                                     │ │
│  │ ☑️ Auto-resume on reconnect                                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│         [👻 Start Ghost Mode Session]                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.3 Critical Implementation Notes

**Notification Channel Verification Flow:**

```tsx
// When user enables a notification channel, MUST verify first
const handleEnableNotificationChannel = async (
  channel: NotificationChannel,
  config: ChannelConfig
) => {
  // Step 1: Validate input
  if (channel === 'email' && !isValidEmail(config.address)) {
    setError('Please enter a valid email address');
    return;
  }

  // Step 2: Send verification
  const result = await api.post('/api/ghost-mode/notifications/verify', {
    channel,
    config
  });

  if (channel === 'email') {
    // Show: "Verification email sent! Check your inbox and click the link."
    showVerificationPendingUI(channel);
  } else if (channel === 'sms') {
    // Show: OTP input for SMS verification
    showOTPInput(channel, result.data.codeSent);
  } else if (channel === 'slack' || channel === 'discord') {
    // Test webhook automatically
    const testResult = await api.post('/api/ghost-mode/notifications/test', {
      channel,
      webhookUrl: config.webhookUrl
    });
    if (testResult.success) {
      showSuccess('Webhook verified! A test message was sent.');
    }
  }

  // Step 3: Only enable after verification succeeds
  // The enable toggle should be DISABLED until verified
};
```

---

### 2. DEVELOPER MODE SETTINGS - Complete Panel

**File:** `src/components/settings/DeveloperModeSettings.tsx`

**Current Issues:**
- Rules import uses `prompt()` instead of file picker
- No learning patterns shown
- Verification mode doesn't show time/cost estimates
- No access button in main UI

**Required Enhancements:**

#### 2.1 Add Access Button to DeveloperModeView

```tsx
// In src/components/builder/DeveloperModeView.tsx header:
<div className="flex items-center gap-2">
  {/* Existing model selector */}
  <ModelSelector />

  {/* ADD: Settings button - ALWAYS VISIBLE */}
  <button
    onClick={() => setSettingsOpen(true)}
    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
    style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}
    title="Developer Mode Settings"
  >
    <Settings className="w-4 h-4" style={{ color: '#c8ff64' }} />
  </button>
</div>

{/* Render settings modal */}
<DeveloperModeSettings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
```

#### 2.2 Enhanced Tabs

**Tab 1: Defaults** (exists, enhance)
```tsx
// Add pricing info to model cards
const MODELS = [
  {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    description: 'Best reasoning, complex tasks',
    cost: '$0.015 / 1K tokens',  // ADD
    speed: 'Slowest',           // ADD
    recommended: 'Complex features, debugging',  // ADD
  },
  // ...
];

// Add time/cost estimates to verification modes
const VERIFICATION_MODES = [
  {
    id: 'quick',
    name: 'Quick',
    description: 'Build + lint only',
    time: '~10 seconds',      // ADD
    creditCost: '~$0.01',     // ADD
    checks: ['Build', 'Lint'], // ADD
  },
  // ...
];
```

**Tab 2: Project Rules** (enhance)
```tsx
// Replace prompt() with proper file picker
const handleImportRules = async (type: 'cursorrules' | 'clinerules') => {
  // Use file input element instead of prompt()
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.cursorrules,.clinerules,.md,.txt';

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const content = await file.text();
      setProjectRules(prev => ({
        ...prev,
        rulesContent: content,
      }));
      showSuccess(`Imported ${file.name}`);
    }
  };

  input.click();
};
```

**Tab 3: My Rules** (enhance)
```tsx
// Add learned patterns section
<div className="space-y-4">
  <h4 className="text-sm font-medium text-white/80">Learned Patterns</h4>
  <p className="text-xs text-white/40">
    Patterns learned from your feedback are automatically applied to agents.
  </p>

  {learnedPatterns.map(pattern => (
    <div
      key={pattern.id}
      className="p-3 rounded-lg border border-white/10 flex items-center justify-between"
    >
      <div>
        <p className="text-sm text-white/90">{pattern.name}</p>
        <p className="text-xs text-white/40">{pattern.appliedCount} times</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => pinPattern(pattern.id)}>
          <Pin className="w-4 h-4" />
        </button>
        <button onClick={() => deletePattern(pattern.id)}>
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  ))}
</div>
```

**Tab 5: Notifications** (enhance)
```tsx
// Add delivery channel configuration
<div className="space-y-4">
  <h4>Notification Delivery</h4>
  <p className="text-xs text-white/40">
    How should we notify you? Configure at least one channel.
  </p>

  <div className="space-y-2">
    {notificationChannels.map(channel => (
      <NotificationChannelConfig
        key={channel.id}
        channel={channel}
        onConfigure={handleConfigureChannel}
        onTest={handleTestChannel}
      />
    ))}
  </div>
</div>
```

---

### 3. TIME MACHINE BROWSER - New Component

**File:** `src/components/builder/TimeMachineBrowser.tsx` (NEW)

**Backend already exists at:**
- `GET /api/checkpoints/{projectId}` - list checkpoints
- `POST /api/checkpoints/{checkpointId}/restore`
- `GET /api/checkpoints/{checkpointId}/diff`

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ⏱️ Time Machine                                        [✕ Close]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filter: [All ▼]  [Last 24h ▼]     Storage: 245 MB / 1 GB      │
│                                                                 │
│  ────────────────── Timeline ─────────────────────────────────  │
│                                                                 │
│  │                                                              │
│  │  ⬤ Today, 3:45 PM                          [Preview] [↺]   │
│  │  │ Feature complete: User authentication                    │
│  │  │ Quality: 92/100 • Files: 47 • Commit: a3f4d21            │
│  │  │                                                          │
│  │  ⬤ Today, 2:12 PM                          [Preview] [↺]   │
│  │  │ Manual checkpoint                                        │
│  │  │ Quality: 88/100 • Files: 42                              │
│  │  │                                                          │
│  │  ⬤ Today, 1:30 PM                          [Preview] [↺]   │
│  │  │ Auto checkpoint (15 min interval)                        │
│  │  │ Quality: 85/100 • Files: 38                              │
│  │  │                                                          │
│  │  ⬤ Today, 12:45 PM                         [Preview] [↺]   │
│  │  │ Verification passed: All 6 agents                        │
│  │  │ Quality: 95/100 • Files: 35                              │
│  │  │                                                          │
│  │  ○ Yesterday, 11:30 PM                                      │
│  │  │ Session ended                                            │
│  │                                                              │
│  └──────────────────────────────────────────────────────────    │
│                                                                 │
│  ────────────────── Selected Checkpoint ──────────────────────  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Today, 3:45 PM • Feature complete: User authentication      │ │
│  │                                                             │ │
│  │ Quality Scores:                                             │ │
│  │ Code: 94  Visual: 90  Security: 92  Overall: 92            │ │
│  │                                                             │ │
│  │ Changes from current: +12 files, -3 files, 847 lines        │ │
│  │                                                             │ │
│  │ [View Diff] [Restore to This Point] [Download ZIP]          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```tsx
// src/components/builder/TimeMachineBrowser.tsx
export function TimeMachineBrowser({ projectId, isOpen, onClose }: Props) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [filter, setFilter] = useState<'all' | '24h' | '7d'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchCheckpoints();
    }
  }, [isOpen, projectId]);

  const fetchCheckpoints = async () => {
    const response = await apiClient.get(`/api/checkpoints/${projectId}`);
    setCheckpoints(response.data.checkpoints);
    setLoading(false);
  };

  const handleRestore = async (checkpointId: string) => {
    const confirmed = await showConfirmationDialog({
      title: 'Restore to Checkpoint?',
      message: 'This will replace your current project state. You can undo by restoring to another checkpoint.',
      confirmText: 'Restore',
      cancelText: 'Cancel',
    });

    if (confirmed) {
      await apiClient.post(`/api/checkpoints/${checkpointId}/restore`);
      showSuccess('Project restored to checkpoint');
      onClose();
    }
  };

  const handleViewDiff = async (checkpointId: string) => {
    const response = await apiClient.get(`/api/checkpoints/${checkpointId}/diff`);
    // Show diff modal
    setDiffData(response.data);
    setShowDiffModal(true);
  };

  // ... render
}
```

**Add Access Button:**

```tsx
// In Builder.tsx toolbar or DeveloperModeView header
<button
  onClick={() => setTimeMachineOpen(true)}
  className="p-2 rounded-lg hover:bg-white/10"
  title="Time Machine"
>
  <Clock className="w-4 h-4" />
</button>

<TimeMachineBrowser
  projectId={currentProject?.id}
  isOpen={timeMachineOpen}
  onClose={() => setTimeMachineOpen(false)}
/>
```

---

### 4. CREATE PR MODAL - New Component

**File:** `src/components/builder/CreatePRModal.tsx` (NEW)

**Backend exists at:**
- `POST /api/developer-mode/pr/create`
- `server/src/services/developer-mode/pr-integration.ts`

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔀 Create Pull Request                                  [✕]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Agent: Agent #1 - Build user authentication                    │
│  Branch: kriptik/agent-1-user-auth → main                       │
│  Files: +8 new, ~12 modified, 1,247 lines changed               │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Verification Results:                                          │
│  ✅ Build passed         ✅ Tests: 24/24                        │
│  ✅ Security: No issues  ✅ Visual: 94/100                      │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  PR Title:                                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ feat: Add user authentication system                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Description:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ## Summary                                                  │ │
│  │ Implements complete user authentication with:               │ │
│  │ - Email/password signup and login                          │ │
│  │ - Session management                                        │ │
│  │ - Protected routes                                          │ │
│  │                                                             │ │
│  │ ## Changes                                                  │ │
│  │ - `src/pages/LoginPage.tsx` (new)                          │ │
│  │ - `src/lib/auth.ts` (new)                                  │ │
│  │ - `server/src/routes/auth.ts` (new)                        │ │
│  │                                                             │ │
│  │ ## Verification                                             │ │
│  │ ✅ All checks passed                                        │ │
│  │                                                             │ │
│  │ ---                                                         │ │
│  │ Generated by KripTik AI Developer Mode                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Options:                                                       │
│  ☑️ Add before/after screenshots                                │
│  ☐ Request review from: [Select reviewers ▼]                    │
│  ☑️ Add labels: feature, ai-generated                           │
│  ☐ Auto-merge when checks pass                                  │
│                                                                 │
│                      [Cancel] [Merge Directly] [Create PR]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Wire to AgentSandboxPreview:**

```tsx
// In AgentSandboxPreview.tsx, find "Approve & Create PR" button
<button
  onClick={() => setShowCreatePRModal(true)}
  className="..."
>
  Approve & Create PR
</button>

<CreatePRModal
  isOpen={showCreatePRModal}
  onClose={() => setShowCreatePRModal(false)}
  agentId={selectedAgent.id}
  branchName={selectedAgent.branchName}
  verificationResults={selectedAgent.verificationResults}
/>
```

---

### 5. ORCHESTRATION PLAN VIEW - New Component

**File:** `src/components/builder/OrchestrationPlanView.tsx` (NEW)

**Backend exists at:**
- `GET /api/orchestrate/analyze`
- `POST /api/orchestrate/:projectId/execute`

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Execution Plan                                       [✕]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Your Prompt:                                                   │
│  "Build a full e-commerce site with user auth, product         │
│   catalog, shopping cart, and Stripe checkout"                  │
│                                                                 │
│  KripTik AI has decomposed this into 4 parallel agents:         │
│                                                                 │
│  ═══════════ WAVE 1 (Independent) ══════════════════════════    │
│                                                                 │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│  │ 🤖 Agent 1                  │ │ 🤖 Agent 2                  │ │
│  │ User Authentication         │ │ Product Catalog            │ │
│  │                             │ │                             │ │
│  │ Model: [Claude Sonnet ▼]    │ │ Model: [Claude Sonnet ▼]    │ │
│  │ Est: ~5 min, ~$0.35         │ │ Est: ~7 min, ~$0.45         │ │
│  │ Depends on: None            │ │ Depends on: None            │ │
│  │                      [Edit] │ │                      [Edit] │ │
│  └─────────────────────────────┘ └─────────────────────────────┘ │
│                                                                 │
│  ═══════════ WAVE 2 (After Wave 1) ═════════════════════════    │
│                                                                 │
│  ┌─────────────────────────────┐                                │
│  │ 🤖 Agent 3                  │                                │
│  │ Shopping Cart               │                                │
│  │                             │                                │
│  │ Model: [Claude Sonnet ▼]    │                                │
│  │ Est: ~6 min, ~$0.40         │                                │
│  │ Depends on: Agent 1, 2      │ ←─ User + Products needed     │
│  │                      [Edit] │                                │
│  └─────────────────────────────┘                                │
│                                                                 │
│  ═══════════ WAVE 3 (After Wave 2) ═════════════════════════    │
│                                                                 │
│  ┌─────────────────────────────┐                                │
│  │ 🤖 Agent 4                  │                                │
│  │ Stripe Checkout             │                                │
│  │                             │                                │
│  │ Model: [Claude Opus ▼]      │ ←─ Complex integration        │
│  │ Est: ~10 min, ~$0.85        │                                │
│  │ Depends on: Agent 3         │ ←─ Cart needed                │
│  │                      [Edit] │                                │
│  └─────────────────────────────┘                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Summary:                                                       │
│  • 4 agents across 3 waves                                      │
│  • Estimated time: 15-20 minutes                                │
│  • Estimated cost: ~$2.05                                       │
│                                                                 │
│  [Cancel] [+ Add Task] [Execute Plan] [⚡ Run All Parallel]     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Integration:**

```tsx
// In Builder.tsx or ChatInterface.tsx
// When user submits a complex prompt, show plan BEFORE executing

const handleSubmit = async (prompt: string) => {
  // Step 1: Analyze the prompt
  const analysis = await apiClient.post('/api/orchestrate/analyze', { prompt });

  // Step 2: If plan has multiple agents, show preview
  if (analysis.data.plan.agents.length > 1) {
    setOrchestrationPlan(analysis.data.plan);
    setShowPlanModal(true);
    return; // Don't execute yet
  }

  // Step 3: Single agent - execute immediately
  await executeTask(prompt);
};

// When user confirms plan
const handleExecutePlan = async (plan: OrchestrationPlan) => {
  setShowPlanModal(false);
  await apiClient.post(`/api/orchestrate/${projectId}/execute`, { plan });
  // Show build progress
};
```

---

### 6. BUILD PHASE INDICATOR - New Component

**File:** `src/components/builder/BuildPhaseIndicator.tsx` (NEW)

**Purpose:** Show users which phase of the 6-phase build loop they're in

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ○───●───○───○───○───○                                           │
│ Lock  Init  Build  Integrate  Test  Demo                        │
│              ↑                                                  │
│         Building feature 2/5                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```tsx
export function BuildPhaseIndicator({ currentPhase, totalFeatures, currentFeature }: Props) {
  const phases = [
    { id: 'intent_lock', label: 'Lock', icon: Lock },
    { id: 'initialization', label: 'Init', icon: Settings },
    { id: 'build', label: 'Build', icon: Code },
    { id: 'integration', label: 'Integrate', icon: Link },
    { id: 'test', label: 'Test', icon: TestTube },
    { id: 'demo', label: 'Demo', icon: Play },
  ];

  const currentIndex = phases.findIndex(p => p.id === currentPhase);

  return (
    <div className="flex items-center gap-2">
      {phases.map((phase, index) => {
        const Icon = phase.icon;
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={phase.id}>
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                isComplete && "bg-emerald-500",
                isCurrent && "bg-accent ring-2 ring-accent/50",
                !isComplete && !isCurrent && "bg-white/10"
              )}
            >
              {isComplete ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
            </div>
            {index < phases.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5",
                  isComplete ? "bg-emerald-500" : "bg-white/20"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
```

---

### 7. VERIFICATION SWARM STATUS - New Component

**File:** `src/components/builder/VerificationSwarmStatus.tsx` (NEW)

**Purpose:** Show users the 6 verification agents and their status

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Verification Swarm                              [Expand ▼]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ✅ Error Check   ✅ Code Quality   🔄 Visual       94/100       │
│ ✅ Security      ✅ Placeholders   ⏳ Design Style             │
│                                                                 │
│ Overall: Passing (5/6 complete)                                 │
└─────────────────────────────────────────────────────────────────┘

[Expanded View]
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Verification Swarm                              [Collapse △] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✅ Error Checker                               Passed       │ │
│ │    Last run: 5s ago • No errors found                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✅ Code Quality                                Score: 92    │ │
│ │    Maintainability: A • Complexity: Low                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔄 Visual Verifier                            Running...    │ │
│ │    Analyzing screenshot for anti-slop patterns              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✅ Security Scanner                            Passed       │ │
│ │    No vulnerabilities • Dependencies clean                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✅ Placeholder Eliminator                      Passed       │ │
│ │    No TODOs, no Lorem Ipsum, no placeholders               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⏳ Design Style Agent                          Pending      │ │
│ │    Waiting for visual verifier to complete                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 8. TOURNAMENT PANEL ENHANCEMENT

**File:** `src/components/builder/TournamentPanel.tsx`

**Current State:** Basic toggle, no visualization

**Required Enhancement:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏆 Tournament Mode                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Feature: User Dashboard Layout                                 │
│                                                                 │
│  ═══════════ CONTESTANTS ═══════════════════════════════════    │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Claude Sonnet   │  │ Claude Opus     │  │ GPT-4o          │  │
│  │ Conservative    │  │ Aggressive      │  │ Alternative     │  │
│  │                 │  │                 │  │                 │  │
│  │ ████████░░ 80%  │  │ █████████░ 92%  │  │ ███████░░░ 75%  │  │
│  │                 │  │      ⭐         │  │                 │  │
│  │ [Preview]       │  │ [Preview]       │  │ [Preview]       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ═══════════ JUDGE PANEL ═══════════════════════════════════    │
│                                                                 │
│  Code Quality Judge:    Opus picks → Opus Aggressive            │
│  Design Quality Judge:  Opus picks → Opus Aggressive            │
│  Intent Alignment:      Opus picks → Opus Aggressive            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  🏆 Winner: Claude Opus (Aggressive)                            │
│  Score: 92/100 • Reason: Best intent alignment + design         │
│                                                                 │
│              [Accept Winner] [View All Implementations]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## CSS/Styling Requirements

### Global Glass Component Library

Create reusable glass components:

**File:** `src/components/ui/glass/index.ts`

```tsx
// GlassPanel - Container for dark glass sections
export const GlassPanel = styled.div<{ variant?: 'dark' | 'light' }>`
  background: ${props => props.variant === 'light'
    ? 'var(--glass-light-bg)'
    : 'var(--glass-dark-bg)'};
  backdrop-filter: var(--backdrop-blur);
  border: 1px solid ${props => props.variant === 'light'
    ? 'var(--glass-light-border)'
    : 'var(--glass-dark-border)'};
  border-radius: 16px;

  &:hover {
    border-color: var(--glass-dark-border-hover);
  }
`;

// GlassCard - Interactive card with hover effects
export const GlassCard = styled.div`
  /* ... */
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
  }
`;

// GlassButton - Primary action buttons
export const GlassButton = styled.button`
  background: linear-gradient(145deg, var(--accent-primary) 0%, var(--accent-primary)dd 100%);
  color: #000;
  font-weight: 600;

  &:hover {
    transform: scale(1.02);
  }

  &:active {
    transform: scale(0.98);
  }
`;

// GlassInput - Form inputs with glass styling
export const GlassInput = styled.input`
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-primary);

  &:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px var(--accent-primary-glow);
  }
`;
```

### Animation Library

**File:** `src/lib/animations.ts`

```tsx
import { Variants } from 'framer-motion';

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

export const cardHover: Variants = {
  rest: { y: 0, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' },
  hover: { y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' },
};

export const buttonPress: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

export const pulse: Variants = {
  animate: {
    scale: [1, 1.2, 1],
    opacity: [1, 0.7, 1],
    transition: { duration: 2, repeat: Infinity },
  },
};

export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};
```

---

## Implementation Priority Order

### Week 1: Critical Infrastructure
1. ✅ Create `TimeMachineBrowser.tsx`
2. ✅ Create `CreatePRModal.tsx`
3. ✅ Create `OrchestrationPlanView.tsx`
4. ✅ Create `BuildPhaseIndicator.tsx`
5. ✅ Create `VerificationSwarmStatus.tsx`
6. ✅ Add Settings access button to DeveloperModeView

### Week 2: Ghost Mode Completion
1. Full notification channel configuration with OAuth verification
2. Task queue with drag-drop (use `@dnd-kit/core`)
3. Wake condition builder with AND/OR logic
4. Session history and templates

### Week 3: Agent Mode Enhancement
1. Tournament bracket visualization
2. Branch management UI
3. Multi-agent comparison view
4. Request Changes Modal wiring

### Week 4: Workflow Features
1. ComfyUI configuration panel (GPU estimation, Dockerfile preview)
2. HuggingFace search with filters (model type, size, license)
3. Deployment configuration modals per provider
4. Cost estimation preview

### Week 5: Polish & Integration
1. Apply glass component library to ALL components
2. Add micro-interactions (Framer Motion)
3. Fix all loading/error states
4. Add tooltips and onboarding
5. Integration testing

---

## Success Criteria

After implementation:

1. **All documented features have UI** - No backend-only features
2. **Configuration is complete** - All options available in UI
3. **Consistent styling** - Premium $2k app feel throughout
4. **No dead buttons** - Every button does something
5. **Clear feedback** - Loading, success, and error states everywhere
6. **Intuitive navigation** - Users find features without help

---

*Document created: December 8, 2025*
*Based on: FEATURE_GAP_ANALYSIS.md and referenced documentation*

