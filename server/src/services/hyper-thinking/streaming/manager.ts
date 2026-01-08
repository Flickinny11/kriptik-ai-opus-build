/**
 * Streaming Manager
 *
 * Manages streaming output from multiple model providers with integrated
 * hallucination detection and auto-correction capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  type StreamingEvent,
  type StreamingEventMetadata,
  type StreamEventType,
  type StreamState,
  type StreamingManagerConfig,
  type HallucinationSignal,
  DEFAULT_STREAMING_MANAGER_CONFIG,
} from './types.js';
import {
  HallucinationDetector,
  createHallucinationDetector,
} from './hallucination-detector.js';

// ============================================================================
// Event Buffer
// ============================================================================

class EventBuffer {
  private buffer: StreamingEvent[] = [];
  private maxSize: number;
  private backpressureThreshold: number;

  constructor(maxSize: number, backpressureThreshold: number) {
    this.maxSize = maxSize;
    this.backpressureThreshold = backpressureThreshold;
  }

  push(event: StreamingEvent): boolean {
    if (this.buffer.length >= this.maxSize) {
      // Drop oldest events when at capacity
      this.buffer.shift();
    }
    this.buffer.push(event);
    return this.buffer.length < this.backpressureThreshold;
  }

  get length(): number {
    return this.buffer.length;
  }

  isBackpressured(): boolean {
    return this.buffer.length >= this.backpressureThreshold;
  }

  getRecent(count: number): StreamingEvent[] {
    return this.buffer.slice(-count);
  }

  clear(): void {
    this.buffer = [];
  }

  getAll(): StreamingEvent[] {
    return [...this.buffer];
  }
}

// ============================================================================
// Streaming Manager Class
// ============================================================================

export class StreamingManager {
  private config: StreamingManagerConfig;
  private hallucinationDetector: HallucinationDetector;
  
  // Stream state
  private activeStreams: Map<string, StreamState> = new Map();
  private eventBuffers: Map<string, EventBuffer> = new Map();
  private pausedStreams: Set<string> = new Set();
  
  // Heartbeat
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Callbacks
  private onHallucinationCallbacks: Map<string, (signal: HallucinationSignal) => void> = new Map();

  constructor(config: Partial<StreamingManagerConfig> = {}) {
    this.config = { ...DEFAULT_STREAMING_MANAGER_CONFIG, ...config };
    this.hallucinationDetector = createHallucinationDetector();
  }

  // ==========================================================================
  // Stream Lifecycle
  // ==========================================================================

  /**
   * Create a new streaming session
   */
  async createStream(
    problemContext: string,
    options: {
      sessionId?: string;
      onHallucination?: (signal: HallucinationSignal) => void;
    } = {}
  ): Promise<string> {
    const streamId = options.sessionId || uuidv4();

    // Initialize hallucination detector
    if (this.config.enableHallucinationDetection) {
      await this.hallucinationDetector.initialize(problemContext, streamId);
    }

    // Create state
    const state: StreamState = {
      id: streamId,
      status: 'active',
      eventsEmitted: 0,
      tokensUsed: 0,
      correctionsApplied: 0,
      hallucinationWarnings: 0,
      startedAt: new Date().toISOString(),
    };
    this.activeStreams.set(streamId, state);

    // Create buffer
    this.eventBuffers.set(
      streamId,
      new EventBuffer(this.config.maxBufferSize, this.config.backpressureThreshold)
    );

    // Register callback
    if (options.onHallucination) {
      this.onHallucinationCallbacks.set(streamId, options.onHallucination);
    }

    // Start heartbeat
    this.startHeartbeat(streamId);

    return streamId;
  }

  /**
   * Close a streaming session
   */
  closeStream(streamId: string): void {
    const state = this.activeStreams.get(streamId);
    if (state) {
      state.status = 'complete';
    }

    this.stopHeartbeat(streamId);
    this.pausedStreams.delete(streamId);
    this.onHallucinationCallbacks.delete(streamId);
  }

  /**
   * Get stream state
   */
  getStreamState(streamId: string): StreamState | null {
    return this.activeStreams.get(streamId) || null;
  }

  // ==========================================================================
  // Event Emission
  // ==========================================================================

  /**
   * Emit an event to a stream
   */
  async emit(
    streamId: string,
    type: StreamEventType,
    content: string,
    metadata: Partial<StreamingEventMetadata> = {}
  ): Promise<StreamingEvent | null> {
    const state = this.activeStreams.get(streamId);
    if (!state || state.status === 'complete' || state.status === 'error') {
      return null;
    }

    // Check if paused
    if (this.pausedStreams.has(streamId) && type !== 'resume') {
      return null;
    }

    // Create event
    const event: StreamingEvent = {
      type,
      content,
      metadata: {
        ...metadata,
        sessionId: streamId,
      },
      timestamp: new Date().toISOString(),
    };

    // Analyze for hallucination if it's a thought
    if (
      this.config.enableHallucinationDetection &&
      (type === 'thinking' || type === 'thought_complete') &&
      metadata.stepId
    ) {
      const signal = await this.hallucinationDetector.analyzeStep(
        metadata.stepId,
        content,
        metadata.confidence || 0.5,
        metadata.tokensUsed || 0
      );

      // Update metadata with hallucination score
      event.metadata.hallucinationScore = signal.score;

      // Handle high hallucination score
      if (signal.score > 0.3) {
        state.hallucinationWarnings++;

        // Notify callback
        const callback = this.onHallucinationCallbacks.get(streamId);
        if (callback) {
          callback(signal);
        }

        // Emit warning event
        await this.emitWarning(streamId, signal);
      }

      // Handle pause request
      if (signal.shouldPause) {
        this.pauseStream(streamId);
      }
    }

    // Buffer event
    const buffer = this.eventBuffers.get(streamId);
    if (buffer) {
      const shouldContinue = buffer.push(event);

      // Handle backpressure
      if (!shouldContinue && this.config.enableBackpressure) {
        this.pauseStream(streamId);
      }
    }

    // Update state
    state.eventsEmitted++;
    state.lastEventAt = event.timestamp;
    state.currentStepId = metadata.stepId;
    if (metadata.tokensUsed) {
      state.tokensUsed += metadata.tokensUsed;
    }

    return event;
  }

  /**
   * Emit hallucination warning
   */
  private async emitWarning(streamId: string, signal: HallucinationSignal): Promise<void> {
    const warningEvent: StreamingEvent = {
      type: 'hallucination_warning',
      content: signal.explanation || `Hallucination detected (score: ${signal.score.toFixed(2)})`,
      metadata: {
        sessionId: streamId,
        stepId: signal.stepId,
        hallucinationScore: signal.score,
        custom: {
          indicators: signal.indicators,
          suggestedAction: signal.suggestedAction,
        },
      },
      timestamp: signal.timestamp,
    };

    const buffer = this.eventBuffers.get(streamId);
    if (buffer) {
      buffer.push(warningEvent);
    }
  }

  // ==========================================================================
  // Stream Control
  // ==========================================================================

  /**
   * Pause a stream
   */
  pauseStream(streamId: string): boolean {
    const state = this.activeStreams.get(streamId);
    if (!state || state.status !== 'active') {
      return false;
    }

    state.status = 'paused';
    this.pausedStreams.add(streamId);

    // Emit pause event
    const pauseEvent: StreamingEvent = {
      type: 'pause',
      content: 'Stream paused',
      metadata: { sessionId: streamId },
      timestamp: new Date().toISOString(),
    };

    const buffer = this.eventBuffers.get(streamId);
    if (buffer) {
      buffer.push(pauseEvent);
    }

    return true;
  }

  /**
   * Resume a stream
   */
  resumeStream(streamId: string): boolean {
    const state = this.activeStreams.get(streamId);
    if (!state || state.status !== 'paused') {
      return false;
    }

    state.status = 'active';
    this.pausedStreams.delete(streamId);

    // Emit resume event
    const resumeEvent: StreamingEvent = {
      type: 'resume',
      content: 'Stream resumed',
      metadata: { sessionId: streamId },
      timestamp: new Date().toISOString(),
    };

    const buffer = this.eventBuffers.get(streamId);
    if (buffer) {
      buffer.push(resumeEvent);
    }

    return true;
  }

  /**
   * Check if stream is paused
   */
  isPaused(streamId: string): boolean {
    return this.pausedStreams.has(streamId);
  }

  // ==========================================================================
  // Stream Wrapping
  // ==========================================================================

  /**
   * Wrap an async generator with streaming management
   */
  async *wrapStream<T>(
    streamId: string,
    source: AsyncGenerator<T>,
    transform: (item: T) => {
      type: StreamEventType;
      content: string;
      metadata?: Partial<StreamingEventMetadata>;
    }
  ): AsyncGenerator<StreamingEvent> {
    try {
      // Emit start event
      const startEvent = await this.emit(streamId, 'start', 'Stream started');
      if (startEvent) yield startEvent;

      // Process source
      for await (const item of source) {
        // Check if stream is still active
        const state = this.activeStreams.get(streamId);
        if (!state || state.status === 'complete' || state.status === 'error') {
          break;
        }

        // Wait if paused
        while (this.isPaused(streamId)) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Check for timeout
          const pauseStart = Date.now();
          if (Date.now() - pauseStart > this.config.streamTimeoutMs) {
            throw new Error('Stream paused timeout exceeded');
          }
        }

        // Transform and emit
        const { type, content, metadata } = transform(item);
        const event = await this.emit(streamId, type, content, metadata);
        if (event) yield event;
      }

      // Emit complete event
      const completeEvent = await this.emit(streamId, 'complete', 'Stream complete');
      if (completeEvent) yield completeEvent;

    } catch (error) {
      // Emit error event
      const errorEvent: StreamingEvent = {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
        metadata: { sessionId: streamId },
        timestamp: new Date().toISOString(),
      };

      const buffer = this.eventBuffers.get(streamId);
      if (buffer) {
        buffer.push(errorEvent);
      }

      const state = this.activeStreams.get(streamId);
      if (state) {
        state.status = 'error';
      }

      yield errorEvent;
    } finally {
      this.closeStream(streamId);
    }
  }

  // ==========================================================================
  // Heartbeat
  // ==========================================================================

  /**
   * Start heartbeat for a stream
   */
  private startHeartbeat(streamId: string): void {
    if (this.heartbeatTimers.has(streamId)) {
      return;
    }

    const timer = setInterval(() => {
      const state = this.activeStreams.get(streamId);
      if (!state || state.status === 'complete' || state.status === 'error') {
        this.stopHeartbeat(streamId);
        return;
      }

      // Check for stream timeout
      if (state.lastEventAt) {
        const lastEvent = new Date(state.lastEventAt).getTime();
        if (Date.now() - lastEvent > this.config.streamTimeoutMs) {
          state.status = 'error';
          this.stopHeartbeat(streamId);
          return;
        }
      }
    }, this.config.heartbeatIntervalMs);

    this.heartbeatTimers.set(streamId, timer);
  }

  /**
   * Stop heartbeat for a stream
   */
  private stopHeartbeat(streamId: string): void {
    const timer = this.heartbeatTimers.get(streamId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(streamId);
    }
  }

  // ==========================================================================
  // Event Retrieval
  // ==========================================================================

  /**
   * Get recent events for a stream
   */
  getRecentEvents(streamId: string, count: number = 10): StreamingEvent[] {
    const buffer = this.eventBuffers.get(streamId);
    return buffer ? buffer.getRecent(count) : [];
  }

  /**
   * Get all events for a stream
   */
  getAllEvents(streamId: string): StreamingEvent[] {
    const buffer = this.eventBuffers.get(streamId);
    return buffer ? buffer.getAll() : [];
  }

  // ==========================================================================
  // Analysis
  // ==========================================================================

  /**
   * Get chain analysis for a stream
   */
  getChainAnalysis(streamId: string) {
    const state = this.activeStreams.get(streamId);
    if (!state) return null;

    return this.hallucinationDetector.getChainAnalysis();
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get all active streams
   */
  getActiveStreams(): StreamState[] {
    return Array.from(this.activeStreams.values()).filter(
      s => s.status === 'active' || s.status === 'paused'
    );
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StreamingManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup all streams
   */
  cleanup(): void {
    for (const streamId of this.activeStreams.keys()) {
      this.closeStream(streamId);
    }
    this.activeStreams.clear();
    this.eventBuffers.clear();
    this.pausedStreams.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let managerInstance: StreamingManager | null = null;

export function getStreamingManager(): StreamingManager {
  if (!managerInstance) {
    managerInstance = new StreamingManager();
  }
  return managerInstance;
}

export function resetStreamingManager(): void {
  if (managerInstance) {
    managerInstance.cleanup();
  }
  managerInstance = null;
}

export function createStreamingManager(
  config?: Partial<StreamingManagerConfig>
): StreamingManager {
  return new StreamingManager(config);
}

export default StreamingManager;
