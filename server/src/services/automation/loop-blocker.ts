/**
 * Loop Blocker Service - Prevents infinite loops during autonomous building
 *
 * Detects when agents are stuck in repetitive failure patterns and forces
 * comprehensive analysis to break the cycle.
 *
 * Features:
 * - Error signature tracking (hash of error message + file + line)
 * - Pattern detection for repetitive errors (same error appearing 3+ times)
 * - Comprehensive analysis mode with full log review
 * - Human escalation after max comprehensive attempts
 *
 * Part of: Ultimate AI-First Builder Architecture
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

export interface ErrorSignature {
    hash: string;
    errorMessage: string;
    file: string;
    line: number;
    column?: number;
    category?: string;
    occurrences: number;
    timestamps: number[];
    stackTraces: string[];
    contexts: Array<Record<string, unknown>>;
}

export interface LoopBlockerState {
    errorHistory: Map<string, ErrorSignature>;
    isInComprehensiveMode: boolean;
    comprehensiveAnalysisCount: number;
    maxComprehensiveAttempts: number;
    lastAnalysisTimestamp: number | null;
    sessionStartTime: number;
    totalErrorsRecorded: number;
    uniqueErrorsCount: number;
}

export interface BuildContext {
    buildId: string;
    projectId: string;
    userId: string;
    phase: string;
    stage: string;
    featureId?: string;
    featureName?: string;
    filesInvolved?: string[];
    buildLogs?: string[];
    runtimeLogs?: string[];
    lastSuccessfulOperation?: string;
}

export interface ComprehensiveAnalysisRequest {
    triggerError: ErrorSignature;
    allErrors: ErrorSignature[];
    buildLogs: string[];
    runtimeLogs: string[];
    context: BuildContext;
    analysisPrompt: string;
}

export interface LoopBlockerConfig {
    /** Number of identical errors before triggering comprehensive analysis */
    repetitionThreshold: number;
    /** Maximum comprehensive analysis attempts before human escalation */
    maxComprehensiveAttempts: number;
    /** Time window (ms) for error pattern detection */
    patternWindowMs: number;
    /** Minimum time between comprehensive analyses (ms) */
    analysisCooldownMs: number;
    /** Maximum errors to keep in history */
    maxErrorHistory: number;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: LoopBlockerConfig = {
    repetitionThreshold: 3,
    maxComprehensiveAttempts: 5,
    patternWindowMs: 300000, // 5 minutes
    analysisCooldownMs: 30000, // 30 seconds
    maxErrorHistory: 100,
};

// =============================================================================
// LOOP BLOCKER SERVICE
// =============================================================================

export class LoopBlocker extends EventEmitter {
    private config: LoopBlockerConfig;
    private state: LoopBlockerState;
    private buildContext: BuildContext | null = null;

    constructor(config: Partial<LoopBlockerConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.state = this.createInitialState();
    }

    private createInitialState(): LoopBlockerState {
        return {
            errorHistory: new Map(),
            isInComprehensiveMode: false,
            comprehensiveAnalysisCount: 0,
            maxComprehensiveAttempts: this.config.maxComprehensiveAttempts,
            lastAnalysisTimestamp: null,
            sessionStartTime: Date.now(),
            totalErrorsRecorded: 0,
            uniqueErrorsCount: 0,
        };
    }

    /**
     * Set the current build context
     */
    setContext(context: BuildContext): void {
        this.buildContext = context;
    }

    /**
     * Generate a unique hash for an error signature
     */
    private generateErrorHash(error: Error, context: BuildContext): string {
        const file = this.extractFileFromError(error);
        const line = this.extractLineFromError(error);
        const normalizedMessage = this.normalizeErrorMessage(error.message);

        const hashInput = `${normalizedMessage}|${file}|${line}|${context.featureId || ''}`;
        return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
    }

    /**
     * Normalize error message for consistent hashing
     */
    private normalizeErrorMessage(message: string): string {
        return message
            .replace(/\d+/g, 'N') // Replace numbers with N
            .replace(/['"][^'"]*['"]/g, '"..."') // Replace string literals
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .toLowerCase()
            .substring(0, 200); // Limit length
    }

    /**
     * Extract file path from error stack
     */
    private extractFileFromError(error: Error): string {
        if (!error.stack) return 'unknown';

        const stackLines = error.stack.split('\n');
        for (const line of stackLines) {
            const match = line.match(/(?:at\s+)?(?:\S+\s+)?\(?([^():]+):(\d+):?(\d+)?\)?/);
            if (match && !match[1].includes('node_modules')) {
                return match[1];
            }
        }
        return 'unknown';
    }

    /**
     * Extract line number from error stack
     */
    private extractLineFromError(error: Error): number {
        if (!error.stack) return 0;

        const stackLines = error.stack.split('\n');
        for (const line of stackLines) {
            const match = line.match(/(?:at\s+)?(?:\S+\s+)?\(?[^():]+:(\d+):?(\d+)?\)?/);
            if (match && !line.includes('node_modules')) {
                return parseInt(match[1], 10);
            }
        }
        return 0;
    }

    /**
     * Extract column number from error stack
     */
    private extractColumnFromError(error: Error): number | undefined {
        if (!error.stack) return undefined;

        const stackLines = error.stack.split('\n');
        for (const line of stackLines) {
            const match = line.match(/(?:at\s+)?(?:\S+\s+)?\(?[^():]+:\d+:(\d+)\)?/);
            if (match && !line.includes('node_modules')) {
                return parseInt(match[1], 10);
            }
        }
        return undefined;
    }

    /**
     * Categorize error type from message
     */
    private categorizeError(error: Error): string {
        const message = error.message.toLowerCase();
        const name = error.name.toLowerCase();

        if (name.includes('syntax') || message.includes('unexpected token')) return 'syntax_error';
        if (name.includes('type') || message.includes('type')) return 'type_error';
        if (message.includes('import') || message.includes('module')) return 'import_error';
        if (message.includes('undefined') || message.includes('null')) return 'undefined_error';
        if (message.includes('cannot find') || message.includes('not found')) return 'not_found_error';
        if (message.includes('dependency') || message.includes('package')) return 'dependency_error';
        if (message.includes('placeholder') || message.includes('todo')) return 'placeholder_error';
        if (message.includes('mock') || message.includes('fake')) return 'mock_data_error';
        if (message.includes('timeout') || message.includes('network')) return 'network_error';
        if (message.includes('permission') || message.includes('access')) return 'permission_error';

        return 'runtime_error';
    }

    /**
     * Record an error occurrence
     */
    recordError(error: Error, context: BuildContext): void {
        const hash = this.generateErrorHash(error, context);
        const now = Date.now();

        this.buildContext = context;
        this.state.totalErrorsRecorded++;

        const existing = this.state.errorHistory.get(hash);

        if (existing) {
            // Update existing signature
            existing.occurrences++;
            existing.timestamps.push(now);
            existing.stackTraces.push(error.stack || '');
            existing.contexts.push({ ...context });

            // Keep only recent timestamps within the pattern window
            const windowStart = now - this.config.patternWindowMs;
            existing.timestamps = existing.timestamps.filter(t => t >= windowStart);
            existing.stackTraces = existing.stackTraces.slice(-10);
            existing.contexts = existing.contexts.slice(-10);

            this.emit('error_recorded', {
                hash,
                occurrences: existing.occurrences,
                isRepetitive: existing.occurrences >= this.config.repetitionThreshold,
            });
        } else {
            // Create new signature
            const signature: ErrorSignature = {
                hash,
                errorMessage: error.message,
                file: this.extractFileFromError(error),
                line: this.extractLineFromError(error),
                column: this.extractColumnFromError(error),
                category: this.categorizeError(error),
                occurrences: 1,
                timestamps: [now],
                stackTraces: [error.stack || ''],
                contexts: [{ ...context }],
            };

            this.state.errorHistory.set(hash, signature);
            this.state.uniqueErrorsCount++;

            this.emit('new_error_signature', { hash, signature });
        }

        // Prune old errors if history exceeds max
        if (this.state.errorHistory.size > this.config.maxErrorHistory) {
            this.pruneOldErrors();
        }

        // Check if we should enter comprehensive mode
        this.checkForLoopPattern();
    }

    /**
     * Prune oldest errors from history
     */
    private pruneOldErrors(): void {
        const entries = Array.from(this.state.errorHistory.entries());

        // Sort by most recent timestamp
        entries.sort((a, b) => {
            const aLatest = Math.max(...a[1].timestamps);
            const bLatest = Math.max(...b[1].timestamps);
            return bLatest - aLatest;
        });

        // Keep only the most recent
        const toKeep = entries.slice(0, this.config.maxErrorHistory);
        this.state.errorHistory = new Map(toKeep);
    }

    /**
     * Check for loop patterns and trigger comprehensive mode if needed
     */
    private checkForLoopPattern(): void {
        const now = Date.now();

        // Check cooldown
        if (
            this.state.lastAnalysisTimestamp &&
            now - this.state.lastAnalysisTimestamp < this.config.analysisCooldownMs
        ) {
            return;
        }

        // Find errors with repetitions above threshold
        for (const [hash, signature] of this.state.errorHistory) {
            const recentTimestamps = signature.timestamps.filter(
                t => t >= now - this.config.patternWindowMs
            );

            if (recentTimestamps.length >= this.config.repetitionThreshold) {
                console.log(
                    `[LoopBlocker] Detected repetitive error pattern: ${signature.errorMessage.substring(0, 50)}... (${recentTimestamps.length} occurrences)`
                );

                this.triggerComprehensiveMode(signature);
                break;
            }
        }
    }

    /**
     * Trigger comprehensive analysis mode
     */
    private triggerComprehensiveMode(triggerSignature: ErrorSignature): void {
        if (this.state.isInComprehensiveMode) {
            console.log('[LoopBlocker] Already in comprehensive mode, skipping');
            return;
        }

        this.state.isInComprehensiveMode = true;
        this.state.comprehensiveAnalysisCount++;
        this.state.lastAnalysisTimestamp = Date.now();

        this.emit('comprehensive_mode_triggered', {
            triggerError: triggerSignature,
            analysisCount: this.state.comprehensiveAnalysisCount,
            maxAttempts: this.state.maxComprehensiveAttempts,
        });

        console.log(
            `[LoopBlocker] Comprehensive analysis mode triggered (attempt ${this.state.comprehensiveAnalysisCount}/${this.state.maxComprehensiveAttempts})`
        );
    }

    /**
     * Check if the system is stuck in a loop
     */
    isStuckInLoop(): boolean {
        return this.state.isInComprehensiveMode;
    }

    /**
     * Check if human escalation is needed
     */
    needsHumanEscalation(): boolean {
        return this.state.comprehensiveAnalysisCount >= this.state.maxComprehensiveAttempts;
    }

    /**
     * Get comprehensive analysis prompt for AI
     */
    getComprehensiveAnalysisPrompt(): string {
        const allErrors = Array.from(this.state.errorHistory.values());
        const repetitiveErrors = allErrors.filter(
            e => e.occurrences >= this.config.repetitionThreshold
        );

        const context = this.buildContext;
        const buildLogs = context?.buildLogs?.join('\n') || 'No build logs available';
        const runtimeLogs = context?.runtimeLogs?.join('\n') || 'No runtime logs available';

        const errorSummary = repetitiveErrors
            .map(e => {
                return `
## Error: ${e.errorMessage}
- File: ${e.file}:${e.line}${e.column ? `:${e.column}` : ''}
- Category: ${e.category}
- Occurrences: ${e.occurrences}
- Stack Trace (latest):
\`\`\`
${e.stackTraces[e.stackTraces.length - 1]?.substring(0, 500) || 'N/A'}
\`\`\`
`;
            })
            .join('\n');

        const allErrorsSummary = allErrors
            .filter(e => e.occurrences < this.config.repetitionThreshold)
            .slice(0, 10)
            .map(e => `- ${e.errorMessage.substring(0, 100)} (${e.file}:${e.line})`)
            .join('\n');

        return `
# COMPREHENSIVE ERROR ANALYSIS REQUIRED

You have been caught in a repetitive error loop. Previous fix attempts have failed ${this.state.comprehensiveAnalysisCount} times.
This is attempt ${this.state.comprehensiveAnalysisCount}/${this.state.maxComprehensiveAttempts} before human escalation.

## CRITICAL: You MUST analyze thoroughly and break the loop.

---

## Repetitive Errors (appearing ${this.config.repetitionThreshold}+ times):
${errorSummary}

## Other Recent Errors:
${allErrorsSummary || 'None'}

---

## Build Context:
- Build ID: ${context?.buildId || 'Unknown'}
- Phase: ${context?.phase || 'Unknown'}
- Stage: ${context?.stage || 'Unknown'}
- Feature: ${context?.featureName || context?.featureId || 'Unknown'}
- Files Involved: ${context?.filesInvolved?.join(', ') || 'Unknown'}

---

## Build Logs (Last 50 lines):
\`\`\`
${buildLogs.split('\n').slice(-50).join('\n')}
\`\`\`

## Runtime Logs (Last 50 lines):
\`\`\`
${runtimeLogs.split('\n').slice(-50).join('\n')}
\`\`\`

---

## REQUIRED ANALYSIS:

1. **Root Cause Analysis**: What is the ACTUAL root cause? (Not just the symptom)

2. **Pattern Analysis**: Why have previous fixes failed? What pattern are we stuck in?

3. **Comprehensive Checks**:
   - Are there placeholder/mock data issues?
   - Are there missing dependencies?
   - Are there type mismatches?
   - Are there circular dependencies?
   - Are there race conditions?
   - Are there missing environment variables?
   - Are there incorrect import paths?

4. **Fix Plan**: Create a COMPLETE fix plan that addresses ALL issues at once.
   - Do NOT just fix one error - fix the underlying pattern
   - Include ALL necessary file changes
   - Verify all imports and dependencies
   - Remove all placeholder/mock data

5. **Verification**: How will you verify this fix actually works?

---

## Response Format:

Provide your analysis as JSON:
\`\`\`json
{
  "rootCause": "The actual root cause of the loop",
  "patternAnalysis": "Why previous fixes failed",
  "issues": [
    {
      "type": "placeholder_data | missing_dependency | type_mismatch | etc",
      "description": "Description of the issue",
      "file": "affected file path",
      "fix": "What needs to change"
    }
  ],
  "fixPlan": {
    "strategy": "Overall fix strategy",
    "steps": ["Step 1", "Step 2", ...],
    "changes": [
      {
        "path": "file path",
        "action": "create | update | delete",
        "description": "What this change does",
        "newContent": "Complete new file content (for create/update)"
      }
    ]
  },
  "verification": {
    "steps": ["How to verify the fix works"],
    "expectedOutcome": "What success looks like"
  }
}
\`\`\`

Remember: This is attempt ${this.state.comprehensiveAnalysisCount}/${this.state.maxComprehensiveAttempts}.
If you fail again, the system will escalate to human intervention.
`;
    }

    /**
     * Get a summary of the current state
     */
    getStateSummary(): {
        isStuck: boolean;
        needsHuman: boolean;
        analysisCount: number;
        maxAttempts: number;
        totalErrors: number;
        uniqueErrors: number;
        repetitiveErrors: ErrorSignature[];
    } {
        const repetitiveErrors = Array.from(this.state.errorHistory.values()).filter(
            e => e.occurrences >= this.config.repetitionThreshold
        );

        return {
            isStuck: this.state.isInComprehensiveMode,
            needsHuman: this.needsHumanEscalation(),
            analysisCount: this.state.comprehensiveAnalysisCount,
            maxAttempts: this.state.maxComprehensiveAttempts,
            totalErrors: this.state.totalErrorsRecorded,
            uniqueErrors: this.state.uniqueErrorsCount,
            repetitiveErrors,
        };
    }

    /**
     * Mark comprehensive analysis as complete
     */
    completeComprehensiveAnalysis(success: boolean): void {
        this.state.isInComprehensiveMode = false;

        this.emit('comprehensive_analysis_complete', {
            success,
            analysisCount: this.state.comprehensiveAnalysisCount,
        });

        if (success) {
            console.log('[LoopBlocker] Comprehensive analysis succeeded, exiting loop');
            // Clear error history on success
            this.state.errorHistory.clear();
            this.state.comprehensiveAnalysisCount = 0;
        } else {
            console.log(
                `[LoopBlocker] Comprehensive analysis failed (${this.state.comprehensiveAnalysisCount}/${this.state.maxComprehensiveAttempts})`
            );
        }
    }

    /**
     * Reset the loop blocker state
     */
    reset(): void {
        this.state = this.createInitialState();
        this.buildContext = null;
        this.emit('reset');
        console.log('[LoopBlocker] State reset');
    }

    /**
     * Reset only comprehensive analysis count (for new feature/task)
     */
    resetAnalysisCount(): void {
        this.state.comprehensiveAnalysisCount = 0;
        this.state.isInComprehensiveMode = false;
        this.emit('analysis_count_reset');
    }

    /**
     * Get all error signatures
     */
    getErrorSignatures(): ErrorSignature[] {
        return Array.from(this.state.errorHistory.values());
    }

    /**
     * Get specific error signature by hash
     */
    getErrorSignature(hash: string): ErrorSignature | undefined {
        return this.state.errorHistory.get(hash);
    }

    /**
     * Get current config
     */
    getConfig(): LoopBlockerConfig {
        return { ...this.config };
    }

    /**
     * Update config
     */
    updateConfig(config: Partial<LoopBlockerConfig>): void {
        this.config = { ...this.config, ...config };
        this.state.maxComprehensiveAttempts = this.config.maxComprehensiveAttempts;
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createLoopBlocker(config?: Partial<LoopBlockerConfig>): LoopBlocker {
    return new LoopBlocker(config);
}

export default LoopBlocker;
