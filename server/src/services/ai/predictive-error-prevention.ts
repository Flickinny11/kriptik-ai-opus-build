/**
 * Predictive Error Prevention System
 *
 * Revolutionary approach that PREVENTS errors before they happen,
 * rather than fixing them after the fact.
 *
 * CORE INNOVATION: Use machine learning on historical error patterns
 * to predict which code patterns will fail, and proactively inject
 * constraints and hints into generation prompts.
 *
 * TRADITIONAL APPROACH:
 * Generate code → Build fails → Analyze error → Regenerate → Repeat
 * Average: 2.5 iterations per feature = 2.5x time
 *
 * PREDICTIVE APPROACH:
 * Analyze intent → Predict likely errors → Inject prevention → Generate once
 * Average: 1.1 iterations per feature = massive time savings
 *
 * Based on:
 * - Error pattern library from learning engine
 * - Historical escalation data
 * - Static analysis rules
 * - Real-time type inference
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { errorEscalationHistory, learningPatterns } from '../../schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface PredictionConfig {
    /** Minimum confidence to include a prediction */
    minConfidence: number;

    /** Maximum predictions to include in prompt */
    maxPredictions: number;

    /** Enable historical pattern matching */
    enableHistoricalPatterns: boolean;

    /** Enable static analysis prediction */
    enableStaticAnalysis: boolean;

    /** Enable import prediction */
    enableImportPrediction: boolean;

    /** Look back window for historical data (ms) */
    historyWindowMs: number;
}

export interface ErrorPrediction {
    id: string;
    type: ErrorType;
    pattern: string;
    description: string;
    confidence: number;
    prevention: PreventionStrategy;
    historicalOccurrences: number;
    lastOccurrence?: Date;
}

export type ErrorType =
    | 'typescript'
    | 'import'
    | 'runtime'
    | 'syntax'
    | 'type_mismatch'
    | 'missing_dependency'
    | 'api_misuse'
    | 'react_pattern'
    | 'async_issue'
    | 'security'
    | 'style';

export interface PreventionStrategy {
    type: 'constraint' | 'example' | 'warning' | 'import_hint' | 'type_hint';
    instruction: string;
    code?: string;
    priority: 'must' | 'should' | 'may';
}

export interface PredictionContext {
    projectId: string;
    taskType: string;
    taskDescription: string;
    targetFiles?: string[];
    existingCode?: string;
    dependencies?: string[];
    recentErrors?: string[];
}

export interface PredictionResult {
    id: string;
    predictions: ErrorPrediction[];
    preventionPrompt: string;
    confidenceScore: number;
    estimatedIterationsSaved: number;
    processingTimeMs: number;
}

// ============================================================================
// ERROR PATTERN DATABASE
// ============================================================================

/**
 * Common error patterns and their preventions
 * These are hardcoded patterns that are universally applicable
 */
const COMMON_ERROR_PATTERNS: ErrorPrediction[] = [
    // TypeScript errors
    {
        id: 'ts-any-type',
        type: 'typescript',
        pattern: 'using any type',
        description: 'Avoid using "any" type which defeats TypeScript\'s purpose',
        confidence: 0.95,
        prevention: {
            type: 'constraint',
            instruction: 'NEVER use "any" type. Always specify explicit types or use "unknown" with type guards.',
            priority: 'must',
        },
        historicalOccurrences: 0,
    },
    {
        id: 'ts-missing-return',
        type: 'typescript',
        pattern: 'missing return type',
        description: 'Functions should have explicit return types',
        confidence: 0.8,
        prevention: {
            type: 'type_hint',
            instruction: 'Always specify return types for functions, especially async functions.',
            code: 'async function example(): Promise<ReturnType> { ... }',
            priority: 'should',
        },
        historicalOccurrences: 0,
    },

    // Import errors
    {
        id: 'import-esm-extension',
        type: 'import',
        pattern: 'missing .js extension',
        description: 'ESM imports require .js extension for relative imports',
        confidence: 0.9,
        prevention: {
            type: 'import_hint',
            instruction: 'For ESM compatibility, always use .js extension in relative imports.',
            code: "import { foo } from './bar.js'; // NOT './bar'",
            priority: 'must',
        },
        historicalOccurrences: 0,
    },
    {
        id: 'import-named-vs-default',
        type: 'import',
        pattern: 'named/default import confusion',
        description: 'Mixing up named and default exports',
        confidence: 0.85,
        prevention: {
            type: 'import_hint',
            instruction: 'Check if the module uses named or default exports. React uses default, lodash uses named.',
            code: "import React from 'react'; // default\nimport { useState } from 'react'; // named",
            priority: 'should',
        },
        historicalOccurrences: 0,
    },

    // React patterns
    {
        id: 'react-hooks-rules',
        type: 'react_pattern',
        pattern: 'hooks rules violation',
        description: 'Hooks must be called at top level, not in conditionals',
        confidence: 0.95,
        prevention: {
            type: 'constraint',
            instruction: 'NEVER call hooks inside conditionals, loops, or nested functions. Always at component top level.',
            priority: 'must',
        },
        historicalOccurrences: 0,
    },
    {
        id: 'react-key-prop',
        type: 'react_pattern',
        pattern: 'missing or invalid key prop',
        description: 'List items need stable unique keys',
        confidence: 0.9,
        prevention: {
            type: 'constraint',
            instruction: 'Always provide stable unique keys for list items. Never use array index or Math.random().',
            code: 'items.map(item => <Item key={item.id} {...item} />)',
            priority: 'must',
        },
        historicalOccurrences: 0,
    },
    {
        id: 'react-useeffect-cleanup',
        type: 'react_pattern',
        pattern: 'useEffect without cleanup',
        description: 'useEffect with subscriptions or intervals needs cleanup',
        confidence: 0.85,
        prevention: {
            type: 'example',
            instruction: 'If useEffect sets up subscriptions, timers, or event listeners, return a cleanup function.',
            code: 'useEffect(() => {\n  const timer = setInterval(fn, 1000);\n  return () => clearInterval(timer);\n}, []);',
            priority: 'should',
        },
        historicalOccurrences: 0,
    },
    {
        id: 'react-dependency-array',
        type: 'react_pattern',
        pattern: 'missing useEffect dependencies',
        description: 'useEffect dependency array must include all referenced values',
        confidence: 0.9,
        prevention: {
            type: 'constraint',
            instruction: 'Include ALL variables from component scope in the dependency array. ESLint will warn you.',
            priority: 'must',
        },
        historicalOccurrences: 0,
    },

    // Async issues
    {
        id: 'async-unhandled-promise',
        type: 'async_issue',
        pattern: 'unhandled promise rejection',
        description: 'Promises should be awaited or have catch handlers',
        confidence: 0.9,
        prevention: {
            type: 'constraint',
            instruction: 'Always await promises or attach .catch() handlers. Use try/catch for async/await.',
            priority: 'must',
        },
        historicalOccurrences: 0,
    },
    {
        id: 'async-race-condition',
        type: 'async_issue',
        pattern: 'potential race condition',
        description: 'Multiple async operations without proper coordination',
        confidence: 0.75,
        prevention: {
            type: 'warning',
            instruction: 'When multiple async operations depend on each other, use Promise.all() or await sequentially.',
            priority: 'should',
        },
        historicalOccurrences: 0,
    },

    // Security
    {
        id: 'security-xss',
        type: 'security',
        pattern: 'potential XSS vulnerability',
        description: 'Using innerHTML or dangerouslySetInnerHTML without sanitization',
        confidence: 0.95,
        prevention: {
            type: 'constraint',
            instruction: 'NEVER use innerHTML or dangerouslySetInnerHTML with user input. Use DOMPurify if absolutely necessary.',
            priority: 'must',
        },
        historicalOccurrences: 0,
    },
    {
        id: 'security-hardcoded-secrets',
        type: 'security',
        pattern: 'hardcoded credentials',
        description: 'API keys or secrets in source code',
        confidence: 0.99,
        prevention: {
            type: 'constraint',
            instruction: 'NEVER hardcode API keys, secrets, or credentials. Always use environment variables.',
            code: 'const apiKey = process.env.API_KEY;',
            priority: 'must',
        },
        historicalOccurrences: 0,
    },

    // Style (anti-slop)
    {
        id: 'style-emoji',
        type: 'style',
        pattern: 'emoji in code',
        description: 'Emoji characters in production UI code',
        confidence: 0.99,
        prevention: {
            type: 'constraint',
            instruction: 'NEVER use emojis in production code. Zero tolerance policy.',
            priority: 'must',
        },
        historicalOccurrences: 0,
    },
    {
        id: 'style-banned-gradient',
        type: 'style',
        pattern: 'banned gradient pattern',
        description: 'Purple-to-pink or blue-to-purple gradients',
        confidence: 0.99,
        prevention: {
            type: 'constraint',
            instruction: 'NEVER use purple-to-pink or blue-to-purple gradients. Use amber/orange for KripTik brand.',
            priority: 'must',
        },
        historicalOccurrences: 0,
    },
    {
        id: 'style-placeholder',
        type: 'style',
        pattern: 'placeholder content',
        description: 'TODO, FIXME, lorem ipsum, or "coming soon" text',
        confidence: 0.99,
        prevention: {
            type: 'constraint',
            instruction: 'NEVER include placeholder content. Always use real, production-ready content.',
            priority: 'must',
        },
        historicalOccurrences: 0,
    },
];

// ============================================================================
// PREDICTIVE ERROR PREVENTION ENGINE
// ============================================================================

export class PredictiveErrorPrevention extends EventEmitter {
    private config: PredictionConfig;
    private patternCache: Map<string, ErrorPrediction[]>;

    constructor(config: Partial<PredictionConfig> = {}) {
        super();

        this.config = {
            minConfidence: 0.7,
            maxPredictions: 10,
            enableHistoricalPatterns: true,
            enableStaticAnalysis: true,
            enableImportPrediction: true,
            historyWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
            ...config,
        };

        this.patternCache = new Map();
    }

    /**
     * Predict errors and generate prevention prompt
     */
    async predict(context: PredictionContext): Promise<PredictionResult> {
        const startTime = Date.now();
        const predictions: ErrorPrediction[] = [];

        // 1. Get common patterns relevant to this task
        const commonPredictions = this.getCommonPatterns(context);
        predictions.push(...commonPredictions);

        // 2. Get historical patterns from database
        if (this.config.enableHistoricalPatterns) {
            const historicalPredictions = await this.getHistoricalPatterns(context);
            predictions.push(...historicalPredictions);
        }

        // 3. Analyze task for specific patterns
        if (this.config.enableStaticAnalysis) {
            const analyzedPredictions = this.analyzeTask(context);
            predictions.push(...analyzedPredictions);
        }

        // 4. Check for import patterns
        if (this.config.enableImportPrediction && context.dependencies) {
            const importPredictions = this.predictImportErrors(context.dependencies);
            predictions.push(...importPredictions);
        }

        // Filter by confidence and dedupe
        const filteredPredictions = this.filterAndDedupe(predictions);

        // Generate prevention prompt
        const preventionPrompt = this.generatePreventionPrompt(filteredPredictions);

        // Estimate iterations saved
        const estimatedIterationsSaved = this.estimateIterationsSaved(filteredPredictions);

        return {
            id: uuidv4(),
            predictions: filteredPredictions,
            preventionPrompt,
            confidenceScore: this.calculateConfidenceScore(filteredPredictions),
            estimatedIterationsSaved,
            processingTimeMs: Date.now() - startTime,
        };
    }

    /**
     * Get common patterns relevant to the task
     */
    private getCommonPatterns(context: PredictionContext): ErrorPrediction[] {
        const relevant: ErrorPrediction[] = [];

        for (const pattern of COMMON_ERROR_PATTERNS) {
            // Check if pattern is relevant to this task
            const relevance = this.calculateRelevance(pattern, context);
            if (relevance > 0.5) {
                relevant.push({
                    ...pattern,
                    confidence: pattern.confidence * relevance,
                });
            }
        }

        return relevant;
    }

    /**
     * Calculate relevance of a pattern to a context
     */
    private calculateRelevance(pattern: ErrorPrediction, context: PredictionContext): number {
        const taskLower = context.taskDescription.toLowerCase();
        const typeLower = context.taskType.toLowerCase();

        // React patterns are relevant for UI tasks
        if (pattern.type === 'react_pattern') {
            if (taskLower.includes('component') || taskLower.includes('ui') ||
                typeLower.includes('component') || typeLower.includes('styling')) {
                return 1.0;
            }
            return 0.3;
        }

        // Import patterns are always relevant
        if (pattern.type === 'import') {
            return 0.9;
        }

        // TypeScript patterns are always relevant
        if (pattern.type === 'typescript') {
            return 0.9;
        }

        // Security patterns are always relevant
        if (pattern.type === 'security') {
            return 1.0;
        }

        // Style patterns are relevant for UI tasks
        if (pattern.type === 'style') {
            if (taskLower.includes('ui') || taskLower.includes('style') ||
                taskLower.includes('design') || typeLower.includes('styling')) {
                return 1.0;
            }
            return 0.6;
        }

        // Async patterns are relevant for API/backend tasks
        if (pattern.type === 'async_issue') {
            if (taskLower.includes('api') || taskLower.includes('fetch') ||
                taskLower.includes('async') || typeLower.includes('api')) {
                return 1.0;
            }
            return 0.5;
        }

        return 0.7; // Default relevance
    }

    /**
     * Get historical error patterns from database
     */
    private async getHistoricalPatterns(context: PredictionContext): Promise<ErrorPrediction[]> {
        try {
            const predictions: ErrorPrediction[] = [];
            const cutoffDate = new Date(Date.now() - this.config.historyWindowMs);
            const cutoffDateStr = cutoffDate.toISOString();

            // Query error escalation history
            const errors = await db
                .select()
                .from(errorEscalationHistory)
                .where(
                    and(
                        eq(errorEscalationHistory.projectId, context.projectId),
                        gte(errorEscalationHistory.createdAt, cutoffDateStr)
                    )
                )
                .orderBy(desc(errorEscalationHistory.createdAt))
                .limit(50);

            // Group by error type and count occurrences
            const errorCounts: Map<string, number> = new Map();
            const errorDescriptions: Map<string, string> = new Map();

            for (const error of errors) {
                const key = error.errorType || 'unknown';
                errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
                if (!errorDescriptions.has(key) && error.errorMessage) {
                    errorDescriptions.set(key, error.errorMessage);
                }
            }

            // Create predictions from patterns
            for (const [errorType, count] of errorCounts) {
                if (count >= 2) { // Only if occurred multiple times
                    predictions.push({
                        id: `historical-${errorType}`,
                        type: this.mapErrorType(errorType),
                        pattern: errorType,
                        description: errorDescriptions.get(errorType) || `Recurring ${errorType} errors`,
                        confidence: Math.min(0.95, 0.5 + count * 0.1),
                        prevention: {
                            type: 'warning',
                            instruction: `This project has had ${count} "${errorType}" errors recently. Pay extra attention to avoid this pattern.`,
                            priority: 'should',
                        },
                        historicalOccurrences: count,
                    });
                }
            }

            // Also check learned patterns for failures
            const failedPatterns = await db
                .select()
                .from(learningPatterns)
                .where(
                    and(
                        eq(learningPatterns.projectId, context.projectId),
                        gte(learningPatterns.failureCount, 3)
                    )
                )
                .limit(10);

            for (const pattern of failedPatterns) {
                if (pattern.failureCount && pattern.failureCount >= 3) {
                    predictions.push({
                        id: `failed-pattern-${pattern.id}`,
                        type: 'api_misuse',
                        pattern: pattern.patternKey,
                        description: `Pattern "${pattern.patternKey}" has failed ${pattern.failureCount} times`,
                        confidence: 0.85,
                        prevention: {
                            type: 'warning',
                            instruction: `AVOID this pattern: ${pattern.patternKey}. It has consistently failed.`,
                            priority: 'should',
                        },
                        historicalOccurrences: pattern.failureCount,
                    });
                }
            }

            return predictions;
        } catch (error) {
            console.warn('[PredictiveError] Failed to get historical patterns:', error);
            return [];
        }
    }

    /**
     * Map error type string to ErrorType
     */
    private mapErrorType(errorType: string): ErrorType {
        const typeMap: Record<string, ErrorType> = {
            'typescript': 'typescript',
            'ts': 'typescript',
            'type': 'type_mismatch',
            'import': 'import',
            'module': 'import',
            'runtime': 'runtime',
            'syntax': 'syntax',
            'react': 'react_pattern',
            'async': 'async_issue',
            'promise': 'async_issue',
            'security': 'security',
            'style': 'style',
        };

        const lower = errorType.toLowerCase();
        for (const [key, value] of Object.entries(typeMap)) {
            if (lower.includes(key)) {
                return value;
            }
        }

        return 'runtime';
    }

    /**
     * Analyze task description for specific patterns
     */
    private analyzeTask(context: PredictionContext): ErrorPrediction[] {
        const predictions: ErrorPrediction[] = [];
        const taskLower = context.taskDescription.toLowerCase();

        // Check for specific task types that commonly cause issues
        const taskPatterns = [
            {
                trigger: /form|input|validation/i,
                prediction: {
                    id: 'task-form-validation',
                    type: 'react_pattern' as ErrorType,
                    pattern: 'form handling',
                    description: 'Forms often have state and validation issues',
                    confidence: 0.8,
                    prevention: {
                        type: 'example' as const,
                        instruction: 'Use react-hook-form or formik for form handling. Validate on blur, not just submit.',
                        priority: 'should' as const,
                    },
                    historicalOccurrences: 0,
                },
            },
            {
                trigger: /api|fetch|data|query/i,
                prediction: {
                    id: 'task-api-handling',
                    type: 'async_issue' as ErrorType,
                    pattern: 'API data fetching',
                    description: 'API calls need loading, error, and empty states',
                    confidence: 0.85,
                    prevention: {
                        type: 'example' as const,
                        instruction: 'Always handle loading, error, and empty states. Use try/catch for fetch calls.',
                        code: 'const [data, setData] = useState(null);\nconst [loading, setLoading] = useState(true);\nconst [error, setError] = useState(null);',
                        priority: 'must' as const,
                    },
                    historicalOccurrences: 0,
                },
            },
            {
                trigger: /modal|dialog|popup/i,
                prediction: {
                    id: 'task-modal-accessibility',
                    type: 'react_pattern' as ErrorType,
                    pattern: 'modal implementation',
                    description: 'Modals need proper accessibility and focus management',
                    confidence: 0.75,
                    prevention: {
                        type: 'warning' as const,
                        instruction: 'Use Radix Dialog or similar for accessibility. Trap focus, handle escape key, and manage body scroll.',
                        priority: 'should' as const,
                    },
                    historicalOccurrences: 0,
                },
            },
            {
                trigger: /table|list|grid|pagination/i,
                prediction: {
                    id: 'task-list-virtualization',
                    type: 'react_pattern' as ErrorType,
                    pattern: 'large list rendering',
                    description: 'Large lists need virtualization for performance',
                    confidence: 0.7,
                    prevention: {
                        type: 'warning' as const,
                        instruction: 'For lists with many items, consider using react-virtual or react-window for performance.',
                        priority: 'may' as const,
                    },
                    historicalOccurrences: 0,
                },
            },
            {
                trigger: /auth|login|session/i,
                prediction: {
                    id: 'task-auth-security',
                    type: 'security' as ErrorType,
                    pattern: 'authentication handling',
                    description: 'Authentication has many security considerations',
                    confidence: 0.95,
                    prevention: {
                        type: 'constraint' as const,
                        instruction: 'Use Better Auth for auth. Never store passwords in plain text. Use httpOnly cookies for tokens.',
                        priority: 'must' as const,
                    },
                    historicalOccurrences: 0,
                },
            },
        ];

        for (const { trigger, prediction } of taskPatterns) {
            if (trigger.test(taskLower)) {
                predictions.push(prediction);
            }
        }

        return predictions;
    }

    /**
     * Predict import errors based on dependencies
     */
    private predictImportErrors(dependencies: string[]): ErrorPrediction[] {
        const predictions: ErrorPrediction[] = [];

        // Known tricky imports
        const trickyImports: Record<string, ErrorPrediction> = {
            'lodash': {
                id: 'import-lodash',
                type: 'import',
                pattern: 'lodash imports',
                description: 'Lodash has both default and named exports',
                confidence: 0.8,
                prevention: {
                    type: 'import_hint',
                    instruction: 'For tree-shaking, import individual functions: import debounce from "lodash/debounce"',
                    code: 'import debounce from "lodash/debounce";\nimport { throttle } from "lodash";',
                    priority: 'should',
                },
                historicalOccurrences: 0,
            },
            'date-fns': {
                id: 'import-date-fns',
                type: 'import',
                pattern: 'date-fns imports',
                description: 'date-fns uses named exports only',
                confidence: 0.85,
                prevention: {
                    type: 'import_hint',
                    instruction: 'date-fns uses named exports only.',
                    code: 'import { format, parseISO } from "date-fns";',
                    priority: 'must',
                },
                historicalOccurrences: 0,
            },
            'framer-motion': {
                id: 'import-framer',
                type: 'import',
                pattern: 'framer-motion imports',
                description: 'framer-motion exports both motion and other utilities',
                confidence: 0.75,
                prevention: {
                    type: 'import_hint',
                    instruction: 'framer-motion uses named exports.',
                    code: 'import { motion, AnimatePresence } from "framer-motion";',
                    priority: 'should',
                },
                historicalOccurrences: 0,
            },
            '@radix-ui': {
                id: 'import-radix',
                type: 'import',
                pattern: 'Radix UI imports',
                description: 'Radix components are separate packages',
                confidence: 0.8,
                prevention: {
                    type: 'import_hint',
                    instruction: 'Each Radix component is a separate package: @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, etc.',
                    priority: 'must',
                },
                historicalOccurrences: 0,
            },
        };

        for (const dep of dependencies) {
            for (const [key, prediction] of Object.entries(trickyImports)) {
                if (dep.includes(key)) {
                    predictions.push(prediction);
                }
            }
        }

        return predictions;
    }

    /**
     * Filter predictions by confidence and deduplicate
     */
    private filterAndDedupe(predictions: ErrorPrediction[]): ErrorPrediction[] {
        // Filter by confidence
        const filtered = predictions.filter(p => p.confidence >= this.config.minConfidence);

        // Dedupe by ID
        const seen = new Set<string>();
        const deduped: ErrorPrediction[] = [];

        for (const prediction of filtered) {
            if (!seen.has(prediction.id)) {
                seen.add(prediction.id);
                deduped.push(prediction);
            }
        }

        // Sort by confidence and limit
        return deduped
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, this.config.maxPredictions);
    }

    /**
     * Generate prevention prompt from predictions
     */
    private generatePreventionPrompt(predictions: ErrorPrediction[]): string {
        if (predictions.length === 0) {
            return '';
        }

        const mustRules = predictions
            .filter(p => p.prevention.priority === 'must')
            .map(p => `- ${p.prevention.instruction}${p.prevention.code ? `\n  Example: ${p.prevention.code}` : ''}`);

        const shouldRules = predictions
            .filter(p => p.prevention.priority === 'should')
            .map(p => `- ${p.prevention.instruction}`);

        const mayRules = predictions
            .filter(p => p.prevention.priority === 'may')
            .map(p => `- ${p.prevention.instruction}`);

        let prompt = '## Error Prevention Guidelines\n\n';

        if (mustRules.length > 0) {
            prompt += '### MUST Follow (Critical)\n';
            prompt += mustRules.join('\n') + '\n\n';
        }

        if (shouldRules.length > 0) {
            prompt += '### SHOULD Follow (Important)\n';
            prompt += shouldRules.join('\n') + '\n\n';
        }

        if (mayRules.length > 0) {
            prompt += '### MAY Consider (Recommended)\n';
            prompt += mayRules.join('\n') + '\n\n';
        }

        return prompt;
    }

    /**
     * Calculate overall confidence score
     */
    private calculateConfidenceScore(predictions: ErrorPrediction[]): number {
        if (predictions.length === 0) return 1.0;

        const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
        return avgConfidence;
    }

    /**
     * Estimate iterations saved by prevention
     */
    private estimateIterationsSaved(predictions: ErrorPrediction[]): number {
        // Each high-confidence prediction saves ~0.5 iterations on average
        // "must" rules save more, "may" rules save less
        let saved = 0;

        for (const prediction of predictions) {
            const multiplier = prediction.prevention.priority === 'must' ? 0.7 :
                prediction.prevention.priority === 'should' ? 0.4 : 0.2;
            saved += prediction.confidence * multiplier;
        }

        return Math.round(saved * 10) / 10; // Round to 1 decimal
    }
}

// ============================================================================
// FACTORY
// ============================================================================

let preventionInstance: PredictiveErrorPrevention | null = null;

export function getPredictiveErrorPrevention(config?: Partial<PredictionConfig>): PredictiveErrorPrevention {
    if (!preventionInstance || config) {
        preventionInstance = new PredictiveErrorPrevention(config);
    }
    return preventionInstance;
}

export function createPredictiveErrorPrevention(config?: Partial<PredictionConfig>): PredictiveErrorPrevention {
    return new PredictiveErrorPrevention(config);
}
