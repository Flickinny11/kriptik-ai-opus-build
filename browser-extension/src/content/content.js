// Content Script - Main orchestrator
// Initializes the extension and coordinates all components
// IMPORTANT: Only activates when user has an active Fix My App session from KripTik

(function () {
  'use strict';

  console.log('[KripTik AI] Extension loaded');

  // Initialize platform detector
  PlatformDetector.init();

  const platform = PlatformDetector.getPlatform();

  if (!platform) {
    console.log('[KripTik AI] No supported platform detected');
    return;
  }

  console.log(`[KripTik AI] Detected platform: ${platform.name}`);

  // Check if there's an active Fix My App session before showing UI
  checkFixMyAppSession(platform);

  /**
   * Check if user has an active Fix My App session
   * Only show the capture button if they do
   */
  async function checkFixMyAppSession(platform) {
    try {
      const result = await chrome.storage.local.get('fixMyAppSession');
      const session = result.fixMyAppSession;

      if (session && session.active) {
        // Session is active - check if it's not too old (24 hour expiry)
        const sessionAge = Date.now() - session.startedAt;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (sessionAge < maxAge) {
          console.log('[KripTik AI] Active Fix My App session found, showing capture button');
          createImportButton(platform, session);
          return;
        } else {
          // Session expired, clean it up
          console.log('[KripTik AI] Fix My App session expired, cleaning up');
          await chrome.storage.local.remove('fixMyAppSession');
        }
      }

      console.log('[KripTik AI] No active Fix My App session - capture button hidden');
      console.log('[KripTik AI] Start "Fix My App" on KripTik AI to enable project capture');
    } catch (error) {
      console.error('[KripTik AI] Error checking session:', error);
    }
  }

  // Listen for session changes (in case user starts Fix My App while on this page)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.fixMyAppSession) {
      const newValue = changes.fixMyAppSession.newValue;
      if (newValue && newValue.active) {
        console.log('[KripTik AI] Fix My App session activated');
        createImportButton(platform, newValue);
      } else {
        console.log('[KripTik AI] Fix My App session ended');
        removeImportButton();
      }
    }
  });

  /**
   * Remove the import button
   */
  function removeImportButton() {
    const button = document.getElementById('kriptik-import-btn');
    if (button) {
      button.remove();
    }
  }

  /**
   * Create and inject the import button
   * @param {Object} platform - Platform configuration
   * @param {Object} session - Fix My App session data
   */
  function createImportButton(platform, session) {
    // Check if button already exists
    if (document.getElementById('kriptik-import-btn')) {
      return;
    }

    // Store session data for the overlay to use
    window.__kriptikSession = session;

    // Create button element
    const button = document.createElement('button');
    button.id = 'kriptik-import-btn';
    button.className = 'kriptik-import-button';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>Capture for KripTik AI</span>
    `;

    // Add click handler
    button.addEventListener('click', () => {
      Overlay.show(platform);
    });

    // Inject button into page
    document.body.appendChild(button);

    // Add styles
    injectButtonStyles();

    console.log('[KripTik AI] Capture button injected - ready to import to Fix My App');
  }

  /**
 * Inject button styles
 */
  function injectButtonStyles() {
    const styleId = 'kriptik-import-button-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .kriptik-import-button {
        position: fixed !important;
        bottom: 80px !important;
        right: 24px !important;
        left: auto !important;
        top: auto !important;
        z-index: 2147483647 !important;

        display: flex !important;
        align-items: center;
        gap: 10px;

        padding: 14px 24px;

        /* 3D Glass Effect with KripTik amber accent */
        background: linear-gradient(
          135deg,
          rgba(251, 191, 36, 0.2) 0%,
          rgba(251, 191, 36, 0.1) 100%
        ) !important;

        border: 1px solid rgba(251, 191, 36, 0.4) !important;
        border-radius: 14px;

        /* Multi-layer shadows for depth */
        box-shadow:
          0 4px 16px rgba(0, 0, 0, 0.4),
          0 8px 32px rgba(0, 0, 0, 0.3),
          0 0 20px rgba(251, 191, 36, 0.2),
          inset 0 1px 2px rgba(255, 255, 255, 0.2),
          inset 0 -1px 2px rgba(0, 0, 0, 0.2) !important;

        backdrop-filter: blur(12px);

        color: white !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        font-size: 14px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: 0.3px;

        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

        overflow: hidden;
        transform: none !important;
      }

      /* Pulse animation to draw attention */
      .kriptik-import-button::after {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: 16px;
        background: linear-gradient(45deg, transparent, rgba(251, 191, 36, 0.3), transparent);
        animation: kriptik-pulse 2s ease-in-out infinite;
        z-index: -1;
      }

      @keyframes kriptik-pulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }

      /* Shine animation */
      .kriptik-import-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.25) 50%,
          transparent 100%
        );
        transition: left 0.6s ease;
      }

      .kriptik-import-button:hover::before {
        left: 100%;
      }

      .kriptik-import-button:hover {
        transform: translateY(-3px);

        box-shadow:
          0 6px 24px rgba(0, 0, 0, 0.5),
          0 12px 48px rgba(0, 0, 0, 0.3),
          0 0 32px rgba(251, 191, 36, 0.4),
          inset 0 1px 2px rgba(255, 255, 255, 0.25);

        border-color: rgba(251, 191, 36, 0.6);

        background: linear-gradient(
          135deg,
          rgba(251, 191, 36, 0.3) 0%,
          rgba(251, 191, 36, 0.15) 100%
        );
      }

      .kriptik-import-button:active {
        transform: translateY(-1px);
      }

      .kriptik-import-button svg {
        width: 20px;
        height: 20px;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        color: #fbbf24;
      }

      @media (max-width: 640px) {
        .kriptik-import-button {
          bottom: 16px;
          right: 16px;
          padding: 12px 18px;
          font-size: 13px;
        }

        .kriptik-import-button svg {
          width: 18px;
          height: 18px;
        }

        .kriptik-import-button span {
          display: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

})();
