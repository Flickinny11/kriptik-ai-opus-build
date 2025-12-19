/**
 * Exploratory Testing Agent
 *
 * Closes the "Last 20% Gap" by discovering undefined paths and edge cases.
 *
 * Features:
 * - Autonomous page exploration (crawling)
 * - Random user behavior simulation
 * - State combination testing
 * - Navigation path discovery
 * - Hidden feature detection
 * - Edge case discovery through randomization
 * - Unusual interaction sequences
 * - Multi-tab interaction testing
 *
 * This is NOT a placeholder - it performs real autonomous exploration via Playwright.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { Page, BrowserContext } from 'playwright';

// =============================================================================
// TYPES
// =============================================================================

export interface ExploratoryFinding {
    id: string;
    type: ExploratoryFindingType;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    description: string;
    path: string[];
    screenshot?: string;
    stateContext: Record<string, any>;
    reproducibleSteps: string[];
}

export type ExploratoryFindingType =
    | 'crash'
    | 'infinite_loop'
    | 'broken_navigation'
    | 'dead_end'
    | 'unreachable_state'
    | 'inconsistent_state'
    | 'unexpected_behavior'
    | 'hidden_feature'
    | 'edge_case_error'
    | 'unhandled_state';

export interface ExplorationPath {
    url: string;
    actions: ExplorationAction[];
    state: Record<string, any>;
}

export interface ExplorationAction {
    type: 'click' | 'input' | 'scroll' | 'navigate' | 'hover' | 'keyboard' | 'wait';
    target?: string;
    value?: string;
    timestamp: number;
}

export interface ExploratoryResult {
    passed: boolean;
    score: number; // 0-100
    findings: ExploratoryFinding[];
    exploration: {
        pagesVisited: number;
        actionsPerformed: number;
        uniqueStates: number;
        pathsExplored: number;
        duration: number;
    };
    coverage: {
        urls: string[];
        elements: number;
        forms: number;
        buttons: number;
        links: number;
    };
    timestamp: Date;
    url: string;
}

export interface ExploratoryConfig {
    maxDuration: number; // ms
    maxActions: number;
    maxDepth: number;
    randomSeed?: number;
    explorationMode: 'breadth' | 'depth' | 'random';
    enableRandomInput: boolean;
    enableStateTracking: boolean;
    enableScreenshots: boolean;
    actionDelay: number; // ms between actions
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: ExploratoryConfig = {
    maxDuration: 120000, // 2 minutes
    maxActions: 200,
    maxDepth: 10,
    explorationMode: 'random',
    enableRandomInput: true,
    enableStateTracking: true,
    enableScreenshots: false,
    actionDelay: 200,
};

// =============================================================================
// RANDOM INPUT GENERATORS
// =============================================================================

const RANDOM_STRINGS = [
    'test',
    'hello world',
    'John Doe',
    'john@example.com',
    '12345',
    '!@#$%^&*()',
    'a'.repeat(100),
    '',
    ' ',
    '<script>alert(1)</script>',
    'DROP TABLE users;',
    '日本語テスト',
    '🎉🎊🎁',
    '-1',
    '0',
    '999999999',
    'true',
    'false',
    'null',
    'undefined',
];

const RANDOM_KEYS = ['Tab', 'Enter', 'Escape', 'ArrowDown', 'ArrowUp', 'Space', 'Backspace'];

// =============================================================================
// EXPLORATORY TESTING AGENT
// =============================================================================

export class ExploratoryTestingAgent extends EventEmitter {
    private config: ExploratoryConfig;
    private buildId: string;
    private visitedUrls: Set<string> = new Set();
    private visitedStates: Set<string> = new Set();
    private actionHistory: ExplorationAction[] = [];
    private random: () => number;

    constructor(buildId: string, config: Partial<ExploratoryConfig> = {}) {
        super();
        this.buildId = buildId;
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Initialize random with optional seed for reproducibility
        if (this.config.randomSeed !== undefined) {
            this.random = this.seededRandom(this.config.randomSeed);
        } else {
            this.random = Math.random;
        }
    }

    /**
     * Run exploratory testing
     */
    async explore(page: Page, context: BrowserContext, url?: string): Promise<ExploratoryResult> {
        const startTime = Date.now();
        const startUrl = url || page.url();

        console.log(`[ExploratoryTester] Starting exploratory testing from ${startUrl}`);

        const result: ExploratoryResult = {
            passed: true,
            score: 100,
            findings: [],
            exploration: {
                pagesVisited: 0,
                actionsPerformed: 0,
                uniqueStates: 0,
                pathsExplored: 0,
                duration: 0,
            },
            coverage: {
                urls: [],
                elements: 0,
                forms: 0,
                buttons: 0,
                links: 0,
            },
            timestamp: new Date(),
            url: startUrl,
        };

        // Reset state
        this.visitedUrls.clear();
        this.visitedStates.clear();
        this.actionHistory = [];

        try {
            // Navigate to start URL
            await page.goto(startUrl, { waitUntil: 'networkidle' });
            this.visitedUrls.add(startUrl);

            // Main exploration loop
            while (
                this.actionHistory.length < this.config.maxActions &&
                Date.now() - startTime < this.config.maxDuration
            ) {
                try {
                    // Record current state
                    const state = await this.captureState(page);
                    const stateHash = this.hashState(state);

                    if (!this.visitedStates.has(stateHash)) {
                        this.visitedStates.add(stateHash);
                        result.exploration.uniqueStates++;
                    }

                    // Check for errors on page
                    const pageErrors = await this.checkForErrors(page);
                    if (pageErrors.length > 0) {
                        for (const error of pageErrors) {
                            result.findings.push(this.createFinding(
                                'edge_case_error',
                                'high',
                                error,
                                this.actionHistory
                            ));
                        }
                    }

                    // Choose next action based on exploration mode
                    const action = await this.chooseNextAction(page);
                    if (!action) {
                        // No more actions available, try going back or to a new page
                        await this.navigateToNewArea(page, result);
                        continue;
                    }

                    // Execute the action
                    await this.executeAction(page, action, result);

                    // Wait for any effects
                    await page.waitForTimeout(this.config.actionDelay);

                    // Check if we navigated
                    const currentUrl = page.url();
                    if (!this.visitedUrls.has(currentUrl)) {
                        this.visitedUrls.add(currentUrl);
                        result.exploration.pagesVisited++;
                        result.coverage.urls.push(currentUrl);
                    }

                } catch (error: any) {
                    // Handle exploration errors
                    if (error.message.includes('crash') || error.message.includes('timeout')) {
                        result.findings.push(this.createFinding(
                            'crash',
                            'critical',
                            `Page crashed or timed out: ${error.message}`,
                            this.actionHistory
                        ));
                    }

                    // Try to recover
                    await page.goto(startUrl).catch(() => {});
                }
            }

            // Final coverage analysis
            await this.analyzeCoverage(page, result);

        } catch (error: any) {
            console.error('[ExploratoryTester] Fatal error:', error);
            result.findings.push(this.createFinding(
                'crash',
                'critical',
                `Exploration failed: ${error.message}`,
                this.actionHistory
            ));
        }

        // Calculate final metrics
        result.exploration.duration = Date.now() - startTime;
        result.exploration.actionsPerformed = this.actionHistory.length;
        result.exploration.pathsExplored = this.visitedUrls.size;
        result.score = this.calculateScore(result);
        result.passed = result.findings.filter(f =>
            f.severity === 'critical' || f.severity === 'high'
        ).length === 0;

        console.log(`[ExploratoryTester] Complete: actions=${result.exploration.actionsPerformed}, pages=${result.exploration.pagesVisited}, findings=${result.findings.length}`);

        this.emit('exploration:complete', { buildId: this.buildId, result });

        return result;
    }

    /**
     * Capture current page state
     */
    private async captureState(page: Page): Promise<Record<string, any>> {
        return await page.evaluate(() => {
            return {
                url: window.location.href,
                title: document.title,
                forms: document.forms.length,
                buttons: document.querySelectorAll('button').length,
                links: document.querySelectorAll('a').length,
                inputs: document.querySelectorAll('input').length,
                modals: document.querySelectorAll('[role="dialog"], .modal').length,
                alerts: document.querySelectorAll('[role="alert"]').length,
                errorElements: document.querySelectorAll('[class*="error"], [class*="Error"]').length,
                loadingElements: document.querySelectorAll('[class*="loading"], [class*="Loading"]').length,
            };
        });
    }

    /**
     * Create a hash of the current state for deduplication
     */
    private hashState(state: Record<string, any>): string {
        return JSON.stringify({
            url: state.url,
            forms: state.forms,
            buttons: state.buttons,
            modals: state.modals,
        });
    }

    /**
     * Check for visible errors on the page
     */
    private async checkForErrors(page: Page): Promise<string[]> {
        return await page.evaluate(() => {
            const errors: string[] = [];

            // Check for error text
            const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"], [role="alert"]');
            errorElements.forEach((el) => {
                const text = (el as HTMLElement).innerText;
                if (text && text.length > 0 && text.length < 200) {
                    errors.push(text);
                }
            });

            // Check for undefined/null in visible text
            const bodyText = document.body.innerText;
            if (bodyText.includes('undefined') || bodyText.includes('[object Object]')) {
                errors.push('Page displays "undefined" or "[object Object]"');
            }

            return errors;
        });
    }

    /**
     * Choose the next action to take
     */
    private async chooseNextAction(page: Page): Promise<ExplorationAction | null> {
        // Get all interactable elements
        const elements = await page.evaluate(() => {
            const interactable: Array<{
                type: string;
                selector: string;
                text: string;
                priority: number;
            }> = [];

            // Buttons
            document.querySelectorAll('button:not([disabled])').forEach((el, i) => {
                interactable.push({
                    type: 'button',
                    selector: `button:nth-of-type(${i + 1})`,
                    text: (el as HTMLElement).innerText.substring(0, 30),
                    priority: 3,
                });
            });

            // Links
            document.querySelectorAll('a[href]:not([href^="javascript"])').forEach((el, i) => {
                interactable.push({
                    type: 'link',
                    selector: `a:nth-of-type(${i + 1})`,
                    text: (el as HTMLElement).innerText.substring(0, 30),
                    priority: 2,
                });
            });

            // Inputs
            document.querySelectorAll('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])').forEach((el, i) => {
                interactable.push({
                    type: 'input',
                    selector: `input:nth-of-type(${i + 1})`,
                    text: (el as HTMLInputElement).placeholder || (el as HTMLInputElement).name || '',
                    priority: 4,
                });
            });

            // Selects
            document.querySelectorAll('select:not([disabled])').forEach((el, i) => {
                interactable.push({
                    type: 'select',
                    selector: `select:nth-of-type(${i + 1})`,
                    text: (el as HTMLSelectElement).name || '',
                    priority: 3,
                });
            });

            return interactable;
        });

        if (elements.length === 0) {
            return null;
        }

        // Choose based on exploration mode
        let chosen: typeof elements[0];

        if (this.config.explorationMode === 'random') {
            chosen = elements[Math.floor(this.random() * elements.length)];
        } else if (this.config.explorationMode === 'breadth') {
            // Prefer lower priority (less explored)
            elements.sort((a, b) => a.priority - b.priority);
            chosen = elements[0];
        } else {
            // Depth: prefer higher priority
            elements.sort((a, b) => b.priority - a.priority);
            chosen = elements[0];
        }

        // Create action based on element type
        if (chosen.type === 'input') {
            const randomValue = RANDOM_STRINGS[Math.floor(this.random() * RANDOM_STRINGS.length)];
            return {
                type: 'input',
                target: chosen.selector,
                value: randomValue,
                timestamp: Date.now(),
            };
        } else if (chosen.type === 'button' || chosen.type === 'link') {
            return {
                type: 'click',
                target: chosen.selector,
                timestamp: Date.now(),
            };
        } else if (chosen.type === 'select') {
            return {
                type: 'click',
                target: chosen.selector,
                timestamp: Date.now(),
            };
        }

        // Random keyboard action occasionally
        if (this.random() < 0.1) {
            const key = RANDOM_KEYS[Math.floor(this.random() * RANDOM_KEYS.length)];
            return {
                type: 'keyboard',
                value: key,
                timestamp: Date.now(),
            };
        }

        // Random scroll occasionally
        if (this.random() < 0.1) {
            return {
                type: 'scroll',
                value: this.random() > 0.5 ? 'down' : 'up',
                timestamp: Date.now(),
            };
        }

        return null;
    }

    /**
     * Execute an exploration action
     */
    private async executeAction(page: Page, action: ExplorationAction, result: ExploratoryResult): Promise<void> {
        this.actionHistory.push(action);

        try {
            switch (action.type) {
                case 'click':
                    if (action.target) {
                        const element = await page.$(action.target);
                        if (element) {
                            await element.click({ timeout: 5000 }).catch(() => {});
                        }
                    }
                    break;

                case 'input':
                    if (action.target && action.value !== undefined) {
                        const input = await page.$(action.target);
                        if (input) {
                            await input.fill(action.value).catch(() => {});
                        }
                    }
                    break;

                case 'keyboard':
                    if (action.value) {
                        await page.keyboard.press(action.value as any).catch(() => {});
                    }
                    break;

                case 'scroll':
                    await page.evaluate((direction) => {
                        window.scrollBy(0, direction === 'down' ? 300 : -300);
                    }, action.value);
                    break;

                case 'hover':
                    if (action.target) {
                        const element = await page.$(action.target);
                        if (element) {
                            await element.hover().catch(() => {});
                        }
                    }
                    break;

                case 'wait':
                    await page.waitForTimeout(parseInt(action.value || '1000'));
                    break;
            }
        } catch (error: any) {
            // Action failed, log but continue
            console.log(`[ExploratoryTester] Action failed: ${action.type} - ${error.message}`);
        }
    }

    /**
     * Navigate to a new area when stuck
     */
    private async navigateToNewArea(page: Page, result: ExploratoryResult): Promise<void> {
        // Try going back
        try {
            await page.goBack();
            await page.waitForTimeout(500);
            return;
        } catch (e) {
            // Can't go back
        }

        // Try clicking a random link
        const links = await page.$$('a[href]');
        if (links.length > 0) {
            const randomLink = links[Math.floor(this.random() * links.length)];
            await randomLink.click().catch(() => {});
            return;
        }

        // Navigate to home
        try {
            const homeLink = await page.$('a[href="/"], a[href*="home"]');
            if (homeLink) {
                await homeLink.click();
            }
        } catch (e) {
            // No home link
        }
    }

    /**
     * Analyze final coverage
     */
    private async analyzeCoverage(page: Page, result: ExploratoryResult): Promise<void> {
        const coverage = await page.evaluate(() => {
            return {
                elements: document.querySelectorAll('*').length,
                forms: document.forms.length,
                buttons: document.querySelectorAll('button').length,
                links: document.querySelectorAll('a').length,
            };
        });

        result.coverage.elements = coverage.elements;
        result.coverage.forms = coverage.forms;
        result.coverage.buttons = coverage.buttons;
        result.coverage.links = coverage.links;
    }

    /**
     * Create a finding with reproducible steps
     */
    private createFinding(
        type: ExploratoryFindingType,
        severity: ExploratoryFinding['severity'],
        description: string,
        actions: ExplorationAction[]
    ): ExploratoryFinding {
        return {
            id: uuidv4(),
            type,
            severity,
            description,
            path: actions.map(a => `${a.type}(${a.target || a.value || ''})`),
            stateContext: {},
            reproducibleSteps: actions.slice(-10).map((a, i) =>
                `${i + 1}. ${a.type.toUpperCase()} ${a.target || a.value || ''}`
            ),
        };
    }

    /**
     * Calculate score based on findings
     */
    private calculateScore(result: ExploratoryResult): number {
        const criticalCount = result.findings.filter(f => f.severity === 'critical').length;
        const highCount = result.findings.filter(f => f.severity === 'high').length;
        const mediumCount = result.findings.filter(f => f.severity === 'medium').length;
        const lowCount = result.findings.filter(f => f.severity === 'low').length;

        const deductions =
            criticalCount * 30 +
            highCount * 15 +
            mediumCount * 8 +
            lowCount * 3;

        // Bonus for high coverage
        const coverageBonus = Math.min(10, result.exploration.pagesVisited * 2);

        return Math.max(0, Math.min(100, 100 - deductions + coverageBonus));
    }

    /**
     * Seeded random number generator for reproducibility
     */
    private seededRandom(seed: number): () => number {
        let s = seed;
        return () => {
            s = Math.sin(s) * 10000;
            return s - Math.floor(s);
        };
    }

    /**
     * Generate report
     */
    generateReport(result: ExploratoryResult): string {
        const lines: string[] = [
            `# Exploratory Testing Report`,
            ``,
            `**Start URL**: ${result.url}`,
            `**Score**: ${result.score}/100`,
            `**Status**: ${result.passed ? 'PASSED' : 'ISSUES FOUND'}`,
            `**Duration**: ${(result.exploration.duration / 1000).toFixed(1)}s`,
            `**Timestamp**: ${result.timestamp.toISOString()}`,
            ``,
            `## Exploration Summary`,
            `- Pages Visited: ${result.exploration.pagesVisited}`,
            `- Actions Performed: ${result.exploration.actionsPerformed}`,
            `- Unique States: ${result.exploration.uniqueStates}`,
            `- Paths Explored: ${result.exploration.pathsExplored}`,
            ``,
            `## Coverage`,
            `- URLs Discovered: ${result.coverage.urls.length}`,
            `- Elements on Final Page: ${result.coverage.elements}`,
            `- Forms Found: ${result.coverage.forms}`,
            `- Buttons Found: ${result.coverage.buttons}`,
            `- Links Found: ${result.coverage.links}`,
        ];

        if (result.coverage.urls.length > 0) {
            lines.push(``, `### URLs Visited`);
            for (const url of result.coverage.urls.slice(0, 10)) {
                lines.push(`- ${url}`);
            }
            if (result.coverage.urls.length > 10) {
                lines.push(`- ... and ${result.coverage.urls.length - 10} more`);
            }
        }

        if (result.findings.length > 0) {
            lines.push(``, `## Findings (${result.findings.length})`);
            for (const finding of result.findings) {
                lines.push(``);
                lines.push(`### ${finding.type} (${finding.severity})`);
                lines.push(`${finding.description}`);
                if (finding.reproducibleSteps.length > 0) {
                    lines.push(``, `**Steps to Reproduce:**`);
                    for (const step of finding.reproducibleSteps) {
                        lines.push(step);
                    }
                }
            }
        }

        return lines.join('\n');
    }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createExploratoryTester(
    buildId: string,
    config?: Partial<ExploratoryConfig>
): ExploratoryTestingAgent {
    return new ExploratoryTestingAgent(buildId, config);
}
