/**
 * Error Checker Agent
 *
 * Continuous error detection with 5-second polling.
 * BLOCKING agent - halts build on any critical errors.
 *
 * Checks:
 * - TypeScript compilation errors
 * - ESLint violations (error level)
 * - Runtime errors (syntax, reference)
 * - Import/export issues
 * - Type mismatches
 *
 * Part of Phase 4: 6-Agent Verification Swarm
 */

import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type ErrorSeverity = 'error' | 'warning' | 'info';
export type ErrorCategory =
    | 'typescript'
    | 'eslint'
    | 'runtime'
    | 'import'
    | 'syntax'
    | 'type'
    | 'reference'
    | 'build';

export interface DetectedError {
    id: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    code: string;            // Error code (e.g., TS2304, no-unused-vars)
    message: string;
    file: string;
    line?: number;
    column?: number;
    source?: string;         // Source code snippet
    suggestion?: string;     // AI-generated fix suggestion
}

export interface ErrorCheckResult {
    timestamp: Date;
    passed: boolean;
    blocking: boolean;       // True if errors prevent build continuation
    errorCount: number;
    warningCount: number;
    errors: DetectedError[];
    summary: string;
}

export interface ErrorCheckerConfig {
    pollIntervalMs: number;
    blockOnErrors: boolean;
    blockOnWarnings: boolean;
    maxErrorsBeforeBlock: number;
    enableAISuggestions: boolean;
    ignoredCodes: string[];
    ignoredPaths: string[];
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: ErrorCheckerConfig = {
    pollIntervalMs: 5000,      // 5 seconds
    blockOnErrors: true,
    blockOnWarnings: false,
    maxErrorsBeforeBlock: 0,   // Block on any error
    enableAISuggestions: true,
    ignoredCodes: [],
    ignoredPaths: ['node_modules', '.git', 'dist', 'build'],
};

// ============================================================================
// ERROR PATTERNS
// ============================================================================

const ERROR_PATTERNS = {
    // TypeScript errors
    typescript: {
        patterns: [
            /TS\d{4,5}/,                           // TS error codes
            /error TS\d+:/,
            /Type '.*' is not assignable to/,
            /Property '.*' does not exist on type/,
            /Cannot find name '.*'/,
            /Cannot find module '.*'/,
            /Argument of type '.*' is not assignable/,
            /Expected \d+ arguments?, but got \d+/,
            /Object is possibly 'undefined'/,
            /Object is possibly 'null'/,
        ],
        severity: 'error' as ErrorSeverity,
    },

    // ESLint errors
    eslint: {
        patterns: [
            /eslint.*error/i,
            /no-unused-vars/,
            /no-undef/,
            /no-console/,
            /react-hooks\/exhaustive-deps/,
            /prefer-const/,
            /eqeqeq/,
        ],
        severity: 'error' as ErrorSeverity,
    },

    // Syntax errors
    syntax: {
        patterns: [
            /SyntaxError:/,
            /Unexpected token/,
            /Unterminated string/,
            /Missing semicolon/,
            /Unexpected end of input/,
            /Parsing error:/,
        ],
        severity: 'error' as ErrorSeverity,
    },

    // Reference errors
    reference: {
        patterns: [
            /ReferenceError:/,
            /is not defined/,
            /Cannot access '.*' before initialization/,
        ],
        severity: 'error' as ErrorSeverity,
    },

    // Import/export errors
    import: {
        patterns: [
            /import.*error/i,
            /export.*error/i,
            /Module not found/,
            /Cannot resolve/,
            /Failed to resolve import/,
            /does not provide an export named/,
        ],
        severity: 'error' as ErrorSeverity,
    },

    // Build errors
    build: {
        patterns: [
            /Build failed/i,
            /Compilation failed/i,
            /Failed to compile/i,
            /Error during build/i,
        ],
        severity: 'error' as ErrorSeverity,
    },
};

// ============================================================================
// ERROR CHECKER AGENT
// ============================================================================

export class ErrorCheckerAgent extends EventEmitter {
    private projectId: string;
    private userId: string;
    private config: ErrorCheckerConfig;
    private claudeService: ReturnType<typeof createClaudeService>;
    private pollTimer?: NodeJS.Timeout;
    private isRunning: boolean = false;
    private lastResult?: ErrorCheckResult;

    constructor(
        projectId: string,
        userId: string,
        config?: Partial<ErrorCheckerConfig>
    ) {
        super();
        this.projectId = projectId;
        this.userId = userId;
        this.config = { ...DEFAULT_CONFIG, ...config };

        this.claudeService = createClaudeService({
            agentType: 'verification',
            projectId,
            userId,
        });
    }

    /**
     * Start continuous error checking
     */
    start(getFiles: () => Map<string, string>): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.emit('started');
        console.log(`[ErrorChecker] Started with ${this.config.pollIntervalMs}ms interval`);

        // Initial check
        this.runCheck(getFiles());

        // Set up polling
        this.pollTimer = setInterval(() => {
            if (this.isRunning) {
                this.runCheck(getFiles());
            }
        }, this.config.pollIntervalMs);
    }

    /**
     * Stop error checking
     */
    stop(): void {
        this.isRunning = false;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
        this.emit('stopped');
        console.log('[ErrorChecker] Stopped');
    }

    /**
     * Run a single error check
     */
    async runCheck(files: Map<string, string>): Promise<ErrorCheckResult> {
        const startTime = Date.now();
        const errors: DetectedError[] = [];

        // Filter out ignored paths
        const filesToCheck = new Map(
            Array.from(files.entries()).filter(([path]) =>
                !this.config.ignoredPaths.some(ignored => path.includes(ignored))
            )
        );

        // Check each file for errors
        for (const [filePath, content] of filesToCheck.entries()) {
            // Skip non-code files
            if (!this.isCodeFile(filePath)) continue;

            const fileErrors = this.checkFile(filePath, content);
            errors.push(...fileErrors);
        }

        // Filter out ignored codes
        const filteredErrors = errors.filter(e =>
            !this.config.ignoredCodes.includes(e.code)
        );

        // Generate AI suggestions if enabled
        if (this.config.enableAISuggestions && filteredErrors.length > 0) {
            await this.generateSuggestions(filteredErrors, files);
        }

        // Calculate counts
        const errorCount = filteredErrors.filter(e => e.severity === 'error').length;
        const warningCount = filteredErrors.filter(e => e.severity === 'warning').length;

        // Determine if blocking
        const blocking =
            (this.config.blockOnErrors && errorCount > this.config.maxErrorsBeforeBlock) ||
            (this.config.blockOnWarnings && warningCount > 0);

        const result: ErrorCheckResult = {
            timestamp: new Date(),
            passed: errorCount === 0,
            blocking,
            errorCount,
            warningCount,
            errors: filteredErrors,
            summary: this.generateSummary(filteredErrors, errorCount, warningCount),
        };

        this.lastResult = result;
        this.emit('check_complete', result);

        if (blocking) {
            this.emit('blocking', result);
        }

        console.log(`[ErrorChecker] Check complete: ${errorCount} errors, ${warningCount} warnings (${Date.now() - startTime}ms)`);

        return result;
    }

    /**
     * Get last check result
     */
    getLastResult(): ErrorCheckResult | undefined {
        return this.lastResult;
    }

    /**
     * Check if currently running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    // ==========================================================================
    // INTERNAL METHODS
    // ==========================================================================

    private isCodeFile(path: string): boolean {
        return /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/i.test(path);
    }

    private checkFile(filePath: string, content: string): DetectedError[] {
        const errors: DetectedError[] = [];
        const lines = content.split('\n');

        // Check each category of errors
        for (const [category, config] of Object.entries(ERROR_PATTERNS)) {
            for (const pattern of config.patterns) {
                // Check entire content first
                if (pattern.test(content)) {
                    // Find specific lines
                    lines.forEach((line, index) => {
                        if (pattern.test(line)) {
                            const match = line.match(pattern);
                            errors.push({
                                id: uuidv4(),
                                category: category as ErrorCategory,
                                severity: config.severity,
                                code: this.extractErrorCode(line, category),
                                message: this.extractErrorMessage(line, pattern),
                                file: filePath,
                                line: index + 1,
                                source: line.trim(),
                            });
                        }
                    });
                }
            }
        }

        // Additional structural checks
        errors.push(...this.checkStructuralErrors(filePath, content, lines));

        return errors;
    }

    private checkStructuralErrors(
        filePath: string,
        content: string,
        lines: string[]
    ): DetectedError[] {
        const errors: DetectedError[] = [];

        // Check for unclosed brackets/braces
        const brackets = { '(': 0, '[': 0, '{': 0 };
        const bracketMap = { ')': '(', ']': '[', '}': '{' };

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            if (char in brackets) {
                brackets[char as keyof typeof brackets]++;
            } else if (char in bracketMap) {
                brackets[bracketMap[char as keyof typeof bracketMap] as keyof typeof brackets]--;
            }
        }

        for (const [bracket, count] of Object.entries(brackets)) {
            if (count !== 0) {
                errors.push({
                    id: uuidv4(),
                    category: 'syntax',
                    severity: 'error',
                    code: 'BRACKET_MISMATCH',
                    message: `Unmatched ${bracket} bracket (${Math.abs(count)} ${count > 0 ? 'unclosed' : 'extra'})`,
                    file: filePath,
                });
            }
        }

        // Check for common TypeScript/React issues in TSX files
        if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
            // Missing return in component
            if (content.includes('function') && !content.includes('return')) {
                const hasArrowReturn = /=>\s*[({<]/.test(content);
                if (!hasArrowReturn) {
                    errors.push({
                        id: uuidv4(),
                        category: 'typescript',
                        severity: 'warning',
                        code: 'MISSING_RETURN',
                        message: 'Component may be missing a return statement',
                        file: filePath,
                    });
                }
            }

            // Check for common hooks issues
            if (content.includes('useState') || content.includes('useEffect')) {
                // Check if hooks are at top level
                const hookMatch = content.match(/(if|for|while|switch)\s*\([^)]*\)\s*\{[^}]*use(State|Effect|Callback|Memo|Ref)/);
                if (hookMatch) {
                    errors.push({
                        id: uuidv4(),
                        category: 'eslint',
                        severity: 'error',
                        code: 'HOOKS_RULES_VIOLATION',
                        message: 'React hooks must be called at the top level, not inside conditions or loops',
                        file: filePath,
                    });
                }
            }
        }

        return errors;
    }

    private extractErrorCode(line: string, category: string): string {
        // Try to extract TypeScript error code
        const tsMatch = line.match(/TS(\d{4,5})/);
        if (tsMatch) return `TS${tsMatch[1]}`;

        // Try to extract ESLint rule
        const eslintMatch = line.match(/([\w-]+\/[\w-]+|[\w-]+)(?:\s|$)/);
        if (eslintMatch && category === 'eslint') return eslintMatch[1];

        return category.toUpperCase();
    }

    private extractErrorMessage(line: string, pattern: RegExp): string {
        // Clean up the line to get a readable message
        const match = line.match(pattern);
        if (match) {
            return match[0].replace(/^(error|warning|info):\s*/i, '').trim();
        }
        return line.trim().substring(0, 100);
    }

    private async generateSuggestions(
        errors: DetectedError[],
        files: Map<string, string>
    ): Promise<void> {
        // Only suggest for first 5 errors to save tokens
        const errorsToSuggest = errors.slice(0, 5);

        for (const error of errorsToSuggest) {
            try {
                const fileContent = files.get(error.file);
                if (!fileContent) continue;

                const contextLines = this.getContextLines(fileContent, error.line || 1);

                const response = await this.claudeService.generate(
                    `Suggest a fix for this ${error.category} error:

ERROR: ${error.message}
CODE: ${error.code}
FILE: ${error.file}${error.line ? `:${error.line}` : ''}

CONTEXT:
\`\`\`
${contextLines}
\`\`\`

Provide a brief, actionable fix suggestion in 1-2 sentences.`,
                    {
                        model: CLAUDE_MODELS.HAIKU,
                        maxTokens: 150,
                        useExtendedThinking: false,
                    }
                );

                error.suggestion = response.content.trim();
            } catch (e) {
                // Silently skip suggestion generation on error
            }
        }
    }

    private getContextLines(content: string, line: number, context: number = 3): string {
        const lines = content.split('\n');
        const start = Math.max(0, line - context - 1);
        const end = Math.min(lines.length, line + context);

        return lines
            .slice(start, end)
            .map((l, i) => `${start + i + 1} | ${l}`)
            .join('\n');
    }

    private generateSummary(
        errors: DetectedError[],
        errorCount: number,
        warningCount: number
    ): string {
        if (errorCount === 0 && warningCount === 0) {
            return 'No errors or warnings detected.';
        }

        const parts: string[] = [];

        if (errorCount > 0) {
            parts.push(`${errorCount} error${errorCount > 1 ? 's' : ''}`);
        }
        if (warningCount > 0) {
            parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
        }

        // Group by category
        const byCategory = new Map<ErrorCategory, number>();
        for (const error of errors) {
            byCategory.set(error.category, (byCategory.get(error.category) || 0) + 1);
        }

        const categoryBreakdown = Array.from(byCategory.entries())
            .map(([cat, count]) => `${cat}: ${count}`)
            .join(', ');

        return `Found ${parts.join(', ')}. Categories: ${categoryBreakdown}`;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createErrorCheckerAgent(
    projectId: string,
    userId: string,
    config?: Partial<ErrorCheckerConfig>
): ErrorCheckerAgent {
    return new ErrorCheckerAgent(projectId, userId, config);
}

export default ErrorCheckerAgent;

