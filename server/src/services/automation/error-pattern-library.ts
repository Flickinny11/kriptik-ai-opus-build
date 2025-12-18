/**
 * Error Pattern Library - Level 0 Pre-Escalation
 *
 * The problem with the current error escalation:
 * > "Each error goes through full escalation even if pattern is known"
 *
 * This service provides:
 * 1. Pattern matching BEFORE starting escalation
 * 2. Instant fixes for known error patterns
 * 3. Learning from successful fixes
 * 4. Skip escalation entirely when pattern matches
 *
 * The key insight: Why spend credits on AI analysis for an error
 * we've seen and fixed 100 times before?
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ErrorPattern {
    id: string;
    name: string;
    signature: ErrorSignature;
    fix: PatternFix;
    metadata: {
        successCount: number;
        failureCount: number;
        lastUsed: Date;
        createdAt: Date;
        updatedAt: Date;
        confidence: number;      // 0-1, based on success rate
        avgFixTimeMs: number;
    };
    category: ErrorCategory;
    enabled: boolean;
}

export interface ErrorSignature {
    // Match conditions (all must match for pattern to apply)
    messagePattern?: RegExp | string;    // Error message regex
    typePattern?: string;                 // Error type (TypeError, etc.)
    filePattern?: RegExp | string;        // File path regex
    codePattern?: RegExp | string;        // Code content regex
    stackPattern?: RegExp | string;       // Stack trace regex
    contextConditions?: ContextCondition[];
}

export interface ContextCondition {
    type: 'file_exists' | 'file_missing' | 'import_present' | 'import_missing' | 'env_var_set' | 'package_installed';
    value: string;
}

export interface PatternFix {
    type: 'replace' | 'insert' | 'delete' | 'rename' | 'add_import' | 'add_dependency' | 'multi_step';
    description: string;
    steps: FixStep[];
}

export interface FixStep {
    action: 'replace_in_file' | 'add_line' | 'remove_line' | 'create_file' | 'delete_file' | 'run_command' | 'add_import';
    target?: string;          // File path or target
    search?: string | RegExp; // What to find
    replacement?: string;      // What to replace with
    line?: number;            // Line number for insert/delete
    content?: string;         // Content for create/add
    command?: string;         // Command to run
}

export type ErrorCategory =
    | 'syntax_error'
    | 'import_missing'
    | 'type_mismatch'
    | 'undefined_variable'
    | 'dependency_missing'
    | 'config_error'
    | 'runtime_error'
    | 'build_error';

export interface PatternMatchResult {
    matched: boolean;
    patternId?: string;
    patternName?: string;
    confidence?: number;
    fix?: PatternFix;
    matchDetails?: {
        matchedConditions: string[];
        partialMatches: string[];
    };
}

export interface PatternApplicationResult {
    success: boolean;
    patternId: string;
    fixApplied: boolean;
    fixDurationMs: number;
    filesModified: string[];
    error?: string;
}

// =============================================================================
// BUILT-IN PATTERNS
// =============================================================================

const BUILT_IN_PATTERNS: Omit<ErrorPattern, 'id' | 'metadata'>[] = [
    // === IMPORT ERRORS ===
    {
        name: 'Missing React Import',
        signature: {
            messagePattern: /'React' is not defined|React must be in scope/,
            filePattern: /\.(tsx|jsx)$/,
        },
        fix: {
            type: 'add_import',
            description: 'Add React import to file',
            steps: [{
                action: 'add_import',
                content: "import React from 'react';",
            }],
        },
        category: 'import_missing',
        enabled: true,
    },
    {
        name: 'Missing useState Import',
        signature: {
            messagePattern: /'useState' is not defined|useState is not a function/,
            filePattern: /\.(tsx|jsx)$/,
        },
        fix: {
            type: 'add_import',
            description: 'Add useState import from React',
            steps: [{
                action: 'add_import',
                content: "import { useState } from 'react';",
            }],
        },
        category: 'import_missing',
        enabled: true,
    },
    {
        name: 'Missing useEffect Import',
        signature: {
            messagePattern: /'useEffect' is not defined|useEffect is not a function/,
            filePattern: /\.(tsx|jsx)$/,
        },
        fix: {
            type: 'add_import',
            description: 'Add useEffect import from React',
            steps: [{
                action: 'add_import',
                content: "import { useEffect } from 'react';",
            }],
        },
        category: 'import_missing',
        enabled: true,
    },

    // === TYPE ERRORS ===
    {
        name: 'Missing Type for Props',
        signature: {
            messagePattern: /Binding element '(\w+)' implicitly has an 'any' type/,
            filePattern: /\.(tsx|ts)$/,
        },
        fix: {
            type: 'insert',
            description: 'Add type annotation for props',
            steps: [{
                action: 'add_line',
                content: '// Add proper interface for props',
            }],
        },
        category: 'type_mismatch',
        enabled: true,
    },
    {
        name: 'Object Possibly Undefined',
        signature: {
            messagePattern: /Object is possibly 'undefined'|Cannot read propert(y|ies) of undefined/,
        },
        fix: {
            type: 'replace',
            description: 'Add optional chaining',
            steps: [{
                action: 'replace_in_file',
                search: /(\w+)\.(\w+)/,
                replacement: '$1?.$2',
            }],
        },
        category: 'runtime_error',
        enabled: true,
    },

    // === SYNTAX ERRORS ===
    {
        name: 'Missing Semicolon',
        signature: {
            messagePattern: /Missing semicolon|Expected ';'/,
        },
        fix: {
            type: 'insert',
            description: 'Add missing semicolon',
            steps: [{
                action: 'add_line',
                content: ';',
            }],
        },
        category: 'syntax_error',
        enabled: true,
    },
    {
        name: 'Unexpected Token',
        signature: {
            messagePattern: /Unexpected token '(\w+)'|Unexpected identifier/,
        },
        fix: {
            type: 'replace',
            description: 'Fix syntax around unexpected token',
            steps: [{
                action: 'replace_in_file',
                search: /(\{)\s*\n\s*(\{)/,
                replacement: '$1',
            }],
        },
        category: 'syntax_error',
        enabled: true,
    },

    // === BUILD ERRORS ===
    {
        name: 'Module Not Found',
        signature: {
            messagePattern: /Module not found: Error: Can't resolve '([^']+)'/,
        },
        fix: {
            type: 'add_dependency',
            description: 'Install missing module',
            steps: [{
                action: 'run_command',
                command: 'npm install $1',
            }],
        },
        category: 'dependency_missing',
        enabled: true,
    },
    {
        name: 'Cannot Find Module Types',
        signature: {
            messagePattern: /Cannot find module '([^']+)' or its corresponding type declarations/,
        },
        fix: {
            type: 'add_dependency',
            description: 'Install type definitions',
            steps: [{
                action: 'run_command',
                command: 'npm install -D @types/$1',
            }],
        },
        category: 'dependency_missing',
        enabled: true,
    },

    // === CONFIG ERRORS ===
    {
        name: 'Missing Environment Variable',
        signature: {
            messagePattern: /Environment variable '(\w+)' is not set|process\.env\.(\w+) is undefined/,
        },
        fix: {
            type: 'insert',
            description: 'Add environment variable to .env',
            steps: [{
                action: 'add_line',
                target: '.env',
                content: '$1=YOUR_VALUE_HERE',
            }],
        },
        category: 'config_error',
        enabled: true,
    },

    // === REACT-SPECIFIC ===
    {
        name: 'React Key Prop Missing',
        signature: {
            messagePattern: /Each child in a list should have a unique "key" prop/,
            filePattern: /\.(tsx|jsx)$/,
        },
        fix: {
            type: 'replace',
            description: 'Add key prop to list items',
            steps: [{
                action: 'replace_in_file',
                search: /\.map\(\((\w+)(?:,\s*(\w+))?\)\s*=>\s*\(/,
                replacement: '.map(($1, index) => (<div key={$1.id || index}>',
            }],
        },
        category: 'runtime_error',
        enabled: true,
    },
    {
        name: 'Invalid Hook Call',
        signature: {
            messagePattern: /Invalid hook call|Hooks can only be called inside/,
            filePattern: /\.(tsx|jsx|ts|js)$/,
        },
        fix: {
            type: 'multi_step',
            description: 'Move hook call inside component or custom hook',
            steps: [{
                action: 'add_line',
                content: '// Ensure this hook is called inside a React component or custom hook',
            }],
        },
        category: 'runtime_error',
        enabled: true,
    },

    // === TAILWIND CSS ===
    {
        name: 'Unknown Tailwind Class',
        signature: {
            messagePattern: /The `([^`]+)` class does not exist/,
            filePattern: /\.(tsx|jsx|css)$/,
        },
        fix: {
            type: 'replace',
            description: 'Replace invalid Tailwind class',
            steps: [{
                action: 'replace_in_file',
                search: /class(Name)?="[^"]*\$1[^"]*"/,
                replacement: 'className=""',
            }],
        },
        category: 'build_error',
        enabled: true,
    },

    // === TYPESCRIPT-SPECIFIC ===
    {
        name: 'Property Does Not Exist',
        signature: {
            messagePattern: /Property '(\w+)' does not exist on type/,
            filePattern: /\.(tsx|ts)$/,
        },
        fix: {
            type: 'multi_step',
            description: 'Add property to type or use type assertion',
            steps: [{
                action: 'add_line',
                content: '// Add property to interface or use (object as any).property',
            }],
        },
        category: 'type_mismatch',
        enabled: true,
    },
    {
        name: 'Type Not Assignable',
        signature: {
            messagePattern: /Type '([^']+)' is not assignable to type '([^']+)'/,
            filePattern: /\.(tsx|ts)$/,
        },
        fix: {
            type: 'replace',
            description: 'Fix type mismatch',
            steps: [{
                action: 'replace_in_file',
                search: /: \w+/,
                replacement: ': $2',
            }],
        },
        category: 'type_mismatch',
        enabled: true,
    },
];

// =============================================================================
// ERROR PATTERN LIBRARY SERVICE
// =============================================================================

export class ErrorPatternLibraryService extends EventEmitter {
    private patterns: Map<string, ErrorPattern> = new Map();
    private patternsByCategory: Map<ErrorCategory, string[]> = new Map();
    private recentMatches: Array<{ patternId: string; timestamp: Date; success: boolean }> = [];

    constructor() {
        super();
        this.loadBuiltInPatterns();
    }

    /**
     * Load built-in patterns
     */
    private loadBuiltInPatterns(): void {
        for (const pattern of BUILT_IN_PATTERNS) {
            const fullPattern: ErrorPattern = {
                ...pattern,
                id: uuidv4(),
                metadata: {
                    successCount: 0,
                    failureCount: 0,
                    lastUsed: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    confidence: 0.9, // High confidence for built-in patterns
                    avgFixTimeMs: 100,
                },
            };

            this.addPattern(fullPattern);
        }

        console.log(`[PatternLibrary] Loaded ${this.patterns.size} built-in patterns`);
    }

    // =========================================================================
    // PATTERN MANAGEMENT
    // =========================================================================

    /**
     * Add a pattern to the library
     */
    addPattern(pattern: ErrorPattern): void {
        this.patterns.set(pattern.id, pattern);

        // Index by category
        const categoryPatterns = this.patternsByCategory.get(pattern.category) || [];
        categoryPatterns.push(pattern.id);
        this.patternsByCategory.set(pattern.category, categoryPatterns);

        this.emit('pattern:added', { patternId: pattern.id, name: pattern.name });
    }

    /**
     * Remove a pattern
     */
    removePattern(patternId: string): boolean {
        const pattern = this.patterns.get(patternId);
        if (!pattern) return false;

        this.patterns.delete(patternId);

        // Remove from category index
        const categoryPatterns = this.patternsByCategory.get(pattern.category);
        if (categoryPatterns) {
            const index = categoryPatterns.indexOf(patternId);
            if (index >= 0) {
                categoryPatterns.splice(index, 1);
            }
        }

        this.emit('pattern:removed', { patternId });
        return true;
    }

    /**
     * Get a pattern by ID
     */
    getPattern(patternId: string): ErrorPattern | null {
        return this.patterns.get(patternId) || null;
    }

    /**
     * Get all patterns
     */
    getAllPatterns(): ErrorPattern[] {
        return Array.from(this.patterns.values());
    }

    /**
     * Get patterns by category
     */
    getPatternsByCategory(category: ErrorCategory): ErrorPattern[] {
        const patternIds = this.patternsByCategory.get(category) || [];
        return patternIds
            .map(id => this.patterns.get(id))
            .filter((p): p is ErrorPattern => p !== undefined);
    }

    // =========================================================================
    // PATTERN MATCHING - THE CORE FEATURE
    // =========================================================================

    /**
     * Try to match an error against all patterns
     * This is called BEFORE escalation to potentially skip it entirely
     */
    match(
        errorMessage: string,
        errorType?: string,
        filePath?: string,
        codeContext?: string,
        stackTrace?: string
    ): PatternMatchResult {
        const matchedConditions: string[] = [];
        const partialMatches: string[] = [];

        // Score each pattern
        const scores: Array<{ pattern: ErrorPattern; score: number; conditions: string[] }> = [];

        for (const pattern of this.patterns.values()) {
            if (!pattern.enabled) continue;

            const { score, conditions } = this.scorePattern(
                pattern,
                errorMessage,
                errorType,
                filePath,
                codeContext,
                stackTrace
            );

            if (score > 0) {
                scores.push({ pattern, score, conditions });
            }
        }

        // Sort by score descending
        scores.sort((a, b) => b.score - a.score);

        // Best match
        const best = scores[0];

        if (best && best.score >= 0.5) {
            // Good enough match
            const confidence = best.score * best.pattern.metadata.confidence;

            console.log(`[PatternLibrary] Matched pattern "${best.pattern.name}" with confidence ${(confidence * 100).toFixed(1)}%`);

            return {
                matched: true,
                patternId: best.pattern.id,
                patternName: best.pattern.name,
                confidence,
                fix: best.pattern.fix,
                matchDetails: {
                    matchedConditions: best.conditions,
                    partialMatches: scores.slice(1, 4).map(s => s.pattern.name),
                },
            };
        }

        // No match
        return {
            matched: false,
            matchDetails: {
                matchedConditions: [],
                partialMatches: scores.slice(0, 3).map(s => `${s.pattern.name} (${(s.score * 100).toFixed(0)}%)`),
            },
        };
    }

    /**
     * Score how well a pattern matches the error
     */
    private scorePattern(
        pattern: ErrorPattern,
        errorMessage: string,
        errorType?: string,
        filePath?: string,
        codeContext?: string,
        stackTrace?: string
    ): { score: number; conditions: string[] } {
        let totalWeight = 0;
        let matchedWeight = 0;
        const conditions: string[] = [];

        const sig = pattern.signature;

        // Message pattern (most important)
        if (sig.messagePattern) {
            totalWeight += 0.4;
            const regex = typeof sig.messagePattern === 'string'
                ? new RegExp(sig.messagePattern)
                : sig.messagePattern;
            if (regex.test(errorMessage)) {
                matchedWeight += 0.4;
                conditions.push('message');
            }
        }

        // Error type
        if (sig.typePattern && errorType) {
            totalWeight += 0.2;
            if (errorType.toLowerCase().includes(sig.typePattern.toLowerCase())) {
                matchedWeight += 0.2;
                conditions.push('type');
            }
        }

        // File pattern
        if (sig.filePattern && filePath) {
            totalWeight += 0.2;
            const regex = typeof sig.filePattern === 'string'
                ? new RegExp(sig.filePattern)
                : sig.filePattern;
            if (regex.test(filePath)) {
                matchedWeight += 0.2;
                conditions.push('file');
            }
        }

        // Code pattern
        if (sig.codePattern && codeContext) {
            totalWeight += 0.1;
            const regex = typeof sig.codePattern === 'string'
                ? new RegExp(sig.codePattern)
                : sig.codePattern;
            if (regex.test(codeContext)) {
                matchedWeight += 0.1;
                conditions.push('code');
            }
        }

        // Stack pattern
        if (sig.stackPattern && stackTrace) {
            totalWeight += 0.1;
            const regex = typeof sig.stackPattern === 'string'
                ? new RegExp(sig.stackPattern)
                : sig.stackPattern;
            if (regex.test(stackTrace)) {
                matchedWeight += 0.1;
                conditions.push('stack');
            }
        }

        const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;
        return { score, conditions };
    }

    // =========================================================================
    // FIX APPLICATION
    // =========================================================================

    /**
     * Apply a pattern fix to the codebase
     */
    async applyFix(
        patternId: string,
        files: Map<string, string>,
        errorContext: {
            file?: string;
            line?: number;
            errorMessage: string;
        }
    ): Promise<PatternApplicationResult> {
        const startTime = Date.now();
        const pattern = this.patterns.get(patternId);

        if (!pattern) {
            return {
                success: false,
                patternId,
                fixApplied: false,
                fixDurationMs: 0,
                filesModified: [],
                error: `Pattern ${patternId} not found`,
            };
        }

        const filesModified: string[] = [];

        try {
            for (const step of pattern.fix.steps) {
                const result = await this.executeFixStep(step, files, errorContext);
                if (result.fileModified) {
                    filesModified.push(result.fileModified);
                }
            }

            // Update pattern metadata
            pattern.metadata.successCount++;
            pattern.metadata.lastUsed = new Date();
            pattern.metadata.avgFixTimeMs = (
                pattern.metadata.avgFixTimeMs * (pattern.metadata.successCount - 1) +
                (Date.now() - startTime)
            ) / pattern.metadata.successCount;
            pattern.metadata.confidence = pattern.metadata.successCount / (
                pattern.metadata.successCount + pattern.metadata.failureCount + 1
            );

            this.recentMatches.push({ patternId, timestamp: new Date(), success: true });

            console.log(`[PatternLibrary] Applied fix "${pattern.name}" in ${Date.now() - startTime}ms`);

            this.emit('fix:applied', {
                patternId,
                patternName: pattern.name,
                filesModified,
                durationMs: Date.now() - startTime,
            });

            return {
                success: true,
                patternId,
                fixApplied: true,
                fixDurationMs: Date.now() - startTime,
                filesModified,
            };
        } catch (error) {
            pattern.metadata.failureCount++;
            pattern.metadata.confidence = pattern.metadata.successCount / (
                pattern.metadata.successCount + pattern.metadata.failureCount + 1
            );

            this.recentMatches.push({ patternId, timestamp: new Date(), success: false });

            console.error(`[PatternLibrary] Fix "${pattern.name}" failed:`, error);

            return {
                success: false,
                patternId,
                fixApplied: false,
                fixDurationMs: Date.now() - startTime,
                filesModified,
                error: (error as Error).message,
            };
        }
    }

    /**
     * Execute a single fix step
     */
    private async executeFixStep(
        step: FixStep,
        files: Map<string, string>,
        context: { file?: string; line?: number; errorMessage: string }
    ): Promise<{ fileModified?: string }> {
        const targetFile = step.target || context.file;

        switch (step.action) {
            case 'replace_in_file': {
                if (!targetFile || !step.search || step.replacement === undefined) {
                    throw new Error('replace_in_file requires target, search, and replacement');
                }
                const content = files.get(targetFile);
                if (!content) {
                    throw new Error(`File ${targetFile} not found`);
                }
                const regex = typeof step.search === 'string' ? new RegExp(step.search, 'g') : step.search;
                const newContent = content.replace(regex, step.replacement);
                files.set(targetFile, newContent);
                return { fileModified: targetFile };
            }

            case 'add_line': {
                if (!targetFile || !step.content) {
                    throw new Error('add_line requires target and content');
                }
                const content = files.get(targetFile) || '';
                const lineNum = step.line || 0;
                const lines = content.split('\n');
                lines.splice(lineNum, 0, step.content);
                files.set(targetFile, lines.join('\n'));
                return { fileModified: targetFile };
            }

            case 'remove_line': {
                if (!targetFile || step.line === undefined) {
                    throw new Error('remove_line requires target and line');
                }
                const content = files.get(targetFile);
                if (!content) {
                    throw new Error(`File ${targetFile} not found`);
                }
                const lines = content.split('\n');
                if (step.line >= 0 && step.line < lines.length) {
                    lines.splice(step.line, 1);
                }
                files.set(targetFile, lines.join('\n'));
                return { fileModified: targetFile };
            }

            case 'add_import': {
                if (!targetFile || !step.content) {
                    throw new Error('add_import requires target and content');
                }
                const content = files.get(targetFile) || '';

                // Check if import already exists
                if (content.includes(step.content)) {
                    return {}; // Already present
                }

                // Find last import line
                const lines = content.split('\n');
                let lastImportIndex = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('import ')) {
                        lastImportIndex = i;
                    }
                }

                // Insert after last import or at top
                const insertIndex = lastImportIndex >= 0 ? lastImportIndex + 1 : 0;
                lines.splice(insertIndex, 0, step.content);
                files.set(targetFile, lines.join('\n'));
                return { fileModified: targetFile };
            }

            case 'create_file': {
                if (!step.target || !step.content) {
                    throw new Error('create_file requires target and content');
                }
                files.set(step.target, step.content);
                return { fileModified: step.target };
            }

            case 'delete_file': {
                if (!step.target) {
                    throw new Error('delete_file requires target');
                }
                files.delete(step.target);
                return { fileModified: step.target };
            }

            case 'run_command': {
                // Commands would be executed via the sandbox
                // For now, just log
                console.log(`[PatternLibrary] Would run command: ${step.command}`);
                return {};
            }

            default:
                throw new Error(`Unknown fix action: ${step.action}`);
        }
    }

    // =========================================================================
    // LEARNING
    // =========================================================================

    /**
     * Learn a new pattern from a successful fix
     */
    learnPattern(
        errorMessage: string,
        errorType: string,
        fix: PatternFix,
        context: {
            file?: string;
            codeSnippet?: string;
        }
    ): ErrorPattern {
        // Generate signature from error
        const signature: ErrorSignature = {
            messagePattern: this.generateMessagePattern(errorMessage),
            typePattern: errorType,
        };

        if (context.file) {
            signature.filePattern = this.generateFilePattern(context.file);
        }

        const pattern: ErrorPattern = {
            id: uuidv4(),
            name: `Learned: ${errorMessage.substring(0, 50)}...`,
            signature,
            fix,
            metadata: {
                successCount: 1,
                failureCount: 0,
                lastUsed: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                confidence: 0.7, // Start with moderate confidence
                avgFixTimeMs: 100,
            },
            category: this.categorizeError(errorMessage, errorType),
            enabled: true,
        };

        this.addPattern(pattern);

        console.log(`[PatternLibrary] Learned new pattern: ${pattern.name}`);
        this.emit('pattern:learned', { patternId: pattern.id, name: pattern.name });

        return pattern;
    }

    /**
     * Generate a message pattern from an error message
     */
    private generateMessagePattern(message: string): RegExp {
        // Replace specific values with wildcards
        let pattern = message
            .replace(/'/g, "'")
            .replace(/"/g, '"')
            // Replace specific identifiers with wildcards
            .replace(/'\w+'/g, "'(\\w+)'")
            .replace(/"\w+"/g, '"(\\w+)"')
            // Replace line/column numbers
            .replace(/line \d+/g, 'line \\d+')
            .replace(/column \d+/g, 'column \\d+')
            // Escape special regex chars
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        return new RegExp(pattern);
    }

    /**
     * Generate a file pattern from a file path
     */
    private generateFilePattern(filePath: string): RegExp {
        const ext = filePath.match(/\.\w+$/)?.[0] || '';
        return new RegExp(`\\${ext}$`);
    }

    /**
     * Categorize an error based on message and type
     */
    private categorizeError(message: string, type: string): ErrorCategory {
        const lowerMsg = message.toLowerCase();
        const lowerType = type.toLowerCase();

        if (lowerMsg.includes('import') || lowerMsg.includes("can't resolve") || lowerMsg.includes('cannot find module')) {
            return 'import_missing';
        }
        if (lowerMsg.includes('syntax') || lowerMsg.includes('unexpected token')) {
            return 'syntax_error';
        }
        if (lowerType.includes('typeerror') || lowerMsg.includes('is not assignable')) {
            return 'type_mismatch';
        }
        if (lowerMsg.includes('undefined') || lowerMsg.includes('is not defined')) {
            return 'undefined_variable';
        }
        if (lowerMsg.includes('dependency') || lowerMsg.includes('package')) {
            return 'dependency_missing';
        }
        if (lowerMsg.includes('config') || lowerMsg.includes('environment')) {
            return 'config_error';
        }
        if (lowerMsg.includes('build') || lowerMsg.includes('compile')) {
            return 'build_error';
        }

        return 'runtime_error';
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    /**
     * Get library statistics
     */
    getStats(): {
        totalPatterns: number;
        enabledPatterns: number;
        byCategory: Record<ErrorCategory, number>;
        recentMatchRate: number;
        avgConfidence: number;
    } {
        const patterns = Array.from(this.patterns.values());
        const enabled = patterns.filter(p => p.enabled);

        const byCategory: Record<ErrorCategory, number> = {
            syntax_error: 0,
            import_missing: 0,
            type_mismatch: 0,
            undefined_variable: 0,
            dependency_missing: 0,
            config_error: 0,
            runtime_error: 0,
            build_error: 0,
        };

        for (const pattern of patterns) {
            byCategory[pattern.category]++;
        }

        const recentSuccesses = this.recentMatches
            .filter(m => m.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000)
            .filter(m => m.success).length;
        const recentTotal = this.recentMatches
            .filter(m => m.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000).length;

        const avgConfidence = enabled.length > 0
            ? enabled.reduce((sum, p) => sum + p.metadata.confidence, 0) / enabled.length
            : 0;

        return {
            totalPatterns: patterns.length,
            enabledPatterns: enabled.length,
            byCategory,
            recentMatchRate: recentTotal > 0 ? recentSuccesses / recentTotal : 0,
            avgConfidence,
        };
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let patternLibrary: ErrorPatternLibraryService | null = null;

export function getErrorPatternLibrary(): ErrorPatternLibraryService {
    if (!patternLibrary) {
        patternLibrary = new ErrorPatternLibraryService();
    }
    return patternLibrary;
}

export function createErrorPatternLibrary(): ErrorPatternLibraryService {
    return new ErrorPatternLibraryService();
}
