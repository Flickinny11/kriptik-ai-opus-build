/**
 * Build Progress WebSocket Hook
 *
 * Real-time build progress tracking for Fix My App and autonomous builds.
 * Connects to the WebSocket service and provides live updates for:
 * - Build phase transitions
 * - Feature completion progress
 * - Agent activity
 * - Error escalation status
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUserStore } from '@/store/useUserStore';

// =============================================================================
// TYPES
// =============================================================================

export interface BuildProgress {
    currentPhase: string;
    currentStage: string;
    featuresPending: number;
    featuresCompleted: number;
    featuresFailed: number;
    currentFeature?: string;
    overallProgress: number;
}

export interface AgentProgress {
    slotId?: string;
    agentId?: string;
    type: string;
    message?: string;
    progress?: number;
    feature?: string;
}

export interface EscalationProgress {
    level: number;
    description: string;
    inProgress: boolean;
    resolved?: boolean;
}

export interface BuildProgressState {
    isConnected: boolean;
    isBuilding: boolean;
    progress: BuildProgress | null;
    agentActivity: AgentProgress[];
    escalation: EscalationProgress | null;
    lastUpdate: Date | null;
    error: string | null;
}

export interface UseBuildProgressOptions {
    projectId: string;
    contextId?: string;
    autoConnect?: boolean;
    onComplete?: () => void;
    onError?: (error: string) => void;
}

// =============================================================================
// WEBSOCKET URL CONFIGURATION
// =============================================================================

function getWebSocketUrl(contextId: string, userId: string): string {
    const wsBase = import.meta.env.VITE_WS_URL || 
        (window.location.protocol === 'https:' 
            ? `wss://${window.location.host}`
            : `ws://${window.location.host}`);
    
    return `${wsBase}/ws/context?contextId=${encodeURIComponent(contextId)}&userId=${encodeURIComponent(userId)}`;
}

// =============================================================================
// HOOK
// =============================================================================

export function useBuildProgress(options: UseBuildProgressOptions): BuildProgressState & {
    connect: () => void;
    disconnect: () => void;
    refresh: () => void;
} {
    const { projectId, contextId, autoConnect = true, onComplete, onError } = options;
    const { user } = useUserStore();
    
    // State
    const [state, setState] = useState<BuildProgressState>({
        isConnected: false,
        isBuilding: false,
        progress: null,
        agentActivity: [],
        escalation: null,
        lastUpdate: null,
        error: null,
    });

    // WebSocket ref
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    // Cleanup function
    const cleanup = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (!user?.id) {
            console.warn('[useBuildProgress] No user ID, skipping connection');
            return;
        }

        // Use projectId as contextId if not provided
        const wsContextId = contextId || projectId;
        if (!wsContextId) {
            console.warn('[useBuildProgress] No contextId or projectId, skipping connection');
            return;
        }

        cleanup();

        const url = getWebSocketUrl(wsContextId, user.id);
        console.log('[useBuildProgress] Connecting to:', url);

        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[useBuildProgress] Connected');
                reconnectAttempts.current = 0;
                setState(prev => ({ ...prev, isConnected: true, error: null }));

                // Subscribe to build progress events
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    payload: [
                        'build-progress',
                        'agent-progress',
                        'phase-change',
                        'escalation-progress',
                        'verification-result',
                        'task:completed',
                        'task:failed',
                    ],
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handleMessage(message);
                } catch (err) {
                    console.error('[useBuildProgress] Failed to parse message:', err);
                }
            };

            ws.onclose = (event) => {
                console.log('[useBuildProgress] Disconnected:', event.code, event.reason);
                setState(prev => ({ ...prev, isConnected: false }));
                
                // Attempt reconnection if not intentionally closed
                if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
                    reconnectAttempts.current++;
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    console.log(`[useBuildProgress] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
                    reconnectTimeoutRef.current = setTimeout(connect, delay);
                }
            };

            ws.onerror = (error) => {
                console.error('[useBuildProgress] WebSocket error:', error);
                setState(prev => ({ ...prev, error: 'Connection error' }));
                onError?.('WebSocket connection failed');
            };
        } catch (err) {
            console.error('[useBuildProgress] Failed to create WebSocket:', err);
            setState(prev => ({ ...prev, error: 'Failed to connect' }));
        }
    }, [projectId, contextId, user?.id, cleanup, onError]);

    // Handle incoming messages
    const handleMessage = useCallback((message: { type: string; payload: any; timestamp: string }) => {
        const { type, payload } = message;

        setState(prev => {
            const newState = { ...prev, lastUpdate: new Date() };

            switch (type) {
                case 'build-progress':
                    newState.progress = payload as BuildProgress;
                    newState.isBuilding = payload.overallProgress < 100;
                    
                    // Check for completion
                    if (payload.overallProgress >= 100) {
                        onComplete?.();
                    }
                    break;

                case 'agent-progress':
                case 'phase-change':
                    // Add to agent activity (keep last 20)
                    newState.agentActivity = [
                        { ...payload, type: payload.type || type },
                        ...prev.agentActivity.slice(0, 19),
                    ];
                    
                    // Update phase in progress if phase-change
                    if (type === 'phase-change' && newState.progress) {
                        newState.progress = {
                            ...newState.progress,
                            currentPhase: payload.phase,
                            overallProgress: payload.progress || newState.progress.overallProgress,
                        };
                    }
                    break;

                case 'escalation-progress':
                    newState.escalation = payload as EscalationProgress;
                    break;

                case 'verification-result':
                    // Add verification result to activity
                    newState.agentActivity = [
                        {
                            type: 'verification',
                            feature: payload.featureId,
                            message: `${payload.verdict}: ${payload.score}% (${payload.blockers?.length || 0} blockers)`,
                        },
                        ...prev.agentActivity.slice(0, 19),
                    ];
                    break;

                case 'task:completed':
                    newState.agentActivity = [
                        {
                            type: 'task-completed',
                            message: payload.task?.title || 'Task completed',
                            feature: payload.task?.featureId,
                        },
                        ...prev.agentActivity.slice(0, 19),
                    ];
                    break;

                case 'task:failed':
                    newState.agentActivity = [
                        {
                            type: 'task-failed',
                            message: payload.task?.title || 'Task failed',
                            feature: payload.task?.featureId,
                        },
                        ...prev.agentActivity.slice(0, 19),
                    ];
                    break;

                case 'initial-state':
                    // Handle initial state from server
                    if (payload.activeWorkflow?.progress) {
                        newState.progress = {
                            currentPhase: payload.activeWorkflow.phase || 'initializing',
                            currentStage: payload.activeWorkflow.stage || 'frontend',
                            featuresPending: 0,
                            featuresCompleted: 0,
                            featuresFailed: 0,
                            overallProgress: payload.activeWorkflow.progress,
                        };
                        newState.isBuilding = payload.activeWorkflow.progress < 100;
                    }
                    break;

                case 'error':
                    newState.error = payload.message || 'Unknown error';
                    onError?.(payload.message);
                    break;
            }

            return newState;
        });
    }, [onComplete, onError]);

    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        cleanup();
        setState(prev => ({ ...prev, isConnected: false }));
    }, [cleanup]);

    // Request a refresh of the current state
    const refresh = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'get-context',
                payload: {},
            }));
        }
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect && projectId && user?.id) {
            connect();
        }

        return cleanup;
    }, [autoConnect, projectId, user?.id, connect, cleanup]);

    return {
        ...state,
        connect,
        disconnect,
        refresh,
    };
}

// =============================================================================
// HELPER HOOK: Simple progress percentage
// =============================================================================

export function useBuildProgressPercent(projectId: string): number {
    const { progress } = useBuildProgress({ projectId });
    return progress?.overallProgress ?? 0;
}

// =============================================================================
// HELPER HOOK: Build status check
// =============================================================================

export function useIsBuilding(projectId: string): boolean {
    const { isBuilding } = useBuildProgress({ projectId, autoConnect: true });
    return isBuilding;
}

export default useBuildProgress;
