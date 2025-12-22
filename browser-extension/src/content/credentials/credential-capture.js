/**
 * Credential Capture System - Gemini 3 Vision @ 2fps
 * Uses AI vision to extract credentials from any platform
 * Handles varied UIs without brittle CSS selectors
 *
 * December 2025 Update:
 * - 2fps frame streaming (500ms intervals)
 * - Frame buffering for smooth transmission
 * - Gemini 3 Pro/Flash backend integration
 */

const CredentialCapture = {
  // Configuration
  apiEndpoint: null,
  sessionToken: null,
  targetCredentials: [],
  capturedCredentials: {},
  kriptikTabId: null,
  isCapturing: false,
  overlay: null,

  // Capture state
  attempts: 0,
  maxAttempts: 15,
  loginCheckInterval: null,

  // 2fps streaming configuration
  frameConfig: {
    fps: 2,
    intervalMs: 500, // 2fps = 500ms per frame
    bufferSize: 4,   // Queue up to 4 frames
    quality: 80,     // JPEG quality
  },

  // Frame buffer for smooth 2fps streaming
  frameBuffer: {
    frames: [],
    lastSentAt: 0,
    isSending: false,
  },

  // Error recovery configuration
  errorRecovery: {
    maxRetries: 3,              // Maximum retry attempts per API call
    retryDelayMs: 1000,         // Base delay between retries
    backoffMultiplier: 2,       // Exponential backoff multiplier
    consecutiveFailures: 0,     // Track consecutive failures
    maxConsecutiveFailures: 5,  // Fallback to manual after this many
  },

  // Security: sensitive data handling
  security: {
    credentialsCaptured: false,
    memoryCleared: false,
  },

  /**
   * Initialize credential capture from URL parameters or message
   * Called when extension detects it was opened for credential capture
   */
  async initialize(config) {
    console.log('[CredentialCapture] Initializing with config:', config);

    this.apiEndpoint = config.apiEndpoint;
    this.sessionToken = config.sessionToken;
    this.targetCredentials = config.requiredCredentials || [];
    this.kriptikTabId = config.originTabId;
    this.capturedCredentials = {};
    this.isCapturing = true;
    this.attempts = 0;

    // Show capture overlay
    this.showCaptureOverlay();

    // Start monitoring for login completion
    this.startLoginMonitor();
  },

  /**
   * Check URL parameters for capture mode initialization
   */
  checkUrlForCaptureMode() {
    const url = new URL(window.location.href);
    const captureData = url.searchParams.get('kriptik_capture');

    if (captureData) {
      try {
        const config = JSON.parse(atob(captureData));
        this.initialize(config);
        return true;
      } catch (e) {
        console.error('[CredentialCapture] Failed to parse capture config:', e);
      }
    }

    return false;
  },

  /**
   * Start monitoring for user login completion
   */
  startLoginMonitor() {
    this.addLog('Waiting for login...');
    this.updateStatus('waiting', 'Please log in to your account');

    let checkCount = 0;
    const maxChecks = 150; // 5 minutes at 2 second intervals

    this.loginCheckInterval = setInterval(async () => {
      checkCount++;

      if (checkCount > maxChecks) {
        clearInterval(this.loginCheckInterval);
        this.addLog('Login timeout');
        this.updateStatus('error', 'Login timeout - please try again');
        this.showError('Login timeout. Please close this window and try again.');
        return;
      }

      const isLoggedIn = await this.detectLoginState();

      if (isLoggedIn) {
        clearInterval(this.loginCheckInterval);
        this.addLog('Login detected!');
        this.updateStatus('extracting', 'Extracting credentials...');
        await this.extractCredentialsWithVision();
      }
    }, 2000);
  },

  /**
   * Detect if user has logged in (platform-agnostic approach)
   */
  async detectLoginState() {
    // Common indicators that user is logged in
    const loginIndicators = [
      // Dashboard/Home indicators
      '[class*="dashboard"]',
      '[class*="project"]',
      '[class*="console"]',
      '[data-testid*="dashboard"]',
      '[data-testid*="home"]',
      // User menu indicators
      '[class*="avatar"]',
      '[class*="user-menu"]',
      '[class*="profile"]',
      '[class*="account"]',
      // Navigation that only appears when logged in
      '[class*="sidebar"]',
      '[class*="nav-menu"]',
      // Logout button (means logged in)
      'button[class*="logout"]',
      'a[href*="logout"]',
      'button[class*="sign-out"]',
      'a[href*="signout"]',
      // API key specific indicators
      '[class*="api-key"]',
      '[class*="credentials"]',
      '[class*="secret"]',
      '[class*="token"]'
    ];

    for (const selector of loginIndicators) {
      try {
        const el = document.querySelector(selector);
        if (el && this.isVisible(el)) {
          return true;
        }
      } catch (e) {
        // Selector might be invalid
      }
    }

    // Check URL for logged-in patterns
    const url = window.location.href.toLowerCase();
    const loggedInUrlPatterns = [
      '/dashboard',
      '/console',
      '/project',
      '/settings',
      '/credentials',
      '/api-keys',
      '/account'
    ];

    for (const pattern of loggedInUrlPatterns) {
      if (url.includes(pattern)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Add frame to buffer with 2fps rate limiting
   */
  async bufferFrame(screenshot) {
    const now = Date.now();

    // Add to buffer
    this.frameBuffer.frames.push({
      data: screenshot,
      timestamp: now,
      sent: false,
    });

    // Trim buffer to max size
    while (this.frameBuffer.frames.length > this.frameConfig.bufferSize) {
      this.frameBuffer.frames.shift();
    }

    // Check if enough time has passed since last send (2fps = 500ms)
    if (now - this.frameBuffer.lastSentAt < this.frameConfig.intervalMs) {
      return null; // Buffered, will send on next interval
    }

    // Send oldest unsent frame
    const frameToSend = this.frameBuffer.frames.find(f => !f.sent);
    if (!frameToSend) {
      return null;
    }

    frameToSend.sent = true;
    this.frameBuffer.lastSentAt = now;

    // Clean up sent frames
    this.frameBuffer.frames = this.frameBuffer.frames.filter(f => !f.sent);

    return frameToSend.data;
  },

  /**
   * Reset frame buffer for new session
   */
  resetFrameBuffer() {
    this.frameBuffer.frames = [];
    this.frameBuffer.lastSentAt = 0;
    this.frameBuffer.isSending = false;
  },

  /**
   * Main extraction using AI vision @ 2fps
   */
  async extractCredentialsWithVision() {
    this.updateStatus('extracting', 'Analyzing page with Gemini 3 @ 2fps...');

    // Reset frame buffer for this session
    this.resetFrameBuffer();

    while (
      Object.keys(this.capturedCredentials).length < this.targetCredentials.length &&
      this.attempts < this.maxAttempts &&
      this.isCapturing
    ) {
      this.attempts++;
      this.addLog(`Extraction attempt ${this.attempts}/${this.maxAttempts} @ 2fps`);

      try {
        // Take screenshot of current page
        const screenshot = await this.captureScreenshot();

        if (!screenshot) {
          this.addLog('Failed to capture screenshot');
          await this.wait(this.frameConfig.intervalMs);
          continue;
        }

        // Buffer frame for 2fps rate limiting
        const frameToSend = await this.bufferFrame(screenshot);
        if (!frameToSend) {
          // Frame buffered, wait for next interval
          await this.wait(this.frameConfig.intervalMs / 2);
          continue;
        }

        // Send to KripTik backend for Gemini 3 analysis
        const response = await this.sendToVisionAPI({
          screenshot: frameToSend,
          targetCredentials: this.targetCredentials.filter(c => !this.capturedCredentials[c]),
          currentUrl: window.location.href,
          pageTitle: document.title,
          pageText: this.getVisibleText(),
          attempt: this.attempts,
          fps: this.frameConfig.fps,
          frameInterval: this.frameConfig.intervalMs,
        });

        if (!response) {
          this.addLog('No response from vision API');
          await this.wait(this.frameConfig.intervalMs * 2);
          continue;
        }

        // Handle response
        if (response.success && response.credentials) {
          for (const [key, value] of Object.entries(response.credentials)) {
            if (value && value.trim()) {
              this.capturedCredentials[key] = value;
              // SECURITY: Don't log actual credential values
              this.addLog(`Captured: ${key}`);
              this.updateCredentialStatus(key, 'captured');
            }
          }
        }

        // Handle manual input fallback (after too many failures)
        if (response.action === 'manual_input') {
          this.addLog('Switching to manual input mode');
          this.updateStatus('manual', 'Please enter credentials manually');
          this.showManualInputFallback();
          return; // Exit extraction loop
        }

        // Handle navigation or click instructions
        if (response.action === 'navigate' && response.navigateTo) {
          this.addLog(`Navigating to: ${response.navigateTo}`);
          await this.navigateToUrl(response.navigateTo);
          await this.wait(this.frameConfig.intervalMs * 6); // 3 seconds at 2fps
          continue;
        }

        if (response.action === 'click' && (response.clickSelector || response.clickText)) {
          this.addLog(`Clicking: ${response.clickText || response.clickSelector}`);
          await this.executeClickAction(response.clickSelector, response.clickText);
          await this.wait(this.frameConfig.intervalMs * 4); // 2 seconds at 2fps
          continue;
        }

        if (response.action === 'scroll') {
          await this.scrollPage(response.scrollDirection || 'down');
          await this.wait(this.frameConfig.intervalMs * 2); // 1 second at 2fps
          continue;
        }

        // Check if we got all credentials
        const remaining = this.targetCredentials.filter(c => !this.capturedCredentials[c]);
        if (remaining.length === 0) {
          break;
        }

        // Wait for next frame interval (2fps = 500ms)
        await this.wait(this.frameConfig.intervalMs);

      } catch (error) {
        console.error('[CredentialCapture] Extraction error:', error);
        this.addLog(`Error: ${error.message}`);
        await this.wait(this.frameConfig.intervalMs * 2);
      }
    }

    // Send results back to KripTik
    await this.sendCredentialsToKripTik();
  },

  /**
   * Capture screenshot using Chrome extension API
   */
  async captureScreenshot() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[CredentialCapture] Screenshot error:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(response?.screenshot || null);
      });
    });
  },

  /**
   * Get visible text from page for context
   */
  getVisibleText() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const style = getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }

          const text = node.textContent?.trim();
          if (!text || text.length < 3) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const texts = [];
    let node;
    while ((node = walker.nextNode()) && texts.length < 200) {
      const text = node.textContent?.trim();
      if (text && text.length > 2) {
        texts.push(text);
      }
    }

    return texts.join(' ').slice(0, 5000);
  },

  /**
   * Send screenshot to KripTik backend for AI analysis with error recovery
   * Implements 3 retries with exponential backoff, then fallback to manual input
   */
  async sendToVisionAPI(data) {
    let lastError = null;

    for (let retry = 0; retry <= this.errorRecovery.maxRetries; retry++) {
      try {
        // Calculate backoff delay for retries
        if (retry > 0) {
          const delay = this.errorRecovery.retryDelayMs *
            Math.pow(this.errorRecovery.backoffMultiplier, retry - 1);
          this.addLog(`Retry ${retry}/${this.errorRecovery.maxRetries} after ${delay}ms...`);
          await this.wait(delay);
        }

        const response = await fetch(`${this.apiEndpoint}/api/extension/vision-extract`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.sessionToken}`
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          lastError = new Error(`API error: ${response.status}`);
          console.error('[CredentialCapture] Vision API error:', response.status);
          continue; // Retry
        }

        const result = await response.json();

        // Reset consecutive failures on success
        this.errorRecovery.consecutiveFailures = 0;

        return result;

      } catch (error) {
        lastError = error;
        console.error('[CredentialCapture] Vision API request failed:', error);
        // Continue to retry
      }
    }

    // All retries exhausted
    this.errorRecovery.consecutiveFailures++;
    console.error('[CredentialCapture] All retries exhausted:', lastError);

    // Check if we should fallback to manual input
    if (this.errorRecovery.consecutiveFailures >= this.errorRecovery.maxConsecutiveFailures) {
      this.addLog('Too many failures - switching to manual input mode');
      return {
        success: false,
        action: 'manual_input',
        message: 'Automatic extraction failed. Please enter credentials manually.',
      };
    }

    return null;
  },

  /**
   * Navigate to a URL
   */
  async navigateToUrl(url) {
    if (url.startsWith('http')) {
      window.location.href = url;
    } else if (url.startsWith('/')) {
      window.location.pathname = url;
    } else {
      // Try to find and click a link
      const link = document.querySelector(`a[href*="${url}"]`) ||
                   Array.from(document.querySelectorAll('a')).find(a =>
                     a.textContent?.toLowerCase().includes(url.toLowerCase())
                   );
      if (link) {
        link.click();
      }
    }
  },

  /**
   * Execute a click action
   */
  async executeClickAction(selector, text) {
    let element = null;

    // Try direct selector first
    if (selector) {
      try {
        element = document.querySelector(selector);
      } catch (e) {
        // Invalid selector
      }
    }

    // Try text-based search
    if (!element && text) {
      const clickables = document.querySelectorAll('button, a, [role="button"], [class*="btn"]');
      element = Array.from(clickables).find(el => {
        const elText = el.textContent?.toLowerCase() || '';
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
        return elText.includes(text.toLowerCase()) || ariaLabel.includes(text.toLowerCase());
      });
    }

    if (element && this.isVisible(element)) {
      element.click();
      return true;
    }

    return false;
  },

  /**
   * Scroll page
   */
  async scrollPage(direction) {
    const amount = direction === 'up' ? -500 : 500;
    window.scrollBy({ top: amount, behavior: 'smooth' });
  },

  /**
   * Send captured credentials back to KripTik
   * Security: Clears credentials from memory after successful send
   */
  async sendCredentialsToKripTik() {
    const capturedCount = Object.keys(this.capturedCredentials).length;
    const targetCount = this.targetCredentials.length;

    if (capturedCount === 0) {
      this.updateStatus('error', 'No credentials found');
      this.showError('Could not find the requested credentials. Please try again or enter them manually.');
      return;
    }

    this.updateStatus('complete', `Captured ${capturedCount}/${targetCount} credentials`);
    this.addLog('Sending credentials to KripTik AI vault...');

    try {
      // Send to KripTik backend (credentials are encrypted in transit via HTTPS)
      const response = await fetch(`${this.apiEndpoint}/api/extension/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify({
          credentials: this.capturedCredentials,
          platform: this.detectPlatform(),
          capturedAt: new Date().toISOString(),
          targetCredentials: this.targetCredentials,
          successRate: capturedCount / targetCount
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Mark as successfully captured before clearing
      this.security.credentialsCaptured = true;

      // Notify the KripTik tab (send only credential keys, not values for security)
      chrome.runtime.sendMessage({
        type: 'CREDENTIALS_CAPTURED',
        capturedKeys: Object.keys(this.capturedCredentials),
        originTabId: this.kriptikTabId
      });

      // SECURITY: Clear credentials from memory immediately after successful send
      this.clearCredentialsFromMemory();

      // Show success
      if (capturedCount === targetCount) {
        this.showSuccess('All credentials captured securely! Returning to KripTik AI...');
      } else {
        this.showSuccess(`Captured ${capturedCount} of ${targetCount} credentials securely. Returning to KripTik AI...`);
      }

      // Close window after delay
      setTimeout(() => {
        window.close();
      }, 2500);

    } catch (error) {
      // SECURITY: Clear credentials even on error (don't leave in memory)
      this.clearCredentialsFromMemory();

      console.error('[CredentialCapture] Send credentials error:', error);
      this.showError(`Failed to send credentials: ${error.message}`);
    }
  },

  /**
   * SECURITY: Clear all credentials from memory
   * Called after sending to vault or on error
   */
  clearCredentialsFromMemory() {
    // Overwrite credential values with empty strings before clearing
    for (const key of Object.keys(this.capturedCredentials)) {
      this.capturedCredentials[key] = '';
    }
    this.capturedCredentials = {};

    // Clear session token
    this.sessionToken = '';
    this.sessionToken = null;

    // Clear frame buffer (may contain screenshots with visible credentials)
    this.frameBuffer.frames = [];

    // Mark as cleared
    this.security.memoryCleared = true;

    console.log('[CredentialCapture] Credentials cleared from memory');
  },

  /**
   * Detect current platform
   */
  detectPlatform() {
    const hostname = window.location.hostname;

    const platforms = {
      'console.cloud.google.com': 'google-cloud',
      'console.developers.google.com': 'google-cloud',
      'dashboard.stripe.com': 'stripe',
      'supabase.com': 'supabase',
      'app.supabase.com': 'supabase',
      'vercel.com': 'vercel',
      'railway.app': 'railway',
      'app.netlify.com': 'netlify',
      'platform.openai.com': 'openai',
      'console.anthropic.com': 'anthropic',
      'dash.cloudflare.com': 'cloudflare'
    };

    for (const [domain, platform] of Object.entries(platforms)) {
      if (hostname.includes(domain)) {
        return platform;
      }
    }

    return hostname;
  },

  // =========================================================================
  // UI Methods
  // =========================================================================

  /**
   * Show capture overlay
   */
  showCaptureOverlay() {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'kriptik-credential-overlay';
    this.overlay.innerHTML = `
      <div class="kc-backdrop"></div>
      <div class="kc-panel">
        <div class="kc-header">
          <div class="kc-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div class="kc-title">KripTik AI Credential Capture</div>
        </div>

        <div class="kc-status">
          <div class="kc-status-indicator" id="kc-status-dot"></div>
          <span class="kc-status-text" id="kc-status-text">Initializing...</span>
        </div>

        <div class="kc-credentials" id="kc-credentials">
          ${this.targetCredentials.map(cred => `
            <div class="kc-credential" data-credential="${cred}">
              <span class="kc-cred-name">${cred}</span>
              <span class="kc-cred-status" id="kc-cred-${cred}">Pending</span>
            </div>
          `).join('')}
        </div>

        <div class="kc-log" id="kc-log"></div>

        <div class="kc-actions">
          <button class="kc-btn kc-btn-cancel" id="kc-cancel">Cancel</button>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = this.getOverlayStyles();
    this.overlay.appendChild(style);

    document.body.appendChild(this.overlay);

    // Bind cancel button
    document.getElementById('kc-cancel').addEventListener('click', () => {
      this.cancel();
    });

    // Animate in
    requestAnimationFrame(() => {
      this.overlay.classList.add('visible');
    });
  },

  /**
   * Get overlay CSS styles
   */
  getOverlayStyles() {
    return `
      #kriptik-credential-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      #kriptik-credential-overlay.visible {
        opacity: 1;
      }

      .kc-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }

      .kc-panel {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 320px;
        background: linear-gradient(145deg, #1a1a2e 0%, #0f0f1a 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        color: #fff;
      }

      .kc-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .kc-logo {
        width: 32px;
        height: 32px;
        color: #ff9966;
      }

      .kc-logo svg {
        width: 100%;
        height: 100%;
      }

      .kc-title {
        font-size: 14px;
        font-weight: 600;
      }

      .kc-status {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
      }

      .kc-status-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #666;
        transition: all 0.3s ease;
      }

      .kc-status-indicator.waiting {
        background: #fbbf24;
        animation: pulse 1.5s infinite;
      }

      .kc-status-indicator.extracting {
        background: #60a5fa;
        animation: pulse 1s infinite;
      }

      .kc-status-indicator.complete {
        background: #4ade80;
        box-shadow: 0 0 12px rgba(74, 222, 128, 0.5);
      }

      .kc-status-indicator.error {
        background: #f87171;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(0.9); }
      }

      .kc-status-text {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.8);
      }

      .kc-credentials {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }

      .kc-credential {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        font-size: 12px;
      }

      .kc-cred-name {
        font-family: 'SF Mono', Monaco, monospace;
        color: rgba(255, 255, 255, 0.7);
      }

      .kc-cred-status {
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
      }

      .kc-cred-status.captured {
        color: #4ade80;
      }

      .kc-log {
        max-height: 120px;
        overflow-y: auto;
        margin-bottom: 16px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        font-size: 11px;
        font-family: 'SF Mono', Monaco, monospace;
        color: rgba(255, 255, 255, 0.6);
      }

      .kc-log-entry {
        padding: 2px 0;
      }

      .kc-actions {
        display: flex;
        gap: 10px;
      }

      .kc-btn {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .kc-btn-cancel {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .kc-btn-cancel:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
      }

      .kc-message {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 16px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        max-width: 80%;
      }

      .kc-message.success {
        background: rgba(74, 222, 128, 0.2);
        border: 1px solid rgba(74, 222, 128, 0.3);
        color: #4ade80;
      }

      .kc-message.error {
        background: rgba(248, 113, 113, 0.2);
        border: 1px solid rgba(248, 113, 113, 0.3);
        color: #f87171;
      }
    `;
  },

  /**
   * Update status display
   */
  updateStatus(status, text) {
    const dot = document.getElementById('kc-status-dot');
    const textEl = document.getElementById('kc-status-text');

    if (dot) {
      dot.className = `kc-status-indicator ${status}`;
    }
    if (textEl) {
      textEl.textContent = text;
    }
  },

  /**
   * Update credential status
   */
  updateCredentialStatus(credentialName, status) {
    const el = document.getElementById(`kc-cred-${credentialName}`);
    if (el) {
      el.textContent = status === 'captured' ? 'Captured' : status;
      el.className = `kc-cred-status ${status}`;
    }
  },

  /**
   * Add log entry
   */
  addLog(message) {
    const log = document.getElementById('kc-log');
    if (log) {
      const entry = document.createElement('div');
      entry.className = 'kc-log-entry';
      entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;
    }
    console.log(`[CredentialCapture] ${message}`);
  },

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  },

  /**
   * Show error message
   */
  showError(message) {
    this.showMessage(message, 'error');
  },

  /**
   * Show message overlay
   */
  showMessage(message, type) {
    // Remove existing message
    const existing = document.querySelector('.kc-message');
    if (existing) existing.remove();

    const msg = document.createElement('div');
    msg.className = `kc-message ${type}`;
    msg.textContent = message;
    this.overlay?.appendChild(msg);
  },

  /**
   * Show manual input fallback UI
   * Called when automatic extraction fails after max retries
   */
  showManualInputFallback() {
    const remaining = this.targetCredentials.filter(c => !this.capturedCredentials[c]);

    if (remaining.length === 0) {
      // All credentials already captured
      this.sendCredentialsToKripTik();
      return;
    }

    // Create manual input form
    const form = document.createElement('div');
    form.className = 'kc-manual-form';
    form.innerHTML = `
      <div class="kc-manual-header">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 9v4M12 17h.01M12 3l9.5 16.5H2.5L12 3z"/>
        </svg>
        <span>Manual Input Required</span>
      </div>
      <p class="kc-manual-desc">
        Automatic extraction couldn't find all credentials. Please enter them manually below.
      </p>
      <div class="kc-manual-fields">
        ${remaining.map(cred => `
          <div class="kc-manual-field">
            <label for="kc-input-${cred}">${cred}</label>
            <input
              type="password"
              id="kc-input-${cred}"
              data-credential="${cred}"
              placeholder="Enter ${cred}"
              autocomplete="off"
            />
            <button class="kc-toggle-visibility" data-for="kc-input-${cred}" title="Toggle visibility">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
      <div class="kc-manual-actions">
        <button class="kc-btn kc-btn-submit" id="kc-manual-submit">Submit Credentials</button>
      </div>
    `;

    // Add manual form styles
    const style = document.createElement('style');
    style.textContent = `
      .kc-manual-form {
        margin-top: 16px;
        padding: 16px;
        background: rgba(255, 200, 100, 0.1);
        border: 1px solid rgba(255, 200, 100, 0.2);
        border-radius: 12px;
      }
      .kc-manual-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        color: #fbbf24;
        font-weight: 600;
      }
      .kc-manual-desc {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 16px;
      }
      .kc-manual-fields {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .kc-manual-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        position: relative;
      }
      .kc-manual-field label {
        font-size: 11px;
        font-family: 'SF Mono', Monaco, monospace;
        color: rgba(255, 255, 255, 0.6);
      }
      .kc-manual-field input {
        padding: 10px 36px 10px 12px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #fff;
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 12px;
      }
      .kc-manual-field input:focus {
        outline: none;
        border-color: #ff9966;
      }
      .kc-toggle-visibility {
        position: absolute;
        right: 8px;
        bottom: 8px;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        padding: 4px;
      }
      .kc-toggle-visibility:hover {
        color: #fff;
      }
      .kc-manual-actions {
        margin-top: 16px;
      }
      .kc-btn-submit {
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #ff9966, #ff7733);
        border: none;
        border-radius: 8px;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .kc-btn-submit:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 153, 102, 0.3);
      }
      .kc-btn-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
    `;
    form.appendChild(style);

    // Replace credentials panel with form
    const credentialsPanel = document.getElementById('kc-credentials');
    if (credentialsPanel) {
      credentialsPanel.replaceWith(form);
    } else {
      this.overlay?.querySelector('.kc-panel')?.appendChild(form);
    }

    // Bind toggle visibility buttons
    form.querySelectorAll('.kc-toggle-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.getAttribute('data-for');
        const input = document.getElementById(inputId);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });

    // Bind submit button
    document.getElementById('kc-manual-submit')?.addEventListener('click', () => {
      this.submitManualCredentials(remaining);
    });
  },

  /**
   * Submit manually entered credentials
   */
  async submitManualCredentials(credentialNames) {
    const submitBtn = document.getElementById('kc-manual-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    // Collect values from inputs
    for (const credName of credentialNames) {
      const input = document.getElementById(`kc-input-${credName}`);
      if (input && input.value.trim()) {
        this.capturedCredentials[credName] = input.value.trim();
        // SECURITY: Clear input after reading
        input.value = '';
      }
    }

    // Send to KripTik
    await this.sendCredentialsToKripTik();
  },

  /**
   * Cancel capture
   */
  cancel() {
    this.isCapturing = false;
    if (this.loginCheckInterval) {
      clearInterval(this.loginCheckInterval);
    }

    // Notify KripTik that capture was cancelled
    chrome.runtime.sendMessage({
      type: 'CREDENTIALS_CANCELLED',
      originTabId: this.kriptikTabId
    });

    window.close();
  },

  /**
   * Check if element is visible
   */
  isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 &&
           rect.height > 0 &&
           style.visibility !== 'hidden' &&
           style.display !== 'none';
  },

  /**
   * Wait helper
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Export to window
window.CredentialCapture = CredentialCapture;

// Check for capture mode on load
document.addEventListener('DOMContentLoaded', () => {
  CredentialCapture.checkUrlForCaptureMode();
});

// Also listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CREDENTIAL_CAPTURE') {
    CredentialCapture.initialize(message.config);
    sendResponse({ success: true });
  }
  return true;
});
