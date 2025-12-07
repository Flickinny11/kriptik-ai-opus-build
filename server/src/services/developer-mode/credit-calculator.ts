/**
 * Credit Calculator Service - Developer Mode Cost Tracking
 *
 * Provides transparent cost estimation and tracking for AI operations:
 * - Pre-execution cost estimates
 * - Real-time usage tracking
 * - Credit balance management
 * - Usage analytics
 */

import { db } from '../../db.js';
import { developerModeAgents, developerModeCreditTransactions, subscriptions } from '../../schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';

// =============================================================================
// MODEL PRICING (per million tokens)
// =============================================================================

export interface ModelPricing {
    modelId: string;
    name: string;
    inputPricePerMillion: number;
    outputPricePerMillion: number;
    tier: 'premium' | 'standard' | 'economy';
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
    'anthropic/claude-opus-4.5': {
        modelId: 'anthropic/claude-opus-4.5',
        name: 'Claude Opus 4.5',
        inputPricePerMillion: 15.0,
        outputPricePerMillion: 75.0,
        tier: 'premium',
    },
    'anthropic/claude-sonnet-4.5': {
        modelId: 'anthropic/claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        inputPricePerMillion: 3.0,
        outputPricePerMillion: 15.0,
        tier: 'standard',
    },
    'anthropic/claude-3.5-haiku': {
        modelId: 'anthropic/claude-3.5-haiku',
        name: 'Claude Haiku 3.5',
        inputPricePerMillion: 0.25,
        outputPricePerMillion: 1.25,
        tier: 'economy',
    },
    'openai/gpt-4o': {
        modelId: 'openai/gpt-4o',
        name: 'GPT-4o',
        inputPricePerMillion: 2.5,
        outputPricePerMillion: 10.0,
        tier: 'premium',
    },
    'google/gemini-2.0-flash-thinking-exp': {
        modelId: 'google/gemini-2.0-flash-thinking-exp',
        name: 'Gemini 2.0 Flash',
        inputPricePerMillion: 1.0,
        outputPricePerMillion: 4.0,
        tier: 'standard',
    },
    'deepseek/deepseek-chat-v3-0324': {
        modelId: 'deepseek/deepseek-chat-v3-0324',
        name: 'DeepSeek V3',
        inputPricePerMillion: 0.14,
        outputPricePerMillion: 0.28,
        tier: 'economy',
    },
};

// Default pricing for unknown models
const DEFAULT_PRICING: ModelPricing = {
    modelId: 'unknown',
    name: 'Unknown Model',
    inputPricePerMillion: 5.0,
    outputPricePerMillion: 15.0,
    tier: 'standard',
};

// =============================================================================
// TYPES
// =============================================================================

export interface CostEstimate {
    modelId: string;
    modelName: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedInputCost: number;
    estimatedOutputCost: number;
    estimatedTotalCost: number;
    confidence: 'low' | 'medium' | 'high';
    breakdown: {
        component: string;
        tokens: number;
        cost: number;
    }[];
}

export interface UsageRecord {
    id: string;
    agentId: string;
    runId: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    durationMs: number;
    timestamp: string;
}

export interface UsageSummary {
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    averageCostPerRun: number;
    runCount: number;
    byModel: Record<string, {
        tokens: number;
        cost: number;
        runs: number;
    }>;
    byDay: Record<string, {
        tokens: number;
        cost: number;
        runs: number;
    }>;
}

export interface CreditBalance {
    userId: string;
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
    lastUpdated: string;
}

// =============================================================================
// CREDIT CALCULATOR SERVICE
// =============================================================================

export class CreditCalculatorService {
    private userId: string;
    private projectId: string;

    constructor(userId: string, projectId: string) {
        this.userId = userId;
        this.projectId = projectId;
    }

    /**
     * Get pricing for a model
     */
    getModelPricing(modelId: string): ModelPricing {
        return MODEL_PRICING[modelId] || DEFAULT_PRICING;
    }

    /**
     * Estimate cost for a task before execution
     */
    estimateTaskCost(
        modelId: string,
        taskDescription: string,
        complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex' = 'moderate'
    ): CostEstimate {
        const pricing = this.getModelPricing(modelId);

        // Estimate tokens based on complexity
        const tokenEstimates = {
            trivial: { input: 100, output: 50 },
            simple: { input: 300, output: 200 },
            moderate: { input: 800, output: 600 },
            complex: { input: 2000, output: 2000 },
            very_complex: { input: 5000, output: 8000 },
        };

        const { input: baseInput, output: baseOutput } = tokenEstimates[complexity];

        // Adjust based on task description length
        const descriptionTokens = Math.ceil(taskDescription.length / 4);
        const estimatedInputTokens = baseInput + descriptionTokens;
        const estimatedOutputTokens = baseOutput;

        // Calculate costs
        const estimatedInputCost = (estimatedInputTokens / 1_000_000) * pricing.inputPricePerMillion;
        const estimatedOutputCost = (estimatedOutputTokens / 1_000_000) * pricing.outputPricePerMillion;
        const estimatedTotalCost = estimatedInputCost + estimatedOutputCost;

        // Determine confidence based on complexity
        const confidence = complexity === 'trivial' || complexity === 'simple' ? 'high' :
            complexity === 'moderate' ? 'medium' : 'low';

        return {
            modelId,
            modelName: pricing.name,
            estimatedInputTokens,
            estimatedOutputTokens,
            estimatedInputCost,
            estimatedOutputCost,
            estimatedTotalCost,
            confidence,
            breakdown: [
                { component: 'Prompt Processing', tokens: estimatedInputTokens, cost: estimatedInputCost },
                { component: 'Response Generation', tokens: estimatedOutputTokens, cost: estimatedOutputCost },
            ],
        };
    }

    /**
     * Estimate cost for a verification swarm
     */
    estimateVerificationCost(
        verificationMode: 'quick' | 'standard' | 'strict' | 'production'
    ): CostEstimate {
        // Verification uses Haiku for speed and cost efficiency
        const pricing = this.getModelPricing('anthropic/claude-3.5-haiku');

        const tokenEstimates = {
            quick: { input: 500, output: 200, agents: 2 },
            standard: { input: 1000, output: 400, agents: 4 },
            strict: { input: 2000, output: 800, agents: 6 },
            production: { input: 3000, output: 1200, agents: 6 },
        };

        const { input, output, agents } = tokenEstimates[verificationMode];
        const totalInput = input * agents;
        const totalOutput = output * agents;

        const inputCost = (totalInput / 1_000_000) * pricing.inputPricePerMillion;
        const outputCost = (totalOutput / 1_000_000) * pricing.outputPricePerMillion;

        return {
            modelId: 'anthropic/claude-3.5-haiku',
            modelName: 'Claude Haiku 3.5 (Verification)',
            estimatedInputTokens: totalInput,
            estimatedOutputTokens: totalOutput,
            estimatedInputCost: inputCost,
            estimatedOutputCost: outputCost,
            estimatedTotalCost: inputCost + outputCost,
            confidence: 'high',
            breakdown: [
                { component: `${agents} Verification Agents`, tokens: totalInput + totalOutput, cost: inputCost + outputCost },
            ],
        };
    }

    /**
     * Calculate actual cost from token usage
     */
    calculateActualCost(
        modelId: string,
        inputTokens: number,
        outputTokens: number
    ): { inputCost: number; outputCost: number; totalCost: number } {
        const pricing = this.getModelPricing(modelId);

        const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
        const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;

        return {
            inputCost,
            outputCost,
            totalCost: inputCost + outputCost,
        };
    }

    /**
     * Record usage for an agent run
     */
    async recordUsage(
        agentId: string,
        runId: string,
        modelId: string,
        inputTokens: number,
        outputTokens: number,
        durationMs: number
    ): Promise<UsageRecord> {
        const costs = this.calculateActualCost(modelId, inputTokens, outputTokens);
        const now = new Date().toISOString();

        const record: UsageRecord = {
            id: crypto.randomUUID(),
            agentId,
            runId,
            modelId,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            inputCost: costs.inputCost,
            outputCost: costs.outputCost,
            totalCost: costs.totalCost,
            durationMs,
            timestamp: now,
        };

        // Store in database - using `as any` for type flexibility
        await db.insert(developerModeCreditTransactions).values({
            sessionId: runId || 'unknown-session',  // Map runId to sessionId
            agentId: agentId || null,
            userId: this.userId,
            transactionType: 'agent_call',
            model: modelId,
            inputTokens,
            outputTokens,
            totalTokens: record.totalTokens,
            creditsCharged: Math.ceil(record.totalCost * 100),  // Convert to credits (cents)
            description: `Agent ${agentId} run`,
        } as any);

        console.log(`[CreditCalculator] Recorded usage: ${record.totalTokens} tokens, $${record.totalCost.toFixed(6)}`);

        return record;
    }

    /**
     * Get usage summary for a project
     */
    async getUsageSummary(
        startDate?: Date,
        endDate?: Date
    ): Promise<UsageSummary> {
        const conditions = [eq(developerModeCreditTransactions.userId, this.userId)];

        if (startDate) {
            conditions.push(gte(developerModeCreditTransactions.createdAt, startDate.toISOString()));
        }

        const metrics = await db.select()
            .from(developerModeCreditTransactions)
            .where(and(...conditions));

        // Aggregate metrics
        let totalTokens = 0;
        let totalCost = 0;
        const byModel: Record<string, { tokens: number; cost: number; runs: number }> = {};
        const byDay: Record<string, { tokens: number; cost: number; runs: number }> = {};

        for (const metric of metrics) {
            const tokens = metric.totalTokens || 0;
            const cost = (metric.creditsCharged || 0) / 100;  // Convert credits to dollars

            totalTokens += tokens;
            totalCost += cost;

            // By day aggregation
            const day = metric.createdAt.split('T')[0];
            if (!byDay[day]) {
                byDay[day] = { tokens: 0, cost: 0, runs: 0 };
            }
            byDay[day].tokens += tokens;
            byDay[day].cost += cost;
            byDay[day].runs += 1;
        }

        // Get model breakdown from runs
        const runs = await db.select()
            .from(developerModeAgents)
            .where(eq(developerModeAgents.projectId, this.projectId));

        for (const run of runs) {
            const model = run.model || 'unknown';
            if (!byModel[model]) {
                byModel[model] = { tokens: 0, cost: 0, runs: 0 };
            }
            byModel[model].tokens += run.tokensUsed || 0;
            byModel[model].runs += 1;
        }

        return {
            totalTokens,
            totalInputTokens: Math.floor(totalTokens * 0.4), // Rough estimate
            totalOutputTokens: Math.floor(totalTokens * 0.6),
            totalCost,
            averageCostPerRun: metrics.length > 0 ? totalCost / metrics.length : 0,
            runCount: metrics.length,
            byModel,
            byDay,
        };
    }

    /**
     * Get current credit balance for user
     * Queries the subscriptions table for user's plan and credit allocation
     */
    async getCreditBalance(): Promise<CreditBalance> {
        const summary = await this.getUsageSummary();

        // Query user's subscription for credit allocation
        const userSubs = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, this.userId))
            .limit(1);

        // Default credit allocations by plan tier
        const PLAN_CREDITS: Record<string, number> = {
            'starter': 5.0,    // Free tier: $5/month
            'pro': 25.0,       // Pro: $25/month
            'pro_plus': 80.0,  // Pro+: $80/month
            'ultra': 200.0,    // Ultra: $200/month
            'teams': 50.0,     // Teams: $50/user/month
            'free': 5.0,       // Default free tier
        };

        // Determine total credits based on subscription
        let totalCredits = PLAN_CREDITS['free']; // Default
        if (userSubs.length > 0 && userSubs[0].status === 'active') {
            const planName = userSubs[0].plan?.toLowerCase() || 'free';
            totalCredits = PLAN_CREDITS[planName] || PLAN_CREDITS['free'];
        }

        return {
            userId: this.userId,
            totalCredits,
            usedCredits: summary.totalCost,
            remainingCredits: Math.max(0, totalCredits - summary.totalCost),
            lastUpdated: new Date().toISOString(),
        };
    }

    /**
     * Check if user has sufficient credits for an estimated task
     */
    async hasSufficientCredits(estimate: CostEstimate): Promise<{
        sufficient: boolean;
        balance: CreditBalance;
        shortfall: number;
    }> {
        const balance = await this.getCreditBalance();
        const sufficient = balance.remainingCredits >= estimate.estimatedTotalCost;

        return {
            sufficient,
            balance,
            shortfall: sufficient ? 0 : estimate.estimatedTotalCost - balance.remainingCredits,
        };
    }

    /**
     * Format cost for display
     */
    static formatCost(cost: number): string {
        if (cost < 0.01) {
            return `${(cost * 100).toFixed(2)}¢`;
        }
        return `$${cost.toFixed(4)}`;
    }

    /**
     * Format tokens for display
     */
    static formatTokens(tokens: number): string {
        if (tokens < 1000) {
            return tokens.toString();
        }
        if (tokens < 1_000_000) {
            return `${(tokens / 1000).toFixed(1)}K`;
        }
        return `${(tokens / 1_000_000).toFixed(2)}M`;
    }

    /**
     * Get cost comparison across models for same task
     */
    compareCosts(
        taskDescription: string,
        complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex' = 'moderate'
    ): CostEstimate[] {
        return Object.keys(MODEL_PRICING).map(modelId =>
            this.estimateTaskCost(modelId, taskDescription, complexity)
        ).sort((a, b) => a.estimatedTotalCost - b.estimatedTotalCost);
    }
}

/**
 * Create a CreditCalculatorService instance
 */
export function createCreditCalculator(userId: string, projectId: string): CreditCalculatorService {
    return new CreditCalculatorService(userId, projectId);
}

