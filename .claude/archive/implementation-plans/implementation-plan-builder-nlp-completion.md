# Builder View NLP-to-Complete-App Implementation Plan

> **Status**: Implementation Plan (Ready for Execution)
> **Created**: 2026-01-13
> **Goal**: Complete the Builder View NLP-to-production-ready-app workflow using BuildLoopOrchestrator

---

## EXECUTIVE SUMMARY

The Builder View has **99% backend completion** but **critical frontend integration gaps** that prevent the intended end-to-end autonomous building experience. The BuildLoopOrchestrator properly executes all 6 phases, but the frontend doesn't properly visualize, respond to, or enable user interaction with the build lifecycle.

### Current State
- **Backend**: ✅ 99% Complete - BuildLoopOrchestrator works, writes files to disk, runs all 6 phases
- **Frontend**: ❌ 60% Complete - Major integration gaps with demo overlay, phase visualization, intent display

### What's Missing
1. Frontend doesn't handle `phase_complete` event with `browser_demo` phase
2. AgentDemoOverlay exists but isn't auto-triggered when Phase 6 completes
3. BuildPhaseIndicator exists but isn't shown in Builder View during builds
4. Intent Lock contract not displayed to user after Phase 0
5. Speed Dial mode selector not integrated into build flow
6. "Take Control" button not wired to browser demo completion

---

## PART 1: BACKEND VERIFICATION (Already Complete)

### ✅ Routes Verified

| Route | Status | Location |
|-------|--------|----------|
| `POST /api/execute` | ✅ Working | `server/src/routes/execute.ts:144` |
| `POST /api/execute/plan/:sessionId/credentials` | ✅ Working | Credentials submission |
| `GET /api/execute/status/:sessionId` | ✅ Working | Build status |
| `POST /api/preview/demo` | ✅ Working | Manual demo trigger |

### ✅ BuildLoopOrchestrator Verified

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0: Intent Lock | Sacred Contract creation (Opus 4.5, 64K thinking) | ✅ Working |
| Phase 1: Initialization | Credential collection, scaffolding, artifact creation | ✅ Working |
| Phase 2: Parallel Build | 3-5 agents building features with continuous verification | ✅ Working |
| Phase 3: Integration Check | Orphan scan, dead code detection, dependency verification | ✅ Working |
| Phase 4: Functional Test | Browser automation, workflow simulation, gap closers | ✅ Working |
| Phase 5: Intent Satisfaction | Critical gate - 100 max escalation rounds | ✅ Working |
| Phase 6: Browser Demo | Visual verification loop, demo execution | ✅ Working |

### ✅ Events Emitted by Backend

```typescript
// Phase 6 completion event (build-loop.ts:4358-4370)
this.emitEvent('phase_complete', {
    phase: 'browser_demo',
    status: 'demo_running',
    url: sandbox.url,
    browserConnected: true,
    takeControlAvailable: true,  // KEY: Frontend should enable Take Control
    screenshot: finalScreenshot,
    visualVerification: {
        rounds: visualFixRound,
        finalScore: lastVisualScore,
        perfect: visuallyPerfect,
    },
});
```

Other events: `sandbox-ready`, `file-modified`, `visual-verification`, `agent-progress`, `builder-completed`, `phase-change`, `phase6-visual-analysis`

---

## PART 2: FRONTEND GAPS & IMPLEMENTATION

### Gap #1: WebSocket Handler Missing `phase_complete` with Browser Demo

**File**: `src/components/builder/ChatInterface.tsx`
**Location**: `handleWebSocketEvent()` function (lines 998-1177)

**Problem**: The switch statement handles many event types but NOT `phase_complete` with `browser_demo` phase.

**Fix**: Add case for `phase_complete` that:
1. Checks if `wsData.data?.phase === 'browser_demo'` and `wsData.data?.takeControlAvailable`
2. Sets state to show the demo overlay
3. Passes sandbox URL and screenshot to overlay
4. Enables "Take Control" button

**Implementation**:
```typescript
// Add to handleWebSocketEvent switch statement
case 'phase_complete': {
    const data = wsData.data as {
        phase?: string;
        status?: string;
        url?: string;
        takeControlAvailable?: boolean;
        screenshot?: string;
        visualVerification?: {
            rounds: number;
            finalScore: number;
            perfect: boolean;
        };
    };

    if (data.phase === 'browser_demo' && data.takeControlAvailable) {
        // Set state to show demo is ready
        setDemoReady(true);
        setDemoUrl(data.url);
        setDemoScreenshot(data.screenshot);
        setVisualScore(data.visualVerification?.finalScore);

        // Dispatch event for SandpackPreview to auto-start demo
        window.dispatchEvent(new CustomEvent('build-demo-ready', {
            detail: {
                url: data.url,
                takeControlAvailable: true,
                visualScore: data.visualVerification?.finalScore
            }
        }));
    }

    // Update phase info regardless
    if (data.phase) {
        onPhaseChange?.(data.phase as BuildPhase);
    }
    break;
}
```

**New State Variables Needed**:
```typescript
const [demoReady, setDemoReady] = useState(false);
const [demoUrl, setDemoUrl] = useState<string | null>(null);
const [demoScreenshot, setDemoScreenshot] = useState<string | null>(null);
const [visualScore, setVisualScore] = useState<number | null>(null);
```

---

### Gap #2: AgentDemoOverlay Not Auto-Triggered

**File**: `src/components/builder/SandpackPreview.tsx`
**Location**: Lines 218-219, 420-444

**Problem**: Demo overlay requires manual "Show Me" button click. Should auto-trigger when build completes Phase 6.

**Fix**: Listen for `build-demo-ready` custom event and auto-fetch demo segments:

**Implementation**:
```typescript
// Add useEffect to listen for build demo ready event
useEffect(() => {
    const handleBuildDemoReady = async (event: CustomEvent<{
        url: string;
        takeControlAvailable: boolean;
        visualScore: number;
    }>) => {
        // Auto-start demo when build completes
        if (event.detail.takeControlAvailable) {
            handleShowMeDemo(); // Existing function to fetch segments and start
        }
    };

    window.addEventListener('build-demo-ready', handleBuildDemoReady as EventListener);
    return () => window.removeEventListener('build-demo-ready', handleBuildDemoReady as EventListener);
}, []);
```

---

### Gap #3: BuildPhaseIndicator Not Shown During Builds

**File**: `src/components/builder/BuilderDesktop.tsx`
**Location**: Main layout

**Problem**: The beautiful BuildPhaseIndicator component exists but isn't rendered in the Builder View during builds.

**Fix**: Add BuildPhaseIndicator to the chat panel area, visible during active builds.

**Implementation**:
1. Import BuildPhaseIndicator
2. Add props to receive current phase and phase info from ChatInterface
3. Render above or below chat messages when build is in progress

```typescript
// In BuilderDesktop.tsx
import { BuildPhaseIndicator, type PhaseInfo, type BuildPhase } from './BuildPhaseIndicator';

// Add props
interface BuilderDesktopProps {
    // ... existing props
    buildPhases?: PhaseInfo[];
    currentBuildPhase?: BuildPhase;
    isBuilding?: boolean;
}

// In render, above ChatInterface:
{isBuilding && buildPhases && (
    <BuildPhaseIndicator
        phases={buildPhases}
        currentPhase={currentBuildPhase}
        compact={false}
        showDetails={true}
    />
)}
```

**ChatInterface Changes**: Need to pass phase data up to parent via callback or add BuildPhaseIndicator directly inside ChatInterface.

---

### Gap #4: Intent Lock Contract Not Displayed

**Problem**: After Phase 0 completes, users don't see what was locked in the Sacred Contract.

**Solution**: Create `IntentContractDisplay` component that shows:
- Success criteria (what must be achieved)
- User workflows (step-by-step flows)
- Visual identity (app soul, design direction)
- Locked features list

**Implementation**:

**New Component**: `src/components/builder/IntentContractDisplay.tsx`
```typescript
/**
 * IntentContractDisplay - Shows the locked Intent Contract after Phase 0
 *
 * Displays:
 * - Success criteria that must be met
 * - User workflows being built
 * - Visual identity and app soul
 * - Feature breakdown
 */

import { motion } from 'framer-motion';
import { CheckCircleIcon, LockIcon } from '../ui/icons';

interface IntentContractDisplayProps {
    contract: {
        appSoul: string;
        coreValueProp: string;
        successCriteria: Array<{ id: string; description: string; verified?: boolean }>;
        userWorkflows: Array<{ name: string; steps: string[] }>;
        visualIdentity: {
            soul: string;
            emotion: string;
            depth: string;
            motion: string;
        };
        locked: boolean;
        lockedAt?: string;
    };
    onDismiss?: () => void;
}

export function IntentContractDisplay({ contract, onDismiss }: IntentContractDisplayProps) {
    // Premium glass styling per Claude rules
    // Show each section with visual hierarchy
    // Lock icon when contract is locked
}
```

**Integration**: Show in ChatInterface when `intent_created` event is received.

---

### Gap #5: Speed Dial Mode Selection Not Integrated

**File**: `src/components/builder/SpeedDialSelector.tsx` (EXISTS)
**Problem**: Component exists but isn't shown before build starts to let users choose mode.

**Fix**: Integrate into ChatInterface or create pre-build modal:

**Options**:
1. **Option A**: Show in CostEstimatorModal before build confirmation
2. **Option B**: Add to the chat flow after prompt, before confirming
3. **Option C**: Create dedicated "Build Configuration" step

**Recommended (Option A)**:
```typescript
// In CostEstimatorModal.tsx, add SpeedDialSelector
import { SpeedDialSelector } from './SpeedDialSelector';

// Add state
const [buildMode, setBuildMode] = useState<'lightning' | 'standard' | 'tournament' | 'production'>('standard');

// Render in modal
<SpeedDialSelector
    value={buildMode}
    onChange={setBuildMode}
    showDescription={true}
/>

// Pass to onConfirm
onConfirm({ ...options, buildMode });
```

---

### Gap #6: "Take Control" Button Missing From Build Flow

**Problem**: When Phase 6 completes with `takeControlAvailable: true`, there's no button shown to user.

**Solution**: Add "Take Control" UI in two places:

1. **SandpackPreview**: Already has AgentDemoOverlay which has onTakeControl prop
2. **Floating Action Button**: Show prominent "Take Control" when demo is ready

**Implementation**:
```typescript
// In BuilderDesktop.tsx or ChatInterface.tsx
{demoReady && (
    <motion.button
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={handleTakeControl}
        className="fixed bottom-8 right-8 z-50 px-6 py-3 rounded-2xl font-semibold"
        style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)',
            color: 'white',
        }}
    >
        <span className="flex items-center gap-2">
            <PlayIcon size={20} />
            Take Control of Your App
        </span>
    </motion.button>
)}
```

**handleTakeControl Function**:
```typescript
const handleTakeControl = () => {
    // Stop demo overlay
    setDemoReady(false);

    // Open sandbox URL in iframe or new tab
    if (demoUrl) {
        setSandboxUrl(demoUrl);
        // User now controls the app
    }
};
```

---

## PART 3: COMPLETE WORKFLOW AFTER FIXES

### User Journey (NLP → Production App)

```
1. USER OPENS BUILDER VIEW
   └─ Opens /builder or /builder/[projectId]

2. USER ENTERS NLP PROMPT
   └─ Types: "Build me a SaaS dashboard with user auth, Stripe payments, and analytics"
   └─ ChatInterface receives input

3. USER SELECTS MODE (NEW: Gap #5)
   └─ CostEstimatorModal shows with SpeedDialSelector
   └─ Options: Lightning (fast) | Standard | Tournament (multiple implementations) | Production (thorough)
   └─ User selects and confirms

4. BUILD STARTS VIA WEBSOCKET
   └─ POST /api/execute { mode: 'builder', prompt, buildMode }
   └─ WebSocket connection established for real-time updates

5. PHASE 0: INTENT LOCK
   └─ Backend creates Sacred Contract (Opus 4.5, 64K thinking)
   └─ Frontend receives 'intent_created' event
   └─ (NEW: Gap #4) IntentContractDisplay shows the contract
   └─ User sees what was locked: success criteria, workflows, visual identity

6. PHASE 1: INITIALIZATION
   └─ Credential collection if needed (existing flow works)
   └─ Scaffolding created
   └─ (NEW: Gap #3) BuildPhaseIndicator shows Phase 1 active

7. PHASE 2: PARALLEL BUILD
   └─ 3-5 agents build features
   └─ Live preview updates via sandbox-ready and file-modified events
   └─ BuildPhaseIndicator shows Phase 2 progress
   └─ agent-progress events update UI

8. PHASE 3: INTEGRATION CHECK
   └─ Orphan scan runs
   └─ BuildPhaseIndicator shows Phase 3

9. PHASE 4: FUNCTIONAL TEST
   └─ Browser automation tests workflows
   └─ Gap closers run (accessibility, security, etc.)
   └─ BuildPhaseIndicator shows Phase 4

10. PHASE 5: INTENT SATISFACTION
    └─ Critical gate - compares built app to Intent Lock
    └─ If NOT satisfied → escalates → loops back to Phase 2
    └─ Up to 100 escalation rounds
    └─ BuildPhaseIndicator shows Phase 5

11. PHASE 6: BROWSER DEMO
    └─ Visual verification loop (show → analyze → fix)
    └─ Backend emits phase_complete with takeControlAvailable: true
    └─ (NEW: Gap #1) Frontend receives and processes event
    └─ (NEW: Gap #2) AgentDemoOverlay auto-triggers
    └─ Voice narration plays, cursor shows interactions
    └─ (NEW: Gap #6) "Take Control" button appears

12. USER TAKES CONTROL
    └─ User clicks "Take Control"
    └─ Demo overlay dismisses
    └─ User interacts with their production-ready app
```

---

## PART 4: FILES TO MODIFY

### Priority 1: Critical Path (Must Have)

| File | Changes | Lines (Est.) |
|------|---------|--------------|
| `src/components/builder/ChatInterface.tsx` | Add `phase_complete` handler, new state variables | +50 |
| `src/components/builder/SandpackPreview.tsx` | Add event listener for `build-demo-ready` | +20 |
| `src/components/builder/BuilderDesktop.tsx` | Add BuildPhaseIndicator integration | +30 |

### Priority 2: Enhanced UX (Should Have)

| File | Changes | Lines (Est.) |
|------|---------|--------------|
| `src/components/builder/IntentContractDisplay.tsx` | NEW: Create component | +200 |
| `src/components/builder/CostEstimatorModal.tsx` | Add SpeedDialSelector | +30 |

### Priority 3: Polish (Nice to Have)

| File | Changes | Lines (Est.) |
|------|---------|--------------|
| `src/components/builder/TakeControlButton.tsx` | NEW: Floating action button | +80 |
| `src/components/builder/BuildCompleteBanner.tsx` | NEW: Success banner | +60 |

---

## PART 5: IMPLEMENTATION ORDER

### Phase A: Critical WebSocket Handler (30 min)
1. **ChatInterface.tsx**: Add `phase_complete` case with browser_demo handling
2. **ChatInterface.tsx**: Add new state variables (demoReady, demoUrl, etc.)
3. **ChatInterface.tsx**: Dispatch `build-demo-ready` custom event

### Phase B: Auto-Trigger Demo Overlay (15 min)
1. **SandpackPreview.tsx**: Add useEffect to listen for `build-demo-ready`
2. **SandpackPreview.tsx**: Auto-call `handleShowMeDemo()` when event fires

### Phase C: BuildPhaseIndicator Integration (20 min)
1. **BuilderDesktop.tsx**: Import BuildPhaseIndicator
2. **BuilderDesktop.tsx**: Add props for phase tracking
3. **ChatInterface.tsx**: Pass phase data to parent or render internally

### Phase D: Take Control Button (15 min)
1. **BuilderDesktop.tsx** or **ChatInterface.tsx**: Add floating Take Control button
2. Wire to dismiss demo and hand control to user

### Phase E: Intent Contract Display (30 min)
1. Create **IntentContractDisplay.tsx** component
2. Integrate into ChatInterface when `intent_created` event received
3. Show success criteria, workflows, visual identity

### Phase F: Speed Dial Integration (15 min)
1. **CostEstimatorModal.tsx**: Add SpeedDialSelector
2. Pass selected mode to `/api/execute` call

---

## PART 6: VERIFICATION CHECKLIST

After implementation, verify:

```
[ ] NLP prompt in Builder View triggers BuildLoopOrchestrator
[ ] All 6 phases execute (check backend logs)
[ ] BuildPhaseIndicator shows progress visually
[ ] Intent Lock contract displayed after Phase 0
[ ] Live preview updates during Phase 2
[ ] Phase 6 completion triggers AgentDemoOverlay
[ ] Voice narration plays during demo
[ ] "Take Control" button appears and works
[ ] User can interact with completed app
[ ] Speed Dial selection affects build mode
[ ] Build doesn't complete until Intent Satisfaction passes
[ ] Errors escalate properly (up to 100 rounds)
```

---

## APPENDIX: Key File Locations

| Component | Location |
|-----------|----------|
| ChatInterface | `src/components/builder/ChatInterface.tsx` |
| SandpackPreview | `src/components/builder/SandpackPreview.tsx` |
| BuilderDesktop | `src/components/builder/BuilderDesktop.tsx` |
| BuildPhaseIndicator | `src/components/builder/BuildPhaseIndicator.tsx` |
| AgentDemoOverlay | `src/components/builder/AgentDemoOverlay.tsx` |
| SpeedDialSelector | `src/components/builder/SpeedDialSelector.tsx` |
| CostEstimatorModal | `src/components/builder/CostEstimatorModal.tsx` |
| BuildLoopOrchestrator | `server/src/services/automation/build-loop.ts` |
| Execute Route | `server/src/routes/execute.ts` |

---

## STYLE COMPLIANCE

All implementations MUST follow Claude rules:

- **No emojis** in production UI code
- **Custom icons** from `src/components/icons/` or inline SVG (NOT Lucide React)
- **Premium typography**: Cal Sans, Outfit, DM Sans
- **Liquid glass styling**: blur(40px), saturation(180%), layered shadows
- **Depth**: No flat designs, use glassmorphism
- **Motion**: Framer Motion for all animations
- **Colors**: Amber/gold accents (#F5A86C), no purple-pink gradients

---

*This document is the implementation blueprint for completing Builder View NLP-to-completion workflow.*
*Created: 2026-01-13*
