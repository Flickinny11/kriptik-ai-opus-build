# KripTik AI - Implementation Plan for Claude Code Extension
## December 21, 2025

> **Purpose**: This document contains prompts for Claude Code Extension in Cursor 2.2 to implement the remaining features and enhancements for KripTik AI.

---

## Executive Summary

### What's Already Implemented (No Action Needed)
| Feature | Status | Location |
|---------|--------|----------|
| Show Me / Merge buttons | COMPLETE | `src/components/feature-agent/FeatureAgentTile.tsx` |
| Ghost Mode tabs | COMPLETE | `src/components/feature-agent/GhostModeConfig.tsx` |
| Production Features UI | COMPLETE | `src/components/production-stack/ProductionStackWizard.tsx` |
| Env Variables UI | COMPLETE | `src/components/feature-agent/CredentialsCollectionView.tsx` |
| Implementation Plan approval | COMPLETE | `src/components/feature-agent/ImplementationPlanView.tsx` |
| Sandbox-to-main merge | COMPLETE | `server/src/routes/feature-agent.ts` |
| Research Agent | COMPLETE | `server/src/services/agents/orchestrator.ts` |
| Multi-orchestration Context | COMPLETE | `server/src/services/agents/context-store.ts` |
| Speed Dial (4 modes) | COMPLETE | `server/src/services/ai/speed-dial.ts` |

### What Needs Implementation
| Priority | Feature | Effort | Description |
|----------|---------|--------|-------------|
| P1 | Agent Activity Stream | HIGH | Streaming consciousness visualization |
| P2 | Enhanced Loop Blocker | MEDIUM | Pattern detection for stuck loops |
| P3 | Token/Context Overflow | MEDIUM | Dynamic agent spawning |
| P4 | Gemini 3 Video @ 2fps | MEDIUM | Upgrade from Gemini 2.0 Flash |
| P5 | Voice Narration | HIGH | TTS during agent demo |
| P6 | Extension Credential Capture | MEDIUM | Complete vision extraction |
| P7 | Live Preview AI Overlay | LOW | Cursor/interaction visualization |

---

## PROMPT 1: Agent Activity Stream Component

```
Implement a comprehensive Agent Activity Stream component for KripTik AI that displays real-time orchestration activities in the Builder View chat interface. This must be production-ready with no placeholders.

### Requirements

1. **Create standardized event type** in `src/types/agent-activity.ts`:

```typescript
export type AgentActivityEvent = {
  id: string;
  type: 'thinking' | 'file_read' | 'file_write' | 'file_edit' | 'tool_call' | 'status' | 'verification' | 'error';
  agentId?: string;
  agentName?: string;
  content: string;
  metadata?: {
    filePath?: string;
    toolName?: string;
    phase?: string;
    lineNumbers?: { start: number; end: number };
    tokenCount?: number;
    duration?: number;
  };
  timestamp: number;
};

export type AgentActivityStreamState = {
  events: AgentActivityEvent[];
  isThinkingExpanded: boolean;
  activePhase: string | null;
};
```

2. **Create AgentActivityStream component** in `src/components/builder/AgentActivityStream.tsx`:
   - Parse streaming chunks for thinking tokens (Anthropic), reasoning tokens (OpenAI), and custom orchestration events
   - Model-agnostic: detect and normalize events from any LLM provider
   - Display thinking/reasoning in collapsible accordion section
   - Show file operations with file path, operation type (read/write/edit), and line numbers
   - Show tool calls with tool name and parameters
   - Show status indicators with current phase (thinking, planning, coding, testing, verifying)

3. **Styling requirements**:
   - Use JetBrains Mono or Fira Code monospace font
   - Animate entries with smooth fade-in and slide-up (200-300ms ease-out)
   - Use muted/secondary color palette (#6b7280 for text, not competing with main content)
   - Add subtle typing/pulse animation for active/in-progress items
   - Collapsible thinking section with smooth height animation using Framer Motion
   - Match KripTik AI dark theme with glassmorphism

4. **Integration**:
   - Integrate into `src/components/builder/ChatInterface.tsx` above the message list
   - Subscribe to WebSocket events from `/api/execute` endpoint
   - Parse SSE events from build loop and normalize to AgentActivityEvent

5. **Also create FeatureAgentActivityStream** in `src/components/feature-agent/FeatureAgentActivityStream.tsx`:
   - Same functionality but styled to match feature agent tile colors
   - Use the amber/orange color scheme from tiles (#F5A86C)
   - Integrate into FeatureAgentTile.tsx within the tile body

### Files to create/modify:
- CREATE: `src/types/agent-activity.ts`
- CREATE: `src/components/builder/AgentActivityStream.tsx`
- CREATE: `src/components/feature-agent/FeatureAgentActivityStream.tsx`
- MODIFY: `src/components/builder/ChatInterface.tsx`
- MODIFY: `src/components/feature-agent/FeatureAgentTile.tsx`
- MODIFY: `server/src/services/automation/build-loop.ts` (emit standardized events)

Ensure all code is production-ready, no placeholders, no TODOs, no mock data.
```

---

## PROMPT 2: Enhanced Loop Blocker

```
Enhance the Loop Blocker in KripTik AI to detect when agents are stuck in repetitive failure patterns and force comprehensive analysis. This is critical for preventing infinite loops during autonomous building.

### Requirements

1. **Enhance ReflectionEngine** in `server/src/services/ai/reflection-engine.ts`:
   - Add pattern detection for repetitive errors (same error appearing 3+ times)
   - Track error signatures (hash of error message + file + line)
   - After 3 identical failures, trigger comprehensive analysis mode
   - Comprehensive analysis must:
     - Read ALL build logs (not just last error)
     - Read ALL runtime logs
     - Analyze full stack traces
     - Check for placeholder/mock data issues
     - Check for missing dependencies
     - Check for type mismatches
     - Create detailed fix plan before retrying

2. **Create LoopBlocker service** in `server/src/services/automation/loop-blocker.ts`:

```typescript
interface ErrorSignature {
  hash: string;
  errorMessage: string;
  file: string;
  line: number;
  occurrences: number;
  timestamps: number[];
}

interface LoopBlockerState {
  errorHistory: Map<string, ErrorSignature>;
  isInComprehensiveMode: boolean;
  comprehensiveAnalysisCount: number;
  maxComprehensiveAttempts: number;
}

class LoopBlocker {
  recordError(error: Error, context: BuildContext): void;
  isStuckInLoop(): boolean;
  getComprehensiveAnalysisPrompt(): string;
  reset(): void;
}
```

3. **Integration with BuildLoopOrchestrator**:
   - Call `loopBlocker.recordError()` on every build/test failure
   - Before retry, check `loopBlocker.isStuckInLoop()`
   - If stuck, switch to comprehensive analysis mode
   - Use `getComprehensiveAnalysisPrompt()` to generate fix plan
   - After 5 comprehensive analysis attempts, escalate to human

### Files to create/modify:
- CREATE: `server/src/services/automation/loop-blocker.ts`
- MODIFY: `server/src/services/ai/reflection-engine.ts`
- MODIFY: `server/src/services/automation/build-loop.ts`
- MODIFY: `server/src/services/automation/error-escalation.ts`

Ensure production-ready code with proper error handling.
```

---

## PROMPT 3: Token/Context Overflow Management

```
Implement dynamic agent spawning when context window approaches limit in KripTik AI. Agents should seamlessly hand off to new instances without losing progress.

### Requirements

1. **Create ContextOverflowManager** in `server/src/services/agents/context-overflow.ts`:

```typescript
interface ContextOverflowConfig {
  maxTokenThreshold: number;      // e.g., 180000 for 200K context
  warningThreshold: number;       // e.g., 150000 for early warning
  handoffStrategy: 'immediate' | 'at_checkpoint' | 'at_phase_boundary';
}

interface AgentHandoff {
  fromAgentId: string;
  toAgentId: string;
  contextSnapshot: CompressedContext;
  currentTask: string;
  completedTasks: string[];
  pendingTasks: string[];
}

class ContextOverflowManager {
  checkContextUsage(agentId: string): ContextStatus;
  initiateHandoff(agentId: string): Promise<AgentHandoff>;
  compressContext(fullContext: string): CompressedContext;
  restoreContext(compressed: CompressedContext): string;
}
```

2. **Implement context compression**:
   - Summarize completed work (not full conversation)
   - Keep intent lock contract (never compress)
   - Keep current task details
   - Keep recent errors and their resolutions
   - Keep file modification history (paths only, not full content)
   - Compress to ~20% of original size

3. **Implement seamless handoff**:
   - New agent receives compressed context
   - New agent acknowledges understanding
   - Old agent terminates gracefully
   - No user notification (seamless experience)
   - All progress artifacts preserved

4. **Integration with orchestrator**:
   - Check context usage before each AI call
   - Trigger handoff at phase boundaries when possible
   - Emergency handoff if approaching hard limit

### Files to create/modify:
- CREATE: `server/src/services/agents/context-overflow.ts`
- MODIFY: `server/src/services/agents/orchestrator.ts`
- MODIFY: `server/src/services/automation/build-loop.ts`
- MODIFY: `server/src/services/orchestration/agents/worker-agent.ts`

Production-ready implementation, no placeholders.
```

---

## PROMPT 4: Gemini 3 Video Streaming @ 2fps

```
Upgrade KripTik AI to use Gemini 3 video streaming at 2fps for extension credential capture and Fix My App workflow.

### Requirements

1. **Update vision capture service** in `server/src/services/extension/vision-capture-service.ts`:
   - Upgrade from Gemini 2.0 Flash to Gemini 3 Pro (use @google/genai SDK)
   - Implement 2fps frame rate specification
   - Use WebSocket-based ai.live.connect() for real-time streaming
   - Add frame buffering for smooth capture

2. **Update model IDs** (verify these are current as of Dec 21, 2025):
   - Use WebSearch to confirm latest Gemini 3 model IDs
   - Update OPENROUTER_MODELS in `server/src/services/ai/openrouter-client.ts`

3. **Implement 2fps frame capture**:

```typescript
const FRAME_INTERVAL_MS = 500; // 2fps = 500ms per frame

class GeminiVideoStream {
  private frameBuffer: ImageFrame[] = [];
  private captureInterval: NodeJS.Timeout | null = null;

  async startCapture(page: Page): Promise<void> {
    this.captureInterval = setInterval(async () => {
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
      this.frameBuffer.push({
        data: screenshot.toString('base64'),
        timestamp: Date.now(),
        mimeType: 'image/jpeg'
      });
      await this.sendToGemini(this.frameBuffer.slice(-10)); // Last 5 seconds
    }, FRAME_INTERVAL_MS);
  }
}
```

4. **Extension integration**:
   - Update `browser-extension/src/content/credentials/credential-capture.js`
   - Stream video frames to backend at 2fps
   - Backend analyzes with Gemini 3 for credential extraction

5. **Fix My App workflow**:
   - Scroll page while capturing at 2fps
   - Find export buttons, build logs, errors
   - Extract complete chat history
   - All using Gemini 3 vision

### Files to modify:
- `server/src/services/extension/vision-capture-service.ts`
- `server/src/services/ai/openrouter-client.ts`
- `browser-extension/src/content/credentials/credential-capture.js`
- `server/src/services/ai/gemini-video-analyzer.ts`

Use WebSearch to get current Gemini 3 model IDs before implementation.
```

---

## PROMPT 5: Voice Narration for Agent Demo

```
Implement voice narration for KripTik AI agent-controlled browser demonstrations. The agent should speak to the user while showing them the completed app.

### Requirements

1. **Create VoiceNarrationService** in `server/src/services/ai/voice-narration.ts`:

```typescript
interface NarrationScript {
  segments: NarrationSegment[];
}

interface NarrationSegment {
  text: string;
  action: 'circle' | 'click' | 'type' | 'scroll' | 'wait';
  target?: string; // CSS selector or description
  duration?: number;
}

class VoiceNarrationService {
  async generateNarrationScript(
    appIntent: IntentContract,
    features: Feature[],
    pageUrl: string
  ): Promise<NarrationScript>;

  async synthesizeSpeech(text: string): Promise<AudioBuffer>;

  async playNarration(
    segment: NarrationSegment,
    browserPage: Page
  ): Promise<void>;
}
```

2. **TTS Integration options** (choose best available):
   - ElevenLabs API (highest quality, most natural)
   - Azure Cognitive Speech Services
   - Google Cloud Text-to-Speech
   - OpenAI TTS (if available)

3. **Browser overlay for visual indicators**:
   - Circle/highlight elements being discussed
   - Draw attention arrows
   - Show typed input as it happens
   - Smooth animations with Framer Motion

4. **Frontend component** in `src/components/builder/AgentDemoOverlay.tsx`:
   - Audio playback controls (mute, volume)
   - Visual highlight overlay using canvas
   - "Take Control" button to stop demo
   - Transcript display (optional, collapsible)

5. **Integration with FeaturePreviewWindow**:
   - When "Show Me" is clicked, start narrated demo
   - Agent explains: "This is your [feature], here's how it works..."
   - Agent circles buttons, demonstrates interactions
   - User can take over at any time

### Files to create/modify:
- CREATE: `server/src/services/ai/voice-narration.ts`
- CREATE: `src/components/builder/AgentDemoOverlay.tsx`
- MODIFY: `src/components/feature-agent/FeaturePreviewWindow.tsx`
- MODIFY: `src/components/builder/SandpackPreview.tsx`

Research current TTS APIs for best quality/speed tradeoff.
```

---

## PROMPT 6: Complete Extension Credential Capture

```
Complete the extension credential capture implementation using Gemini 3 vision at 2fps.

### Requirements

1. **Complete extractCredentialsWithVision()** in `browser-extension/src/content/credentials/credential-capture.js`:

```javascript
async function extractCredentialsWithVision() {
  // 1. Start video capture at 2fps
  const stream = await startVideoCapture(2); // 2fps

  // 2. Send frames to backend for Gemini 3 analysis
  const analysisResults = await analyzeWithGemini(stream);

  // 3. Parse credential locations from analysis
  const credentialLocations = parseCredentialLocations(analysisResults);

  // 4. Extract actual values from DOM using locations
  const credentials = await extractFromDOM(credentialLocations);

  // 5. Validate and format credentials
  return validateCredentials(credentials);
}
```

2. **Backend vision endpoint** in `server/src/routes/extension.ts`:
   - POST `/api/extension/vision-extract`
   - Accept video frames (base64 array)
   - Process with Gemini 3
   - Return detected credential locations and values

3. **Platform-specific extraction**:
   - Enhance platform configs in `browser-extension/src/content/platforms/configs/`
   - Add credential field selectors per platform
   - Handle different auth flows (API key, OAuth, JWT)

4. **Error recovery**:
   - Retry failed extractions up to 3 times
   - Fallback to manual input UI if vision fails
   - Clear error messages for user

5. **Security**:
   - Never log credential values
   - Clear memory after sending to vault
   - Use secure message passing

### Files to modify:
- `browser-extension/src/content/credentials/credential-capture.js`
- `server/src/routes/extension.ts`
- `server/src/services/extension/vision-capture-service.ts`
- `browser-extension/src/content/platforms/configs/*.config.js`

Production-ready with proper error handling.
```

---

## PROMPT 7: Live Preview AI Overlay

```
Add AI interaction visualization overlay to the live preview window in Builder View.

### Requirements

1. **Create AIInteractionOverlay component** in `src/components/builder/AIInteractionOverlay.tsx`:
   - Canvas overlay on top of preview iframe
   - Visualize AI cursor position (when agent is interacting)
   - Show file being edited (floating badge)
   - Show current agent status (thinking, coding, testing)
   - Pulse animation on elements being modified

2. **Styling**:
   - Semi-transparent overlay (pointer-events: none)
   - Neon/glow effects for cursor (cyan #00d4ff)
   - Status badge in corner with current phase
   - Smooth animations, no jarring transitions

3. **Integration with SandpackPreview**:
   - Overlay should match preview iframe dimensions
   - React to build loop events for status updates
   - Show/hide based on whether agents are actively building

4. **Events to visualize**:
   - File read (brief highlight on file list)
   - File write (pulse on preview)
   - Verification running (spinner overlay)
   - Build complete (success animation)

### Files to create/modify:
- CREATE: `src/components/builder/AIInteractionOverlay.tsx`
- MODIFY: `src/components/builder/SandpackPreview.tsx`
- MODIFY: `src/components/builder/PreviewWindow.tsx`

Keep it subtle and non-intrusive.
```

---

## Execution Order

Execute these prompts in order, verifying build passes after each:

1. **PROMPT 1** (Agent Activity Stream) - Most user-visible, high impact
2. **PROMPT 2** (Loop Blocker) - Critical for autonomous operation
3. **PROMPT 3** (Context Overflow) - Enables longer builds
4. **PROMPT 4** (Gemini 3 @ 2fps) - Required for PROMPTs 5 and 6
5. **PROMPT 5** (Voice Narration) - After Gemini 3 is working
6. **PROMPT 6** (Extension Capture) - After Gemini 3 is working
7. **PROMPT 7** (AI Overlay) - Polish/enhancement

After each prompt:
```bash
npm run build
git add -A && git commit -m "feat: [description]"
git push -u origin [branch]
```

---

## Verification Checklist

After all prompts are complete, verify:

- [ ] Agent Activity Stream displays in Builder View chat
- [ ] Agent Activity Stream displays in Feature Agent tiles
- [ ] Loop blocker triggers comprehensive analysis after 3 identical errors
- [ ] Context overflow spawns new agent seamlessly
- [ ] Gemini 3 video streaming works at 2fps
- [ ] Voice narration speaks during agent demo
- [ ] Extension captures credentials with vision
- [ ] AI overlay shows on live preview
- [ ] All features work with both Builder View and Feature Agents
- [ ] No placeholders, no TODOs, no mock data
- [ ] Build compiles successfully
- [ ] No git conflicts

---

*Generated: December 21, 2025*
*For use with Claude Code Extension in Cursor 2.2*
