# KripTik AI Extension - Production Completion Plan

> **Status**: ~85% Complete
> **Location**: `/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/.claude/system-prompts/KripTik AI Extension/`
> **Goal**: Complete the extension for both Fix My App (context capture) and Credential Auto-Capture workflows

---

## Executive Summary

The KripTik AI browser extension is substantially built but needs critical additions:

1. **Vision-Based Credential Capture** - AI-powered extraction of credentials from varied platform UIs
2. **Robust Full Chat History Capture** - Aggressive scrolling to capture the ENTIRE conversation
3. **Missing Dependencies** - JSZip library, popup page
4. **KripTik Backend Integration** - API connection for seamless data transfer
5. **Production Polish** - Testing, Chrome Web Store submission

---

## Part 1: Credential Auto-Capture System

### The Problem
Users need credentials from external platforms (Google Console, Stripe, Supabase, etc.) but:
- Each platform has different UI layouts
- Credentials appear in different locations
- Some require navigation to find (e.g., Google Console client_id vs client_secret on different pages)
- Static CSS selectors break when platforms update their UIs

### The Solution: Vision-Based Credential Extraction

Add an AI vision model to the extension that can:
1. Take a screenshot of the current page
2. Send it to KripTik backend (which calls OpenRouter with a vision model)
3. Receive extracted credentials or navigation instructions
4. Auto-fill results back to KripTik UI

### New Files Needed

#### 1. `src/content/credentials/credential-capture.js`

```javascript
/**
 * Credential Capture System
 * Uses AI vision to extract credentials from any platform
 */

const CredentialCapture = {
  apiEndpoint: null,
  sessionToken: null,
  targetCredentials: [],
  capturedCredentials: {},

  /**
   * Initialize with session info from KripTik
   * Called when user clicks credential URL in KripTik UI
   */
  async initialize(config) {
    this.apiEndpoint = config.apiEndpoint;
    this.sessionToken = config.sessionToken;
    this.targetCredentials = config.requiredCredentials; // e.g., ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
    this.kriptikTabId = config.originTabId;

    // Show capture overlay
    this.showCaptureOverlay();

    // Start monitoring for login completion
    this.startLoginMonitor();
  },

  /**
   * Monitor for user login completion
   */
  async startLoginMonitor() {
    const checkInterval = setInterval(async () => {
      const isLoggedIn = await this.detectLoginState();

      if (isLoggedIn) {
        clearInterval(checkInterval);
        this.addLog('[LOGIN] User logged in, starting credential extraction...');
        await this.extractCredentialsWithVision();
      }
    }, 2000);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      if (Object.keys(this.capturedCredentials).length === 0) {
        this.addLog('[TIMEOUT] Login timeout - please try again');
        this.showError('Login timeout. Please try again.');
      }
    }, 300000);
  },

  /**
   * Detect if user has logged in (platform-agnostic)
   */
  async detectLoginState() {
    // Common login indicators
    const loginIndicators = [
      // Dashboard/Home indicators
      '[class*="dashboard"]',
      '[class*="home"]',
      '[class*="project"]',
      '[data-testid*="dashboard"]',
      // User menu indicators
      '[class*="avatar"]',
      '[class*="user-menu"]',
      '[class*="profile"]',
      // Logout button (means logged in)
      'button[class*="logout"]',
      'a[href*="logout"]',
      'button:has-text("Sign out")',
      'button:has-text("Log out")'
    ];

    for (const selector of loginIndicators) {
      try {
        const el = document.querySelector(selector);
        if (el && this.isVisible(el)) {
          return true;
        }
      } catch (e) {
        // Selector might be invalid, continue
      }
    }

    return false;
  },

  /**
   * Main extraction using AI vision
   */
  async extractCredentialsWithVision() {
    this.updateStatus('extracting', 'Analyzing page with AI vision...');

    let attempts = 0;
    const maxAttempts = 10;

    while (Object.keys(this.capturedCredentials).length < this.targetCredentials.length && attempts < maxAttempts) {
      attempts++;
      this.addLog(`[VISION] Extraction attempt ${attempts}/${maxAttempts}`);

      // Take screenshot of current page
      const screenshot = await this.captureScreenshot();

      // Send to KripTik backend for AI analysis
      const response = await this.sendToVisionAPI({
        screenshot: screenshot,
        targetCredentials: this.targetCredentials.filter(c => !this.capturedCredentials[c]),
        currentUrl: window.location.href,
        pageTitle: document.title,
        attempt: attempts
      });

      if (response.success) {
        // AI found credentials
        for (const [key, value] of Object.entries(response.credentials)) {
          this.capturedCredentials[key] = value;
          this.addLog(`[FOUND] Captured ${key}`);
          this.updateCredentialStatus(key, 'captured');
        }
      }

      if (response.action === 'navigate') {
        // AI says we need to navigate to find more credentials
        this.addLog(`[NAVIGATE] Going to: ${response.navigateTo}`);
        await this.navigateToCredential(response.navigateTo, response.instructions);
        await this.wait(2000); // Wait for page load
      }

      if (response.action === 'click') {
        // AI says click something to reveal credentials
        this.addLog(`[CLICK] ${response.clickInstructions}`);
        await this.executeClickAction(response.clickSelector, response.clickInstructions);
        await this.wait(1500);
      }

      if (response.action === 'scroll') {
        // AI says scroll to find credentials
        await this.scrollToReveal(response.scrollDirection);
        await this.wait(1000);
      }

      // Check if we have all credentials
      if (Object.keys(this.capturedCredentials).length >= this.targetCredentials.length) {
        break;
      }
    }

    // Send captured credentials back to KripTik
    await this.sendCredentialsToKripTik();
  },

  /**
   * Capture screenshot as base64
   */
  async captureScreenshot() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
        resolve(response.screenshot);
      });
    });
  },

  /**
   * Send screenshot to KripTik backend for AI analysis
   */
  async sendToVisionAPI(data) {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/extension/vision-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify(data)
      });

      return await response.json();
    } catch (error) {
      console.error('[CredentialCapture] Vision API error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Navigate to a specific page to find credentials
   */
  async navigateToCredential(url, instructions) {
    if (url.startsWith('http')) {
      window.location.href = url;
    } else {
      // Relative navigation or link text
      const link = document.querySelector(`a[href*="${url}"]`) ||
                   Array.from(document.querySelectorAll('a')).find(a =>
                     a.textContent.toLowerCase().includes(url.toLowerCase())
                   );
      if (link) {
        link.click();
      }
    }
  },

  /**
   * Execute a click action based on AI instructions
   */
  async executeClickAction(selector, instructions) {
    try {
      // Try direct selector first
      let element = document.querySelector(selector);

      if (!element && instructions) {
        // Try to find by text content
        const allClickable = document.querySelectorAll('button, a, [role="button"], [class*="btn"]');
        element = Array.from(allClickable).find(el =>
          el.textContent.toLowerCase().includes(instructions.toLowerCase())
        );
      }

      if (element) {
        element.click();
        return true;
      }
    } catch (e) {
      console.error('[CredentialCapture] Click action failed:', e);
    }
    return false;
  },

  /**
   * Send captured credentials back to KripTik
   */
  async sendCredentialsToKripTik() {
    this.updateStatus('complete', 'Credentials captured!');
    this.addLog('[COMPLETE] Sending credentials to KripTik AI...');

    try {
      // Send to KripTik backend
      await fetch(`${this.apiEndpoint}/api/extension/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify({
          credentials: this.capturedCredentials,
          platform: this.detectPlatform(),
          capturedAt: new Date().toISOString()
        })
      });

      // Notify KripTik tab to refresh credentials
      chrome.runtime.sendMessage({
        type: 'CREDENTIALS_CAPTURED',
        credentials: this.capturedCredentials,
        originTabId: this.kriptikTabId
      });

      // Show success and close after delay
      this.showSuccess('Credentials captured! Returning to KripTik AI...');

      setTimeout(() => {
        window.close();
      }, 2000);

    } catch (error) {
      this.showError(`Failed to send credentials: ${error.message}`);
    }
  },

  // ... UI helper methods (showCaptureOverlay, addLog, updateStatus, etc.)
};

window.CredentialCapture = CredentialCapture;
```

#### 2. Backend API Route: `server/src/routes/extension.ts` (additions)

```typescript
/**
 * POST /api/extension/vision-extract
 * Use AI vision to extract credentials from screenshot
 */
router.post('/vision-extract', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { screenshot, targetCredentials, currentUrl, pageTitle, attempt } = req.body;

    // Call OpenRouter with vision model
    const response = await openRouterClient.chat({
      model: 'anthropic/claude-sonnet-4-5-20250929', // Vision-capable model
      messages: [
        {
          role: 'system',
          content: `You are a credential extraction assistant. You analyze screenshots of developer consoles and dashboards to find API keys, client IDs, secrets, and other credentials.

Your job is to:
1. Identify if the requested credentials are visible on the page
2. Extract them if visible
3. Provide navigation instructions if they're not visible

IMPORTANT: Only extract real credentials you can see. Never make up or guess values.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshot
              }
            },
            {
              type: 'text',
              text: `Current URL: ${currentUrl}
Page Title: ${pageTitle}
Attempt: ${attempt}

I need to find these credentials: ${targetCredentials.join(', ')}

Please analyze this screenshot and:
1. If you can see any of the requested credentials, extract them exactly as shown
2. If credentials are not visible, tell me how to navigate to find them
3. If I need to click something to reveal them (like a "Show" button), tell me what to click

Respond in JSON format:
{
  "success": true/false,
  "credentials": { "CREDENTIAL_NAME": "value" },
  "action": "none" | "navigate" | "click" | "scroll",
  "navigateTo": "url or link text",
  "clickSelector": "CSS selector",
  "clickInstructions": "text to look for",
  "scrollDirection": "up" | "down",
  "message": "explanation"
}`
            }
          ]
        }
      ]
    });

    const result = JSON.parse(response.content);
    return res.json(result);

  } catch (error) {
    console.error('[Vision Extract] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Vision extraction failed',
      action: 'none'
    });
  }
});
```

#### 3. Platform-Specific Credential Configs: `src/content/credentials/platforms/`

Create configs for common credential platforms:

```javascript
// google-console.config.js
const GoogleConsoleConfig = {
  id: 'google-console',
  name: 'Google Cloud Console',
  urlPatterns: ['console.cloud.google.com', 'console.developers.google.com'],

  credentials: {
    GOOGLE_CLIENT_ID: {
      navigationPath: '/apis/credentials',
      hints: ['OAuth 2.0 Client IDs', 'Client ID'],
      format: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/
    },
    GOOGLE_CLIENT_SECRET: {
      navigationPath: '/apis/credentials',
      hints: ['Client secret', 'Download JSON'],
      format: /^GOCSPX-[A-Za-z0-9_-]+$/,
      requiresClick: 'Download JSON' // Sometimes need to click to reveal
    }
  },

  // Help the AI with platform-specific navigation
  navigationHints: {
    '/apis/credentials': 'Click on "APIs & Services" then "Credentials"',
    'show-secret': 'Click the "Show" button next to the client secret'
  }
};
```

---

## Part 2: Robust Full Chat History Capture

### The Problem
Current chat scraper may not capture the ENTIRE history because:
- Chat containers use virtual scrolling (only render visible messages)
- "Load more" buttons may need multiple clicks
- Some platforms have infinite scroll that requires scrolling to top repeatedly
- Need to handle all edge cases for complete capture

### Enhanced Chat Scraper

#### Replace/enhance `src/content/scrapers/chat-scraper.js`

```javascript
/**
 * Enhanced Chat Scraper
 * Captures the COMPLETE chat history with aggressive scrolling
 */

const ChatScraper = {
  capturedMessages: [],
  isCapturing: false,
  seenMessageHashes: new Set(),

  /**
   * Capture FULL chat history - aggressive approach
   */
  async captureFullHistory(platform, onProgress) {
    this.isCapturing = true;
    this.capturedMessages = [];
    this.seenMessageHashes = new Set();

    onProgress({ phase: 'initializing', message: 'Initializing capture...', progress: 0 });

    // Find chat container
    const chatContainer = this.findChatContainer(platform);
    if (!chatContainer) {
      throw new Error('Could not find chat container');
    }

    // Find scrollable element (might be container or parent)
    const scrollable = this.findScrollableElement(chatContainer);

    onProgress({ phase: 'scrolling', message: 'Scrolling to load all messages...', progress: 5 });

    // PHASE 1: Aggressive scroll to top to load ALL history
    await this.scrollToAbsoluteTop(scrollable, platform, onProgress);

    onProgress({ phase: 'extracting', message: 'Extracting messages...', progress: 50 });

    // PHASE 2: Now scroll down capturing everything
    await this.scrollAndCaptureAll(scrollable, platform, onProgress);

    // PHASE 3: Final deduplication and ordering
    const finalMessages = this.processMessages();

    onProgress({
      phase: 'complete',
      message: `Captured ${finalMessages.length} messages`,
      progress: 100,
      count: finalMessages.length
    });

    this.isCapturing = false;
    return finalMessages;
  },

  /**
   * Scroll to absolute top of chat, handling:
   * - Virtual scrolling
   * - "Load more" buttons
   * - Infinite scroll
   * - Lazy loading
   */
  async scrollToAbsoluteTop(scrollable, platform, onProgress) {
    let previousScrollTop = -1;
    let stableCount = 0;
    let iteration = 0;
    const maxIterations = 200; // Allow many iterations for long histories

    while (iteration < maxIterations && this.isCapturing) {
      iteration++;

      // Try clicking "Load more" / "Load earlier messages" button
      const loadMoreClicked = await this.tryClickLoadMore(platform);

      // Scroll to top
      scrollable.scrollTo({ top: 0, behavior: 'instant' });

      // Also try scrolling by setting scrollTop directly (more reliable)
      scrollable.scrollTop = 0;

      // Wait for content to load
      await this.wait(loadMoreClicked ? 1500 : 500);

      // Trigger scroll events for virtual scroll detection
      scrollable.dispatchEvent(new Event('scroll', { bubbles: true }));

      // Check if we've hit the true top
      const currentScrollTop = scrollable.scrollTop;
      const scrollHeight = scrollable.scrollHeight;

      if (iteration % 10 === 0) {
        onProgress({
          phase: 'scrolling',
          message: `Loading history... (${iteration} cycles)`,
          progress: Math.min(45, 5 + (iteration / maxIterations) * 40)
        });
      }

      // Check for stability (we've reached the top)
      if (currentScrollTop === 0 && currentScrollTop === previousScrollTop) {
        stableCount++;
        if (stableCount >= 5 && !loadMoreClicked) {
          // We're at the top and no more content is loading
          break;
        }
      } else {
        stableCount = 0;
      }

      previousScrollTop = currentScrollTop;

      // Check if scrollHeight is changing (still loading)
      const newScrollHeight = scrollable.scrollHeight;
      if (newScrollHeight !== scrollHeight) {
        stableCount = 0; // Reset if content is still loading
      }
    }

    console.log(`[ChatScraper] Scroll to top complete after ${iteration} iterations`);
  },

  /**
   * Try to click load more buttons (various patterns)
   */
  async tryClickLoadMore(platform) {
    const loadMoreSelectors = [
      // Common patterns
      'button[class*="load-more"]',
      'button[class*="loadmore"]',
      'button[class*="load-earlier"]',
      '[class*="load-more"]',
      '[data-testid*="load-more"]',
      '[data-testid*="load-earlier"]',
      // Text-based
      'button:contains("Load more")',
      'button:contains("Load earlier")',
      'button:contains("Show more")',
      'button:contains("View more")',
      // Platform-specific (from registry)
      platform.selectors?.loadMoreButton
    ].filter(Boolean);

    for (const selector of loadMoreSelectors) {
      try {
        // Handle :contains pseudo-selector
        let element;
        if (selector.includes(':contains(')) {
          const text = selector.match(/:contains\("(.+?)"\)/)?.[1];
          if (text) {
            element = Array.from(document.querySelectorAll('button, a, [role="button"]'))
              .find(el => el.textContent?.toLowerCase().includes(text.toLowerCase()));
          }
        } else {
          element = document.querySelector(selector);
        }

        if (element && this.isVisible(element) && !element.disabled) {
          element.click();
          console.log(`[ChatScraper] Clicked load more: ${selector}`);
          return true;
        }
      } catch (e) {
        // Selector might be invalid
      }
    }

    return false;
  },

  /**
   * Scroll through entire chat capturing all messages
   */
  async scrollAndCaptureAll(scrollable, platform, onProgress) {
    let previousMessageCount = 0;
    let stableCount = 0;
    const maxStable = 5;

    // Start from top
    scrollable.scrollTop = 0;
    await this.wait(500);

    // Capture initial messages
    this.captureVisibleMessages(platform);

    // Scroll down incrementally, capturing as we go
    const scrollStep = scrollable.clientHeight * 0.8; // 80% of viewport
    let totalScrolled = 0;

    while (this.isCapturing) {
      // Scroll down
      scrollable.scrollBy({ top: scrollStep, behavior: 'instant' });
      totalScrolled += scrollStep;

      await this.wait(300);

      // Capture visible messages
      const newCount = this.captureVisibleMessages(platform);

      onProgress({
        phase: 'extracting',
        message: `Extracting messages... ${this.capturedMessages.length} found`,
        progress: 50 + Math.min(45, (totalScrolled / scrollable.scrollHeight) * 45),
        count: this.capturedMessages.length
      });

      // Check if we've reached the bottom
      const atBottom = (scrollable.scrollTop + scrollable.clientHeight) >= (scrollable.scrollHeight - 10);

      if (atBottom) {
        // One more capture to make sure we got everything
        await this.wait(500);
        this.captureVisibleMessages(platform);
        break;
      }

      // Check for stability
      if (this.capturedMessages.length === previousMessageCount) {
        stableCount++;
        if (stableCount >= maxStable && atBottom) {
          break;
        }
      } else {
        stableCount = 0;
      }

      previousMessageCount = this.capturedMessages.length;
    }

    console.log(`[ChatScraper] Captured ${this.capturedMessages.length} messages`);
  },

  /**
   * Capture currently visible messages (deduplicates automatically)
   */
  captureVisibleMessages(platform) {
    const messageElements = this.findMessageElements(platform);
    let newMessages = 0;

    messageElements.forEach((el, index) => {
      const hash = this.hashElement(el);

      if (!this.seenMessageHashes.has(hash)) {
        this.seenMessageHashes.add(hash);

        const message = this.extractMessage(el, platform, this.capturedMessages.length);
        if (message && message.content.trim()) {
          this.capturedMessages.push(message);
          newMessages++;
        }
      }
    });

    return newMessages;
  },

  /**
   * Find message elements using multiple strategies
   */
  findMessageElements(platform) {
    const selectors = [
      platform.selectors?.chatMessage,
      '[data-testid*="message"]',
      '[class*="message-content"]',
      '[class*="chat-message"]',
      '[role="listitem"][class*="message"]',
      '.message',
      '[data-message-id]'
    ].filter(Boolean);

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return Array.from(elements);
        }
      } catch (e) {
        // Invalid selector
      }
    }

    return [];
  },

  /**
   * Extract message data from element
   */
  extractMessage(el, platform, index) {
    return {
      id: `msg_${this.hashElement(el)}_${index}`,
      role: this.extractRole(el, platform),
      content: this.extractContent(el),
      timestamp: this.extractTimestamp(el),
      codeBlocks: this.extractCodeBlocks(el),
      order: index
    };
  },

  /**
   * Create stable hash of element content
   */
  hashElement(el) {
    const content = el.textContent?.slice(0, 200) || '';
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  },

  /**
   * Process and deduplicate final messages
   */
  processMessages() {
    // Sort by order
    const sorted = [...this.capturedMessages].sort((a, b) => a.order - b.order);

    // Final deduplication by content similarity
    const unique = [];
    const contentHashes = new Set();

    for (const msg of sorted) {
      const contentHash = this.hashElement({ textContent: msg.content });
      if (!contentHashes.has(contentHash)) {
        contentHashes.add(contentHash);
        unique.push(msg);
      }
    }

    // Re-number
    return unique.map((msg, i) => ({ ...msg, order: i }));
  },

  // Helper methods
  findChatContainer(platform) {
    const selectors = [
      platform.selectors?.chatContainer,
      '[data-testid*="chat"]',
      '[class*="chat-container"]',
      '[class*="conversation"]',
      '[class*="messages-container"]',
      '[role="log"]'
    ].filter(Boolean);

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  },

  findScrollableElement(container) {
    // Check if container itself is scrollable
    if (container.scrollHeight > container.clientHeight) {
      return container;
    }

    // Check children
    const children = container.querySelectorAll('*');
    for (const child of children) {
      if (child.scrollHeight > child.clientHeight) {
        const style = getComputedStyle(child);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return child;
        }
      }
    }

    // Check parents
    let parent = container.parentElement;
    while (parent) {
      if (parent.scrollHeight > parent.clientHeight) {
        const style = getComputedStyle(parent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return parent;
        }
      }
      parent = parent.parentElement;
    }

    return container;
  },

  extractRole(el, platform) {
    const className = el.className?.toLowerCase() || '';
    const dataRole = el.getAttribute('data-role') || el.getAttribute('data-testid') || '';

    if (className.includes('user') || className.includes('human') ||
        dataRole.includes('user') || dataRole.includes('human')) {
      return 'user';
    }
    if (className.includes('assistant') || className.includes('ai') ||
        className.includes('bot') || dataRole.includes('assistant')) {
      return 'assistant';
    }

    return 'assistant'; // Default to assistant
  },

  extractContent(el) {
    // Clone to avoid modifying original
    const clone = el.cloneNode(true);

    // Remove hidden elements
    clone.querySelectorAll('[hidden], [style*="display: none"]').forEach(e => e.remove());

    // Get text content
    return clone.textContent?.trim() || '';
  },

  extractTimestamp(el) {
    const timeEl = el.querySelector('time, [data-timestamp], [class*="timestamp"], [class*="time"]');
    return timeEl?.getAttribute('datetime') || timeEl?.textContent || null;
  },

  extractCodeBlocks(el) {
    const blocks = [];
    el.querySelectorAll('pre code, pre, [class*="code-block"]').forEach((code, i) => {
      const language = code.getAttribute('data-language') ||
                       code.className?.match(/language-(\w+)/)?.[1] ||
                       'text';
      blocks.push({
        id: `code_${i}`,
        language,
        content: code.textContent
      });
    });
    return blocks;
  },

  isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  stop() {
    this.isCapturing = false;
  }
};

window.ChatScraper = ChatScraper;
```

---

## Part 3: Missing Dependencies & Files

### 1. Add JSZip Library

Download from: https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js

Save to: `lib/jszip.min.js`

### 2. Create Popup Page

#### `src/popup/popup.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KripTik AI</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <div class="header">
      <img src="../assets/logo.png" alt="KripTik AI" class="logo">
      <h1>KripTik AI</h1>
    </div>

    <div class="status-section">
      <div class="status-indicator" id="status-dot"></div>
      <span id="status-text">Detecting platform...</span>
    </div>

    <div class="connection-section">
      <label for="api-token">API Token</label>
      <input type="password" id="api-token" placeholder="Enter your KripTik AI token">
      <button id="save-token" class="btn-primary">Save</button>
    </div>

    <div class="actions-section">
      <button id="open-kriptik" class="btn-secondary">Open KripTik AI</button>
    </div>

    <div class="footer">
      <span>v1.0.0</span>
      <a href="https://kriptik.ai/help" target="_blank">Help</a>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

#### `src/popup/popup.js`

```javascript
// Popup script
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved token
  const { apiToken } = await chrome.storage.sync.get(['apiToken']);
  if (apiToken) {
    document.getElementById('api-token').value = '••••••••••••';
  }

  // Check current tab platform
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const platform = detectPlatformFromUrl(tab.url);

  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  if (platform) {
    statusDot.classList.add('connected');
    statusText.textContent = `Connected to ${platform}`;
  } else {
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Not on a supported platform';
  }

  // Save token
  document.getElementById('save-token').addEventListener('click', async () => {
    const token = document.getElementById('api-token').value;
    if (token && !token.includes('•')) {
      await chrome.storage.sync.set({ apiToken: token });
      alert('Token saved!');
    }
  });

  // Open KripTik
  document.getElementById('open-kriptik').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://kriptik.ai' });
  });
});

function detectPlatformFromUrl(url) {
  const platforms = {
    'lovable.dev': 'Lovable',
    'bolt.new': 'Bolt',
    'v0.dev': 'v0',
    'cursor.sh': 'Cursor',
    'replit.com': 'Replit',
    'console.cloud.google.com': 'Google Cloud',
    'dashboard.stripe.com': 'Stripe',
    'supabase.com': 'Supabase'
  };

  for (const [domain, name] of Object.entries(platforms)) {
    if (url.includes(domain)) return name;
  }
  return null;
}
```

#### `src/popup/popup.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.popup-container {
  padding: 20px;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.logo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 16px;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #666;
}

.status-indicator.connected {
  background: #4ade80;
  box-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
}

.status-indicator.disconnected {
  background: #f87171;
}

.connection-section {
  margin-bottom: 16px;
}

label {
  display: block;
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 14px;
  margin-bottom: 10px;
}

input:focus {
  outline: none;
  border-color: #ff9966;
}

.btn-primary {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 6px;
  background: linear-gradient(135deg, #ff9966 0%, #ff5e62 100%);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-primary:hover {
  transform: translateY(-1px);
}

.btn-secondary {
  width: 100%;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: #666;
}

.footer a {
  color: #ff9966;
  text-decoration: none;
}
```

---

## Part 4: Backend Integration

### Add Screenshot Capture to Service Worker

Update `src/background/service-worker.js`:

```javascript
// Add to message listener
if (message.type === 'CAPTURE_SCREENSHOT') {
  chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
    // Remove data URL prefix to get just base64
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    sendResponse({ screenshot: base64 });
  });
  return true; // Async response
}
```

### Update manifest.json Permissions

```json
{
  "permissions": [
    "activeTab",
    "storage",
    "downloads",
    "tabs"  // Add for screenshot capture
  ]
}
```

---

## Part 5: KripTik UI Integration

### 1. Credential Input with Auto-Capture Button

Update `src/components/feature-agent/CredentialsCollectionView.tsx`:

```tsx
// Add auto-capture button next to each credential input
<button
  onClick={() => launchCredentialCapture(c.platformUrl, c.envVariableName)}
  className="btn-auto-capture"
  title="Auto-capture with extension"
>
  <MagicWandIcon />
  Auto-Capture
</button>
```

### 2. Extension Install Prompt

Create `src/components/extension/ExtensionInstallPrompt.tsx`:

```tsx
export function ExtensionInstallPrompt() {
  const [extensionInstalled, setExtensionInstalled] = useState(false);

  useEffect(() => {
    // Check if extension is installed by trying to communicate
    window.postMessage({ type: 'KRIPTIK_EXTENSION_CHECK' }, '*');

    window.addEventListener('message', (event) => {
      if (event.data.type === 'KRIPTIK_EXTENSION_PRESENT') {
        setExtensionInstalled(true);
      }
    });
  }, []);

  if (extensionInstalled) {
    return <div className="extension-status connected">Extension Active</div>;
  }

  return (
    <div className="extension-install-prompt">
      <p>Install the KripTik AI Extension for automatic credential capture and project import.</p>
      <a
        href="https://chrome.google.com/webstore/detail/kriptik-ai/EXTENSION_ID"
        target="_blank"
        className="btn-install"
      >
        Install Extension
      </a>
    </div>
  );
}
```

---

## Part 6: Testing & Chrome Web Store

### Testing Checklist

| Platform | Chat Capture | Error Capture | ZIP Export | Credential Capture |
|----------|--------------|---------------|------------|-------------------|
| Bolt.new | [ ] | [ ] | [ ] | N/A |
| Lovable.dev | [ ] | [ ] | [ ] | N/A |
| v0.dev | [ ] | [ ] | [ ] | N/A |
| Cursor | [ ] | [ ] | [ ] | N/A |
| Google Console | N/A | N/A | N/A | [ ] |
| Stripe Dashboard | N/A | N/A | N/A | [ ] |
| Supabase | N/A | N/A | N/A | [ ] |

### Chrome Web Store Requirements

1. **Developer Account**: $5 one-time fee
2. **Privacy Policy**: Required (host at kriptik.ai/extension-privacy)
3. **Store Listing**:
   - Title: "KripTik AI - Project Import Assistant"
   - Description: (up to 132 chars for short, 16k for detailed)
   - Screenshots: 1280x800 or 640x400 (at least 1)
   - Promotional images: 440x280 (small), 920x680 (large)
   - Category: Developer Tools
4. **Justification for Permissions**:
   - `activeTab`: To capture chat and context from current tab
   - `storage`: To store API token and captured data
   - `downloads`: To intercept and modify ZIP downloads
   - `tabs`: To capture screenshots for credential extraction
   - Host permissions: Specific AI builder domains for context capture

---

## Implementation Order

### Phase 1: Critical Fixes (Day 1)
1. [ ] Add JSZip library to `lib/jszip.min.js`
2. [ ] Create popup page (HTML, JS, CSS)
3. [ ] Test extension loads in Chrome

### Phase 2: Robust Chat Capture (Day 1-2)
4. [ ] Replace chat-scraper.js with enhanced version
5. [ ] Test on Bolt.new (scroll to top, capture all)
6. [ ] Test on Lovable.dev
7. [ ] Test on v0.dev

### Phase 3: Credential Capture (Day 2-3)
8. [ ] Add credential-capture.js content script
9. [ ] Add vision-extract API route to backend
10. [ ] Add screenshot capture to service worker
11. [ ] Test on Google Console
12. [ ] Test on Stripe Dashboard

### Phase 4: KripTik Integration (Day 3)
13. [ ] Add extension install prompt to UI
14. [ ] Add auto-capture buttons to credential inputs
15. [ ] Handle extension → KripTik communication

### Phase 5: Production (Day 4)
16. [ ] Create privacy policy
17. [ ] Prepare store listing assets
18. [ ] Submit to Chrome Web Store
19. [ ] Add install button/link to KripTik UI

---

## Files to Create/Modify

### New Files
- `lib/jszip.min.js` (download)
- `src/popup/popup.html`
- `src/popup/popup.js`
- `src/popup/popup.css`
- `src/content/credentials/credential-capture.js`
- `src/content/credentials/platforms/google-console.config.js`
- `src/content/credentials/platforms/stripe.config.js`
- `src/content/credentials/platforms/supabase.config.js`
- `server/src/routes/extension.ts` (add vision-extract route)

### Modified Files
- `manifest.json` (add popup, tabs permission)
- `src/background/service-worker.js` (add screenshot capture)
- `src/content/scrapers/chat-scraper.js` (enhance for full history)
- `src/components/feature-agent/CredentialsCollectionView.tsx` (add auto-capture)

---

## Summary

The extension is ~85% complete. To finish:

1. **Add missing JSZip library** (5 min)
2. **Create popup page** (30 min)
3. **Enhance chat scraper** for complete history (2 hours)
4. **Add vision-based credential capture** (4 hours)
5. **Backend vision API route** (1 hour)
6. **KripTik UI integration** (2 hours)
7. **Testing on live platforms** (4 hours)
8. **Chrome Web Store submission** (2 hours)

**Total estimated: ~16 hours of work**
