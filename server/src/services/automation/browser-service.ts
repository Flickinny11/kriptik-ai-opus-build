/**
 * Browser Automation Service
 *
 * Provides AI-powered browser automation for:
 * - Visual demonstration to users
 * - E2E testing and verification
 * - Console log capture
 * - Screenshot capture for visual verification
 *
 * Uses Playwright for browser control with AI-powered natural language actions
 * NOTE: Playwright is an optional dependency - not available in serverless environments
 */

import { v4 as uuidv4 } from 'uuid';
import { createClaudeService, ClaudeService } from '../ai/claude-service.js';

// Lazy-load playwright to handle serverless environments where it's not available
let playwrightModule: typeof import('playwright') | null = null;
let playwrightAvailable = false;

async function getPlaywright(): Promise<typeof import('playwright')> {
    if (playwrightModule) return playwrightModule;

    try {
        playwrightModule = await import('playwright');
        playwrightAvailable = true;
        return playwrightModule;
    } catch (error) {
        playwrightAvailable = false;
        throw new Error('Playwright is not available in this environment. Browser automation requires a full server deployment.');
    }
}

// Type imports for when playwright is available
type Browser = import('playwright').Browser;
type Page = import('playwright').Page;
type BrowserContext = import('playwright').BrowserContext;
type ConsoleMessage = import('playwright').ConsoleMessage;

export interface ConsoleLog {
    id: string;
    type: 'log' | 'warn' | 'error' | 'info' | 'debug';
    message: string;
    timestamp: Date;
    source?: string;
    lineNumber?: number;
    url?: string;
}

export interface NetworkRequest {
    id: string;
    url: string;
    method: string;
    status?: number;
    timestamp: Date;
    duration?: number;
    failed: boolean;
    errorText?: string;
}

export interface BrowserActionResult {
    success: boolean;
    screenshot?: string;
    extractedData?: unknown;
    consoleLogs?: ConsoleLog[];
    error?: string;
    actionDescription?: string;
}

export interface BrowserConfig {
    headed?: boolean;
    slowMo?: number;
    viewport?: { width: number; height: number };
    timeout?: number;
    recordVideo?: boolean;
}

export interface ElementInfo {
    selector: string;
    tagName: string;
    text?: string;
    attributes: Record<string, string>;
    isVisible: boolean;
    isEnabled: boolean;
    boundingBox?: { x: number; y: number; width: number; height: number };
}

/**
 * Browser Automation Service
 * Controls a browser instance for automated testing and demonstration
 */
export class BrowserAutomationService {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private consoleLogs: ConsoleLog[] = [];
    private networkRequests: NetworkRequest[] = [];
    private claudeService: ClaudeService | null = null;
    private config: BrowserConfig;
    private isInitialized = false;

    constructor(config: BrowserConfig = {}) {
        this.config = {
            headed: config.headed ?? false,
            slowMo: config.slowMo ?? 0,
            viewport: config.viewport ?? { width: 1280, height: 720 },
            timeout: config.timeout ?? 30000,
            recordVideo: config.recordVideo ?? false,
        };
    }

    /**
     * Initialize the browser instance
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Get playwright (will throw if not available)
            const { chromium } = await getPlaywright();

            // Launch browser
            this.browser = await chromium.launch({
                headless: !this.config.headed,
                slowMo: this.config.slowMo,
            });

            // Create context with viewport
            this.context = await this.browser.newContext({
                viewport: this.config.viewport,
                recordVideo: this.config.recordVideo ? {
                    dir: '/tmp/videos',
                    size: this.config.viewport,
                } : undefined,
            });

            // Create page
            this.page = await this.context.newPage();
            this.page.setDefaultTimeout(this.config.timeout!);

            // Set up console log capture
            this.page.on('console', (msg: ConsoleMessage) => {
                this.consoleLogs.push({
                    id: uuidv4(),
                    type: msg.type() as ConsoleLog['type'],
                    message: msg.text(),
                    timestamp: new Date(),
                    url: this.page?.url(),
                    lineNumber: msg.location().lineNumber,
                });
            });

            // Set up network request capture
            this.page.on('request', (request: import('playwright').Request) => {
                this.networkRequests.push({
                    id: uuidv4(),
                    url: request.url(),
                    method: request.method(),
                    timestamp: new Date(),
                    failed: false,
                });
            });

            this.page.on('response', (response: import('playwright').Response) => {
                const request = this.networkRequests.find(
                    r => r.url === response.url() && !r.status
                );
                if (request) {
                    request.status = response.status();
                    request.duration = Date.now() - request.timestamp.getTime();
                }
            });

            this.page.on('requestfailed', (request: import('playwright').Request) => {
                const req = this.networkRequests.find(
                    r => r.url === request.url() && !r.failed
                );
                if (req) {
                    req.failed = true;
                    req.errorText = request.failure()?.errorText;
                }
            });

            // Initialize Claude service for AI-powered actions
            this.claudeService = createClaudeService({
                projectId: 'browser-automation',
                userId: 'system',
                agentType: 'testing',
            });

            this.isInitialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize browser: ${error}`);
        }
    }

    /**
     * Navigate to a URL
     */
    async navigateTo(url: string): Promise<BrowserActionResult> {
        await this.ensureInitialized();

        try {
            await this.page!.goto(url, { waitUntil: 'networkidle' });
            const screenshot = await this.screenshot();

            return {
                success: true,
                screenshot,
                actionDescription: `Navigated to ${url}`,
            };
        } catch (error) {
            return {
                success: false,
                error: `Navigation failed: ${error}`,
            };
        }
    }

    /**
     * Execute a natural language browser action using AI
     * The AI interprets the action and generates Playwright commands
     */
    async executeAction(action: string): Promise<BrowserActionResult> {
        await this.ensureInitialized();

        try {
            // Get current page state for context
            const pageState = await this.getPageState();

            // Use Claude to interpret the action and generate commands
            const prompt = `You are a browser automation expert. Given the current page state and a natural language action, generate the exact Playwright command to execute.

CURRENT PAGE STATE:
URL: ${pageState.url}
Title: ${pageState.title}
Visible Elements (interactive):
${pageState.interactiveElements.map(el =>
    `- ${el.tagName}${el.text ? `: "${el.text.substring(0, 50)}"` : ''} [${el.selector}]`
).join('\n')}

ACTION TO PERFORM: "${action}"

Respond with a JSON object containing:
{
    "actionType": "click" | "fill" | "select" | "wait" | "scroll" | "hover" | "press",
    "selector": "CSS selector or text selector",
    "value": "value if needed (for fill/select)",
    "description": "human-readable description of what will happen"
}

Important:
- Use text-based selectors like 'text=Sign Up' or 'button:has-text("Submit")' when possible
- For inputs, use placeholder text or label associations
- Be precise with selectors to avoid ambiguity`;

            // Browser action parsing - increased from 1K to allow for complex selectors
            const response = await this.claudeService!.generate(prompt, {
                maxTokens: 8000,  // Increased from 1K - complex actions need room
                useExtendedThinking: false,
            });

            // Parse the AI response
            const commandMatch = response.content.match(/\{[\s\S]*\}/);
            if (!commandMatch) {
                throw new Error('Failed to parse AI response');
            }

            const command = JSON.parse(commandMatch[0]);

            // Execute the command
            switch (command.actionType) {
                case 'click':
                    await this.page!.click(command.selector);
                    break;
                case 'fill':
                    await this.page!.fill(command.selector, command.value);
                    break;
                case 'select':
                    await this.page!.selectOption(command.selector, command.value);
                    break;
                case 'wait':
                    await this.page!.waitForSelector(command.selector);
                    break;
                case 'scroll':
                    await this.page!.locator(command.selector).scrollIntoViewIfNeeded();
                    break;
                case 'hover':
                    await this.page!.hover(command.selector);
                    break;
                case 'press':
                    await this.page!.press(command.selector || 'body', command.value);
                    break;
                default:
                    throw new Error(`Unknown action type: ${command.actionType}`);
            }

            // Wait for any navigation or network activity
            await this.page!.waitForLoadState('networkidle').catch(() => {});

            const screenshot = await this.screenshot();

            return {
                success: true,
                screenshot,
                actionDescription: command.description,
            };
        } catch (error) {
            const screenshot = await this.screenshot().catch(() => undefined);
            return {
                success: false,
                error: `Action failed: ${error}`,
                screenshot,
            };
        }
    }

    /**
     * Click on an element by description
     */
    async click(description: string): Promise<BrowserActionResult> {
        return this.executeAction(`Click on ${description}`);
    }

    /**
     * Type text into an element
     */
    async typeInto(description: string, text: string): Promise<BrowserActionResult> {
        return this.executeAction(`Type "${text}" into ${description}`);
    }

    /**
     * Take a screenshot
     */
    async screenshot(options: { fullPage?: boolean } = {}): Promise<string> {
        await this.ensureInitialized();

        const buffer = await this.page!.screenshot({
            fullPage: options.fullPage,
            type: 'png',
        });

        return buffer.toString('base64');
    }

    /**
     * Extract data from the page using AI
     */
    async extract<T>(instruction: string, schema?: unknown): Promise<T> {
        await this.ensureInitialized();

        // Get page content
        const pageContent = await this.page!.content();
        const screenshot = await this.screenshot();

        const prompt = `Analyze this web page and extract the requested information.

PAGE HTML (truncated):
${pageContent.substring(0, 10000)}

EXTRACTION INSTRUCTION: "${instruction}"

${schema ? `EXPECTED SCHEMA: ${JSON.stringify(schema)}` : ''}

Respond with the extracted data as a JSON object.`;

        // Data extraction - increased from 2K to handle large/complex extractions
        const response = await this.claudeService!.generate(prompt, {
            maxTokens: 16000,  // Increased from 2K - extracted data can be extensive
            useExtendedThinking: false,
        });

        // Parse JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Failed to extract data');
        }

        return JSON.parse(jsonMatch[0]) as T;
    }

    /**
     * Wait for an element to appear
     */
    async waitFor(selector: string, timeout?: number): Promise<boolean> {
        await this.ensureInitialized();

        try {
            await this.page!.waitForSelector(selector, {
                timeout: timeout ?? this.config.timeout,
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Wait for text to appear on page
     */
    async waitForText(text: string, timeout?: number): Promise<boolean> {
        await this.ensureInitialized();

        try {
            await this.page!.waitForSelector(`text=${text}`, {
                timeout: timeout ?? this.config.timeout,
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get current page state
     */
    async getPageState(): Promise<{
        url: string;
        title: string;
        interactiveElements: ElementInfo[];
    }> {
        await this.ensureInitialized();

        const url = this.page!.url();
        const title = await this.page!.title();

        // Get interactive elements
        const interactiveElements = await this.page!.evaluate(() => {
            const elements: ElementInfo[] = [];
            const selectors = [
                'button',
                'a',
                'input',
                'select',
                'textarea',
                '[role="button"]',
                '[onclick]',
            ];

            for (const selector of selectors) {
                document.querySelectorAll(selector).forEach((el, index) => {
                    const htmlEl = el as HTMLElement;
                    const rect = htmlEl.getBoundingClientRect();
                    const isVisible = rect.width > 0 && rect.height > 0;

                    if (isVisible) {
                        const attrs: Record<string, string> = {};
                        for (const attr of htmlEl.attributes) {
                            attrs[attr.name] = attr.value;
                        }

                        elements.push({
                            selector: `${selector}:nth-of-type(${index + 1})`,
                            tagName: htmlEl.tagName.toLowerCase(),
                            text: htmlEl.textContent?.trim().substring(0, 100),
                            attributes: attrs,
                            isVisible: true,
                            isEnabled: !(htmlEl as HTMLButtonElement).disabled,
                            boundingBox: {
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height,
                            },
                        });
                    }
                });
            }

            return elements;
        });

        return { url, title, interactiveElements };
    }

    /**
     * Get all console logs
     */
    getConsoleLogs(): ConsoleLog[] {
        return [...this.consoleLogs];
    }

    /**
     * Get console errors only
     */
    getConsoleErrors(): ConsoleLog[] {
        return this.consoleLogs.filter(log => log.type === 'error');
    }

    /**
     * Get network requests
     */
    getNetworkRequests(): NetworkRequest[] {
        return [...this.networkRequests];
    }

    /**
     * Get failed network requests
     */
    getFailedRequests(): NetworkRequest[] {
        return this.networkRequests.filter(req => req.failed || (req.status && req.status >= 400));
    }

    /**
     * Clear console logs
     */
    clearConsoleLogs(): void {
        this.consoleLogs = [];
    }

    /**
     * Clear network requests
     */
    clearNetworkRequests(): void {
        this.networkRequests = [];
    }

    /**
     * Check if page has any errors
     */
    hasErrors(): boolean {
        return this.consoleLogs.some(log => log.type === 'error') ||
               this.networkRequests.some(req => req.failed);
    }

    /**
     * Get current URL
     */
    getCurrentUrl(): string {
        return this.page?.url() ?? '';
    }

    /**
     * Get page title
     */
    getPageTitle(): string {
        // This is sync, so return cached title or empty
        return this.page?.url() ? 'Page' : '';
    }

    /**
     * Get visible interactive elements (wrapper for User Twin)
     */
    async getVisibleElements(): Promise<ElementInfo[]> {
        if (!this.isInitialized || !this.page) {
            return [];
        }
        const state = await this.getPageState();
        return state.interactiveElements;
    }

    /**
     * Ensure browser is initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    /**
     * Close the browser
     */
    async close(): Promise<void> {
        if (this.page) {
            await this.page.close();
            this.page = null;
        }
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        this.isInitialized = false;
        this.consoleLogs = [];
        this.networkRequests = [];
    }
}

/**
 * Create a new browser automation service
 */
export function createBrowserAutomationService(config?: BrowserConfig): BrowserAutomationService {
    return new BrowserAutomationService(config);
}

