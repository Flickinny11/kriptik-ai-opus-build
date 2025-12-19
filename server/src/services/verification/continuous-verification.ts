/**
 * Continuous Verification Service - Actually Continuous, Not Heartbeats
 *
 * The original swarm.ts intervals just emit tick events - they don't actually
 * run verification checks. This service ACTUALLY runs lightweight checks
 * on intervals and streams results to the building agents in real-time.
 *
 * Key Principles:
 * 1. Lightweight checks that don't block the build
 * 2. Incremental analysis (only check modified files)
 * 3. Real-time streaming via StreamingFeedbackChannel
 * 4. Parallel execution of independent checks
 *
 * This is what makes Cursor 2.1 feel "magical" - immediate feedback.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    getStreamingFeedbackChannel,
    type StreamingFeedbackChannel,
    type FeedbackCategory,
    type FeedbackSeverity,
} from '../feedback/streaming-feedback-channel.js';

// =============================================================================
// TYPES
// =============================================================================

export type VerificationCheckType =
    | 'typescript'      // TSC type checking
    | 'eslint'          // ESLint rules
    | 'placeholder'     // TODO/FIXME detection
    | 'security'        // Exposed secrets, injection
    | 'antiSlop'        // AI slop patterns
    | 'imports';        // Missing/unused imports

export interface VerificationCheck {
    type: VerificationCheckType;
    intervalMs: number;
    enabled: boolean;
    lastRun?: Date;
    lastDuration?: number;
}

export interface CheckResult {
    type: VerificationCheckType;
    issues: Array<{
        severity: FeedbackSeverity;
        message: string;
        file?: string;
        line?: number;
        column?: number;
        suggestion?: string;
        autoFix?: { description: string; replacement: string };
    }>;
    duration: number;
    filesChecked: number;
}

export interface ContinuousVerificationConfig {
    buildId: string;
    projectPath: string;
    enabledChecks?: VerificationCheckType[];
    checkIntervals?: Partial<Record<VerificationCheckType, number>>;
}

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

const DEFAULT_CHECK_INTERVALS: Record<VerificationCheckType, number> = {
    typescript: 10000,    // 10 seconds - most critical
    eslint: 15000,        // 15 seconds
    placeholder: 5000,    // 5 seconds - ZERO TOLERANCE
    security: 30000,      // 30 seconds
    antiSlop: 20000,      // 20 seconds
    imports: 15000,       // 15 seconds
};

// Placeholder patterns - ZERO TOLERANCE
const PLACEHOLDER_PATTERNS = [
    /\bTODO\b/i,
    /\bFIXME\b/i,
    /\bHACK\b/i,
    /lorem\s*ipsum/i,
    /\bXXX\b/,
    /\bTBD\b/i,
    /placeholder/i,
    /coming\s*soon/i,
    /\.\.\./,           // Ellipsis in strings often indicates incomplete
    /sample\s*data/i,
    /test\s*data/i,
    /mock\s*data/i,
    /fake\s*data/i,
    /dummy/i,
];

// Security patterns
const SECURITY_PATTERNS = [
    { pattern: /['"]sk-[a-zA-Z0-9]{20,}['"]/, message: 'OpenAI API key exposed' },
    { pattern: /['"]AKIA[A-Z0-9]{16}['"]/, message: 'AWS Access Key exposed' },
    { pattern: /password\s*[:=]\s*['"][^'"]+['"]/, message: 'Hardcoded password detected' },
    { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/, message: 'Hardcoded API key detected' },
    { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/i, message: 'Hardcoded secret detected' },
    { pattern: /private[_-]?key\s*[:=]\s*['"][^'"]+['"]/, message: 'Private key exposed' },
    { pattern: /\beval\s*\(/, message: 'Dangerous eval() usage' },
    { pattern: /innerHTML\s*=/, message: 'Potential XSS via innerHTML' },
    { pattern: /dangerouslySetInnerHTML/, message: 'React XSS risk with dangerouslySetInnerHTML' },
];

// Anti-slop patterns (AI-generated design mistakes)
const ANTI_SLOP_PATTERNS = [
    { pattern: /from-purple-\d+\s+to-pink-\d+/, message: 'Banned purple-to-pink gradient (AI slop)' },
    { pattern: /from-blue-\d+\s+to-purple-\d+/, message: 'Banned blue-to-purple gradient (AI slop)' },
    { pattern: /[\u{1F300}-\u{1F9FF}]/u, message: 'Emoji in production code' },
    { pattern: /font-sans(?!\s*override)/, message: 'Generic font-sans without custom font' },
    { pattern: /text-gray-[234]00(?!\s*\/\/)/, message: 'Flat gray without intent' },
    { pattern: /bg-white(?!\s*\/)/, message: 'Plain bg-white without depth' },
    { pattern: /rounded(?!-|$)/, message: 'Generic rounded without specific radius' },
];

// =============================================================================
// CONTINUOUS VERIFICATION SERVICE
// =============================================================================

export class ContinuousVerificationService extends EventEmitter {
    private config: ContinuousVerificationConfig;
    private checks: Map<VerificationCheckType, VerificationCheck> = new Map();
    private intervals: Map<VerificationCheckType, NodeJS.Timeout> = new Map();
    private feedbackChannel: StreamingFeedbackChannel;
    private running: boolean = false;
    private modifiedFiles: Set<string> = new Set();
    private fileContents: Map<string, string> = new Map();

    constructor(config: ContinuousVerificationConfig) {
        super();
        this.config = config;
        this.feedbackChannel = getStreamingFeedbackChannel();

        // Initialize checks
        const enabledChecks = config.enabledChecks || Object.keys(DEFAULT_CHECK_INTERVALS) as VerificationCheckType[];

        for (const type of enabledChecks) {
            this.checks.set(type, {
                type,
                intervalMs: config.checkIntervals?.[type] || DEFAULT_CHECK_INTERVALS[type],
                enabled: true,
            });
        }

        console.log(`[ContinuousVerification] Initialized for build ${config.buildId} with ${this.checks.size} checks`);
    }

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    /**
     * Start continuous verification
     * Creates a feedback stream and starts all check intervals
     */
    start(): void {
        if (this.running) return;
        this.running = true;

        // Create feedback stream
        this.feedbackChannel.createStream(this.config.buildId, `verifier-${this.config.buildId}`);

        // Start all enabled checks
        for (const [type, check] of this.checks) {
            if (!check.enabled) continue;

            console.log(`[ContinuousVerification] Starting ${type} check (every ${check.intervalMs}ms)`);

            // Run immediately, then on interval
            this.runCheck(type);

            const interval = setInterval(() => {
                if (this.running && this.modifiedFiles.size > 0) {
                    this.runCheck(type);
                }
            }, check.intervalMs);

            this.intervals.set(type, interval);
        }

        this.emit('started', { buildId: this.config.buildId, checks: Array.from(this.checks.keys()) });
    }

    /**
     * Stop continuous verification
     */
    stop(): void {
        if (!this.running) return;
        this.running = false;

        // Clear all intervals
        for (const [type, interval] of this.intervals) {
            clearInterval(interval);
            console.log(`[ContinuousVerification] Stopped ${type} check`);
        }
        this.intervals.clear();

        // Close feedback stream
        this.feedbackChannel.closeStream(this.config.buildId);

        this.emit('stopped', { buildId: this.config.buildId });
    }

    // =========================================================================
    // FILE TRACKING
    // =========================================================================

    /**
     * Notify that a file was modified (triggers verification)
     */
    notifyFileModified(filePath: string, content: string): void {
        this.modifiedFiles.add(filePath);
        this.fileContents.set(filePath, content);

        // Run immediate lightweight checks on this file
        this.runImmediateChecks(filePath, content);
    }

    /**
     * Notify that a file was deleted
     */
    notifyFileDeleted(filePath: string): void {
        this.modifiedFiles.delete(filePath);
        this.fileContents.delete(filePath);
    }

    /**
     * Clear modified files tracking (after successful verification)
     */
    clearModifiedFiles(): void {
        this.modifiedFiles.clear();
    }

    // =========================================================================
    // CHECK EXECUTION
    // =========================================================================

    /**
     * Run a specific check type
     */
    private async runCheck(type: VerificationCheckType): Promise<CheckResult> {
        const startTime = Date.now();
        const check = this.checks.get(type);
        if (!check) {
            return { type, issues: [], duration: 0, filesChecked: 0 };
        }

        let result: CheckResult;

        try {
            switch (type) {
                case 'placeholder':
                    result = await this.runPlaceholderCheck();
                    break;
                case 'security':
                    result = await this.runSecurityCheck();
                    break;
                case 'antiSlop':
                    result = await this.runAntiSlopCheck();
                    break;
                case 'typescript':
                    result = await this.runTypeScriptCheck();
                    break;
                case 'eslint':
                    result = await this.runESLintCheck();
                    break;
                case 'imports':
                    result = await this.runImportsCheck();
                    break;
                default:
                    result = { type, issues: [], duration: 0, filesChecked: 0 };
            }
        } catch (error) {
            console.error(`[ContinuousVerification] ${type} check error:`, error);
            result = { type, issues: [], duration: Date.now() - startTime, filesChecked: 0 };
        }

        // Update check stats
        check.lastRun = new Date();
        check.lastDuration = result.duration;

        // Stream issues to feedback channel
        for (const issue of result.issues) {
            const category = this.checkTypeToCategory(type);
            this.feedbackChannel.injectFeedback(
                this.config.buildId,
                category,
                issue.severity,
                issue.message,
                {
                    file: issue.file,
                    line: issue.line,
                    column: issue.column,
                    suggestion: issue.suggestion,
                    autoFixable: !!issue.autoFix,
                    autoFix: issue.autoFix,
                }
            );
        }

        // Emit check complete
        this.emit('check:complete', { type, result });

        if (result.issues.length > 0) {
            console.log(`[ContinuousVerification] ${type} found ${result.issues.length} issues`);
        }

        return result;
    }

    /**
     * Run immediate checks on a single file (called on file save)
     */
    private runImmediateChecks(filePath: string, content: string): void {
        // Only run lightweight pattern-based checks immediately
        const immediateChecks: ('placeholder' | 'security' | 'antiSlop')[] = ['placeholder', 'security', 'antiSlop'];

        for (const checkType of immediateChecks) {
            if (!this.checks.get(checkType)?.enabled) continue;

            const issues = this.checkFilePatterns(filePath, content, checkType);
            for (const issue of issues) {
                const category = this.checkTypeToCategory(checkType);
                this.feedbackChannel.injectFeedback(
                    this.config.buildId,
                    category,
                    issue.severity,
                    issue.message,
                    {
                        file: issue.file,
                        line: issue.line,
                        suggestion: issue.suggestion,
                        autoFix: issue.autoFix,
                    }
                );
            }
        }
    }

    // =========================================================================
    // INDIVIDUAL CHECK IMPLEMENTATIONS
    // =========================================================================

    /**
     * Check for placeholders - ZERO TOLERANCE
     */
    private async runPlaceholderCheck(): Promise<CheckResult> {
        const startTime = Date.now();
        const issues: CheckResult['issues'] = [];

        for (const [filePath, content] of this.fileContents) {
            const fileIssues = this.checkFilePatterns(filePath, content, 'placeholder');
            issues.push(...fileIssues);
        }

        return {
            type: 'placeholder',
            issues,
            duration: Date.now() - startTime,
            filesChecked: this.fileContents.size,
        };
    }

    /**
     * Check for security issues
     */
    private async runSecurityCheck(): Promise<CheckResult> {
        const startTime = Date.now();
        const issues: CheckResult['issues'] = [];

        for (const [filePath, content] of this.fileContents) {
            const fileIssues = this.checkFilePatterns(filePath, content, 'security');
            issues.push(...fileIssues);
        }

        return {
            type: 'security',
            issues,
            duration: Date.now() - startTime,
            filesChecked: this.fileContents.size,
        };
    }

    /**
     * Check for AI slop patterns
     */
    private async runAntiSlopCheck(): Promise<CheckResult> {
        const startTime = Date.now();
        const issues: CheckResult['issues'] = [];

        for (const [filePath, content] of this.fileContents) {
            // Only check style-related files
            if (!this.isStyleFile(filePath)) continue;

            const fileIssues = this.checkFilePatterns(filePath, content, 'antiSlop');
            issues.push(...fileIssues);
        }

        return {
            type: 'antiSlop',
            issues,
            duration: Date.now() - startTime,
            filesChecked: this.fileContents.size,
        };
    }

    /**
     * Run TypeScript type checking (incremental)
     * This is a lightweight version - just checks for common type errors in content
     */
    private async runTypeScriptCheck(): Promise<CheckResult> {
        const startTime = Date.now();
        const issues: CheckResult['issues'] = [];

        for (const [filePath, content] of this.fileContents) {
            if (!this.isTypeScriptFile(filePath)) continue;

            // Lightweight pattern-based checks (not full TSC)
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Check for 'any' type usage
                if (/:\s*any\b/.test(line) && !line.includes('eslint-disable')) {
                    issues.push({
                        severity: 'medium',
                        message: 'Explicit any type detected - consider using proper typing',
                        file: filePath,
                        line: i + 1,
                        suggestion: 'Replace any with a proper type or use unknown',
                    });
                }

                // Check for missing return type on functions
                if (/(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*{/.test(line) && !line.includes(':')) {
                    issues.push({
                        severity: 'low',
                        message: 'Function missing return type annotation',
                        file: filePath,
                        line: i + 1,
                        suggestion: 'Add explicit return type for better type safety',
                    });
                }

                // Check for @ts-ignore without explanation
                if (/@ts-ignore(?!\s*:)/.test(line)) {
                    issues.push({
                        severity: 'medium',
                        message: '@ts-ignore without explanation - consider fixing the type error',
                        file: filePath,
                        line: i + 1,
                        suggestion: 'Either fix the type error or add an explanation: @ts-ignore: reason',
                    });
                }
            }
        }

        return {
            type: 'typescript',
            issues,
            duration: Date.now() - startTime,
            filesChecked: this.fileContents.size,
        };
    }

    /**
     * Run ESLint checks (pattern-based lightweight version)
     */
    private async runESLintCheck(): Promise<CheckResult> {
        const startTime = Date.now();
        const issues: CheckResult['issues'] = [];

        for (const [filePath, content] of this.fileContents) {
            if (!this.isJavaScriptFile(filePath)) continue;

            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Check for console.log in production code
                if (/console\.(log|warn|error)\(/.test(line) && !filePath.includes('test') && !filePath.includes('.test.')) {
                    issues.push({
                        severity: 'low',
                        message: 'console statement detected in production code',
                        file: filePath,
                        line: i + 1,
                        suggestion: 'Remove console statements or use proper logging',
                    });
                }

                // Check for var usage (prefer const/let)
                if (/\bvar\s+\w+/.test(line)) {
                    issues.push({
                        severity: 'low',
                        message: 'Use const or let instead of var',
                        file: filePath,
                        line: i + 1,
                        suggestion: 'Replace var with const (if not reassigned) or let',
                        autoFix: {
                            description: 'Replace var with const',
                            replacement: line.replace(/\bvar\s+/, 'const '),
                        },
                    });
                }

                // Check for == instead of ===
                if (/[^=!]==[^=]/.test(line) && !line.includes('===')) {
                    issues.push({
                        severity: 'medium',
                        message: 'Use strict equality (===) instead of loose equality (==)',
                        file: filePath,
                        line: i + 1,
                        suggestion: 'Replace == with === for strict comparison',
                    });
                }
            }
        }

        return {
            type: 'eslint',
            issues,
            duration: Date.now() - startTime,
            filesChecked: this.fileContents.size,
        };
    }

    /**
     * Check for import issues
     */
    private async runImportsCheck(): Promise<CheckResult> {
        const startTime = Date.now();
        const issues: CheckResult['issues'] = [];

        for (const [filePath, content] of this.fileContents) {
            if (!this.isJavaScriptFile(filePath)) continue;

            // Track imports and their usage
            const imports = new Map<string, number>(); // importName -> line number
            const usedIdentifiers = new Set<string>();

            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Extract imports
                const importMatch = line.match(/import\s+{([^}]+)}\s+from/);
                if (importMatch) {
                    const importedNames = importMatch[1].split(',').map(s => s.trim().split(' as ')[0]);
                    for (const name of importedNames) {
                        if (name) imports.set(name, i + 1);
                    }
                }

                // Default import
                const defaultMatch = line.match(/import\s+(\w+)\s+from/);
                if (defaultMatch && defaultMatch[1] !== '{') {
                    imports.set(defaultMatch[1], i + 1);
                }

                // Track used identifiers (simple word boundary match)
                const words = line.match(/\b[A-Za-z_]\w*\b/g) || [];
                words.forEach(w => usedIdentifiers.add(w));
            }

            // Check for unused imports
            for (const [importName, lineNum] of imports) {
                // Skip if used anywhere in the file (rough check)
                let usageCount = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (i === lineNum - 1) continue; // Skip import line
                    if (new RegExp(`\\b${importName}\\b`).test(lines[i])) {
                        usageCount++;
                    }
                }

                if (usageCount === 0) {
                    issues.push({
                        severity: 'low',
                        message: `Unused import: ${importName}`,
                        file: filePath,
                        line: lineNum,
                        suggestion: `Remove unused import ${importName}`,
                    });
                }
            }
        }

        return {
            type: 'imports',
            issues,
            duration: Date.now() - startTime,
            filesChecked: this.fileContents.size,
        };
    }

    // =========================================================================
    // PATTERN CHECKING HELPERS
    // =========================================================================

    private checkFilePatterns(
        filePath: string,
        content: string,
        checkType: 'placeholder' | 'security' | 'antiSlop'
    ): CheckResult['issues'] {
        const issues: CheckResult['issues'] = [];
        const lines = content.split('\n');

        let patterns: Array<{ pattern: RegExp; message: string }>;
        let category: FeedbackSeverity;

        switch (checkType) {
            case 'placeholder':
                patterns = PLACEHOLDER_PATTERNS.map(p => ({
                    pattern: p,
                    message: `Placeholder detected: ${p.source}`,
                }));
                category = 'critical'; // ZERO TOLERANCE
                break;
            case 'security':
                patterns = SECURITY_PATTERNS;
                category = 'critical';
                break;
            case 'antiSlop':
                patterns = ANTI_SLOP_PATTERNS;
                category = 'high';
                break;
            default:
                return issues;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Skip comments for some checks
            if (checkType === 'antiSlop' && /^\s*(\/\/|\/\*|\*)/.test(line)) {
                continue;
            }

            for (const { pattern, message } of patterns) {
                if (pattern.test(line)) {
                    issues.push({
                        severity: category,
                        message,
                        file: filePath,
                        line: i + 1,
                        suggestion: this.getSuggestionForPattern(checkType, pattern),
                    });
                }
            }
        }

        return issues;
    }

    private getSuggestionForPattern(checkType: string, pattern: RegExp): string {
        switch (checkType) {
            case 'placeholder':
                return 'Remove placeholder text and implement actual functionality';
            case 'security':
                return 'Move sensitive data to environment variables';
            case 'antiSlop':
                if (pattern.source.includes('gradient')) {
                    return 'Use soul-appropriate gradients from the style guide';
                }
                if (pattern.source.includes('font')) {
                    return 'Use configured custom fonts (DM Sans, Inter, Space Mono)';
                }
                if (pattern.source.includes('gray')) {
                    return 'Use intentional color with proper contrast';
                }
                return 'Follow anti-slop design guidelines';
            default:
                return 'Fix this issue before build';
        }
    }

    // =========================================================================
    // FILE TYPE HELPERS
    // =========================================================================

    private isTypeScriptFile(filePath: string): boolean {
        return /\.(ts|tsx)$/.test(filePath);
    }

    private isJavaScriptFile(filePath: string): boolean {
        return /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(filePath);
    }

    private isStyleFile(filePath: string): boolean {
        return /\.(css|scss|sass|less|tsx|jsx)$/.test(filePath);
    }

    private checkTypeToCategory(type: VerificationCheckType): FeedbackCategory {
        switch (type) {
            case 'typescript':
            case 'eslint':
                return 'error';
            case 'placeholder':
                return 'placeholder';
            case 'security':
                return 'security';
            case 'antiSlop':
                return 'visual';
            case 'imports':
                return 'quality';
            default:
                return 'error';
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Get status of all checks
     */
    getStatus(): Record<VerificationCheckType, VerificationCheck> {
        const status: Record<string, VerificationCheck> = {};
        for (const [type, check] of this.checks) {
            status[type] = { ...check };
        }
        return status as Record<VerificationCheckType, VerificationCheck>;
    }

    /**
     * Enable/disable a specific check
     */
    setCheckEnabled(type: VerificationCheckType, enabled: boolean): void {
        const check = this.checks.get(type);
        if (check) {
            check.enabled = enabled;
            console.log(`[ContinuousVerification] ${type} check ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    /**
     * Update check interval
     */
    setCheckInterval(type: VerificationCheckType, intervalMs: number): void {
        const check = this.checks.get(type);
        if (check) {
            check.intervalMs = intervalMs;

            // Restart interval if running
            if (this.running) {
                const existingInterval = this.intervals.get(type);
                if (existingInterval) {
                    clearInterval(existingInterval);
                }

                const newInterval = setInterval(() => {
                    if (this.running && this.modifiedFiles.size > 0) {
                        this.runCheck(type);
                    }
                }, intervalMs);
                this.intervals.set(type, newInterval);
            }

            console.log(`[ContinuousVerification] ${type} interval set to ${intervalMs}ms`);
        }
    }

    /**
     * Force run all checks immediately
     */
    async runAllChecks(): Promise<Map<VerificationCheckType, CheckResult>> {
        const results = new Map<VerificationCheckType, CheckResult>();

        for (const [type] of this.checks) {
            const result = await this.runCheck(type);
            results.set(type, result);
        }

        return results;
    }

    /**
     * Get the current feedback summary
     */
    getFeedbackSummary() {
        return this.feedbackChannel.getSummary(this.config.buildId);
    }

    /**
     * Check if there are any blocking issues
     */
    hasBlockers(): boolean {
        return this.feedbackChannel.hasBlockers(this.config.buildId);
    }

    /**
     * Get all blocking issues
     */
    getBlockers() {
        return this.feedbackChannel.getBlockers(this.config.buildId);
    }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createContinuousVerification(
    config: ContinuousVerificationConfig
): ContinuousVerificationService {
    return new ContinuousVerificationService(config);
}
