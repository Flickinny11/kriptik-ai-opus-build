/**
 * V-JEPA 2 Debug Enhancer
 *
 * Enhances debug sessions with visual temporal understanding using V-JEPA 2.
 * Provides visual timeline analysis of error occurrence and predicts error
 * patterns based on temporal understanding.
 *
 * Key Features:
 * - UI state sequence capture during debug sessions
 * - Temporal context analysis using V-JEPA 2
 * - Visual error timeline reconstruction
 * - Error pattern prediction based on visual state history
 * - Integration with proactive error prediction
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  getVJEPA2Provider,
  type StatePrediction,
  type TransitionValidation,
  type ErrorAnticipation,
  type VisualIntentLock as VJEPA2IntentLock,
} from '../embeddings/providers/runpod-vjepa2-provider.js';
import {
  RuntimeDebugContextService,
  type DebugSession,
  type RuntimeError,
  type ExecutionFrame,
} from './runtime-debug-context.js';
import {
  getProactiveErrorPredictor,
  type PredictedError,
} from '../visual-semantic/proactive-error-predictor.js';

// ============================================================================
// Types
// ============================================================================

export interface VisualDebugFrame {
  id: string;
  timestamp: number;
  screenshotBase64: string;
  embedding?: number[];
  domSnapshot?: string;
  executionFrames: ExecutionFrame[];
  metadata: {
    url?: string;
    viewportSize?: { width: number; height: number };
    scrollPosition?: { x: number; y: number };
    interactionType?: 'click' | 'input' | 'scroll' | 'navigation' | 'idle';
    interactionTarget?: string;
  };
}

export interface VisualDebugTimeline {
  id: string;
  sessionId: string;
  frames: VisualDebugFrame[];
  temporalEmbedding?: number[];
  keyMoments: Array<{
    frameId: string;
    timestamp: number;
    type: 'error' | 'state_change' | 'interaction' | 'anomaly' | 'recovery';
    description: string;
    confidence: number;
  }>;
  errorContext: {
    frameBeforeError?: string;
    frameAtError?: string;
    frameAfterError?: string;
    visualStateProgression: string[];
  };
  createdAt: Date;
  analyzedAt?: Date;
}

export interface VisualErrorAnalysis {
  sessionId: string;
  timelineId: string;
  visualContext: {
    description: string;
    stateAtError: string;
    visualCues: string[];
    anomalies: string[];
  };
  temporalContext: {
    stateProgression: string[];
    transitionPattern: string;
    anomalousTransitions: Array<{
      from: string;
      to: string;
      issue: string;
    }>;
  };
  rootCauseIndicators: Array<{
    type: 'visual' | 'temporal' | 'interaction' | 'state';
    indicator: string;
    confidence: number;
    evidence: string[];
  }>;
  suggestedInvestigations: string[];
  predictedRelatedErrors: PredictedError[];
}

export interface EnhancedDebugSession extends DebugSession {
  visualTimeline?: VisualDebugTimeline;
  visualAnalysis?: VisualErrorAnalysis;
  vjepa2Configured: boolean;
}

// ============================================================================
// V-JEPA 2 Debug Enhancer
// ============================================================================

let instance: VJEPA2DebugEnhancer | null = null;

export class VJEPA2DebugEnhancer extends EventEmitter {
  private vjepa2Provider = getVJEPA2Provider();
  private timelines: Map<string, VisualDebugTimeline> = new Map();
  private activeCaptures: Map<string, NodeJS.Timeout> = new Map();
  private frameBuffers: Map<string, VisualDebugFrame[]> = new Map();

  constructor() {
    super();
    console.log(
      `[VJEPA2DebugEnhancer] Initialized. V-JEPA 2 configured: ${this.vjepa2Provider.isConfigured()}`
    );
  }

  /**
   * Check if V-JEPA 2 is configured
   */
  isConfigured(): boolean {
    return this.vjepa2Provider.isConfigured();
  }

  /**
   * Start capturing visual debug frames for a session
   */
  startCapture(sessionId: string, captureInterval: number = 1000): string {
    const timelineId = `timeline_${sessionId}_${Date.now()}`;

    const timeline: VisualDebugTimeline = {
      id: timelineId,
      sessionId,
      frames: [],
      keyMoments: [],
      errorContext: {
        visualStateProgression: [],
      },
      createdAt: new Date(),
    };

    this.timelines.set(timelineId, timeline);
    this.frameBuffers.set(timelineId, []);

    console.log(
      `[VJEPA2DebugEnhancer] Started capture for session ${sessionId} (timeline: ${timelineId})`
    );
    this.emit('capture:started', { sessionId, timelineId });

    return timelineId;
  }

  /**
   * Add a visual frame to the capture
   */
  async addFrame(
    timelineId: string,
    screenshotBase64: string,
    executionFrames: ExecutionFrame[],
    metadata?: VisualDebugFrame['metadata']
  ): Promise<VisualDebugFrame | null> {
    const timeline = this.timelines.get(timelineId);
    if (!timeline) {
      console.warn(
        `[VJEPA2DebugEnhancer] Timeline ${timelineId} not found`
      );
      return null;
    }

    const frame: VisualDebugFrame = {
      id: `frame_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      screenshotBase64,
      executionFrames,
      metadata: metadata || {},
    };

    // Get embedding if V-JEPA 2 is configured
    if (this.vjepa2Provider.isConfigured()) {
      try {
        const result = await this.vjepa2Provider.embedTemporal([
          screenshotBase64,
        ]);
        frame.embedding = result.frameEmbeddings[0];
      } catch (error) {
        console.warn(
          '[VJEPA2DebugEnhancer] Failed to get frame embedding:',
          error
        );
      }
    }

    timeline.frames.push(frame);

    // Keep only the last 60 frames (1 minute at 1fps)
    if (timeline.frames.length > 60) {
      timeline.frames = timeline.frames.slice(-60);
    }

    // Detect key moments based on execution frames
    if (executionFrames.some((f) => f.functionName.includes('error') || f.functionName.includes('Error'))) {
      timeline.keyMoments.push({
        frameId: frame.id,
        timestamp: frame.timestamp,
        type: 'error',
        description: 'Error detected in execution',
        confidence: 0.9,
      });
    }

    this.emit('frame:captured', { timelineId, frameId: frame.id });

    return frame;
  }

  /**
   * Mark the error occurrence point in the timeline
   */
  markErrorOccurrence(
    timelineId: string,
    errorTimestamp: number,
    error: RuntimeError
  ): void {
    const timeline = this.timelines.get(timelineId);
    if (!timeline) return;

    // Find the frames around the error
    const sortedFrames = [...timeline.frames].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    let frameAtError: VisualDebugFrame | null = null;
    let frameBeforeError: VisualDebugFrame | null = null;
    let frameAfterError: VisualDebugFrame | null = null;

    for (let i = 0; i < sortedFrames.length; i++) {
      const frame = sortedFrames[i];
      if (frame.timestamp <= errorTimestamp) {
        frameBeforeError = frame;
        if (frame.timestamp >= errorTimestamp - 500) {
          frameAtError = frame;
        }
      } else if (frame.timestamp > errorTimestamp && !frameAfterError) {
        frameAfterError = frame;
        break;
      }
    }

    timeline.errorContext = {
      frameBeforeError: frameBeforeError?.id,
      frameAtError: frameAtError?.id || frameBeforeError?.id,
      frameAfterError: frameAfterError?.id,
      visualStateProgression: sortedFrames
        .filter(
          (f) =>
            f.timestamp >= errorTimestamp - 5000 &&
            f.timestamp <= errorTimestamp + 2000
        )
        .map((f) => f.id),
    };

    // Add key moment for the error
    timeline.keyMoments.push({
      frameId: frameAtError?.id || frameBeforeError?.id || sortedFrames[sortedFrames.length - 1]?.id || '',
      timestamp: errorTimestamp,
      type: 'error',
      description: `${error.type}: ${error.message}`,
      confidence: 1.0,
    });

    this.emit('error:marked', { timelineId, errorTimestamp });
  }

  /**
   * Stop capturing and analyze the timeline
   */
  async stopCapture(timelineId: string): Promise<VisualDebugTimeline | null> {
    const timeline = this.timelines.get(timelineId);
    if (!timeline) return null;

    // Clear any active capture interval
    const interval = this.activeCaptures.get(timelineId);
    if (interval) {
      clearInterval(interval);
      this.activeCaptures.delete(timelineId);
    }

    // Analyze the timeline with V-JEPA 2
    if (this.vjepa2Provider.isConfigured() && timeline.frames.length >= 3) {
      await this.analyzeTimeline(timelineId);
    }

    timeline.analyzedAt = new Date();
    console.log(
      `[VJEPA2DebugEnhancer] Stopped capture for timeline ${timelineId} (${timeline.frames.length} frames)`
    );

    return timeline;
  }

  /**
   * Analyze the visual timeline using V-JEPA 2
   */
  private async analyzeTimeline(timelineId: string): Promise<void> {
    const timeline = this.timelines.get(timelineId);
    if (!timeline || timeline.frames.length < 3) return;

    try {
      // Get the frames around the error for analysis
      const errorFrameIds = timeline.errorContext.visualStateProgression;
      const framesToAnalyze = errorFrameIds.length > 0
        ? timeline.frames.filter((f) => errorFrameIds.includes(f.id))
        : timeline.frames.slice(-10);

      const screenshots = framesToAnalyze.map((f) => f.screenshotBase64);

      // Get temporal embedding
      const temporalResult = await this.vjepa2Provider.embedTemporal(
        screenshots
      );
      timeline.temporalEmbedding = temporalResult.temporalEmbedding;

      // Detect transitions and anomalies
      for (let i = 1; i < framesToAnalyze.length; i++) {
        const prev = framesToAnalyze[i - 1];
        const curr = framesToAnalyze[i];

        // Check for significant changes using embeddings
        if (prev.embedding && curr.embedding) {
          const similarity = this.cosineSimilarity(prev.embedding, curr.embedding);
          if (similarity < 0.7) {
            timeline.keyMoments.push({
              frameId: curr.id,
              timestamp: curr.timestamp,
              type: 'anomaly',
              description: `Significant visual change detected (similarity: ${(similarity * 100).toFixed(1)}%)`,
              confidence: 1 - similarity,
            });
          }
        }
      }

      console.log(
        `[VJEPA2DebugEnhancer] Analyzed timeline ${timelineId}: ${timeline.keyMoments.length} key moments`
      );
    } catch (error) {
      console.error(
        '[VJEPA2DebugEnhancer] Timeline analysis failed:',
        error
      );
    }
  }

  /**
   * Generate visual error analysis for a debug session
   */
  async generateVisualAnalysis(
    session: DebugSession,
    timelineId: string
  ): Promise<VisualErrorAnalysis | null> {
    const timeline = this.timelines.get(timelineId);
    if (!timeline) return null;

    const analysis: VisualErrorAnalysis = {
      sessionId: session.id,
      timelineId,
      visualContext: {
        description: '',
        stateAtError: '',
        visualCues: [],
        anomalies: [],
      },
      temporalContext: {
        stateProgression: [],
        transitionPattern: '',
        anomalousTransitions: [],
      },
      rootCauseIndicators: [],
      suggestedInvestigations: [],
      predictedRelatedErrors: [],
    };

    // Analyze visual context
    const errorFrames = timeline.frames.filter((f) =>
      timeline.errorContext.visualStateProgression.includes(f.id)
    );

    if (errorFrames.length > 0) {
      analysis.visualContext.stateAtError = `${errorFrames.length} frames captured around error occurrence`;
      analysis.visualContext.visualCues = timeline.keyMoments
        .filter((m) => m.type === 'anomaly' || m.type === 'error')
        .map((m) => m.description);
    }

    // Analyze temporal context
    analysis.temporalContext.stateProgression = timeline.keyMoments
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((m) => `[${m.type}] ${m.description}`);

    // Detect anomalous transitions
    const anomalies = timeline.keyMoments.filter((m) => m.type === 'anomaly');
    for (const anomaly of anomalies) {
      const frameIndex = timeline.frames.findIndex(
        (f) => f.id === anomaly.frameId
      );
      if (frameIndex > 0) {
        analysis.temporalContext.anomalousTransitions.push({
          from: `Frame ${frameIndex - 1}`,
          to: `Frame ${frameIndex}`,
          issue: anomaly.description,
        });
      }
    }

    // Generate root cause indicators
    if (timeline.keyMoments.some((m) => m.type === 'anomaly' && m.confidence > 0.5)) {
      analysis.rootCauseIndicators.push({
        type: 'visual',
        indicator: 'Significant visual state changes detected before error',
        confidence: 0.7,
        evidence: anomalies.map((a) => a.description),
      });
    }

    // Check execution frames for clues
    const errorFrameData = errorFrames.find(
      (f) => f.id === timeline.errorContext.frameAtError
    );
    if (errorFrameData && errorFrameData.executionFrames.length > 0) {
      analysis.rootCauseIndicators.push({
        type: 'state',
        indicator: 'Execution state captured at error point',
        confidence: 0.8,
        evidence: errorFrameData.executionFrames.map(
          (f) => `${f.functionName} at ${f.fileName}:${f.lineNumber}`
        ),
      });
    }

    // Generate investigation suggestions
    analysis.suggestedInvestigations = [
      'Review visual state transitions leading up to the error',
      'Check for rapid state changes that may indicate race conditions',
      'Examine DOM state at the error frame',
      'Review console output around the error timestamp',
    ];

    if (anomalies.length > 0) {
      analysis.suggestedInvestigations.push(
        'Investigate the cause of detected visual anomalies'
      );
    }

    // Get predicted related errors from proactive predictor
    try {
      const predictor = getProactiveErrorPredictor();
      const monitoringSession = await predictor.startSession(
        session.buildId,
        { maxFrameHistory: 10 },
        undefined,
        undefined
      );

      for (const frame of errorFrames.slice(-5)) {
        const result = await predictor.processFrame(
          monitoringSession,
          frame.screenshotBase64
        );
        analysis.predictedRelatedErrors.push(...result.predictions);
      }

      predictor.stopSession(monitoringSession);
    } catch (error) {
      console.warn(
        '[VJEPA2DebugEnhancer] Failed to get predicted errors:',
        error
      );
    }

    return analysis;
  }

  /**
   * Enhance a debug session with visual temporal context
   */
  async enhanceDebugSession(
    debugService: RuntimeDebugContextService,
    session: DebugSession
  ): Promise<EnhancedDebugSession> {
    const enhanced: EnhancedDebugSession = {
      ...session,
      vjepa2Configured: this.vjepa2Provider.isConfigured(),
    };

    // Check if we have a timeline for this session
    for (const [id, timeline] of this.timelines) {
      if (timeline.sessionId === session.id) {
        enhanced.visualTimeline = timeline;

        // Generate analysis if not already done
        if (!enhanced.visualAnalysis) {
          const analysis = await this.generateVisualAnalysis(
            session,
            id
          );
          if (analysis) {
            enhanced.visualAnalysis = analysis;
          }
        }

        break;
      }
    }

    return enhanced;
  }

  /**
   * Get visual context for AI prompt enhancement
   */
  getVisualContextForPrompt(timelineId: string): string {
    const timeline = this.timelines.get(timelineId);
    if (!timeline) return '';

    const lines: string[] = [
      '## Visual Debug Context (V-JEPA 2 Enhanced)',
      '',
    ];

    // Timeline overview
    lines.push(`### Timeline Overview`);
    lines.push(`- Total frames captured: ${timeline.frames.length}`);
    lines.push(`- Key moments detected: ${timeline.keyMoments.length}`);
    lines.push(`- Capture duration: ${(timeline.frames.length > 0 ? (timeline.frames[timeline.frames.length - 1].timestamp - timeline.frames[0].timestamp) / 1000 : 0).toFixed(1)}s`);
    lines.push('');

    // Error context
    if (timeline.errorContext.frameAtError) {
      lines.push(`### Error Context`);
      lines.push(`- Frame at error: ${timeline.errorContext.frameAtError}`);
      lines.push(
        `- Frames in error window: ${timeline.errorContext.visualStateProgression.length}`
      );
      lines.push('');
    }

    // Key moments
    if (timeline.keyMoments.length > 0) {
      lines.push(`### Key Moments`);
      for (const moment of timeline.keyMoments.slice(-10)) {
        lines.push(
          `- [${moment.type.toUpperCase()}] ${moment.description} (confidence: ${(moment.confidence * 100).toFixed(0)}%)`
        );
      }
      lines.push('');
    }

    // Anomalies
    const anomalies = timeline.keyMoments.filter((m) => m.type === 'anomaly');
    if (anomalies.length > 0) {
      lines.push(`### Visual Anomalies Detected`);
      for (const anomaly of anomalies) {
        lines.push(`- ${anomaly.description}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get timeline by ID
   */
  getTimeline(timelineId: string): VisualDebugTimeline | null {
    return this.timelines.get(timelineId) || null;
  }

  /**
   * Get all timelines for a session
   */
  getTimelinesForSession(sessionId: string): VisualDebugTimeline[] {
    return Array.from(this.timelines.values()).filter(
      (t) => t.sessionId === sessionId
    );
  }

  /**
   * Clear timelines for a session
   */
  clearSession(sessionId: string): void {
    for (const [id, timeline] of this.timelines) {
      if (timeline.sessionId === sessionId) {
        this.timelines.delete(id);
        this.frameBuffers.delete(id);
        const interval = this.activeCaptures.get(id);
        if (interval) {
          clearInterval(interval);
          this.activeCaptures.delete(id);
        }
      }
    }
  }

  /**
   * Helper: Calculate cosine similarity between embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }
}

// Singleton accessor
export function getVJEPA2DebugEnhancer(): VJEPA2DebugEnhancer {
  if (!instance) {
    instance = new VJEPA2DebugEnhancer();
  }
  return instance;
}

export function resetVJEPA2DebugEnhancer(): void {
  if (instance) {
    // Clear all active captures
    for (const interval of instance['activeCaptures'].values()) {
      clearInterval(interval);
    }
  }
  instance = null;
}
