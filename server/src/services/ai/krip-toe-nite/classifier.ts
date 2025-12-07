/**
 * Krip-Toe-Nite Task Classifier
 *
 * Analyzes prompts to determine:
 * - Task type (code generation, fix, UI, etc.)
 * - Complexity level (trivial to expert)
 * - Special requirements (vision, design-heavy, etc.)
 *
 * This classification drives routing decisions for optimal model selection.
 */

import { TaskType, Complexity, type TaskAnalysis, type BuildContext } from './types.js';

// =============================================================================
// SIGNAL PATTERNS
// =============================================================================

/**
 * Code-related keyword patterns
 */
const CODE_SIGNALS = {
    generation: [
        'create', 'build', 'generate', 'implement', 'add', 'make', 'write',
        'develop', 'construct', 'set up', 'initialize', 'scaffold',
    ],
    fix: [
        'fix', 'debug', 'error', 'broken', 'not working', 'bug', 'issue',
        'failing', 'crash', 'problem', 'resolve', 'repair', 'broken',
    ],
    refactor: [
        'refactor', 'improve', 'optimize', 'clean up', 'restructure',
        'reorganize', 'simplify', 'modernize', 'upgrade',
    ],
    ui: [
        'component', 'ui', 'interface', 'button', 'form', 'modal', 'layout',
        'style', 'css', 'tailwind', 'design', 'page', 'view', 'screen',
    ],
    api: [
        'api', 'endpoint', 'route', 'rest', 'graphql', 'fetch', 'request',
        'server', 'backend', 'handler', 'controller',
    ],
    database: [
        'database', 'schema', 'migration', 'query', 'sql', 'prisma', 'mongodb',
        'drizzle', 'table', 'model', 'orm', 'turso',
    ],
    testing: [
        'test', 'spec', 'unit test', 'integration test', 'e2e', 'jest',
        'vitest', 'cypress', 'playwright', 'coverage',
    ],
};

/**
 * Complexity signal patterns
 */
const COMPLEXITY_SIGNALS = {
    trivial: [
        'format', 'indent', 'rename', 'typo', 'simple', 'quick', 'small',
        'minor', 'trivial', 'single line', 'comment',
    ],
    simple: [
        'add a', 'create a simple', 'basic', 'standard', 'typical',
        'straightforward', 'common', 'usual',
    ],
    medium: [
        'implement', 'feature', 'functionality', 'add to', 'extend',
        'integrate', 'connect', 'combine',
    ],
    complex: [
        'across', 'multiple files', 'entire', 'all', 'system', 'architecture',
        'complex', 'comprehensive', 'complete', 'full',
    ],
    expert: [
        'design system', 'scale', 'migrate', 'rewrite', 'from scratch',
        'architecture', 'infrastructure', 'orchestration', 'distributed',
        'microservices', 'real-time', 'streaming',
    ],
};

/**
 * Design-heavy patterns that require premium quality
 */
const DESIGN_PATTERNS = [
    'dashboard', 'landing page', 'user interface', /\bui\b/i, 'beautiful',
    'modern design', 'sleek', 'professional look', 'premium design',
    'stunning', 'elegant', 'polished', 'hero section', 'home page',
    'portfolio', 'showcase', 'marketing page', 'saas', 'glassmorphism',
    /animations?/i, /micro.?interactions?/i, 'dark mode', 'theme',
    'responsive design', 'mobile first', 'framer motion', 'motion',
];

/**
 * Critical task patterns requiring high reliability
 */
const CRITICAL_PATTERNS = [
    /architect/i, /design.*system/i, /complex.*feature/i,
    /authentication.*flow/i, /payment.*integration/i, /database.*schema/i,
    /api.*design/i, /security/i, /state.*management/i, /real-?time/i,
    /websocket/i, /oauth/i, /stripe/i, /full.*application/i,
    /billing/i, /subscription/i, /admin.*panel/i, /user.*management/i,
];

// =============================================================================
// CLASSIFIER CLASS
// =============================================================================

/**
 * Intent and complexity classifier for Krip-Toe-Nite routing
 */
export class TaskClassifier {
    /**
     * Classify the task type from a prompt
     */
    classifyTaskType(prompt: string, context?: BuildContext): TaskType {
        const lower = prompt.toLowerCase();

        // Check for UI/component work (high priority)
        if (this.matchesAny(lower, CODE_SIGNALS.ui)) {
            return TaskType.UI_COMPONENT;
        }

        // Check for fix/debug
        if (this.matchesAny(lower, CODE_SIGNALS.fix)) {
            return TaskType.CODE_FIX;
        }

        // Check for testing
        if (this.matchesAny(lower, CODE_SIGNALS.testing)) {
            return TaskType.TESTING;
        }

        // Check for refactoring
        if (this.matchesAny(lower, CODE_SIGNALS.refactor)) {
            return TaskType.CODE_REFACTOR;
        }

        // Check for API work
        if (this.matchesAny(lower, CODE_SIGNALS.api)) {
            return TaskType.API_DESIGN;
        }

        // Check for database work
        if (this.matchesAny(lower, CODE_SIGNALS.database)) {
            return TaskType.DATABASE;
        }

        // Check for explanation/docs
        if (lower.includes('explain') || lower.includes('document') ||
            lower.includes('how does') || lower.includes('what is')) {
            return TaskType.EXPLANATION;
        }

        // Check for architecture
        if (this.matchesPatterns(lower, CRITICAL_PATTERNS)) {
            return TaskType.ARCHITECTURE;
        }

        // Check for complex reasoning
        if (this.matchesAny(lower, COMPLEXITY_SIGNALS.expert)) {
            return TaskType.COMPLEX_REASONING;
        }

        // Default to code generation
        return TaskType.CODE_GENERATION;
    }

    /**
     * Estimate task complexity from prompt and context
     */
    estimateComplexity(prompt: string, context?: BuildContext): Complexity {
        const lower = prompt.toLowerCase();
        const promptLength = prompt.length;

        // Very short prompts are usually trivial
        if (promptLength < 50) return Complexity.TRIVIAL;

        // Check for trivial signals
        if (this.matchesAny(lower, COMPLEXITY_SIGNALS.trivial)) {
            return Complexity.TRIVIAL;
        }

        // Check for expert signals
        if (this.matchesAny(lower, COMPLEXITY_SIGNALS.expert)) {
            return Complexity.EXPERT;
        }

        // Check for complex signals
        if (this.matchesAny(lower, COMPLEXITY_SIGNALS.complex)) {
            return Complexity.COMPLEX;
        }

        // Design-heavy tasks are at least MEDIUM
        if (this.isDesignHeavy(lower)) {
            return promptLength > 500 ? Complexity.COMPLEX : Complexity.MEDIUM;
        }

        // Critical patterns indicate COMPLEX minimum
        if (this.matchesPatterns(lower, CRITICAL_PATTERNS)) {
            return Complexity.COMPLEX;
        }

        // Context-based complexity
        if (context?.fileCount) {
            if (context.fileCount > 20) return Complexity.COMPLEX;
            if (context.fileCount > 10) return Complexity.MEDIUM;
            if (context.fileCount > 5) return Complexity.SIMPLE;
        }

        // Length-based complexity
        if (promptLength > 1000) return Complexity.COMPLEX;
        if (promptLength > 500) return Complexity.MEDIUM;
        if (promptLength > 200) return Complexity.SIMPLE;

        return Complexity.TRIVIAL;
    }

    /**
     * Full task analysis
     */
    analyze(prompt: string, context?: BuildContext): TaskAnalysis {
        const lower = prompt.toLowerCase();
        const taskType = this.classifyTaskType(prompt, context);
        const complexity = this.estimateComplexity(prompt, context);

        const isDesignHeavy = this.isDesignHeavy(lower);
        const isCritical = this.matchesPatterns(lower, CRITICAL_PATTERNS) ||
                          taskType === TaskType.ARCHITECTURE ||
                          complexity >= Complexity.COMPLEX;

        const requiresVision = this.detectVisionRequirement(prompt, context);

        // Estimate tokens
        const promptTokens = Math.ceil(prompt.length / 4);
        const codeTokens = context?.fileCount ? context.fileCount * 500 : 0;
        const baseTokens = this.getBaseTokensForComplexity(complexity);
        const estimatedTokens = promptTokens + codeTokens + baseTokens;

        // Build signals object
        const signals = {
            codeKeywords: this.matchesAny(lower, CODE_SIGNALS.generation) ||
                         this.matchesAny(lower, CODE_SIGNALS.fix),
            uiKeywords: this.matchesAny(lower, CODE_SIGNALS.ui),
            fixKeywords: this.matchesAny(lower, CODE_SIGNALS.fix),
            architectureKeywords: this.matchesPatterns(lower, CRITICAL_PATTERNS),
            designKeywords: isDesignHeavy,
        };

        // Build reasoning
        const reason = this.buildReason(taskType, complexity, isDesignHeavy, isCritical);

        return {
            taskType,
            complexity,
            estimatedTokens,
            requiresVision,
            isDesignHeavy,
            isCritical,
            reason,
            signals,
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Check if text matches any patterns
     */
    private matchesAny(text: string, patterns: string[]): boolean {
        return patterns.some(p => text.includes(p.toLowerCase()));
    }

    /**
     * Check if text matches regex patterns
     */
    private matchesPatterns(text: string, patterns: (string | RegExp)[]): boolean {
        return patterns.some(p => {
            if (typeof p === 'string') {
                return text.includes(p.toLowerCase());
            }
            return p.test(text);
        });
    }

    /**
     * Check if task is design-heavy
     */
    private isDesignHeavy(text: string): boolean {
        return this.matchesPatterns(text, DESIGN_PATTERNS);
    }

    /**
     * Detect if vision/image processing is needed
     */
    private detectVisionRequirement(prompt: string, context?: BuildContext): boolean {
        const lower = prompt.toLowerCase();

        // Explicit image references
        if (lower.includes('image') || lower.includes('screenshot') ||
            lower.includes('picture') || lower.includes('photo') ||
            lower.includes('figma') || lower.includes('design file')) {
            return true;
        }

        // Check if context has images
        // (would be passed in from frontend)

        return false;
    }

    /**
     * Get base token estimate for complexity level
     */
    private getBaseTokensForComplexity(complexity: Complexity): number {
        switch (complexity) {
            case Complexity.TRIVIAL: return 500;
            case Complexity.SIMPLE: return 1000;
            case Complexity.MEDIUM: return 2000;
            case Complexity.COMPLEX: return 4000;
            case Complexity.EXPERT: return 8000;
            default: return 2000;
        }
    }

    /**
     * Build human-readable reasoning string
     */
    private buildReason(
        taskType: TaskType,
        complexity: Complexity,
        isDesignHeavy: boolean,
        isCritical: boolean
    ): string {
        const parts: string[] = [];

        // Task type reason
        parts.push(this.getTaskTypeReason(taskType));

        // Complexity reason
        parts.push(this.getComplexityReason(complexity));

        // Special flags
        if (isDesignHeavy) {
            parts.push('Design-heavy task requiring premium UI quality');
        }
        if (isCritical) {
            parts.push('Critical task requiring high reliability');
        }

        return parts.join('. ');
    }

    /**
     * Get reasoning for task type
     */
    private getTaskTypeReason(taskType: TaskType): string {
        switch (taskType) {
            case TaskType.CODE_GENERATION:
                return 'Code generation task';
            case TaskType.CODE_FIX:
                return 'Bug fix / debugging task';
            case TaskType.CODE_REFACTOR:
                return 'Code refactoring task';
            case TaskType.UI_COMPONENT:
                return 'UI component development';
            case TaskType.API_DESIGN:
                return 'API / backend development';
            case TaskType.DATABASE:
                return 'Database schema / query task';
            case TaskType.EXPLANATION:
                return 'Explanation / documentation task';
            case TaskType.DOCUMENTATION:
                return 'Documentation task';
            case TaskType.SIMPLE_EDIT:
                return 'Simple code edit';
            case TaskType.COMPLEX_REASONING:
                return 'Complex reasoning required';
            case TaskType.DESIGN_SYSTEM:
                return 'Design system development';
            case TaskType.ARCHITECTURE:
                return 'Architecture / system design';
            case TaskType.TESTING:
                return 'Testing / quality assurance';
            case TaskType.DEBUGGING:
                return 'Debugging / troubleshooting';
            default:
                return 'General development task';
        }
    }

    /**
     * Get reasoning for complexity level
     */
    private getComplexityReason(complexity: Complexity): string {
        switch (complexity) {
            case Complexity.TRIVIAL:
                return 'Trivial complexity - single-line change';
            case Complexity.SIMPLE:
                return 'Simple complexity - standard implementation';
            case Complexity.MEDIUM:
                return 'Medium complexity - feature implementation';
            case Complexity.COMPLEX:
                return 'Complex - multi-file, architectural considerations';
            case Complexity.EXPERT:
                return 'Expert complexity - system design required';
            default:
                return 'Standard complexity';
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let classifierInstance: TaskClassifier | null = null;

export function getTaskClassifier(): TaskClassifier {
    if (!classifierInstance) {
        classifierInstance = new TaskClassifier();
    }
    return classifierInstance;
}

export default TaskClassifier;

