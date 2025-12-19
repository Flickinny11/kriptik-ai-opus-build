/**
 * Vision Capture Module
 *
 * Client-side interface for the server-based vision capture system.
 * Uses Gemini 3 Flash + Playwright for intelligent, platform-agnostic capture.
 */

const VisionCapture = {
  activeSession: null,
  eventSource: null,
  onProgress: null,
  onComplete: null,
  onError: null,

  /**
   * Start a vision capture session
   * @param {string} url - URL to capture from
   * @param {Object} options - Capture options
   * @returns {Promise<{success: boolean, sessionId?: string, error?: string}>}
   */
  async start(url, options = {}) {
    console.log('[VisionCapture] Starting capture for:', url);

    // Clean up any existing session
    this.stop();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_VISION_CAPTURE',
        url,
        options
      });

      if (!response.success) {
        console.error('[VisionCapture] Failed to start:', response.error);
        return { success: false, error: response.error };
      }

      this.activeSession = {
        id: response.sessionId,
        url,
        startedAt: Date.now()
      };

      // Connect to SSE stream for progress updates
      this.connectToEventStream(response.eventsUrl);

      console.log('[VisionCapture] Session started:', response.sessionId);
      return { success: true, sessionId: response.sessionId };

    } catch (error) {
      console.error('[VisionCapture] Start error:', error);
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

    console.log('[VisionCapture] Connecting to event stream:', eventsUrl);

    this.eventSource = new EventSource(eventsUrl);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleEvent(data);
      } catch (e) {
        console.error('[VisionCapture] Failed to parse event:', e);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('[VisionCapture] EventSource error:', error);
      if (this.onError) {
        this.onError({ message: 'Connection to server lost' });
      }
    };
  },

  /**
   * Handle SSE events from server
   */
  handleEvent(data) {
    console.log('[VisionCapture] Event:', data.type, data);

    switch (data.type) {
      case 'connected':
        console.log('[VisionCapture] Connected to server');
        break;

      case 'progress':
        if (this.onProgress) {
          this.onProgress(data.session);
        }
        // Update overlay if visible
        if (window.Overlay && window.Overlay.isVisible) {
          const progress = data.session.progress;
          window.Overlay.updateStatus(data.session.status, progress.step);
          window.Overlay.addLog(`[${progress.phase}] ${progress.step}`);
          if (progress.messagesFound > 0) {
            window.Overlay.addLog(`[PROGRESS] Found ${progress.messagesFound} messages`);
          }
        }
        break;

      case 'complete':
        console.log('[VisionCapture] Capture complete:', data.result);
        if (this.onComplete) {
          this.onComplete(data);
        }
        // Update overlay
        if (window.Overlay && window.Overlay.isVisible) {
          const result = data.result;
          window.Overlay.updateStatus('exported', 'Vision capture complete!');
          window.Overlay.addLog(`[SUCCESS] Captured ${result?.chatMessageCount || 0} messages`);
          window.Overlay.addLog(`[SUCCESS] Found ${result?.fileCount || 0} files`);
          window.Overlay.addLog(`[STATS] Cost: $${(result?.captureStats?.estimatedCost || 0).toFixed(4)}`);
        }
        this.cleanup();
        break;

      case 'error':
        console.error('[VisionCapture] Server error:', data.error);
        if (this.onError) {
          this.onError({ message: data.error });
        }
        if (window.Overlay && window.Overlay.isVisible) {
          window.Overlay.updateStatus('error', data.error);
          window.Overlay.addLog(`[ERROR] ${data.error}`);
        }
        this.cleanup();
        break;

      case 'cancelled':
        console.log('[VisionCapture] Capture cancelled');
        if (window.Overlay && window.Overlay.isVisible) {
          window.Overlay.updateStatus('cancelled', 'Capture cancelled');
        }
        this.cleanup();
        break;

      case 'heartbeat':
        // Keep-alive, ignore
        break;

      default:
        console.warn('[VisionCapture] Unknown event type:', data.type);
    }
  },

  /**
   * Get current session status
   */
  async getStatus() {
    if (!this.activeSession) {
      return { success: false, error: 'No active session' };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_VISION_CAPTURE_STATUS',
        sessionId: this.activeSession.id
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
    if (!this.activeSession) {
      return { success: false, error: 'No active session' };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_VISION_CAPTURE_RESULT',
        sessionId: this.activeSession.id
      });

      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Cancel current capture
   */
  async cancel() {
    if (!this.activeSession) {
      return { success: false, error: 'No active session' };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CANCEL_VISION_CAPTURE',
        sessionId: this.activeSession.id
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
    this.activeSession = null;
  },

  /**
   * Check if a capture is currently active
   */
  isActive() {
    return !!this.activeSession;
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
window.VisionCapture = VisionCapture;

console.log('[VisionCapture] Module loaded');
