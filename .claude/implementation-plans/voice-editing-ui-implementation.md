# Voice Editing UI - Comprehensive Implementation Plan

> **Purpose**: Transform KripTik's existing voice features into a premium, real-time, conversational voice-to-edit experience with stunning 60fps+ animations.
>
> **Created**: 2026-01-13
> **Branch**: `claude/voice-editing-ui-jMymH`
> **Target**: Opus 4.5 in Cursor 2.2

---

## EXECUTIVE SUMMARY

### Current State
- **VoiceArchitectPanel.tsx** (660 lines) - 4-step wizard for building NEW apps from voice (not editing)
- **voice-architect.ts** (689 lines) - Backend with Whisper transcription (batch, not streaming)
- **Developer Toolbar** - Has 'voice-first' button → opens GenericPanel (stub)
- **Visual Editor** - Has element selection (useVisualEditorStore) but not integrated with voice
- **No real-time streaming transcription** - All audio is batch processed
- **No conversational editing** - Cannot say "make this larger, no not that large, now red"

### Target State
- **Conversational Voice Editing** - Real-time streaming with < 300ms latency
- **Element-Aware Commands** - Select element, speak to edit it
- **No Cut-off** - Continue speaking while AI implements changes
- **Premium 60fps Animated UI** - 3D depth, gradients, pulses, glass morphism
- **3D Preview on Hover** - Animated video preview box
- **Context-Aware Edits** - Preserves wiring/integration

---

## PROMPT 1: Real-Time Voice Streaming Service

**Difficulty**: HIGH | **Files**: ~600 lines | **Priority**: P0

```
Create a real-time voice streaming transcription service for KripTik AI that enables sub-300ms latency conversational voice editing.

## Context
- Location: server/src/services/ai/realtime-voice-stream.ts
- Existing: voice-architect.ts uses batch Whisper transcription
- Integration: Will be used by voice editing UI for real-time commands
- API: Use Deepgram for streaming (better latency than Whisper streaming)

## Requirements

### 1. WebSocket Streaming Connection
Create a WebSocket server that:
- Accepts raw audio chunks (PCM 16-bit, 16kHz mono)
- Streams to Deepgram's Nova-2 model for real-time transcription
- Returns interim results every ~100ms
- Returns final results when speech pause detected
- Handles multiple concurrent sessions
- Includes VAD (Voice Activity Detection) for smart pause detection

### 2. Transcription Service Class
```typescript
interface RealtimeVoiceConfig {
  deepgramApiKey: string;
  model: 'nova-2' | 'whisper-streaming';
  language: string;
  interimResults: boolean;
  vadSensitivity: 'low' | 'medium' | 'high';
  endpointing: number; // ms of silence to end utterance
}

interface TranscriptEvent {
  type: 'interim' | 'final' | 'speech_start' | 'speech_end' | 'error';
  sessionId: string;
  transcript?: string;
  confidence?: number;
  timestamp: number;
  isFinal: boolean;
  alternatives?: string[];
}

class RealtimeVoiceStreamService extends EventEmitter {
  createSession(userId: string, config?: Partial<RealtimeVoiceConfig>): string;
  processAudioChunk(sessionId: string, chunk: Buffer): void;
  endSession(sessionId: string): void;
  getSessionStatus(sessionId: string): SessionStatus;
}
```

### 3. API Routes
- `WS /api/voice/realtime/:sessionId` - WebSocket for audio streaming
- `POST /api/voice/realtime/session` - Create new streaming session
- `GET /api/voice/realtime/session/:id` - Get session status
- `DELETE /api/voice/realtime/session/:id` - End session

### 4. Audio Processing
- Handle WebM/Opus audio from browser MediaRecorder
- Convert to PCM for Deepgram
- Buffer management for smooth streaming
- Automatic reconnection on network issues

### 5. Fallback Strategy
If Deepgram is unavailable:
1. Try OpenAI Whisper streaming (new API)
2. Fall back to AssemblyAI
3. Last resort: Batch transcription with chunking

## Environment Variables
- DEEPGRAM_API_KEY (required for streaming)
- ASSEMBLY_AI_API_KEY (optional fallback)
- OPENAI_API_KEY (existing, for Whisper fallback)

## Integration Points
- Emit events that voice-edit-orchestrator.ts will consume
- Session IDs correlate with visual editor sessions
- Include userId for credit tracking

## Success Criteria
- Interim transcription within 300ms of speech
- Final transcription within 500ms of pause
- Support for continuous conversation (no manual stop/start)
- Proper cleanup on disconnect
- Error recovery without losing context

DO NOT modify existing voice-architect.ts - this is a NEW service.
```

---

## PROMPT 2: Voice Edit Orchestrator Service

**Difficulty**: HIGH | **Files**: ~800 lines | **Priority**: P0

```
Create the Voice Edit Orchestrator service that converts real-time voice commands into context-aware code edits for selected elements in KripTik AI.

## Context
- Location: server/src/services/ai/voice-edit-orchestrator.ts
- Integrates with: RealtimeVoiceStreamService, useVisualEditorStore element data
- Model: Use Claude Sonnet 4.5 for fast interpretation, escalate to Opus 4.5 for complex edits
- Key requirement: Edits must preserve existing wiring/integration (not recreate entire components)

## Requirements

### 1. Command Interpretation
Parse voice commands into structured edit intentions:
```typescript
type EditIntent =
  | { type: 'style'; property: string; value: string; relative?: boolean }
  | { type: 'resize'; dimension: 'width' | 'height' | 'both'; value: string; relative?: boolean }
  | { type: 'color'; target: 'background' | 'text' | 'border'; value: string }
  | { type: 'text'; content: string }
  | { type: 'move'; direction: 'up' | 'down' | 'left' | 'right'; amount: string }
  | { type: 'delete'; confirmation?: boolean }
  | { type: 'duplicate'; }
  | { type: 'undo'; steps?: number }
  | { type: 'redo'; steps?: number }
  | { type: 'compound'; intents: EditIntent[] }
  | { type: 'clarification_needed'; question: string; options: string[] }
  | { type: 'not_understood'; transcript: string };

interface EditCommand {
  sessionId: string;
  elementId: string;
  sourceFile: string;
  sourceLine: number;
  intent: EditIntent;
  context: ElementContext;
  confidence: number;
}

interface ElementContext {
  tagName: string;
  componentName?: string;
  currentStyles: Record<string, string>;
  tailwindClasses: string[];
  parentContext: { tagName: string; className?: string };
  siblingCount: number;
  hasEventHandlers: boolean;
  propsReceived: string[];
  importedFrom?: string;
  usedIn?: string[]; // Other files that import this component
}
```

### 2. Conversational State Machine
Track conversation state to handle:
- "make it bigger" → "no, not that big" → "yeah, that's good"
- "make it red" → "darker" → "perfect"
- "undo that last change" (needs history)
- "actually, let's try blue instead"

```typescript
interface ConversationState {
  sessionId: string;
  userId: string;
  selectedElement: SelectedElement | null;
  editHistory: AppliedEdit[];
  pendingIntent?: EditIntent;
  awaitingClarification?: { question: string; options: string[] };
  lastAIResponse?: string;
  contextWindow: TranscriptEvent[]; // Rolling window of recent speech
}
```

### 3. Context-Preserving Code Generation
When generating edits, the AI MUST:
- Only modify the specific property/value requested
- Preserve all event handlers (onClick, onChange, etc.)
- Preserve all props passed to the component
- Preserve all imports
- Preserve all sibling elements
- Preserve all parent relationships
- Use surgical edits (AST-based when possible, regex for simple cases)

```typescript
interface CodeEdit {
  file: string;
  startLine: number;
  endLine: number;
  oldCode: string;
  newCode: string;
  preservedElements: string[]; // What was explicitly preserved
  editType: 'tailwind' | 'inline-style' | 'prop' | 'text-content' | 'full-rewrite';
}
```

### 4. Relative Value Processing
Handle natural language relative values:
- "bigger" → +20% of current size
- "much bigger" → +50%
- "a little smaller" → -10%
- "darker" → darken color by 20%
- "more transparent" → reduce opacity by 0.2

### 5. Response Generation
Generate natural spoken responses via TTS:
- "Made it larger" (confirmation)
- "How much larger?" (clarification)
- "I've increased the padding to 24 pixels" (detailed)
- "Undo complete - reverted to blue background" (undo feedback)

### 6. Edit Application Pipeline
```typescript
async function applyEdit(command: EditCommand): Promise<{
  success: boolean;
  codeEdit?: CodeEdit;
  spoken: string;
  visualFeedback?: { highlight: boolean; pulse: boolean };
}>;
```

### 7. Speculative Execution
For low-latency feel:
- Start generating edit immediately on interim transcript
- If final transcript differs, cancel and regenerate
- Show preview of change before finalizing

## Model Routing
- Simple style changes (color, size): Haiku 3.5 (fast)
- Complex changes (layout, component structure): Sonnet 4.5
- Multi-step changes or refactoring: Opus 4.5

## Integration
- Receives TranscriptEvents from RealtimeVoiceStreamService
- Sends CodeEdits to file writer
- Updates useVisualEditorStore with pending changes
- Emits events for UI feedback

## Success Criteria
- Correctly interpret 90%+ of common voice commands
- Preserve all existing functionality in edited code
- Sub-500ms latency for simple style changes
- Natural conversational flow (handles corrections, clarifications)
```

---

## PROMPT 3: Premium Voice Editing UI Component

**Difficulty**: HIGH | **Files**: ~900 lines | **Priority**: P0

```
Create the premium Voice Editing UI component for KripTik AI's developer toolbar with stunning 60fps animations, 3D depth, and conversational voice-to-edit capability.

## Context
- Location: src/components/voice-edit/VoiceEditPanel.tsx
- Also create: VoiceEditButton.tsx, VoiceWaveform.tsx, VoiceCapabilities.tsx, VoicePreviewHover.tsx
- Replaces: GenericPanel for 'voice-first' button in developer toolbar
- Integration: useVisualEditorStore for element selection, RealtimeVoiceStreamService for voice

## Design Requirements

### Visual Identity
- **Primary Accent**: Amber/Gold (#F5A86C) for active states - NO PURPLE
- **Glass Morphism**: Frosted glass with visible depth (not flat)
- **3D Layered Shadows**: Multiple shadow layers for floating effect
- **60fps+ Animations**: Use Framer Motion with spring physics, GPU-accelerated transforms
- **Gradients**: Subtle warm gradients (amber to gold), NO purple-pink or blue-purple
- **Pulse Effects**: Gentle breathing animations when listening
- **Typography**: Cal Sans for headers, Outfit for body, DM Sans for labels

### Component Structure

#### 1. VoiceEditButton.tsx (~150 lines)
Toolbar button that opens the voice editing panel:
```typescript
interface VoiceEditButtonProps {
  isActive: boolean;
  isListening: boolean;
  hasSelectedElement: boolean;
  onClick: () => void;
}
```
- Microphone icon with animated sound waves when listening
- Amber glow pulse when active
- 3D glass pill shape matching other toolbar buttons
- On hover: Show VoicePreviewHover component (not just tooltip)

#### 2. VoicePreviewHover.tsx (~200 lines)
3D animated preview box shown on hover:
- **Shape**: 3D rectangular box with visible depth/perspective
- **Content**: Looping video/animation showing voice editing in action
- **Animation**: Box rotates slightly, has depth shadows
- **Entrance**: Slides up from button with spring animation
- **Size**: ~320x200px
- **Content shows**: User selecting element → speaking → element changing
- Use Lottie or pre-rendered WebM for the preview content

#### 3. VoiceCapabilities.tsx (~150 lines)
Capabilities explanation overlay:
- Shows when user first opens panel or clicks "What can I do?"
- Lists capabilities with icons:
  - "Select an element and say 'make it larger'"
  - "Say 'change the color to blue'"
  - "Say 'undo' or 'that's too much'"
  - "Natural conversation - no buttons needed"
- Animated list items with staggered entrance
- "Got it" button to dismiss

#### 4. VoiceWaveform.tsx (~250 lines)
Real-time audio visualization:
```typescript
interface VoiceWaveformProps {
  audioLevel: number; // 0-1
  isListening: boolean;
  isSpeaking: boolean; // AI speaking back
  style?: 'bars' | 'wave' | 'circle' | 'blob';
}
```
- Canvas-based 60fps animation
- Smooth interpolation between levels
- Different visual when user speaking vs AI responding
- Ambient glow effect around visualization
- Uses requestAnimationFrame for smooth animation

#### 5. VoiceEditPanel.tsx (~350 lines)
Main panel component:
```typescript
interface VoiceEditPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedElement: SelectedElement | null;
}
```

**Layout**:
```
┌────────────────────────────────────────┐
│  ● Voice Edit Mode                  ✕  │ ← Glass header with close
├────────────────────────────────────────┤
│                                        │
│    ┌──────────────────────────────┐    │
│    │                              │    │
│    │      [Voice Waveform]        │    │ ← Main visualization area
│    │                              │    │
│    │      "Listening..."          │    │
│    └──────────────────────────────┘    │
│                                        │
│  Selected: <Button className="...">    │ ← Element info (if selected)
│  Source: src/components/Hero.tsx:45    │
│                                        │
├────────────────────────────────────────┤
│  Recent Commands:                      │
│  ✓ "Made the button larger"            │ ← History with status
│  ✓ "Changed color to blue"             │
│  ⟳ "Adjusting padding..."              │ ← Currently processing
│                                        │
├────────────────────────────────────────┤
│  💡 "What can I do?"                   │ ← Help trigger
└────────────────────────────────────────┘
```

**States**:
- **Idle (no element)**: "Select an element to start editing with voice"
- **Ready (element selected)**: Waveform active, "Say something like 'make it larger'"
- **Listening**: Full waveform animation, transcribing
- **Processing**: Spinner on waveform, "Applying changes..."
- **AI Speaking**: Different waveform style, TTS playing
- **Error**: Red tint, error message, retry option

**Animations**:
- Panel entrance: Scale from 0.95 + fade + slight y offset (spring)
- State transitions: Crossfade with 200ms duration
- Waveform: Continuous 60fps canvas animation
- Element highlight: Pulse effect when element selected
- Command history: Items slide in from bottom

### Audio Handling
```typescript
// Use existing browser APIs
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 16000
});

// Send chunks to WebSocket
mediaRecorder.ondataavailable = (e) => {
  ws.send(e.data);
};
```

### Integration with Developer Toolbar
Update DeveloperBarPanel.tsx to use VoiceEditPanel:
```typescript
// In FEATURE_PANELS:
'voice-first': {
  title: 'Voice Edit',
  icon: 'voiceFirst',
  component: VoiceEditPanelWrapper,
  fullWidth: true
}
```

### Keyboard Shortcuts
- `V` - Toggle voice listening when panel open
- `Escape` - Stop listening / close panel
- `Ctrl+Z` - Undo last edit (voice or keyboard)

### CSS Requirements
- Create voice-edit.css with:
  - Glass morphism styles
  - Glow effects for active states
  - Smooth transitions
  - GPU-accelerated animations (transform, opacity only)

## Success Criteria
- 60fps animations on mid-range hardware
- Smooth transitions between all states
- No layout shifts during state changes
- Accessible (ARIA labels, keyboard navigation)
- Works without selected element (shows guidance)
```

---

## PROMPT 4: Voice Feedback TTS Integration

**Difficulty**: MEDIUM | **Files**: ~300 lines | **Priority**: P1

```
Create the voice feedback system that provides natural spoken responses during voice editing in KripTik AI, enabling true bidirectional conversation.

## Context
- Location: server/src/services/ai/voice-edit-feedback.ts
- Also create: src/components/voice-edit/VoiceFeedbackPlayer.tsx
- Existing: voice-narration.ts has ElevenLabs/OpenAI TTS - reuse that infrastructure
- Key requirement: Audio feedback must NOT block user speech (bidirectional)

## Requirements

### 1. Backend Feedback Service
```typescript
interface FeedbackConfig {
  voice: 'rachel' | 'adam' | 'alloy' | 'shimmer'; // ElevenLabs or OpenAI voices
  speed: number; // 0.8 - 1.2
  concise: boolean; // Shorter responses for speed
}

interface FeedbackRequest {
  sessionId: string;
  type: 'confirmation' | 'clarification' | 'error' | 'status' | 'undo';
  message: string;
  priority: 'immediate' | 'after_silence';
}

class VoiceEditFeedbackService {
  async generateFeedback(request: FeedbackRequest): Promise<{
    audioUrl: string;
    duration: number;
    text: string;
  }>;

  // Queue management for non-overlapping audio
  queueFeedback(sessionId: string, request: FeedbackRequest): void;
  cancelPending(sessionId: string): void;
}
```

### 2. Smart Response Generation
Use AI to generate natural, concise responses:
```typescript
const responseTemplates = {
  confirmation: {
    simple: ["Done", "Got it", "Applied"],
    detailed: ["Made {property} {newValue}", "Changed {element} to {newValue}"]
  },
  clarification: {
    size: "How much {larger/smaller}?",
    color: "Which shade of {color}?",
    element: "Which element - the button or the container?"
  },
  error: {
    notFound: "I couldn't find that element",
    cantModify: "That property can't be changed on this element",
    apiError: "Something went wrong, please try again"
  }
};
```

### 3. Bidirectional Audio Management
- Use Web Audio API for mixing
- Duck TTS volume when user speaks
- Cancel pending TTS if user interrupts
- Resume after user finishes speaking

### 4. Frontend Player Component
```typescript
interface VoiceFeedbackPlayerProps {
  sessionId: string;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  muted?: boolean;
}
```
- Invisible audio player
- Manages audio queue
- Provides feedback to VoiceWaveform for "AI speaking" visualization

### 5. Feedback Timing
- **Immediate**: Play as soon as ready (errors, clarifications)
- **After Silence**: Wait 500ms after user stops speaking (confirmations)
- **Interruptible**: Can be cancelled if user starts speaking

## Integration
- VoiceEditOrchestrator calls generateFeedback after each edit
- VoiceFeedbackPlayer in VoiceEditPanel handles playback
- VoiceWaveform switches to "AI speaking" mode during playback

## Success Criteria
- TTS response within 500ms of edit completion
- Natural, not robotic sounding
- Doesn't talk over user
- Can be muted while keeping visual feedback
```

---

## PROMPT 5: Element Selection Integration

**Difficulty**: MEDIUM | **Files**: ~400 lines | **Priority**: P0

```
Integrate the voice editing system with KripTik's visual editor element selection, enabling users to click an element and immediately start voice editing.

## Context
- Existing: useVisualEditorStore has SelectedElement with full context
- Existing: SelectionOverlay.tsx shows selection UI
- New: Need to connect voice panel to selection state
- Location: Update existing files + create src/hooks/useVoiceEditSession.ts

## Requirements

### 1. Voice Edit Session Hook
```typescript
interface VoiceEditSession {
  sessionId: string | null;
  status: 'idle' | 'connecting' | 'ready' | 'listening' | 'processing' | 'error';
  selectedElement: SelectedElement | null;
  transcript: string;
  interimTranscript: string;
  editHistory: EditHistoryItem[];
  error: string | null;

  // Actions
  startSession: () => Promise<void>;
  endSession: () => void;
  setSelectedElement: (element: SelectedElement | null) => void;
  undo: () => void;
  redo: () => void;
}

function useVoiceEditSession(): VoiceEditSession;
```

### 2. Selection → Voice Flow
When element is selected and voice panel is open:
1. Show element info in voice panel (tag, component, file:line)
2. Highlight element in preview with amber glow
3. Automatically focus on listening
4. Show element-specific suggestions ("Try: make it larger, change the color...")

### 3. Update SelectionOverlay.tsx
Add voice mode indicator:
- Amber microphone icon on selected element when voice listening
- Pulsing border during voice processing
- Green flash on successful edit
- Red flash on error

### 4. Voice Command Element Targeting
Handle commands that reference elements by description:
- "make the button larger" → find button in current selection context
- "change the heading color" → find h1/h2/h3 near current selection
- "make that one bigger" → use gesture/point tracking (future)

For now, require explicit element selection. Store last 5 selected elements for "the other one" references.

### 5. Multi-Select Voice Commands
When multiple elements selected:
- "make them all blue" → apply to all
- "make the first one larger" → select first, apply
- "space them out" → adjust gap/margin

### 6. Context Preservation Store
Extend useVisualEditorStore:
```typescript
interface VoiceEditContext {
  lastEditedElement: string | null;
  elementHistory: SelectedElement[];
  pendingEdit: CodeEdit | null;
  previewMode: boolean; // Show edit preview before applying
}
```

## Integration Points
- VoiceEditPanel reads from useVoiceEditSession
- SelectionOverlay shows voice mode indicators
- useVisualEditorStore provides element context
- VoiceEditOrchestrator receives element context for code generation

## Success Criteria
- Clicking element + speaking = edit (seamless flow)
- Element context correctly passed to edit generator
- Visual feedback on selection during voice mode
- History of edited elements accessible
```

---

## PROMPT 6: Context-Aware Edit Generator

**Difficulty**: HIGH | **Files**: ~500 lines | **Priority**: P0

```
Create the context-aware code edit generator that produces surgical edits preserving all existing wiring, integration, and functionality in KripTik AI.

## Context
- Location: server/src/services/ai/voice-edit-generator.ts
- Existing: CodeEdit interface defined in voice-edit-orchestrator.ts
- Critical: Edits must NOT recreate entire components or lose event handlers
- Uses: AST parsing for surgical edits, regex for simple property changes

## Requirements

### 1. Code Analysis
Before generating edits, analyze the target code:
```typescript
interface CodeAnalysis {
  file: string;
  line: number;

  // Element context
  element: {
    tagName: string;
    componentName?: string;
    isSelfDefined: boolean; // Component defined in this file
    importedFrom?: string;
  };

  // What must be preserved
  eventHandlers: { name: string; handler: string }[];
  props: { name: string; value: string; isSpread: boolean }[];
  children: { type: 'text' | 'element' | 'expression'; content: string }[];
  conditionalRendering?: string;
  mapFunction?: { array: string; itemVar: string };

  // Style information
  inlineStyles: Record<string, string>;
  tailwindClasses: string[];
  cssModuleClasses: string[];
  styledComponent?: boolean;

  // Dependencies
  imports: { name: string; from: string }[];
  usedHooks: string[];
  contextConsumers: string[];
}
```

### 2. Edit Strategies
Choose the least invasive strategy:

**Strategy 1: Tailwind Class Edit** (fastest, least risk)
- Only modifies className string
- Used for: colors, sizes, spacing, basic layout
```typescript
// Before: className="bg-blue-500 p-4"
// Command: "make it red"
// After: className="bg-red-500 p-4"
```

**Strategy 2: Inline Style Edit**
- Adds/modifies style prop
- Used for: precise values, dynamic values
```typescript
// Before: <div className="...">
// Command: "make it exactly 250 pixels wide"
// After: <div className="..." style={{ width: '250px' }}>
```

**Strategy 3: Prop Edit**
- Modifies prop values on component
- Used for: component-specific changes
```typescript
// Before: <Button size="md">
// Command: "make it larger"
// After: <Button size="lg">
```

**Strategy 4: Text Content Edit**
- Modifies text inside element
- Used for: "change the text to X"
```typescript
// Before: <Button>Submit</Button>
// Command: "change it to 'Send'"
// After: <Button>Send</Button>
```

**Strategy 5: Surgical AST Edit** (complex, for structure changes)
- Parses code with babel/typescript parser
- Makes targeted AST modifications
- Regenerates code preserving formatting
- Used for: adding props, reordering elements, complex changes

### 3. Preservation Rules
```typescript
const preservationRules = {
  // ALWAYS preserve
  mustPreserve: [
    'onClick', 'onChange', 'onSubmit', 'onKeyDown', // Event handlers
    'ref', 'key', 'id', 'data-testid', // Important attributes
    'href', 'src', 'alt', // Semantic attributes
    '{...props}', // Spread props
  ],

  // Only modify if explicitly requested
  conditionalPreserve: [
    'className', 'style', // Style-related
    'disabled', 'type', // State/behavior
    'children', // Content
  ],

  // Can remove if conflicting
  canModify: [
    'specific tailwind classes',
    'specific inline styles',
  ]
};
```

### 4. Edit Validation
Before applying, validate the edit:
```typescript
interface EditValidation {
  syntaxValid: boolean;
  preservationCheck: {
    allHandlersPreserved: boolean;
    allPropsPreserved: boolean;
    allImportsPresent: boolean;
  };
  sideEffects: string[]; // Other files that might need updates
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}
```

### 5. Rollback Support
Each edit generates a rollback:
```typescript
interface EditWithRollback {
  edit: CodeEdit;
  rollback: CodeEdit;
  description: string;
  timestamp: number;
}
```

### 6. Edit Templates
Pre-defined safe edit patterns:
```typescript
const editTemplates = {
  size: {
    larger: (current) => upscaleSize(current, 1.2),
    smaller: (current) => downscaleSize(current, 0.8),
    muchLarger: (current) => upscaleSize(current, 1.5),
  },
  color: {
    lighter: (current) => lightenColor(current, 0.2),
    darker: (current) => darkenColor(current, 0.2),
    // Named colors map to Tailwind palette
  },
  spacing: {
    moreSpace: (current) => increaseSpacing(current, 4),
    lessSpace: (current) => decreaseSpacing(current, 4),
  }
};
```

## Integration
- Called by VoiceEditOrchestrator with EditIntent
- Returns CodeEdit that can be applied safely
- Provides rollback for undo functionality

## Success Criteria
- 100% preservation of event handlers
- 100% preservation of props
- Valid syntax in generated code
- Minimal diff (only changes what's needed)
- TypeScript type-safe output
```

---

## PROMPT 7: Voice Edit Store & State Management

**Difficulty**: MEDIUM | **Files**: ~300 lines | **Priority**: P1

```
Create the Zustand store for voice editing state management in KripTik AI, handling session state, edit history, and real-time updates.

## Context
- Location: src/store/useVoiceEditStore.ts
- Pattern: Follow existing KripTik stores (subscribeWithSelector middleware)
- Integration: Connect to WebSocket for real-time updates

## Requirements

### 1. Store Definition
```typescript
interface VoiceEditState {
  // Session
  sessionId: string | null;
  status: 'idle' | 'connecting' | 'ready' | 'listening' | 'processing' | 'speaking' | 'error';
  error: string | null;

  // Audio
  audioLevel: number; // 0-1, real-time from MediaRecorder
  isUserSpeaking: boolean;
  isAISpeaking: boolean;

  // Transcription
  interimTranscript: string;
  finalTranscript: string;
  transcriptHistory: TranscriptEntry[];

  // Element context
  selectedElementId: string | null;
  elementContext: ElementContext | null;

  // Edit tracking
  pendingEdit: PendingEdit | null;
  editHistory: AppliedEdit[];
  undoStack: AppliedEdit[];
  redoStack: AppliedEdit[];

  // UI state
  showCapabilities: boolean;
  showPreview: boolean;
  feedbackMuted: boolean;

  // Actions
  startSession: () => Promise<void>;
  endSession: () => void;
  setSelectedElement: (elementId: string | null, context: ElementContext | null) => void;
  updateAudioLevel: (level: number) => void;
  setInterimTranscript: (text: string) => void;
  addFinalTranscript: (text: string) => void;
  setPendingEdit: (edit: PendingEdit | null) => void;
  applyEdit: (edit: AppliedEdit) => void;
  undo: () => void;
  redo: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: number;
  type: 'user' | 'ai';
}

interface PendingEdit {
  intent: EditIntent;
  preview?: string; // Preview of what will change
  confidence: number;
}

interface AppliedEdit {
  id: string;
  intent: EditIntent;
  codeEdit: CodeEdit;
  timestamp: number;
  elementId: string;
  spoken?: string; // AI's spoken response
}
```

### 2. WebSocket Integration
```typescript
// In store actions:
startSession: async () => {
  set({ status: 'connecting' });

  try {
    // Create session on backend
    const response = await fetch('/api/voice/realtime/session', {
      method: 'POST',
      credentials: 'include'
    });
    const { sessionId } = await response.json();

    // Connect WebSocket
    const ws = new WebSocket(`wss://api.kriptik.app/api/voice/realtime/${sessionId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'interim':
          set({ interimTranscript: data.transcript });
          break;
        case 'final':
          get().addFinalTranscript(data.transcript);
          break;
        case 'edit_applied':
          get().applyEdit(data.edit);
          break;
        // ... etc
      }
    };

    set({ sessionId, status: 'ready', ws });
  } catch (error) {
    set({ status: 'error', error: error.message });
  }
};
```

### 3. Audio Level Updates
Use requestAnimationFrame for smooth 60fps updates:
```typescript
updateAudioLevel: (level: number) => {
  // Only update if changed significantly (debounce visual noise)
  const current = get().audioLevel;
  if (Math.abs(level - current) > 0.02) {
    set({ audioLevel: level });
  }
};
```

### 4. Edit History Management
- Maximum 50 items in undo stack
- Clear redo stack on new edit
- Persist to localStorage for recovery

### 5. Selectors
```typescript
// Derived state selectors
export const selectCanUndo = (state: VoiceEditState) => state.undoStack.length > 0;
export const selectCanRedo = (state: VoiceEditState) => state.redoStack.length > 0;
export const selectIsActive = (state: VoiceEditState) =>
  ['listening', 'processing', 'speaking'].includes(state.status);
export const selectHasElement = (state: VoiceEditState) => state.selectedElementId !== null;
```

## Integration
- VoiceEditPanel.tsx consumes this store
- VoiceWaveform.tsx uses audioLevel and speaking states
- useVoiceEditSession.ts wraps store for component API
- Connect to useVisualEditorStore for element selection sync

## Success Criteria
- Real-time state updates without dropped frames
- Proper WebSocket lifecycle management
- Undo/redo works correctly
- State persists across page navigations (for recovery)
```

---

## PROMPT 8: Developer Toolbar Integration

**Difficulty**: LOW | **Files**: ~100 lines | **Priority**: P1

```
Integrate the Voice Edit feature into KripTik's developer toolbar, replacing the generic panel with the premium VoiceEditPanel and adding the hover preview.

## Context
- File: src/components/developer-bar/DeveloperBarPanel.tsx
- File: src/components/developer-bar/DeveloperBar.tsx
- New: Import and wire VoiceEditPanel
- Add: VoicePreviewHover on voice button hover

## Requirements

### 1. Update DeveloperBarPanel.tsx

Replace the GenericPanel for 'voice-first':
```typescript
import { VoiceEditPanel } from '../voice-edit/VoiceEditPanel';

// In FEATURE_PANELS:
'voice-first': {
  title: 'Voice Edit',
  icon: 'voiceFirst',
  component: VoiceEditPanelWrapper,
  fullWidth: true
}

// Create wrapper component
const VoiceEditPanelWrapper = ({ isActive, onClose }: { isActive: boolean; onClose: () => void }) => {
  return <VoiceEditPanel isOpen={isActive} onClose={onClose} />;
};
```

### 2. Update DeveloperBar.tsx

Add hover preview for voice button:
```typescript
import { VoicePreviewHover } from '../voice-edit/VoicePreviewHover';

// In GlassPillButton, add hover preview for voice:
{feature.id === 'voice-first' && isHovered && (
  <VoicePreviewHover position="above" />
)}
```

### 3. Move Voice Button to Prominent Position

Reorder FEATURE_BUTTONS so 'voice-first' is in the first page:
```typescript
const FEATURE_BUTTONS: FeatureButton[] = [
  { id: 'feature-agent', name: 'Feature Agent', icon: 'agents', category: 'core' },
  { id: 'voice-first', name: 'Voice Edit', icon: 'voiceFirst', category: 'core' }, // Moved up!
  { id: 'open-source-studio', name: 'Open Source', icon: 'openSourceStudio', category: 'ai' },
  // ... rest
];
```

### 4. Visual Enhancements

Add voice-specific styling to the toolbar button:
- Animated sound wave icon when voice session active
- Amber glow when listening
- Subtle pulse animation when available

Update developer-bar.css:
```css
.glass-pill--voice-active {
  animation: voice-pulse 2s ease-in-out infinite;
}

.glass-pill--voice-active .glass-pill__glow {
  background: radial-gradient(ellipse at center, rgba(245, 168, 108, 0.6) 0%, transparent 70%);
}

@keyframes voice-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(245, 168, 108, 0.3); }
  50% { box-shadow: 0 0 30px rgba(245, 168, 108, 0.5); }
}
```

### 5. State Connection

Connect toolbar to voice edit state:
```typescript
import { useVoiceEditStore } from '@/store/useVoiceEditStore';

// In DeveloperBar:
const voiceStatus = useVoiceEditStore(state => state.status);
const isVoiceActive = ['listening', 'processing', 'speaking'].includes(voiceStatus);

// Pass to GlassPillButton:
<GlassPillButton
  feature={feature}
  isActive={activeFeatures.includes(feature.id) || (feature.id === 'voice-first' && isVoiceActive)}
  // ...
/>
```

## Success Criteria
- Voice button prominently visible (first page of toolbar)
- Hover shows animated preview
- Button glows when voice session active
- Panel opens with premium VoiceEditPanel
```

---

## PROMPT 9: Audio Processing & Browser Integration

**Difficulty**: MEDIUM | **Files**: ~200 lines | **Priority**: P1

```
Create the browser audio processing module for real-time voice capture in KripTik AI, handling microphone access, audio processing, and WebSocket streaming.

## Context
- Location: src/lib/audio-capture.ts
- Also create: src/hooks/useAudioCapture.ts
- Uses: MediaRecorder API, Web Audio API for level detection
- Streams to: Backend WebSocket at /api/voice/realtime/:sessionId

## Requirements

### 1. Audio Capture Module
```typescript
interface AudioCaptureConfig {
  sampleRate?: number; // Default 16000
  channelCount?: number; // Default 1 (mono)
  echoCancellation?: boolean; // Default true
  noiseSuppression?: boolean; // Default true
  autoGainControl?: boolean; // Default true
}

interface AudioCaptureCallbacks {
  onAudioLevel: (level: number) => void;
  onAudioChunk: (chunk: Blob) => void;
  onError: (error: Error) => void;
  onStateChange: (state: 'inactive' | 'recording' | 'paused') => void;
}

class AudioCapture {
  constructor(config?: AudioCaptureConfig);

  async start(): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;

  getState(): 'inactive' | 'recording' | 'paused';
  getMimeType(): string;

  on<K extends keyof AudioCaptureCallbacks>(
    event: K,
    callback: AudioCaptureCallbacks[K]
  ): void;
  off<K extends keyof AudioCaptureCallbacks>(
    event: K,
    callback: AudioCaptureCallbacks[K]
  ): void;
}
```

### 2. Audio Level Detection
Use Web Audio API for real-time level detection:
```typescript
function createLevelDetector(stream: MediaStream): {
  getLevel: () => number;
  destroy: () => void;
} {
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);

  analyser.fftSize = 256;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  return {
    getLevel: () => {
      analyser.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      return sum / (dataArray.length * 255); // Normalized 0-1
    },
    destroy: () => {
      source.disconnect();
      audioContext.close();
    }
  };
}
```

### 3. React Hook
```typescript
interface UseAudioCaptureOptions {
  sessionId: string | null;
  enabled: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
}

interface UseAudioCaptureReturn {
  isCapturing: boolean;
  audioLevel: number;
  error: Error | null;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

function useAudioCapture(options: UseAudioCaptureOptions): UseAudioCaptureReturn;
```

### 4. WebSocket Streaming
```typescript
function createAudioStream(sessionId: string, onMessage: (event: MessageEvent) => void) {
  const ws = new WebSocket(`wss://${API_HOST}/api/voice/realtime/${sessionId}`);

  return {
    send: (chunk: Blob) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    },
    close: () => ws.close(),
    ws
  };
}
```

### 5. Error Handling
Handle common audio errors gracefully:
- Microphone permission denied → Show permission request UI
- No audio input device → Show error message
- WebSocket disconnect → Auto-reconnect with backoff
- Browser not supported → Fall back to file upload

### 6. Browser Support
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: May need WebM polyfill
- Mobile: Handle interruptions (calls, etc.)

## Integration
- useVoiceEditStore calls useAudioCapture
- Audio chunks sent to backend WebSocket
- Audio levels update store for visualization
- Errors surface to UI

## Success Criteria
- Sub-100ms audio capture latency
- Smooth 60fps level visualization
- Graceful error handling
- Works on Chrome, Firefox, Safari, Edge
- Handles permission flow correctly
```

---

## PROMPT 10: Final Integration & Polish

**Difficulty**: MEDIUM | **Files**: Updates to multiple files | **Priority**: P2

```
Complete the Voice Editing UI integration in KripTik AI with final polish, error states, loading states, and comprehensive testing.

## Context
This prompt brings together all previous prompts and adds polish.

## Requirements

### 1. Loading States
Create smooth loading states for:
- Session initialization: "Connecting to voice service..."
- First audio: "Warming up microphone..."
- Processing edit: "Applying changes..." with progress indicator
- TTS loading: "Generating response..."

### 2. Error States & Recovery
Handle all error scenarios:
```typescript
const errorMessages = {
  mic_permission: "Microphone access needed. Click to allow.",
  no_mic: "No microphone found. Please connect one.",
  websocket_failed: "Connection lost. Reconnecting...",
  transcription_failed: "Couldn't understand. Please try again.",
  edit_failed: "Couldn't apply that change. Try rephrasing.",
  element_not_found: "Can't find that element. Select one first.",
};
```

### 3. Onboarding Flow
First-time user experience:
1. Show capabilities overlay on first open
2. Animate through examples
3. "Try saying: 'make it larger'" prompt
4. Celebrate first successful edit

### 4. Accessibility
- ARIA labels for all interactive elements
- Keyboard navigation (Tab through controls)
- Screen reader announcements for state changes
- Reduced motion mode (disable waveform animation)

### 5. Performance Optimization
- Lazy load voice components (code split)
- Debounce audio level updates
- Memoize complex computations
- Use React.memo for static components

### 6. Analytics Events
Track usage for improvement:
- voice_edit_session_started
- voice_edit_command_issued
- voice_edit_success
- voice_edit_failure (with reason)
- voice_edit_undo
- voice_edit_session_ended

### 7. Testing Requirements
Create test files:
- VoiceEditPanel.test.tsx - Component tests
- voice-edit-orchestrator.test.ts - Unit tests
- voice-edit-generator.test.ts - Edit generation tests
- Integration test for full flow

### 8. Documentation
Update:
- CLAUDE.md - Add Voice Edit to feature list
- README.md - Add voice editing section
- .claude/rules/01-session-context.md - Document completion

### 9. Final Checklist
Before marking complete:
- [ ] npm run build passes
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Works on Chrome, Firefox, Safari
- [ ] Mobile responsive (shows "Desktop only" message)
- [ ] Animations at 60fps
- [ ] All error states handled
- [ ] Undo/redo works
- [ ] TTS feedback works
- [ ] Element selection integration works
- [ ] Preserves event handlers in edits
- [ ] Memory files updated

## Success Criteria
- Complete, polished voice editing experience
- No rough edges or missing states
- Documentation updated
- Tests passing
- Ready for production
```

---

## EXECUTION ORDER

1. **Prompt 1**: Real-Time Voice Streaming Service (backend foundation)
2. **Prompt 2**: Voice Edit Orchestrator Service (command interpretation)
3. **Prompt 6**: Context-Aware Edit Generator (code generation)
4. **Prompt 9**: Audio Processing & Browser Integration (frontend audio)
5. **Prompt 7**: Voice Edit Store & State Management (Zustand)
6. **Prompt 3**: Premium Voice Editing UI Component (main UI)
7. **Prompt 5**: Element Selection Integration (connect to visual editor)
8. **Prompt 4**: Voice Feedback TTS Integration (spoken responses)
9. **Prompt 8**: Developer Toolbar Integration (wire to toolbar)
10. **Prompt 10**: Final Integration & Polish (complete)

---

## DEPENDENCIES

- **Deepgram API Key** - For streaming transcription (DEEPGRAM_API_KEY)
- **ElevenLabs API Key** - For TTS feedback (existing ELEVENLABS_API_KEY)
- **OpenAI API Key** - For fallback transcription (existing OPENAI_API_KEY)

## NOTES

- Each prompt should result in `npm run build` passing
- Commit after each prompt with descriptive message
- Update session context after significant progress
- Use browser DevTools to verify 60fps animations
- Test with actual microphone input, not just mocks
