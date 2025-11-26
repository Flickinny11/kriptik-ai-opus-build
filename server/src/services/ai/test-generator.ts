/**
 * Automated Test Generator
 *
 * Generates comprehensive test suites for code:
 * - Unit tests (Vitest/Jest)
 * - Integration tests
 * - E2E tests (Playwright)
 * - Component tests (Testing Library)
 */

import { getModelRouter } from './model-router';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type TestType = 'unit' | 'integration' | 'e2e' | 'component';
export type TestFramework = 'vitest' | 'jest' | 'playwright' | 'cypress';

export interface TestCase {
    name: string;
    description: string;
    type: TestType;
    code: string;
}

export interface TestSuite {
    id: string;
    name: string;
    file: string;
    framework: TestFramework;
    testCases: TestCase[];
    setupCode?: string;
    teardownCode?: string;
    mocks?: string;
    coverage?: {
        lines: number;
        branches: number;
        functions: number;
        statements: number;
    };
}

export interface TestGenerationRequest {
    sourceFile: string;
    sourceCode: string;
    testTypes?: TestType[];
    framework?: TestFramework;
    coverageTarget?: number;
    existingTests?: string;
    focusAreas?: string[];
}

export interface TestGenerationResult {
    testSuites: TestSuite[];
    testFiles: Array<{ path: string; content: string }>;
    summary: {
        totalTests: number;
        byType: Record<TestType, number>;
        estimatedCoverage: number;
    };
    usage: {
        inputTokens: number;
        outputTokens: number;
        estimatedCost: number;
    };
}

// ============================================================================
// TEST GENERATOR
// ============================================================================

export class TestGeneratorService {
    /**
     * Generate tests for a source file
     */
    async generateTests(request: TestGenerationRequest): Promise<TestGenerationResult> {
        const router = getModelRouter();

        const testTypes = request.testTypes || ['unit', 'component'];
        const framework = request.framework || this.inferFramework(request.sourceFile);

        // Analyze the source code
        const analysisPrompt = this.buildAnalysisPrompt(request);
        const analysisResponse = await router.generate({
            prompt: analysisPrompt,
            taskType: 'analysis',
            forceTier: 'standard',
            systemPrompt: ANALYSIS_SYSTEM_PROMPT,
        });

        const analysis = this.parseAnalysis(analysisResponse.content);

        // Generate tests based on analysis
        const testSuites: TestSuite[] = [];
        const testFiles: Array<{ path: string; content: string }> = [];
        let totalInputTokens = analysisResponse.usage.inputTokens;
        let totalOutputTokens = analysisResponse.usage.outputTokens;
        let totalCost = analysisResponse.usage.estimatedCost;

        for (const testType of testTypes) {
            const generationPrompt = this.buildTestGenerationPrompt(
                request,
                analysis,
                testType,
                framework
            );

            const response = await router.generate({
                prompt: generationPrompt,
                taskType: 'generation',
                forceTier: 'critical', // Use best model for test generation
                systemPrompt: TEST_GENERATION_SYSTEM_PROMPT,
            });

            totalInputTokens += response.usage.inputTokens;
            totalOutputTokens += response.usage.outputTokens;
            totalCost += response.usage.estimatedCost;

            const suite = this.parseTestSuite(
                response.content,
                request.sourceFile,
                testType,
                framework
            );

            if (suite) {
                testSuites.push(suite);
                testFiles.push({
                    path: this.getTestFilePath(request.sourceFile, testType),
                    content: this.formatTestFile(suite, framework),
                });
            }
        }

        // Calculate summary
        const summary = {
            totalTests: testSuites.reduce((sum, s) => sum + s.testCases.length, 0),
            byType: testTypes.reduce((acc, type) => {
                acc[type] = testSuites
                    .filter(s => s.testCases.some(t => t.type === type))
                    .reduce((sum, s) => sum + s.testCases.filter(t => t.type === type).length, 0);
                return acc;
            }, {} as Record<TestType, number>),
            estimatedCoverage: this.estimateCoverage(testSuites, analysis),
        };

        return {
            testSuites,
            testFiles,
            summary,
            usage: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                estimatedCost: totalCost,
            },
        };
    }

    /**
     * Infer test framework from file type
     */
    private inferFramework(sourceFile: string): TestFramework {
        if (sourceFile.includes('.spec.') || sourceFile.includes('.test.')) {
            return 'vitest';
        }
        if (sourceFile.endsWith('.tsx') || sourceFile.endsWith('.jsx')) {
            return 'vitest'; // Component testing with Vitest
        }
        return 'vitest'; // Default to Vitest
    }

    /**
     * Build analysis prompt
     */
    private buildAnalysisPrompt(request: TestGenerationRequest): string {
        return `Analyze this code for test generation:

\`\`\`typescript
${request.sourceCode}
\`\`\`

Identify:
1. **Functions/Methods** - List all functions with their parameters and return types
2. **Components** - React components and their props
3. **Dependencies** - External dependencies that need mocking
4. **State Management** - useState, useReducer, context usage
5. **Side Effects** - API calls, localStorage, timers
6. **Edge Cases** - Boundary conditions, error scenarios
7. **Integration Points** - How this code interacts with other parts

${request.focusAreas ? `Focus on: ${request.focusAreas.join(', ')}` : ''}

Respond with structured JSON.`;
    }

    /**
     * Build test generation prompt
     */
    private buildTestGenerationPrompt(
        request: TestGenerationRequest,
        analysis: CodeAnalysis,
        testType: TestType,
        framework: TestFramework
    ): string {
        const typeInstructions = {
            unit: 'Unit tests for individual functions. Test each function in isolation with various inputs.',
            integration: 'Integration tests for how components/modules work together.',
            e2e: 'End-to-end tests simulating real user flows.',
            component: 'Component tests using Testing Library. Test rendering, interactions, and state changes.',
        };

        return `Generate ${testType} tests for this code:

## Source Code
\`\`\`typescript
${request.sourceCode}
\`\`\`

## Code Analysis
${JSON.stringify(analysis, null, 2)}

## Test Requirements
- Framework: ${framework}
- Type: ${testType}
- ${typeInstructions[testType]}

## Test Coverage Goals
${request.coverageTarget ? `Target: ${request.coverageTarget}% coverage` : 'Comprehensive coverage'}

${request.existingTests ? `## Existing Tests (don't duplicate)\n\`\`\`\n${request.existingTests}\n\`\`\`` : ''}

## Output Format
Generate a complete test file:

\`\`\`test
import { describe, it, expect, vi } from 'vitest';
// imports...

describe('ComponentName', () => {
  // Setup if needed

  it('should do something', () => {
    // Test implementation
  });

  // More tests...
});
\`\`\`

Requirements:
1. Test all public functions/exports
2. Cover happy path AND edge cases
3. Test error handling
4. Use descriptive test names
5. Include setup/teardown where needed
6. Mock external dependencies properly
7. NO placeholder tests - all tests must be complete`;
    }

    /**
     * Parse analysis response
     */
    private parseAnalysis(content: string): CodeAnalysis {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch {
            // Default analysis
        }

        return {
            functions: [],
            components: [],
            dependencies: [],
            stateManagement: [],
            sideEffects: [],
            edgeCases: [],
            integrationPoints: [],
        };
    }

    /**
     * Parse generated test suite
     */
    private parseTestSuite(
        content: string,
        sourceFile: string,
        testType: TestType,
        framework: TestFramework
    ): TestSuite | null {
        const codeMatch = content.match(/```test\n([\s\S]*?)```/) ||
                          content.match(/```typescript\n([\s\S]*?)```/);

        if (!codeMatch) return null;

        const code = codeMatch[1].trim();

        // Extract test cases from the code
        const testCases: TestCase[] = [];
        const itMatches = code.matchAll(/it\(['"]([^'"]+)['"],/g);

        for (const match of itMatches) {
            testCases.push({
                name: match[1],
                description: match[1],
                type: testType,
                code: '', // Full code is in the suite
            });
        }

        // Extract describe name
        const describeMatch = code.match(/describe\(['"]([^'"]+)['"]/);
        const suiteName = describeMatch?.[1] || sourceFile.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Tests';

        return {
            id: uuidv4(),
            name: suiteName,
            file: this.getTestFilePath(sourceFile, testType),
            framework,
            testCases,
        };
    }

    /**
     * Get test file path
     */
    private getTestFilePath(sourceFile: string, testType: TestType): string {
        const dir = sourceFile.substring(0, sourceFile.lastIndexOf('/'));
        const fileName = sourceFile.split('/').pop()?.replace(/\.[^.]+$/, '') || 'test';

        const suffix = testType === 'e2e' ? '.e2e' : '.test';
        const testDir = testType === 'e2e' ? 'e2e' : '__tests__';

        return `${dir}/${testDir}/${fileName}${suffix}.tsx`;
    }

    /**
     * Format test file content
     */
    private formatTestFile(suite: TestSuite, framework: TestFramework): string {
        // The suite already contains the full test code
        // This is just for any additional formatting
        return suite.testCases.map(t => t.code).join('\n\n') || '// Test suite';
    }

    /**
     * Estimate coverage based on tests
     */
    private estimateCoverage(suites: TestSuite[], analysis: CodeAnalysis): number {
        const totalFunctions = analysis.functions.length + analysis.components.length;
        if (totalFunctions === 0) return 100;

        const testedItems = new Set<string>();

        for (const suite of suites) {
            for (const testCase of suite.testCases) {
                // Extract function/component names from test names
                const match = testCase.name.match(/(?:should|renders?|calls?|returns?)\s+(\w+)/i);
                if (match) {
                    testedItems.add(match[1].toLowerCase());
                }
            }
        }

        // Simple heuristic: each test case covers ~10% of the function it tests
        const coverageEstimate = Math.min(
            100,
            (testedItems.size / totalFunctions) * 100 + suites.reduce((sum, s) => sum + s.testCases.length * 5, 0)
        );

        return Math.round(coverageEstimate);
    }
}

// ============================================================================
// TYPES
// ============================================================================

interface CodeAnalysis {
    functions: Array<{
        name: string;
        params: string[];
        returnType: string;
        async: boolean;
    }>;
    components: Array<{
        name: string;
        props: string[];
        hooks: string[];
    }>;
    dependencies: string[];
    stateManagement: string[];
    sideEffects: string[];
    edgeCases: string[];
    integrationPoints: string[];
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const ANALYSIS_SYSTEM_PROMPT = `You are a code analysis expert. Your job is to analyze code
and identify all testable elements, dependencies, and edge cases.

Be thorough and precise. Identify:
- All functions and their signatures
- React components and their props
- External dependencies that need mocking
- Potential edge cases and error scenarios`;

const TEST_GENERATION_SYSTEM_PROMPT = `You are an expert test engineer. Your job is to write
comprehensive, maintainable tests that provide high code coverage.

Follow these principles:
1. Test behavior, not implementation
2. One assertion concept per test
3. Use descriptive test names (should_do_X_when_Y)
4. Arrange-Act-Assert pattern
5. Mock external dependencies
6. Cover happy paths AND edge cases
7. Test error handling

Write COMPLETE, RUNNABLE tests - no placeholders.`;

// ============================================================================
// SINGLETON
// ============================================================================

let instance: TestGeneratorService | null = null;

export function getTestGeneratorService(): TestGeneratorService {
    if (!instance) {
        instance = new TestGeneratorService();
    }
    return instance;
}

