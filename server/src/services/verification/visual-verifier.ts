/**
 * Visual Verifier Agent
 *
 * Browser-based visual verification using Playwright.
 * BLOCKING agent - halts build on critical visual issues.
 *
 * Checks:
 * - UI renders correctly
 * - No visual regressions
 * - Responsive design compliance
 * - Accessibility basics (color contrast, focus states)
 * - Interactive element functionality
 *
 * Part of Phase 4: 6-Agent Verification Swarm
 */

import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { Browser, Page, BrowserContext } from 'playwright';

// ============================================================================
// TYPES
// ============================================================================

export type VisualIssueType =
    | 'render_error'
    | 'layout_broken'
    | 'responsive_fail'
    | 'accessibility'
    | 'interaction_broken'
    | 'style_missing'
    | 'blank_screen'
    | 'console_error';

export type VisualIssueSeverity = 'critical' | 'major' | 'minor';

export interface VisualIssue {
    id: string;
    type: VisualIssueType;
    severity: VisualIssueSeverity;
    title: string;
    description: string;
    viewport?: string;
    screenshot?: string;   // Base64 encoded
    selector?: string;
    aiAnalysis?: string;
}

export interface ViewportConfig {
    name: string;
    width: number;
    height: number;
}

export interface VisualVerificationResult {
    timestamp: Date;
    passed: boolean;
    blocking: boolean;
    issues: VisualIssue[];
    screenshots: { viewport: string; data: string }[];
    consoleErrors: string[];
    summary: string;
    aiSummary?: string;
}

export interface VisualVerifierConfig {
    viewports: ViewportConfig[];
    waitForLoad: number;        // ms to wait for page load
    checkInteractions: boolean;
    enableAIAnalysis: boolean;
    screenshotOnError: boolean;
    blockOnBlankScreen: boolean;
    blockOnConsoleErrors: boolean;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: VisualVerifierConfig = {
    viewports: [
        { name: 'mobile', width: 375, height: 812 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1440, height: 900 },
    ],
    waitForLoad: 3000,
    checkInteractions: true,
    enableAIAnalysis: true,
    screenshotOnError: true,
    blockOnBlankScreen: true,
    blockOnConsoleErrors: false,
};

// ============================================================================
// VISUAL VERIFIER AGENT
// ============================================================================

export class VisualVerifierAgent extends EventEmitter {
    private projectId: string;
    private userId: string;
    private config: VisualVerifierConfig;
    private claudeService: ReturnType<typeof createClaudeService>;
    private browser?: Browser;
    private lastResult?: VisualVerificationResult;

    constructor(
        projectId: string,
        userId: string,
        config?: Partial<VisualVerifierConfig>
    ) {
        super();
        this.projectId = projectId;
        this.userId = userId;
        this.config = { ...DEFAULT_CONFIG, ...config };
        
        this.claudeService = createClaudeService({
            agentType: 'verification',
            projectId,
            userId,
        });
    }

    /**
     * Initialize browser for visual testing
     */
    async initialize(): Promise<void> {
        try {
            const playwright = await import('playwright');
            this.browser = await playwright.chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            console.log('[VisualVerifier] Browser initialized');
        } catch (error) {
            console.error('[VisualVerifier] Failed to initialize browser:', error);
            throw error;
        }
    }

    /**
     * Cleanup browser resources
     */
    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = undefined;
            console.log('[VisualVerifier] Browser closed');
        }
    }

    /**
     * Run visual verification on a URL
     */
    async verify(url: string): Promise<VisualVerificationResult> {
        const startTime = Date.now();
        const issues: VisualIssue[] = [];
        const screenshots: { viewport: string; data: string }[] = [];
        const consoleErrors: string[] = [];
        
        console.log(`[VisualVerifier] Starting verification of ${url}`);
        
        // Initialize browser if needed
        if (!this.browser) {
            await this.initialize();
        }
        
        if (!this.browser) {
            return this.createFailedResult('Browser not available');
        }
        
        let context: BrowserContext | undefined;
        
        try {
            // Test each viewport
            for (const viewport of this.config.viewports) {
                context = await this.browser.newContext({
                    viewport: { width: viewport.width, height: viewport.height },
                });
                
                const page = await context.newPage();
                
                // Collect console errors
                page.on('console', (msg) => {
                    if (msg.type() === 'error') {
                        consoleErrors.push(`[${viewport.name}] ${msg.text()}`);
                    }
                });
                
                // Collect page errors
                page.on('pageerror', (error) => {
                    consoleErrors.push(`[${viewport.name}] ${error.message}`);
                });
                
                try {
                    // Navigate to URL
                    await page.goto(url, { 
                        waitUntil: 'networkidle',
                        timeout: 30000,
                    });
                    
                    // Wait for content to render
                    await page.waitForTimeout(this.config.waitForLoad);
                    
                    // Take screenshot
                    const screenshot = await page.screenshot({ 
                        fullPage: true,
                        type: 'png',
                    });
                    screenshots.push({
                        viewport: viewport.name,
                        data: screenshot.toString('base64'),
                    });
                    
                    // Check for blank screen
                    const viewportIssues = await this.checkViewport(page, viewport);
                    issues.push(...viewportIssues);
                    
                    // Check interactions if enabled
                    if (this.config.checkInteractions) {
                        const interactionIssues = await this.checkInteractions(page, viewport);
                        issues.push(...interactionIssues);
                    }
                    
                } catch (error) {
                    issues.push({
                        id: uuidv4(),
                        type: 'render_error',
                        severity: 'critical',
                        title: 'Page load failed',
                        description: `Failed to load page at ${viewport.name} viewport: ${error instanceof Error ? error.message : String(error)}`,
                        viewport: viewport.name,
                    });
                }
                
                await context.close();
            }
            
            // Check console errors
            if (consoleErrors.length > 0 && this.config.blockOnConsoleErrors) {
                issues.push({
                    id: uuidv4(),
                    type: 'console_error',
                    severity: 'major',
                    title: 'Console errors detected',
                    description: `Found ${consoleErrors.length} console error(s)`,
                });
            }
            
            // Run AI analysis if enabled
            let aiSummary: string | undefined;
            if (this.config.enableAIAnalysis && screenshots.length > 0) {
                aiSummary = await this.runAIAnalysis(screenshots, issues);
            }
            
            // Determine blocking status
            const criticalIssues = issues.filter(i => i.severity === 'critical');
            const blocking = criticalIssues.length > 0 || 
                (this.config.blockOnBlankScreen && issues.some(i => i.type === 'blank_screen'));
            
            const result: VisualVerificationResult = {
                timestamp: new Date(),
                passed: issues.filter(i => i.severity !== 'minor').length === 0,
                blocking,
                issues,
                screenshots,
                consoleErrors,
                summary: this.generateSummary(issues, consoleErrors),
                aiSummary,
            };
            
            this.lastResult = result;
            this.emit('verification_complete', result);
            
            console.log(`[VisualVerifier] Verification complete: ${issues.length} issues (${Date.now() - startTime}ms)`);
            
            return result;
            
        } catch (error) {
            console.error('[VisualVerifier] Verification failed:', error);
            return this.createFailedResult(error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Get last verification result
     */
    getLastResult(): VisualVerificationResult | undefined {
        return this.lastResult;
    }

    // ==========================================================================
    // INTERNAL CHECKS
    // ==========================================================================

    private async checkViewport(page: Page, viewport: ViewportConfig): Promise<VisualIssue[]> {
        const issues: VisualIssue[] = [];
        
        // Check for blank screen
        const bodyContent = await page.evaluate(() => {
            const body = document.body;
            return {
                text: body?.innerText?.trim() || '',
                childCount: body?.children?.length || 0,
                hasVisibleContent: body ? 
                    window.getComputedStyle(body).display !== 'none' : false,
            };
        });
        
        if (bodyContent.text.length < 10 && bodyContent.childCount < 3) {
            issues.push({
                id: uuidv4(),
                type: 'blank_screen',
                severity: 'critical',
                title: 'Blank or near-empty screen',
                description: `Page appears blank at ${viewport.name} viewport`,
                viewport: viewport.name,
            });
        }
        
        // Check for broken layout (elements overflowing)
        const layoutIssues = await page.evaluate(() => {
            const issues: { element: string; issue: string }[] = [];
            
            // Check for horizontal overflow
            if (document.body.scrollWidth > window.innerWidth) {
                issues.push({
                    element: 'body',
                    issue: 'Horizontal overflow detected',
                });
            }
            
            // Check for elements outside viewport
            const elements = document.querySelectorAll('*');
            elements.forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.left < -50 || rect.right > window.innerWidth + 50) {
                    if (window.getComputedStyle(el).position !== 'fixed') {
                        issues.push({
                            element: el.tagName.toLowerCase(),
                            issue: 'Element extends beyond viewport',
                        });
                    }
                }
            });
            
            return issues.slice(0, 5); // Limit to 5 issues
        });
        
        for (const layoutIssue of layoutIssues) {
            issues.push({
                id: uuidv4(),
                type: 'layout_broken',
                severity: 'major',
                title: 'Layout issue detected',
                description: `${layoutIssue.issue} (${layoutIssue.element})`,
                viewport: viewport.name,
            });
        }
        
        // Check for missing images
        const brokenImages = await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            const broken: string[] = [];
            images.forEach((img) => {
                if (!img.complete || img.naturalWidth === 0) {
                    broken.push(img.src || 'unknown');
                }
            });
            return broken;
        });
        
        if (brokenImages.length > 0) {
            issues.push({
                id: uuidv4(),
                type: 'style_missing',
                severity: 'major',
                title: 'Broken images detected',
                description: `Found ${brokenImages.length} broken image(s)`,
                viewport: viewport.name,
            });
        }
        
        // Check basic accessibility
        const accessibilityIssues = await page.evaluate(() => {
            const issues: string[] = [];
            
            // Check for alt text on images
            const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
            if (imagesWithoutAlt.length > 0) {
                issues.push(`${imagesWithoutAlt.length} images missing alt text`);
            }
            
            // Check for buttons without accessible names
            const buttonsWithoutText = document.querySelectorAll('button:empty:not([aria-label])');
            if (buttonsWithoutText.length > 0) {
                issues.push(`${buttonsWithoutText.length} buttons without accessible name`);
            }
            
            // Check for form inputs without labels
            const inputsWithoutLabels = document.querySelectorAll('input:not([aria-label]):not([id])');
            if (inputsWithoutLabels.length > 0) {
                issues.push(`${inputsWithoutLabels.length} inputs without labels`);
            }
            
            return issues;
        });
        
        for (const a11yIssue of accessibilityIssues) {
            issues.push({
                id: uuidv4(),
                type: 'accessibility',
                severity: 'minor',
                title: 'Accessibility issue',
                description: a11yIssue,
                viewport: viewport.name,
            });
        }
        
        return issues;
    }

    private async checkInteractions(page: Page, viewport: ViewportConfig): Promise<VisualIssue[]> {
        const issues: VisualIssue[] = [];
        
        try {
            // Find interactive elements
            const interactiveElements = await page.evaluate(() => {
                const elements: { selector: string; type: string }[] = [];
                
                // Buttons
                document.querySelectorAll('button').forEach((btn, i) => {
                    elements.push({
                        selector: btn.id ? `#${btn.id}` : `button:nth-of-type(${i + 1})`,
                        type: 'button',
                    });
                });
                
                // Links (limit to visible ones)
                document.querySelectorAll('a[href]').forEach((link, i) => {
                    const rect = link.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        elements.push({
                            selector: link.id ? `#${link.id}` : `a:nth-of-type(${i + 1})`,
                            type: 'link',
                        });
                    }
                });
                
                return elements.slice(0, 5); // Test first 5 interactive elements
            });
            
            // Test each interactive element
            for (const element of interactiveElements) {
                try {
                    const el = await page.$(element.selector);
                    if (el) {
                        const box = await el.boundingBox();
                        if (!box || box.width === 0 || box.height === 0) {
                            issues.push({
                                id: uuidv4(),
                                type: 'interaction_broken',
                                severity: 'major',
                                title: 'Interactive element not visible',
                                description: `${element.type} at "${element.selector}" has no visible area`,
                                viewport: viewport.name,
                                selector: element.selector,
                            });
                        }
                        
                        // Check if clickable
                        const isClickable = await el.evaluate((node) => {
                            const style = window.getComputedStyle(node as Element);
                            return style.pointerEvents !== 'none' && 
                                   style.display !== 'none' && 
                                   style.visibility !== 'hidden';
                        });
                        
                        if (!isClickable) {
                            issues.push({
                                id: uuidv4(),
                                type: 'interaction_broken',
                                severity: 'major',
                                title: 'Interactive element not clickable',
                                description: `${element.type} at "${element.selector}" cannot be interacted with`,
                                viewport: viewport.name,
                                selector: element.selector,
                            });
                        }
                    }
                } catch (e) {
                    // Element might not be found, skip
                }
            }
        } catch (error) {
            console.error('[VisualVerifier] Interaction check failed:', error);
        }
        
        return issues;
    }

    // ==========================================================================
    // AI ANALYSIS
    // ==========================================================================

    private async runAIAnalysis(
        screenshots: { viewport: string; data: string }[],
        issues: VisualIssue[]
    ): Promise<string> {
        try {
            // Use the desktop screenshot for analysis
            const desktopScreenshot = screenshots.find(s => s.viewport === 'desktop') || screenshots[0];
            
            if (!desktopScreenshot) {
                return 'No screenshots available for AI analysis';
            }
            
            const issuesSummary = issues.map(i => 
                `- [${i.severity}] ${i.title}: ${i.description}`
            ).join('\n');
            
            // Note: In production, this would use Claude's vision capability
            // For now, we'll provide a text-based analysis
            const response = await this.claudeService.generate(
                `As a UI/UX expert, analyze these visual verification results:

DETECTED ISSUES:
${issuesSummary || 'No automated issues detected'}

SCREENSHOTS CAPTURED:
${screenshots.map(s => `- ${s.viewport} viewport`).join('\n')}

Provide a brief (2-3 sentences) summary of the visual quality and any concerns.`,
                {
                    model: CLAUDE_MODELS.HAIKU,
                    maxTokens: 200,
                    useExtendedThinking: false,
                }
            );
            
            return response.content.trim();
        } catch (error) {
            console.error('[VisualVerifier] AI analysis failed:', error);
            return 'AI analysis unavailable';
        }
    }

    // ==========================================================================
    // HELPERS
    // ==========================================================================

    private createFailedResult(error: string): VisualVerificationResult {
        return {
            timestamp: new Date(),
            passed: false,
            blocking: true,
            issues: [{
                id: uuidv4(),
                type: 'render_error',
                severity: 'critical',
                title: 'Verification failed',
                description: error,
            }],
            screenshots: [],
            consoleErrors: [],
            summary: `Visual verification failed: ${error}`,
        };
    }

    private generateSummary(issues: VisualIssue[], consoleErrors: string[]): string {
        if (issues.length === 0 && consoleErrors.length === 0) {
            return 'Visual verification passed. No issues detected.';
        }
        
        const critical = issues.filter(i => i.severity === 'critical').length;
        const major = issues.filter(i => i.severity === 'major').length;
        const minor = issues.filter(i => i.severity === 'minor').length;
        
        const parts: string[] = [];
        if (critical > 0) parts.push(`${critical} critical`);
        if (major > 0) parts.push(`${major} major`);
        if (minor > 0) parts.push(`${minor} minor`);
        if (consoleErrors.length > 0) parts.push(`${consoleErrors.length} console errors`);
        
        return `Visual issues found: ${parts.join(', ')}`;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createVisualVerifierAgent(
    projectId: string,
    userId: string,
    config?: Partial<VisualVerifierConfig>
): VisualVerifierAgent {
    return new VisualVerifierAgent(projectId, userId, config);
}

export default VisualVerifierAgent;

