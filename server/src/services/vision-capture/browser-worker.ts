/**
 * Browser Automation Worker
 *
 * Uses Playwright to control a headless browser for capturing
 * content from AI builder platforms.
 *
 * Supports:
 * - Screenshot capture
 * - Scrolling (mouse wheel, keyboard)
 * - Clicking at coordinates
 * - Cookie injection for auth
 * - File downloads
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  url: string;
  platform: string;
  createdAt: Date;
}

export interface ScrollOptions {
  direction: 'up' | 'down';
  amount?: number; // pixels, default 500
  smooth?: boolean;
}

export interface ClickOptions {
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export class BrowserWorker {
  private sessions: Map<string, BrowserSession> = new Map();
  private maxSessions: number = 5;

  /**
   * Create a new browser session for capturing
   */
  async createSession(
    sessionId: string,
    url: string,
    options?: {
      cookies?: Cookie[];
      viewport?: { width: number; height: number };
      userAgent?: string;
    }
  ): Promise<BrowserSession> {
    // Clean up old sessions if at limit
    if (this.sessions.size >= this.maxSessions) {
      const oldest = Array.from(this.sessions.values())
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      if (oldest) {
        await this.closeSession(oldest.id);
      }
    }

    console.log(`[BrowserWorker] Creating session ${sessionId} for ${url}`);

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    const context = await browser.newContext({
      viewport: options?.viewport || { width: 1920, height: 1080 },
      userAgent: options?.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      deviceScaleFactor: 1,
    });

    // Inject cookies if provided (for auth)
    if (options?.cookies && options.cookies.length > 0) {
      await context.addCookies(options.cookies);
      console.log(`[BrowserWorker] Injected ${options.cookies.length} cookies`);
    }

    const page = await context.newPage();

    // Set up console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[BrowserWorker][Console] ${msg.text()}`);
      }
    });

    // Navigate to URL
    console.log(`[BrowserWorker] Navigating to ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    // Detect platform from URL
    const platform = this.detectPlatform(url);

    const session: BrowserSession = {
      id: sessionId,
      browser,
      context,
      page,
      url,
      platform,
      createdAt: new Date()
    };

    this.sessions.set(sessionId, session);
    console.log(`[BrowserWorker] Session ${sessionId} created for ${platform}`);

    return session;
  }

  /**
   * Get an existing session
   */
  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Take a screenshot of the current page
   */
  async screenshot(sessionId: string): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const screenshot = await session.page.screenshot({
      type: 'png',
      fullPage: false // Just viewport, not full page
    });

    return screenshot;
  }

  /**
   * Take a full page screenshot
   */
  async fullPageScreenshot(sessionId: string): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const screenshot = await session.page.screenshot({
      type: 'png',
      fullPage: true
    });

    return screenshot;
  }

  /**
   * Scroll the page
   */
  async scroll(sessionId: string, options: ScrollOptions): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const amount = options.amount || 500;
    const deltaY = options.direction === 'up' ? -amount : amount;

    if (options.smooth) {
      // Smooth scroll using JavaScript
      await session.page.evaluate(({ dy, smooth }) => {
        window.scrollBy({
          top: dy,
          behavior: smooth ? 'smooth' : 'instant'
        });
      }, { dy: deltaY, smooth: true });
      await session.page.waitForTimeout(500); // Wait for smooth scroll
    } else {
      // Use mouse wheel for more reliable scrolling in complex UIs
      await session.page.mouse.wheel(0, deltaY);
      await session.page.waitForTimeout(300);
    }
  }

  /**
   * Scroll within a specific element (for chat containers)
   */
  async scrollElement(
    sessionId: string,
    selector: string,
    options: ScrollOptions
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const amount = options.amount || 500;
    const deltaY = options.direction === 'up' ? -amount : amount;

    try {
      // Try to find and scroll the element
      const scrolled = await session.page.evaluate(({ sel, dy }) => {
        const el = document.querySelector(sel);
        if (!el) return false;

        const before = el.scrollTop;
        el.scrollTop += dy;
        return el.scrollTop !== before;
      }, { sel: selector, dy: deltaY });

      await session.page.waitForTimeout(300);
      return scrolled;
    } catch (e) {
      console.warn(`[BrowserWorker] Failed to scroll element ${selector}:`, e);
      return false;
    }
  }

  /**
   * Click at specific coordinates
   */
  async click(sessionId: string, options: ClickOptions): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await session.page.mouse.click(options.x, options.y, {
      button: options.button || 'left',
      clickCount: options.clickCount || 1,
      delay: options.delay || 50
    });

    // Wait for any UI updates
    await session.page.waitForTimeout(500);
  }

  /**
   * Click on an element by selector
   */
  async clickSelector(sessionId: string, selector: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      await session.page.click(selector, { timeout: 5000 });
      await session.page.waitForTimeout(500);
      return true;
    } catch (e) {
      console.warn(`[BrowserWorker] Failed to click ${selector}:`, e);
      return false;
    }
  }

  /**
   * Type text
   */
  async type(sessionId: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await session.page.keyboard.type(text, { delay: 50 });
  }

  /**
   * Press a key
   */
  async pressKey(sessionId: string, key: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await session.page.keyboard.press(key);
    await session.page.waitForTimeout(200);
  }

  /**
   * Wait for network idle
   */
  async waitForNetworkIdle(sessionId: string, timeout: number = 5000): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      await session.page.waitForLoadState('networkidle', { timeout });
    } catch (e) {
      // Timeout is ok, just means there's ongoing network activity
    }
  }

  /**
   * Wait for a specific amount of time
   */
  async wait(sessionId: string, ms: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await session.page.waitForTimeout(ms);
  }

  /**
   * Get page content/HTML
   */
  async getPageContent(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return await session.page.content();
  }

  /**
   * Execute JavaScript in the page
   */
  async evaluate<T>(sessionId: string, fn: () => T): Promise<T> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return await session.page.evaluate(fn);
  }

  /**
   * Download a file (for project exports)
   */
  async downloadFile(
    sessionId: string,
    clickSelector: string
  ): Promise<Buffer | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Set up download handler
      const downloadPromise = session.page.waitForEvent('download', { timeout: 30000 });

      // Click the download button
      await session.page.click(clickSelector);

      // Wait for download
      const download = await downloadPromise;

      // Save to buffer
      const path = await download.path();
      if (path) {
        const fs = await import('fs');
        return fs.readFileSync(path);
      }

      return null;
    } catch (e) {
      console.error(`[BrowserWorker] Download failed:`, e);
      return null;
    }
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return session.page.url();
  }

  /**
   * Navigate to a new URL
   */
  async navigate(sessionId: string, url: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await session.page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`[BrowserWorker] Closing session ${sessionId}`);

    try {
      await session.page.close();
      await session.context.close();
      await session.browser.close();
    } catch (e) {
      console.warn(`[BrowserWorker] Error closing session:`, e);
    }

    this.sessions.delete(sessionId);
  }

  /**
   * Close all sessions
   */
  async closeAll(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    for (const id of sessionIds) {
      await this.closeSession(id);
    }
  }

  /**
   * Detect platform from URL
   */
  private detectPlatform(url: string): string {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('bolt.new') || urlLower.includes('stackblitz')) {
      return 'bolt';
    }
    if (urlLower.includes('lovable.dev') || urlLower.includes('lovable.ai')) {
      return 'lovable';
    }
    if (urlLower.includes('v0.dev')) {
      return 'v0';
    }
    if (urlLower.includes('replit.com')) {
      return 'replit';
    }
    if (urlLower.includes('cursor.')) {
      return 'cursor';
    }
    if (urlLower.includes('windsurf')) {
      return 'windsurf';
    }
    if (urlLower.includes('claude.ai')) {
      return 'claude';
    }
    if (urlLower.includes('chat.openai.com') || urlLower.includes('chatgpt')) {
      return 'chatgpt';
    }
    if (urlLower.includes('github.com/codespaces')) {
      return 'codespaces';
    }
    if (urlLower.includes('codesandbox.io')) {
      return 'codesandbox';
    }

    return 'unknown';
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }
}

// Singleton instance
let browserWorkerInstance: BrowserWorker | null = null;

export function getBrowserWorker(): BrowserWorker {
  if (!browserWorkerInstance) {
    browserWorkerInstance = new BrowserWorker();
  }
  return browserWorkerInstance;
}
