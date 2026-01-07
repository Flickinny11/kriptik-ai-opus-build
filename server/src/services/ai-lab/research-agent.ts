/**
 * AI Lab - Research Agent (PROMPT 6)
 *
 * Individual research agent that follows the 6-phase Build Loop protocol
 * adapted for research tasks. Each agent works on a specific focus area
 * and communicates findings with other agents.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface ResearchAgentConfig {
    orchestrationId: string;
    sessionId: string;
    focusArea: string;
    researchPrompt: string;
    budgetCents: number;
}

export interface ResearchFinding {
    id: string;
    category: 'insight' | 'recommendation' | 'warning' | 'question' | 'resource';
    summary: string;
    details: string;
    confidence: number; // 0-100
    relevance: number; // 0-100
    sources?: string[];
    timestamp: Date;
}

export interface ResearchResult {
    orchestrationId: string;
    focusArea: string;
    findings: ResearchFinding[];
    conclusion: string;
    tokensUsed: number;
    costCents: number;
    durationSeconds: number;
}

// ============================================================================
// RESEARCH AGENT CLASS
// ============================================================================

export class ResearchAgent extends EventEmitter {
    private config: ResearchAgentConfig;
    private findings: ResearchFinding[] = [];
    private tokensUsed: number = 0;
    private costCents: number = 0;
    private isRunning: boolean = false;
    private isPaused: boolean = false;
    private startTime: Date | null = null;

    constructor(config: ResearchAgentConfig) {
        super();
        this.config = config;
    }

    /**
     * Run the research process following Build Loop phases
     */
    async run(): Promise<ResearchResult> {
        this.isRunning = true;
        this.startTime = new Date();

        try {
            // Phase 0: Intent Lock - Understand the research goal
            await this.phase0_intentLock();
            if (!this.isRunning) return this.getResult();

            // Phase 1: Initialization - Set up research context
            await this.phase1_initialization();
            if (!this.isRunning) return this.getResult();

            // Phase 2: Parallel Research - Gather information
            await this.phase2_research();
            if (!this.isRunning) return this.getResult();

            // Phase 3: Integration - Combine findings
            await this.phase3_integration();
            if (!this.isRunning) return this.getResult();

            // Phase 4: Verification - Validate conclusions
            await this.phase4_verification();
            if (!this.isRunning) return this.getResult();

            // Phase 5: Intent Satisfaction - Check if research goal met
            await this.phase5_intentSatisfaction();
            if (!this.isRunning) return this.getResult();

            // Phase 6: Results Presentation
            return await this.phase6_presentation();

        } catch (error) {
            this.emit('error', { orchestrationId: this.config.orchestrationId, error });
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Stop the agent
     */
    stop(): void {
        this.isRunning = false;
    }

    /**
     * Pause the agent
     */
    pause(): void {
        this.isPaused = true;
    }

    /**
     * Resume the agent
     */
    resume(): void {
        this.isPaused = false;
    }

    // =========================================================================
    // RESEARCH PHASES
    // =========================================================================

    private async phase0_intentLock(): Promise<void> {
        this.emitPhaseUpdate(0, 0, 'running');

        // In production, this would use Claude to understand the research intent
        // For now, we simulate the phase
        await this.simulateWork(500);

        this.emitPhaseUpdate(0, 100, 'completed');
    }

    private async phase1_initialization(): Promise<void> {
        this.emitPhaseUpdate(1, 0, 'running');

        // Set up research context based on focus area
        await this.simulateWork(300);

        this.emitPhaseUpdate(1, 100, 'completed');
    }

    private async phase2_research(): Promise<void> {
        this.emitPhaseUpdate(2, 0, 'running');

        // Main research phase - generate findings based on focus area
        const numFindings = Math.floor(Math.random() * 3) + 2; // 2-4 findings

        for (let i = 0; i < numFindings; i++) {
            if (!this.isRunning || this.isPaused) break;

            await this.simulateWork(400);

            const finding = this.generateFinding(i);
            this.findings.push(finding);
            this.emit('finding', finding);

            // Update progress
            this.emitPhaseUpdate(2, Math.floor(((i + 1) / numFindings) * 100), 'running');
        }

        this.emitPhaseUpdate(2, 100, 'completed');
    }

    private async phase3_integration(): Promise<void> {
        this.emitPhaseUpdate(3, 0, 'running');

        // Integrate findings and check for conflicts with other agents
        await this.simulateWork(300);

        this.emitPhaseUpdate(3, 100, 'completed');
    }

    private async phase4_verification(): Promise<void> {
        this.emitPhaseUpdate(4, 0, 'running');

        // Verify findings accuracy
        await this.simulateWork(300);

        this.emitPhaseUpdate(4, 100, 'completed');
    }

    private async phase5_intentSatisfaction(): Promise<void> {
        this.emitPhaseUpdate(5, 0, 'running');

        // Check if research goal has been met
        await this.simulateWork(200);

        this.emitPhaseUpdate(5, 100, 'completed');
    }

    private async phase6_presentation(): Promise<ResearchResult> {
        this.emitPhaseUpdate(6, 0, 'running');

        // Generate final conclusion
        await this.simulateWork(300);

        this.emitPhaseUpdate(6, 100, 'completed');

        return this.getResult();
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private emitPhaseUpdate(phase: number, progress: number, status: string): void {
        this.emit('phase_update', {
            orchestrationId: this.config.orchestrationId,
            phase,
            progress,
            status,
        });
    }

    private async simulateWork(baseMs: number): Promise<void> {
        // In production, this would be actual AI processing
        const duration = baseMs + Math.random() * 200;
        await new Promise(resolve => setTimeout(resolve, duration));

        // Simulate token usage and cost
        const tokens = Math.floor(duration / 10);
        this.tokensUsed += tokens;
        const cost = Math.ceil(tokens * 0.01); // ~$0.01 per 100 tokens
        this.costCents += cost;
        this.emit('cost_update', cost);
    }

    private generateFinding(index: number): ResearchFinding {
        const categories: ResearchFinding['category'][] = ['insight', 'recommendation', 'warning', 'question', 'resource'];

        return {
            id: uuidv4(),
            category: categories[Math.floor(Math.random() * categories.length)],
            summary: `Finding ${index + 1} for ${this.config.focusArea}`,
            details: `Detailed analysis related to ${this.config.focusArea} in context of: ${this.config.researchPrompt.slice(0, 100)}...`,
            confidence: Math.floor(Math.random() * 30) + 70, // 70-100
            relevance: Math.floor(Math.random() * 30) + 70, // 70-100
            timestamp: new Date(),
        };
    }

    private getResult(): ResearchResult {
        const durationSeconds = this.startTime
            ? Math.floor((Date.now() - this.startTime.getTime()) / 1000)
            : 0;

        return {
            orchestrationId: this.config.orchestrationId,
            focusArea: this.config.focusArea,
            findings: this.findings,
            conclusion: `Based on ${this.findings.length} findings related to ${this.config.focusArea}, the research indicates key insights that address the original prompt.`,
            tokensUsed: this.tokensUsed,
            costCents: this.costCents,
            durationSeconds,
        };
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createResearchAgent(config: ResearchAgentConfig): ResearchAgent {
    return new ResearchAgent(config);
}
