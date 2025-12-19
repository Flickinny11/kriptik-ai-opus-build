/**
 * Credential Capture System
 * Uses AI vision to extract credentials from any platform
 * Handles varied UIs without brittle CSS selectors
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
   * Main extraction using AI vision
   */
  async extractCredentialsWithVision() {
    this.updateStatus('extracting', 'Analyzing page with AI vision...');

    while (
      Object.keys(this.capturedCredentials).length < this.targetCredentials.length &&
      this.attempts < this.maxAttempts &&
      this.isCapturing
    ) {
      this.attempts++;
      this.addLog(`Extraction attempt ${this.attempts}/${this.maxAttempts}`);

      try {
        // Take screenshot of current page
        const screenshot = await this.captureScreenshot();

        if (!screenshot) {
          this.addLog('Failed to capture screenshot');
          await this.wait(1000);
          continue;
        }

        // Send to KripTik backend for AI analysis
        const response = await this.sendToVisionAPI({
          screenshot: screenshot,
          targetCredentials: this.targetCredentials.filter(c => !this.capturedCredentials[c]),
          currentUrl: window.location.href,
          pageTitle: document.title,
          pageText: this.getVisibleText(),
          attempt: this.attempts
        });

        if (!response) {
          this.addLog('No response from vision API');
          await this.wait(2000);
          continue;
        }

        // Handle response
        if (response.success && response.credentials) {
          for (const [key, value] of Object.entries(response.credentials)) {
            if (value && value.trim()) {
              this.capturedCredentials[key] = value;
              this.addLog(`Captured: ${key}`);
              this.updateCredentialStatus(key, 'captured');
            }
          }
        }

        // Handle navigation or click instructions
        if (response.action === 'navigate' && response.navigateTo) {
          this.addLog(`Navigating to: ${response.navigateTo}`);
          await this.navigateToUrl(response.navigateTo);
          await this.wait(3000);
          continue;
        }

        if (response.action === 'click' && (response.clickSelector || response.clickText)) {
          this.addLog(`Clicking: ${response.clickText || response.clickSelector}`);
          await this.executeClickAction(response.clickSelector, response.clickText);
          await this.wait(2000);
          continue;
        }

        if (response.action === 'scroll') {
          await this.scrollPage(response.scrollDirection || 'down');
          await this.wait(1000);
          continue;
        }

        // Check if we got all credentials
        const remaining = this.targetCredentials.filter(c => !this.capturedCredentials[c]);
        if (remaining.length === 0) {
          break;
        }

        // Small delay between attempts
        await this.wait(1500);

      } catch (error) {
        console.error('[CredentialCapture] Extraction error:', error);
        this.addLog(`Error: ${error.message}`);
        await this.wait(2000);
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

      if (!response.ok) {
        console.error('[CredentialCapture] Vision API error:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[CredentialCapture] Vision API request failed:', error);
      return null;
    }
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
    this.addLog('Sending credentials to KripTik AI...');

    try {
      // Send to KripTik backend
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

      // Notify the KripTik tab
      chrome.runtime.sendMessage({
        type: 'CREDENTIALS_CAPTURED',
        credentials: this.capturedCredentials,
        originTabId: this.kriptikTabId
      });

      // Show success
      if (capturedCount === targetCount) {
        this.showSuccess('All credentials captured! Returning to KripTik AI...');
      } else {
        this.showSuccess(`Captured ${capturedCount} of ${targetCount} credentials. Returning to KripTik AI...`);
      }

      // Close window after delay
      setTimeout(() => {
        window.close();
      }, 2500);

    } catch (error) {
      console.error('[CredentialCapture] Send credentials error:', error);
      this.showError(`Failed to send credentials: ${error.message}`);
    }
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
