// Overlay UI - Main UI overlay for capture process
// Sci-fi themed overlay with progress visualization

const Overlay = {
    overlay: null,
    isVisible: false,
    isCapturing: false,
    capturedData: null,
    progressAnimation: null,
    currentPhase: null,

    /**
     * Create and show overlay
     * @param {Object} platform - Platform configuration
     */
    show(platform) {
        if (this.isVisible) return;

        // Create overlay element
        this.overlay = document.createElement('div');
        this.overlay.id = 'kriptik-import-overlay';
        this.overlay.innerHTML = this.getTemplate(platform);
        document.body.appendChild(this.overlay);

        // Initialize progress animation
        const animationContainer = this.overlay.querySelector('.animation-container');
        const canvas = document.createElement('canvas');
        animationContainer.appendChild(canvas);
        this.progressAnimation = new ProgressAnimation(canvas);
        this.progressAnimation.start();

        // Bind events
        this.bindEvents(platform);

        // Add initial log entries
        this.addLog('[INIT] Import assistant activated');
        this.addLog(`[SCAN] Platform identified: ${platform.name}`);
        this.addLog('[READY] Awaiting capture command...');

        this.isVisible = true;

        // Trigger entrance animation
        setTimeout(() => {
            this.overlay.classList.add('visible');
        }, 10);
    },

    /**
     * Hide overlay
     */
    hide() {
        if (!this.isVisible || this.isCapturing) return;

        this.overlay.classList.remove('visible');

        setTimeout(() => {
            if (this.progressAnimation) {
                this.progressAnimation.stop();
            }
            this.overlay.remove();
            this.isVisible = false;
        }, 300);
    },

    /**
   * Get overlay HTML template
   * @param {Object} platform - Platform configuration
   * @returns {string} HTML template
   */
    getTemplate(platform) {
        return `
      <div class="import-overlay-backdrop"></div>
      <div class="import-overlay-panel">
        <div class="panel-header">
          <div class="header-content">
            <div class="header-logo">
              <img src="${chrome.runtime.getURL('assets/logo.png')}" alt="KripTik AI" />
            </div>
            <div class="header-text">
              <h2 class="panel-title">PROJECT IMPORT ASSISTANT</h2>
              <div class="panel-subtitle">${platform.name} • Context Capture System</div>
            </div>
          </div>
          <button class="close-btn" aria-label="Close">×</button>
        </div>

        <div class="panel-body">
          <div class="status-indicator">
            <div class="status-dot"></div>
            <span class="status-text">Ready to capture</span>
          </div>

          <div class="animation-container">
            <!-- Canvas will be inserted here -->
          </div>

          <div class="phase-display">
            <div class="phase-name">STANDBY</div>
            <div class="phase-message">Awaiting capture initialization...</div>
          </div>

          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value" id="stat-messages">--</span>
              <span class="stat-label">Messages</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-errors">--</span>
              <span class="stat-label">Errors</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-files">--</span>
              <span class="stat-label">Files</span>
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn btn-primary" id="btn-capture">
              <span class="btn-icon">▶</span>
              <span class="btn-text">START CAPTURE</span>
            </button>
            <button class="btn btn-secondary" id="btn-export" disabled>
              <span class="btn-icon">↓</span>
              <span class="btn-text">EXPORT</span>
            </button>
          </div>

          <div class="progress-log">
            <div class="log-header">
              <span class="log-indicator"></span>
              SYSTEM LOG
            </div>
            <div class="log-content" id="log-content"></div>
          </div>
        </div>

        <div class="panel-footer">
          <div class="footer-text">
            Powered by <strong>KripTik AI</strong> • Secure Local Processing
          </div>
        </div>
      </div>
    `;
    },

    /**
     * Bind event listeners
     * @param {Object} platform - Platform configuration
     */
    bindEvents(platform) {
        // Close button
        this.overlay.querySelector('.close-btn').addEventListener('click', () => {
            this.hide();
        });

        // Backdrop click (only if not capturing)
        this.overlay.querySelector('.import-overlay-backdrop').addEventListener('click', () => {
            if (!this.isCapturing) this.hide();
        });

        // Start capture button - uses vision capture by default
        this.overlay.querySelector('#btn-capture').addEventListener('click', () => {
            this.startCapture(platform);
        });

        // Export button
        this.overlay.querySelector('#btn-export').addEventListener('click', () => {
            this.triggerExport(platform);
        });
    },

    /**
     * Start the capture process
     * Uses AI-powered vision capture exclusively for best results across all platforms
     * @param {Object} platform - Platform configuration
     */
    async startCapture(platform) {
        if (this.isCapturing) return;
        this.isCapturing = true;

        const captureBtn = this.overlay.querySelector('#btn-capture');
        captureBtn.disabled = true;
        captureBtn.querySelector('.btn-text').textContent = 'CAPTURING...';

        this.updateStatus('capturing', 'Capture in progress');

        // Always use vision capture - it's the only capture method
        await this.startVisionCapture(platform);
    },

    /**
     * Run a capture phase
     * @param {string} phaseId - Phase ID
     * @param {function} callback - Phase callback function
     * @returns {Promise<*>} Phase result
     */
    async runPhase(phaseId, callback) {
        const phase = CapturePhases.getPhase(phaseId);
        if (!phase) return;

        this.currentPhase = phaseId;
        this.progressAnimation.setPhase(phaseId);

        // Update UI
        this.overlay.querySelector('.phase-name').textContent = phase.name;
        this.overlay.querySelector('.phase-message').textContent = CapturePhases.getRandomMessage(phaseId);

        this.addLog(`[${phase.name}] ${phase.messages[0]}`);

        // Progress updater
        const updateProgress = (progress) => {
            const overallProgress = CapturePhases.getProgressForPhase(phaseId, progress);
            this.progressAnimation.setProgress(overallProgress);
        };

        // Run the phase
        const result = await callback(updateProgress);

        // Complete phase
        const overallProgress = CapturePhases.getProgressForPhase(phaseId, 100);
        this.progressAnimation.setProgress(overallProgress);

        return result;
    },

    /**
     * Trigger platform export
     * @param {Object} platform - Platform configuration
     */
    async triggerExport(platform) {
        if (!this.capturedData) return;

        this.addLog('[EXPORT] Preparing export handler...');

        try {
            // Get appropriate export handler (KripTik API)
            const ExportHandler = this.getExportHandler(platform);
            const handler = new ExportHandler(platform);

            // Set captured data
            handler.setCapturedData(this.capturedData);

            this.addLog(`[EXPORT] Sending captured data to KripTik AI...`);

            // Execute export to KripTik
            const success = await handler.export();

            if (success) {
                this.addLog('[SUCCESS] Data sent to KripTik AI successfully');
                this.updateStatus('exported', 'Export complete');

                // Also trigger ZIP download for platforms that support it
                await this.triggerZipDownload(platform);
            } else {
                this.addLog('[ERROR] Failed to send data to KripTik');
                // Still try to get the ZIP file
                await this.triggerZipDownload(platform);
            }
        } catch (error) {
            console.error('[Overlay] Export error:', error);
            this.addLog(`[ERROR] Export failed: ${error.message}`);
            // Still try to get the ZIP file even if API export fails
            await this.triggerZipDownload(platform);
        }
    },

    /**
     * Get export handler class for platform
     * Always uses KripTik API handler as primary method for direct import
     * @param {Object} platform - Platform configuration
     * @returns {class} Export handler class
     */
    getExportHandler(platform) {
        // Always try KripTik API first for direct import to Fix My App
        // This sends all captured data directly to KripTik's /api/extension/import
        if (typeof KripTikAPIHandler !== 'undefined') {
            return KripTikAPIHandler;
        }

        // Fallback to platform-specific handlers
        switch (platform.exportMechanism) {
            case 'zip-download':
                return DownloadZipHandler;
            case 'copy-code':
                return CopyCodeHandler;
            case 'github-export':
                return GitHubExportHandler;
            case 'api':
                return APIExportHandler;
            default:
                return DownloadZipHandler;
        }
    },

    /**
     * Trigger ZIP download for platforms that support it (Bolt, Lovable, etc.)
     * @param {Object} platform - Platform configuration
     */
    async triggerZipDownload(platform) {
        if (platform.exportMechanism !== 'zip-download' && platform.exportMechanism !== 'download-zip') {
            return;
        }

        this.addLog('[ZIP] Looking for export button to download project files...');

        try {
            // Look for export/download button
            const exportSelectors = [
                'button[aria-label*="export" i]',
                'button[aria-label*="download" i]',
                '[class*="export"] button',
                '[class*="download"] button',
                '[data-testid*="export"]',
                '[data-testid*="download"]'
            ];

            let exportBtn = null;

            // First try specific selectors
            for (const selector of exportSelectors) {
                try {
                    const el = document.querySelector(selector);
                    if (el && this.isElementVisible(el)) {
                        exportBtn = el;
                        break;
                    }
                } catch (e) {}
            }

            // If not found, search buttons by text
            if (!exportBtn) {
                const buttons = document.querySelectorAll('button, [role="button"], [role="menuitem"]');
                for (const el of buttons) {
                    const text = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
                    if ((text.includes('export') || text.includes('download')) && this.isElementVisible(el)) {
                        exportBtn = el;
                        break;
                    }
                }
            }

            if (exportBtn) {
                this.addLog('[ZIP] Found export button, triggering download...');
                exportBtn.click();
                await this.wait(1000);
                this.addLog('[ZIP] Download triggered - check your browser downloads');
            } else {
                this.addLog('[ZIP] Export button not found automatically');
                this.addLog('[INFO] To get project files: Click the "..." menu in Bolt and select "Download"');
            }
        } catch (error) {
            this.addLog(`[ZIP] Auto-download failed: ${error.message}`);
        }
    },

    /**
     * Check if element is visible
     */
    isElementVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 &&
               style.visibility !== 'hidden' && style.display !== 'none';
    },

    /**
     * Update status indicator
     * @param {string} status - Status type
     * @param {string} text - Status text
     */
    updateStatus(status, text) {
        const statusDot = this.overlay.querySelector('.status-dot');
        const statusText = this.overlay.querySelector('.status-text');

        statusDot.className = `status-dot status-${status}`;
        statusText.textContent = text;
    },

    /**
     * Update phase message
     * @param {string} message - Message text
     */
    updatePhaseMessage(message) {
        this.overlay.querySelector('.phase-message').textContent = message;
    },

    /**
     * Update stat value
     * @param {string} statId - Stat ID (messages, errors, files)
     * @param {number} value - Stat value
     */
    updateStat(statId, value) {
        const statEl = this.overlay.querySelector(`#stat-${statId}`);
        if (statEl) {
            statEl.textContent = value;
        }
    },

    /**
     * Add log entry
     * @param {string} message - Log message
     */
    addLog(message) {
        const logContent = this.overlay.querySelector('#log-content');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = message;
        logContent.appendChild(entry);

        // Auto-scroll to bottom
        logContent.scrollTop = logContent.scrollHeight;

        // Keep only last 50 entries
        while (logContent.children.length > 50) {
            logContent.removeChild(logContent.firstChild);
        }
    },

    /**
     * Wait helper
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise} Promise that resolves after wait
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Start AI-powered capture
     * Uses ClientCapture (client-side) as primary method since Playwright isn't available on Vercel serverless
     * Falls back to VisionCapture if ClientCapture isn't available
     * @param {Object} platform - Platform configuration
     */
    async startVisionCapture(platform) {
        this.addLog('[START] Initiating AI-powered capture...');
        this.addLog('[INFO] Using Gemini 3 Flash for intelligent content extraction');

        try {
            // Try ClientCapture first (works without Playwright - ideal for serverless)
            if (typeof ClientCapture !== 'undefined') {
                this.addLog('[MODE] Using client-side capture (serverless compatible)');
                
                ClientCapture.setCallbacks({
                    onProgress: (progress) => {
                        this.updateStat('messages', progress.messagesFound);
                        this.updateStat('files', progress.filesFound);
                        this.updateStat('errors', progress.errorsFound);
                        this.addLog(`[PROGRESS] ${progress.screenshotCount} frames, ${progress.messagesFound} messages found`);
                    },
                    onComplete: (data) => {
                        this.handleVisionCaptureComplete(data, platform);
                    },
                    onError: (error) => {
                        // Try VisionCapture as fallback
                        this.addLog('[FALLBACK] Client capture failed, trying server-side...');
                        this.tryServerSideCapture(platform);
                    }
                });

                const result = await ClientCapture.start(platform);

                if (result.success) {
                    return; // Capture handled by callback
                }

                // If client capture fails immediately, try server-side
                throw new Error(result.error || 'Client capture failed');
            }

            // Fallback to VisionCapture (requires Playwright - won't work on Vercel)
            this.tryServerSideCapture(platform);

        } catch (error) {
            console.error('[Overlay] Capture error:', error);
            this.addLog(`[ERROR] Capture failed: ${error.message}`);
            this.updateStatus('error', 'Capture failed');

            const captureBtn = this.overlay.querySelector('#btn-capture');
            captureBtn.disabled = false;
            captureBtn.querySelector('.btn-text').textContent = 'RETRY';

            this.isCapturing = false;
        }
    },

    /**
     * Try server-side capture using VisionCapture (requires Playwright)
     * This is a fallback for when client-side capture fails
     * @param {Object} platform - Platform configuration
     */
    async tryServerSideCapture(platform) {
        if (typeof VisionCapture !== 'undefined') {
            this.addLog('[MODE] Using server-side capture (Playwright)');
            
            VisionCapture.setCallbacks({
                onProgress: (session) => {
                    this.updateStat('messages', session.progress?.messagesFound || 0);
                    this.updateStat('files', session.progress?.filesFound || 0);
                    this.updateStat('errors', session.progress?.errorsFound || 0);
                },
                onComplete: (data) => {
                    this.handleVisionCaptureComplete(data, platform);
                },
                onError: (error) => {
                    this.handleVisionCaptureError(error, platform);
                }
            });

            const result = await VisionCapture.start(window.location.href, {
                captureScreenshots: true,
                maxScrollAttempts: 50,
                maxApiCalls: 100
            });

            if (!result.success) {
                throw new Error(result.error || 'Server-side capture failed');
            }

            this.addLog(`[SESSION] Capture started: ${result.sessionId}`);
            this.updatePhaseMessage('Server is analyzing the page...');
        } else {
            throw new Error('No capture modules available');
        }
    },

    /**
     * Handle capture completion
     * @param {Object} data - Capture result data
     * @param {Object} platform - Platform configuration
     */
    async handleVisionCaptureComplete(data, platform) {
        this.addLog('[DONE] Capture complete!');

        const result = data.result;
        if (result) {
            this.addLog(`[STATS] Messages: ${result.chatMessageCount || 0}`);
            this.addLog(`[STATS] Files: ${result.fileCount || 0}`);
            this.addLog(`[STATS] Errors: ${result.errorCount || 0}`);
            this.addLog(`[STATS] API Cost: $${(result.captureStats?.estimatedCost || 0).toFixed(4)}`);
        }

        // Update UI
        this.updateStatus('complete', 'Capture complete!');

        const captureBtn = this.overlay.querySelector('#btn-capture');
        captureBtn.querySelector('.btn-text').textContent = 'CAPTURE COMPLETE';

        const exportBtn = this.overlay.querySelector('#btn-export');
        exportBtn.disabled = false;
        exportBtn.classList.add('ready');

        // Store the session ID so we can get results later if needed
        this.visionSessionId = data.session?.id;

        // The server auto-imports the results, so we just need to notify the user
        this.addLog('[SUCCESS] Data automatically sent to KripTik AI!');
        this.addLog('[INFO] Check your KripTik dashboard for the imported project');

        this.isCapturing = false;
    },

    /**
     * Handle capture error
     * @param {Object} error - Error object
     * @param {Object} platform - Platform configuration
     */
    async handleVisionCaptureError(error, platform) {
        this.addLog(`[ERROR] Capture failed: ${error.message}`);
        this.addLog('[INFO] Click retry to try again');

        this.updateStatus('error', 'Capture failed');

        const captureBtn = this.overlay.querySelector('#btn-capture');
        captureBtn.disabled = false;
        captureBtn.querySelector('.btn-text').textContent = 'RETRY';

        this.isCapturing = false;
    }
};

window.Overlay = Overlay;
