/**
 * Code Quality Agent
 *
 * AI-powered code quality analysis.
 * NON-BLOCKING agent - provides suggestions without halting build.
 *
 * Checks:
 * - Code complexity (cyclomatic complexity)
 * - DRY violations (duplicate code)
 * - Code smells (long functions, deep nesting)
 * - Best practices (naming, patterns)
 * - Architecture consistency
 *
 * Part of Phase 4: 6-Agent Verification Swarm
 */

import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type QualityIssueType =
    | 'complexity'
    | 'duplication'
    | 'smell'
    | 'naming'
    | 'pattern'
    | 'architecture'
    | 'performance'
    | 'maintainability';

export type QualityIssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export interface QualityIssue {
    id: string;
    type: QualityIssueType;
    severity: QualityIssueSeverity;
    title: string;
    description: string;
    file: string;
    line?: number;
    endLine?: number;
    suggestion?: string;
    codeSnippet?: string;
}

export interface QualityMetrics {
    overallScore: number;           // 0-100
    complexityScore: number;        // 0-100
    duplicationScore: number;       // 0-100
    maintainabilityScore: number;   // 0-100
    readabilityScore: number;       // 0-100
}

export interface CodeQualityResult {
    timestamp: Date;
    passed: boolean;
    metrics: QualityMetrics;
    issues: QualityIssue[];
    summary: string;
    recommendations: string[];
}

export interface CodeQualityConfig {
    minOverallScore: number;
    maxComplexityPerFunction: number;
    maxFunctionLength: number;
    maxNestingDepth: number;
    maxFileLength: number;
    minDuplicationScore: number;
    enableAIAnalysis: boolean;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: CodeQualityConfig = {
    minOverallScore: 70,
    maxComplexityPerFunction: 10,
    maxFunctionLength: 50,
    maxNestingDepth: 4,
    maxFileLength: 300,
    minDuplicationScore: 80,
    enableAIAnalysis: true,
};

// ============================================================================
// CODE QUALITY AGENT
// ============================================================================

export class CodeQualityAgent extends EventEmitter {
    private projectId: string;
    private userId: string;
    private config: CodeQualityConfig;
    private claudeService: ReturnType<typeof createClaudeService>;
    private lastResult?: CodeQualityResult;

    constructor(
        projectId: string,
        userId: string,
        config?: Partial<CodeQualityConfig>
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
     * Run comprehensive code quality analysis
     */
    async analyze(files: Map<string, string>): Promise<CodeQualityResult> {
        const startTime = Date.now();
        const issues: QualityIssue[] = [];

        // Filter to code files only
        const codeFiles = new Map(
            Array.from(files.entries()).filter(([path]) => this.isCodeFile(path))
        );

        console.log(`[CodeQuality] Analyzing ${codeFiles.size} files...`);

        // Run static analysis
        for (const [filePath, content] of codeFiles.entries()) {
            const fileIssues = this.analyzeFile(filePath, content);
            issues.push(...fileIssues);
        }

        // Calculate metrics
        const metrics = this.calculateMetrics(codeFiles, issues);

        // Run AI-powered analysis if enabled
        let aiRecommendations: string[] = [];
        if (this.config.enableAIAnalysis) {
            aiRecommendations = await this.runAIAnalysis(codeFiles, issues);
        }

        const result: CodeQualityResult = {
            timestamp: new Date(),
            passed: metrics.overallScore >= this.config.minOverallScore,
            metrics,
            issues,
            summary: this.generateSummary(metrics, issues),
            recommendations: aiRecommendations,
        };

        this.lastResult = result;
        this.emit('analysis_complete', result);

        console.log(`[CodeQuality] Analysis complete: Score ${metrics.overallScore}/100 (${Date.now() - startTime}ms)`);

        return result;
    }

    /**
     * Get last analysis result
     */
    getLastResult(): CodeQualityResult | undefined {
        return this.lastResult;
    }

    // ==========================================================================
    // STATIC ANALYSIS METHODS
    // ==========================================================================

    private isCodeFile(path: string): boolean {
        return /\.(ts|tsx|js|jsx|mjs|vue|svelte)$/i.test(path);
    }

    private analyzeFile(filePath: string, content: string): QualityIssue[] {
        const issues: QualityIssue[] = [];
        const lines = content.split('\n');

        // Check file length
        if (lines.length > this.config.maxFileLength) {
            issues.push({
                id: uuidv4(),
                type: 'maintainability',
                severity: 'major',
                title: 'File too long',
                description: `File has ${lines.length} lines, exceeding maximum of ${this.config.maxFileLength}`,
                file: filePath,
                suggestion: 'Consider splitting into smaller, focused modules',
            });
        }

        // Analyze functions
        issues.push(...this.analyzeFunctions(filePath, content, lines));

        // Check for code smells
        issues.push(...this.checkCodeSmells(filePath, content, lines));

        // Check naming conventions
        issues.push(...this.checkNaming(filePath, content));

        // Check for duplication patterns
        issues.push(...this.checkDuplication(filePath, content, lines));

        return issues;
    }

    private analyzeFunctions(
        filePath: string,
        content: string,
        lines: string[]
    ): QualityIssue[] {
        const issues: QualityIssue[] = [];

        // Find function declarations (simple pattern matching)
        const functionPatterns = [
            /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=])\s*=>)/g,
            /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/g,
        ];

        // Track function positions
        const functions: { name: string; startLine: number; endLine: number; content: string }[] = [];

        // Simplified function detection by counting braces
        let braceCount = 0;
        let inFunction = false;
        let functionStart = 0;
        let currentFunction = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for function start
            const funcMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/);
            if (funcMatch && !inFunction) {
                inFunction = true;
                functionStart = i;
                currentFunction = funcMatch[1] || funcMatch[2] || 'anonymous';
                braceCount = 0;
            }

            // Count braces
            for (const char of line) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }

            // Check for function end
            if (inFunction && braceCount <= 0 && line.includes('}')) {
                functions.push({
                    name: currentFunction,
                    startLine: functionStart,
                    endLine: i,
                    content: lines.slice(functionStart, i + 1).join('\n'),
                });
                inFunction = false;
            }
        }

        // Analyze each function
        for (const func of functions) {
            const functionLength = func.endLine - func.startLine + 1;

            // Check function length
            if (functionLength > this.config.maxFunctionLength) {
                issues.push({
                    id: uuidv4(),
                    type: 'complexity',
                    severity: 'major',
                    title: 'Function too long',
                    description: `Function '${func.name}' has ${functionLength} lines, exceeding maximum of ${this.config.maxFunctionLength}`,
                    file: filePath,
                    line: func.startLine + 1,
                    endLine: func.endLine + 1,
                    suggestion: 'Extract logic into smaller, well-named helper functions',
                });
            }

            // Check cyclomatic complexity (simplified)
            const complexity = this.calculateComplexity(func.content);
            if (complexity > this.config.maxComplexityPerFunction) {
                issues.push({
                    id: uuidv4(),
                    type: 'complexity',
                    severity: 'critical',
                    title: 'High cyclomatic complexity',
                    description: `Function '${func.name}' has complexity of ${complexity}, exceeding maximum of ${this.config.maxComplexityPerFunction}`,
                    file: filePath,
                    line: func.startLine + 1,
                    suggestion: 'Reduce branching by extracting conditions or using early returns',
                });
            }

            // Check nesting depth
            const maxNesting = this.calculateNestingDepth(func.content);
            if (maxNesting > this.config.maxNestingDepth) {
                issues.push({
                    id: uuidv4(),
                    type: 'smell',
                    severity: 'major',
                    title: 'Excessive nesting',
                    description: `Function '${func.name}' has nesting depth of ${maxNesting}, exceeding maximum of ${this.config.maxNestingDepth}`,
                    file: filePath,
                    line: func.startLine + 1,
                    suggestion: 'Use guard clauses, early returns, or extract nested logic',
                });
            }
        }

        return issues;
    }

    private calculateComplexity(code: string): number {
        // Simplified cyclomatic complexity calculation
        // Count decision points: if, else, for, while, case, &&, ||, ?:
        const patterns = [
            /\bif\b/g,
            /\belse\b/g,
            /\bfor\b/g,
            /\bwhile\b/g,
            /\bcase\b/g,
            /\bcatch\b/g,
            /&&/g,
            /\|\|/g,
            /\?[^?]/g,  // Ternary operator (exclude ??)
        ];

        let complexity = 1; // Base complexity
        for (const pattern of patterns) {
            const matches = code.match(pattern);
            if (matches) complexity += matches.length;
        }

        return complexity;
    }

    private calculateNestingDepth(code: string): number {
        let maxDepth = 0;
        let currentDepth = 0;

        // Track nesting through braces (simplified)
        for (const char of code) {
            if (char === '{') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (char === '}') {
                currentDepth = Math.max(0, currentDepth - 1);
            }
        }

        return maxDepth;
    }

    private checkCodeSmells(
        filePath: string,
        content: string,
        lines: string[]
    ): QualityIssue[] {
        const issues: QualityIssue[] = [];

        // Check for console.log statements
        lines.forEach((line, index) => {
            if (/console\.(log|debug|info|warn|error)\(/.test(line) && !line.includes('//')) {
                issues.push({
                    id: uuidv4(),
                    type: 'smell',
                    severity: 'minor',
                    title: 'Console statement detected',
                    description: 'Console statements should be removed in production code',
                    file: filePath,
                    line: index + 1,
                    codeSnippet: line.trim(),
                    suggestion: 'Use a proper logging service or remove',
                });
            }
        });

        // Check for TODO/FIXME comments
        lines.forEach((line, index) => {
            if (/\/\/\s*(TODO|FIXME|HACK|XXX):/i.test(line)) {
                issues.push({
                    id: uuidv4(),
                    type: 'smell',
                    severity: 'suggestion',
                    title: 'Technical debt marker',
                    description: 'Found TODO/FIXME comment that should be addressed',
                    file: filePath,
                    line: index + 1,
                    codeSnippet: line.trim(),
                });
            }
        });

        // Check for magic numbers
        const magicNumberPattern = /[^a-zA-Z0-9_]\d{2,}[^a-zA-Z0-9_\.]/g;
        lines.forEach((line, index) => {
            // Skip imports, comments, and obvious constants
            if (line.includes('import') || line.trim().startsWith('//') || line.includes('const')) return;

            const matches = line.match(magicNumberPattern);
            if (matches && matches.length > 0) {
                issues.push({
                    id: uuidv4(),
                    type: 'smell',
                    severity: 'minor',
                    title: 'Magic number detected',
                    description: 'Consider extracting magic numbers to named constants',
                    file: filePath,
                    line: index + 1,
                    codeSnippet: line.trim(),
                    suggestion: 'Create a named constant for better readability',
                });
            }
        });

        // Check for any type usage in TypeScript
        if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
            lines.forEach((line, index) => {
                if (/:\s*any\b/.test(line)) {
                    issues.push({
                        id: uuidv4(),
                        type: 'smell',
                        severity: 'major',
                        title: 'Any type usage',
                        description: 'Using "any" type defeats TypeScript\'s type safety',
                        file: filePath,
                        line: index + 1,
                        codeSnippet: line.trim(),
                        suggestion: 'Define a proper type or use "unknown" with type guards',
                    });
                }
            });
        }

        return issues;
    }

    private checkNaming(filePath: string, content: string): QualityIssue[] {
        const issues: QualityIssue[] = [];
        const lines = content.split('\n');

        // Check for single-letter variable names (except loop counters)
        const singleLetterPattern = /(?:const|let|var)\s+([a-z])\s*[=:]/g;
        let match;

        lines.forEach((line, index) => {
            // Skip loop declarations
            if (line.includes('for (') || line.includes('for(')) return;

            while ((match = singleLetterPattern.exec(line)) !== null) {
                if (!['i', 'j', 'k', 'x', 'y', 'e'].includes(match[1])) {
                    issues.push({
                        id: uuidv4(),
                        type: 'naming',
                        severity: 'minor',
                        title: 'Poor variable naming',
                        description: `Single-letter variable name '${match[1]}' is not descriptive`,
                        file: filePath,
                        line: index + 1,
                        suggestion: 'Use descriptive names that indicate purpose',
                    });
                }
            }
        });

        // Check for inconsistent naming (e.g., mixing camelCase and snake_case)
        const camelCase = content.match(/[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*/g);
        const snakeCase = content.match(/[a-z]+_[a-z]+/g);

        if (camelCase && camelCase.length > 5 && snakeCase && snakeCase.length > 5) {
            issues.push({
                id: uuidv4(),
                type: 'naming',
                severity: 'minor',
                title: 'Inconsistent naming convention',
                description: 'File mixes camelCase and snake_case naming styles',
                file: filePath,
                suggestion: 'Stick to one naming convention throughout the codebase',
            });
        }

        return issues;
    }

    private checkDuplication(
        filePath: string,
        content: string,
        lines: string[]
    ): QualityIssue[] {
        const issues: QualityIssue[] = [];

        // Find duplicate blocks of code (3+ lines)
        const blockSize = 3;
        const seenBlocks = new Map<string, number>();

        for (let i = 0; i < lines.length - blockSize; i++) {
            const block = lines
                .slice(i, i + blockSize)
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('//'))
                .join('\n');

            if (block.length < 50) continue; // Skip short blocks

            const existingLine = seenBlocks.get(block);
            if (existingLine !== undefined) {
                issues.push({
                    id: uuidv4(),
                    type: 'duplication',
                    severity: 'major',
                    title: 'Duplicate code block',
                    description: `Lines ${i + 1}-${i + blockSize} appear to duplicate lines ${existingLine + 1}-${existingLine + blockSize}`,
                    file: filePath,
                    line: i + 1,
                    endLine: i + blockSize,
                    suggestion: 'Extract duplicate code into a reusable function',
                });
            } else {
                seenBlocks.set(block, i);
            }
        }

        return issues;
    }

    // ==========================================================================
    // AI ANALYSIS
    // ==========================================================================

    private async runAIAnalysis(
        files: Map<string, string>,
        issues: QualityIssue[]
    ): Promise<string[]> {
        // Only analyze if there are issues or we want comprehensive feedback
        if (files.size === 0) return [];

        // Prepare code summary (limit to avoid token explosion)
        const codePreview = Array.from(files.entries())
            .slice(0, 5)
            .map(([path, content]) => `// ${path}\n${content.slice(0, 500)}...`)
            .join('\n\n---\n\n');

        const issuesSummary = issues.slice(0, 10).map(i =>
            `- [${i.severity}] ${i.title}: ${i.description}`
        ).join('\n');

        try {
            const response = await this.claudeService.generate(
                `As a code quality expert, review this code and issues found:

CODE PREVIEW:
${codePreview}

DETECTED ISSUES:
${issuesSummary || 'No major issues detected'}

Provide 3-5 high-impact recommendations for improving code quality. Focus on:
1. Architecture and design patterns
2. Performance optimizations
3. Maintainability improvements
4. Best practices for this stack (React/TypeScript)

Return recommendations as a JSON array of strings.`,
                {
                    model: CLAUDE_MODELS.SONNET_4_5,
                    maxTokens: 500,
                    useExtendedThinking: false,
                }
            );

            // Parse recommendations
            try {
                const match = response.content.match(/\[[\s\S]*\]/);
                if (match) {
                    return JSON.parse(match[0]);
                }
            } catch {
                // Return as single recommendation if parsing fails
                return [response.content.trim()];
            }
        } catch (error) {
            console.error('[CodeQuality] AI analysis failed:', error);
        }

        return [];
    }

    // ==========================================================================
    // METRICS & REPORTING
    // ==========================================================================

    private calculateMetrics(
        files: Map<string, string>,
        issues: QualityIssue[]
    ): QualityMetrics {
        // Base scores start at 100 and deduct based on issues
        let complexityScore = 100;
        let duplicationScore = 100;
        let maintainabilityScore = 100;
        let readabilityScore = 100;

        // Severity weights
        const weights = {
            critical: 15,
            major: 8,
            minor: 3,
            suggestion: 1,
        };

        // Calculate deductions by type
        for (const issue of issues) {
            const deduction = weights[issue.severity];

            switch (issue.type) {
                case 'complexity':
                    complexityScore -= deduction;
                    break;
                case 'duplication':
                    duplicationScore -= deduction;
                    break;
                case 'maintainability':
                case 'smell':
                case 'architecture':
                    maintainabilityScore -= deduction;
                    break;
                case 'naming':
                case 'pattern':
                    readabilityScore -= deduction;
                    break;
            }
        }

        // Ensure scores don't go below 0
        complexityScore = Math.max(0, complexityScore);
        duplicationScore = Math.max(0, duplicationScore);
        maintainabilityScore = Math.max(0, maintainabilityScore);
        readabilityScore = Math.max(0, readabilityScore);

        // Calculate overall score (weighted average)
        const overallScore = Math.round(
            (complexityScore * 0.3) +
            (duplicationScore * 0.2) +
            (maintainabilityScore * 0.3) +
            (readabilityScore * 0.2)
        );

        return {
            overallScore,
            complexityScore,
            duplicationScore,
            maintainabilityScore,
            readabilityScore,
        };
    }

    private generateSummary(metrics: QualityMetrics, issues: QualityIssue[]): string {
        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const majorCount = issues.filter(i => i.severity === 'major').length;
        const minorCount = issues.filter(i => i.severity === 'minor').length;

        let status = 'Excellent';
        if (metrics.overallScore < 90) status = 'Good';
        if (metrics.overallScore < 80) status = 'Fair';
        if (metrics.overallScore < 70) status = 'Needs Improvement';
        if (metrics.overallScore < 50) status = 'Poor';

        return `Code Quality: ${status} (${metrics.overallScore}/100). ` +
               `Issues: ${criticalCount} critical, ${majorCount} major, ${minorCount} minor. ` +
               `Complexity: ${metrics.complexityScore}/100, Maintainability: ${metrics.maintainabilityScore}/100`;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createCodeQualityAgent(
    projectId: string,
    userId: string,
    config?: Partial<CodeQualityConfig>
): CodeQualityAgent {
    return new CodeQualityAgent(projectId, userId, config);
}

export default CodeQualityAgent;

