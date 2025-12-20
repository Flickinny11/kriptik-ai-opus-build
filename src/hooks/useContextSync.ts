/**
 * Context Synchronization Hook
 * 
 * Provides real-time synchronization with the agent orchestration backend
 * via WebSocket connection. Enables live updates for agents, tasks, and deployments.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';

// ============================================================================
// TYPES
// ============================================================================

export interface Agent {
    id: string;
    type: 'planning' | 'coding' | 'testing' | 'deployment' | 'research' | 'integration' | 'review' | 'debug';
    name: string;
    status: 'idle' | 'working' | 'waiting' | 'blocked' | 'error' | 'completed';
    currentTask?: {
        id: string;
        title: string;
        progress?: number;
    };
    tokensUsed: number;
}

export interface Task {
    id: string;
    type: string;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    assignedAgent?: string;
}

export interface Deployment {
    id: string;
    provider: string;
    status: 'pending' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed';
    endpoint?: string;
    logs: string[];
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'agent';
    content: string;
    agentId?: string;
    agentType?: string;
    timestamp: Date;
}

export interface WorkflowState {
    id: string;
    name: string;
    status: 'planning' | 'approved' | 'deploying' | 'running' | 'paused' | 'failed';
}

// Advanced Orchestration Types
export interface VerificationResult {
    verdict: 'approved' | 'needs_work' | 'blocked' | 'rejected';
    score: number;
    checkNumber: number;
    issueCount?: number;
    blockers?: Array<{ message: string }>;
}

export interface VideoAnalysis {
    timestamp: Date;
    frameId: string;
    elements: Array<{
        id: string;
        type: string;
        label: string;
        boundingBox: { x: number; y: number; width: number; height: number };
        confidence: number;
        isInteractive: boolean;
    }>;
    suggestions: string[];
    issues: Array<{ type: 'error' | 'warning' | 'info'; message: string }>;
}

export interface RoutingHints {
    preferredModels: string[];
    avoidPatterns: string[];
    successfulApproaches: string[];
}

export interface InterruptApplied {
    interruptId: string;
    type: string;
    action: 'applied' | 'queued' | 'rejected';
    agentResponse?: string;
}

export interface ContextState {
    contextId: string | null;
    sessionId: string | null;
    connected: boolean;
    agents: Agent[];
    tasks: Task[];
    deployments: Deployment[];
    messages: Message[];
    activeWorkflow: WorkflowState | null;
    totalTokensUsed: number;
    // Advanced orchestration state
    verificationResult: VerificationResult | null;
    videoAnalysis: VideoAnalysis | null;
    routingHints: RoutingHints | null;
    lastInterrupt: InterruptApplied | null;
    injectedContext: string | null;
}

interface WebSocketMessage {
    type: string;
    payload: any;
    timestamp: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useContextSync(projectId: string, userId: string) {
    const [state, setState] = useState<ContextState>({
        contextId: null,
        sessionId: null,
        connected: false,
        agents: [],
        tasks: [],
        deployments: [],
        messages: [],
        activeWorkflow: null,
        totalTokensUsed: 0,
        // Advanced orchestration state
        verificationResult: null,
        videoAnalysis: null,
        routingHints: null,
        lastInterrupt: null,
        injectedContext: null,
    });
    
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { toast } = useToast();
    
    // Connect to WebSocket
    const connect = useCallback(async () => {
        // First, create or get context via API
        try {
            const response = await fetch('/api/agents/context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to create context');
            }
            
            const { contextId, sessionId } = await response.json();
            
            setState(prev => ({ ...prev, contextId, sessionId }));
            
            // Connect WebSocket
            const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/context?contextId=${contextId}&userId=${userId}`;
            
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                setState(prev => ({ ...prev, connected: true }));
                
                // Subscribe to all events including advanced orchestration
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    payload: [
                        // Standard agent/task/deployment events
                        'agent:started', 'agent:completed', 'agent:error',
                        'task:created', 'task:started', 'task:completed', 'task:failed',
                        'deployment:started', 'deployment:completed', 'deployment:failed',
                        'workflow:approved', 'workflow:started', 'workflow:completed',
                        // Advanced orchestration events
                        'interrupt-applied', 'continuous-verification', 'verification-issue',
                        'video-analysis', 'routing-hints', 'context-injected',
                        // Builder/Developer/Agents mode events
                        'builder-started', 'builder-completed', 'builder-halted',
                        'developer-started', 'developer-completed', 'developer-halted',
                        'agents-started', 'agents-completed', 'agents-halted',
                    ],
                }));
            };
            
            ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    handleMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            ws.onclose = () => {
                setState(prev => ({ ...prev, connected: false }));
                
                // Attempt reconnect after 3 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, 3000);
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
            wsRef.current = ws;
            
        } catch (error) {
            console.error('Error connecting:', error);
            toast({
                title: 'Connection Error',
                description: 'Failed to connect to the orchestration server',
                variant: 'destructive',
            });
        }
    }, [projectId, userId, toast]);
    
    // Handle incoming messages
    const handleMessage = useCallback((message: WebSocketMessage) => {
        switch (message.type) {
            case 'initial-state':
                setState(prev => ({
                    ...prev,
                    agents: message.payload.activeAgents || [],
                    tasks: message.payload.taskQueue || [],
                    deployments: message.payload.deploymentState?.activeDeployments || [],
                    messages: (message.payload.recentMessages || []).map((m: any) => ({
                        ...m,
                        timestamp: new Date(m.timestamp),
                    })),
                    activeWorkflow: message.payload.activeWorkflow || null,
                }));
                break;
                
            case 'agent-update':
                setState(prev => ({
                    ...prev,
                    agents: prev.agents.map(a => 
                        a.id === message.payload.agent.id ? message.payload.agent : a
                    ),
                }));
                break;
                
            case 'task-update':
                setState(prev => ({
                    ...prev,
                    tasks: prev.tasks.map(t => 
                        t.id === message.payload.task.id ? message.payload.task : t
                    ),
                }));
                break;
                
            case 'deployment-update':
                setState(prev => ({
                    ...prev,
                    deployments: prev.deployments.map(d => 
                        d.id === message.payload.deployment.id ? message.payload.deployment : d
                    ),
                }));
                break;
                
            case 'new-message':
                setState(prev => ({
                    ...prev,
                    messages: [...prev.messages, {
                        ...message.payload.message,
                        timestamp: new Date(message.payload.message.timestamp),
                    }],
                }));
                break;
                
            case 'context-event':
                // Handle various context events
                const event = message.payload;
                switch (event.type) {
                    case 'agent:started':
                        setState(prev => ({
                            ...prev,
                            agents: [...prev.agents, event.data],
                        }));
                        break;
                    case 'task:created':
                        setState(prev => ({
                            ...prev,
                            tasks: [...prev.tasks, event.data],
                        }));
                        break;
                    // Add more event handlers as needed
                }
                break;
                
            case 'stream-chunk':
                // Handle streaming AI responses
                const { messageId, chunk } = message.payload;
                setState(prev => {
                    const existingIdx = prev.messages.findIndex(m => m.id === messageId);
                    if (existingIdx >= 0) {
                        const updated = [...prev.messages];
                        updated[existingIdx] = {
                            ...updated[existingIdx],
                            content: updated[existingIdx].content + chunk,
                        };
                        return { ...prev, messages: updated };
                    } else {
                        return {
                            ...prev,
                            messages: [...prev.messages, {
                                id: messageId,
                                role: 'assistant' as const,
                                content: chunk,
                                timestamp: new Date(),
                            }],
                        };
                    }
                });
                break;

            // ================================================================
            // ADVANCED ORCHESTRATION EVENTS
            // ================================================================

            case 'continuous-verification':
            case 'verification-issue':
                // Verification swarm results
                setState(prev => ({
                    ...prev,
                    verificationResult: {
                        verdict: message.payload.verdict,
                        score: message.payload.score,
                        checkNumber: message.payload.checkNumber,
                        issueCount: message.payload.issueCount,
                        blockers: message.payload.blockers,
                    },
                }));
                break;

            case 'video-analysis':
                // Gemini video analysis results
                setState(prev => ({
                    ...prev,
                    videoAnalysis: {
                        ...message.payload,
                        timestamp: new Date(message.payload.timestamp),
                    },
                }));
                break;

            case 'routing-hints':
                // Shadow pattern routing hints
                setState(prev => ({
                    ...prev,
                    routingHints: {
                        preferredModels: message.payload.preferredModels || [],
                        avoidPatterns: message.payload.avoidPatterns || [],
                        successfulApproaches: message.payload.successfulApproaches || [],
                    },
                }));
                break;

            case 'interrupt-applied':
                // Soft interrupt was applied
                setState(prev => ({
                    ...prev,
                    lastInterrupt: {
                        interruptId: message.payload.interruptId,
                        type: message.payload.type,
                        action: message.payload.action,
                        agentResponse: message.payload.agentResponse,
                    },
                }));
                break;

            case 'context-injected':
                // Context was injected into agent
                setState(prev => ({
                    ...prev,
                    injectedContext: message.payload.context,
                }));
                break;
        }
    }, []);
    
    // Send message to backend
    const sendMessage = useCallback((content: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            toast({
                title: 'Not Connected',
                description: 'Please wait for the connection to be established',
                variant: 'destructive',
            });
            return;
        }
        
        wsRef.current.send(JSON.stringify({
            type: 'add-message',
            payload: { content },
        }));
        
        // Optimistically add message to state
        setState(prev => ({
            ...prev,
            messages: [...prev.messages, {
                id: `temp-${Date.now()}`,
                role: 'user',
                content,
                timestamp: new Date(),
            }],
        }));
    }, [toast]);
    
    // Create a task
    const createTask = useCallback((type: string, title: string, description: string, input?: Record<string, unknown>) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
        }
        
        wsRef.current.send(JSON.stringify({
            type: 'create-task',
            payload: { type, title, description, input },
        }));
    }, []);
    
    // Request context refresh
    const refreshContext = useCallback(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
        }
        
        wsRef.current.send(JSON.stringify({
            type: 'get-context',
            payload: {},
        }));
    }, []);
    
    // Start orchestration
    const startOrchestration = useCallback(async () => {
        if (!state.contextId) return;
        
        try {
            await fetch(`/api/agents/context/${state.contextId}/orchestration/start`, {
                method: 'POST',
            });
            toast({
                title: 'Orchestration Started',
                description: 'Agents are now working on your tasks',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to start orchestration',
                variant: 'destructive',
            });
        }
    }, [state.contextId, toast]);
    
    // Stop orchestration
    const stopOrchestration = useCallback(async () => {
        if (!state.contextId) return;
        
        try {
            await fetch(`/api/agents/context/${state.contextId}/orchestration/stop`, {
                method: 'POST',
            });
            toast({
                title: 'Orchestration Stopped',
                description: 'Agents have stopped working',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to stop orchestration',
                variant: 'destructive',
            });
        }
    }, [state.contextId, toast]);
    
    // Connect on mount
    useEffect(() => {
        connect();
        
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);
    
    return {
        ...state,
        sendMessage,
        createTask,
        refreshContext,
        startOrchestration,
        stopOrchestration,
    };
}

