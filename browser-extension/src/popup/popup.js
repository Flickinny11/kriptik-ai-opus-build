/**
 * KripTik AI Extension - Popup Script
 * Handles configuration, status display, and quick actions
 */

(function () {
  'use strict';

  // Platform detection patterns
  const SUPPORTED_PLATFORMS = {
    'lovable.dev': { name: 'Lovable', type: 'ai-builder', icon: 'lovable' },
    'bolt.new': { name: 'Bolt', type: 'ai-builder', icon: 'bolt' },
    'v0.dev': { name: 'v0', type: 'ai-builder', icon: 'v0' },
    'create.xyz': { name: 'Create.xyz', type: 'ai-builder', icon: 'create' },
    'cursor.sh': { name: 'Cursor', type: 'ai-editor', icon: 'cursor' },
    'cursor.com': { name: 'Cursor', type: 'ai-editor', icon: 'cursor' },
    'replit.com': { name: 'Replit', type: 'dev-platform', icon: 'replit' },
    'github.com': { name: 'GitHub', type: 'repository', icon: 'github' },
    'claude.ai': { name: 'Claude', type: 'ai-assistant', icon: 'claude' },
    'chatgpt.com': { name: 'ChatGPT', type: 'ai-assistant', icon: 'chatgpt' },
    'chat.openai.com': { name: 'ChatGPT', type: 'ai-assistant', icon: 'chatgpt' },
    'console.cloud.google.com': { name: 'Google Cloud', type: 'credential', icon: 'google' },
    'console.developers.google.com': { name: 'Google Cloud', type: 'credential', icon: 'google' },
    'dashboard.stripe.com': { name: 'Stripe', type: 'credential', icon: 'stripe' },
    'supabase.com': { name: 'Supabase', type: 'credential', icon: 'supabase' },
    'app.supabase.com': { name: 'Supabase', type: 'credential', icon: 'supabase' },
    'vercel.com': { name: 'Vercel', type: 'credential', icon: 'vercel' },
    'railway.app': { name: 'Railway', type: 'credential', icon: 'railway' },
    'app.netlify.com': { name: 'Netlify', type: 'credential', icon: 'netlify' }
  };

  // DOM Elements
  let elements = {};

  /**
   * Initialize popup
   */
  async function init() {
    // Cache DOM elements
    elements = {
      platformStatus: document.getElementById('platform-status'),
      platformName: document.getElementById('platform-name'),
      connectionStatus: document.getElementById('connection-status'),
      connectionValue: document.getElementById('connection-value'),
      apiEndpoint: document.getElementById('api-endpoint'),
      apiToken: document.getElementById('api-token'),
      toggleToken: document.getElementById('toggle-token'),
      saveConfig: document.getElementById('save-config'),
      openKriptik: document.getElementById('open-kriptik'),
      testConnection: document.getElementById('test-connection'),
      captureMode: document.getElementById('capture-mode'),
      fixSessionCard: document.getElementById('fix-session-card'),
      sessionStatus: document.getElementById('session-status')
    };

    // Load saved configuration
    await loadConfig();

    // Detect current platform
    await detectPlatform();

    // Check Fix My App session status
    await checkFixMyAppSession();

    // Check capture mode
    await checkCaptureMode();

    // Bind events
    bindEvents();
  }

  /**
   * Load saved configuration
   */
  async function loadConfig() {
    try {
      const config = await chrome.storage.sync.get(['apiEndpoint', 'apiToken']);

      if (config.apiEndpoint) {
        elements.apiEndpoint.value = config.apiEndpoint;
      }

      if (config.apiToken) {
        // Show masked token
        elements.apiToken.value = config.apiToken;
        elements.apiToken.type = 'password';
        updateConnectionStatus('configured');
      } else {
        updateConnectionStatus('not-configured');
      }
    } catch (error) {
      console.error('[Popup] Failed to load config:', error);
    }
  }

  /**
   * Detect platform from current tab
   */
  async function detectPlatform() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url) {
        updatePlatformStatus(null);
        return;
      }

      const url = new URL(tab.url);
      const hostname = url.hostname.replace('www.', '');

      // Check against supported platforms
      for (const [domain, platform] of Object.entries(SUPPORTED_PLATFORMS)) {
        if (hostname.includes(domain) || hostname.endsWith(domain)) {
          updatePlatformStatus(platform);
          return;
        }
      }

      updatePlatformStatus(null);
    } catch (error) {
      console.error('[Popup] Platform detection error:', error);
      updatePlatformStatus(null);
    }
  }

  /**
   * Update platform status display
   */
  function updatePlatformStatus(platform) {
    if (platform) {
      elements.platformStatus.classList.add('active');
      elements.platformStatus.classList.remove('warning', 'error');
      elements.platformName.textContent = platform.name;

      // Add type badge
      const typeLabels = {
        'ai-builder': 'AI Builder',
        'ai-editor': 'AI Editor',
        'ai-assistant': 'AI Assistant',
        'dev-platform': 'Dev Platform',
        'repository': 'Repository',
        'credential': 'Credential Source'
      };
      elements.platformName.textContent = `${platform.name} (${typeLabels[platform.type] || platform.type})`;
    } else {
      elements.platformStatus.classList.remove('active');
      elements.platformStatus.classList.add('warning');
      elements.platformName.textContent = 'Not a supported platform';
    }
  }

  /**
   * Update connection status display
   */
  function updateConnectionStatus(status) {
    elements.connectionStatus.classList.remove('active', 'warning', 'error');

    switch (status) {
      case 'configured':
        elements.connectionStatus.classList.add('active');
        elements.connectionValue.textContent = 'Configured';
        break;
      case 'connected':
        elements.connectionStatus.classList.add('active');
        elements.connectionValue.textContent = 'Connected';
        break;
      case 'error':
        elements.connectionStatus.classList.add('error');
        elements.connectionValue.textContent = 'Connection failed';
        break;
      case 'not-configured':
      default:
        elements.connectionStatus.classList.add('warning');
        elements.connectionValue.textContent = 'Not configured';
        break;
    }
  }

  /**
   * Check if we're in credential capture mode
   */
  async function checkCaptureMode() {
    try {
      const { captureMode } = await chrome.storage.local.get(['captureMode']);
      if (captureMode && captureMode.active) {
        elements.captureMode.style.display = 'flex';
        elements.platformStatus.classList.add('capturing');
      }
    } catch (error) {
      console.error('[Popup] Capture mode check error:', error);
    }
  }

  /**
   * Check if there's an active Fix My App session
   */
  async function checkFixMyAppSession() {
    try {
      const { fixMyAppSession } = await chrome.storage.local.get(['fixMyAppSession']);

      if (fixMyAppSession && fixMyAppSession.active) {
        // Check if session is not expired (24 hour limit)
        const sessionAge = Date.now() - fixMyAppSession.startedAt;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (sessionAge < maxAge) {
          // Show the session card
          elements.fixSessionCard.style.display = 'block';

          // Update status text
          const minutesAgo = Math.floor(sessionAge / 60000);
          if (minutesAgo < 1) {
            elements.sessionStatus.textContent = 'Active - Just started';
          } else if (minutesAgo < 60) {
            elements.sessionStatus.textContent = `Active - Started ${minutesAgo}m ago`;
          } else {
            const hoursAgo = Math.floor(minutesAgo / 60);
            elements.sessionStatus.textContent = `Active - Started ${hoursAgo}h ago`;
          }

          // Also auto-fill the config if it came from the session
          if (fixMyAppSession.apiEndpoint && !elements.apiEndpoint.value) {
            elements.apiEndpoint.value = fixMyAppSession.apiEndpoint;
          }
          if (fixMyAppSession.token && !elements.apiToken.value) {
            elements.apiToken.value = fixMyAppSession.token;
          }

          // Update connection status since we have config from KripTik
          if (fixMyAppSession.apiEndpoint && fixMyAppSession.token) {
            updateConnectionStatus('configured');
          }
        }
      }
    } catch (error) {
      console.error('[Popup] Fix My App session check error:', error);
    }
  }

  /**
   * Bind event listeners
   */
  function bindEvents() {
    // Toggle token visibility
    elements.toggleToken.addEventListener('click', () => {
      const input = elements.apiToken;
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Save configuration
    elements.saveConfig.addEventListener('click', saveConfiguration);

    // Open KripTik AI
    elements.openKriptik.addEventListener('click', () => {
      const endpoint = elements.apiEndpoint.value.trim();
      const url = endpoint || 'https://kriptik.ai';
      chrome.tabs.create({ url: url.replace('/api', '').replace(/\/$/, '') });
    });

    // Test connection
    elements.testConnection.addEventListener('click', testConnection);
  }

  /**
   * Save configuration to storage
   */
  async function saveConfiguration() {
    const endpoint = elements.apiEndpoint.value.trim();
    const token = elements.apiToken.value.trim();

    if (!endpoint) {
      showToast('Please enter an API endpoint', 'error');
      return;
    }

    if (!token) {
      showToast('Please enter an extension token', 'error');
      return;
    }

    // Validate endpoint format
    try {
      new URL(endpoint);
    } catch {
      showToast('Invalid endpoint URL format', 'error');
      return;
    }

    // Disable button during save
    elements.saveConfig.disabled = true;
    elements.saveConfig.querySelector('.btn-content').textContent = 'Saving...';

    try {
      await chrome.storage.sync.set({
        apiEndpoint: endpoint,
        apiToken: token
      });

      // Test the connection
      const connected = await testConnectionSilent(endpoint, token);

      if (connected) {
        elements.saveConfig.classList.add('success');
        elements.saveConfig.querySelector('.btn-content').textContent = 'Saved!';
        updateConnectionStatus('connected');
        showToast('Configuration saved and connected!', 'success');
      } else {
        elements.saveConfig.querySelector('.btn-content').textContent = 'Saved (not verified)';
        updateConnectionStatus('configured');
        showToast('Saved, but connection test failed', 'warning');
      }

      // Reset button after delay
      setTimeout(() => {
        elements.saveConfig.classList.remove('success');
        elements.saveConfig.querySelector('.btn-content').textContent = 'Save Configuration';
        elements.saveConfig.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('[Popup] Save config error:', error);
      showToast('Failed to save configuration', 'error');
      elements.saveConfig.querySelector('.btn-content').textContent = 'Save Configuration';
      elements.saveConfig.disabled = false;
    }
  }

  /**
   * Test connection to KripTik API
   */
  async function testConnection() {
    const endpoint = elements.apiEndpoint.value.trim();
    const token = elements.apiToken.value.trim();

    if (!endpoint || !token) {
      showToast('Please configure endpoint and token first', 'error');
      return;
    }

    elements.testConnection.disabled = true;

    try {
      const connected = await testConnectionSilent(endpoint, token);

      if (connected) {
        updateConnectionStatus('connected');
        showToast('Connection successful!', 'success');
      } else {
        updateConnectionStatus('error');
        showToast('Connection failed', 'error');
      }
    } catch (error) {
      updateConnectionStatus('error');
      showToast('Connection error: ' + error.message, 'error');
    }

    elements.testConnection.disabled = false;
  }

  /**
   * Test connection without UI feedback
   */
  async function testConnectionSilent(endpoint, token) {
    try {
      const response = await fetch(`${endpoint}/api/extension/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.connected === true;
      }

      return false;
    } catch (error) {
      console.error('[Popup] Connection test error:', error);
      return false;
    }
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

})();
