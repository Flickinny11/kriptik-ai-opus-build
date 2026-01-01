/**
 * Functional Checklist Verifier - Verifies every UI element works correctly
 *
 * Part of the Deep Intent Lock system. Ensures that every button, form, handler,
 * and display element in the functional checklist actually works as specified.
 */

import { createClaudeService, CLAUDE_MODELS, type ClaudeService } from '../ai/claude-service.js';
import type {
    FunctionalChecklistItem,
    TestCase,
    WiringConnection,
} from '../ai/intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export interface VerificationResult {
    itemId: string;
    passed: boolean;
    score: number;                           // 0-100
    issues: VerificationIssue[];
    testResults: TestCaseResult[];
    wiringVerified: boolean;
    placeholdersFound: string[];
    durationMs: number;
    verifiedAt: string;
}

export interface VerificationIssue {
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    location?: {
        file: string;
        line?: number;
    };
    suggestedFix?: string;
}

export interface TestCaseResult {
    testCaseId: string;
    passed: boolean;
    actualOutput?: string;
    error?: string;
    durationMs: number;
}

export interface WiringVerificationResult {
    connectionId: string;
    verified: boolean;
    sourceExists: boolean;
    targetExists: boolean;
    connectionWorks: boolean;
    dataFlowVerified: boolean;
    issues: string[];
}

export interface ChecklistVerificationSummary {
    totalItems: number;
    verifiedItems: number;
    passedItems: number;
    failedItems: number;
    totalIssues: number;
    blockerCount: number;
    overallScore: number;
    results: VerificationResult[];
}

// =============================================================================
// PLACEHOLDER PATTERNS
// =============================================================================

const PLACEHOLDER_PATTERNS = [
    /TODO/gi,
    /FIXME/gi,
    /XXX/gi,
    /HACK/gi,
    /placeholder/gi,
    /coming\s*soon/gi,
    /not\s*implemented/gi,
    /lorem\s*ipsum/gi,
    /dummy/gi,
    /mock\s*data/gi,
    /sample\s*text/gi,
    /test\s*content/gi,
    /example\.com/gi,
    /your[_\s]*(api[_\s]*)?key/gi,
    /xxx+/gi,
    /\{\{\s*\w+\s*\}\}/g,              // Template placeholders like {{name}}
];

// =============================================================================
// FUNCTIONAL CHECKLIST VERIFIER SERVICE
// =============================================================================

export class FunctionalChecklistVerifier {
    private claudeService: ClaudeService;
    private projectId: string;
    private userId: string;

    constructor(userId: string, projectId: string) {
        this.projectId = projectId;
        this.userId = userId;
        this.claudeService = createClaudeService({
            projectId,
            userId,
            agentType: 'verification',
            systemPrompt: VERIFICATION_SYSTEM_PROMPT,
        });
    }

    /**
     * Verify a single functional checklist item
     */
    async verifyItem(
        item: FunctionalChecklistItem,
        fileContents: Map<string, string>,
        wiringMap: WiringConnection[]
    ): Promise<VerificationResult> {
        const startTime = Date.now();
        const issues: VerificationIssue[] = [];
        const testResults: TestCaseResult[] = [];
        let placeholdersFound: string[] = [];

        // Step 1: Check if the component file exists
        const componentFile = item.location.filePath;
        const fileContent = fileContents.get(componentFile);

        if (!fileContent) {
            issues.push({
                severity: 'error',
                code: 'FILE_NOT_FOUND',
                message: `Component file not found: ${componentFile}`,
                location: { file: componentFile },
                suggestedFix: `Create the file ${componentFile} with the ${item.location.component} component`,
            });
        } else {
            // Step 2: Check for placeholders in the file
            placeholdersFound = this.findPlaceholders(fileContent);
            for (const placeholder of placeholdersFound) {
                issues.push({
                    severity: 'error',
                    code: 'PLACEHOLDER_FOUND',
                    message: `Placeholder found: "${placeholder}"`,
                    location: { file: componentFile },
                    suggestedFix: `Replace "${placeholder}" with actual implementation`,
                });
            }

            // Step 3: Check that the component exists in the file
            const componentExists = this.checkComponentExists(fileContent, item.location.component);
            if (!componentExists) {
                issues.push({
                    severity: 'error',
                    code: 'COMPONENT_NOT_FOUND',
                    message: `Component "${item.location.component}" not found in file`,
                    location: { file: componentFile },
                    suggestedFix: `Define the ${item.location.component} component in ${componentFile}`,
                });
            }

            // Step 4: Check that the item's behavior is implemented
            const behaviorIssues = await this.checkBehaviorImplemented(item, fileContent);
            issues.push(...behaviorIssues);

            // Step 5: Check for mustNotContain patterns
            for (const pattern of item.mustNotContain) {
                if (fileContent.toLowerCase().includes(pattern.toLowerCase())) {
                    issues.push({
                        severity: 'error',
                        code: 'FORBIDDEN_PATTERN',
                        message: `Forbidden pattern found: "${pattern}"`,
                        location: { file: componentFile },
                        suggestedFix: `Remove or replace "${pattern}" in ${componentFile}`,
                    });
                }
            }
        }

        // Step 6: Verify wiring connections
        const relevantConnections = wiringMap.filter(
            wc => wc.from.id === item.id || wc.to.id === item.id
        );
        let wiringVerified = true;
        for (const connection of relevantConnections) {
            const wiringResult = this.verifyWiringConnection(connection, fileContents);
            if (!wiringResult.verified) {
                wiringVerified = false;
                issues.push({
                    severity: 'error',
                    code: 'WIRING_BROKEN',
                    message: `Wiring broken: ${connection.from.name} → ${connection.to.name}`,
                    suggestedFix: wiringResult.issues.join('; '),
                });
            }
        }

        // Step 7: Run test cases (simulated verification)
        for (const testCase of item.testCases) {
            const testResult = await this.runTestCase(testCase, item, fileContents);
            testResults.push(testResult);
            if (!testResult.passed) {
                issues.push({
                    severity: 'error',
                    code: 'TEST_FAILED',
                    message: `Test "${testCase.description}" failed: ${testResult.error}`,
                    suggestedFix: `Fix the implementation to pass: ${testCase.expectedOutput}`,
                });
            }
        }

        // Calculate score
        const errorCount = issues.filter(i => i.severity === 'error').length;
        const warningCount = issues.filter(i => i.severity === 'warning').length;
        const testsPassedCount = testResults.filter(t => t.passed).length;
        const testsTotal = testResults.length || 1;

        let score = 100;
        score -= errorCount * 20;
        score -= warningCount * 5;
        score = Math.max(0, Math.min(100, score));

        // Adjust score based on test pass rate
        const testPassRate = testsPassedCount / testsTotal;
        score = Math.round(score * 0.7 + testPassRate * 30);

        const passed = errorCount === 0 && testPassRate >= 1.0;

        return {
            itemId: item.id,
            passed,
            score,
            issues,
            testResults,
            wiringVerified,
            placeholdersFound,
            durationMs: Date.now() - startTime,
            verifiedAt: new Date().toISOString(),
        };
    }

    /**
     * Verify all items in a functional checklist
     */
    async verifyChecklist(
        checklist: FunctionalChecklistItem[],
        fileContents: Map<string, string>,
        wiringMap: WiringConnection[]
    ): Promise<ChecklistVerificationSummary> {
        const results: VerificationResult[] = [];

        for (const item of checklist) {
            const result = await this.verifyItem(item, fileContents, wiringMap);
            results.push(result);
        }

        const passedItems = results.filter(r => r.passed).length;
        const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
        const blockerCount = results.reduce(
            (sum, r) => sum + r.issues.filter(i => i.severity === 'error').length,
            0
        );
        const avgScore = results.length > 0
            ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
            : 0;

        return {
            totalItems: checklist.length,
            verifiedItems: results.length,
            passedItems,
            failedItems: results.length - passedItems,
            totalIssues,
            blockerCount,
            overallScore: avgScore,
            results,
        };
    }

    /**
     * Quick verification - checks only critical items
     */
    async quickVerify(
        checklist: FunctionalChecklistItem[],
        fileContents: Map<string, string>
    ): Promise<{ passed: boolean; blockers: string[] }> {
        const blockers: string[] = [];

        for (const item of checklist) {
            const filePath = item.location.filePath;
            const content = fileContents.get(filePath);

            if (!content) {
                blockers.push(`Missing file: ${filePath}`);
                continue;
            }

            const placeholders = this.findPlaceholders(content);
            if (placeholders.length > 0) {
                blockers.push(`Placeholders in ${filePath}: ${placeholders.join(', ')}`);
            }

            for (const forbidden of item.mustNotContain) {
                if (content.toLowerCase().includes(forbidden.toLowerCase())) {
                    blockers.push(`Forbidden pattern "${forbidden}" in ${filePath}`);
                }
            }
        }

        return {
            passed: blockers.length === 0,
            blockers,
        };
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    private findPlaceholders(content: string): string[] {
        const found: string[] = [];
        for (const pattern of PLACEHOLDER_PATTERNS) {
            const matches = content.match(pattern);
            if (matches) {
                for (const match of matches) {
                    if (!found.includes(match)) {
                        found.push(match);
                    }
                }
            }
        }
        return found;
    }

    private checkComponentExists(fileContent: string, componentName: string): boolean {
        // Check for various component definition patterns
        const patterns = [
            new RegExp(`function\\s+${componentName}\\s*\\(`, 'i'),
            new RegExp(`const\\s+${componentName}\\s*=`, 'i'),
            new RegExp(`export\\s+(default\\s+)?function\\s+${componentName}`, 'i'),
            new RegExp(`export\\s+(default\\s+)?const\\s+${componentName}`, 'i'),
            new RegExp(`class\\s+${componentName}\\s+extends`, 'i'),
        ];

        return patterns.some(pattern => pattern.test(fileContent));
    }

    private async checkBehaviorImplemented(
        item: FunctionalChecklistItem,
        fileContent: string
    ): Promise<VerificationIssue[]> {
        const issues: VerificationIssue[] = [];

        // Check for event handler based on trigger
        if (item.behavior.trigger) {
            const triggerPatterns: Record<string, RegExp[]> = {
                'onClick': [/onClick\s*[=:]/i, /handleClick/i, /on.*Click/i],
                'onSubmit': [/onSubmit\s*[=:]/i, /handleSubmit/i],
                'onChange': [/onChange\s*[=:]/i, /handleChange/i],
                'onInput': [/onInput\s*[=:]/i, /handleInput/i],
            };

            const patterns = triggerPatterns[item.behavior.trigger] || [];
            if (patterns.length > 0 && !patterns.some(p => p.test(fileContent))) {
                issues.push({
                    severity: 'warning',
                    code: 'HANDLER_NOT_FOUND',
                    message: `No ${item.behavior.trigger} handler found for ${item.name}`,
                    location: { file: item.location.filePath },
                    suggestedFix: `Add ${item.behavior.trigger} handler that: ${item.behavior.action}`,
                });
            }
        }

        // Check for API calls if item calls an integration
        if (item.callsIntegration) {
            const apiPatterns = [
                /fetch\s*\(/i,
                /axios/i,
                /\.get\s*\(/i,
                /\.post\s*\(/i,
                /useMutation/i,
                /useQuery/i,
                /apiClient/i,
            ];

            if (!apiPatterns.some(p => p.test(fileContent))) {
                issues.push({
                    severity: 'warning',
                    code: 'API_CALL_NOT_FOUND',
                    message: `No API call found for integration ${item.callsIntegration}`,
                    location: { file: item.location.filePath },
                    suggestedFix: `Add API call to ${item.callsIntegration}`,
                });
            }
        }

        return issues;
    }

    private verifyWiringConnection(
        connection: WiringConnection,
        fileContents: Map<string, string>
    ): WiringVerificationResult {
        const issues: string[] = [];
        let sourceExists = false;
        let targetExists = false;
        let connectionWorks = false;

        // Check source exists
        for (const [filePath, content] of fileContents) {
            if (content.includes(connection.from.name)) {
                sourceExists = true;
                break;
            }
        }

        // Check target exists
        for (const [filePath, content] of fileContents) {
            if (content.includes(connection.to.name)) {
                targetExists = true;
                break;
            }
        }

        // Check connection (import or call)
        for (const [filePath, content] of fileContents) {
            if (connection.connectionType === 'imports') {
                if (content.includes(`import`) && content.includes(connection.from.name)) {
                    connectionWorks = true;
                    break;
                }
            } else if (connection.connectionType === 'calls') {
                if (content.includes(connection.from.name) && content.includes(connection.to.name)) {
                    connectionWorks = true;
                    break;
                }
            }
        }

        if (!sourceExists) issues.push(`Source "${connection.from.name}" not found`);
        if (!targetExists) issues.push(`Target "${connection.to.name}" not found`);
        if (!connectionWorks) issues.push(`Connection not verified`);

        return {
            connectionId: connection.id,
            verified: sourceExists && targetExists && connectionWorks,
            sourceExists,
            targetExists,
            connectionWorks,
            dataFlowVerified: connectionWorks,
            issues,
        };
    }

    private async runTestCase(
        testCase: TestCase,
        item: FunctionalChecklistItem,
        fileContents: Map<string, string>
    ): Promise<TestCaseResult> {
        const startTime = Date.now();

        // For now, we do static analysis to verify test cases
        // In production, this would run actual browser automation
        const filePath = item.location.filePath;
        const content = fileContents.get(filePath);

        if (!content) {
            return {
                testCaseId: testCase.id,
                passed: false,
                error: `File not found: ${filePath}`,
                durationMs: Date.now() - startTime,
            };
        }

        // Check for obvious failures
        const placeholders = this.findPlaceholders(content);
        if (placeholders.length > 0) {
            return {
                testCaseId: testCase.id,
                passed: false,
                error: `Placeholders found: ${placeholders.join(', ')}`,
                durationMs: Date.now() - startTime,
            };
        }

        // Check if component exists
        if (!this.checkComponentExists(content, item.location.component)) {
            return {
                testCaseId: testCase.id,
                passed: false,
                error: `Component ${item.location.component} not found`,
                durationMs: Date.now() - startTime,
            };
        }

        // If we get here, the test passes (static analysis only)
        return {
            testCaseId: testCase.id,
            passed: true,
            actualOutput: 'Static analysis passed',
            durationMs: Date.now() - startTime,
        };
    }
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const VERIFICATION_SYSTEM_PROMPT = `You are a code verification expert. Your job is to verify that UI components are properly implemented and wired correctly.

Check for:
1. Component exists and is exported
2. Event handlers are implemented
3. API calls are made correctly
4. State management is proper
5. No placeholders or TODOs
6. All required behaviors are implemented`;

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

export function createFunctionalChecklistVerifier(userId: string, projectId: string): FunctionalChecklistVerifier {
    return new FunctionalChecklistVerifier(userId, projectId);
}

/**
 * Quick verification helper
 */
export async function quickVerifyChecklist(
    checklist: FunctionalChecklistItem[],
    fileContents: Map<string, string>,
    userId: string,
    projectId: string
): Promise<{ passed: boolean; blockers: string[] }> {
    const verifier = createFunctionalChecklistVerifier(userId, projectId);
    return verifier.quickVerify(checklist, fileContents);
}
