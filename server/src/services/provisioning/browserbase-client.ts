/**
 * Browserbase + Stagehand Integration
 *
 * Cloud-based browser infrastructure for autonomous provisioning:
 * - Browserbase provides scalable, secure browser instances
 * - Stagehand v3 provides AI-powered navigation with natural language
 * - Gemini 3 Flash for fast vision-based navigation
 * - Claude Sonnet 4.5 for complex decision making
 *
 * This replaces the manual credential fetching workflow with
 * fully autonomous browser agents.
 */

import { db } from '../../db.js';
import { browserAgentTasks, browserAgentAuditLog } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { getModelRouter } from '../ai/model-router.js';

// ============================================================================
// TYPES
// ============================================================================

export interface BrowserbaseConfig {
    apiKey: string;
    projectId?: string;
    region?: 'us-east-1' | 'us-west-2' | 'eu-west-1';
    enableProxy?: boolean;
    proxyCountry?: string;
    sessionTimeout?: number; // ms
}

export interface BrowserSession {
    id: string;
    browserbaseSessionId: string;
    liveViewUrl: string;
    debuggerUrl?: string;
    status: 'starting' | 'active' | 'completed' | 'failed';
    createdAt: Date;
}

export interface NavigationStep {
    action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'extract' | 'assert';
    target?: string; // Natural language description or CSS selector
    value?: string;
    timeout?: number;
}

export interface NavigationResult {
    success: boolean;
    action: string;
    elementFound?: boolean;
    extractedData?: Record<string, string>;
    screenshotBase64?: string;
    error?: string;
    durationMs: number;
}

export interface StagehandAction {
    action: string;
    selector?: string;
    value?: string;
    timestamp: string;
    success: boolean;
    error?: string;
}

// ============================================================================
// BROWSERBASE CLIENT
// ============================================================================

export class BrowserbaseClient {
    private config: BrowserbaseConfig;
    private modelRouter = getModelRouter();
    private activeSessions: Map<string, BrowserSession> = new Map();

    constructor(config?: Partial<BrowserbaseConfig>) {
        this.config = {
            apiKey: config?.apiKey || process.env.BROWSERBASE_API_KEY || '',
            projectId: config?.projectId || process.env.BROWSERBASE_PROJECT_ID,
            region: config?.region || 'us-east-1',
            enableProxy: config?.enableProxy ?? true,
            sessionTimeout: config?.sessionTimeout || 300000, // 5 minutes default
        };
    }

    /**
     * Check if Browserbase is configured
     */
    isConfigured(): boolean {
        return !!this.config.apiKey;
    }

    /**
     * Create a new browser session
     */
    async createSession(taskId: string): Promise<BrowserSession> {
        if (!this.isConfigured()) {
            throw new Error('Browserbase not configured. Set BROWSERBASE_API_KEY environment variable.');
        }

        try {
            // Create session via Browserbase API
            const response = await fetch('https://www.browserbase.com/v1/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    projectId: this.config.projectId,
                    region: this.config.region,
                    browserSettings: {
                        viewport: { width: 1920, height: 1080 },
                        fingerprint: { browserListQuery: 'chrome' },
                        context: {
                            id: taskId,
                            persist: false, // Don't persist context between sessions
                        },
                    },
                    proxies: this.config.enableProxy ? [{ type: 'browserbase' }] : undefined,
                    timeout: this.config.sessionTimeout,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(`Browserbase API error: ${error.error || response.statusText}`);
            }

            const data = await response.json();

            const session: BrowserSession = {
                id: taskId,
                browserbaseSessionId: data.id,
                liveViewUrl: data.liveUrls?.viewer || `https://www.browserbase.com/sessions/${data.id}/live`,
                debuggerUrl: data.liveUrls?.debugger,
                status: 'active',
                createdAt: new Date(),
            };

            this.activeSessions.set(taskId, session);

            // Update task with session info
            await db.update(browserAgentTasks)
                .set({
                    browserbaseSessionId: data.id,
                    liveViewUrl: session.liveViewUrl,
                    status: 'running',
                    startedAt: new Date().toISOString(),
                })
                .where(eq(browserAgentTasks.id, taskId));

            return session;
        } catch (error) {
            console.error('[Browserbase] Failed to create session:', error);
            throw error;
        }
    }

    /**
     * Execute a navigation step using Stagehand-style natural language
     * Uses Gemini 3 Flash for fast vision-based element detection
     */
    async executeStep(
        taskId: string,
        step: NavigationStep,
        auditContext: { userId: string; provisioningSessionId: string }
    ): Promise<NavigationResult> {
        const session = this.activeSessions.get(taskId);
        if (!session) {
            throw new Error(`No active session for task: ${taskId}`);
        }

        const startTime = Date.now();
        let result: NavigationResult;

        try {
            // Use Browserbase CDP API to execute actions
            const action = await this.translateToPlaywrightAction(step);

            // Execute via Browserbase CDP endpoint
            const response = await fetch(
                `https://www.browserbase.com/v1/sessions/${session.browserbaseSessionId}/command`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        command: action.command,
                        params: action.params,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`CDP command failed: ${response.statusText}`);
            }

            const commandResult = await response.json();

            result = {
                success: true,
                action: step.action,
                elementFound: commandResult.elementFound,
                extractedData: commandResult.extractedData,
                screenshotBase64: commandResult.screenshot,
                durationMs: Date.now() - startTime,
            };

        } catch (error) {
            result = {
                success: false,
                action: step.action,
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs: Date.now() - startTime,
            };
        }

        // Log the action for audit
        await this.logAction(taskId, step, result, auditContext);

        return result;
    }

    /**
     * Execute a natural language instruction using AI vision
     * This is the core Stagehand-style interface
     */
    async executeNaturalLanguage(
        taskId: string,
        instruction: string,
        auditContext: { userId: string; provisioningSessionId: string }
    ): Promise<NavigationResult> {
        const session = this.activeSessions.get(taskId);
        if (!session) {
            throw new Error(`No active session for task: ${taskId}`);
        }

        const startTime = Date.now();

        try {
            // Take screenshot for vision analysis
            const screenshot = await this.takeScreenshot(taskId);

            // Use Gemini 3 Flash for fast vision-based navigation
            // Falls back to Claude if Gemini unavailable
            const analysisResult = await this.modelRouter.generate({
                prompt: `You are a browser automation expert. Analyze this screenshot and determine the exact action to take.

Instruction: ${instruction}

Based on the screenshot, identify:
1. The exact element to interact with (provide CSS selector or coordinates)
2. The type of action needed (click, type, scroll, etc.)
3. Any value to input if applicable

Respond ONLY with valid JSON:
{
    "action": "click" | "type" | "scroll" | "wait",
    "target": "CSS selector or description",
    "value": "text to type if applicable",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation"
}`,
                taskType: 'vision',
                forceTier: 'standard', // Use fast model for navigation
                maxTokens: 500,
                images: [{ url: `data:image/png;base64,${screenshot}`, detail: 'high' as const }],
            });

            // Parse the AI response
            const jsonMatch = analysisResult.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to parse AI navigation response');
            }

            const navAction = JSON.parse(jsonMatch[0]);

            // Execute the determined action
            const step: NavigationStep = {
                action: navAction.action,
                target: navAction.target,
                value: navAction.value,
            };

            return await this.executeStep(taskId, step, auditContext);

        } catch (error) {
            const result: NavigationResult = {
                success: false,
                action: 'natural_language',
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs: Date.now() - startTime,
            };

            await this.logAction(taskId, { action: 'navigate', target: instruction }, result, auditContext);
            return result;
        }
    }

    /**
     * Navigate to a URL
     */
    async navigateTo(
        taskId: string,
        url: string,
        auditContext: { userId: string; provisioningSessionId: string }
    ): Promise<NavigationResult> {
        return this.executeStep(
            taskId,
            { action: 'navigate', value: url },
            auditContext
        );
    }

    /**
     * Take a screenshot
     */
    async takeScreenshot(taskId: string): Promise<string> {
        const session = this.activeSessions.get(taskId);
        if (!session) {
            throw new Error(`No active session for task: ${taskId}`);
        }

        try {
            const response = await fetch(
                `https://www.browserbase.com/v1/sessions/${session.browserbaseSessionId}/screenshot`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Screenshot failed: ${response.statusText}`);
            }

            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            return Buffer.from(buffer).toString('base64');
        } catch (error) {
            console.error('[Browserbase] Screenshot failed:', error);
            throw error;
        }
    }

    /**
     * Extract data from the page
     */
    async extractData(
        taskId: string,
        selectors: Record<string, string>,
        auditContext: { userId: string; provisioningSessionId: string }
    ): Promise<Record<string, string>> {
        const session = this.activeSessions.get(taskId);
        if (!session) {
            throw new Error(`No active session for task: ${taskId}`);
        }

        try {
            // Use CDP to extract text content from selectors
            const response = await fetch(
                `https://www.browserbase.com/v1/sessions/${session.browserbaseSessionId}/command`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        command: 'Runtime.evaluate',
                        params: {
                            expression: `
                                (function() {
                                    const selectors = ${JSON.stringify(selectors)};
                                    const result = {};
                                    for (const [key, selector] of Object.entries(selectors)) {
                                        const el = document.querySelector(selector);
                                        result[key] = el ? (el.value || el.textContent || el.innerText) : null;
                                    }
                                    return result;
                                })()
                            `,
                            returnByValue: true,
                        },
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`Data extraction failed: ${response.statusText}`);
            }

            const { result } = await response.json();
            const extractedData = result?.value || {};

            // Log extraction for audit
            await this.logAction(
                taskId,
                { action: 'extract', target: Object.keys(selectors).join(', ') },
                { success: true, action: 'extract', extractedData, durationMs: 0 },
                auditContext
            );

            return extractedData;
        } catch (error) {
            console.error('[Browserbase] Data extraction failed:', error);
            throw error;
        }
    }

    /**
     * Wait for a condition
     */
    async waitFor(
        taskId: string,
        condition: string,
        timeout: number = 10000
    ): Promise<boolean> {
        const session = this.activeSessions.get(taskId);
        if (!session) {
            throw new Error(`No active session for task: ${taskId}`);
        }

        try {
            const response = await fetch(
                `https://www.browserbase.com/v1/sessions/${session.browserbaseSessionId}/command`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        command: 'Runtime.evaluate',
                        params: {
                            expression: `
                                new Promise((resolve) => {
                                    const start = Date.now();
                                    const check = () => {
                                        const el = document.querySelector('${condition}');
                                        if (el || Date.now() - start > ${timeout}) {
                                            resolve(!!el);
                                        } else {
                                            requestAnimationFrame(check);
                                        }
                                    };
                                    check();
                                })
                            `,
                            awaitPromise: true,
                            returnByValue: true,
                        },
                    }),
                }
            );

            if (!response.ok) {
                return false;
            }

            const { result } = await response.json();
            return result?.value || false;
        } catch (error) {
            console.error('[Browserbase] Wait failed:', error);
            return false;
        }
    }

    /**
     * Close a browser session
     */
    async closeSession(taskId: string): Promise<void> {
        const session = this.activeSessions.get(taskId);
        if (!session) {
            return;
        }

        try {
            await fetch(
                `https://www.browserbase.com/v1/sessions/${session.browserbaseSessionId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                    },
                }
            );

            session.status = 'completed';
            this.activeSessions.delete(taskId);

            await db.update(browserAgentTasks)
                .set({
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                })
                .where(eq(browserAgentTasks.id, taskId));
        } catch (error) {
            console.error('[Browserbase] Failed to close session:', error);
        }
    }

    /**
     * Get session status
     */
    async getSessionStatus(taskId: string): Promise<BrowserSession | null> {
        return this.activeSessions.get(taskId) || null;
    }

    /**
     * Translate NavigationStep to Browserbase CDP command
     */
    private async translateToPlaywrightAction(step: NavigationStep): Promise<{
        command: string;
        params: Record<string, unknown>;
    }> {
        switch (step.action) {
            case 'navigate':
                return {
                    command: 'Page.navigate',
                    params: { url: step.value },
                };

            case 'click':
                return {
                    command: 'Runtime.evaluate',
                    params: {
                        expression: `
                            (function() {
                                const el = document.querySelector('${step.target}') ||
                                           document.evaluate('//*[contains(text(), "${step.target}")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                                if (el) {
                                    el.click();
                                    return { success: true, elementFound: true };
                                }
                                return { success: false, elementFound: false };
                            })()
                        `,
                        returnByValue: true,
                    },
                };

            case 'type':
                return {
                    command: 'Runtime.evaluate',
                    params: {
                        expression: `
                            (function() {
                                const el = document.querySelector('${step.target}') ||
                                           document.querySelector('input[name="${step.target}"]') ||
                                           document.querySelector('input[placeholder*="${step.target}"]');
                                if (el) {
                                    el.focus();
                                    el.value = '${step.value}';
                                    el.dispatchEvent(new Event('input', { bubbles: true }));
                                    return { success: true, elementFound: true };
                                }
                                return { success: false, elementFound: false };
                            })()
                        `,
                        returnByValue: true,
                    },
                };

            case 'scroll':
                return {
                    command: 'Runtime.evaluate',
                    params: {
                        expression: `window.scrollBy(0, ${step.value || 500})`,
                        returnByValue: true,
                    },
                };

            case 'wait':
                return {
                    command: 'Runtime.evaluate',
                    params: {
                        expression: `new Promise(r => setTimeout(r, ${step.timeout || 1000}))`,
                        awaitPromise: true,
                    },
                };

            case 'screenshot':
                return {
                    command: 'Page.captureScreenshot',
                    params: { format: 'png' },
                };

            default:
                throw new Error(`Unknown action: ${step.action}`);
        }
    }

    /**
     * Log action for audit trail
     */
    private async logAction(
        taskId: string,
        step: NavigationStep,
        result: NavigationResult,
        auditContext: { userId: string; provisioningSessionId: string }
    ): Promise<void> {
        const session = this.activeSessions.get(taskId);

        try {
            await db.insert(browserAgentAuditLog).values({
                browserAgentTaskId: taskId,
                provisioningSessionId: auditContext.provisioningSessionId,
                userId: auditContext.userId,
                actionType: step.action as 'navigate' | 'click' | 'type' | 'scroll' | 'screenshot' | 'extract' | 'oauth_flow' | 'payment_attempt' | 'error' | 'user_intervention',
                actionDescription: `${step.action}: ${step.target || step.value || 'N/A'}`,
                targetUrl: step.action === 'navigate' ? step.value : undefined,
                targetElement: step.target,
                success: result.success,
                errorMessage: result.error,
                screenshotBase64: result.screenshotBase64,
                durationMs: result.durationMs,
            });

            // Update task with action
            const [task] = await db.select().from(browserAgentTasks).where(eq(browserAgentTasks.id, taskId));
            if (task) {
                const actions = (task.stagehandActions as StagehandAction[]) || [];
                actions.push({
                    action: step.action,
                    selector: step.target,
                    value: step.value,
                    timestamp: new Date().toISOString(),
                    success: result.success,
                    error: result.error,
                });

                await db.update(browserAgentTasks)
                    .set({
                        stagehandActions: actions,
                        currentStep: `${step.action}: ${step.target || step.value || 'N/A'}`,
                    })
                    .where(eq(browserAgentTasks.id, taskId));
            }
        } catch (error) {
            console.error('[Browserbase] Failed to log action:', error);
        }
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: BrowserbaseClient | null = null;

export function getBrowserbaseClient(config?: Partial<BrowserbaseConfig>): BrowserbaseClient {
    if (!instance || config) {
        instance = new BrowserbaseClient(config);
    }
    return instance;
}
