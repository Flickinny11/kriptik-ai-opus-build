/**
 * Speed Dial Architecture Service
 *
 * Implements 4 build modes with different speed/quality trade-offs:
 * - Lightning: 3-5 min, MVP focus, minimal verification
 * - Standard: 15-30 min, balanced quality & speed
 * - Tournament: 30-45 min, competing implementations, best wins
 * - Production: 60-120 min, full verification, enterprise-ready
 *
 * Part of Phase 8: Competitive Enhancements (Ultimate AI-First Builder Architecture)
 */

import { CLAUDE_MODELS } from './claude-service.js';

// ============================================================================
// SPEED DIAL TYPES
// ============================================================================

export type BuildMode = 'lightning' | 'standard' | 'tournament' | 'production';

export interface SpeedDialConfig {
    mode: BuildMode;
    name: string;
    description: string;

    // Time constraints
    targetMinutes: number;
    maxMinutes: number;

    // Agent configuration
    parallelAgents: number;
    enableTournament: boolean;
    tournamentCompetitors: number;

    // Verification configuration
    verificationLevel: 'minimal' | 'standard' | 'thorough' | 'enterprise';
    enableAntiSlop: boolean;
    antiSlopThreshold: number;
    enableSecurityScan: boolean;
    enableE2ETesting: boolean;

    // Checkpoint configuration
    checkpointInterval: number | null;  // minutes, null = disabled
    maxCheckpoints: number;

    // Model configuration
    planningModel: string;
    buildModel: string;
    verificationModel: string;

    // Effort parameters
    planningEffort: 'low' | 'medium' | 'high';
    buildEffort: 'low' | 'medium' | 'high';
    verificationEffort: 'low' | 'medium' | 'high';

    // Thinking budgets
    planningThinkingBudget: number;
    buildThinkingBudget: number;
    verificationThinkingBudget: number;

    // Quality gates
    minCodeQualityScore: number;
    minVisualScore: number;
    allowPlaceholders: boolean;

    // Cost estimation
    estimatedCostUSD: { min: number; max: number };
}

// ============================================================================
// SPEED DIAL PRESETS
// ============================================================================

export const SPEED_DIAL_CONFIGS: Record<BuildMode, SpeedDialConfig> = {
    lightning: {
        mode: 'lightning',
        name: 'Lightning Build',
        description: 'Fastest possible MVP. Ship something working in under 5 minutes.',

        targetMinutes: 3,
        maxMinutes: 5,

        parallelAgents: 1,
        enableTournament: false,
        tournamentCompetitors: 0,

        verificationLevel: 'minimal',
        enableAntiSlop: false,
        antiSlopThreshold: 60,
        enableSecurityScan: false,
        enableE2ETesting: false,

        checkpointInterval: null,
        maxCheckpoints: 0,

        planningModel: CLAUDE_MODELS.SONNET_4_5,
        buildModel: CLAUDE_MODELS.SONNET_4_5,
        verificationModel: CLAUDE_MODELS.HAIKU,

        planningEffort: 'low',
        buildEffort: 'medium',
        verificationEffort: 'low',

        planningThinkingBudget: 4000,
        buildThinkingBudget: 8000,
        verificationThinkingBudget: 2000,

        minCodeQualityScore: 60,
        minVisualScore: 50,
        allowPlaceholders: true,  // MVP can have some TODO comments

        estimatedCostUSD: { min: 0.50, max: 2.00 },
    },

    standard: {
        mode: 'standard',
        name: 'Standard Build',
        description: 'Balanced quality and speed. Good for most projects.',

        targetMinutes: 15,
        maxMinutes: 30,

        parallelAgents: 3,
        enableTournament: false,
        tournamentCompetitors: 0,

        verificationLevel: 'standard',
        enableAntiSlop: true,
        antiSlopThreshold: 75,
        enableSecurityScan: true,
        enableE2ETesting: false,

        checkpointInterval: 10,
        maxCheckpoints: 3,

        planningModel: CLAUDE_MODELS.OPUS_4_5,
        buildModel: CLAUDE_MODELS.SONNET_4_5,
        verificationModel: CLAUDE_MODELS.SONNET_4_5,

        planningEffort: 'medium',
        buildEffort: 'medium',
        verificationEffort: 'medium',

        planningThinkingBudget: 16000,
        buildThinkingBudget: 16000,
        verificationThinkingBudget: 8000,

        minCodeQualityScore: 75,
        minVisualScore: 70,
        allowPlaceholders: false,

        estimatedCostUSD: { min: 3.00, max: 10.00 },
    },

    tournament: {
        mode: 'tournament',
        name: 'Tournament Build',
        description: 'Multiple AI implementations compete. Best version wins via AI judge.',

        targetMinutes: 30,
        maxMinutes: 45,

        parallelAgents: 5,
        enableTournament: true,
        tournamentCompetitors: 3,  // 3 competing implementations

        verificationLevel: 'thorough',
        enableAntiSlop: true,
        antiSlopThreshold: 85,
        enableSecurityScan: true,
        enableE2ETesting: true,

        checkpointInterval: 10,
        maxCheckpoints: 5,

        planningModel: CLAUDE_MODELS.OPUS_4_5,
        buildModel: CLAUDE_MODELS.SONNET_4_5,
        verificationModel: CLAUDE_MODELS.OPUS_4_5,  // Judge needs Opus

        planningEffort: 'high',
        buildEffort: 'high',
        verificationEffort: 'high',

        planningThinkingBudget: 32000,
        buildThinkingBudget: 32000,
        verificationThinkingBudget: 32000,

        minCodeQualityScore: 85,
        minVisualScore: 85,
        allowPlaceholders: false,

        estimatedCostUSD: { min: 15.00, max: 50.00 },
    },

    production: {
        mode: 'production',
        name: 'Production Build',
        description: 'Enterprise-grade quality. Full verification, security audit, E2E tests.',

        targetMinutes: 60,
        maxMinutes: 120,

        parallelAgents: 5,
        enableTournament: true,
        tournamentCompetitors: 2,

        verificationLevel: 'enterprise',
        enableAntiSlop: true,
        antiSlopThreshold: 90,
        enableSecurityScan: true,
        enableE2ETesting: true,

        checkpointInterval: 15,
        maxCheckpoints: 10,

        planningModel: CLAUDE_MODELS.OPUS_4_5,
        buildModel: CLAUDE_MODELS.OPUS_4_5,  // Even build uses Opus
        verificationModel: CLAUDE_MODELS.OPUS_4_5,

        planningEffort: 'high',
        buildEffort: 'high',
        verificationEffort: 'high',

        planningThinkingBudget: 64000,
        buildThinkingBudget: 64000,
        verificationThinkingBudget: 64000,

        minCodeQualityScore: 90,
        minVisualScore: 90,
        allowPlaceholders: false,

        estimatedCostUSD: { min: 30.00, max: 100.00 },
    },
};

// ============================================================================
// SPEED DIAL SERVICE
// ============================================================================

export class SpeedDialService {
    private currentMode: BuildMode = 'standard';
    private customConfig?: Partial<SpeedDialConfig>;

    constructor(mode?: BuildMode) {
        if (mode) {
            this.currentMode = mode;
        }
    }

    /**
     * Get the current build mode
     */
    getMode(): BuildMode {
        return this.currentMode;
    }

    /**
     * Set the build mode
     */
    setMode(mode: BuildMode): void {
        this.currentMode = mode;
        this.customConfig = undefined;  // Reset custom config
    }

    /**
     * Get the current configuration (with any custom overrides)
     */
    getConfig(): SpeedDialConfig {
        const baseConfig = SPEED_DIAL_CONFIGS[this.currentMode];

        if (this.customConfig) {
            return { ...baseConfig, ...this.customConfig };
        }

        return baseConfig;
    }

    /**
     * Apply custom overrides to the current mode
     */
    customize(overrides: Partial<SpeedDialConfig>): void {
        this.customConfig = overrides;
    }

    /**
     * Get all available modes with their configurations
     */
    getAllModes(): SpeedDialConfig[] {
        return Object.values(SPEED_DIAL_CONFIGS);
    }

    /**
     * Get a specific mode's configuration
     */
    getModeConfig(mode: BuildMode): SpeedDialConfig {
        return SPEED_DIAL_CONFIGS[mode];
    }

    /**
     * Suggest optimal mode based on project requirements
     */
    suggestMode(requirements: {
        hasDeadline?: boolean;
        deadlineMinutes?: number;
        requiresHighQuality?: boolean;
        requiresSecurityAudit?: boolean;
        budgetUSD?: number;
        isProduction?: boolean;
    }): BuildMode {
        const { hasDeadline, deadlineMinutes, requiresHighQuality, requiresSecurityAudit, budgetUSD, isProduction } = requirements;

        // Production flag overrides everything
        if (isProduction) {
            return 'production';
        }

        // Security audit requires at least standard
        if (requiresSecurityAudit) {
            if (budgetUSD && budgetUSD >= 30) {
                return 'production';
            }
            if (budgetUSD && budgetUSD >= 15) {
                return 'tournament';
            }
            return 'standard';
        }

        // High quality requirements
        if (requiresHighQuality) {
            if (budgetUSD && budgetUSD >= 15) {
                return 'tournament';
            }
            return 'standard';
        }

        // Tight deadline
        if (hasDeadline && deadlineMinutes) {
            if (deadlineMinutes <= 5) {
                return 'lightning';
            }
            if (deadlineMinutes <= 30) {
                return 'standard';
            }
            if (deadlineMinutes <= 45) {
                return 'tournament';
            }
            return 'production';
        }

        // Budget constraints
        if (budgetUSD !== undefined) {
            if (budgetUSD < 2) {
                return 'lightning';
            }
            if (budgetUSD < 10) {
                return 'standard';
            }
            if (budgetUSD < 50) {
                return 'tournament';
            }
            return 'production';
        }

        // Default to standard
        return 'standard';
    }

    /**
     * Estimate cost for the current mode
     */
    estimateCost(): { min: number; max: number; currency: string } {
        const config = this.getConfig();
        return {
            ...config.estimatedCostUSD,
            currency: 'USD',
        };
    }

    /**
     * Estimate time for the current mode
     */
    estimateTime(): { target: number; max: number; unit: string } {
        const config = this.getConfig();
        return {
            target: config.targetMinutes,
            max: config.maxMinutes,
            unit: 'minutes',
        };
    }

    /**
     * Get model configuration for a specific phase
     */
    getPhaseModelConfig(phase: 'planning' | 'build' | 'verification'): {
        model: string;
        effort: 'low' | 'medium' | 'high';
        thinkingBudget: number;
    } {
        const config = this.getConfig();

        switch (phase) {
            case 'planning':
                return {
                    model: config.planningModel,
                    effort: config.planningEffort,
                    thinkingBudget: config.planningThinkingBudget,
                };
            case 'build':
                return {
                    model: config.buildModel,
                    effort: config.buildEffort,
                    thinkingBudget: config.buildThinkingBudget,
                };
            case 'verification':
                return {
                    model: config.verificationModel,
                    effort: config.verificationEffort,
                    thinkingBudget: config.verificationThinkingBudget,
                };
        }
    }

    /**
     * Check if a quality gate passes
     */
    passesQualityGate(scores: {
        codeQuality?: number;
        visual?: number;
        antiSlop?: number;
    }): { passes: boolean; failures: string[] } {
        const config = this.getConfig();
        const failures: string[] = [];

        if (scores.codeQuality !== undefined && scores.codeQuality < config.minCodeQualityScore) {
            failures.push(`Code quality ${scores.codeQuality} below minimum ${config.minCodeQualityScore}`);
        }

        if (scores.visual !== undefined && scores.visual < config.minVisualScore) {
            failures.push(`Visual score ${scores.visual} below minimum ${config.minVisualScore}`);
        }

        if (config.enableAntiSlop && scores.antiSlop !== undefined && scores.antiSlop < config.antiSlopThreshold) {
            failures.push(`Anti-slop score ${scores.antiSlop} below threshold ${config.antiSlopThreshold}`);
        }

        return {
            passes: failures.length === 0,
            failures,
        };
    }

    /**
     * Get checkpoint configuration
     */
    getCheckpointConfig(): {
        enabled: boolean;
        intervalMinutes: number | null;
        maxCheckpoints: number;
    } {
        const config = this.getConfig();
        return {
            enabled: config.checkpointInterval !== null,
            intervalMinutes: config.checkpointInterval,
            maxCheckpoints: config.maxCheckpoints,
        };
    }

    /**
     * Get tournament configuration
     */
    getTournamentConfig(): {
        enabled: boolean;
        competitors: number;
        judgeModel: string;
    } {
        const config = this.getConfig();
        return {
            enabled: config.enableTournament,
            competitors: config.tournamentCompetitors,
            judgeModel: config.verificationModel,  // Use verification model for judging
        };
    }

    /**
     * Get verification configuration
     */
    getVerificationConfig(): {
        level: 'minimal' | 'standard' | 'thorough' | 'enterprise';
        enableAntiSlop: boolean;
        antiSlopThreshold: number;
        enableSecurityScan: boolean;
        enableE2ETesting: boolean;
        allowPlaceholders: boolean;
    } {
        const config = this.getConfig();
        return {
            level: config.verificationLevel,
            enableAntiSlop: config.enableAntiSlop,
            antiSlopThreshold: config.antiSlopThreshold,
            enableSecurityScan: config.enableSecurityScan,
            enableE2ETesting: config.enableE2ETesting,
            allowPlaceholders: config.allowPlaceholders,
        };
    }

    /**
     * Serialize config for storage
     */
    toJSON(): {
        mode: BuildMode;
        customConfig?: Partial<SpeedDialConfig>;
    } {
        return {
            mode: this.currentMode,
            customConfig: this.customConfig,
        };
    }

    /**
     * Restore from serialized config
     */
    static fromJSON(data: {
        mode: BuildMode;
        customConfig?: Partial<SpeedDialConfig>;
    }): SpeedDialService {
        const service = new SpeedDialService(data.mode);
        if (data.customConfig) {
            service.customize(data.customConfig);
        }
        return service;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createSpeedDialService(mode?: BuildMode): SpeedDialService {
    return new SpeedDialService(mode);
}

export default SpeedDialService;

