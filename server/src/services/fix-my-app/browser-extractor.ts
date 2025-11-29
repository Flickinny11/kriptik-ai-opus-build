/**
 * Browser Extractor Service
 *
 * Uses browser automation to help users log into their AI builder platforms,
 * whitelist projects, and automatically extract:
 * - Full chat/streaming history
 * - Build logs and error logs
 * - Project files (via ZIP download)
 * - Version history (if available)
 *
 * The user sees the browser within KripTik AI, logs in themselves,
 * then the automation takes over to extract everything.
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import type { ImportSource, ChatMessage, BuildLog, ErrorLog } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionConfig {
    source: ImportSource;
    sessionId: string;
    userId: string;
    projectUrl?: string;
}

export interface ExtractionProgress {
    phase: 'waiting_login' | 'logged_in' | 'extracting_chat' | 'extracting_files' | 'extracting_logs' | 'downloading' | 'complete' | 'error';
    progress: number;
    message: string;
    screenshot?: string;
}

export interface ExtractedData {
    chatHistory: ChatMessage[];
    buildLogs: BuildLog[];
    errorLogs: ErrorLog[];
    files: Map<string, string>;
    projectName: string;
    projectUrl: string;
}

export interface PlatformSelectors {
    loginButton?: string;
    chatContainer?: string;
    chatMessages?: string;
    userMessage?: string;
    aiMessage?: string;
    errorBadge?: string;
    downloadButton?: string;
    exportButton?: string;
    logsPanel?: string;
    fileTree?: string;
}

// Platform-specific selectors for different AI builders
const PLATFORM_SELECTORS: Record<string, PlatformSelectors> = {
    lovable: {
        loginButton: '[data-testid="login-button"], button:has-text("Sign in")',
        chatContainer: '[data-testid="chat-container"], .chat-panel',
        chatMessages: '[data-testid="message"], .chat-message',
        userMessage: '.user-message, [data-role="user"]',
        aiMessage: '.assistant-message, [data-role="assistant"]',
        downloadButton: 'button:has-text("Download"), button:has-text("Export")',
        logsPanel: '[data-testid="logs"], .build-logs',
    },
    bolt: {
        loginButton: 'button:has-text("Sign in"), button:has-text("Log in")',
        chatContainer: '.chat-window, [class*="chat"]',
        chatMessages: '.message, [class*="message"]',
        userMessage: '[class*="user"]',
        aiMessage: '[class*="assistant"], [class*="ai"]',
        downloadButton: 'button:has-text("Download")',
    },
    v0: {
        loginButton: 'button:has-text("Sign in")',
        chatContainer: '[class*="chat"]',
        chatMessages: '[class*="message"]',
        userMessage: '[class*="user"]',
        aiMessage: '[class*="assistant"]',
        downloadButton: 'button:has-text("Copy code"), button:has-text("Export")',
    },
    cursor: {
        chatContainer: '.composer-panel',
        chatMessages: '.message',
        userMessage: '.user-message',
        aiMessage: '.assistant-message',
    },
    windsurf: {
        chatContainer: '.cascade-panel',
        chatMessages: '.chat-message',
        userMessage: '.user-message',
        aiMessage: '.ai-message',
    },
    replit: {
        loginButton: 'button:has-text("Log in")',
        chatContainer: '[data-testid="ai-chat"]',
        chatMessages: '.ai-message',
        downloadButton: 'button:has-text("Download as zip")',
    },
    // Generic fallback
    default: {
        chatMessages: '[class*="message"], [data-message], .message',
        userMessage: '[class*="user"], [data-role="user"]',
        aiMessage: '[class*="assistant"], [class*="ai"], [data-role="assistant"]',
    },
};

// ============================================================================
// BROWSER EXTRACTOR SERVICE
// ============================================================================

export class BrowserExtractorService extends EventEmitter {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private config: ExtractionConfig;
    private claudeService: ReturnType<typeof createClaudeService>;
    private isRunning = false;
    private extractedData: ExtractedData = {
        chatHistory: [],
        buildLogs: [],
        errorLogs: [],
        files: new Map(),
        projectName: '',
        projectUrl: '',
    };

    constructor(config: ExtractionConfig) {
        super();
        this.config = config;
        this.claudeService = createClaudeService({
            agentType: 'testing',
            projectId: config.sessionId,
            userId: config.userId,
        });
    }

    // =========================================================================
    // PUBLIC METHODS
    // =========================================================================

    /**
     * Start the browser for user login
     * Returns a WebSocket URL for streaming the browser view to the frontend
     */
    async startBrowser(): Promise<{ wsEndpoint: string; viewUrl: string }> {
        this.browser = await chromium.launch({
            headless: false, // User needs to see and interact
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
            ],
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1200, height: 800 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        this.page = await this.context.newPage();

        // Get WebSocket endpoint for remote view
        const wsEndpoint = this.browser.wsEndpoint();

        // Navigate to the platform login
        const platformUrl = this.getPlatformUrl();
        await this.page.goto(platformUrl);

        this.emitProgress('waiting_login', 0, 'Please log in to your account');

        return {
            wsEndpoint,
            viewUrl: platformUrl,
        };
    }

    /**
     * Wait for user to complete login and whitelist
     * Called after user signals they've logged in
     */
    async waitForLogin(timeoutMs: number = 300000): Promise<boolean> {
        if (!this.page) throw new Error('Browser not started');

        try {
            // Wait for common post-login indicators
            await Promise.race([
                this.page.waitForSelector('[data-testid="dashboard"], [class*="dashboard"], [class*="projects"]', { timeout: timeoutMs }),
                this.page.waitForURL(/dashboard|projects|home/, { timeout: timeoutMs }),
                this.page.waitForSelector('[data-testid="user-menu"], [class*="avatar"]', { timeout: timeoutMs }),
            ]);

            this.emitProgress('logged_in', 10, 'Login detected! Preparing extraction...');
            return true;
        } catch {
            this.emitProgress('error', 0, 'Login timeout - please try again');
            return false;
        }
    }

    /**
     * Navigate to a specific project (user provides URL or selects from list)
     */
    async navigateToProject(projectUrl: string): Promise<boolean> {
        if (!this.page) throw new Error('Browser not started');

        try {
            await this.page.goto(projectUrl, { waitUntil: 'networkidle' });
            this.extractedData.projectUrl = projectUrl;

            // Try to extract project name
            const titleEl = await this.page.$('h1, [class*="project-name"], [data-testid="project-title"]');
            if (titleEl) {
                this.extractedData.projectName = await titleEl.textContent() || 'Imported Project';
            }

            this.emitProgress('logged_in', 15, `Navigated to project: ${this.extractedData.projectName}`);
            return true;
        } catch (error) {
            this.emitProgress('error', 0, `Failed to navigate to project: ${error}`);
            return false;
        }
    }

    /**
     * Main extraction method - automatically extracts all context
     * This is where the "magic" happens after user whitelists
     */
    async extractAll(): Promise<ExtractedData> {
        if (!this.page) throw new Error('Browser not started');

        this.isRunning = true;
        const selectors = PLATFORM_SELECTORS[this.config.source] || PLATFORM_SELECTORS.default;

        try {
            // Phase 1: Extract chat history
            this.emitProgress('extracting_chat', 20, 'Extracting chat history...');
            await this.extractChatHistory(selectors);

            // Phase 2: Extract build/error logs
            this.emitProgress('extracting_logs', 50, 'Extracting logs and errors...');
            await this.extractLogs(selectors);

            // Phase 3: Download project files
            this.emitProgress('downloading', 70, 'Downloading project files...');
            await this.downloadProjectFiles(selectors);

            // Phase 4: Take final screenshot
            this.emitProgress('complete', 100, 'Extraction complete!');
            const screenshot = await this.page.screenshot({ type: 'png' });
            this.emit('screenshot', screenshot.toString('base64'));

            return this.extractedData;

        } catch (error) {
            this.emitProgress('error', 0, `Extraction failed: ${error}`);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Take a screenshot of current browser state
     */
    async screenshot(): Promise<string> {
        if (!this.page) throw new Error('Browser not started');
        const buffer = await this.page.screenshot({ type: 'png' });
        return buffer.toString('base64');
    }

    /**
     * Close the browser
     */
    async close(): Promise<void> {
        this.isRunning = false;
        if (this.page) await this.page.close().catch(() => {});
        if (this.context) await this.context.close().catch(() => {});
        if (this.browser) await this.browser.close().catch(() => {});
        this.page = null;
        this.context = null;
        this.browser = null;
    }

    // =========================================================================
    // EXTRACTION METHODS
    // =========================================================================

    /**
     * Extract chat history from the platform
     */
    private async extractChatHistory(selectors: PlatformSelectors): Promise<void> {
        if (!this.page) return;

        try {
            // Wait for chat container
            if (selectors.chatContainer) {
                await this.page.waitForSelector(selectors.chatContainer, { timeout: 10000 }).catch(() => {});
            }

            // Scroll to load all messages (many platforms lazy-load)
            await this.scrollToLoadAll(selectors.chatContainer || 'body');

            // Extract messages
            const messages = await this.page.evaluate((sel) => {
                const messageEls = document.querySelectorAll(sel.chatMessages || '[class*="message"]');
                const extracted: Array<{ role: string; content: string; hasError: boolean }> = [];

                messageEls.forEach((el, index) => {
                    const isUser = el.matches(sel.userMessage || '') ||
                                   el.querySelector(sel.userMessage || '') ||
                                   el.className.includes('user');

                    const content = el.textContent?.trim() || '';
                    const hasError = el.className.includes('error') ||
                                    el.querySelector('[class*="error"]') !== null;

                    if (content) {
                        extracted.push({
                            role: isUser ? 'user' : 'assistant',
                            content,
                            hasError,
                        });
                    }
                });

                return extracted;
            }, selectors);

            // Convert to ChatMessage format
            this.extractedData.chatHistory = messages.map((msg, i) => ({
                id: uuidv4(),
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                messageNumber: i + 1,
                hasError: msg.hasError,
                hasCode: /```|function|const |let |import /.test(msg.content),
            }));

            this.emitProgress('extracting_chat', 40, `Extracted ${this.extractedData.chatHistory.length} messages`);

        } catch (error) {
            console.error('Chat extraction error:', error);
            // Continue with partial data
        }
    }

    /**
     * Extract build and error logs
     */
    private async extractLogs(selectors: PlatformSelectors): Promise<void> {
        if (!this.page) return;

        try {
            // Try to find and click logs panel
            if (selectors.logsPanel) {
                const logsTab = await this.page.$(selectors.logsPanel).catch(() => null);
                if (logsTab) {
                    await logsTab.click();
                    await this.page.waitForTimeout(1000);
                }
            }

            // Extract logs from page
            const logs = await this.page.evaluate(() => {
                const logEls = document.querySelectorAll('[class*="log"], [class*="console"], [data-testid="log"]');
                const extracted: Array<{ type: string; message: string; timestamp?: string }> = [];

                logEls.forEach((el) => {
                    const isError = el.className.includes('error') || el.textContent?.includes('Error');
                    const isWarning = el.className.includes('warn');

                    extracted.push({
                        type: isError ? 'error' : isWarning ? 'warning' : 'info',
                        message: el.textContent?.trim() || '',
                        timestamp: el.getAttribute('data-timestamp') || undefined,
                    });
                });

                return extracted;
            });

            // Separate into build logs and error logs
            this.extractedData.buildLogs = logs.map((log, i) => ({
                id: uuidv4(),
                timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
                type: log.type as 'info' | 'warning' | 'error',
                message: log.message,
            }));

            this.extractedData.errorLogs = logs
                .filter(log => log.type === 'error')
                .map((log, i) => ({
                    id: uuidv4(),
                    timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
                    errorType: 'runtime',
                    message: log.message,
                }));

            this.emitProgress('extracting_logs', 60, `Found ${this.extractedData.errorLogs.length} errors`);

        } catch (error) {
            console.error('Log extraction error:', error);
        }
    }

    /**
     * Download project files (via export/download button)
     */
    private async downloadProjectFiles(selectors: PlatformSelectors): Promise<void> {
        if (!this.page) return;

        try {
            // Look for download/export button
            const downloadBtn = await this.page.$(selectors.downloadButton || 'button:has-text("Download"), button:has-text("Export")');

            if (downloadBtn) {
                // Set up download handler
                const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });

                await downloadBtn.click();

                const download = await downloadPromise;
                const path = `/tmp/kriptik-import-${this.config.sessionId}.zip`;
                await download.saveAs(path);

                // Extract ZIP contents (implementation depends on your ZIP library)
                this.emitProgress('downloading', 90, 'Downloaded project files');

            } else {
                // Try to extract from file tree in the UI
                await this.extractFromFileTree();
            }

        } catch (error) {
            console.error('File download error:', error);
            // Try alternative method
            await this.extractFromFileTree();
        }
    }

    /**
     * Extract files from visible file tree (fallback method)
     */
    private async extractFromFileTree(): Promise<void> {
        if (!this.page) return;

        try {
            // Find file tree elements
            const files = await this.page.evaluate(() => {
                const fileEls = document.querySelectorAll('[class*="file-tree"] [class*="file"], [data-testid="file"]');
                const extracted: Array<{ path: string; content: string }> = [];

                // This is a simplified extraction - real implementation would need to click each file
                fileEls.forEach((el) => {
                    const path = el.getAttribute('data-path') || el.textContent?.trim() || '';
                    if (path && !path.includes('node_modules')) {
                        extracted.push({ path, content: '' });
                    }
                });

                return extracted;
            });

            // For now, just store the file paths
            // A full implementation would click each file and extract content
            for (const file of files) {
                this.extractedData.files.set(file.path, file.content);
            }

        } catch (error) {
            console.error('File tree extraction error:', error);
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private getPlatformUrl(): string {
        const urls: Record<string, string> = {
            lovable: 'https://lovable.dev',
            bolt: 'https://bolt.new',
            v0: 'https://v0.dev',
            create: 'https://create.xyz',
            tempo: 'https://tempo.new',
            gptengineer: 'https://gptengineer.app',
            databutton: 'https://databutton.com',
            replit: 'https://replit.com',
            cursor: 'https://cursor.com',
            windsurf: 'https://codeium.com/windsurf',
            claude: 'https://claude.ai',
            chatgpt: 'https://chat.openai.com',
        };

        return urls[this.config.source] || this.config.projectUrl || 'https://github.com';
    }

    private async scrollToLoadAll(containerSelector: string): Promise<void> {
        if (!this.page) return;

        try {
            await this.page.evaluate(async (selector) => {
                const container = document.querySelector(selector) || document.body;
                let lastHeight = 0;
                let currentHeight = container.scrollHeight;

                // Scroll up first to load older messages
                container.scrollTop = 0;
                await new Promise(r => setTimeout(r, 500));

                // Then scroll down to bottom
                while (lastHeight !== currentHeight) {
                    lastHeight = currentHeight;
                    container.scrollTop = container.scrollHeight;
                    await new Promise(r => setTimeout(r, 500));
                    currentHeight = container.scrollHeight;
                }
            }, containerSelector);
        } catch (error) {
            console.error('Scroll error:', error);
        }
    }

    private emitProgress(phase: ExtractionProgress['phase'], progress: number, message: string): void {
        this.emit('progress', { phase, progress, message });
    }
}

// Factory function
export function createBrowserExtractor(config: ExtractionConfig): BrowserExtractorService {
    return new BrowserExtractorService(config);
}

