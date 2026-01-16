/**
 * AI Lab - Research Agent (PRODUCTION)
 *
 * Individual research agent that follows the 6-phase Build Loop protocol
 * adapted for research tasks. Each agent works on a specific focus area
 * and communicates findings with other agents.
 * 
 * Uses real Claude API calls for AI-powered research.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    createOrchestratorClaudeService,
    type ClaudeService,
    type GenerationResponse,
    CLAUDE_MODELS,
} from '../ai/claude-service.js';

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

// Token costs (approximate for Claude Sonnet 4.5)
const COST_PER_INPUT_TOKEN = 0.003 / 1000; // $3 per 1M input tokens
const COST_PER_OUTPUT_TOKEN = 0.015 / 1000; // $15 per 1M output tokens

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
    private claudeService: ClaudeService;
    private researchContext: string = '';
    private intentUnderstanding: string = '';

    constructor(config: ResearchAgentConfig) {
        super();
        this.config = config;
        this.claudeService = createOrchestratorClaudeService();
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
    // RESEARCH PHASES - ALL USING REAL CLAUDE API
    // =========================================================================

    private async phase0_intentLock(): Promise<void> {
        this.emitPhaseUpdate(0, 0, 'running');

        // Check budget before starting
        if (this.costCents >= this.config.budgetCents) {
            this.emitPhaseUpdate(0, 100, 'budget_exceeded');
            return;
        }

        const response = await this.callClaude(`
You are a research assistant analyzing a research request.

RESEARCH PROMPT: ${this.config.researchPrompt}
FOCUS AREA: ${this.config.focusArea}

Your task is to deeply understand the intent behind this research request.

Please provide:
1. A clear statement of what the user is trying to accomplish
2. The key questions that need to be answered
3. The scope boundaries (what's in scope vs out of scope)
4. Success criteria - how will we know the research is complete?
5. Any assumptions we need to validate

Format your response as a structured analysis.
`);

        this.intentUnderstanding = response.content;
        this.emitPhaseUpdate(0, 100, 'completed');
    }

    private async phase1_initialization(): Promise<void> {
        this.emitPhaseUpdate(1, 0, 'running');

        if (this.costCents >= this.config.budgetCents) {
            this.emitPhaseUpdate(1, 100, 'budget_exceeded');
            return;
        }

        const response = await this.callClaude(`
Based on my understanding of the research intent:

${this.intentUnderstanding}

Now I need to establish the research context for focus area: "${this.config.focusArea}"

Please provide:
1. Key concepts and terminology relevant to this focus area
2. Important frameworks or mental models to apply
3. Known challenges or common pitfalls in this area
4. Related domains that might provide insights
5. Initial hypotheses worth exploring

This context will guide the research phase.
`);

        this.researchContext = response.content;
        this.emitPhaseUpdate(1, 100, 'completed');
    }

    private async phase2_research(): Promise<void> {
        this.emitPhaseUpdate(2, 0, 'running');

        // Generate multiple findings through iterative research
        const targetFindings = 4; // Aim for 4 substantial findings
        
        for (let i = 0; i < targetFindings && this.isRunning && !this.isPaused; i++) {
            if (this.costCents >= this.config.budgetCents) {
                this.emit('budget_warning', { 
                    spent: this.costCents, 
                    budget: this.config.budgetCents,
                    phase: 'research'
                });
                break;
            }

            const existingFindings = this.findings.map(f => `- ${f.category.toUpperCase()}: ${f.summary}`).join('\n');

            const response = await this.callClaude(`
RESEARCH CONTEXT:
${this.researchContext}

INTENT:
${this.intentUnderstanding}

FOCUS AREA: ${this.config.focusArea}
ORIGINAL PROMPT: ${this.config.researchPrompt}

${existingFindings ? `FINDINGS SO FAR:\n${existingFindings}\n` : ''}

I need to discover a NEW research finding for this focus area.
This should be finding #${i + 1} of my analysis.

Please provide ONE substantive finding in this EXACT JSON format:
{
  "category": "insight" | "recommendation" | "warning" | "question" | "resource",
  "summary": "Brief one-line summary of the finding",
  "details": "Detailed explanation with supporting reasoning (2-3 paragraphs)",
  "confidence": <number 0-100>,
  "relevance": <number 0-100>,
  "sources": ["source1", "source2"] // optional
}

Make this finding unique and valuable - don't repeat previous findings.
Focus on actionable, specific insights rather than generic observations.
`, { maxTokens: 2000 });

            // Parse the finding from the response
            const finding = this.parseFinding(response.content, i);
            if (finding) {
                this.findings.push(finding);
                this.emit('finding', finding);
            }

            // Update progress
            this.emitPhaseUpdate(2, Math.floor(((i + 1) / targetFindings) * 100), 'running');
        }

        this.emitPhaseUpdate(2, 100, 'completed');
    }

    private async phase3_integration(): Promise<void> {
        this.emitPhaseUpdate(3, 0, 'running');

        if (this.costCents >= this.config.budgetCents || this.findings.length === 0) {
            this.emitPhaseUpdate(3, 100, 'completed');
            return;
        }

        const findingsSummary = this.findings.map((f, i) => 
            `Finding ${i + 1} (${f.category}): ${f.summary}\n${f.details}`
        ).join('\n\n');

        const response = await this.callClaude(`
I've gathered the following research findings:

${findingsSummary}

Please analyze these findings for:
1. Patterns and connections between findings
2. Any contradictions or tensions that need resolution
3. Gaps in the research that should be noted
4. How these findings relate to the original research intent
5. Priority ranking of findings by importance

Provide a brief integration analysis that synthesizes these findings.
`);

        // Store integration analysis for use in later phases
        this.researchContext += '\n\nINTEGRATION ANALYSIS:\n' + response.content;
        
        this.emitPhaseUpdate(3, 100, 'completed');
    }

    private async phase4_verification(): Promise<void> {
        this.emitPhaseUpdate(4, 0, 'running');

        if (this.costCents >= this.config.budgetCents || this.findings.length === 0) {
            this.emitPhaseUpdate(4, 100, 'completed');
            return;
        }

        // Verify findings by challenging assumptions
        const response = await this.callClaude(`
I need to verify the quality and accuracy of my research findings.

ORIGINAL INTENT:
${this.intentUnderstanding}

MY FINDINGS:
${this.findings.map((f, i) => `${i + 1}. ${f.summary} (confidence: ${f.confidence}%)`).join('\n')}

Please critically evaluate:
1. Are there any logical fallacies in my reasoning?
2. What are the strongest counterarguments to each finding?
3. What evidence would strengthen or weaken these conclusions?
4. Are confidence levels appropriately calibrated?
5. What am I potentially missing or overlooking?

Be rigorous and skeptical. Identify any weaknesses.
`);

        // Update findings confidence based on verification
        // If verification reveals issues, we could adjust confidence scores
        const verificationAnalysis = response.content.toLowerCase();
        
        // Simple confidence adjustment based on verification tone
        if (verificationAnalysis.includes('significant concerns') || 
            verificationAnalysis.includes('major weakness')) {
            this.findings.forEach(f => {
                f.confidence = Math.max(50, f.confidence - 15);
            });
        }

        this.emitPhaseUpdate(4, 100, 'completed');
    }

    private async phase5_intentSatisfaction(): Promise<void> {
        this.emitPhaseUpdate(5, 0, 'running');

        if (this.costCents >= this.config.budgetCents) {
            this.emitPhaseUpdate(5, 100, 'completed');
            return;
        }

        const response = await this.callClaude(`
ORIGINAL RESEARCH REQUEST:
${this.config.researchPrompt}

FOCUS AREA: ${this.config.focusArea}

INTENT UNDERSTANDING:
${this.intentUnderstanding}

FINDINGS DISCOVERED (${this.findings.length}):
${this.findings.map(f => `- ${f.category}: ${f.summary}`).join('\n')}

Please evaluate: Does this research adequately address the original request?

Score the following (0-100):
1. Completeness: How thoroughly were the key questions answered?
2. Actionability: How actionable are the insights provided?
3. Depth: How deep is the analysis?
4. Relevance: How relevant are the findings to the original intent?

Provide an overall assessment and any critical gaps that remain.
`, { maxTokens: 1000 });

        // Emit satisfaction assessment
        this.emit('satisfaction_check', {
            orchestrationId: this.config.orchestrationId,
            assessment: response.content,
        });

        this.emitPhaseUpdate(5, 100, 'completed');
    }

    private async phase6_presentation(): Promise<ResearchResult> {
        this.emitPhaseUpdate(6, 0, 'running');

        let conclusionText = `Based on ${this.findings.length} findings related to ${this.config.focusArea}, the research indicates key insights that address the original prompt.`;

        if (this.costCents < this.config.budgetCents && this.findings.length > 0) {
            const response = await this.callClaude(`
Please write a concise executive summary of the research findings.

RESEARCH PROMPT: ${this.config.researchPrompt}
FOCUS AREA: ${this.config.focusArea}

KEY FINDINGS:
${this.findings.map((f, i) => `${i + 1}. [${f.category.toUpperCase()}] ${f.summary}`).join('\n')}

Write a 2-3 paragraph conclusion that:
1. Summarizes the main insights
2. Provides actionable recommendations
3. Notes any important caveats or limitations
4. Suggests next steps if applicable

Be concise but comprehensive.
`, { maxTokens: 1500 });

            conclusionText = response.content;
        }

        this.emitPhaseUpdate(6, 100, 'completed');

        return {
            orchestrationId: this.config.orchestrationId,
            focusArea: this.config.focusArea,
            findings: this.findings,
            conclusion: conclusionText,
            tokensUsed: this.tokensUsed,
            costCents: this.costCents,
            durationSeconds: this.getDurationSeconds(),
        };
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

    private async callClaude(
        prompt: string, 
        options: { maxTokens?: number } = {}
    ): Promise<GenerationResponse> {
        const maxTokens = options.maxTokens || 4000;

        try {
            const response = await this.claudeService.generate(prompt, {
                model: CLAUDE_MODELS.SONNET_4_5,
                maxTokens,
                temperature: 0.7,
            });

            // Track token usage and cost
            const inputCost = response.usage.inputTokens * COST_PER_INPUT_TOKEN;
            const outputCost = response.usage.outputTokens * COST_PER_OUTPUT_TOKEN;
            const callCostCents = Math.ceil((inputCost + outputCost) * 100);

            this.tokensUsed += response.usage.inputTokens + response.usage.outputTokens;
            this.costCents += callCostCents;

            // Emit cost update
            this.emit('cost_update', callCostCents);

            // Check budget
            if (this.costCents >= this.config.budgetCents) {
                this.emit('budget_exceeded', {
                    spent: this.costCents,
                    budget: this.config.budgetCents,
                });
            }

            return response;
        } catch (error) {
            console.error('[ResearchAgent] Claude API error:', error);
            throw error;
        }
    }

    private parseFinding(content: string, index: number): ResearchFinding | null {
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    id: uuidv4(),
                    category: parsed.category || 'insight',
                    summary: parsed.summary || `Finding ${index + 1}`,
                    details: parsed.details || content,
                    confidence: Math.min(100, Math.max(0, parsed.confidence || 75)),
                    relevance: Math.min(100, Math.max(0, parsed.relevance || 75)),
                    sources: parsed.sources,
                    timestamp: new Date(),
                };
            }

            // Fallback: Create finding from raw content
            return {
                id: uuidv4(),
                category: 'insight',
                summary: content.slice(0, 100).replace(/\n/g, ' ').trim() + '...',
                details: content,
                confidence: 70,
                relevance: 70,
                timestamp: new Date(),
            };
        } catch (error) {
            console.error('[ResearchAgent] Failed to parse finding:', error);
            return null;
        }
    }

    private getDurationSeconds(): number {
        return this.startTime
            ? Math.floor((Date.now() - this.startTime.getTime()) / 1000)
            : 0;
    }

    private getResult(): ResearchResult {
        return {
            orchestrationId: this.config.orchestrationId,
            focusArea: this.config.focusArea,
            findings: this.findings,
            conclusion: `Research stopped. ${this.findings.length} findings discovered for ${this.config.focusArea}.`,
            tokensUsed: this.tokensUsed,
            costCents: this.costCents,
            durationSeconds: this.getDurationSeconds(),
        };
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createResearchAgent(config: ResearchAgentConfig): ResearchAgent {
    return new ResearchAgent(config);
}
