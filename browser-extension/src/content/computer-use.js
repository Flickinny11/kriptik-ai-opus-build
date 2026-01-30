/**
 * Computer Use Module
 *
 * Client-side interface for the high-FPS AI-controlled browser automation.
 * Uses Gemini 3 Flash + Playwright at configurable frame rates (up to 10 FPS)
 * for intelligent, platform-agnostic capture.
 *
 * Features:
 * - Higher FPS for real-time visual tracking
 * - AI-controlled browser actions (scroll, click, type)
 * - Progressive message extraction during scroll
 * - Automatic "Load more" button detection and clicking
 * - Build/runtime log capture
 * - Project export automation
 */

const ComputerUse = {
  activeCapture: null,
  eventSource: null,
  onProgress: null,
  onComplete: null,
  onError: null,

  /**
   * Start a Computer Use capture session
   * @param {string} url - URL to capture from
   * @param {Object} options - Capture options
   * @param {string} options.platform - Platform identifier (lovable, bolt, v0, etc.)
   * @param {number} options.fps - Frame rate (1-10, default 2)
   * @param {string[]} options.captureTypes - Types to capture: chat, logs, files, export
   * @param {number} options.maxScrollAttempts - Max scroll attempts (default 100)
   * @param {string} options.fixSessionId - Fix My App session ID
   * @returns {Promise<{success: boolean, captureId?: string, error?: string}>}
   */
  async start(url, options = {}) {
    console.log(`[ComputerUse] Starting capture for: ${url} at ${options.fps || 2} FPS`);

    // Clean up any existing capture
    this.stop();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_COMPUTER_USE_CAPTURE',
        url,
        platform: options.platform,
        fps: options.fps || 2,
        captureTypes: options.captureTypes || ['chat', 'logs', 'files', 'export'],
        maxScrollAttempts: options.maxScrollAttempts || 100,
        fixSessionId: options.fixSessionId
      });

      if (!response.success) {
        console.error('[ComputerUse] Failed to start:', response.error);
        return { success: false, error: response.error };
      }

      this.activeCapture = {
        id: response.captureId,
        url,
        config: response.config,
        startedAt: Date.now()
      };

      // Connect to SSE stream for progress updates
      this.connectToEventStream(response.eventsUrl);

      console.log('[ComputerUse] Capture started:', response.captureId);
      return { success: true, captureId: response.captureId, config: response.config };

    } catch (error) {
      console.error('[ComputerUse] Start error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Connect to the server's SSE stream for progress updates
   */
  connectToEventStream(eventsUrl) {
    if (this.eventSource) {
      this.eventSource.close();
    }

    console.log('[ComputerUse] Connecting to event stream:', eventsUrl);

    this.eventSource = new EventSource(eventsUrl);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleEvent(data);
      } catch (e) {
        console.error('[ComputerUse] Failed to parse event:', e);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('[ComputerUse] EventSource error:', error);
      if (this.onError) {
        this.onError({ message: 'Connection to server lost' });
      }
    };
  },

  /**
   * Handle SSE events from server
   */
  handleEvent(data) {
    console.log('[ComputerUse] Event:', data.type, data);

    switch (data.type) {
      case 'connected':
        console.log('[ComputerUse] Connected to server');
        break;

      case 'progress':
      case 'message_captured':
      case 'log_captured':
      case 'file_found':
      case 'export_started':
        if (this.onProgress) {
          this.onProgress({
            type: data.type,
            phase: data.phase,
            progress: data.progress,
            message: data.message,
            data: data.data
          });
        }
        // Update overlay if visible
        if (window.Overlay && window.Overlay.isVisible) {
          window.Overlay.updateStatus(data.phase, data.message);
          window.Overlay.addLog(`[${data.phase.toUpperCase()}] ${data.message}`);
          if (data.data?.count) {
            window.Overlay.addLog(`[PROGRESS] Found ${data.data.count} items`);
          }
        }
        break;

      case 'complete':
        console.log('[ComputerUse] Capture complete:', data);
        if (this.onComplete) {
          this.onComplete(data);
        }
        // Update overlay
        if (window.Overlay && window.Overlay.isVisible) {
          window.Overlay.updateStatus('complete', 'Computer Use capture complete!');
          window.Overlay.addLog(`[SUCCESS] Capture finished`);
          if (data.data) {
            window.Overlay.addLog(`[SUCCESS] Messages: ${data.data.messagesFound || 0}`);
            window.Overlay.addLog(`[SUCCESS] Duration: ${(data.data.duration / 1000).toFixed(1)}s`);
          }
        }
        this.cleanup();
        break;

      case 'error':
        console.error('[ComputerUse] Server error:', data.message);
        if (this.onError) {
          this.onError({ message: data.message });
        }
        if (window.Overlay && window.Overlay.isVisible) {
          window.Overlay.updateStatus('error', data.message);
          window.Overlay.addLog(`[ERROR] ${data.message}`);
        }
        this.cleanup();
        break;

      case 'aborted':
        console.log('[ComputerUse] Capture aborted');
        if (window.Overlay && window.Overlay.isVisible) {
          window.Overlay.updateStatus('aborted', 'Capture aborted');
        }
        this.cleanup();
        break;

      case 'heartbeat':
        // Keep-alive, ignore
        break;

      default:
        console.warn('[ComputerUse] Unknown event type:', data.type);
    }
  },

  /**
   * Get current capture status
   */
  async getStatus() {
    if (!this.activeCapture) {
      return { success: false, error: 'No active capture' };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_COMPUTER_USE_STATUS',
        captureId: this.activeCapture.id
      });

      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get capture results
   */
  async getResult() {
    if (!this.activeCapture) {
      return { success: false, error: 'No active capture' };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_COMPUTER_USE_RESULT',
        captureId: this.activeCapture.id
      });

      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Import capture results into Fix My App flow
   * @param {Object} options - Import options
   * @param {string} options.projectName - Name for the project
   * @param {string} options.fixSessionId - Fix My App session ID
   */
  async import(options = {}) {
    if (!this.activeCapture) {
      return { success: false, error: 'No active capture' };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'IMPORT_COMPUTER_USE_CAPTURE',
        captureId: this.activeCapture.id,
        projectName: options.projectName,
        fixSessionId: options.fixSessionId
      });

      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Abort current capture
   */
  async abort() {
    if (!this.activeCapture) {
      return { success: false, error: 'No active capture' };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ABORT_COMPUTER_USE_CAPTURE',
        captureId: this.activeCapture.id
      });

      this.cleanup();
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Stop and clean up
   */
  stop() {
    this.cleanup();
  },

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.activeCapture = null;
  },

  /**
   * Check if a capture is currently active
   */
  isActive() {
    return !!this.activeCapture;
  },

  /**
   * Get active capture info
   */
  getActiveCapture() {
    return this.activeCapture;
  },

  /**
   * Set event callbacks
   */
  setCallbacks({ onProgress, onComplete, onError }) {
    if (onProgress) this.onProgress = onProgress;
    if (onComplete) this.onComplete = onComplete;
    if (onError) this.onError = onError;
  }
};

// Make available globally
window.ComputerUse = ComputerUse;

console.log('[ComputerUse] Module loaded');
