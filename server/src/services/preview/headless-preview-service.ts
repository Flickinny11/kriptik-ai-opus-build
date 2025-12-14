/**
 * Headless Preview Service
 *
 * Uses Playwright to:
 * 1. Launch sandboxed preview of built feature
 * 2. Stream video/screenshots to frontend
 * 3. Allow AI agent to demonstrate feature usage
 * 4. Enable user takeover of browser control
 */

import { EventEmitter } from 'events';

// Playwright is optional - check if available
let playwright: typeof import('playwright') | null = null;

try {
    playwright = await import('playwright');
} catch {
    console.warn('Playwright not installed. Preview service will run in mock mode.');
}

export type PreviewSessionStatus = 'starting' | 'ai_demo' | 'user_control' | 'ended';

export interface PreviewSession {
    id: string;
    featureAgentId: string;
    sandboxUrl: string;
    status: PreviewSessionStatus;
    browser: any | null; // Browser instance
    page: any | null; // Page instance
    aiNarration: string;
    cursorPosition: { x: number; y: number };
    events: EventEmitter;
    createdAt: Date;
}

export interface PreviewEvent {
    type: 'cursor_move' | 'click' | 'type' | 'scroll' | 'screenshot' | 'ai_action' | 'status_change' | 'narration';
    x?: number;
    y?: number;
    text?: string;
    description?: string;
    screenshot?: string; // base64
    status?: PreviewSessionStatus;
    timestamp: number;
}

export interface AIAction {
    type: 'click' | 'type' | 'scroll' | 'wait' | 'hover';
    selector?: string;
    text?: string;
    x?: number;
    y?: number;
    duration?: number;
    description: string;
}

export class HeadlessPreviewService {
    private sessions: Map<string, PreviewSession> = new Map();

    /**
     * Start a new preview session
     */
    async startPreview(
        featureAgentId: string,
        sandboxUrl: string
    ): Promise<PreviewSession> {
        const sessionId = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const session: PreviewSession = {
            id: sessionId,
            featureAgentId,
            sandboxUrl,
            status: 'starting',
            browser: null,
            page: null,
            aiNarration: '',
            cursorPosition: { x: 0, y: 0 },
            events: new EventEmitter(),
            createdAt: new Date(),
        };

        this.sessions.set(sessionId, session);

        // Emit initial status
        this.emitEvent(session, {
            type: 'status_change',
            status: 'starting',
            timestamp: Date.now(),
        });

        try {
            if (playwright) {
                // Launch real browser
                const browser = await playwright.chromium.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                });

                const context = await browser.newContext({
                    viewport: { width: 1280, height: 800 },
                    recordVideo: { dir: '/tmp/preview-recordings' },
                });

                const page = await context.newPage();
                await page.goto(sandboxUrl, { waitUntil: 'networkidle' });

                session.browser = browser;
                session.page = page;

                // Capture initial screenshot
                const screenshot = await page.screenshot({ encoding: 'base64' });
                this.emitEvent(session, {
                    type: 'screenshot',
                    screenshot,
                    timestamp: Date.now(),
                });
            }

            session.status = 'ai_demo';
            this.emitEvent(session, {
                type: 'status_change',
                status: 'ai_demo',
                timestamp: Date.now(),
            });

            return session;
        } catch (error) {
            console.error('Failed to start preview:', error);
            session.status = 'ended';
            throw error;
        }
    }

    /**
     * Start AI demonstration of the feature
     */
    async startAIDemo(sessionId: string, aiActions?: AIAction[]): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        session.status = 'ai_demo';
        this.emitEvent(session, {
            type: 'status_change',
            status: 'ai_demo',
            timestamp: Date.now(),
        });

        // Execute AI actions
        const actions: AIAction[] = aiActions || [
            { type: 'wait', duration: 1000, description: 'Analyzing the page...' },
            { type: 'hover', selector: 'button', description: 'Looking for the main action button...' },
            { type: 'click', selector: 'button:first-of-type', description: 'Clicking the primary button to test interaction...' },
            { type: 'wait', duration: 500, description: 'Waiting for response...' },
        ];

        for (const action of actions) {
            // Emit narration
            this.emitEvent(session, {
                type: 'narration',
                description: action.description,
                timestamp: Date.now(),
            });

            await this.executeAction(session, action);

            // Small delay between actions for smooth animation
            await this.delay(300);
        }
    }

    /**
     * Execute a single AI action
     */
    private async executeAction(session: PreviewSession, action: AIAction): Promise<void> {
        const { page } = session;

        try {
            switch (action.type) {
                case 'click':
                    if (action.selector && page) {
                        const element = await page.$(action.selector);
                        if (element) {
                            const box = await element.boundingBox();
                            if (box) {
                                // Move cursor first
                                const centerX = box.x + box.width / 2;
                                const centerY = box.y + box.height / 2;
                                await this.animateCursor(session, centerX, centerY);

                                // Then click
                                await element.click();
                                this.emitEvent(session, {
                                    type: 'click',
                                    x: centerX,
                                    y: centerY,
                                    description: action.description,
                                    timestamp: Date.now(),
                                });
                            }
                        }
                    }
                    break;

                case 'type':
                    if (action.selector && action.text && page) {
                        await page.fill(action.selector, action.text);
                        this.emitEvent(session, {
                            type: 'type',
                            text: action.text,
                            description: action.description,
                            timestamp: Date.now(),
                        });
                    }
                    break;

                case 'scroll':
                    if (page) {
                        await page.evaluate((y: number) => window.scrollTo(0, y), action.y || 400);
                        this.emitEvent(session, {
                            type: 'scroll',
                            y: action.y,
                            description: action.description,
                            timestamp: Date.now(),
                        });
                    }
                    break;

                case 'hover':
                    if (action.selector && page) {
                        const element = await page.$(action.selector);
                        if (element) {
                            const box = await element.boundingBox();
                            if (box) {
                                const centerX = box.x + box.width / 2;
                                const centerY = box.y + box.height / 2;
                                await this.animateCursor(session, centerX, centerY);
                            }
                        }
                    }
                    break;

                case 'wait':
                    await this.delay(action.duration || 1000);
                    break;
            }

            // Capture screenshot after action
            if (page) {
                const screenshot = await page.screenshot({ encoding: 'base64' });
                this.emitEvent(session, {
                    type: 'screenshot',
                    screenshot,
                    timestamp: Date.now(),
                });
            }
        } catch (error) {
            console.error(`Failed to execute action ${action.type}:`, error);
        }
    }

    /**
     * Animate cursor movement to a target position
     */
    private async animateCursor(session: PreviewSession, targetX: number, targetY: number): Promise<void> {
        const steps = 10;
        const { x: startX, y: startY } = session.cursorPosition;

        for (let i = 1; i <= steps; i++) {
            const x = startX + (targetX - startX) * (i / steps);
            const y = startY + (targetY - startY) * (i / steps);

            session.cursorPosition = { x, y };
            this.emitEvent(session, {
                type: 'cursor_move',
                x,
                y,
                timestamp: Date.now(),
            });

            await this.delay(30);
        }
    }

    /**
     * User takes control of the browser
     */
    async userTakeover(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        session.status = 'user_control';
        this.emitEvent(session, {
            type: 'status_change',
            status: 'user_control',
            description: 'You now have control. Interact with the preview to verify the feature.',
            timestamp: Date.now(),
        });
    }

    /**
     * Capture current screenshot
     */
    async captureScreenshot(sessionId: string): Promise<string> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        if (session.page) {
            const screenshot = await session.page.screenshot({ encoding: 'base64' });
            return screenshot;
        }

        // Return placeholder in mock mode
        return '';
    }

    /**
     * End preview session and clean up
     */
    async endPreview(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.status = 'ended';
        this.emitEvent(session, {
            type: 'status_change',
            status: 'ended',
            timestamp: Date.now(),
        });

        try {
            if (session.browser) {
                await session.browser.close();
            }
        } catch (error) {
            console.error('Error closing browser:', error);
        }

        this.sessions.delete(sessionId);
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): PreviewSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Stream preview events as async generator
     */
    async *streamPreviewEvents(sessionId: string): AsyncGenerator<PreviewEvent> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        const eventQueue: PreviewEvent[] = [];
        let resolve: (() => void) | null = null;

        const listener = (event: PreviewEvent) => {
            eventQueue.push(event);
            if (resolve) {
                resolve();
                resolve = null;
            }
        };

        session.events.on('event', listener);

        try {
            while (session.status !== 'ended') {
                if (eventQueue.length > 0) {
                    yield eventQueue.shift()!;
                } else {
                    await new Promise<void>((r) => { resolve = r; });
                }
            }

            // Drain remaining events
            while (eventQueue.length > 0) {
                yield eventQueue.shift()!;
            }
        } finally {
            session.events.off('event', listener);
        }
    }

    /**
     * Emit an event for a session
     */
    private emitEvent(session: PreviewSession, event: PreviewEvent): void {
        session.events.emit('event', event);
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// Singleton instance
export const previewService = new HeadlessPreviewService();
