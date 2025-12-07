/**
 * User Twin Service
 *
 * AI-powered synthetic user testing that simulates real user behavior
 * to find bugs before deployment. Creates multiple concurrent "user twins"
 * with different personas to thoroughly test applications.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    BrowserAutomationService,
    type ConsoleLog,
    type NetworkRequest,
    type BrowserActionResult
} from '../automation/browser-service.js';
import { createOpenRouterClient, getPhaseConfig } from '../ai/openrouter-client.js';

// =============================================================================
// TYPES
// =============================================================================

export type PersonaBehavior = 'careful' | 'impatient' | 'explorer' | 'goal-oriented' | 'edge-case-finder';
export type TechLevel = 'novice' | 'intermediate' | 'power-user';
export type AccessibilityNeed = 'screen-reader' | 'keyboard-only' | 'high-contrast';

export interface UserPersona {
    id: string;
    name: string;
    behavior: PersonaBehavior;
    techLevel: TechLevel;
    accessibilityNeeds?: AccessibilityNeed[];
    goalPatterns: string[];
    avatar?: string; // Gradient or emoji identifier
}

export interface ActionRecord {
    id: string;
    timestamp: number;
    type: 'click' | 'type' | 'scroll' | 'navigate' | 'wait' | 'hover';
    target?: string;
    value?: string;
    result: 'success' | 'failed' | 'blocked';
    screenshot?: string;
    thinking?: string; // AI reasoning for this action
    duration: number;
}

export interface Issue {
    id: string;
    type: 'error' | 'warning' | 'accessibility' | 'ux' | 'performance';
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    location?: string;
    screenshot?: string;
    reproductionSteps: string[];
    timestamp: number;
    personaId: string;
    consoleError?: ConsoleLog;
    networkError?: NetworkRequest;
}

export interface TestResult {
    personaId: string;
    personaName: string;
    status: 'running' | 'completed' | 'failed' | 'stopped';
    actions: ActionRecord[];
    issuesFound: Issue[];
    journeyScore: number; // 0-100 user experience score
    completionTime: number;
    goalsCompleted: string[];
    goalsAttempted: string[];
    screenshots: string[];
    summary: string;
}

export interface TestPlan {
    id: string;
    name: string;
    description: string;
    entryUrl: string;
    goals: string[];
    maxActionsPerPersona: number;
    timeoutMs: number;
    focusAreas?: string[]; // e.g., "checkout flow", "login"
}

export interface TestSession {
    id: string;
    projectId: string;
    sandboxUrl: string;
    personas: UserPersona[];
    testPlan: TestPlan;
    results: Map<string, TestResult>;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
    startedAt?: Date;
    completedAt?: Date;
    aggregateScore?: number;
    totalIssues: number;
}

export interface TestProgress {
    sessionId: string;
    personaId: string;
    personaName: string;
    currentAction: string;
    actionCount: number;
    maxActions: number;
    issuesFound: number;
    lastScreenshot?: string;
    status: 'running' | 'completed' | 'failed';
}

export interface HeatmapData {
    url: string;
    clicks: Array<{ x: number; y: number; count: number }>;
    scrollDepth: number[];
    timeOnPage: number[];
    dropOffRate: number;
}

// =============================================================================
// PERSONA DEFINITIONS
// =============================================================================

export const PERSONA_BEHAVIOR_TRAITS: Record<PersonaBehavior, { description: string; traits: string[] }> = {
    'careful': {
        description: 'Reads everything carefully before acting, follows instructions precisely',
        traits: [
            'Reads all labels and descriptions before clicking',
            'Double-checks inputs before submitting',
            'Uses tab navigation frequently',
            'Rarely misses required fields',
            'Takes time to understand error messages'
        ]
    },
    'impatient': {
        description: 'Rushes through interfaces, clicks rapidly, skips instructions',
        traits: [
            'Clicks submit immediately without reading',
            'Skips optional fields',
            'Gets frustrated by loading times',
            'May double-click or spam buttons',
            'Abandons slow processes'
        ]
    },
    'explorer': {
        description: 'Curious, clicks on everything, tests edge cases naturally',
        traits: [
            'Clicks on random elements to see what happens',
            'Tests unusual input combinations',
            'Explores all navigation options',
            'Opens multiple tabs',
            'Bookmarks interesting pages'
        ]
    },
    'goal-oriented': {
        description: 'Focused on completing specific tasks efficiently',
        traits: [
            'Stays focused on primary goal',
            'Ignores distractions',
            'Uses search functionality when available',
            'Expects clear navigation',
            'Gets frustrated by unnecessary steps'
        ]
    },
    'edge-case-finder': {
        description: 'Naturally tests boundaries and unusual inputs',
        traits: [
            'Enters very long text in inputs',
            'Tries special characters',
            'Tests with empty inputs',
            'Clicks buttons multiple times rapidly',
            'Navigates back and forth unexpectedly'
        ]
    }
};

export const TECH_LEVEL_DESCRIPTIONS: Record<TechLevel, string> = {
    'novice': 'New to technology, needs clear guidance, may not understand tech jargon',
    'intermediate': 'Comfortable with basic tasks, can follow instructions, occasionally needs help',
    'power-user': 'Expert, uses keyboard shortcuts, expects advanced features, notices subtle issues'
};

// =============================================================================
// DEFAULT PERSONAS
// =============================================================================

export const DEFAULT_PERSONAS: UserPersona[] = [
    {
        id: 'persona-careful-novice',
        name: 'Careful Carol',
        behavior: 'careful',
        techLevel: 'novice',
        goalPatterns: ['complete main task', 'find help documentation'],
        avatar: '👩‍💼'
    },
    {
        id: 'persona-impatient-intermediate',
        name: 'Impatient Ivan',
        behavior: 'impatient',
        techLevel: 'intermediate',
        goalPatterns: ['complete checkout quickly', 'skip optional steps'],
        avatar: '🏃'
    },
    {
        id: 'persona-explorer-power',
        name: 'Explorer Emma',
        behavior: 'explorer',
        techLevel: 'power-user',
        goalPatterns: ['find all features', 'test edge cases'],
        avatar: '🔍'
    },
    {
        id: 'persona-goal-intermediate',
        name: 'Goal-Getter Gary',
        behavior: 'goal-oriented',
        techLevel: 'intermediate',
        goalPatterns: ['complete primary task efficiently'],
        avatar: '🎯'
    },
    {
        id: 'persona-edge-power',
        name: 'Edge-Case Eddie',
        behavior: 'edge-case-finder',
        techLevel: 'power-user',
        goalPatterns: ['find bugs', 'test error handling'],
        avatar: '🔧'
    },
    {
        id: 'persona-a11y-keyboard',
        name: 'Keyboard Kate',
        behavior: 'careful',
        techLevel: 'intermediate',
        accessibilityNeeds: ['keyboard-only'],
        goalPatterns: ['navigate using only keyboard', 'complete forms without mouse'],
        avatar: '⌨️'
    }
];

// =============================================================================
// SERVICE
// =============================================================================

export class UserTwinService extends EventEmitter {
    private sessions: Map<string, TestSession> = new Map();
    private activeBrowsers: Map<string, BrowserAutomationService> = new Map();
    private openRouterClient = createOpenRouterClient();

    constructor() {
        super();
    }

    /**
     * Start a new synthetic testing session
     */
    async startSession(config: {
        projectId: string;
        sandboxUrl: string;
        personas?: UserPersona[];
        testPlan?: Partial<TestPlan>;
    }): Promise<TestSession> {
        const sessionId = uuidv4();

        const testPlan: TestPlan = {
            id: uuidv4(),
            name: config.testPlan?.name || 'Synthetic User Test',
            description: config.testPlan?.description || 'Automated user behavior testing',
            entryUrl: config.sandboxUrl,
            goals: config.testPlan?.goals || ['explore the application', 'find usability issues'],
            maxActionsPerPersona: config.testPlan?.maxActionsPerPersona || 50,
            timeoutMs: config.testPlan?.timeoutMs || 300000, // 5 minutes
            focusAreas: config.testPlan?.focusAreas,
        };

        const personas = config.personas || DEFAULT_PERSONAS.slice(0, 3);

        const session: TestSession = {
            id: sessionId,
            projectId: config.projectId,
            sandboxUrl: config.sandboxUrl,
            personas,
            testPlan,
            results: new Map(),
            status: 'pending',
            totalIssues: 0,
        };

        // Initialize results for each persona
        personas.forEach(persona => {
            session.results.set(persona.id, {
                personaId: persona.id,
                personaName: persona.name,
                status: 'running',
                actions: [],
                issuesFound: [],
                journeyScore: 100,
                completionTime: 0,
                goalsCompleted: [],
                goalsAttempted: testPlan.goals,
                screenshots: [],
                summary: '',
            });
        });

        this.sessions.set(sessionId, session);

        // Start testing
        session.status = 'running';
        session.startedAt = new Date();

        this.emit('session_started', { sessionId, personas: personas.map(p => p.name) });

        // Run persona tests concurrently
        this.runConcurrentTests(session);

        return session;
    }

    /**
     * Run tests for all personas concurrently
     */
    private async runConcurrentTests(session: TestSession): Promise<void> {
        const promises = session.personas.map(persona =>
            this.runPersonaTest(session, persona)
        );

        try {
            await Promise.all(promises);

            // Calculate aggregate score
            let totalScore = 0;
            let totalIssues = 0;
            session.results.forEach(result => {
                totalScore += result.journeyScore;
                totalIssues += result.issuesFound.length;
            });

            session.aggregateScore = Math.round(totalScore / session.personas.length);
            session.totalIssues = totalIssues;
            session.status = 'completed';
            session.completedAt = new Date();

            this.emit('session_completed', {
                sessionId: session.id,
                aggregateScore: session.aggregateScore,
                totalIssues: session.totalIssues,
            });
        } catch (error) {
            session.status = 'failed';
            session.completedAt = new Date();

            this.emit('session_failed', {
                sessionId: session.id,
                error: (error as Error).message,
            });
        }
    }

    /**
     * Run a single persona's test
     */
    private async runPersonaTest(session: TestSession, persona: UserPersona): Promise<void> {
        const browserId = `${session.id}-${persona.id}`;
        const result = session.results.get(persona.id)!;
        const startTime = Date.now();

        // Initialize browser for this persona
        const browser = new BrowserAutomationService({
            headed: false,
            slowMo: this.getSlowMoForPersona(persona),
            viewport: { width: 1280, height: 720 },
            timeout: 30000,
        });

        this.activeBrowsers.set(browserId, browser);

        try {
            await browser.initialize();

            // Navigate to entry URL
            const navResult = await browser.navigateTo(session.testPlan.entryUrl);
            if (!navResult.success) {
                throw new Error(`Failed to navigate to ${session.testPlan.entryUrl}`);
            }

            if (navResult.screenshot) {
                result.screenshots.push(navResult.screenshot);
            }

            // Execute persona-driven actions
            let actionCount = 0;
            const maxActions = session.testPlan.maxActionsPerPersona;
            const timeout = Date.now() + session.testPlan.timeoutMs;

            while (actionCount < maxActions && Date.now() < timeout && result.status === 'running') {
                // Get current page state
                const pageState = await this.getPageState(browser);

                // AI decides next action
                const nextAction = await this.decideNextAction(persona, session.testPlan, pageState, result.actions);

                if (nextAction.type === 'complete') {
                    // AI determined the persona has achieved their goals
                    result.goalsCompleted.push(nextAction.value || 'primary goal');
                    break;
                }

                // Execute the action
                const actionStart = Date.now();
                const actionResult = await this.executePersonaAction(browser, nextAction, persona);
                const actionDuration = Date.now() - actionStart;

                // Record the action
                const actionRecord: ActionRecord = {
                    id: uuidv4(),
                    timestamp: Date.now(),
                    type: nextAction.type as ActionRecord['type'],
                    target: nextAction.target,
                    value: nextAction.value,
                    result: actionResult.success ? 'success' : 'failed',
                    screenshot: actionResult.screenshot,
                    thinking: nextAction.thinking,
                    duration: actionDuration,
                };
                result.actions.push(actionRecord);

                // Check for issues
                const issues = await this.detectIssues(browser, persona, actionResult, pageState);
                if (issues.length > 0) {
                    result.issuesFound.push(...issues);
                    result.journeyScore = Math.max(0, result.journeyScore - issues.length * 5);
                }

                // Emit progress
                this.emit('persona_progress', {
                    sessionId: session.id,
                    personaId: persona.id,
                    personaName: persona.name,
                    currentAction: nextAction.description || nextAction.type,
                    actionCount: actionCount + 1,
                    maxActions,
                    issuesFound: result.issuesFound.length,
                    lastScreenshot: actionResult.screenshot,
                    status: 'running',
                } as TestProgress);

                actionCount++;

                // Small delay between actions (varies by persona)
                await this.delay(this.getDelayForPersona(persona));
            }

            result.completionTime = Date.now() - startTime;
            result.status = 'completed';

            // Generate summary
            result.summary = await this.generateResultSummary(persona, result);

        } catch (error) {
            result.status = 'failed';
            result.summary = `Test failed: ${(error as Error).message}`;
            result.journeyScore = 0;
        } finally {
            // Clean up browser
            try {
                await browser.close();
            } catch {
                // Ignore cleanup errors
            }
            this.activeBrowsers.delete(browserId);

            this.emit('persona_completed', {
                sessionId: session.id,
                personaId: persona.id,
                personaName: persona.name,
                status: result.status,
                journeyScore: result.journeyScore,
                issuesFound: result.issuesFound.length,
                actionsPerformed: result.actions.length,
            });
        }
    }

    /**
     * Get current page state for AI decision making
     */
    private async getPageState(browser: BrowserAutomationService): Promise<{
        url: string;
        title: string;
        visibleElements: string[];
        formFields: string[];
        consoleLogs: ConsoleLog[];
        networkRequests: NetworkRequest[];
    }> {
        // Get visible interactive elements
        const elements = await browser.getVisibleElements();

        return {
            url: browser.getCurrentUrl() || '',
            title: browser.getPageTitle() || '',
            visibleElements: elements.map(e =>
                `${e.tagName}${e.text ? `: "${e.text.substring(0, 50)}"` : ''}${e.attributes.id ? `#${e.attributes.id}` : ''}`
            ).slice(0, 30),
            formFields: elements.filter(e =>
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName)
            ).map(e => e.attributes.name || e.attributes.id || e.tagName),
            consoleLogs: browser.getConsoleLogs().slice(-10),
            networkRequests: browser.getNetworkRequests().filter(r => r.failed).slice(-5),
        };
    }

    /**
     * AI decides what action the persona should take next
     */
    private async decideNextAction(
        persona: UserPersona,
        testPlan: TestPlan,
        pageState: {
            url: string;
            title: string;
            visibleElements: string[];
            formFields: string[];
            consoleLogs: ConsoleLog[];
            networkRequests: NetworkRequest[];
        },
        previousActions: ActionRecord[]
    ): Promise<{
        type: string;
        target?: string;
        value?: string;
        description?: string;
        thinking?: string;
    }> {
        const behaviorTraits = PERSONA_BEHAVIOR_TRAITS[persona.behavior];
        const techDescription = TECH_LEVEL_DESCRIPTIONS[persona.techLevel];

        const systemPrompt = `You are simulating a ${persona.behavior} user named "${persona.name}" with ${persona.techLevel} tech experience.

${behaviorTraits.description}

Traits:
${behaviorTraits.traits.map(t => `- ${t}`).join('\n')}

Tech level: ${techDescription}

${persona.accessibilityNeeds?.length ? `Accessibility needs: ${persona.accessibilityNeeds.join(', ')}` : ''}

Goals: ${persona.goalPatterns.join(', ')}
Test focus: ${testPlan.focusAreas?.join(', ') || 'general exploration'}`;

        const userPrompt = `Current page: ${pageState.url}
Title: ${pageState.title}

Visible elements:
${pageState.visibleElements.join('\n')}

Form fields available: ${pageState.formFields.join(', ') || 'none'}

Recent console errors: ${pageState.consoleLogs.filter(l => l.type === 'error').length}
Failed network requests: ${pageState.networkRequests.length}

Previous actions in this session:
${previousActions.slice(-5).map(a => `- ${a.type}: ${a.target || 'page'} (${a.result})`).join('\n') || 'None yet'}

Based on this ${persona.behavior} persona's behavior, decide what they would do next.

Respond with JSON:
{
  "type": "click" | "type" | "scroll" | "navigate" | "wait" | "hover" | "complete",
  "target": "CSS selector or description of element",
  "value": "text to type or URL to navigate to (if applicable)",
  "description": "what the user is trying to do",
  "thinking": "why this persona would take this action"
}

If the persona has achieved their goals or explored sufficiently, use type "complete".`;

        try {
            const phaseConfig = getPhaseConfig('error_check');
            const response = await this.openRouterClient.generate({
                model: phaseConfig.model,
                systemPrompt,
                userPrompt,
                maxTokens: 1000,
            });

            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('Failed to decide action:', error);
        }

        // Fallback action
        return {
            type: 'scroll',
            description: 'Scrolling to see more content',
            thinking: 'Default action when AI decision fails',
        };
    }

    /**
     * Execute an action based on persona characteristics
     */
    private async executePersonaAction(
        browser: BrowserAutomationService,
        action: { type: string; target?: string; value?: string; description?: string },
        persona: UserPersona
    ): Promise<BrowserActionResult> {
        try {
            // Add persona-specific behavior
            if (persona.behavior === 'impatient' && Math.random() > 0.7) {
                // Impatient users sometimes double-click
                await browser.executeAction(`double click on ${action.target || 'page'}`);
            }

            if (persona.accessibilityNeeds?.includes('keyboard-only')) {
                // Use keyboard navigation
                return await browser.executeAction(`press Tab key then ${action.type} using keyboard`);
            }

            // Execute the action
            switch (action.type) {
                case 'click':
                    return await browser.executeAction(`click on ${action.target}`);

                case 'type':
                    const textToType = persona.behavior === 'edge-case-finder'
                        ? this.generateEdgeCaseInput(action.value || '')
                        : action.value;
                    return await browser.executeAction(`type "${textToType}" in ${action.target}`);

                case 'scroll':
                    return await browser.executeAction('scroll down the page');

                case 'navigate':
                    return await browser.navigateTo(action.value || '');

                case 'hover':
                    return await browser.executeAction(`hover over ${action.target}`);

                case 'wait':
                    await this.delay(1000);
                    return {
                        success: true,
                        actionDescription: 'Waited for page to load',
                    };

                default:
                    return await browser.executeAction(action.description || 'explore the page');
            }
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message,
            };
        }
    }

    /**
     * Detect issues from browser state
     */
    private async detectIssues(
        browser: BrowserAutomationService,
        persona: UserPersona,
        actionResult: BrowserActionResult,
        pageState: { consoleLogs: ConsoleLog[]; networkRequests: NetworkRequest[] }
    ): Promise<Issue[]> {
        const issues: Issue[] = [];

        // Check for console errors
        const recentErrors = pageState.consoleLogs.filter(log =>
            log.type === 'error' && Date.now() - log.timestamp.getTime() < 5000
        );

        recentErrors.forEach(error => {
            issues.push({
                id: uuidv4(),
                type: 'error',
                severity: 'high',
                title: 'JavaScript Error',
                description: error.message,
                location: error.url,
                screenshot: actionResult.screenshot,
                reproductionSteps: [`Navigate to ${browser.getCurrentUrl()}`, 'Error appeared in console'],
                timestamp: Date.now(),
                personaId: persona.id,
                consoleError: error,
            });
        });

        // Check for failed network requests
        const failedRequests = pageState.networkRequests.filter(r => r.failed);
        failedRequests.forEach(req => {
            issues.push({
                id: uuidv4(),
                type: 'error',
                severity: req.url.includes('/api/') ? 'critical' : 'medium',
                title: 'Network Request Failed',
                description: `${req.method} ${req.url} failed: ${req.errorText}`,
                location: req.url,
                screenshot: actionResult.screenshot,
                reproductionSteps: [`Navigate to ${browser.getCurrentUrl()}`, `Request to ${req.url} failed`],
                timestamp: Date.now(),
                personaId: persona.id,
                networkError: req,
            });
        });

        // Check for action failures
        if (!actionResult.success) {
            issues.push({
                id: uuidv4(),
                type: 'ux',
                severity: 'medium',
                title: 'User Action Failed',
                description: actionResult.error || 'Action could not be completed',
                screenshot: actionResult.screenshot,
                reproductionSteps: [`Navigate to ${browser.getCurrentUrl()}`, 'Attempt action'],
                timestamp: Date.now(),
                personaId: persona.id,
            });
        }

        // Check for accessibility issues if persona has needs
        if (persona.accessibilityNeeds?.length) {
            const a11yIssues = await this.checkAccessibility(browser, persona);
            issues.push(...a11yIssues);
        }

        return issues;
    }

    /**
     * Check accessibility for personas with accessibility needs
     */
    private async checkAccessibility(
        browser: BrowserAutomationService,
        persona: UserPersona
    ): Promise<Issue[]> {
        const issues: Issue[] = [];

        if (persona.accessibilityNeeds?.includes('keyboard-only')) {
            // Check for elements without focus indicators
            try {
                const focusCheck = await browser.executeAction('check if all buttons have visible focus states');
                if (!focusCheck.success) {
                    issues.push({
                        id: uuidv4(),
                        type: 'accessibility',
                        severity: 'high',
                        title: 'Missing Focus Indicators',
                        description: 'Some interactive elements lack visible focus states',
                        screenshot: focusCheck.screenshot,
                        reproductionSteps: ['Tab through the page', 'Look for visible focus indicators'],
                        timestamp: Date.now(),
                        personaId: persona.id,
                    });
                }
            } catch {
                // Ignore check failures
            }
        }

        return issues;
    }

    /**
     * Generate edge case input for testing
     */
    private generateEdgeCaseInput(normalInput: string): string {
        const edgeCases = [
            () => normalInput.repeat(100), // Very long input
            () => '<script>alert("xss")</script>', // XSS attempt
            () => "'; DROP TABLE users; --", // SQL injection attempt
            () => '🎉🎊🎈😀', // Emoji
            () => '   ', // Only spaces
            () => '', // Empty
            () => '-1', // Negative number
            () => '99999999999999999999', // Very large number
        ];

        const randomCase = edgeCases[Math.floor(Math.random() * edgeCases.length)];
        return randomCase();
    }

    /**
     * Generate result summary
     */
    private async generateResultSummary(persona: UserPersona, result: TestResult): Promise<string> {
        const systemPrompt = 'You are a QA report writer. Generate a brief, professional summary.';
        const userPrompt = `Summarize this synthetic user test:
Persona: ${persona.name} (${persona.behavior}, ${persona.techLevel})
Actions: ${result.actions.length}
Issues found: ${result.issuesFound.length}
Journey score: ${result.journeyScore}/100
Goals attempted: ${result.goalsAttempted.join(', ')}
Goals completed: ${result.goalsCompleted.join(', ') || 'none'}

Provide a 2-3 sentence summary.`;

        try {
            const response = await this.openRouterClient.generate({
                model: 'claude-3-5-haiku-latest',
                systemPrompt,
                userPrompt,
                maxTokens: 200,
            });
            return response.content.trim();
        } catch {
            return `${persona.name} performed ${result.actions.length} actions, finding ${result.issuesFound.length} issues. Journey score: ${result.journeyScore}/100.`;
        }
    }

    /**
     * Get slowMo delay based on persona behavior
     */
    private getSlowMoForPersona(persona: UserPersona): number {
        switch (persona.behavior) {
            case 'impatient':
                return 50;
            case 'careful':
                return 300;
            case 'explorer':
                return 150;
            default:
                return 100;
        }
    }

    /**
     * Get delay between actions based on persona
     */
    private getDelayForPersona(persona: UserPersona): number {
        switch (persona.behavior) {
            case 'impatient':
                return 200 + Math.random() * 300;
            case 'careful':
                return 1000 + Math.random() * 1500;
            case 'explorer':
                return 500 + Math.random() * 1000;
            default:
                return 500 + Math.random() * 500;
        }
    }

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Stop a running session
     */
    async stopSession(sessionId: string): Promise<TestSession | null> {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        session.status = 'stopped';
        session.completedAt = new Date();

        // Mark all running results as stopped
        session.results.forEach(result => {
            if (result.status === 'running') {
                result.status = 'completed';
            }
        });

        // Close all browsers for this session
        for (const [browserId, browser] of this.activeBrowsers.entries()) {
            if (browserId.startsWith(sessionId)) {
                try {
                    await browser.close();
                } catch {
                    // Ignore
                }
                this.activeBrowsers.delete(browserId);
            }
        }

        this.emit('session_stopped', { sessionId });

        return session;
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): TestSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Get session results
     */
    getSessionResults(sessionId: string): TestResult[] | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        return Array.from(session.results.values());
    }

    /**
     * Generate heatmap data from session results
     */
    generateHeatmap(sessionId: string): HeatmapData[] {
        const session = this.sessions.get(sessionId);
        if (!session) return [];

        const heatmaps: Map<string, HeatmapData> = new Map();

        session.results.forEach(result => {
            result.actions
                .filter(a => a.type === 'click')
                .forEach(action => {
                    // This would need actual click coordinates from the browser
                    // For now, create placeholder heatmap structure
                    const url = session.sandboxUrl;
                    if (!heatmaps.has(url)) {
                        heatmaps.set(url, {
                            url,
                            clicks: [],
                            scrollDepth: [],
                            timeOnPage: [],
                            dropOffRate: 0,
                        });
                    }
                });
        });

        return Array.from(heatmaps.values());
    }

    /**
     * Get all issues across all sessions for a project
     */
    getProjectIssues(projectId: string): Issue[] {
        const issues: Issue[] = [];

        this.sessions.forEach(session => {
            if (session.projectId === projectId) {
                session.results.forEach(result => {
                    issues.push(...result.issuesFound);
                });
            }
        });

        return issues.sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }
}

// =============================================================================
// SINGLETON & FACTORY
// =============================================================================

let instance: UserTwinService | null = null;

export function getUserTwinService(): UserTwinService {
    if (!instance) {
        instance = new UserTwinService();
    }
    return instance;
}

export function createUserTwinService(): UserTwinService {
    return new UserTwinService();
}

