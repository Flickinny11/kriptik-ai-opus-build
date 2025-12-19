/**
 * KripTik Bridge - Content Script
 * Bridges communication between the KripTik web app and the background service worker
 * This script runs on KripTik domains and relays messages
 */

(function() {
  'use strict';

  console.log('[KripTik Bridge] Content script loaded');

  // =========================================================================
  // Page -> Extension Communication
  // =========================================================================

  // Listen for messages from the KripTik web page
  window.addEventListener('message', async (event) => {
    // Only accept messages from same origin
    if (event.source !== window) return;

    const { type, ...data } = event.data;

    switch (type) {
      case 'KRIPTIK_EXTENSION_PING':
        // Respond to ping to confirm extension is installed
        window.postMessage({ type: 'KRIPTIK_EXTENSION_PONG' }, '*');
        break;

      case 'KRIPTIK_START_FIX_SESSION':
        // User started Fix My App workflow - enable capture on AI platforms
        try {
          // Store session data in local storage (for content scripts)
          await chrome.storage.local.set({
            fixMyAppSession: {
              active: true,
              startedAt: Date.now(),
              projectName: data.projectName || 'Imported Project',
              returnUrl: data.returnUrl || window.location.href,
              apiEndpoint: data.apiEndpoint,
              token: data.token
            }
          });

          // ALSO store API config in sync storage (for KripTikAPIHandler)
          // This ensures the capture can send data directly to KripTik
          await chrome.storage.sync.set({
            kriptikApiEndpoint: data.apiEndpoint,
            kriptikToken: data.token,
            // Also save in popup format for consistency
            apiEndpoint: data.apiEndpoint,
            apiToken: data.token
          });

          console.log('[KripTik Bridge] Fix My App session started');
          console.log('[KripTik Bridge] API endpoint configured:', data.apiEndpoint);
          window.postMessage({ type: 'KRIPTIK_FIX_SESSION_STARTED' }, '*');
        } catch (error) {
          console.error('[KripTik Bridge] Failed to start Fix My App session:', error);
        }
        break;

      case 'KRIPTIK_END_FIX_SESSION':
        // User completed or cancelled Fix My App - disable capture
        try {
          await chrome.storage.local.remove('fixMyAppSession');
          console.log('[KripTik Bridge] Fix My App session ended');
          window.postMessage({ type: 'KRIPTIK_FIX_SESSION_ENDED' }, '*');
        } catch (error) {
          console.error('[KripTik Bridge] Failed to end Fix My App session:', error);
        }
        break;

      case 'KRIPTIK_START_CREDENTIAL_CAPTURE':
        // Forward credential capture request to background script
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'START_CREDENTIAL_CAPTURE',
            platformUrl: data.platformUrl,
            requiredCredentials: data.requiredCredentials,
            sessionToken: data.sessionToken,
            apiEndpoint: data.apiEndpoint,
            originTabId: await getCurrentTabId()
          });

          console.log('[KripTik Bridge] Credential capture started:', response);
        } catch (error) {
          console.error('[KripTik Bridge] Failed to start credential capture:', error);
          window.postMessage({
            type: 'KRIPTIK_CAPTURE_ERROR',
            error: error.message
          }, '*');
        }
        break;

      case 'KRIPTIK_GET_EXTENSION_STATUS':
        // Get extension status
        try {
          const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
          window.postMessage({
            type: 'KRIPTIK_EXTENSION_STATUS',
            status
          }, '*');
        } catch (error) {
          console.error('[KripTik Bridge] Failed to get status:', error);
        }
        break;
    }
  });

  // =========================================================================
  // Extension -> Page Communication
  // =========================================================================

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'CREDENTIALS_RECEIVED':
        // Forward captured credentials to the web page
        window.postMessage({
          type: 'KRIPTIK_CREDENTIALS_RECEIVED',
          credentials: message.credentials
        }, '*');
        sendResponse({ received: true });
        break;

      case 'CREDENTIALS_CAPTURE_CANCELLED':
        // Notify page that capture was cancelled
        window.postMessage({
          type: 'KRIPTIK_CAPTURE_CANCELLED'
        }, '*');
        sendResponse({ received: true });
        break;

      case 'CAPTURE_PROGRESS':
        // Forward progress updates
        window.postMessage({
          type: 'KRIPTIK_CAPTURE_PROGRESS',
          progress: message.progress
        }, '*');
        sendResponse({ received: true });
        break;
    }

    return true;
  });

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Get current tab ID from background script
   */
  async function getCurrentTabId() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_ID' }, (response) => {
        resolve(response?.tabId || null);
      });
    });
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  // Announce extension presence
  setTimeout(() => {
    window.postMessage({ type: 'KRIPTIK_EXTENSION_READY' }, '*');
  }, 100);

})();
