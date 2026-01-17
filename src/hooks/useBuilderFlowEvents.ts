/**
 * Builder Flow Events Hook
 *
 * React hook for real-time WebSocket events during the builder flow.
 * Receives phase changes, plan generation, dependency updates, and build progress.
 *
 * Part of KripTik AI's Builder Flow architecture.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import {
    useBuilderFlowStore,
    type BuilderFlowPhase,
} from '../store/builder-flow-store';
import { usePlanModificationStore } from '../store/plan-modification-store';
import type { DependencyData } from '../components/builder/dependencies';
import type { ResourceRecommendation } from '../components/builder/resources/ResourceApprovalView';

// =============================================================================
// TYPES
// =============================================================================

export type BuilderFlowEventType =
    | 'PHASE_CHANGE'
    | 'PLAN_GENERATION_START'
    | 'PLAN_GENERATION_PROGRESS'
    | 'PLAN_GENERATION_COMPLETE'
    | 'INTENT_LOCK_START'
    | 'INTENT_LOCK_COMPLETE'
    | 'DEPENDENCIES_EXTRACTED'
    | 'DEPENDENCY_CONNECTED'
    | 'DEPENDENCY_INSTALL_START'
    | 'DEPENDENCY_INSTALL_PROGRESS'
    | 'DEPENDENCY_INSTALL_COMPLETE'
    | 'RESOURCES_REQUIRED'
    | 'RESOURCE_ALLOCATED'
    | 'BUILD_START'
    | 'BUILD_PROGRESS'
    | 'BUILD_COMPLETE'
    | 'DEPLOYMENT_START'
    | 'DEPLOYMENT_PROGRESS'
    | 'DEPLOYMENT_COMPLETE'
    | 'ERROR';

export interface PhaseChangeEvent {
    type: 'PHASE_CHANGE';
    buildId: string;
    phase: BuilderFlowPhase;
    previousPhase: BuilderFlowPhase;
    timestamp: string;
}

export interface PlanGenerationStartEvent {
    type: 'PLAN_GENERATION_START';
    buildId: string;
    prompt: string;
    timestamp: string;
}

export interface PlanGenerationProgressEvent {
    type: 'PLAN_GENERATION_PROGRESS';
    buildId: string;
    stage: 'analyzing' | 'researching' | 'structuring' | 'finalizing';
    message: string;
    progress: number;
    timestamp: string;
}

export interface PlanGenerationCompleteEvent {
    type: 'PLAN_GENERATION_COMPLETE';
    buildId: string;
    plan: {
        id: string;
        title: string;
        description: string;
        phases: Array<{
            id: string;
            name: string;
            description: string;
            tasks: Array<{
                id: string;
                name: string;
                description: string;
                status: 'pending' | 'in_progress' | 'completed';
            }>;
        }>;
    };
    timestamp: string;
}

export interface IntentLockStartEvent {
    type: 'INTENT_LOCK_START';
    buildId: string;
    timestamp: string;
}

export interface IntentLockCompleteEvent {
    type: 'INTENT_LOCK_COMPLETE';
    buildId: string;
    contractId: string;
    successCriteria: string[];
    timestamp: string;
}

export interface DependenciesExtractedEvent {
    type: 'DEPENDENCIES_EXTRACTED';
    buildId: string;
    dependencies: DependencyData[];
    timestamp: string;
}

export interface DependencyConnectedEvent {
    type: 'DEPENDENCY_CONNECTED';
    buildId: string;
    dependencyId: string;
    method: 'oauth' | 'credentials';
    timestamp: string;
}

export interface DependencyInstallProgressEvent {
    type: 'DEPENDENCY_INSTALL_PROGRESS';
    buildId: string;
    dependencyId: string;
    status: 'pending' | 'installing' | 'complete' | 'success' | 'error';
    progress: number;
    message?: string;
    timestamp: string;
}

export interface ResourcesRequiredEvent {
    type: 'RESOURCES_REQUIRED';
    buildId: string;
    recommendations: ResourceRecommendation[];
    minVramGb: number;
    estimatedRuntimeMinutes: number;
    timestamp: string;
}

export interface ResourceAllocatedEvent {
    type: 'RESOURCE_ALLOCATED';
    buildId: string;
    resourceId: string;
    allocationId: string;
    timestamp: string;
}

export interface BuildProgressEvent {
    type: 'BUILD_PROGRESS';
    buildId: string;
    stage: string;
    progress: number;
    message: string;
    timestamp: string;
}

export interface BuildCompleteEvent {
    type: 'BUILD_COMPLETE';
    buildId: string;
    success: boolean;
    filesGenerated: number;
    timestamp: string;
}

export interface DeploymentProgressEvent {
    type: 'DEPLOYMENT_PROGRESS';
    buildId: string;
    stage: string;
    progress: number;
    timestamp: string;
}

export interface DeploymentCompleteEvent {
    type: 'DEPLOYMENT_COMPLETE';
    buildId: string;
    endpointUrl: string;
    allocationId: string;
    inferenceCode: {
        python: string;
        typescript: string;
        curl: string;
    };
    timestamp: string;
}

export interface ErrorEvent {
    type: 'ERROR';
    buildId: string;
    message: string;
    recoverable: boolean;
    timestamp: string;
}

export type BuilderFlowEvent =
    | PhaseChangeEvent
    | PlanGenerationStartEvent
    | PlanGenerationProgressEvent
    | PlanGenerationCompleteEvent
    | IntentLockStartEvent
    | IntentLockCompleteEvent
    | DependenciesExtractedEvent
    | DependencyConnectedEvent
    | DependencyInstallProgressEvent
    | ResourcesRequiredEvent
    | ResourceAllocatedEvent
    | BuildProgressEvent
    | BuildCompleteEvent
    | DeploymentProgressEvent
    | DeploymentCompleteEvent
    | ErrorEvent;

interface ConnectionState {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    reconnectAttempts: number;
}

// =============================================================================
// HOOK: useBuilderFlowEvents
// =============================================================================

/**
 * Hook for subscribing to builder flow events via WebSocket
 */
export function useBuilderFlowEvents(
    buildId: string | null,
    options?: {
        autoConnect?: boolean;
        onEvent?: (event: BuilderFlowEvent) => void;
    }
): {
    connectionState: ConnectionState;
    connect: () => void;
    disconnect: () => void;
} {
    const { user } = useUserStore();
    const flowStore = useBuilderFlowStore();
    const planStore = usePlanModificationStore();

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const onEventRef = useRef(options?.onEvent);

    const [connectionState, setConnectionState] = useState<ConnectionState>({
        isConnected: false,
        isConnecting: false,
        error: null,
        reconnectAttempts: 0,
    });

    // Keep callback ref updated
    useEffect(() => {
        onEventRef.current = options?.onEvent;
    }, [options?.onEvent]);

    /**
     * Handle incoming events and update stores accordingly
     */
    const handleEvent = useCallback((event: BuilderFlowEvent) => {
        // Skip events for different builds
        if (event.buildId !== buildId) return;

        // Call user callback
        onEventRef.current?.(event);

        // Update stores based on event type
        switch (event.type) {
            case 'PHASE_CHANGE':
                flowStore.setPhase(event.phase);
                break;

            case 'PLAN_GENERATION_START':
                flowStore.setPlanGenerating(true);
                break;

            case 'PLAN_GENERATION_COMPLETE':
                flowStore.completePlanGeneration();
                // Also update plan modification store with the generated plan
                if (event.plan) {
                    planStore.setPlan(event.buildId, {
                        phases: event.plan.phases.map((phase, index) => ({
                            id: phase.id,
                            title: phase.name,
                            description: phase.description,
                            tasks: phase.tasks.map((task, taskIndex) => ({
                                id: task.id,
                                content: task.name,
                                completed: task.status === 'completed',
                                order: taskIndex,
                            })),
                            order: index,
                        })),
                    });
                }
                break;

            case 'INTENT_LOCK_COMPLETE':
                flowStore.lockIntent();
                break;

            case 'DEPENDENCIES_EXTRACTED':
                flowStore.setDependencies(event.dependencies);
                break;

            case 'DEPENDENCY_CONNECTED':
                flowStore.markDependencyConnected(event.dependencyId);
                break;

            case 'DEPENDENCY_INSTALL_PROGRESS': {
                // Map event status to DependencyInstallStatus type
                const mappedStatus = event.status === 'complete' ? 'success' : event.status;
                flowStore.updateInstallStatus(event.dependencyId, {
                    status: mappedStatus as 'pending' | 'installing' | 'success' | 'error',
                });
                // Update overall progress
                flowStore.setInstallProgress(event.progress);
                break;
            }

            case 'RESOURCES_REQUIRED':
                flowStore.setResourceRecommendations(event.recommendations);
                break;

            case 'RESOURCE_ALLOCATED':
                flowStore.approveResource(event.resourceId);
                break;

            case 'BUILD_COMPLETE':
                if (event.success) {
                    flowStore.nextPhase();
                }
                break;

            case 'DEPLOYMENT_COMPLETE':
                flowStore.setDeploymentEndpoint(event.endpointUrl, event.allocationId);
                flowStore.setDeploymentInferenceCode(event.inferenceCode);
                break;

            case 'ERROR':
                flowStore.setError(event.message);
                break;
        }
    }, [buildId, flowStore, planStore]);

    /**
     * Connect to WebSocket
     */
    const connect = useCallback(() => {
        if (!user?.id || !buildId) {
            setConnectionState((prev) => ({
                ...prev,
                error: !user?.id ? 'User not authenticated' : 'No build ID',
            }));
            return;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        setConnectionState((prev) => ({
            ...prev,
            isConnecting: true,
            error: null,
        }));

        // Build WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '') || window.location.host;
        const wsUrl = `${protocol}//${host}/ws/builder?userId=${user.id}&buildId=${buildId}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('[useBuilderFlowEvents] Connected to build:', buildId);
            setConnectionState({
                isConnected: true,
                isConnecting: false,
                error: null,
                reconnectAttempts: 0,
            });

            // Subscribe to build events
            ws.send(JSON.stringify({
                type: 'SUBSCRIBE_BUILD',
                buildId,
            }));
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.channel === 'builder:event') {
                    handleEvent(message.data as BuilderFlowEvent);
                } else if (message.channel === 'system' && message.data?.type === 'PING') {
                    ws.send(JSON.stringify({ type: 'PONG' }));
                }
            } catch (error) {
                console.error('[useBuilderFlowEvents] Failed to parse message:', error);
            }
        };

        ws.onclose = (event) => {
            console.log('[useBuilderFlowEvents] Disconnected:', event.code, event.reason);
            setConnectionState((prev) => ({
                ...prev,
                isConnected: false,
                isConnecting: false,
            }));

            // Auto-reconnect if not explicitly closed
            if (event.code !== 1000 && (options?.autoConnect ?? true)) {
                const attempts = connectionState.reconnectAttempts + 1;
                const delay = Math.min(1000 * Math.pow(2, attempts), 30000);

                reconnectTimeoutRef.current = setTimeout(() => {
                    setConnectionState((prev) => ({
                        ...prev,
                        reconnectAttempts: attempts,
                    }));
                    connect();
                }, delay);
            }
        };

        ws.onerror = (error) => {
            console.error('[useBuilderFlowEvents] WebSocket error:', error);
            setConnectionState((prev) => ({
                ...prev,
                error: 'WebSocket connection error',
            }));
        };
    }, [user?.id, buildId, options?.autoConnect, connectionState.reconnectAttempts, handleEvent]);

    /**
     * Disconnect from WebSocket
     */
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close(1000, 'Manual disconnect');
            wsRef.current = null;
        }

        setConnectionState({
            isConnected: false,
            isConnecting: false,
            error: null,
            reconnectAttempts: 0,
        });
    }, []);

    // Auto-connect on mount if enabled and buildId is available
    useEffect(() => {
        if ((options?.autoConnect ?? true) && buildId) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [buildId, user?.id]); // Reconnect when build or user changes

    return {
        connectionState,
        connect,
        disconnect,
    };
}

export default useBuilderFlowEvents;
