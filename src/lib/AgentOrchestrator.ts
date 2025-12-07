/**
 * Agent Orchestrator - PRODUCTION CLIENT
 *
 * This connects to the REAL backend orchestrator that:
 * 1. Calls Claude 4.5 via Helicone for AI generation
 * 2. Decomposes requirements into tasks
 * 3. Coordinates multiple specialist agents
 * 4. Generates real, production code
 *
 * NO SIMULATION. NO FAKE DELAYS.
 */

import { AgentType, AgentLog } from './agent-types';
import { useAgentStore } from '../store/useAgentStore';
import { useCostStore } from '../store/useCostStore';
import { useEditorStore } from '../store/useEditorStore';
import { apiClient } from './api-client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper to get user ID for authenticated requests
function getUserId(): string | null {
    // First try from apiClient (set during login)
    const fromClient = apiClient.getUserId();
    if (fromClient) return fromClient;

    // Fallback to localStorage
    try {
        return localStorage.getItem('kriptik_user_id');
    } catch {
        return null;
    }
}

export interface OrchestratorEvent {
    type: string;
    data: unknown;
    timestamp?: string;
}

export interface ExecutionPlan {
    projectId: string;
    projectName: string;
    phases: Array<{
        id: string;
        name: string;
        status: string;
        tasks: Array<{
            id: string;
            name: string;
            status: string;
            type: string;
            artifacts: Array<{
                path: string;
                content: string;
                language: string;
            }>;
        }>;
    }>;
    status: string;
}

export class AgentOrchestrator {
    private isPaused: boolean = false;
    private shouldStop: boolean = false;
    private currentProjectId: string | null = null;

    constructor() {}

    /**
     * Start the orchestration process
     * This calls the REAL backend API
     */
    async start(prompt: string, projectId?: string) {
        this.isPaused = false;
        this.shouldStop = false;

        const store = useAgentStore.getState();
        const costStore = useCostStore.getState();
        const editorStore = useEditorStore.getState();

        store.reset();
        store.setGlobalStatus('running');

        try {
            // Step 1: Analyze the project request
            this.addLog('planning', 'Analyzing project requirements with AI...', 'info');
            store.setActiveAgent('planning');
            store.updateAgentStatus('planning', 'working');

            const userId = getUserId();
            if (!userId) {
                throw new Error('Authentication required');
            }

            // First, analyze the task using KripToeNite for intelligent routing
            let ktnAnalysis = null;
            try {
                const ktnResponse = await fetch(`${API_BASE}/api/krip-toe-nite/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': userId,
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        prompt,
                        context: { projectId },
                    }),
                });
                if (ktnResponse.ok) {
                    ktnAnalysis = await ktnResponse.json();
                    this.addLog('planning', `KTN Analysis: ${ktnAnalysis.routing?.strategy} strategy, ${ktnAnalysis.analysis?.complexity || 'auto'} complexity`, 'info');
                }
            } catch (e) {
                // KTN analysis is optional, continue without it
            }

            const analysisResponse = await fetch(`${API_BASE}/api/orchestrate/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                },
                credentials: 'include',
                body: JSON.stringify({
                    prompt,
                    projectId,
                    projectName: `Project ${Date.now()}`,
                    ktnRouting: ktnAnalysis?.routing, // Pass KTN routing decision to orchestrator
                }),
            });

            if (!analysisResponse.ok) {
                const error = await analysisResponse.json();
                throw new Error(error.message || 'Failed to analyze project');
            }

            const analysisResult = await analysisResponse.json();
            this.currentProjectId = analysisResult.projectId;

            // Log the analysis
            this.addLog('planning', `Created execution plan with ${analysisResult.plan.phases.length} phases`, 'success');
            store.updateAgentStatus('planning', 'completed');
            store.updateAgentProgress('planning', 100);

            // Step 2: Execute the plan with SSE streaming
            this.addLog('generation', 'Starting multi-agent code generation...', 'info');
            store.setActiveAgent('generation');
            store.updateAgentStatus('generation', 'working');

            if (!this.currentProjectId) {
                throw new Error('Project ID is required for execution');
            }
            await this.executeWithStreaming(this.currentProjectId, editorStore, store, costStore);

            store.setGlobalStatus('completed');
            this.addLog('deployment', 'All agents completed successfully!', 'success');

            // Calculate final costs
            costStore.setBreakdown({
                totalUsed: costStore.activeSessionCost,
                agentBreakdown: {
                    planning: Math.ceil(costStore.activeSessionCost * 0.15),
                    generation: Math.ceil(costStore.activeSessionCost * 0.50),
                    testing: Math.ceil(costStore.activeSessionCost * 0.15),
                    refinement: Math.ceil(costStore.activeSessionCost * 0.10),
                    deployment: Math.ceil(costStore.activeSessionCost * 0.10),
                },
                drivers: [
                    { name: 'AI Token Usage', cost: Math.ceil(costStore.activeSessionCost * 0.7) },
                    { name: 'Code Analysis', cost: Math.ceil(costStore.activeSessionCost * 0.2) },
                    { name: 'Infrastructure', cost: Math.ceil(costStore.activeSessionCost * 0.1) },
                ],
                optimizationTips: [
                    'Reuse generated components for similar features',
                    'Use templates for common patterns',
                ],
            });

        } catch (error) {
            console.error('Orchestration failed:', error);
            store.setGlobalStatus('failed');
            this.addLog('planning', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }

    /**
     * Execute the plan with Server-Sent Events for real-time updates
     */
    private async executeWithStreaming(
        projectId: string,
        editorStore: ReturnType<typeof useEditorStore.getState>,
        store: ReturnType<typeof useAgentStore.getState>,
        costStore: ReturnType<typeof useCostStore.getState>
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const userId = getUserId();
            if (!userId) {
                reject(new Error('Authentication required'));
                return;
            }

            // Use fetch with ReadableStream for SSE
            fetch(`${API_BASE}/api/orchestrate/${projectId}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                },
                credentials: 'include',
            }).then(async (response) => {
                if (!response.ok) {
                    const error = await response.json();
                    reject(new Error(error.message || 'Execution failed'));
                    return;
                }

                const reader = response.body?.getReader();
                if (!reader) {
                    reject(new Error('No response body'));
                    return;
                }

                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    if (this.shouldStop) {
                        reader.cancel();
                        break;
                    }

                    while (this.isPaused) {
                        await new Promise(r => setTimeout(r, 100));
                    }

                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Process SSE events from buffer
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (line.startsWith('event:')) {
                            // Event type is on the line, data follows
                            continue;
                        }

                        if (line.startsWith('data:')) {
                            try {
                                const data = JSON.parse(line.slice(5).trim());
                                this.handleEvent(data, editorStore, store, costStore);
                            } catch {
                                // Skip malformed JSON
                            }
                        }
                    }
                }

                resolve();
            }).catch(reject);
        });
    }

    /**
     * Handle incoming events from the backend
     */
    private handleEvent(
        event: OrchestratorEvent,
        editorStore: ReturnType<typeof useEditorStore.getState>,
        store: ReturnType<typeof useAgentStore.getState>,
        costStore: ReturnType<typeof useCostStore.getState>
    ) {
        const data = event.data as Record<string, unknown>;

        switch (event.type) {
            case 'phase_started':
                const phaseName = data.phaseName as string;
                this.addLog('generation', `Phase started: ${phaseName}`, 'info');
                break;

            case 'phase_completed':
                this.addLog('generation', `Phase completed: ${data.phaseName}`, 'success');
                break;

            case 'task_started':
                const taskAgent = this.mapTaskTypeToAgent(data.taskType as string);
                store.setActiveAgent(taskAgent);
                store.updateAgentStatus(taskAgent, 'working');
                this.addLog(taskAgent, `Working on: ${data.taskName}`, 'info');
                break;

            case 'task_completed':
                const completedAgent = this.mapTaskTypeToAgent(data.taskType as string);
                store.updateAgentStatus(completedAgent, 'completed');
                store.updateAgentProgress(completedAgent, 100);

                // Process artifacts (generated code)
                const artifacts = data.artifacts as Array<{ path: string; content: string; language: string }>;
                if (artifacts && artifacts.length > 0) {
                    for (const artifact of artifacts) {
                        // Add to editor
                        editorStore.addFile({
                            id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            projectId: this.currentProjectId || '',
                            name: artifact.path.split('/').pop() || 'file',
                            path: artifact.path,
                            content: artifact.content,
                        });
                        this.addLog(completedAgent, `Generated: ${artifact.path}`, 'success');
                    }
                }
                break;

            case 'task_failed':
                this.addLog('generation', `Task failed: ${data.error}`, 'error');
                break;

            case 'artifact_created':
                this.addLog('generation', `Created: ${data.path}`, 'thought');
                break;

            case 'context_updated':
                this.addLog('refinement', 'Updated shared context', 'thought');
                break;

            case 'quality_gate_passed':
                this.addLog('testing', `Quality gate passed for ${data.phase}`, 'success');
                store.updateAgentStatus('testing', 'completed');
                store.updateAgentProgress('testing', 100);
                break;

            case 'quality_gate_failed':
                this.addLog('testing', `Quality issues detected in ${data.phase}`, 'warning');
                break;

            case 'log':
                const logData = data as { level?: string; message?: string; agent?: string };
                const level = logData.level || 'info';
                const agent = this.mapAgentNameToType(logData.agent as string);
                this.addLog(agent, logData.message || '', level as AgentLog['type']);
                break;

            case 'error':
                this.addLog('generation', `Error: ${data.message}`, 'error');
                break;

            case 'complete':
                this.addLog('deployment', 'Generation complete', 'success');
                break;
        }

        // Track costs based on activity
        if (event.type === 'task_completed') {
            costStore.deductCredits(1, `Task: ${data.taskName}`);
        }
    }

    /**
     * Map task type to agent type
     */
    private mapTaskTypeToAgent(taskType: string): AgentType {
        const mapping: Record<string, AgentType> = {
            infrastructure: 'deployment',
            development: 'generation',
            design: 'generation',
            quality: 'testing',
        };
        return mapping[taskType] || 'generation';
    }

    /**
     * Map agent name from backend to frontend agent type
     */
    private mapAgentNameToType(agentName?: string): AgentType {
        if (!agentName) return 'generation';

        const name = agentName.toLowerCase();
        if (name.includes('planning') || name.includes('orchestrator')) return 'planning';
        if (name.includes('test') || name.includes('quality')) return 'testing';
        if (name.includes('refine') || name.includes('optimize')) return 'refinement';
        if (name.includes('deploy') || name.includes('infra')) return 'deployment';
        return 'generation';
    }

    /**
     * Add a log entry
     */
    private addLog(type: AgentType, message: string, logType: AgentLog['type'] = 'info') {
        const store = useAgentStore.getState();
        store.addLog({
            id: Math.random().toString(36).substr(2, 9),
            agentType: type,
            message,
            timestamp: new Date(),
            type: logType,
        });
    }

    /**
     * Pause execution
     */
    pause() {
        this.isPaused = true;
        useAgentStore.getState().setGlobalStatus('paused');

        // Also pause on backend
        if (this.currentProjectId) {
            fetch(`${API_BASE}/api/orchestrate/${this.currentProjectId}/pause`, {
                method: 'POST',
            }).catch(console.error);
        }
    }

    /**
     * Resume execution
     */
    resume() {
        this.isPaused = false;
        useAgentStore.getState().setGlobalStatus('running');

        // Also resume on backend
        if (this.currentProjectId) {
            fetch(`${API_BASE}/api/orchestrate/${this.currentProjectId}/resume`, {
                method: 'POST',
            }).catch(console.error);
        }
    }

    /**
     * Stop execution
     */
    stop() {
        this.shouldStop = true;
        this.isPaused = false;
        useAgentStore.getState().setGlobalStatus('idle');

        // Also stop on backend
        if (this.currentProjectId) {
            fetch(`${API_BASE}/api/orchestrate/${this.currentProjectId}`, {
                method: 'DELETE',
            }).catch(console.error);
        }

        this.currentProjectId = null;
    }

    /**
     * Get current project ID
     */
    getCurrentProjectId(): string | null {
        return this.currentProjectId;
    }
}

export const orchestrator = new AgentOrchestrator();
