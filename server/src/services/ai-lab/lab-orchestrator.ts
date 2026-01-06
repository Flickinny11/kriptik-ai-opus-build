/**
 * AI Lab - Main Orchestrator (PROMPT 6)
 *
 * The heart of the multi-agent research system. Manages up to 5 parallel
 * orchestrations that work together to solve complex research problems.
 *
 * Features:
 * - Spawn up to 5 parallel orchestrations
 * - Inter-agent communication via message bus
 * - Budget-controlled execution
 * - Real-time progress via SSE
 * - Results synthesis
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { aiLabSessions, aiLabOrchestrations, aiLabMessages } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { ResearchAgent, createResearchAgent, type ResearchFinding } from './research-agent.js';
import { AgentCommunicator, createAgentCommunicator, type AgentMessage } from './agent-communicator.js';
import { ResultSynthesizer, createResultSynthesizer, type SynthesizedResult } from './result-synthesizer.js';
import { nowSQLite } from '../../utils/dates.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AILabSessionConfig {
    userId: string;
    projectId?: string;
    researchPrompt: string;
    problemType?: 'general' | 'code_review' | 'architecture' | 'optimization' | 'research';
    budgetLimitCents?: number;
    maxOrchestrations?: number;
    maxDurationMinutes?: number;
}

export interface AILabSession {
    id: string;
    userId: string;
    projectId?: string;
    researchPrompt: string;
    problemType: string;
    budgetLimitCents: number;
    maxOrchestrations: number;
    maxDurationMinutes: number;
    status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    synthesizedResult?: SynthesizedResult;
    totalTokensUsed: number;
    totalCostCents: number;
    orchestrationsCompleted: number;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface OrchestrationStatus {
    id: string;
    index: number;
    focusArea: string;
    currentPhase: number;
    phaseProgress: number;
    phaseStatus: string;
    status: string;
    findings: ResearchFinding[];
    conclusion?: string;
    tokensUsed: number;
    costCents: number;
}

export interface LabProgress {
    sessionId: string;
    status: AILabSession['status'];
    orchestrations: OrchestrationStatus[];
    totalProgress: number;
    budgetUsedPercent: number;
    elapsedMinutes: number;
    messages: AgentMessage[];
}

// ============================================================================
// LAB ORCHESTRATOR CLASS
// ============================================================================

export class LabOrchestrator extends EventEmitter {
    private sessionId: string;
    private config: AILabSessionConfig;
    private agents: Map<string, ResearchAgent> = new Map();
    private communicator: AgentCommunicator;
    private synthesizer: ResultSynthesizer;
    private isRunning: boolean = false;
    private startTime: Date | null = null;
    private budgetUsedCents: number = 0;

    constructor(sessionId: string, config: AILabSessionConfig) {
        super();
        this.sessionId = sessionId;
        this.config = {
            ...config,
            budgetLimitCents: config.budgetLimitCents || 10000,
            maxOrchestrations: config.maxOrchestrations || 5,
            maxDurationMinutes: config.maxDurationMinutes || 60,
        };
        this.communicator = createAgentCommunicator(sessionId);
        this.synthesizer = createResultSynthesizer();
    }

    /**
     * Create a new AI Lab session
     */
    static async createSession(config: AILabSessionConfig): Promise<LabOrchestrator> {
        const sessionId = uuidv4();
        
        // Insert session into database
        await db.insert(aiLabSessions).values({
            id: sessionId,
            userId: config.userId,
            projectId: config.projectId,
            researchPrompt: config.researchPrompt,
            problemType: config.problemType || 'general',
            budgetLimitCents: config.budgetLimitCents || 10000,
            maxOrchestrations: config.maxOrchestrations || 5,
            maxDurationMinutes: config.maxDurationMinutes || 60,
            status: 'initializing',
        });

        return new LabOrchestrator(sessionId, config);
    }

    /**
     * Start the multi-agent research session
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error('Session already running');
        }

        this.isRunning = true;
        this.startTime = new Date();

        try {
            // Update session status
            await db.update(aiLabSessions)
                .set({ status: 'running', startedAt: nowSQLite() })
                .where(eq(aiLabSessions.id, this.sessionId));

            this.emit('session_started', { sessionId: this.sessionId });

            // Decompose the research problem into focus areas
            const focusAreas = await this.decomposeResearchProblem();

            // Spawn orchestrations in parallel
            const orchestrationPromises = focusAreas.slice(0, this.config.maxOrchestrations).map(
                (focusArea, index) => this.spawnOrchestration(index, focusArea)
            );

            // Wait for all orchestrations to complete
            const results = await Promise.all(orchestrationPromises);

            // Check if we exceeded budget during execution
            if (this.budgetUsedCents >= (this.config.budgetLimitCents || 10000)) {
                this.emit('budget_exceeded', { 
                    sessionId: this.sessionId, 
                    budgetUsed: this.budgetUsedCents 
                });
            }

            // Synthesize results
            const synthesizedResult = await this.synthesizeResults(results);

            // Update session with final results
            await db.update(aiLabSessions)
                .set({
                    status: 'completed',
                    synthesizedResult: synthesizedResult as any,
                    totalCostCents: this.budgetUsedCents,
                    orchestrationsCompleted: results.filter(r => r.status === 'completed').length,
                    completedAt: nowSQLite(),
                    updatedAt: nowSQLite(),
                })
                .where(eq(aiLabSessions.id, this.sessionId));

            this.emit('session_completed', { 
                sessionId: this.sessionId, 
                result: synthesizedResult 
            });

        } catch (error) {
            await db.update(aiLabSessions)
                .set({ status: 'failed', updatedAt: nowSQLite() })
                .where(eq(aiLabSessions.id, this.sessionId));

            this.emit('session_failed', { 
                sessionId: this.sessionId, 
                error: (error as Error).message 
            });
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Stop the session (graceful shutdown)
     */
    async stop(): Promise<void> {
        this.isRunning = false;

        // Stop all agents
        for (const agent of this.agents.values()) {
            agent.stop();
        }

        await db.update(aiLabSessions)
            .set({ status: 'cancelled', updatedAt: nowSQLite() })
            .where(eq(aiLabSessions.id, this.sessionId));

        this.emit('session_stopped', { sessionId: this.sessionId });
    }

    /**
     * Pause the session
     */
    async pause(): Promise<void> {
        this.isRunning = false;

        for (const agent of this.agents.values()) {
            agent.pause();
        }

        await db.update(aiLabSessions)
            .set({ status: 'paused', updatedAt: nowSQLite() })
            .where(eq(aiLabSessions.id, this.sessionId));

        this.emit('session_paused', { sessionId: this.sessionId });
    }

    /**
     * Get current progress
     */
    async getProgress(): Promise<LabProgress> {
        const [session] = await db.select()
            .from(aiLabSessions)
            .where(eq(aiLabSessions.id, this.sessionId));

        const orchestrations = await db.select()
            .from(aiLabOrchestrations)
            .where(eq(aiLabOrchestrations.sessionId, this.sessionId));

        const messages = await db.select()
            .from(aiLabMessages)
            .where(eq(aiLabMessages.sessionId, this.sessionId));

        const elapsedMinutes = this.startTime 
            ? (Date.now() - this.startTime.getTime()) / (1000 * 60)
            : 0;

        const totalProgress = orchestrations.length > 0
            ? orchestrations.reduce((sum, o) => sum + (o.phaseProgress || 0), 0) / orchestrations.length
            : 0;

        const budgetUsedPercent = (this.budgetUsedCents / (this.config.budgetLimitCents || 10000)) * 100;

        return {
            sessionId: this.sessionId,
            status: session?.status as AILabSession['status'] || 'initializing',
            orchestrations: orchestrations.map(o => ({
                id: o.id,
                index: o.orchestrationIndex,
                focusArea: o.focusArea,
                currentPhase: o.currentPhase || 0,
                phaseProgress: o.phaseProgress || 0,
                phaseStatus: o.phaseStatus || 'pending',
                status: o.status,
                findings: (o.findings as ResearchFinding[]) || [],
                conclusion: o.conclusion || undefined,
                tokensUsed: o.tokensUsed || 0,
                costCents: o.costCents || 0,
            })),
            totalProgress,
            budgetUsedPercent,
            elapsedMinutes,
            messages: messages.map(m => ({
                id: m.id,
                sessionId: m.sessionId,
                fromOrchestrationId: m.fromOrchestrationId,
                toOrchestrationId: m.toOrchestrationId || undefined,
                messageType: m.messageType as AgentMessage['messageType'],
                content: m.content,
                metadata: m.metadata as Record<string, unknown> | undefined,
                timestamp: new Date(m.createdAt),
            })),
        };
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    /**
     * Decompose the research problem into focus areas for parallel exploration
     */
    private async decomposeResearchProblem(): Promise<string[]> {
        // Use AI to break down the problem into distinct focus areas
        // For now, use a rule-based approach based on problem type
        const { researchPrompt, problemType } = this.config;

        const focusAreas: string[] = [];

        switch (problemType) {
            case 'code_review':
                focusAreas.push(
                    'Security vulnerabilities and best practices',
                    'Performance optimizations and bottlenecks',
                    'Code structure and maintainability',
                    'Error handling and edge cases',
                    'Documentation and test coverage'
                );
                break;
            case 'architecture':
                focusAreas.push(
                    'System scalability and performance',
                    'Data flow and state management',
                    'API design and integration points',
                    'Security architecture and access control',
                    'Deployment and infrastructure considerations'
                );
                break;
            case 'optimization':
                focusAreas.push(
                    'Algorithm efficiency analysis',
                    'Memory usage optimization',
                    'Network and I/O optimization',
                    'Caching strategies',
                    'Parallelization opportunities'
                );
                break;
            case 'research':
                focusAreas.push(
                    'Background and context research',
                    'Current state of the art',
                    'Alternative approaches comparison',
                    'Implementation considerations',
                    'Future directions and trends'
                );
                break;
            default:
                // General problem - create custom focus areas
                focusAreas.push(
                    `Primary analysis: ${researchPrompt.slice(0, 50)}...`,
                    'Alternative perspectives and approaches',
                    'Potential challenges and solutions',
                    'Best practices and recommendations',
                    'Implementation roadmap'
                );
        }

        return focusAreas;
    }

    /**
     * Spawn a single orchestration for a focus area
     */
    private async spawnOrchestration(index: number, focusArea: string): Promise<OrchestrationStatus> {
        const orchestrationId = uuidv4();

        // Create orchestration record
        await db.insert(aiLabOrchestrations).values({
            id: orchestrationId,
            sessionId: this.sessionId,
            orchestrationIndex: index,
            focusArea,
            status: 'initializing',
        });

        // Announce focus area to other orchestrations
        await this.communicator.broadcast({
            sessionId: this.sessionId,
            fromOrchestrationId: orchestrationId,
            messageType: 'focus_announcement',
            content: `Orchestration ${index + 1} is focusing on: ${focusArea}`,
            metadata: { index, focusArea },
            timestamp: new Date(),
        });

        // Create research agent
        const agent = createResearchAgent({
            orchestrationId,
            sessionId: this.sessionId,
            focusArea,
            researchPrompt: this.config.researchPrompt,
            budgetCents: Math.floor((this.config.budgetLimitCents || 10000) / (this.config.maxOrchestrations || 5)),
        });

        this.agents.set(orchestrationId, agent);

        // Listen to agent events
        agent.on('phase_update', (data) => {
            this.emit('orchestration_phase_update', { orchestrationId, ...data });
        });

        agent.on('finding', async (finding: ResearchFinding) => {
            // Share finding with other orchestrations
            await this.communicator.broadcast({
                sessionId: this.sessionId,
                fromOrchestrationId: orchestrationId,
                messageType: 'finding',
                content: finding.summary,
                metadata: { finding },
                timestamp: new Date(),
            });
            this.emit('orchestration_finding', { orchestrationId, finding });
        });

        agent.on('cost_update', (costCents: number) => {
            this.budgetUsedCents += costCents;
            
            // Check budget at 80%
            if (this.budgetUsedCents >= (this.config.budgetLimitCents || 10000) * 0.8) {
                this.emit('budget_warning', { 
                    sessionId: this.sessionId, 
                    budgetUsedPercent: (this.budgetUsedCents / (this.config.budgetLimitCents || 10000)) * 100 
                });
            }
            
            // Hard stop at 100%
            if (this.budgetUsedCents >= (this.config.budgetLimitCents || 10000)) {
                this.stop();
            }
        });

        // Run the agent
        try {
            await db.update(aiLabOrchestrations)
                .set({ status: 'running', startedAt: nowSQLite() })
                .where(eq(aiLabOrchestrations.id, orchestrationId));

            const result = await agent.run();

            await db.update(aiLabOrchestrations)
                .set({
                    status: 'completed',
                    findings: result.findings as any,
                    conclusion: result.conclusion,
                    tokensUsed: result.tokensUsed,
                    costCents: result.costCents,
                    currentPhase: 6,
                    phaseProgress: 100,
                    phaseStatus: 'completed',
                    completedAt: nowSQLite(),
                    updatedAt: nowSQLite(),
                })
                .where(eq(aiLabOrchestrations.id, orchestrationId));

            return {
                id: orchestrationId,
                index,
                focusArea,
                currentPhase: 6,
                phaseProgress: 100,
                phaseStatus: 'completed',
                status: 'completed',
                findings: result.findings,
                conclusion: result.conclusion,
                tokensUsed: result.tokensUsed,
                costCents: result.costCents,
            };

        } catch (error) {
            await db.update(aiLabOrchestrations)
                .set({ 
                    status: 'failed', 
                    phaseStatus: 'failed',
                    updatedAt: nowSQLite() 
                })
                .where(eq(aiLabOrchestrations.id, orchestrationId));

            return {
                id: orchestrationId,
                index,
                focusArea,
                currentPhase: 0,
                phaseProgress: 0,
                phaseStatus: 'failed',
                status: 'failed',
                findings: [],
                tokensUsed: 0,
                costCents: 0,
            };
        }
    }

    /**
     * Synthesize results from all orchestrations
     */
    private async synthesizeResults(results: OrchestrationStatus[]): Promise<SynthesizedResult> {
        const allFindings = results.flatMap(r => r.findings);
        const conclusions = results.map(r => r.conclusion).filter(Boolean) as string[];

        return this.synthesizer.synthesize({
            researchPrompt: this.config.researchPrompt,
            findings: allFindings,
            conclusions,
            messages: await this.communicator.getMessages(this.sessionId),
        });
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export async function createLabOrchestrator(config: AILabSessionConfig): Promise<LabOrchestrator> {
    return LabOrchestrator.createSession(config);
}
