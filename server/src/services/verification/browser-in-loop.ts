/**
 * Browser-in-the-Loop Service - Continuous Visual Verification During Build
 *
 * Unlike the current approach of taking screenshots at checkpoints (Phase 3, 4),
 * this service provides CONTINUOUS browser integration during the build:
 *
 * 1. Hot-reloading preview that updates on every file save
 * 2. Automatic screenshot capture on significant changes
 * 3. Real-time anti-slop detection on visual changes
 * 4. DOM state capture for debugging
 * 5. Bidirectional communication - agents can manipulate the UI
 *
 * This is what makes Cursor's browser integration feel "magical" -
 * the agent sees changes in real-time and can iterate immediately.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    getStreamingFeedbackChannel,
    type StreamingFeedbackChannel,
} from '../feedback/streaming-feedback-channel.js';

// =============================================================================
// TYPES
// =============================================================================

export interface BrowserState {
    url: string;
    title: string;
    viewportWidth: number;
    viewportHeight: number;
    scrollPosition: { x: number; y: number };
    domSnapshot?: string;
    lastScreenshot?: string;
    consoleErrors: string[];
    networkErrors: string[];
}

export interface VisualCheck {
    id: string;
    timestamp: Date;
    screenshot: string;
    issues: VisualIssue[];
    score: number;
    passed: boolean;
}

export interface VisualIssue {
    type: 'anti_slop' | 'layout' | 'accessibility' | 'performance' | 'broken_image';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    location?: { x: number; y: number; width: number; height: number };
    screenshot?: string;
}

export interface BrowserInLoopConfig {
    buildId: string;
    projectPath: string;
    previewUrl: string;
    checkIntervalMs: number;
    captureOnFileChange: boolean;
    antiSlopThreshold: number;
}

// Anti-slop CSS patterns to detect visually
const CSS_SLOP_PATTERNS = [
    { pattern: /linear-gradient\([^)]*purple[^)]*pink[^)]*\)/i, message: 'Purple-to-pink gradient (AI slop)' },
    { pattern: /linear-gradient\([^)]*blue[^)]*purple[^)]*\)/i, message: 'Blue-to-purple gradient (AI slop)' },
    { pattern: /font-family:\s*sans-serif/i, message: 'Generic sans-serif font' },
    { pattern: /box-shadow:\s*none/i, message: 'Flat design without depth' },
];

// Layout issue detection selectors
const LAYOUT_CHECKS = [
    { selector: '[style*="overflow: hidden"]', issue: 'Hidden overflow may clip content' },
    { selector: 'img:not([alt])', issue: 'Image missing alt text' },
    { selector: 'button:empty', issue: 'Empty button detected' },
    { selector: '[style*="position: fixed"]', issue: 'Fixed positioning - ensure mobile compatibility' },
];

// =============================================================================
// BROWSER-IN-LOOP SERVICE
// =============================================================================

export class BrowserInLoopService extends EventEmitter {
    private config: BrowserInLoopConfig;
    private feedbackChannel: StreamingFeedbackChannel;
    private browserState: BrowserState | null = null;
    private checkInterval: NodeJS.Timeout | null = null;
    private lastCheckTime: Date | null = null;
    private visualChecks: VisualCheck[] = [];
    private running: boolean = false;

    // File change tracking
    private pendingFileChanges: Set<string> = new Set();
    private fileChangeDebounce: NodeJS.Timeout | null = null;

    // Browser connection (would use Playwright in production)
    private browserConnected: boolean = false;

    constructor(config: BrowserInLoopConfig) {
        super();
        this.config = {
            checkIntervalMs: 30000, // 30 seconds default
            captureOnFileChange: true,
            antiSlopThreshold: 85,
            ...config,
        };
        this.feedbackChannel = getStreamingFeedbackChannel();

        console.log(`[BrowserInLoop] Initialized for build ${config.buildId}`);
    }

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    /**
     * Start the browser-in-loop service
     */
    async start(): Promise<void> {
        if (this.running) return;
        this.running = true;

        console.log(`[BrowserInLoop] Starting for ${this.config.previewUrl}`);

        // Initialize browser connection
        await this.connectBrowser();

        // Start periodic visual checks
        this.checkInterval = setInterval(async () => {
            if (this.running && this.browserConnected) {
                await this.runVisualCheck();
            }
        }, this.config.checkIntervalMs);

        // Initial check
        await this.runVisualCheck();

        this.emit('started', { buildId: this.config.buildId, previewUrl: this.config.previewUrl });
    }

    /**
     * Stop the service
     */
    async stop(): Promise<void> {
        if (!this.running) return;
        this.running = false;

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        if (this.fileChangeDebounce) {
            clearTimeout(this.fileChangeDebounce);
            this.fileChangeDebounce = null;
        }

        await this.disconnectBrowser();

        this.emit('stopped', { buildId: this.config.buildId });
        console.log(`[BrowserInLoop] Stopped for build ${this.config.buildId}`);
    }

    // =========================================================================
    // BROWSER CONNECTION
    // =========================================================================

    /**
     * Connect to the preview browser
     */
    private async connectBrowser(): Promise<void> {
        try {
            // In production, this would use Playwright to connect to the preview
            // For now, we simulate the connection
            this.browserConnected = true;
            this.browserState = {
                url: this.config.previewUrl,
                title: 'KripTik Preview',
                viewportWidth: 1280,
                viewportHeight: 720,
                scrollPosition: { x: 0, y: 0 },
                consoleErrors: [],
                networkErrors: [],
            };

            console.log(`[BrowserInLoop] Browser connected to ${this.config.previewUrl}`);
            this.emit('browser:connected', { url: this.config.previewUrl });
        } catch (error) {
            console.error('[BrowserInLoop] Failed to connect browser:', error);
            this.browserConnected = false;
            throw error;
        }
    }

    /**
     * Disconnect from the browser
     */
    private async disconnectBrowser(): Promise<void> {
        this.browserConnected = false;
        this.browserState = null;
        console.log(`[BrowserInLoop] Browser disconnected`);
        this.emit('browser:disconnected');
    }

    // =========================================================================
    // FILE CHANGE HANDLING
    // =========================================================================

    /**
     * Notify that a file was changed - triggers visual check after debounce
     */
    notifyFileChanged(filePath: string): void {
        if (!this.config.captureOnFileChange) return;

        // Only care about style-related files
        if (!this.isVisuallyRelevantFile(filePath)) return;

        this.pendingFileChanges.add(filePath);

        // Debounce file changes to avoid excessive checks
        if (this.fileChangeDebounce) {
            clearTimeout(this.fileChangeDebounce);
        }

        this.fileChangeDebounce = setTimeout(async () => {
            if (this.pendingFileChanges.size > 0) {
                console.log(`[BrowserInLoop] Running visual check after ${this.pendingFileChanges.size} file changes`);
                await this.runVisualCheck();
                this.pendingFileChanges.clear();
            }
        }, 2000); // 2 second debounce
    }

    private isVisuallyRelevantFile(filePath: string): boolean {
        return /\.(tsx|jsx|css|scss|sass|less|html|svg)$/.test(filePath);
    }

    // =========================================================================
    // VISUAL CHECKING
    // =========================================================================

    /**
     * Run a complete visual check
     */
    async runVisualCheck(): Promise<VisualCheck> {
        const checkId = uuidv4();
        const startTime = Date.now();

        console.log(`[BrowserInLoop] Running visual check ${checkId}`);

        try {
            // Capture current state
            const screenshot = await this.captureScreenshot();
            const domSnapshot = await this.captureDOMSnapshot();

            // Run anti-slop detection
            const antiSlopIssues = await this.detectAntiSlopIssues(domSnapshot);

            // Run layout checks
            const layoutIssues = await this.detectLayoutIssues(domSnapshot);

            // Run accessibility checks
            const accessibilityIssues = await this.detectAccessibilityIssues(domSnapshot);

            // Combine all issues
            const allIssues = [...antiSlopIssues, ...layoutIssues, ...accessibilityIssues];

            // Calculate score
            const score = this.calculateVisualScore(allIssues);
            const passed = score >= this.config.antiSlopThreshold;

            const check: VisualCheck = {
                id: checkId,
                timestamp: new Date(),
                screenshot,
                issues: allIssues,
                score,
                passed,
            };

            this.visualChecks.push(check);
            this.lastCheckTime = new Date();

            // Stream issues to feedback channel
            for (const issue of allIssues) {
                this.feedbackChannel.injectFeedback(
                    this.config.buildId,
                    'visual',
                    issue.severity,
                    issue.message,
                    {
                        context: {
                            checkId,
                            issueType: issue.type,
                            location: issue.location,
                        },
                    }
                );
            }

            // Emit check complete
            this.emit('check:complete', {
                checkId,
                score,
                passed,
                issueCount: allIssues.length,
                duration: Date.now() - startTime,
            });

            if (!passed) {
                console.log(`[BrowserInLoop] Visual check FAILED (score: ${score}, threshold: ${this.config.antiSlopThreshold})`);
                this.emit('check:failed', { checkId, score, issues: allIssues });
            } else {
                console.log(`[BrowserInLoop] Visual check PASSED (score: ${score})`);
            }

            return check;
        } catch (error) {
            console.error('[BrowserInLoop] Visual check error:', error);

            const failedCheck: VisualCheck = {
                id: checkId,
                timestamp: new Date(),
                screenshot: '',
                issues: [{
                    type: 'performance',
                    severity: 'high',
                    message: `Visual check failed: ${(error as Error).message}`,
                }],
                score: 0,
                passed: false,
            };

            this.visualChecks.push(failedCheck);
            return failedCheck;
        }
    }

    /**
     * Capture screenshot of current browser state
     */
    private async captureScreenshot(): Promise<string> {
        // In production, this would use Playwright to capture a real screenshot
        // For now, return a placeholder
        return `data:image/png;base64,screenshot_${Date.now()}`;
    }

    /**
     * Capture DOM snapshot for analysis
     */
    private async captureDOMSnapshot(): Promise<string> {
        // In production, this would serialize the actual DOM
        // For now, return a simulated DOM structure
        return `
            <html>
                <head><title>Preview</title></head>
                <body>
                    <div class="app-container">
                        <header class="app-header">
                            <nav class="navigation"></nav>
                        </header>
                        <main class="main-content">
                            <div class="content-wrapper"></div>
                        </main>
                    </div>
                </body>
            </html>
        `;
    }

    // =========================================================================
    // ISSUE DETECTION
    // =========================================================================

    /**
     * Detect anti-slop patterns in the DOM
     */
    private async detectAntiSlopIssues(domSnapshot: string): Promise<VisualIssue[]> {
        const issues: VisualIssue[] = [];

        // Check for banned gradient patterns
        for (const { pattern, message } of CSS_SLOP_PATTERNS) {
            if (pattern.test(domSnapshot)) {
                issues.push({
                    type: 'anti_slop',
                    severity: 'critical',
                    message: `AI Slop Detected: ${message}`,
                });
            }
        }

        // Check for emoji in UI elements
        const emojiPattern = /[\u{1F300}-\u{1F9FF}]/u;
        if (emojiPattern.test(domSnapshot)) {
            issues.push({
                type: 'anti_slop',
                severity: 'critical',
                message: 'Emoji detected in production UI - remove all emoji',
            });
        }

        // Check for flat design indicators
        if (!domSnapshot.includes('box-shadow') && !domSnapshot.includes('shadow')) {
            issues.push({
                type: 'anti_slop',
                severity: 'high',
                message: 'No shadows detected - add depth with shadows and layers',
            });
        }

        // Check for generic fonts
        if (domSnapshot.includes('font-family: sans-serif') ||
            domSnapshot.includes('font-family: system-ui') ||
            domSnapshot.includes('font-sans')) {
            issues.push({
                type: 'anti_slop',
                severity: 'medium',
                message: 'Generic font detected - use configured custom fonts',
            });
        }

        return issues;
    }

    /**
     * Detect layout issues
     */
    private async detectLayoutIssues(domSnapshot: string): Promise<VisualIssue[]> {
        const issues: VisualIssue[] = [];

        // Check for overflow issues
        if (domSnapshot.includes('overflow: hidden') && domSnapshot.includes('text-overflow')) {
            // This is probably intentional truncation, skip
        } else if (domSnapshot.includes('overflow: hidden')) {
            issues.push({
                type: 'layout',
                severity: 'medium',
                message: 'Hidden overflow may clip important content',
            });
        }

        // Check for very long content without wrapping
        if (domSnapshot.includes('white-space: nowrap') && !domSnapshot.includes('text-overflow')) {
            issues.push({
                type: 'layout',
                severity: 'low',
                message: 'Non-wrapping text without truncation may overflow',
            });
        }

        // Check for fixed positioning (mobile concerns)
        const fixedCount = (domSnapshot.match(/position:\s*fixed/g) || []).length;
        if (fixedCount > 3) {
            issues.push({
                type: 'layout',
                severity: 'medium',
                message: `Multiple fixed position elements (${fixedCount}) - may cause mobile issues`,
            });
        }

        return issues;
    }

    /**
     * Detect accessibility issues
     */
    private async detectAccessibilityIssues(domSnapshot: string): Promise<VisualIssue[]> {
        const issues: VisualIssue[] = [];

        // Check for images without alt
        const imgCount = (domSnapshot.match(/<img/g) || []).length;
        const altCount = (domSnapshot.match(/<img[^>]*alt=/g) || []).length;
        if (imgCount > altCount) {
            issues.push({
                type: 'accessibility',
                severity: 'high',
                message: `${imgCount - altCount} image(s) missing alt text`,
            });
        }

        // Check for form inputs without labels
        const inputCount = (domSnapshot.match(/<input/g) || []).length;
        const labelCount = (domSnapshot.match(/<label/g) || []).length;
        if (inputCount > labelCount) {
            issues.push({
                type: 'accessibility',
                severity: 'medium',
                message: 'Some form inputs may be missing labels',
            });
        }

        // Check for low contrast (simplified check)
        if (domSnapshot.includes('text-gray-300') || domSnapshot.includes('text-gray-400')) {
            issues.push({
                type: 'accessibility',
                severity: 'medium',
                message: 'Low contrast text detected - ensure sufficient contrast ratio',
            });
        }

        // Check for clickable divs without role
        if (domSnapshot.includes('onClick') || domSnapshot.includes('onclick')) {
            if (!domSnapshot.includes('role="button"') && !domSnapshot.includes('<button')) {
                issues.push({
                    type: 'accessibility',
                    severity: 'medium',
                    message: 'Clickable elements should use <button> or have role="button"',
                });
            }
        }

        return issues;
    }

    /**
     * Calculate visual quality score
     */
    private calculateVisualScore(issues: VisualIssue[]): number {
        let score = 100;

        for (const issue of issues) {
            switch (issue.severity) {
                case 'critical':
                    score -= 25;
                    break;
                case 'high':
                    score -= 15;
                    break;
                case 'medium':
                    score -= 8;
                    break;
                case 'low':
                    score -= 3;
                    break;
            }
        }

        return Math.max(0, score);
    }

    // =========================================================================
    // BROWSER MANIPULATION (for agents)
    // =========================================================================

    /**
     * Navigate to a specific URL
     */
    async navigate(url: string): Promise<void> {
        if (!this.browserConnected) {
            throw new Error('Browser not connected');
        }

        console.log(`[BrowserInLoop] Navigating to ${url}`);
        // In production, use Playwright to navigate

        if (this.browserState) {
            this.browserState.url = url;
        }

        this.emit('browser:navigated', { url });
    }

    /**
     * Click an element by selector
     */
    async click(selector: string): Promise<void> {
        if (!this.browserConnected) {
            throw new Error('Browser not connected');
        }

        console.log(`[BrowserInLoop] Clicking ${selector}`);
        // In production, use Playwright to click

        this.emit('browser:clicked', { selector });
    }

    /**
     * Type text into an input
     */
    async type(selector: string, text: string): Promise<void> {
        if (!this.browserConnected) {
            throw new Error('Browser not connected');
        }

        console.log(`[BrowserInLoop] Typing into ${selector}`);
        // In production, use Playwright to type

        this.emit('browser:typed', { selector, text: text.substring(0, 20) + '...' });
    }

    /**
     * Wait for a selector to appear
     */
    async waitForSelector(selector: string, timeout: number = 5000): Promise<boolean> {
        if (!this.browserConnected) {
            throw new Error('Browser not connected');
        }

        console.log(`[BrowserInLoop] Waiting for ${selector}`);
        // In production, use Playwright to wait

        return true;
    }

    /**
     * Get element text content
     */
    async getTextContent(selector: string): Promise<string> {
        if (!this.browserConnected) {
            throw new Error('Browser not connected');
        }

        // In production, use Playwright to get text
        return 'Element text content';
    }

    /**
     * Check if element is visible
     */
    async isVisible(selector: string): Promise<boolean> {
        if (!this.browserConnected) {
            throw new Error('Browser not connected');
        }

        // In production, use Playwright to check visibility
        return true;
    }

    // =========================================================================
    // STATE ACCESS
    // =========================================================================

    /**
     * Get current browser state
     */
    getBrowserState(): BrowserState | null {
        return this.browserState;
    }

    /**
     * Get all visual checks
     */
    getVisualChecks(): VisualCheck[] {
        return [...this.visualChecks];
    }

    /**
     * Get the most recent visual check
     */
    getLastVisualCheck(): VisualCheck | null {
        return this.visualChecks[this.visualChecks.length - 1] || null;
    }

    /**
     * Get current visual score
     */
    getCurrentScore(): number {
        const lastCheck = this.getLastVisualCheck();
        return lastCheck?.score ?? 100;
    }

    /**
     * Check if currently passing
     */
    isPassing(): boolean {
        const lastCheck = this.getLastVisualCheck();
        return lastCheck?.passed ?? true;
    }

    /**
     * Get all unresolved issues
     */
    getUnresolvedIssues(): VisualIssue[] {
        const lastCheck = this.getLastVisualCheck();
        return lastCheck?.issues || [];
    }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createBrowserInLoop(config: BrowserInLoopConfig): BrowserInLoopService {
    return new BrowserInLoopService(config);
}
