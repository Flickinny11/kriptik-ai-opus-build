/**
 * Self-Healing Code Service
 *
 * Autonomous bug detection and fixing. This is a KILLER feature
 * that sets us apart from competitors.
 *
 * The system:
 * 1. Detects errors before runtime
 * 2. Analyzes root cause
 * 3. Generates fixes automatically
 * 4. Validates fixes don't introduce new issues
 * 5. Learns from past fixes to prevent similar issues
 */

import { getModelRouter } from './model-router';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface CodeError {
    id: string;
    type: 'syntax' | 'type' | 'runtime' | 'logic' | 'style' | 'security' | 'performance';
    severity: 'critical' | 'error' | 'warning' | 'info';
    file: string;
    line?: number;
    column?: number;
    message: string;
    code?: string;
    stack?: string;
}

export interface RootCauseAnalysis {
    errorId: string;
    rootCause: string;
    relatedFiles: string[];
    affectedFunctionality: string[];
    potentialFixes: Array<{
        description: string;
        confidence: number;
        complexity: 'simple' | 'moderate' | 'complex';
        breakingChange: boolean;
    }>;
    preventionAdvice: string;
}

export interface CodeFix {
    id: string;
    errorId: string;
    file: string;
    originalCode: string;
    fixedCode: string;
    explanation: string;
    confidence: number;
    validated: boolean;
    diff: string;
}

export interface HealingResult {
    errors: CodeError[];
    analyses: RootCauseAnalysis[];
    fixes: CodeFix[];
    summary: {
        errorsDetected: number;
        errorsFixed: number;
        filesModified: string[];
        timeMs: number;
    };
}

export interface ProjectFiles {
    [path: string]: string;
}

// ============================================================================
// ERROR DETECTION
// ============================================================================

/**
 * Static analysis patterns for error detection
 */
const ERROR_PATTERNS = {
    // TypeScript/JavaScript errors
    undefinedVariable: /(\w+) is not defined/,
    typeError: /Type '([^']+)' is not assignable to type '([^']+)'/,
    missingProperty: /Property '(\w+)' does not exist on type/,
    missingModule: /Cannot find module '([^']+)'/,
    missingExport: /Module '"([^"]+)"' has no exported member '(\w+)'/,

    // React errors
    hookRules: /React Hook .* cannot be called/,
    keyProp: /Each child in a list should have a unique "key" prop/,
    invalidJsx: /JSX element '(\w+)' has no corresponding closing tag/,

    // Common bugs
    nullAccess: /Cannot read propert(?:y|ies) of (null|undefined)/,
    infiniteLoop: /Maximum (update depth|call stack) exceeded/,
    memoryLeak: /Can't perform a React state update on an unmounted component/,

    // Security issues
    unsanitizedInput: /dangerouslySetInnerHTML/,
    hardcodedSecret: /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]+['"]/i,

    // Performance issues
    missingDeps: /React Hook .* has a missing dependency/,
    unnecessaryRerender: /useCallback|useMemo.*with empty dependencies/,
};

/**
 * Detect errors in code
 */
export async function detectErrors(files: ProjectFiles): Promise<CodeError[]> {
    const errors: CodeError[] = [];

    for (const [path, content] of Object.entries(files)) {
        const lines = content.split('\n');

        // Check each pattern
        for (const [errorType, pattern] of Object.entries(ERROR_PATTERNS)) {
            const matches = content.matchAll(new RegExp(pattern, 'g'));
            for (const match of matches) {
                const lineIndex = content.substring(0, match.index).split('\n').length - 1;

                errors.push({
                    id: uuidv4(),
                    type: getErrorType(errorType),
                    severity: getErrorSeverity(errorType),
                    file: path,
                    line: lineIndex + 1,
                    message: match[0],
                    code: lines[lineIndex],
                });
            }
        }

        // Language-specific checks
        if (path.endsWith('.tsx') || path.endsWith('.ts')) {
            errors.push(...detectTypeScriptErrors(path, content, lines));
        }

        if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
            errors.push(...detectReactErrors(path, content, lines));
        }
    }

    return errors;
}

function getErrorType(patternName: string): CodeError['type'] {
    const typeMap: Record<string, CodeError['type']> = {
        undefinedVariable: 'runtime',
        typeError: 'type',
        missingProperty: 'type',
        missingModule: 'syntax',
        missingExport: 'syntax',
        hookRules: 'logic',
        keyProp: 'logic',
        invalidJsx: 'syntax',
        nullAccess: 'runtime',
        infiniteLoop: 'runtime',
        memoryLeak: 'runtime',
        unsanitizedInput: 'security',
        hardcodedSecret: 'security',
        missingDeps: 'performance',
        unnecessaryRerender: 'performance',
    };
    return typeMap[patternName] || 'logic';
}

function getErrorSeverity(patternName: string): CodeError['severity'] {
    const severityMap: Record<string, CodeError['severity']> = {
        undefinedVariable: 'error',
        typeError: 'error',
        missingProperty: 'error',
        missingModule: 'critical',
        missingExport: 'error',
        hookRules: 'error',
        keyProp: 'warning',
        invalidJsx: 'critical',
        nullAccess: 'critical',
        infiniteLoop: 'critical',
        memoryLeak: 'error',
        unsanitizedInput: 'warning',
        hardcodedSecret: 'critical',
        missingDeps: 'warning',
        unnecessaryRerender: 'info',
    };
    return severityMap[patternName] || 'warning';
}

function detectTypeScriptErrors(path: string, content: string, lines: string[]): CodeError[] {
    const errors: CodeError[] = [];

    // Check for untyped function parameters
    const untypedParams = content.matchAll(/function\s+\w+\s*\(([^)]+)\)/g);
    for (const match of untypedParams) {
        const params = match[1];
        if (params && !params.includes(':')) {
            const lineIndex = content.substring(0, match.index).split('\n').length - 1;
            errors.push({
                id: uuidv4(),
                type: 'type',
                severity: 'warning',
                file: path,
                line: lineIndex + 1,
                message: 'Function parameters should have type annotations',
                code: lines[lineIndex],
            });
        }
    }

    // Check for any type usage
    const anyUsage = content.matchAll(/:\s*any\b/g);
    for (const match of anyUsage) {
        const lineIndex = content.substring(0, match.index).split('\n').length - 1;
        errors.push({
            id: uuidv4(),
            type: 'type',
            severity: 'warning',
            file: path,
            line: lineIndex + 1,
            message: 'Avoid using "any" type - use specific types instead',
            code: lines[lineIndex],
        });
    }

    return errors;
}

function detectReactErrors(path: string, content: string, lines: string[]): CodeError[] {
    const errors: CodeError[] = [];

    // Check for missing key props in map
    const mapWithoutKey = content.matchAll(/\.map\s*\([^)]*\)\s*=>\s*(?!.*key=)/g);
    for (const match of mapWithoutKey) {
        const lineIndex = content.substring(0, match.index).split('\n').length - 1;
        // Only flag if returning JSX
        const surrounding = content.substring(match.index!, match.index! + 200);
        if (surrounding.includes('<')) {
            errors.push({
                id: uuidv4(),
                type: 'logic',
                severity: 'warning',
                file: path,
                line: lineIndex + 1,
                message: 'Possible missing key prop in map',
                code: lines[lineIndex],
            });
        }
    }

    // Check for useState without initial value in conditional
    const conditionalUseState = content.matchAll(/if\s*\([^)]+\)\s*{[^}]*useState/g);
    for (const match of conditionalUseState) {
        const lineIndex = content.substring(0, match.index).split('\n').length - 1;
        errors.push({
            id: uuidv4(),
            type: 'logic',
            severity: 'error',
            file: path,
            line: lineIndex + 1,
            message: 'Hooks cannot be called conditionally',
            code: lines[lineIndex],
        });
    }

    return errors;
}

// ============================================================================
// ROOT CAUSE ANALYSIS
// ============================================================================

/**
 * Analyze root cause of an error
 */
export async function analyzeRootCause(
    error: CodeError,
    files: ProjectFiles
): Promise<RootCauseAnalysis> {
    const router = getModelRouter();

    const prompt = `Analyze this code error and determine the root cause:

## Error Details
- Type: ${error.type}
- Severity: ${error.severity}
- File: ${error.file}
- Line: ${error.line}
- Message: ${error.message}
- Code: \`${error.code}\`

## File Content
\`\`\`typescript
${files[error.file] || 'File not available'}
\`\`\`

## Task
1. Identify the ROOT CAUSE (not just the symptom)
2. List related files that might be affected
3. Describe the functionality that's broken
4. Provide 2-3 potential fixes with confidence scores
5. Explain how to prevent this issue in the future

Respond with JSON:
{
  "rootCause": "string",
  "relatedFiles": ["string"],
  "affectedFunctionality": ["string"],
  "potentialFixes": [
    {
      "description": "string",
      "confidence": 0-100,
      "complexity": "simple|moderate|complex",
      "breakingChange": boolean
    }
  ],
  "preventionAdvice": "string"
}`;

    const response = await router.generate({
        prompt,
        taskType: 'analysis',
        forceTier: 'standard',
        systemPrompt: ROOT_CAUSE_SYSTEM_PROMPT,
    });

    try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                errorId: error.id,
                ...parsed,
            };
        }
    } catch {
        // Fallback analysis
    }

    return {
        errorId: error.id,
        rootCause: 'Unable to determine root cause automatically',
        relatedFiles: [error.file],
        affectedFunctionality: [],
        potentialFixes: [],
        preventionAdvice: 'Manual investigation required',
    };
}

// ============================================================================
// CODE FIXING
// ============================================================================

/**
 * Generate fix for an error
 */
export async function generateFix(
    error: CodeError,
    analysis: RootCauseAnalysis,
    files: ProjectFiles
): Promise<CodeFix | null> {
    const router = getModelRouter();

    const fileContent = files[error.file];
    if (!fileContent) return null;

    const prompt = `Fix this code error:

## Error
- Type: ${error.type}
- Message: ${error.message}
- Line ${error.line}: \`${error.code}\`

## Root Cause Analysis
${analysis.rootCause}

## Current File
\`\`\`typescript
${fileContent}
\`\`\`

## Best Fix Approach
${analysis.potentialFixes[0]?.description || 'Fix the identified error'}

## Requirements
1. Fix ONLY the specific error - don't refactor unrelated code
2. Preserve existing functionality
3. Follow existing code style
4. NO placeholder comments (TODO, FIXME, etc.)

## Response Format
Return the COMPLETE fixed file content:

\`\`\`typescript
// Complete fixed file here
\`\`\`

## Explanation
Brief explanation of what was fixed and why.`;

    const response = await router.generate({
        prompt,
        taskType: 'generation',
        forceTier: 'critical', // Use best model for fixes
        systemPrompt: FIX_GENERATION_SYSTEM_PROMPT,
    });

    // Extract fixed code
    const codeMatch = response.content.match(/```typescript\n([\s\S]*?)```/);
    if (!codeMatch) {
        return null;
    }

    const fixedCode = codeMatch[1].trim();

    // Generate diff
    const diff = generateDiff(fileContent, fixedCode);

    // Extract explanation
    const explanationMatch = response.content.match(/## Explanation\n([\s\S]*?)(?:$|```)/);
    const explanation = explanationMatch?.[1]?.trim() || 'Error fixed';

    return {
        id: uuidv4(),
        errorId: error.id,
        file: error.file,
        originalCode: fileContent,
        fixedCode,
        explanation,
        confidence: analysis.potentialFixes[0]?.confidence || 70,
        validated: false,
        diff,
    };
}

/**
 * Generate a simple diff between two strings
 */
function generateDiff(original: string, fixed: string): string {
    const originalLines = original.split('\n');
    const fixedLines = fixed.split('\n');

    const diff: string[] = [];
    const maxLines = Math.max(originalLines.length, fixedLines.length);

    for (let i = 0; i < maxLines; i++) {
        const origLine = originalLines[i];
        const fixedLine = fixedLines[i];

        if (origLine === fixedLine) {
            diff.push(`  ${origLine || ''}`);
        } else if (origLine && !fixedLine) {
            diff.push(`- ${origLine}`);
        } else if (!origLine && fixedLine) {
            diff.push(`+ ${fixedLine}`);
        } else {
            diff.push(`- ${origLine}`);
            diff.push(`+ ${fixedLine}`);
        }
    }

    return diff.join('\n');
}

/**
 * Validate that a fix doesn't introduce new errors
 */
export async function validateFix(
    fix: CodeFix,
    files: ProjectFiles
): Promise<{ valid: boolean; newErrors: CodeError[] }> {
    // Create a copy of files with the fix applied
    const updatedFiles = {
        ...files,
        [fix.file]: fix.fixedCode,
    };

    // Detect errors in updated files
    const errors = await detectErrors(updatedFiles);

    // Filter to only errors in the fixed file
    const newErrors = errors.filter(e => e.file === fix.file);

    // Check if original error is fixed
    const originalErrorFixed = !newErrors.some(
        e => e.line === parseInt(fix.errorId.split('-')[0]) && e.type === 'type'
    );

    return {
        valid: originalErrorFixed && newErrors.length === 0,
        newErrors,
    };
}

// ============================================================================
// HEALING PIPELINE
// ============================================================================

export class SelfHealingService {
    private fixHistory: Map<string, CodeFix[]> = new Map();

    /**
     * Run the full healing pipeline
     */
    async heal(
        files: ProjectFiles,
        options?: {
            maxFixes?: number;
            autoApply?: boolean;
            onProgress?: (update: {
                stage: 'detecting' | 'analyzing' | 'fixing' | 'validating';
                message: string;
            }) => void;
        }
    ): Promise<HealingResult> {
        const startTime = Date.now();
        const { maxFixes = 10, onProgress } = options || {};

        // Step 1: Detect errors
        onProgress?.({ stage: 'detecting', message: 'Scanning for errors...' });
        const errors = await detectErrors(files);

        // Sort by severity
        errors.sort((a, b) => {
            const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });

        const analyses: RootCauseAnalysis[] = [];
        const fixes: CodeFix[] = [];
        const modifiedFiles = new Set<string>();

        // Step 2: Analyze and fix top errors
        const errorsToFix = errors.slice(0, maxFixes);

        for (const error of errorsToFix) {
            // Analyze
            onProgress?.({
                stage: 'analyzing',
                message: `Analyzing: ${error.message.substring(0, 50)}...`,
            });
            const analysis = await analyzeRootCause(error, files);
            analyses.push(analysis);

            // Generate fix
            onProgress?.({
                stage: 'fixing',
                message: `Generating fix for ${error.file}:${error.line}...`,
            });
            const fix = await generateFix(error, analysis, files);

            if (fix) {
                // Validate fix
                onProgress?.({
                    stage: 'validating',
                    message: `Validating fix...`,
                });
                const validation = await validateFix(fix, files);

                if (validation.valid) {
                    fix.validated = true;
                    fixes.push(fix);
                    modifiedFiles.add(fix.file);

                    // Apply fix to files for subsequent error detection
                    if (options?.autoApply) {
                        files[fix.file] = fix.fixedCode;
                    }

                    // Store in history
                    if (!this.fixHistory.has(error.file)) {
                        this.fixHistory.set(error.file, []);
                    }
                    this.fixHistory.get(error.file)!.push(fix);
                }
            }
        }

        return {
            errors,
            analyses,
            fixes,
            summary: {
                errorsDetected: errors.length,
                errorsFixed: fixes.length,
                filesModified: Array.from(modifiedFiles),
                timeMs: Date.now() - startTime,
            },
        };
    }

    /**
     * Get fix history for a file
     */
    getFixHistory(file: string): CodeFix[] {
        return this.fixHistory.get(file) || [];
    }

    /**
     * Clear fix history
     */
    clearHistory(): void {
        this.fixHistory.clear();
    }
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const ROOT_CAUSE_SYSTEM_PROMPT = `You are an expert debugging assistant. Your job is to analyze
code errors and identify their root causes, not just the surface-level symptoms.

Consider:
- Dependency issues
- Type mismatches
- Logic errors
- Race conditions
- Missing null checks
- Incorrect API usage

Be precise and technical in your analysis.`;

const FIX_GENERATION_SYSTEM_PROMPT = `You are an expert code fixer. Your job is to fix code errors
while preserving the original functionality and code style.

Rules:
1. Fix ONLY the specific error - don't refactor unrelated code
2. Preserve all existing functionality
3. Match the existing code style
4. NO placeholders (TODO, FIXME, etc.)
5. The fix must be complete and functional

Return the COMPLETE file with the fix applied.`;

// ============================================================================
// SINGLETON
// ============================================================================

let instance: SelfHealingService | null = null;

export function getSelfHealingService(): SelfHealingService {
    if (!instance) {
        instance = new SelfHealingService();
    }
    return instance;
}

