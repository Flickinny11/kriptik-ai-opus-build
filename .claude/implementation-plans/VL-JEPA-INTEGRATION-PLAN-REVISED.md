# VL-JEPA Integration Implementation Plan (REVISED)

> **Created**: 2026-01-21
> **Revised**: 2026-01-21 (Corrected for Video Understanding)
> **Purpose**: Comprehensive VL-JEPA/V-JEPA 2 integration for temporal video understanding
> **Key Insight**: V-JEPA 2's temporal reasoning is CRITICAL for Fix My App and Clone Mode

---

## Why Video Understanding Matters

### The User's Insight (Correct)

The original plan incorrectly dismissed V-JEPA 2's video capabilities as "video-only" and used SigLIP as a substitute. This was wrong because:

1. **Fix My App Feature** requires navigating another AI builder's chat history by:
   - Scrolling through the entire conversation (temporal sequence)
   - Understanding what the user built step-by-step over time
   - Detecting where things went wrong in the build process
   - Analyzing the sequence of user actions and AI responses

2. **Clone Mode** requires:
   - Recording screen interactions as video
   - Understanding user journey across frames
   - Detecting UI changes over time
   - Reconstructing the flow of an app

3. **Build Verification** requires:
   - Watching the built app work (demo video)
   - Verifying temporal behavior (animations, transitions, state changes)
   - Detecting runtime issues that only appear during interaction

**V-JEPA 2 is EXACTLY what's needed** - it's a "world model" that understands temporal sequences, action anticipation, and cause-effect relationships.

---

## Architecture: Hybrid Vision Pipeline

### Current State (Incomplete)

```
Current: Screenshots → Gemini 3 Flash → Individual Frame Analysis
Problem: No temporal understanding, each frame analyzed independently
```

### Target State (Correct)

```
Target: Video/Sequence → V-JEPA 2 → Temporal Understanding
        ↓
        Individual Frames → Gemini 3 Flash → Element Extraction
        ↓
        Combined Output → Comprehensive Understanding
```

### Model Responsibilities

| Model | Responsibility | Strength |
|-------|---------------|----------|
| **V-JEPA 2** | Temporal understanding, action anticipation, sequence analysis | Understanding WHAT happened over time |
| **Gemini 3 Flash** | Individual frame analysis, text extraction, UI element detection | Understanding WHAT is visible now |
| **SigLIP 2** | Image embeddings, visual similarity search | Finding similar designs |
| **BGE-M3** | Text embeddings, intent matching | Understanding text/intent |

---

## V-JEPA 2 Technical Details

### Model Specifications
- **Model**: `facebook/vjepa2-vitl-fpc64-256` (1.2B parameters)
- **Output**: 1024-dimensional embeddings
- **Input**: Up to 64 frames at 256x256 resolution
- **Training**: 1M+ hours of internet video
- **Benchmarks**:
  - 77.3% on Something-Something v2 (motion understanding)
  - 39.7 recall on Epic-Kitchens (action anticipation)
  - 84.0% on PerceptionTest (video QA)
  - 76.9% on TempCompass (temporal reasoning)

### Key Capabilities
1. **Motion Understanding**: Understands physical movements and interactions
2. **Action Anticipation**: Predicts what will happen next
3. **Temporal Reasoning**: Understands cause-effect over time
4. **World Model**: Represents physical world dynamics
5. **Zero-shot Planning**: Plans actions without task-specific training

### Inference Setup
```python
from transformers import AutoVideoProcessor, AutoModel

model = AutoModel.from_pretrained("facebook/vjepa2-vitl-fpc64-256")
processor = AutoVideoProcessor.from_pretrained("facebook/vjepa2-vitl-fpc64-256")

# Process video frames
inputs = processor(videos=frames, return_tensors="pt")
outputs = model(**inputs)
embeddings = outputs.last_hidden_state  # Temporal embeddings
```

---

## Critical Use Cases for V-JEPA 2

### 1. Fix My App - Chat History Understanding

**Current Flow** (Incomplete):
```
Screenshot → Gemini 3 Flash → "Is there more content above?" → Scroll
Screenshot → Gemini 3 Flash → "Is there more content above?" → Scroll
... (repeat 50+ times)
```

**Target Flow** (With V-JEPA 2):
```
1. Record scroll session as video (screen recording or frame sequence)
2. V-JEPA 2 analyzes the temporal sequence:
   - Understands the flow of conversation
   - Identifies key moments (errors, pivots, breakthroughs)
   - Detects user frustration patterns
   - Maps the build journey over time
3. Gemini 3 Flash extracts text/code from key frames
4. Combined: Complete understanding of what went wrong and why
```

### 2. Clone Mode - Interaction Recording

**Current Flow** (Basic):
```
Frame 1 → Basic comparison → "Is this a keyframe?"
Frame 2 → Basic comparison → "Is this a keyframe?"
... (no temporal understanding)
```

**Target Flow** (With V-JEPA 2):
```
1. V-JEPA 2 analyzes interaction video:
   - Understands click sequences and their effects
   - Identifies state transitions
   - Maps user journey through the app
   - Predicts intended user flow
2. Output: Structured user journey with temporal context
```

### 3. Build Verification - Demo Analysis

**Current Flow** (None):
```
(No video verification currently)
```

**Target Flow** (With V-JEPA 2):
```
1. Record browser demo as video
2. V-JEPA 2 analyzes demo:
   - Verifies animations work correctly
   - Checks state transitions
   - Detects visual glitches or timing issues
   - Confirms user flows work end-to-end
3. Output: Demo quality score + issues detected
```

---

## Implementation Prompts (Revised)

### Phase 1: V-JEPA 2 RunPod Worker (Critical)

#### Prompt 1.1: Create True V-JEPA 2 Handler

```
Task: Create a RunPod serverless handler that uses actual V-JEPA 2 for temporal video understanding.

File to create:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/embeddings/runpod-workers/vjepa2/handler.py

This replaces the current handler that uses SigLIP as a substitute.

V-JEPA 2 Model: facebook/vjepa2-vitl-fpc64-256
- 1.2B parameters
- 1024-dimensional output
- Up to 64 frames input
- 256x256 resolution per frame

Handler Input Types:

1. "temporal_sequence" - Analyze a sequence of screenshots/frames:
   {
     "input": {
       "type": "temporal_sequence",
       "frames": ["base64...", "base64...", ...],  // 8-64 frames
       "context": "Fix My App chat scroll capture"
     }
   }
   Output: Temporal embeddings + key moment detection

2. "video_understanding" - Analyze a video file:
   {
     "input": {
       "type": "video_understanding",
       "video": "base64... or URL",
       "query": "What is the user trying to build?"
     }
   }
   Output: Video embeddings + understanding summary

3. "action_prediction" - Predict next action:
   {
     "input": {
       "type": "action_prediction",
       "frames": ["recent_frame_1", "recent_frame_2", ...],
       "history": ["scroll_up", "click", "wait"]
     }
   }
   Output: Predicted next action + confidence

4. "demo_verification" - Verify app demo:
   {
     "input": {
       "type": "demo_verification",
       "video": "base64... or URL",
       "expected_behaviors": ["button click opens modal", "form submits"]
     }
   }
   Output: Verification results per expected behavior

Implementation Requirements:
1. Use HuggingFace Transformers: AutoVideoProcessor, AutoModel
2. Cache model in /models volume for faster cold starts
3. Handle CUDA if available, fall back to CPU
4. Use safetensors to bypass CVE-2025-32434
5. Frame preprocessing: resize to 256x256, normalize
6. Batch processing for efficiency
7. Return both embeddings and structured analysis

Cold Start Optimization:
- Model is 1.2B params, ~45-60s cold start on A4000
- Pre-warm by loading model at container start
- Cache processor and model in memory

DO NOT use placeholder code. This must process actual video/sequences.
```

---

#### Prompt 1.2: Create V-JEPA 2 TypeScript Provider

```
Task: Create a TypeScript provider for the V-JEPA 2 RunPod endpoint.

File to create:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/embeddings/providers/vjepa2-provider.ts

This is a NEW provider specifically for V-JEPA 2 (not the existing VL-JEPA substitute).

Provider Interface:
export interface VJEPA2Provider {
  // Analyze temporal sequence (for Fix My App scroll capture)
  analyzeTemporalSequence(
    frames: Buffer[],
    context: string
  ): Promise<TemporalAnalysis>;

  // Analyze video (for Clone Mode)
  analyzeVideo(
    video: Buffer | string,
    query?: string
  ): Promise<VideoAnalysis>;

  // Predict next action (for browser automation)
  predictNextAction(
    recentFrames: Buffer[],
    actionHistory: string[]
  ): Promise<ActionPrediction>;

  // Verify demo (for build verification)
  verifyDemo(
    video: Buffer | string,
    expectedBehaviors: string[]
  ): Promise<DemoVerification>;

  // Health check
  healthCheck(): Promise<ProviderHealth>;
}

Return Types:

interface TemporalAnalysis {
  embeddings: number[];  // 1024-dim temporal embedding
  keyMoments: KeyMoment[];
  flowSummary: string;
  detectedPatterns: string[];
  confidence: number;
  latencyMs: number;
}

interface KeyMoment {
  frameIndex: number;
  timestamp: number;
  type: 'error' | 'success' | 'pivot' | 'frustration' | 'breakthrough';
  description: string;
  confidence: number;
}

interface VideoAnalysis {
  embeddings: number[];
  userJourney: JourneyStep[];
  intentSummary: string;
  detectedIssues: Issue[];
  recommendations: string[];
}

interface ActionPrediction {
  predictedAction: 'scroll_up' | 'scroll_down' | 'click' | 'wait' | 'done';
  confidence: number;
  reasoning: string;
  alternativeActions: ActionPrediction[];
}

interface DemoVerification {
  overallScore: number;
  behaviors: BehaviorCheck[];
  issues: VisualIssue[];
  passed: boolean;
}

Implementation Requirements:
1. Retry logic with exponential backoff (V-JEPA 2 has longer cold starts)
2. Frame preprocessing before sending (resize, base64 encode)
3. Batch frame encoding for efficiency
4. Timeout handling (60s+ for cold starts)
5. Cost tracking (higher cost than SigLIP due to model size)

Environment Variables:
- RUNPOD_API_KEY
- RUNPOD_ENDPOINT_VJEPA2 (new endpoint, separate from VL-JEPA substitute)

DO NOT use placeholder code. This must call actual RunPod endpoint.
```

---

### Phase 2: Integrate V-JEPA 2 into Fix My App

#### Prompt 2.1: Enhance Capture Orchestrator with Temporal Understanding

```
Task: Enhance the CaptureOrchestrator to use V-JEPA 2 for temporal understanding during chat history capture.

File to modify:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/vision-capture/capture-orchestrator.ts

Current behavior (lines 271-383):
- Takes individual screenshots
- Uses Gemini 3 Flash to analyze each frame
- No temporal understanding across frames

New behavior with V-JEPA 2:

1. Frame Collection Phase:
   - Collect screenshots as before, but store them in a buffer
   - Every 8-16 frames, send batch to V-JEPA 2 for temporal analysis

2. Temporal Analysis Phase:
   - V-JEPA 2 analyzes the sequence to understand:
     - Where are the key moments in the conversation?
     - What is the overall flow/journey?
     - Where did things go wrong?
     - What patterns indicate user frustration?

3. Smart Capture Strategy:
   - V-JEPA 2 predicts where to focus attention
   - Prioritize frames around key moments
   - Skip redundant frames that don't add information

4. Combined Output:
   - Gemini 3 Flash: Extracted text/code from frames
   - V-JEPA 2: Temporal context and journey understanding
   - Result: Complete understanding of the build history

Add to CaptureOrchestrator class:

private vjepa2Provider: VJEPA2Provider;
private frameBuffer: Buffer[] = [];
private readonly TEMPORAL_BATCH_SIZE = 16;

// In captureChatHistory method, add:
if (this.frameBuffer.length >= this.TEMPORAL_BATCH_SIZE) {
  const temporalAnalysis = await this.vjepa2Provider.analyzeTemporalSequence(
    this.frameBuffer,
    `Scrolling through ${session.platform} chat history`
  );

  // Use temporal analysis to inform capture strategy
  for (const keyMoment of temporalAnalysis.keyMoments) {
    if (keyMoment.type === 'error' || keyMoment.type === 'frustration') {
      // Mark this area for detailed extraction
      await this.extractDetailedContent(keyMoment.frameIndex);
    }
  }

  this.frameBuffer = []; // Reset buffer
}

Import:
import { getVJEPA2Provider, VJEPA2Provider } from '../embeddings/providers/vjepa2-provider.js';

DO NOT use placeholder code. This must integrate real temporal analysis.
```

---

#### Prompt 2.2: Enhance Fix Orchestrator with Temporal Journey Understanding

```
Task: Enhance the FixOrchestrator to use V-JEPA 2 temporal analysis for understanding the user's build journey.

File to modify:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/fix-my-app/fix-orchestrator.ts

Current behavior:
- Parses chat history as text
- Analyzes intent from messages
- Creates fix strategy

Enhanced behavior with V-JEPA 2:

1. Before text analysis, run V-JEPA 2 on captured frame sequence:
   - Get temporal embeddings of the entire build journey
   - Identify key moments (errors, pivots, breakthroughs)
   - Detect user frustration patterns
   - Map cause-effect relationships

2. Use temporal insights to enhance Intent Lock:
   - "User started building X, encountered error at step Y"
   - "User pivoted from approach A to approach B after error"
   - "These are the moments where the build went wrong"

3. Create temporal-aware fix strategy:
   - Don't just fix the final error, fix the root cause
   - Understand the sequence of decisions that led here
   - Recommend a path that avoids the frustration points

New method to add:

async analyzeUserJourney(
  capturedFrames: Buffer[],
  chatHistory: ChatMessage[]
): Promise<UserBuildJourney> {
  // Get temporal analysis from V-JEPA 2
  const temporalAnalysis = await this.vjepa2Provider.analyzeTemporalSequence(
    capturedFrames,
    'User build journey from AI builder'
  );

  // Correlate temporal key moments with chat messages
  const journey: UserBuildJourney = {
    phases: [],
    criticalMoments: [],
    frustrationPoints: [],
    successfulPatterns: [],
    rootCauseAnalysis: null
  };

  for (const keyMoment of temporalAnalysis.keyMoments) {
    // Find corresponding chat messages
    const relevantMessages = this.findMessagesNearFrame(
      keyMoment.frameIndex,
      chatHistory
    );

    journey.phases.push({
      type: keyMoment.type,
      description: keyMoment.description,
      messages: relevantMessages,
      visualContext: temporalAnalysis.embeddings
    });

    if (keyMoment.type === 'error' || keyMoment.type === 'frustration') {
      journey.frustrationPoints.push({
        moment: keyMoment,
        analysis: await this.analyzeRootCause(keyMoment, relevantMessages)
      });
    }
  }

  return journey;
}

DO NOT use placeholder code. This must use real temporal analysis.
```

---

### Phase 3: Integrate V-JEPA 2 into Clone Mode

#### Prompt 3.1: Enhance Video-to-Code with Temporal Understanding

```
Task: Enhance VideoToCodeService to use V-JEPA 2 for true temporal understanding of screen recordings.

File to modify:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/ai/video-to-code.ts

Current behavior (lines 493-544):
- Basic frame comparison using base64 string sampling
- No understanding of temporal relationships
- Keyframe detection based on visual similarity only

Enhanced behavior with V-JEPA 2:

1. Replace basic keyframe detection with V-JEPA 2 temporal analysis:
   - V-JEPA 2 understands SEMANTIC changes, not just visual changes
   - Detects meaningful state transitions
   - Identifies user interaction sequences

2. Enhanced user journey building:
   - V-JEPA 2 provides action anticipation
   - Understands cause-effect (click → modal opens)
   - Maps the intended user flow

3. Better interaction detection:
   - V-JEPA 2 trained on 1M+ hours of video
   - Understands physical interactions
   - Can predict what should happen next

Replace detectKeyframes method:

private async detectKeyframesWithVJEPA2(
  frames: VideoFrame[]
): Promise<VideoFrame[]> {
  // Convert frames to Buffer array for V-JEPA 2
  const frameBuffers = await Promise.all(
    frames.map(f => Buffer.from(f.image, 'base64'))
  );

  // Get temporal analysis from V-JEPA 2
  const temporalAnalysis = await this.vjepa2Provider.analyzeTemporalSequence(
    frameBuffers,
    'Screen recording for clone mode'
  );

  // Mark keyframes based on V-JEPA 2's understanding of semantic changes
  for (const keyMoment of temporalAnalysis.keyMoments) {
    frames[keyMoment.frameIndex].keyframe = true;
    frames[keyMoment.frameIndex].temporalContext = {
      type: keyMoment.type,
      description: keyMoment.description,
      confidence: keyMoment.confidence
    };
  }

  // Also mark first and last frames
  frames[0].keyframe = true;
  frames[frames.length - 1].keyframe = true;

  return frames;
}

Replace detectInteractions method:

private async detectInteractionsWithVJEPA2(
  frames: VideoFrame[]
): Promise<InteractionDetection[]> {
  const frameBuffers = await Promise.all(
    frames.map(f => Buffer.from(f.image, 'base64'))
  );

  // V-JEPA 2 understands interactions from video
  const videoAnalysis = await this.vjepa2Provider.analyzeVideo(
    frameBuffers, // Or combine into video
    'Identify all user interactions in this screen recording'
  );

  return videoAnalysis.userJourney.map((step, i) => ({
    id: uuidv4(),
    type: this.mapInteractionType(step.action),
    timestamp: frames[i]?.timestamp || 0,
    elementId: step.targetElement,
    position: step.position,
    confidence: step.confidence
  }));
}

DO NOT use placeholder code. This must use real V-JEPA 2 temporal analysis.
```

---

### Phase 4: Build Demo Verification

#### Prompt 4.1: Create Demo Verification Service

```
Task: Create a new service that uses V-JEPA 2 to verify that built apps work correctly.

File to create:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/verification/demo-verification-service.ts

This service runs after BuildLoopOrchestrator's Phase 5 (Intent Satisfaction) and verifies that the built app actually works by analyzing a demo video.

Service Purpose:
1. Record a demo of the built app (via Playwright)
2. Use V-JEPA 2 to analyze the demo video
3. Verify expected behaviors occur
4. Detect visual glitches, timing issues, broken animations
5. Score the demo quality

Interface:

export interface DemoVerificationService {
  // Record and verify a demo
  recordAndVerify(
    appUrl: string,
    expectedBehaviors: ExpectedBehavior[],
    options?: VerificationOptions
  ): Promise<VerificationResult>;

  // Verify existing video
  verifyVideo(
    video: Buffer,
    expectedBehaviors: ExpectedBehavior[]
  ): Promise<VerificationResult>;
}

interface ExpectedBehavior {
  action: string;  // "click login button"
  expectedResult: string;  // "modal opens with login form"
  critical: boolean;  // If this fails, the build failed
}

interface VerificationResult {
  passed: boolean;
  score: number;  // 0-100
  behaviors: BehaviorVerification[];
  issues: VisualIssue[];
  demoVideo: Buffer;
  temporalAnalysis: TemporalAnalysis;
}

interface BehaviorVerification {
  behavior: ExpectedBehavior;
  verified: boolean;
  confidence: number;
  timestamp: number;
  frameIndex: number;
  evidence: string;  // Description of what V-JEPA 2 saw
}

interface VisualIssue {
  type: 'glitch' | 'timing' | 'animation' | 'layout' | 'missing_element';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  frameIndex: number;
  suggestion: string;
}

Implementation:

1. Recording Phase:
   - Launch Playwright browser
   - Navigate to built app
   - Execute scripted interactions based on expectedBehaviors
   - Capture as video or frame sequence

2. Analysis Phase:
   - Send video to V-JEPA 2 for temporal analysis
   - V-JEPA 2 understands what happened:
     - Did the button click cause a modal to open?
     - Did the animation play smoothly?
     - Did state transitions occur correctly?

3. Verification Phase:
   - Compare V-JEPA 2's analysis to expectedBehaviors
   - Mark each behavior as verified or failed
   - Calculate overall score

4. Issue Detection Phase:
   - V-JEPA 2 detects visual anomalies
   - Identifies timing issues (too fast/slow)
   - Finds missing expected elements

Integration with BuildLoopOrchestrator:
- Add as Phase 5.5 (after Intent Satisfaction, before Browser Demo)
- If verification fails critical behaviors, trigger Gap Closers
- Include in build success criteria

DO NOT use placeholder code. This must use real V-JEPA 2 verification.
```

---

### Phase 5: Browser Automation Enhancement

#### Prompt 5.1: Enhance Browser Worker with V-JEPA 2 Action Prediction

```
Task: Enhance browser automation with V-JEPA 2 action prediction for smarter navigation.

File to modify:
/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/src/services/vision-capture/browser-worker.ts

Current behavior:
- Gemini 3 Flash analyzes each screenshot
- Decides next action based on single frame

Enhanced behavior with V-JEPA 2:

1. Maintain rolling frame buffer (last 8 frames)
2. Use V-JEPA 2 to predict optimal next action
3. V-JEPA 2 understands temporal context:
   - "We've been scrolling up, we should be near the top"
   - "The last 3 clicks didn't change anything, try different approach"
   - "This looks like an infinite scroll, stop condition detected"

New method to add:

private frameBuffer: Buffer[] = [];
private readonly PREDICTION_BUFFER_SIZE = 8;

async getSmartNextAction(
  sessionId: string,
  goal: string,
  actionHistory: string[]
): Promise<VisionAction> {
  const currentScreenshot = await this.screenshot(sessionId);

  // Add to rolling buffer
  this.frameBuffer.push(currentScreenshot);
  if (this.frameBuffer.length > this.PREDICTION_BUFFER_SIZE) {
    this.frameBuffer.shift();
  }

  // Get V-JEPA 2 action prediction based on temporal context
  const prediction = await this.vjepa2Provider.predictNextAction(
    this.frameBuffer,
    actionHistory
  );

  if (prediction.confidence > 0.8) {
    // High confidence, use V-JEPA 2's prediction
    return this.mapPredictionToAction(prediction);
  } else {
    // Low confidence, fall back to Gemini 3 Flash single-frame analysis
    return await this.visionClient.analyzeUIState(currentScreenshot, goal);
  }
}

Benefits:
1. Smarter scroll detection (knows when near top/bottom)
2. Avoids infinite loops (detects repetitive patterns)
3. Faster convergence (predicts based on temporal patterns)
4. Better error recovery (understands what led to current state)

DO NOT use placeholder code. This must use real V-JEPA 2 prediction.
```

---

## RunPod Deployment Configuration

### V-JEPA 2 Specific Requirements

```yaml
# V-JEPA 2 Endpoint Configuration
name: kriptik-vjepa2-temporal
dockerImage: kriptikai/kriptik-vjepa2:v1
gpuType: NVIDIA RTX A4000  # Minimum 16GB VRAM
minWorkers: 0
maxWorkers: 2
idleTimeout: 180  # Longer timeout due to 60s cold start
scalerType: QUEUE_DELAY
scalerValue: 8  # Higher delay tolerance for temporal processing

# Container Optimization
environment:
  - CUDA_VISIBLE_DEVICES=0
  - TRANSFORMERS_CACHE=/models
  - HF_HOME=/models

volumes:
  - /models:/models  # Persistent model cache

# Resource Limits
resources:
  memory: 24Gi  # Model needs ~8GB + processing buffer
  gpu_memory: 16Gi
```

### Dockerfile for V-JEPA 2

```dockerfile
FROM pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    runpod \
    transformers>=4.40.0 \
    torch>=2.2.0 \
    pillow \
    numpy \
    av  # For video processing

# Pre-download model
RUN python -c "from transformers import AutoModel, AutoVideoProcessor; \
    AutoModel.from_pretrained('facebook/vjepa2-vitl-fpc64-256'); \
    AutoVideoProcessor.from_pretrained('facebook/vjepa2-vitl-fpc64-256')"

COPY handler.py /app/

CMD ["python", "handler.py"]
```

---

## Cost Analysis (Revised)

### V-JEPA 2 vs Current Approach

| Metric | Current (Gemini only) | With V-JEPA 2 |
|--------|----------------------|---------------|
| API calls per capture | 50-100 | 10-20 |
| Understanding depth | Surface (frame-by-frame) | Deep (temporal) |
| Accuracy | 70% (misses context) | 90%+ (understands flow) |
| Cold start | 5s (Gemini) | 60s (V-JEPA 2) |
| Cost per capture | ~$0.015 | ~$0.025 |

### Monthly Cost Estimates

| Component | Monthly Usage | Cost |
|-----------|--------------|------|
| V-JEPA 2 (A4000) | 50 hrs | $12 |
| Gemini 3 Flash | 100k calls | $50 |
| BGE-M3 | 100 hrs | $24 |
| SigLIP | 100 hrs | $24 |
| **Total** | | **~$110** |

---

## Success Metrics

After implementation, verify:

1. **V-JEPA 2 Deployment**: Endpoint responds to temporal sequence requests
2. **Fix My App**: Captures complete chat history with journey understanding
3. **Clone Mode**: Generates user journey from video with 90%+ accuracy
4. **Demo Verification**: Correctly identifies 95%+ of expected behaviors
5. **Browser Automation**: 50% fewer API calls due to smart prediction
6. **Build Success**: Overall build success rate improves by 15%+

---

## References

- [V-JEPA 2 Paper](https://arxiv.org/abs/2506.09985)
- [V-JEPA 2 HuggingFace](https://huggingface.co/facebook/vjepa2-vitl-fpc64-256)
- [V-JEPA 2 GitHub](https://github.com/facebookresearch/vjepa2)
- [Meta AI Blog: V-JEPA 2](https://ai.meta.com/blog/v-jepa-2-world-model-benchmarks/)
- [AI Browser Automation 2026](https://www.browserless.io/blog/state-of-ai-browser-automation-2026)
- [Skyvern Browser Agent](https://github.com/Skyvern-AI/skyvern)

---

---

# PART 2: COMPREHENSIVE 89-POINT INTEGRATION PLAN

> **Added**: 2026-01-21
> **Purpose**: Complete integration of VL-JEPA/V-JEPA 2 concepts across ALL KripTik AI systems
> **Total Integration Points**: 89 identified across 156 files

---

## Quick Reference: All 89 Integration Points

| Section | Category | Integration Points | Key Files |
|---------|----------|-------------------|-----------|
| **A** | NLP Entry Points | 14 (7 features × 2) | ChatInterface, FeatureAgentTile, TrainingIntentInput, OpenSourceStudio, AILab, DesignRoom, VoiceArchitect |
| **B** | BuildLoop Phases | 24 (8 phases × 3) | build-loop.ts, deep-intent.ts, intent-satisfaction.ts |
| **B.8** | Gap Closers | 7 | gap-closers/*.ts |
| **C** | HyperThinking | 8 (4 strategies × 2) | tot-engine.ts, multi-agent/, mcts/, strategy-selector.ts |
| **D** | Component 28 (Learning) | 10 (5 layers × 2) | experience-capture.ts, ai-judgment.ts, shadow-model-registry.ts, meta-learner.ts, evolution-flywheel.ts |
| **E** | Verification & Anti-Slop | 12 | visual-verifier.ts, anti-slop.ts, agents/*.ts |
| **F** | Speculative Execution | 4 | speculative-executor.ts, embedding-cache.ts |
| **G** | Design Capabilities | 6 | design-room.ts, image-to-code.ts, video-to-code.ts |
| **H** | Additional Systems | 11 | realtime-editor.ts, video-capture.ts, learning-feedback-loop.ts, context-overflow.ts, model-router.ts, unified-context.ts |
| | **TOTAL** | **89** | **156 files** |

---

## Hybrid Architecture: Gemini Video + V-JEPA 2

### The User's Correct Insight

Gemini 3 Flash supports **native video monitoring at 1-2 FPS** via the Multimodal Live API. Combined with V-JEPA 2's temporal understanding, this creates a powerful hybrid:

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID VISION PIPELINE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────────┐     ┌─────────────────┐                    │
│   │   User's URL    │────▶│ Gemini Video    │ Real-time stream   │
│   │  (AI Builder)   │     │  Monitoring     │ @ 1-2 FPS          │
│   └─────────────────┘     │  (Live API)     │                    │
│                           └────────┬────────┘                    │
│                                    │                             │
│                                    ▼                             │
│                           ┌─────────────────┐                    │
│                           │   V-JEPA 2      │ Temporal           │
│                           │  World Model    │ Understanding      │
│                           └────────┬────────┘                    │
│                                    │                             │
│                                    ▼                             │
│                           ┌─────────────────┐                    │
│                           │  KripTik AI     │ Complete           │
│                           │  Receives ZIP   │ Project +          │
│                           │  + Intention    │ Full Context       │
│                           └─────────────────┘                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Benefit

**JEPA operates IN the user's URL** - navigates, captures, understands, then passes complete intention back to KripTik. No need for constant screenshot imports.

---

## Section A: All 7 NLP Entry Points (Integration Points 1-14)

Every NLP entry point benefits from VL-JEPA semantic understanding for intent parsing.

### A.1: Builder View NLP
**Files**: `src/components/builder/ChatInterface.tsx`, `server/src/services/ai/prompt-parser.ts`
**Integration Points**: 2

```
Prompt A.1: Enhance Builder View NLP with VL-JEPA Semantic Understanding

Task: Integrate VL-JEPA embeddings into the Builder View's NLP parsing to capture visual semantic intent from user prompts that include images or design references.

Files to modify:
1. server/src/services/ai/prompt-parser.ts
2. server/src/services/embeddings/providers/vljepa-provider.ts (ensure connected)

Current behavior:
- Text-only prompt parsing
- No visual semantic understanding of referenced images

Enhanced behavior:
1. When user prompt includes images (screenshot, design mockup):
   - Generate VL-JEPA embeddings for each image
   - Find similar designs in the pattern library
   - Extract visual style signals (colors, spacing, typography)

2. When user references a URL or app:
   - Use Gemini video monitoring to capture the site
   - V-JEPA 2 analyzes the temporal experience
   - Extract interaction patterns and user journey

3. Semantic-enhanced intent:
   - Combine text intent with visual semantic embeddings
   - Create richer ImplementationPlan with design anchors
   - Pass VL-JEPA embeddings to downstream phases

Add to PromptParser:

interface ParsedPromptWithVisuals extends ParsedPrompt {
  visualSemantics: {
    imageEmbeddings: number[][];  // VL-JEPA embeddings per image
    similarDesigns: SimilarDesign[];
    styleSignals: StyleSignal[];
    temporalContext?: TemporalAnalysis;  // If video/URL captured
  };
}

async parseWithVisuals(
  prompt: string,
  images?: Buffer[]
): Promise<ParsedPromptWithVisuals>
```

### A.2: Feature Agent NLP
**Files**: `src/components/feature-agent/FeatureAgentTile.tsx`, `server/src/services/agents/feature-agent.ts`
**Integration Points**: 2

```
Prompt A.2: Enhance Feature Agent with VL-JEPA Context

Task: Give Feature Agents VL-JEPA visual context so they understand the design they're working within.

Each Feature Agent operates on a specific feature within a larger build. They need to:
1. Understand the visual style of the overall project
2. Ensure their feature matches the established design language
3. Detect if their output would conflict visually with existing components

Add to FeatureAgentContext:

interface FeatureAgentContext {
  // Existing
  taskDescription: string;
  projectContext: ProjectContext;

  // NEW: Visual context
  visualContext: {
    projectStyleEmbedding: number[];  // VL-JEPA embedding of current project
    existingComponents: ComponentVisual[];  // Embeddings of existing UI
    designIntent: DesignIntent;  // From Builder View
    antiSlopPatterns: number[][];  // Embeddings of patterns to AVOID
  };
}

// Before each Feature Agent executes:
const visualContext = await vljepaProvider.embedProject(projectScreenshots);
featureAgent.setVisualContext(visualContext);
```

### A.3: Training/Fine-tuning NLP
**Files**: `src/components/training/TrainingIntentInput.tsx`, `server/src/services/training/training-orchestrator.ts`
**Integration Points**: 2

```
Prompt A.3: Training NLP with VL-JEPA Data Understanding

Task: Use VL-JEPA to analyze training data quality and intent alignment.

When users describe training goals in natural language:
1. Parse what they want to achieve
2. If they provide sample data, use VL-JEPA to analyze:
   - Image/video quality
   - Style consistency across samples
   - Gaps in training coverage

Integration points:
1. Training intent parsing - understand what "Suno-quality music" or "Veo-level video" means semantically
2. Training data validation - VL-JEPA scans uploaded samples for quality
3. Output verification - compare trained vs untrained outputs using VL-JEPA similarity

interface TrainingIntentWithVision {
  goalDescription: string;
  targetQuality: {
    referenceEmbeddings: number[][];  // VL-JEPA embeddings of quality targets
    qualityThreshold: number;
  };
  dataAnalysis: {
    sampleEmbeddings: number[][];
    qualityScores: number[];
    coverageGaps: string[];
  };
}
```

### A.4: Open Source Studio NLP
**Files**: `src/components/open-source-studio/OpenSourceStudio.tsx`, `server/src/services/open-source/discovery.ts`
**Integration Points**: 2

```
Prompt A.4: Open Source Studio with VL-JEPA Model Understanding

Task: Use VL-JEPA to understand model capabilities from demos and examples.

When users search for models or describe workflows:
1. Parse the natural language intent
2. Use VL-JEPA to analyze model demo videos/images on HuggingFace
3. Match user intent to model capabilities through visual understanding

Example: User says "I need a model that generates realistic product photos"
- VL-JEPA analyzes example outputs from candidate models
- Compares visual quality embeddings
- Ranks models by semantic match to user intent

interface ModelSearchWithVision {
  query: string;
  candidateModels: {
    modelId: string;
    demoEmbeddings: number[][];  // VL-JEPA embeddings of demo outputs
    qualityScore: number;
    semanticMatch: number;
  }[];
}
```

### A.5: AI Lab NLP
**Files**: `src/components/ai-lab/AILab.tsx`, `server/src/services/ai-lab/lab-orchestrator.ts`
**Integration Points**: 2

```
Prompt A.5: AI Lab with VL-JEPA Experiment Analysis

Task: Use VL-JEPA to analyze and compare experiment results.

AI Lab runs budget-based exploration. VL-JEPA enhances:
1. Experiment result analysis - visually compare outputs
2. A/B testing - semantic similarity between approaches
3. Progress tracking - detect when experiments converge

interface ExperimentWithVision {
  hypothesis: string;
  results: {
    outputEmbeddings: number[][];  // VL-JEPA embeddings of each result
    visualQuality: number;
    semanticAlignment: number;  // How well it matches hypothesis
  }[];
  convergenceDetected: boolean;
}
```

### A.6: Iteration/Design NLP
**Files**: `src/components/builder/visual-editor/`, `server/src/services/design/design-room.ts`
**Integration Points**: 2

```
Prompt A.6: Design Iteration with VL-JEPA Visual Continuity

Task: Use VL-JEPA to ensure design iterations maintain visual coherence.

When users make design changes via NLP:
1. Capture current design state as VL-JEPA embedding
2. After change, compare new embedding to original
3. Flag if change breaks visual consistency

interface DesignIterationContext {
  beforeEmbedding: number[];  // VL-JEPA embedding before change
  changeDescription: string;
  afterEmbedding: number[];   // VL-JEPA embedding after change
  consistencyScore: number;
  breakingChanges: string[];
}
```

### A.7: Voice Architect NLP
**Files**: `src/components/voice/VoiceArchitectPanel.tsx`, `server/src/services/voice/voice-architect.ts`
**Integration Points**: 2

```
Prompt A.7: Voice Architect with VL-JEPA Visual Grounding

Task: Ground voice commands in visual context using VL-JEPA.

When users give voice commands:
1. Capture current screen as VL-JEPA embedding
2. Parse voice command in context of what's visible
3. Ensure voice-driven changes align with visual design

interface VoiceCommandWithVision {
  transcript: string;
  currentViewEmbedding: number[];  // What user is looking at
  parsedIntent: string;
  visuallyGrounded: boolean;  // Is the command relevant to current view?
}
```

---

## Section B: All 8 BuildLoop Phases (Integration Points 15-38)

The BuildLoopOrchestrator is KripTik's core build pipeline. Every phase benefits from VL-JEPA.

### B.1: Phase 0 - Initial NLP Parsing
**Files**: `server/src/services/automation/build-loop.ts` (lines 1-200)
**Integration Points**: 3

```
Prompt B.1: BuildLoop Phase 0 with Parallel VL-JEPA Analysis

Task: Run VL-JEPA analysis in parallel with Opus 4.5 intent parsing.

Current: Opus 4.5 parses user prompt to create initial plan
Enhanced: Simultaneously:
  1. Opus 4.5 parses text intent
  2. VL-JEPA analyzes any attached images/videos
  3. Gemini monitors any referenced URLs
  4. All three combine into richer initial understanding

In build-loop.ts Phase 0:

async phase0InitialParsing(input: BuildInput): Promise<ParsedIntent> {
  // Parallel execution for speed
  const [textIntent, visualIntent, urlCapture] = await Promise.all([
    this.opus.parseIntent(input.prompt),
    input.images ? this.vljepa.analyzeImages(input.images) : null,
    input.referenceUrl ? this.geminiVideo.captureUrl(input.referenceUrl) : null
  ]);

  return this.combineIntents(textIntent, visualIntent, urlCapture);
}
```

### B.2: Phase 1 - Implementation Plan with Style Prompting
**Files**: `server/src/services/automation/build-loop.ts` (lines 200-400)
**Integration Points**: 3

```
Prompt B.2: Implementation Plan with VL-JEPA Style Anchors

Task: Anchor the implementation plan to visual style references.

The implementation plan should include:
1. VL-JEPA embeddings of target style (from user images or references)
2. Style constraints derived from visual analysis
3. Component breakdown with visual specifications

interface ImplementationPlanWithVision {
  // Existing
  components: ComponentPlan[];
  architecture: Architecture;

  // NEW: Visual anchors
  styleAnchors: {
    targetStyleEmbedding: number[];  // What we're building toward
    colorPalette: ExtractedColors;
    typographySignals: TypographySignals;
    spacingPatterns: SpacingPatterns;
    componentStyles: Map<string, number[]>;  // Per-component style embeddings
  };
}
```

### B.3: Phase 2 - DeepIntent Lock (CRITICAL)
**Files**: `server/src/services/automation/build-loop.ts` (lines 400-600), `server/src/services/intents/deep-intent.ts`
**Integration Points**: 4

```
Prompt B.3: DeepIntent Lock with VL-JEPA Sacred Contract

Task: The DeepIntent Lock is the "sacred contract" - once user approves, it cannot drift.
VL-JEPA embeddings MUST be part of this lock.

The DeepIntent Lock should contain:
1. Text description of what to build
2. VL-JEPA embedding of visual target (CRITICAL)
3. Anti-slop embedding signatures (what to avoid)
4. User-approved style reference embeddings

interface DeepIntentLock {
  id: string;
  approved: true;  // User has approved

  // Text intent
  description: string;
  requirements: string[];

  // Visual intent (VL-JEPA)
  visualLock: {
    targetEmbedding: number[];  // The visual goal
    styleConstraints: number[][];  // Acceptable style range
    antiPatterns: number[][];  // Embeddings to REJECT
    tolerances: {
      colorDrift: number;  // Max embedding distance for color
      layoutDrift: number;
      typographyDrift: number;
    };
  };

  // Locked timestamp
  lockedAt: Date;
  lockedBy: string;  // User ID
}

// All subsequent phases check against this lock
```

### B.4: Phase 3 - Code Generation with Context Injection
**Files**: `server/src/services/automation/build-loop.ts` (lines 600-900)
**Integration Points**: 3

```
Prompt B.4: Code Generation with VL-JEPA Style Injection

Task: Inject VL-JEPA style context into every code generation prompt.

When generating code:
1. Include the visual target embedding in the context
2. Provide concrete style examples from similar embeddings
3. Include anti-slop warnings based on embedding analysis

const codeGenPrompt = `
Generate component: ${component.name}

VISUAL STYLE CONTEXT:
Target style embedding distance from neutral: ${embeddingAnalysis.styleStrength}
Color warmth/coolness: ${embeddingAnalysis.colorTemperature}
Density/whitespace ratio: ${embeddingAnalysis.density}
Similar approved designs: ${similarDesigns.map(d => d.codeSnippet).join('\n')}

ANTI-SLOP (embeddings to avoid):
${antiPatterns.map(p => `DO NOT: ${p.description} (pattern ID: ${p.id})`).join('\n')}

Generate the code...
`;
```

### B.5: Phase 4 - Sandbox Styling Checks
**Files**: `server/src/services/automation/build-loop.ts`, `server/src/services/sandbox/style-checker.ts`
**Integration Points**: 3

```
Prompt B.5: Sandbox Styling with VL-JEPA Verification

Task: After code renders in sandbox, use VL-JEPA to verify visual alignment.

interface SandboxStyleCheck {
  // Render the component in sandbox
  renderedScreenshot: Buffer;

  // VL-JEPA comparison
  comparison: {
    renderedEmbedding: number[];  // What we built
    targetEmbedding: number[];    // What we wanted
    distance: number;              // How far off
    driftAreas: DriftArea[];       // Where it drifted
  };

  // Pass/fail based on DeepIntent Lock tolerances
  passed: boolean;
  requiredFixes: StyleFix[];
}
```

### B.6: Phase 5 - Layout Verification
**Files**: `server/src/services/verification/layout-verifier.ts`
**Integration Points**: 3

```
Prompt B.6: Layout Verification with VL-JEPA Spatial Understanding

Task: Use VL-JEPA to verify layout matches spatial intent.

VL-JEPA understands spatial relationships:
1. Component positioning relative to each other
2. Responsive behavior across viewports
3. Visual hierarchy and flow

interface LayoutVerification {
  viewportSize: ViewportSize;

  spatialAnalysis: {
    componentPositions: Map<string, BoundingBox>;
    spatialEmbedding: number[];  // VL-JEPA embedding of spatial arrangement
    targetSpatialEmbedding: number[];  // From intent
    alignmentScore: number;
  };

  responsiveChecks: {
    mobile: SpatialAnalysis;
    tablet: SpatialAnalysis;
    desktop: SpatialAnalysis;
  };
}
```

### B.7: Phase 6 - User Style Intention Satisfaction
**Files**: `server/src/services/verification/intent-satisfaction.ts`
**Integration Points**: 3

```
Prompt B.7: Intent Satisfaction with VL-JEPA Drift Detection

Task: The final check before user review - did we satisfy their visual intent?

This is where VL-JEPA compares:
1. Final build screenshot embedding vs DeepIntent Lock visual target
2. If drift exceeds tolerance, trigger Gap Closers
3. Generate visual diff explanation for user

interface IntentSatisfactionCheck {
  finalBuildEmbedding: number[];
  intentLockEmbedding: number[];

  satisfaction: {
    overallScore: number;  // 0-100
    colorSatisfaction: number;
    layoutSatisfaction: number;
    typographySatisfaction: number;
    interactionSatisfaction: number;
  };

  drifts: {
    area: string;
    expected: string;
    actual: string;
    severity: 'minor' | 'major' | 'critical';
  }[];

  recommendation: 'ship' | 'fix' | 'restart';
}
```

### B.8: Gap Closers (7 Types)
**Files**: `server/src/services/automation/gap-closers/`
**Integration Points**: 7

```
Prompt B.8: VL-JEPA Enhanced Gap Closers

Task: Each Gap Closer should use VL-JEPA for visual analysis.

1. StyleGapCloser - Fix style drift using VL-JEPA distance
2. LayoutGapCloser - Fix layout using VL-JEPA spatial understanding
3. ColorGapCloser - Fix color using VL-JEPA color extraction
4. TypographyGapCloser - Fix fonts using VL-JEPA text analysis
5. InteractionGapCloser - Fix interactions using V-JEPA 2 temporal
6. ResponsiveGapCloser - Fix responsiveness using VL-JEPA multi-viewport
7. AntiSlopGapCloser - Remove slop patterns detected by VL-JEPA

Each gap closer:
1. Receives the drift analysis from Phase 6
2. Uses VL-JEPA to understand WHAT is wrong
3. Generates targeted fix
4. Verifies fix brought embedding closer to target
```

---

## Section C: HyperThinking Integration (Integration Points 39-46)

### C.1: Tree-of-Thought with Visual Branching
**Files**: `server/src/services/hyper-thinking/tree-of-thought/tot-engine.ts`
**Integration Points**: 2

```
Prompt C.1: Tree-of-Thought with VL-JEPA Visual Evaluation

Task: When ToT explores different design approaches, use VL-JEPA to evaluate branches.

Each thought branch can be rendered and embedded:
1. Render branch approach as mockup
2. Get VL-JEPA embedding
3. Compare to target intent embedding
4. Prune branches that drift too far

interface ThoughtBranchWithVision {
  approach: string;
  mockupScreenshot: Buffer;
  visualEmbedding: number[];
  distanceFromTarget: number;
  shouldPrune: boolean;
}
```

### C.2: Multi-Agent Reasoning with Visual Consensus
**Files**: `server/src/services/hyper-thinking/multi-agent/`
**Integration Points**: 2

```
Prompt C.2: Multi-Agent with VL-JEPA Visual Consensus

Task: When multiple agents propose solutions, use VL-JEPA to find visual consensus.

If 3 agents propose different designs:
1. Embed each proposal with VL-JEPA
2. Find centroid that satisfies user intent
3. Or detect if proposals are too divergent and need human input

interface MultiAgentVisualConsensus {
  proposals: AgentProposal[];
  embeddings: number[][];
  centroid: number[];
  variance: number;
  consensus: boolean;
}
```

### C.3: Monte Carlo Tree Search with Visual Rewards
**Files**: `server/src/services/hyper-thinking/mcts/`
**Integration Points**: 2

```
Prompt C.3: MCTS with VL-JEPA Visual Reward Signal

Task: Use VL-JEPA embedding distance as reward signal in MCTS.

Reward function:
- Distance from target embedding (lower = better)
- Anti-slop pattern distance (higher = better)
- Combined into single reward scalar

const visualReward = (state: BuildState): number => {
  const targetDist = cosineSimilarity(state.embedding, targetEmbedding);
  const slopDist = Math.min(...antiPatterns.map(p =>
    cosineDistance(state.embedding, p)
  ));
  return targetDist * 0.7 + slopDist * 0.3;
};
```

### C.4: Strategy Selection with Visual Complexity
**Files**: `server/src/services/hyper-thinking/strategy-selector.ts`
**Integration Points**: 2

```
Prompt C.4: Strategy Selection Based on Visual Complexity

Task: Choose HyperThinking strategy based on visual complexity of the task.

Use VL-JEPA to analyze:
1. Visual complexity of target (many components = ToT)
2. Style precision required (exact match = MCTS)
3. Uncertainty in intent (ambiguous = multi-agent)

const selectStrategy = (intent: DeepIntentLock): HyperThinkingStrategy => {
  const complexity = analyzeVisualComplexity(intent.visualLock.targetEmbedding);
  const precision = intent.visualLock.tolerances;

  if (complexity > 0.8) return 'tree-of-thought';
  if (precision.colorDrift < 0.1) return 'mcts';
  if (intent.ambiguityScore > 0.6) return 'multi-agent';
  return 'direct';
};
```

---

## Section D: Component 28 - Autonomous Learning Engine (Integration Points 47-56)

Component 28 is the 5-layer learning system. VL-JEPA is essential for visual learning.

### D.1: Layer 1 - Experience Capture
**Files**: `server/src/services/learning/experience-capture.ts`
**Integration Points**: 2

```
Prompt D.1: Experience Capture with VL-JEPA Visual Memory

Task: Capture visual experiences alongside code/decision traces.

Every build produces visual artifacts:
1. Screenshots at each phase
2. VL-JEPA embeddings of those screenshots
3. Store in pattern library for future matching

interface ExperienceWithVision {
  buildId: string;
  traces: DecisionTrace[];

  visualMemory: {
    phaseScreenshots: Map<Phase, Buffer>;
    phaseEmbeddings: Map<Phase, number[]>;
    styleEvolution: number[][];  // How style evolved during build
    successPatterns: VisualPattern[];
    failurePatterns: VisualPattern[];
  };
}
```

### D.2: Layer 2 - AI Judgment
**Files**: `server/src/services/learning/ai-judgment.ts`
**Integration Points**: 2

```
Prompt D.2: AI Judgment with VL-JEPA Visual Quality Scoring

Task: Judge visual quality using VL-JEPA embeddings.

The multi-judge system should include a VL-JEPA visual judge:
1. Analyzes screenshot embedding
2. Compares to high-quality reference embeddings
3. Scores visual polish (0-100)

interface VisualJudgment {
  screenshot: Buffer;
  embedding: number[];

  scores: {
    overall: number;
    colorHarmony: number;
    layoutBalance: number;
    typographyQuality: number;
    whitespaceProportion: number;
    professionalismIndex: number;
  };

  comparison: {
    percentileRank: number;  // Where this falls vs all builds
    similarHighQuality: string[];  // IDs of similar good builds
  };
}
```

### D.3: Layer 3 - Shadow Models
**Files**: `server/src/services/learning/shadow-model-registry.ts`
**Integration Points**: 2

```
Prompt D.3: Shadow Model Training on VL-JEPA Pairs

Task: Train shadow models on (input, VL-JEPA embedding) pairs.

The 4 shadow models should learn from visual data:
1. Qwen 3 32B (code) - learns code patterns that produce good embeddings
2. Llama 4 Scout (architecture) - learns architectures that render well
3. DeepSeek R1 (reasoning) - learns reasoning that leads to visual success
4. Qwen 3 VL-8B (design) - directly trained on visual preference pairs

interface ShadowModelVisualPair {
  input: string;  // User prompt
  output: string;  // Generated code
  visualResult: {
    embedding: number[];
    qualityScore: number;
  };
  label: 'preferred' | 'rejected';
}
```

### D.4: Layer 4 - Meta-Learning
**Files**: `server/src/services/learning/meta-learner.ts`
**Integration Points**: 2

```
Prompt D.4: Meta-Learning Visual Strategy Evolution

Task: Learn which visual strategies work best.

Track:
1. Which VL-JEPA embedding regions correlate with user satisfaction
2. Which style approaches succeed for which user types
3. Optimal paths through embedding space to reach targets

interface VisualMetaLearning {
  successfulPaths: EmbeddingPath[];  // Trajectories that led to approval
  userStyleClusters: Map<UserCluster, number[]>;  // Preferred styles per user type
  optimalStrategies: Map<TaskType, VisualStrategy>;
}
```

### D.5: Layer 5 - Evolution Flywheel
**Files**: `server/src/services/learning/evolution-flywheel.ts`
**Integration Points**: 2

```
Prompt D.5: Evolution Flywheel with Cross-Build Visual Transfer

Task: Transfer visual learnings across builds.

When a build succeeds:
1. Extract visual patterns that worked
2. Add to pattern library with VL-JEPA embeddings
3. Future builds can query similar patterns

interface CrossBuildVisualTransfer {
  sourceBuilds: string[];  // Successful build IDs
  patterns: {
    embedding: number[];
    code: string;
    successRate: number;
    applicability: TaskType[];
  }[];
}
```

---

## Section E: Verification Swarm & Anti-Slop (Integration Points 57-68)

### E.1: Visual Verifier Agent
**Files**: `server/src/services/verification/agents/visual-verifier.ts`
**Integration Points**: 2

```
Prompt E.1: Visual Verifier with VL-JEPA Deep Analysis

Task: The visual_verifier agent should use VL-JEPA for comprehensive analysis.

Currently does keyframe analysis. Enhanced:
1. Full temporal analysis with V-JEPA 2
2. Style consistency checking via embedding comparison
3. Anti-slop detection via pattern matching

interface VisualVerifierWithJEPA {
  temporalAnalysis: TemporalAnalysis;  // V-JEPA 2
  styleConsistency: {
    embeddings: number[][];  // Per-screen embeddings
    variance: number;  // Should be low for consistent style
    outliers: number[];  // Screens that don't match
  };
  slopDetection: {
    detected: AntiSlopPattern[];
    confidence: number;
  };
}
```

### E.2: Anti-Slop Detection System
**Files**: `src/components/builder/visual-editor/controls/AntiSlopWarnings.tsx`, `server/src/services/verification/anti-slop.ts`
**Integration Points**: 3

```
Prompt E.2: Anti-Slop with VL-JEPA Pattern Library

Task: Build a library of "slop" patterns as VL-JEPA embeddings.

Slop patterns to embed:
1. Purple-pink gradients (instant fail)
2. Generic "tech startup" layouts
3. Overused emoji patterns
4. Stock photo placeholder aesthetics
5. Default framework styling (unstyled MUI, etc.)

interface AntiSlopLibrary {
  patterns: {
    id: string;
    name: string;
    embedding: number[];  // VL-JEPA embedding of the pattern
    severity: 'instant_fail' | 'warning' | 'caution';
    description: string;
    example: string;  // How to avoid
  }[];
}

// During verification:
const slopScore = Math.min(...antiSlopLibrary.patterns.map(p =>
  cosineDistance(buildEmbedding, p.embedding)
));
if (slopScore < 0.3) throw new AntiSlopViolation(nearestPattern);
```

### E.3: All 6 Verification Agents
**Files**: `server/src/services/verification/agents/`
**Integration Points**: 6

```
Prompt E.3: VL-JEPA Enhancement for All Verification Agents

1. error_checker - Use VL-JEPA to detect visual error states (red borders, error icons)
2. code_quality - N/A (code analysis)
3. visual_verifier - Full VL-JEPA integration (see E.1)
4. security_scanner - N/A (security analysis)
5. placeholder_eliminator - VL-JEPA detects placeholder images/lorem ipsum patterns
6. design_style - VL-JEPA compares against DeepIntent Lock style embeddings

Each should have access to the VL-JEPA embedding of the current build.
```

---

## Section F: Speculative Execution for Speed (Integration Points 69-72)

### F.1: Dual-Stream with VL-JEPA Pre-computation
**Files**: `server/src/services/automation/speculative-executor.ts`
**Integration Points**: 2

```
Prompt F.1: Speculative Execution with VL-JEPA Pre-warming

Task: Pre-compute VL-JEPA embeddings speculatively.

Current: Haiku (fast) and Opus (smart) run in parallel
Enhanced: Also pre-compute VL-JEPA embeddings while waiting

// In speculative execution:
const [haikuResult, opusResult, precomputedEmbeddings] = await Promise.all([
  this.fastModel.generate(prompt),
  this.smartModel.generate(prompt),
  this.vljepa.precomputeForPrompt(prompt)  // Ready for when code renders
]);
```

### F.2: Cache Embeddings for Common Patterns
**Files**: `server/src/services/embeddings/embedding-cache.ts`
**Integration Points**: 2

```
Prompt F.2: VL-JEPA Embedding Cache for Speed

Task: Cache common visual patterns to avoid re-computation.

Cache strategy:
1. Hash common UI patterns (buttons, cards, navbars)
2. Store their VL-JEPA embeddings
3. During verification, check cache before computing

interface EmbeddingCache {
  set(hash: string, embedding: number[]): void;
  get(hash: string): number[] | null;

  // Pre-populate with common patterns
  warmup(): Promise<void>;
}
```

---

## Section G: Design Capabilities (Integration Points 73-78)

### G.1: Design Room with VL-JEPA Style Transfer
**Files**: `server/src/services/design/design-room.ts`
**Integration Points**: 2

```
Prompt G.1: Design Room with VL-JEPA Style Extraction

Task: Extract and apply styles using VL-JEPA embeddings.

When user provides a style reference:
1. Extract VL-JEPA embedding
2. Find similar styles in pattern library
3. Generate CSS/Tailwind that matches the embedding

interface StyleTransfer {
  referenceImage: Buffer;
  referenceEmbedding: number[];

  extracted: {
    colors: ColorPalette;
    typography: TypographySystem;
    spacing: SpacingScale;
    shadows: ShadowSystem;
    borderRadii: BorderRadiusScale;
  };

  generatedCSS: string;
  tailwindConfig: TailwindConfig;
}
```

### G.2: I2C (Image-to-Code) with VL-JEPA
**Files**: `server/src/services/ai/image-to-code.ts`
**Integration Points**: 2

```
Prompt G.2: Image-to-Code with VL-JEPA Semantic Understanding

Task: Use VL-JEPA to understand design intent, not just visual reproduction.

Current I2C just replicates pixels. Enhanced:
1. VL-JEPA understands the SEMANTIC meaning of the design
2. Identifies component types, not just visual shapes
3. Understands design intent (is this a hero section? a pricing table?)

interface I2CWithVLJEPA {
  image: Buffer;

  semanticAnalysis: {
    embedding: number[];
    componentTypes: ComponentDetection[];  // "This is a hero section"
    designPattern: string;  // "SaaS landing page pattern"
    intent: string;  // "Convert visitors to signups"
  };

  generatedCode: string;  // Semantically appropriate code
}
```

### G.3: Clone Mode Camera Capture
**Files**: `server/src/services/ai/video-to-code.ts`
**Integration Points**: 2

```
Prompt G.3: Clone Mode with V-JEPA 2 Interaction Understanding

Task: When user points camera at app, V-JEPA 2 understands interactions.

The camera captures video of an existing app:
1. V-JEPA 2 understands the temporal interactions
2. Maps the user journey
3. Reconstructs not just the UI but the FLOW

interface CloneModeWithVJEPA2 {
  videoCapture: Buffer;

  temporalAnalysis: {
    frames: VideoFrame[];
    interactions: DetectedInteraction[];
    userJourney: JourneyStep[];
    stateTransitions: StateTransition[];
  };

  generatedApp: {
    components: GeneratedComponent[];
    routes: GeneratedRoute[];
    stateManagement: GeneratedState[];
  };
}
```

---

## Section H: Additional Systems (Integration Points 79-89)

### H.1: Real-time Voice Editing
**Files**: `server/src/services/voice/realtime-editor.ts`
**Integration Points**: 2

```
Prompt H.1: Voice Editing with VL-JEPA Context Preservation

Task: When user edits via voice, use VL-JEPA to maintain context.

Voice command: "Make the button bigger"
1. VL-JEPA identifies which button in current view
2. Preserves style embedding during change
3. Verifies change didn't break visual consistency
```

### H.2: Browser Extension Video Capture
**Files**: `browser-extension/src/background/video-capture.ts`
**Integration Points**: 2

```
Prompt H.2: Browser Extension with Gemini Video Streaming

Task: Stream browser video to Gemini for real-time understanding.

When capturing competitor AI builder:
1. Stream video to Gemini Multimodal Live API at 1-2 FPS
2. Gemini extracts text/UI in real-time
3. V-JEPA 2 runs periodically for temporal understanding
4. Combined output sent back to KripTik
```

### H.3: Continuous Learning Feedback
**Files**: `server/src/services/continuous-learning/learning-feedback-loop.ts`
**Integration Points**: 2

```
Prompt H.3: Learning Feedback with VL-JEPA Quality Signal

Task: Use VL-JEPA quality scores as learning signal.

After each build:
1. Compute final VL-JEPA embedding
2. Compare to user satisfaction signal
3. Create (embedding, satisfaction) pairs for training
4. Update pattern library with successful embeddings
```

### H.4: Context Overflow Management
**Files**: `server/src/services/agents/context-overflow.ts`
**Integration Points**: 2

```
Prompt H.4: Context Overflow with VL-JEPA Visual Summary

Task: When context overflows, preserve visual understanding via embeddings.

When handoff to new agent:
1. Compute VL-JEPA embedding of current visual state
2. Pass embedding as compressed visual context
3. New agent can compare future states to this embedding
```

### H.5: Model Router Visual Awareness
**Files**: `server/src/services/ai/model-router.ts`
**Integration Points**: 2

```
Prompt H.5: Model Router with Visual Task Detection

Task: Route to vision-capable models when visual understanding needed.

const routeWithVision = (task: Task): Model => {
  if (task.requiresVisualUnderstanding) {
    return task.requiresTemporal ? 'vjepa2' : 'gemini-vision';
  }
  return standardRouting(task);
};
```

### H.6: Unified Context with Visual Memory
**Files**: `server/src/services/ai/unified-context.ts`
**Integration Points**: 1

```
Prompt H.6: Unified Context with VL-JEPA Visual Layer

Task: Add visual layer to unified context system.

interface UnifiedContextWithVision {
  text: TextContext;
  code: CodeContext;
  visual: {
    currentEmbedding: number[];
    targetEmbedding: number[];
    historyEmbeddings: number[][];
  };
}
```

---

## Model Deployment Strategy

### Local Models (Fast, Always Available)

| Model | Size | Purpose | Hardware |
|-------|------|---------|----------|
| SigLIP 2 | 400M | Quick image embeddings | CPU/MPS |
| BGE-M3 | 568M | Text embeddings | CPU/MPS |
| Qwen 3 VL-8B | 8B | Design shadow model | MPS/16GB VRAM |

### RunPod Serverless (Heavy, On-Demand)

| Model | Size | Endpoint | GPU | Cold Start |
|-------|------|----------|-----|------------|
| V-JEPA 2 | 1.2B | kriptik-vjepa2 | A4000 | 60s |
| V-JEPA 2 (Prod) | 1.2B | kriptik-vjepa2-prod | A40 | 30s |

### Gemini API (External)

| Model | Use Case | Latency |
|-------|----------|---------|
| Gemini 3 Flash | Frame analysis, text extraction | 200ms |
| Gemini Multimodal Live | Video streaming @ 1-2 FPS | Real-time |

---

## Production & Viral Traffic Configuration

### Scaling Strategy

```yaml
# Auto-scaling configuration
scaling:
  vjepa2:
    minWorkers: 1  # Always warm for prod
    maxWorkers: 10  # Scale for viral traffic
    scaleUpThreshold: 5  # Queue > 5 jobs
    scaleDownDelay: 300  # Keep warm 5 min after traffic

  gemini:
    rateLimit: 1000/min
    fallbackToLocal: true  # Use SigLIP if rate limited

  local:
    maxConcurrent: 4  # Per server instance
    preload: true  # Load models at startup
```

### Speed Optimizations

1. **Embedding Cache**: 80%+ cache hit rate for common patterns
2. **Speculative Pre-computation**: Compute embeddings while waiting for LLM
3. **Batch Processing**: Group multiple images into single API call
4. **Connection Pooling**: Keep RunPod connections warm
5. **Edge Caching**: Cache embeddings at CDN for repeated patterns

### Fallback Chain

```
V-JEPA 2 (RunPod) → Gemini Vision → SigLIP 2 (Local)
         ↓ timeout          ↓ rate limit       ↓ always available
```

---

## Implementation Priority Order

### Week 1: Foundation
1. V-JEPA 2 RunPod Handler (Prompt 1.1)
2. V-JEPA 2 TypeScript Provider (Prompt 1.2)
3. Gemini Video Streaming Setup

### Week 2: Core Integration
4. BuildLoop Phase 0-2 (VL-JEPA in intent parsing)
5. DeepIntent Lock Visual Component
6. Anti-Slop Pattern Library

### Week 3: Verification
7. Visual Verifier Enhancement
8. Demo Verification Service
9. Gap Closer Visual Enhancements

### Week 4: Learning
10. Component 28 Visual Memory
11. Shadow Model Visual Training
12. Cross-Build Visual Transfer

### Week 5: Polish
13. All NLP Entry Points
14. HyperThinking Visual Integration
15. Production Scaling & Caching

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Build visual accuracy | 70% | 95% |
| Style drift detection | Manual | Automatic |
| Anti-slop detection | Rule-based | Embedding-based |
| Fix My App accuracy | 60% | 90% |
| Clone Mode fidelity | 70% | 95% |
| Verification speed | 30s | 5s (cached) |
| Cold start (V-JEPA 2) | N/A | <60s |
| Embedding cache hit | N/A | 80% |

---

*This comprehensive plan covers all 89 integration points across KripTik AI, providing structured prompts for implementation and a clear path to production deployment with viral traffic support.*
