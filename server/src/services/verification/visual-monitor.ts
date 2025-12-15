/**
 * Visual Monitor Service
 *
 * Intelligent visual monitoring that combines video recording (for user viewing),
 * keyframe screenshot analysis (for AI analysis), and real-time console error monitoring.
 * This creates the experience of AI "watching" the app while keeping costs reasonable.
 *
 * COST-EFFECTIVE APPROACH:
 * - Video recording: FREE (local Playwright recording)
 * - Keyframe screenshots: ~$0.01-0.03 per image with Claude Vision
 * - Typical session: 10-20 keyframes = $0.10-0.60 per verification
 * - Much cheaper than continuous video streaming to AI
 *
 * Part of Phase 4: 6-Agent Verification Swarm
 */

import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { EventEmitter } from 'events';
import { getModelRouter, type GenerationResponse } from '../ai/model-router.js';

// Lazy-load playwright
let playwrightModule: typeof import('playwright') | null = null;

async function getPlaywright(): Promise<typeof import('playwright')> {
    if (playwrightModule) return playwrightModule;

    try {
        playwrightModule = await import('playwright');
        return playwrightModule;
    } catch (error) {
        throw new Error('Playwright is not available in this environment. Visual monitoring requires a full server deployment.');
    }
}

type Browser = import('playwright').Browser;
type Page = import('playwright').Page;
type BrowserContext = import('playwright').BrowserContext;

// ============================================================================
// TYPES
// ============================================================================

export type KeyframeTrigger =
    | 'page_load'
    | 'navigation'
    | 'click'
    | 'form_submit'
    | 'modal_open'
    | 'error_detected'
    | 'visual_change'
    | 'interval';

export type VisionModelType = 'claude-4.5-vision' | 'gpt-4-vision' | 'gemini-vision';

export interface VisualMonitorConfig {
    recordVideo: boolean;
    captureKeyframes: boolean;
    keyframeTriggers: KeyframeTrigger[];
    maxKeyframesPerSession: number;
    visionModel: VisionModelType;
    enableRealTimeConsoleErrors: boolean;
    screenshotQuality: 'low' | 'medium' | 'high';
    keyframeCaptureDelayMs: number;
    intervalCaptureMs: number;
    videoDir?: string;
}

export interface UIElement {
    id: string;
    type: string;
    label?: string;
    bounds?: { x: number; y: number; width: number; height: number };
    isInteractive: boolean;
}

export interface VisualIssue {
    id: string;
    type: 'layout' | 'design' | 'accessibility' | 'performance' | 'broken';
    severity: 'critical' | 'major' | 'minor';
    title: string;
    description: string;
    suggestion?: string;
}

export interface ConsoleError {
    id: string;
    message: string;
    source?: string;
    lineNumber?: number;
    timestamp: Date;
    type: 'error' | 'warn' | 'exception';
}

export interface VisionAnalysisResult {
    description: string;
    uiElements: UIElement[];
    issues: VisualIssue[];
    designScore: number;
    antiSlopViolations: string[];
    accessibilityIssues: string[];
    overallAssessment: string;
}

export interface KeyframeAnalysis {
    keyframeId: string;
    timestamp: number;
    trigger: KeyframeTrigger;
    screenshotBase64: string;
    visionAnalysis: VisionAnalysisResult;
    consoleErrorsAtCapture: ConsoleError[];
    url: string;
}

export interface UserInteraction {
    type: 'click' | 'scroll' | 'fill' | 'wait' | 'checkLinks';
    selector?: string;
    value?: string;
    to?: 'top' | 'bottom' | 'center';
    duration?: number;
    maxElements?: number;
    maxLinks?: number;
}

export interface VisualMonitoringResult {
    sessionId: string;
    startTime: Date;
    endTime: Date;
    videoPath: string | null;
    keyframes: KeyframeAnalysis[];
    consoleErrors: ConsoleError[];
    allIssues: VisualIssue[];
    overallScore: number;
    summary: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: VisualMonitorConfig = {
    recordVideo: true,
    captureKeyframes: true,
    keyframeTriggers: ['page_load', 'click', 'navigation', 'error_detected'],
    maxKeyframesPerSession: 20,
    visionModel: 'claude-4.5-vision',
    enableRealTimeConsoleErrors: true,
    screenshotQuality: 'high',
    keyframeCaptureDelayMs: 500,
    intervalCaptureMs: 5000,
};

const VISUAL_ANALYSIS_PROMPT = `You are a premium UI/UX analyst for KripTik AI.
Analyze screenshots with extreme attention to visual quality and anti-slop violations.

ANTI-SLOP VIOLATIONS TO CHECK:
- Pure white (#ffffff) or light gray (#f0f0f0) backgrounds without depth
- Generic gray text (gray-500, gray-700) without proper hierarchy
- Flat cards without depth (no shadows, no blur, no layering)
- Default blue buttons (#3b82f6 without customization)
- Arial, Helvetica, Times New Roman fonts in modern UI
- Emoji in professional UI (except where contextually appropriate)
- Lorem ipsum or placeholder text visible to users
- via.placeholder.com or other placeholder images
- Generic stock photo aesthetics
- Unstyled form inputs with browser defaults

PREMIUM DESIGN INDICATORS (POSITIVE):
- Glassmorphism (backdrop-blur, semi-transparent backgrounds)
- Layered shadows with color (not just gray)
- Gradient backgrounds or subtle accent gradients
- Custom typography with clear size/weight hierarchy
- Micro-interactions visible (hover states, focus rings)
- Proper spacing rhythm (consistent 4px/8px scale)
- Dark mode with proper contrast ratios
- Warm accent colors (amber, orange, copper tones)
- Depth through layering and subtle shadows

ACCESSIBILITY TO CHECK:
- Text contrast ratio (should be 4.5:1 minimum)
- Interactive element sizing (minimum 44x44px touch targets)
- Focus indicators visible
- Alt text for images (if detectable)
- Proper heading hierarchy
- Color not sole indicator of state

Return analysis as structured JSON with specific scores and issues found.`;

// ============================================================================
// VISUAL MONITOR CLASS
// ============================================================================

export class VisualMonitor extends EventEmitter {
    private sessionId: string;
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private config: VisualMonitorConfig;
    private videoPath: string | null = null;
    private keyframes: KeyframeAnalysis[] = [];
    private consoleErrors: ConsoleError[] = [];
    private isMonitoring = false;
    private intervalCapture: ReturnType<typeof setInterval> | null = null;
    private lastCaptureTime = 0;
    private startTime: Date | null = null;

    constructor(config?: Partial<VisualMonitorConfig>) {
        super();
        this.sessionId = uuidv4();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Start monitoring a URL
     */
    async startMonitoring(url: string, config?: Partial<VisualMonitorConfig>): Promise<void> {
        if (this.isMonitoring) {
            throw new Error('Monitoring already in progress');
        }

        // Update config if provided
        if (config) {
            this.config = { ...this.config, ...config };
        }

        this.startTime = new Date();
        this.isMonitoring = true;
        this.keyframes = [];
        this.consoleErrors = [];

        console.log(`[VisualMonitor] Starting monitoring session ${this.sessionId} for ${url}`);

        try {
            const playwright = await getPlaywright();

            // Initialize browser
            this.browser = await playwright.chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });

            // Set up video recording directory
            const videoDir = this.config.videoDir || path.join(tmpdir(), 'kriptik-videos', this.sessionId);
            await fs.mkdir(videoDir, { recursive: true });

            // Create context with video recording if enabled
            const contextOptions: Parameters<Browser['newContext']>[0] = {
                viewport: { width: 1440, height: 900 },
            };

            if (this.config.recordVideo) {
                contextOptions.recordVideo = {
                    dir: videoDir,
                    size: { width: 1440, height: 900 },
                };
            }

            this.context = await this.browser.newContext(contextOptions);
            this.page = await this.context.newPage();

            // Set up event listeners
            await this.setupKeyframeTriggers();

            // Navigate to URL
            await this.page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 30000,
            });

            // Wait for page to settle
            await this.page.waitForTimeout(this.config.keyframeCaptureDelayMs);

            // Capture initial keyframe
            if (this.config.captureKeyframes && this.config.keyframeTriggers.includes('page_load')) {
                await this.captureKeyframe('page_load');
            }

            this.emit('monitoring_started', { sessionId: this.sessionId, url });

        } catch (error) {
            this.isMonitoring = false;
            console.error('[VisualMonitor] Failed to start monitoring:', error);
            throw error;
        }
    }

    /**
     * Set up keyframe capture triggers
     */
    private async setupKeyframeTriggers(): Promise<void> {
        if (!this.page) return;

        // Console errors
        if (this.config.enableRealTimeConsoleErrors) {
            this.page.on('console', async (msg) => {
                if (msg.type() === 'error') {
                    const error: ConsoleError = {
                        id: uuidv4(),
                        message: msg.text(),
                        source: msg.location().url,
                        lineNumber: msg.location().lineNumber,
                        timestamp: new Date(),
                        type: 'error',
                    };
                    this.consoleErrors.push(error);
                    this.emit('console_error', error);

                    // Capture keyframe on error if configured
                    if (this.config.keyframeTriggers.includes('error_detected')) {
                        await this.captureKeyframeThrottled('error_detected');
                    }
                } else if (msg.type() === 'warning') {
                    const error: ConsoleError = {
                        id: uuidv4(),
                        message: msg.text(),
                        source: msg.location().url,
                        lineNumber: msg.location().lineNumber,
                        timestamp: new Date(),
                        type: 'warn',
                    };
                    this.consoleErrors.push(error);
                }
            });

            // Page errors (uncaught exceptions)
            this.page.on('pageerror', async (error) => {
                const consoleError: ConsoleError = {
                    id: uuidv4(),
                    message: error.message,
                    timestamp: new Date(),
                    type: 'exception',
                };
                this.consoleErrors.push(consoleError);
                this.emit('console_error', consoleError);

                if (this.config.keyframeTriggers.includes('error_detected')) {
                    await this.captureKeyframeThrottled('error_detected');
                }
            });
        }

        // Navigation
        if (this.config.keyframeTriggers.includes('navigation')) {
            this.page.on('framenavigated', async (frame) => {
                if (frame === this.page?.mainFrame()) {
                    await this.page?.waitForTimeout(this.config.keyframeCaptureDelayMs);
                    await this.captureKeyframeThrottled('navigation');
                }
            });
        }

        // Interval-based capture
        if (this.config.keyframeTriggers.includes('interval')) {
            this.intervalCapture = setInterval(async () => {
                if (this.isMonitoring) {
                    await this.captureKeyframeThrottled('interval');
                }
            }, this.config.intervalCaptureMs);
        }
    }

    /**
     * Throttled keyframe capture (max 1 per second)
     */
    private async captureKeyframeThrottled(trigger: KeyframeTrigger): Promise<void> {
        const now = Date.now();
        if (now - this.lastCaptureTime < 1000) {
            return;
        }
        this.lastCaptureTime = now;
        await this.captureKeyframe(trigger);
    }

    /**
     * Capture a keyframe with AI analysis
     */
    async captureKeyframe(trigger: KeyframeTrigger): Promise<KeyframeAnalysis | null> {
        if (!this.page || !this.isMonitoring) {
            return null;
        }

        // Check max keyframes limit
        if (this.keyframes.length >= this.config.maxKeyframesPerSession) {
            console.log(`[VisualMonitor] Max keyframes (${this.config.maxKeyframesPerSession}) reached`);
            return null;
        }

        try {
            // Take screenshot
            const screenshotBuffer = await this.page.screenshot({
                fullPage: false,
                type: 'png',
                quality: undefined, // PNG doesn't support quality
            });
            const screenshotBase64 = screenshotBuffer.toString('base64');

            // Get current URL
            const url = this.page.url();

            // Get console errors since last capture
            const recentErrors = [...this.consoleErrors];

            // Analyze screenshot with Vision AI
            const visionAnalysis = await this.analyzeScreenshot(
                screenshotBase64,
                `Trigger: ${trigger}, URL: ${url}`
            );

            const keyframe: KeyframeAnalysis = {
                keyframeId: uuidv4(),
                timestamp: Date.now() - (this.startTime?.getTime() || Date.now()),
                trigger,
                screenshotBase64,
                visionAnalysis,
                consoleErrorsAtCapture: recentErrors,
                url,
            };

            this.keyframes.push(keyframe);
            this.emit('keyframe_captured', keyframe);

            console.log(`[VisualMonitor] Keyframe captured: ${trigger} (${this.keyframes.length}/${this.config.maxKeyframesPerSession})`);

            return keyframe;

        } catch (error) {
            console.error('[VisualMonitor] Failed to capture keyframe:', error);
            return null;
        }
    }

    /**
     * Analyze a screenshot using Vision AI
     */
    private async analyzeScreenshot(
        screenshotBase64: string,
        context: string
    ): Promise<VisionAnalysisResult> {
        try {
            const modelRouter = getModelRouter();

            const response: GenerationResponse = await modelRouter.generate({
                prompt: `Analyze this UI screenshot. Context: ${context}

Evaluate:
1. UI Layout & Design Quality (0-100 score)
2. Visible UI Elements (buttons, inputs, text, images, cards, navigation)
3. Any Visual Issues (broken layouts, missing images, overflow, alignment)
4. Anti-Slop Violations (check against the criteria provided)
5. Accessibility Issues (contrast, sizing, labels)
6. Overall User Experience Assessment

Return structured JSON:
{
  "description": "Brief description of what the screen shows",
  "uiElements": [
    {"id": "unique-id", "type": "button|input|card|nav|image|text", "label": "visible text", "isInteractive": true}
  ],
  "issues": [
    {"id": "unique-id", "type": "layout|design|accessibility|performance|broken", "severity": "critical|major|minor", "title": "Issue title", "description": "Details", "suggestion": "How to fix"}
  ],
  "designScore": 85,
  "antiSlopViolations": ["List of specific violations found"],
  "accessibilityIssues": ["List of a11y issues"],
  "overallAssessment": "Summary of UI quality"
}`,
                images: [{
                    url: `data:image/png;base64,${screenshotBase64}`,
                    detail: this.config.screenshotQuality === 'high' ? 'high' : 'low',
                }],
                taskType: 'vision',
                forceTier: 'vision',
                systemPrompt: VISUAL_ANALYSIS_PROMPT,
                maxTokens: 4000,
            });

            return this.parseVisionResponse(response.content);

        } catch (error) {
            console.error('[VisualMonitor] Vision analysis failed:', error);
            return this.getDefaultAnalysis();
        }
    }

    /**
     * Parse the Vision AI response
     */
    private parseVisionResponse(content: string): VisionAnalysisResult {
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                              content.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

                return {
                    description: parsed.description || 'UI screenshot analyzed',
                    uiElements: (parsed.uiElements || []).map((el: Record<string, unknown>) => ({
                        id: el.id || uuidv4(),
                        type: el.type || 'unknown',
                        label: el.label,
                        bounds: el.bounds,
                        isInteractive: el.isInteractive ?? false,
                    })),
                    issues: (parsed.issues || []).map((issue: Record<string, unknown>) => ({
                        id: issue.id || uuidv4(),
                        type: issue.type || 'design',
                        severity: issue.severity || 'minor',
                        title: issue.title || 'Issue detected',
                        description: issue.description || '',
                        suggestion: issue.suggestion,
                    })),
                    designScore: parsed.designScore ?? 70,
                    antiSlopViolations: parsed.antiSlopViolations || [],
                    accessibilityIssues: parsed.accessibilityIssues || [],
                    overallAssessment: parsed.overallAssessment || 'Analysis complete',
                };
            }
        } catch (error) {
            console.error('[VisualMonitor] Failed to parse vision response:', error);
        }

        return this.getDefaultAnalysis();
    }

    /**
     * Get default analysis when parsing fails
     */
    private getDefaultAnalysis(): VisionAnalysisResult {
        return {
            description: 'Screenshot captured',
            uiElements: [],
            issues: [],
            designScore: 70,
            antiSlopViolations: [],
            accessibilityIssues: [],
            overallAssessment: 'Visual analysis pending',
        };
    }

    /**
     * Run a sequence of user interactions while monitoring
     */
    async runInteractionSequence(interactions: UserInteraction[]): Promise<void> {
        if (!this.page || !this.isMonitoring) {
            throw new Error('Monitoring not active');
        }

        for (const interaction of interactions) {
            try {
                switch (interaction.type) {
                    case 'wait':
                        await this.page.waitForTimeout(interaction.duration || 1000);
                        break;

                    case 'scroll':
                        if (interaction.to === 'bottom') {
                            await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                        } else if (interaction.to === 'top') {
                            await this.page.evaluate(() => window.scrollTo(0, 0));
                        } else {
                            await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
                        }
                        await this.page.waitForTimeout(300);
                        if (this.config.keyframeTriggers.includes('click')) {
                            await this.captureKeyframeThrottled('visual_change');
                        }
                        break;

                    case 'click':
                        if (interaction.selector) {
                            const elements = await this.page.$$(interaction.selector);
                            const maxElements = interaction.maxElements || 5;

                            for (let i = 0; i < Math.min(elements.length, maxElements); i++) {
                                const element = elements[i];
                                const box = await element.boundingBox();

                                if (box && box.width > 0 && box.height > 0) {
                                    try {
                                        await element.click({ timeout: 2000 });
                                        await this.page.waitForTimeout(this.config.keyframeCaptureDelayMs);

                                        if (this.config.keyframeTriggers.includes('click')) {
                                            await this.captureKeyframeThrottled('click');
                                        }

                                        // Navigate back if we left the page
                                        await this.page.goBack().catch(() => {});
                                    } catch {
                                        // Element not clickable, skip
                                    }
                                }
                            }
                        }
                        break;

                    case 'fill':
                        if (interaction.selector && interaction.value) {
                            await this.page.fill(interaction.selector, interaction.value);
                            if (this.config.keyframeTriggers.includes('form_submit')) {
                                await this.captureKeyframeThrottled('form_submit');
                            }
                        }
                        break;

                    case 'checkLinks':
                        const links = await this.page.$$('a[href]');
                        const maxLinks = interaction.maxLinks || 5;

                        for (let i = 0; i < Math.min(links.length, maxLinks); i++) {
                            const link = links[i];
                            const href = await link.getAttribute('href');

                            // Skip external links, anchor links, and javascript links
                            if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript:')) {
                                const box = await link.boundingBox();
                                if (box && box.width > 0) {
                                    try {
                                        await link.click({ timeout: 2000 });
                                        await this.page.waitForTimeout(this.config.keyframeCaptureDelayMs);

                                        if (this.config.keyframeTriggers.includes('navigation')) {
                                            await this.captureKeyframeThrottled('navigation');
                                        }

                                        await this.page.goBack().catch(() => {});
                                    } catch {
                                        // Link not clickable
                                    }
                                }
                            }
                        }
                        break;
                }
            } catch (error) {
                console.error(`[VisualMonitor] Interaction ${interaction.type} failed:`, error);
            }
        }
    }

    /**
     * Stop monitoring and return results
     */
    async stopMonitoring(): Promise<VisualMonitoringResult> {
        if (!this.isMonitoring) {
            throw new Error('Monitoring not active');
        }

        console.log(`[VisualMonitor] Stopping monitoring session ${this.sessionId}`);

        // Clear interval capture
        if (this.intervalCapture) {
            clearInterval(this.intervalCapture);
            this.intervalCapture = null;
        }

        this.isMonitoring = false;

        // Get video path if recording was enabled
        if (this.context && this.config.recordVideo) {
            await this.page?.close();
            this.page = null;

            const video = await this.context.pages()[0]?.video?.();
            if (video) {
                try {
                    this.videoPath = await video.path();
                } catch {
                    // Video might not be available
                }
            }
        }

        // Close browser
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }

        // Compile all issues from keyframes
        const allIssues: VisualIssue[] = [];
        for (const keyframe of this.keyframes) {
            allIssues.push(...keyframe.visionAnalysis.issues);
        }

        // Calculate overall score
        const scores = this.keyframes.map(k => k.visionAnalysis.designScore);
        const overallScore = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 70;

        // Generate summary
        const criticalIssues = allIssues.filter(i => i.severity === 'critical');
        const majorIssues = allIssues.filter(i => i.severity === 'major');
        const summary = this.generateSummary(overallScore, criticalIssues.length, majorIssues.length, this.consoleErrors.length);

        const result: VisualMonitoringResult = {
            sessionId: this.sessionId,
            startTime: this.startTime || new Date(),
            endTime: new Date(),
            videoPath: this.videoPath,
            keyframes: this.keyframes,
            consoleErrors: this.consoleErrors,
            allIssues,
            overallScore,
            summary,
        };

        this.emit('monitoring_complete', result);

        return result;
    }

    /**
     * Generate a summary message
     */
    private generateSummary(
        score: number,
        criticalCount: number,
        majorCount: number,
        errorCount: number
    ): string {
        const parts: string[] = [];

        if (score >= 85) {
            parts.push('Excellent visual quality');
        } else if (score >= 70) {
            parts.push('Good visual quality with some areas for improvement');
        } else if (score >= 50) {
            parts.push('Visual quality needs attention');
        } else {
            parts.push('Significant visual issues detected');
        }

        if (criticalCount > 0) {
            parts.push(`${criticalCount} critical issue${criticalCount > 1 ? 's' : ''}`);
        }
        if (majorCount > 0) {
            parts.push(`${majorCount} major issue${majorCount > 1 ? 's' : ''}`);
        }
        if (errorCount > 0) {
            parts.push(`${errorCount} console error${errorCount > 1 ? 's' : ''}`);
        }

        return parts.join('. ') + '.';
    }

    /**
     * Get current keyframes count
     */
    getKeyframeCount(): number {
        return this.keyframes.length;
    }

    /**
     * Get current console errors count
     */
    getConsoleErrorCount(): number {
        return this.consoleErrors.length;
    }

    /**
     * Check if monitoring is active
     */
    isActive(): boolean {
        return this.isMonitoring;
    }

    /**
     * Get session ID
     */
    getSessionId(): string {
        return this.sessionId;
    }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createVisualMonitor(config?: Partial<VisualMonitorConfig>): VisualMonitor {
    return new VisualMonitor(config);
}

export default VisualMonitor;
