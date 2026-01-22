/**
 * useVJEPA2Timeline - Hook for V-JEPA 2 Temporal Predictions
 *
 * Connects the MediaDeck UI component to the V-JEPA 2 backend services
 * for real-time temporal prediction visualization.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimelineFrame, StateTransition } from '@/components/ui/media-deck';
import { API_URL, authenticatedFetch } from '@/lib/api-config';

// ============================================================================
// TYPES
// ============================================================================

export interface VJEPA2TimelineConfig {
  projectId: string;
  sessionId?: string;
  autoCapture?: boolean;
  captureInterval?: number; // ms
  maxFrames?: number;
  showPredictions?: boolean;
  predictionHorizon?: number; // How far ahead to predict (ms)
}

export interface VJEPA2TimelineState {
  frames: TimelineFrame[];
  transitions: StateTransition[];
  currentTime: number;
  duration: number;
  isCapturing: boolean;
  isPredicting: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  latestPrediction?: {
    nextState: string;
    probability: number;
    timeToTransition: number;
  };
  errorMessage?: string;
}

export interface VJEPA2TimelineActions {
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  addFrame: (frame: Omit<TimelineFrame, 'id'>) => void;
  clearFrames: () => void;
  seekTo: (time: number) => void;
  requestPrediction: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
}

// ============================================================================
// API CALLS
// ============================================================================

const API_BASE = `${API_URL}/api/visual-semantic`;

async function startMonitoringSession(
  projectId: string,
  config: Partial<VJEPA2TimelineConfig>
): Promise<{ sessionId: string }> {
  const response = await authenticatedFetch(`${API_BASE}/monitoring/start`, {
    method: 'POST',
    body: JSON.stringify({ projectId, ...config }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start monitoring: ${response.statusText}`);
  }

  return response.json();
}

async function stopMonitoringSession(sessionId: string): Promise<void> {
  await authenticatedFetch(`${API_BASE}/monitoring/stop`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

async function processFrame(
  sessionId: string,
  screenshotBase64: string
): Promise<{
  prediction?: {
    nextState: string;
    probability: number;
    timeToTransition: number;
  };
  embedding?: number[];
  state: 'idle' | 'transition' | 'error' | 'predicted';
  confidence: number;
}> {
  const response = await authenticatedFetch(`${API_BASE}/monitoring/process-frame`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, screenshot: screenshotBase64 }),
  });

  if (!response.ok) {
    throw new Error(`Failed to process frame: ${response.statusText}`);
  }

  return response.json();
}

async function getPrediction(
  projectId: string,
  currentState: string,
  recentFrameEmbeddings: number[][]
): Promise<{
  nextState: string;
  probability: number;
  timeToTransition: number;
  confidence: number;
}> {
  const response = await authenticatedFetch(`${API_BASE}/predict`, {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      currentState,
      recentEmbeddings: recentFrameEmbeddings,
    }),
  });

  if (!response.ok) {
    throw new Error(`Prediction failed: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useVJEPA2Timeline(
  config: VJEPA2TimelineConfig
): [VJEPA2TimelineState, VJEPA2TimelineActions] {
  // State
  const [frames, setFrames] = useState<TimelineFrame[]>([]);
  const [transitions, setTransitions] = useState<StateTransition[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'connecting' | 'error'
  >('disconnected');
  const [latestPrediction, setLatestPrediction] = useState<{
    nextState: string;
    probability: number;
    timeToTransition: number;
  }>();
  const [errorMessage, setErrorMessage] = useState<string>();

  // Refs
  const sessionIdRef = useRef<string | null>(config.sessionId || null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameCountRef = useRef(0);
  const startTimeRef = useRef<number>(0);

  // Computed duration
  const duration = frames.length > 0
    ? frames[frames.length - 1].timestamp
    : 0;

  // Connect to monitoring session
  const connect = useCallback(async () => {
    try {
      setConnectionStatus('connecting');
      setErrorMessage(undefined);

      const { sessionId } = await startMonitoringSession(config.projectId, {
        predictionHorizon: config.predictionHorizon,
      });

      sessionIdRef.current = sessionId;
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
    }
  }, [config.projectId, config.predictionHorizon]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (sessionIdRef.current) {
      try {
        await stopMonitoringSession(sessionIdRef.current);
      } catch (error) {
        console.error('Error stopping session:', error);
      }
      sessionIdRef.current = null;
    }
    setConnectionStatus('disconnected');
  }, []);

  // Start capture
  const startCapture = useCallback(async () => {
    if (connectionStatus !== 'connected' && !sessionIdRef.current) {
      await connect();
    }

    setIsCapturing(true);
    startTimeRef.current = Date.now();
    frameCountRef.current = 0;

    // Set up interval for auto-capture if enabled
    if (config.autoCapture) {
      const interval = config.captureInterval || 1000;
      captureIntervalRef.current = setInterval(() => {
        // In a real implementation, this would capture the screen
        // For now, we just increment the frame count
        const timestamp = Date.now() - startTimeRef.current;
        setCurrentTime(timestamp);
      }, interval);
    }
  }, [connectionStatus, connect, config.autoCapture, config.captureInterval]);

  // Stop capture
  const stopCapture = useCallback(() => {
    setIsCapturing(false);

    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  }, []);

  // Add frame
  const addFrame = useCallback((frame: Omit<TimelineFrame, 'id'>) => {
    const maxFrames = config.maxFrames || 100;

    setFrames(prev => {
      const newFrame: TimelineFrame = {
        ...frame,
        id: `frame-${frameCountRef.current++}`,
      };

      // Check for state transition
      if (prev.length > 0) {
        const lastFrame = prev[prev.length - 1];
        if (lastFrame.state !== newFrame.state) {
          const transition: StateTransition = {
            id: `transition-${frameCountRef.current}`,
            fromFrame: lastFrame.id,
            toFrame: newFrame.id,
            type: newFrame.state === 'predicted' ? 'predicted' : 'system',
            label: `${lastFrame.state} → ${newFrame.state}`,
            confidence: (lastFrame.confidence + newFrame.confidence) / 2,
          };
          setTransitions(prevTransitions => [...prevTransitions, transition]);
        }
      }

      // Limit frame count
      const updated = [...prev, newFrame];
      if (updated.length > maxFrames) {
        return updated.slice(-maxFrames);
      }
      return updated;
    });

    // Update current time
    setCurrentTime(frame.timestamp);

    // Update latest prediction
    if (frame.prediction) {
      setLatestPrediction(frame.prediction);
    }
  }, [config.maxFrames]);

  // Clear frames
  const clearFrames = useCallback(() => {
    setFrames([]);
    setTransitions([]);
    setCurrentTime(0);
    frameCountRef.current = 0;
    startTimeRef.current = Date.now();
  }, []);

  // Seek to time
  const seekTo = useCallback((time: number) => {
    setCurrentTime(Math.max(0, Math.min(time, duration)));
  }, [duration]);

  // Request prediction
  const requestPrediction = useCallback(async () => {
    if (frames.length < 3) {
      setErrorMessage('Need at least 3 frames for prediction');
      return;
    }

    try {
      setIsPredicting(true);
      setErrorMessage(undefined);

      const recentFrames = frames.slice(-5);
      const embeddings = recentFrames
        .filter(f => f.embedding)
        .map(f => f.embedding!);

      if (embeddings.length < 2) {
        setErrorMessage('Not enough embedding data for prediction');
        return;
      }

      const currentFrame = frames[frames.length - 1];
      const prediction = await getPrediction(
        config.projectId,
        currentFrame.state,
        embeddings
      );

      setLatestPrediction({
        nextState: prediction.nextState,
        probability: prediction.probability,
        timeToTransition: prediction.timeToTransition,
      });

      // Add a predicted frame
      addFrame({
        timestamp: currentTime + prediction.timeToTransition,
        state: 'predicted',
        confidence: prediction.confidence,
        prediction,
        semanticLabel: `Predicted: ${prediction.nextState}`,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Prediction failed');
    } finally {
      setIsPredicting(false);
    }
  }, [frames, currentTime, config.projectId, addFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      if (sessionIdRef.current) {
        stopMonitoringSession(sessionIdRef.current).catch(console.error);
      }
    };
  }, []);

  // Auto-connect if sessionId provided
  useEffect(() => {
    if (config.sessionId && connectionStatus === 'disconnected') {
      sessionIdRef.current = config.sessionId;
      setConnectionStatus('connected');
    }
  }, [config.sessionId, connectionStatus]);

  const state: VJEPA2TimelineState = {
    frames,
    transitions,
    currentTime,
    duration,
    isCapturing,
    isPredicting,
    connectionStatus,
    latestPrediction,
    errorMessage,
  };

  const actions: VJEPA2TimelineActions = {
    startCapture,
    stopCapture,
    addFrame,
    clearFrames,
    seekTo,
    requestPrediction,
    connect,
    disconnect,
  };

  return [state, actions];
}

export default useVJEPA2Timeline;
