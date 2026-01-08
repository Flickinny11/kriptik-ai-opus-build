/**
 * Intelligence Dial Service
 *
 * Provides per-request capability toggles for AI generation.
 * Users can customize AI behavior for specific needs:
 * - Thinking depth (extended thinking)
 * - Power level (model selection)
 * - Speed priority
 * - Creativity vs precision
 * - Code style preferences
 *
 * Part of Phase 8: Competitive Enhancements (Ultimate AI-First Builder Architecture)
 */

import { CLAUDE_MODELS } from './claude-service.js';

// ============================================================================
// INTELLIGENCE DIAL TYPES
// ============================================================================

export interface IntelligenceSettings {
    // Thinking Configuration
    thinkingEnabled: boolean;
    thinkingDepth: 'shallow' | 'normal' | 'deep' | 'maximum';
    thinkingBudget: number;  // Token budget for extended thinking

    // Model Power
    powerLevel: 'economy' | 'balanced' | 'performance' | 'maximum';
    forceModel?: string;  // Override model selection

    // Speed vs Quality Trade-off
    speedPriority: 'fastest' | 'fast' | 'balanced' | 'quality' | 'maximum-quality';

    // Creativity Settings
    creativityLevel: 'conservative' | 'balanced' | 'creative' | 'experimental';
    temperature: number;  // 0-1, lower = more deterministic

    // Code Style Preferences
    codeVerbosity: 'minimal' | 'standard' | 'verbose';
    commentStyle: 'none' | 'key-points' | 'detailed' | 'educational';
    errorHandling: 'minimal' | 'standard' | 'defensive' | 'paranoid';

    // UI/Design Preferences
    designDetail: 'minimal' | 'standard' | 'polished' | 'premium';
    animationLevel: 'none' | 'subtle' | 'smooth' | 'cinematic';

    // Context Preferences
    contextWindow: 'small' | 'medium' | 'large' | 'maximum';
    includeExamples: boolean;

    // Feature Toggles
    enableStreaming: boolean;
    enableToolUse: boolean;
    enableVision: boolean;
    enableStructuredOutput: boolean;
}

export interface IntelligencePreset {
    name: string;
    description: string;
    settings: IntelligenceSettings;
}

// ============================================================================
// THINKING DEPTH CONFIGURATIONS
// ============================================================================

const THINKING_CONFIGS = {
    shallow: {
        enabled: false,
        budget: 0,
        description: 'No extended thinking, fastest responses',
    },
    normal: {
        enabled: true,
        budget: 8000,
        description: 'Light thinking for better coherence',
    },
    deep: {
        enabled: true,
        budget: 32000,
        description: 'Deep analysis for complex problems',
    },
    maximum: {
        enabled: true,
        budget: 64000,
        description: 'Maximum reasoning for critical decisions',
    },
};

// ============================================================================
// POWER LEVEL CONFIGURATIONS
// ============================================================================

const POWER_CONFIGS = {
    economy: {
        model: CLAUDE_MODELS.HAIKU_3_5,
        effort: 'low' as const,
        description: 'Fastest, cheapest, good for simple tasks',
    },
    balanced: {
        model: CLAUDE_MODELS.SONNET_4_5,
        effort: 'medium' as const,
        description: 'Best balance of quality and cost',
    },
    performance: {
        model: CLAUDE_MODELS.SONNET_4_5,
        effort: 'high' as const,
        description: 'High quality with extended effort',
    },
    maximum: {
        model: CLAUDE_MODELS.OPUS_4_5,
        effort: 'high' as const,
        description: 'Maximum capability for critical tasks',
    },
};

// ============================================================================
// SPEED PRIORITY CONFIGURATIONS
// ============================================================================

const SPEED_CONFIGS = {
    fastest: {
        maxTokens: 4000,
        streaming: true,
        caching: true,
        timeout: 15000,
    },
    fast: {
        maxTokens: 8000,
        streaming: true,
        caching: true,
        timeout: 30000,
    },
    balanced: {
        maxTokens: 16000,
        streaming: true,
        caching: true,
        timeout: 60000,
    },
    quality: {
        maxTokens: 32000,
        streaming: true,
        caching: false,
        timeout: 120000,
    },
    'maximum-quality': {
        maxTokens: 64000,
        streaming: false,  // Wait for complete response
        caching: false,
        timeout: 300000,
    },
};

// ============================================================================
// INTELLIGENCE PRESETS
// ============================================================================

export const INTELLIGENCE_PRESETS: Record<string, IntelligencePreset> = {
    quick_draft: {
        name: 'Quick Draft',
        description: 'Fast, rough implementation. Good for exploring ideas.',
        settings: {
            thinkingEnabled: false,
            thinkingDepth: 'shallow',
            thinkingBudget: 0,
            powerLevel: 'economy',
            speedPriority: 'fastest',
            creativityLevel: 'balanced',
            temperature: 0.5,
            codeVerbosity: 'minimal',
            commentStyle: 'none',
            errorHandling: 'minimal',
            designDetail: 'minimal',
            animationLevel: 'none',
            contextWindow: 'small',
            includeExamples: false,
            enableStreaming: true,
            enableToolUse: false,
            enableVision: false,
            enableStructuredOutput: false,
        },
    },

    balanced_build: {
        name: 'Balanced Build',
        description: 'Good quality with reasonable speed. Default for most tasks.',
        settings: {
            thinkingEnabled: true,
            thinkingDepth: 'normal',
            thinkingBudget: 8000,
            powerLevel: 'balanced',
            speedPriority: 'balanced',
            creativityLevel: 'balanced',
            temperature: 0.3,
            codeVerbosity: 'standard',
            commentStyle: 'key-points',
            errorHandling: 'standard',
            designDetail: 'standard',
            animationLevel: 'subtle',
            contextWindow: 'medium',
            includeExamples: true,
            enableStreaming: true,
            enableToolUse: true,
            enableVision: false,
            enableStructuredOutput: true,
        },
    },

    quality_focused: {
        name: 'Quality Focused',
        description: 'High quality output with thorough thinking. Worth the wait.',
        settings: {
            thinkingEnabled: true,
            thinkingDepth: 'deep',
            thinkingBudget: 32000,
            powerLevel: 'performance',
            speedPriority: 'quality',
            creativityLevel: 'balanced',
            temperature: 0.2,
            codeVerbosity: 'standard',
            commentStyle: 'detailed',
            errorHandling: 'defensive',
            designDetail: 'polished',
            animationLevel: 'smooth',
            contextWindow: 'large',
            includeExamples: true,
            enableStreaming: true,
            enableToolUse: true,
            enableVision: true,
            enableStructuredOutput: true,
        },
    },

    production_grade: {
        name: 'Production Grade',
        description: 'Enterprise quality. Maximum thinking, maximum quality.',
        settings: {
            thinkingEnabled: true,
            thinkingDepth: 'maximum',
            thinkingBudget: 64000,
            powerLevel: 'maximum',
            speedPriority: 'maximum-quality',
            creativityLevel: 'conservative',
            temperature: 0.1,
            codeVerbosity: 'verbose',
            commentStyle: 'educational',
            errorHandling: 'paranoid',
            designDetail: 'premium',
            animationLevel: 'cinematic',
            contextWindow: 'maximum',
            includeExamples: true,
            enableStreaming: false,
            enableToolUse: true,
            enableVision: true,
            enableStructuredOutput: true,
        },
    },

    creative_mode: {
        name: 'Creative Mode',
        description: 'Experimental, novel approaches. Good for design and UX.',
        settings: {
            thinkingEnabled: true,
            thinkingDepth: 'deep',
            thinkingBudget: 32000,
            powerLevel: 'performance',
            speedPriority: 'balanced',
            creativityLevel: 'experimental',
            temperature: 0.7,
            codeVerbosity: 'standard',
            commentStyle: 'key-points',
            errorHandling: 'standard',
            designDetail: 'premium',
            animationLevel: 'cinematic',
            contextWindow: 'large',
            includeExamples: true,
            enableStreaming: true,
            enableToolUse: true,
            enableVision: true,
            enableStructuredOutput: false,
        },
    },

    debugging: {
        name: 'Debugging Mode',
        description: 'Maximum analysis for finding and fixing bugs.',
        settings: {
            thinkingEnabled: true,
            thinkingDepth: 'maximum',
            thinkingBudget: 64000,
            powerLevel: 'maximum',
            speedPriority: 'quality',
            creativityLevel: 'conservative',
            temperature: 0.0,
            codeVerbosity: 'verbose',
            commentStyle: 'educational',
            errorHandling: 'paranoid',
            designDetail: 'standard',
            animationLevel: 'none',
            contextWindow: 'maximum',
            includeExamples: true,
            enableStreaming: false,
            enableToolUse: true,
            enableVision: true,
            enableStructuredOutput: true,
        },
    },

    // =========================================================================
    // HYPER-THINKING PRESETS (Advanced Multi-Model Reasoning)
    // =========================================================================

    hyper_reasoning: {
        name: 'Hyper-Thinking Maximum',
        description: 'Maximum reasoning with ToT + multi-agent swarm. 128K thinking budget.',
        settings: {
            thinkingEnabled: true,
            thinkingDepth: 'maximum',
            thinkingBudget: 128000, // Maximum budget for hyper-thinking
            powerLevel: 'maximum',
            speedPriority: 'maximum-quality',
            creativityLevel: 'balanced',
            temperature: 0.1,
            codeVerbosity: 'verbose',
            commentStyle: 'educational',
            errorHandling: 'paranoid',
            designDetail: 'premium',
            animationLevel: 'smooth',
            contextWindow: 'maximum',
            includeExamples: true,
            enableStreaming: false, // Wait for complete multi-agent synthesis
            enableToolUse: true,
            enableVision: true,
            enableStructuredOutput: true,
        },
    },

    deep_analysis: {
        name: 'Deep Analysis',
        description: 'Tree-of-Thought with maximum depth. 64K thinking budget.',
        settings: {
            thinkingEnabled: true,
            thinkingDepth: 'maximum',
            thinkingBudget: 64000, // Deep ToT budget
            powerLevel: 'performance',
            speedPriority: 'quality',
            creativityLevel: 'balanced',
            temperature: 0.2,
            codeVerbosity: 'standard',
            commentStyle: 'detailed',
            errorHandling: 'defensive',
            designDetail: 'polished',
            animationLevel: 'subtle',
            contextWindow: 'large',
            includeExamples: true,
            enableStreaming: true,
            enableToolUse: true,
            enableVision: true,
            enableStructuredOutput: true,
        },
    },

    consensus_building: {
        name: 'Consensus Building',
        description: 'Multi-agent reasoning with debate. 48K thinking budget.',
        settings: {
            thinkingEnabled: true,
            thinkingDepth: 'deep',
            thinkingBudget: 48000, // Multi-agent debate budget
            powerLevel: 'performance',
            speedPriority: 'balanced',
            creativityLevel: 'creative', // Allow diverse perspectives
            temperature: 0.4,
            codeVerbosity: 'standard',
            commentStyle: 'detailed',
            errorHandling: 'defensive',
            designDetail: 'polished',
            animationLevel: 'smooth',
            contextWindow: 'large',
            includeExamples: true,
            enableStreaming: true,
            enableToolUse: true,
            enableVision: true,
            enableStructuredOutput: true,
        },
    },

    rapid_reasoning: {
        name: 'Rapid Reasoning',
        description: 'Fast chain-of-thought with Gemini 3 Flash. 16K thinking budget.',
        settings: {
            thinkingEnabled: true,
            thinkingDepth: 'normal',
            thinkingBudget: 16000, // Fast reasoning budget
            powerLevel: 'balanced',
            speedPriority: 'fast',
            creativityLevel: 'balanced',
            temperature: 0.3,
            codeVerbosity: 'standard',
            commentStyle: 'key-points',
            errorHandling: 'standard',
            designDetail: 'standard',
            animationLevel: 'subtle',
            contextWindow: 'medium',
            includeExamples: false,
            enableStreaming: true,
            enableToolUse: true,
            enableVision: false,
            enableStructuredOutput: true,
        },
    },
};

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_SETTINGS: IntelligenceSettings = INTELLIGENCE_PRESETS.balanced_build.settings;

// ============================================================================
// INTELLIGENCE DIAL SERVICE
// ============================================================================

export class IntelligenceDial {
    private settings: IntelligenceSettings;

    constructor(initialSettings?: Partial<IntelligenceSettings>) {
        this.settings = { ...DEFAULT_SETTINGS, ...initialSettings };
    }

    /**
     * Get current settings
     */
    getSettings(): IntelligenceSettings {
        return { ...this.settings };
    }

    /**
     * Update settings
     */
    updateSettings(updates: Partial<IntelligenceSettings>): void {
        this.settings = { ...this.settings, ...updates };
    }

    /**
     * Apply a preset
     */
    applyPreset(presetName: string): boolean {
        const preset = INTELLIGENCE_PRESETS[presetName];
        if (!preset) return false;

        this.settings = { ...preset.settings };
        return true;
    }

    /**
     * Get all available presets
     */
    getPresets(): IntelligencePreset[] {
        return Object.values(INTELLIGENCE_PRESETS);
    }

    /**
     * Set thinking depth
     */
    setThinkingDepth(depth: 'shallow' | 'normal' | 'deep' | 'maximum'): void {
        const config = THINKING_CONFIGS[depth];
        this.settings.thinkingEnabled = config.enabled;
        this.settings.thinkingDepth = depth;
        this.settings.thinkingBudget = config.budget;
    }

    /**
     * Set power level
     */
    setPowerLevel(level: 'economy' | 'balanced' | 'performance' | 'maximum'): void {
        this.settings.powerLevel = level;
    }

    /**
     * Set speed priority
     */
    setSpeedPriority(priority: 'fastest' | 'fast' | 'balanced' | 'quality' | 'maximum-quality'): void {
        this.settings.speedPriority = priority;
    }

    /**
     * Set creativity level
     */
    setCreativityLevel(level: 'conservative' | 'balanced' | 'creative' | 'experimental'): void {
        this.settings.creativityLevel = level;

        // Auto-adjust temperature based on creativity
        const temps = {
            conservative: 0.1,
            balanced: 0.3,
            creative: 0.6,
            experimental: 0.8,
        };
        this.settings.temperature = temps[level];
    }

    /**
     * Get resolved model configuration
     */
    getModelConfig(): {
        model: string;
        effort: 'low' | 'medium' | 'high';
        thinkingEnabled: boolean;
        thinkingBudget: number;
        temperature: number;
    } {
        const powerConfig = POWER_CONFIGS[this.settings.powerLevel];

        return {
            model: this.settings.forceModel || powerConfig.model,
            effort: powerConfig.effort,
            thinkingEnabled: this.settings.thinkingEnabled,
            thinkingBudget: this.settings.thinkingBudget,
            temperature: this.settings.temperature,
        };
    }

    /**
     * Get resolved generation configuration
     */
    getGenerationConfig(): {
        maxTokens: number;
        streaming: boolean;
        timeout: number;
        enableToolUse: boolean;
        enableVision: boolean;
        enableStructuredOutput: boolean;
    } {
        const speedConfig = SPEED_CONFIGS[this.settings.speedPriority];

        return {
            maxTokens: speedConfig.maxTokens,
            streaming: this.settings.enableStreaming && speedConfig.streaming,
            timeout: speedConfig.timeout,
            enableToolUse: this.settings.enableToolUse,
            enableVision: this.settings.enableVision,
            enableStructuredOutput: this.settings.enableStructuredOutput,
        };
    }

    /**
     * Get code generation preferences
     */
    getCodePreferences(): {
        verbosity: 'minimal' | 'standard' | 'verbose';
        commentStyle: 'none' | 'key-points' | 'detailed' | 'educational';
        errorHandling: 'minimal' | 'standard' | 'defensive' | 'paranoid';
    } {
        return {
            verbosity: this.settings.codeVerbosity,
            commentStyle: this.settings.commentStyle,
            errorHandling: this.settings.errorHandling,
        };
    }

    /**
     * Get design preferences
     */
    getDesignPreferences(): {
        detailLevel: 'minimal' | 'standard' | 'polished' | 'premium';
        animationLevel: 'none' | 'subtle' | 'smooth' | 'cinematic';
    } {
        return {
            detailLevel: this.settings.designDetail,
            animationLevel: this.settings.animationLevel,
        };
    }

    /**
     * Build system prompt additions based on current settings
     */
    buildPromptAdditions(): string {
        const additions: string[] = [];

        // Code style preferences
        if (this.settings.codeVerbosity === 'minimal') {
            additions.push('Write concise, minimal code. Avoid verbose patterns.');
        } else if (this.settings.codeVerbosity === 'verbose') {
            additions.push('Write detailed, explicit code with clear variable names.');
        }

        // Comment style
        if (this.settings.commentStyle === 'none') {
            additions.push('Do not include code comments.');
        } else if (this.settings.commentStyle === 'educational') {
            additions.push('Include detailed comments explaining the why behind decisions.');
        }

        // Error handling
        if (this.settings.errorHandling === 'paranoid') {
            additions.push('Implement comprehensive error handling for all edge cases.');
        } else if (this.settings.errorHandling === 'minimal') {
            additions.push('Use minimal error handling, assume happy path.');
        }

        // Design detail
        if (this.settings.designDetail === 'premium') {
            additions.push('Create premium, polished UI with attention to micro-details.');
        } else if (this.settings.designDetail === 'minimal') {
            additions.push('Focus on functionality over visual polish.');
        }

        // Animation
        if (this.settings.animationLevel === 'cinematic') {
            additions.push('Include rich, smooth animations and transitions.');
        } else if (this.settings.animationLevel === 'none') {
            additions.push('Do not include any animations or transitions.');
        }

        // Creativity
        if (this.settings.creativityLevel === 'experimental') {
            additions.push('Feel free to try novel, creative approaches.');
        } else if (this.settings.creativityLevel === 'conservative') {
            additions.push('Use proven, conventional patterns only.');
        }

        return additions.length > 0
            ? `\n\n## Intelligence Settings:\n${additions.map(a => `- ${a}`).join('\n')}`
            : '';
    }

    /**
     * Estimate cost for current settings
     */
    estimateCostMultiplier(): number {
        let multiplier = 1;

        // Power level affects cost
        const powerMultipliers = {
            economy: 0.3,
            balanced: 1,
            performance: 2,
            maximum: 5,
        };
        multiplier *= powerMultipliers[this.settings.powerLevel];

        // Thinking depth affects cost
        if (this.settings.thinkingEnabled) {
            const thinkingMultipliers = {
                shallow: 0,
                normal: 1.2,
                deep: 1.5,
                maximum: 2,
            };
            multiplier *= thinkingMultipliers[this.settings.thinkingDepth];
        }

        // Speed priority affects cost (slower = more processing)
        const speedMultipliers = {
            fastest: 0.7,
            fast: 0.9,
            balanced: 1,
            quality: 1.5,
            'maximum-quality': 2.5,
        };
        multiplier *= speedMultipliers[this.settings.speedPriority];

        return multiplier;
    }

    /**
     * Serialize for storage
     */
    toJSON(): IntelligenceSettings {
        return this.settings;
    }

    /**
     * Create from serialized settings
     */
    static fromJSON(settings: IntelligenceSettings): IntelligenceDial {
        return new IntelligenceDial(settings);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createIntelligenceDial(settings?: Partial<IntelligenceSettings>): IntelligenceDial {
    return new IntelligenceDial(settings);
}

export function getPreset(name: string): IntelligencePreset | undefined {
    return INTELLIGENCE_PRESETS[name];
}

export function getAllPresets(): IntelligencePreset[] {
    return Object.values(INTELLIGENCE_PRESETS);
}

export default IntelligenceDial;

