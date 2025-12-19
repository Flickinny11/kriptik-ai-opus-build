/**
 * KripTik API Export Handler
 * Sends captured project data directly to KripTik AI API
 * This bypasses the ZIP injection approach and sends data directly
 */

class KripTikAPIHandler extends ExportHandlerBase {
    constructor(platform) {
        super(platform);
        this.kriptikApiEndpoint = null;
        this.kriptikToken = null;
    }

    /**
     * Export directly to KripTik AI API
     * @returns {Promise<boolean>} Success status
     */
    async export() {
        this.log('Starting KripTik AI direct export...');

        if (!this.validateData()) {
            return false;
        }

        try {
            // Get KripTik configuration from storage
            await this.loadKripTikConfig();

            if (!this.kriptikApiEndpoint || !this.kriptikToken) {
                this.log('KripTik not configured. Please set API endpoint and token in extension settings.', 'error');
                return await this.showConfigurationNeeded();
            }

            // Prepare the full payload for KripTik
            const payload = await this.prepareKripTikPayload();

            // Send to KripTik API
            const result = await this.sendToKripTik(payload);

            if (result.success) {
                await this.showSuccessNotification(result);
                return true;
            } else {
                this.log(`KripTik API error: ${result.error}`, 'error');
                return false;
            }

        } catch (error) {
            return this.handleError(error, 'during KripTik API export');
        }
    }

    /**
     * Load KripTik configuration from chrome.storage
     * Checks both popup-saved keys (apiEndpoint/apiToken) and
     * Fix My App session keys for backwards compatibility
     */
    async loadKripTikConfig() {
        return new Promise((resolve) => {
            // Check popup keys first, then session keys, then legacy keys
            chrome.storage.sync.get(['apiEndpoint', 'apiToken', 'kriptikApiEndpoint', 'kriptikToken'], (syncResult) => {
                // Also check local storage for Fix My App session
                chrome.storage.local.get(['fixMyAppSession'], (localResult) => {
                    const session = localResult.fixMyAppSession;

                    // Priority: popup keys > session keys > legacy keys
                    this.kriptikApiEndpoint = syncResult.apiEndpoint ||
                                              session?.apiEndpoint ||
                                              syncResult.kriptikApiEndpoint;

                    this.kriptikToken = syncResult.apiToken ||
                                        session?.token ||
                                        syncResult.kriptikToken;

                    // Log what we found for debugging
                    if (this.kriptikApiEndpoint) {
                        this.log(`KripTik endpoint configured: ${this.kriptikApiEndpoint}`);
                    } else {
                        this.log(`[ERROR] No KripTik endpoint found in storage!`);
                        this.log(`[DEBUG] sync.apiEndpoint: ${syncResult.apiEndpoint || 'not set'}`);
                        this.log(`[DEBUG] session.apiEndpoint: ${session?.apiEndpoint || 'not set'}`);
                    }

                    if (this.kriptikToken) {
                        this.log(`KripTik token configured: ${this.kriptikToken.substring(0, 20)}...`);
                    } else {
                        this.log(`[ERROR] No KripTik token found in storage!`);
                        this.log(`[DEBUG] sync.apiToken: ${syncResult.apiToken ? 'set' : 'not set'}`);
                        this.log(`[DEBUG] session.token: ${session?.token ? 'set' : 'not set'}`);
                    }

                    resolve();
                });
            });
        });
    }

    /**
     * Prepare payload matching KripTik's ExtensionImportPayload format
     */
    async prepareKripTikPayload() {
        const metadata = this.prepareMetadata();

        // Transform to KripTik's expected format
        const payload = {
            platform: {
                id: this.platform.id,
                name: this.platform.name,
                provider: this.platform.provider || this.platform.id,
                version: this.platform.version || '1.0',
                tier: this.platform.tier || 'standard'
            },
            project: {
                id: metadata.project?.id || this.generateProjectId(),
                name: metadata.project?.name || `Import from ${this.platform.name}`,
                url: window.location.href
            },
            chatHistory: this.formatChatHistory(metadata.chatHistory),
            files: this.formatFileTree(metadata.fileTree),
            errors: this.formatErrors(metadata.errors),
            console: this.formatConsoleLogs(metadata.consoleLogs),
            terminal: this.formatTerminal(metadata.terminal),
            artifacts: this.formatArtifacts(metadata.artifacts),
            diffs: this.formatDiffs(metadata.diffs),
            captureStats: {
                duration: metadata.captureStats?.duration || 0,
                completeness: this.calculateCompleteness(metadata),
                features: this.getEnabledFeatures(metadata)
            }
        };

        // If we have a ZIP file, encode it as base64
        if (metadata.zipData) {
            payload.zipFileBase64 = await this.blobToBase64(metadata.zipData);
        }

        this.log(`Prepared payload with ${payload.chatHistory?.messages?.length || 0} chat messages`);
        return payload;
    }

    /**
     * Format chat history to KripTik's expected format
     */
    formatChatHistory(chatHistory) {
        if (!chatHistory || !Array.isArray(chatHistory)) {
            return { messageCount: 0, messages: [] };
        }

        const messages = chatHistory.map((msg, index) => ({
            id: msg.id || `msg-${index}`,
            role: this.normalizeRole(msg.role),
            content: msg.content || '',
            timestamp: msg.timestamp || new Date().toISOString(),
            codeBlocks: msg.codeBlocks || [],
            artifacts: msg.artifacts || []
        }));

        return {
            messageCount: messages.length,
            messages
        };
    }

    /**
     * Normalize role names across platforms
     */
    normalizeRole(role) {
        const roleMap = {
            'human': 'user',
            'ai': 'assistant',
            'bot': 'assistant',
            'model': 'assistant',
            'system': 'system'
        };
        return roleMap[role?.toLowerCase()] || role || 'user';
    }

    /**
     * Format file tree to KripTik's expected format
     */
    formatFileTree(fileTree) {
        if (!fileTree) {
            return null;
        }

        return {
            structure: fileTree.structure || {},
            stats: {
                totalFiles: fileTree.stats?.totalFiles || 0,
                totalFolders: fileTree.stats?.totalFolders || 0,
                fileTypes: fileTree.stats?.fileTypes || {}
            },
            files: fileTree.files || []
        };
    }

    /**
     * Format errors to KripTik's expected format
     */
    formatErrors(errors) {
        if (!errors || !Array.isArray(errors)) {
            return { count: 0, entries: [] };
        }

        const entries = errors.map(err => ({
            type: err.type || 'runtime',
            severity: this.normalizeSeverity(err.severity),
            timestamp: err.timestamp || new Date().toISOString(),
            message: err.message || '',
            stack: err.stack || '',
            source: err.source || 'unknown'
        }));

        return {
            count: entries.length,
            entries
        };
    }

    /**
     * Normalize severity levels
     */
    normalizeSeverity(severity) {
        const map = { 'high': 'error', 'medium': 'warning', 'low': 'info' };
        return map[severity?.toLowerCase()] || severity || 'error';
    }

    /**
     * Format console logs
     */
    formatConsoleLogs(logs) {
        if (!logs || !Array.isArray(logs)) {
            return { count: 0, entries: [] };
        }

        const entries = logs.map(log => ({
            type: log.type || 'log',
            timestamp: log.timestamp || new Date().toISOString(),
            content: typeof log.message === 'string' ? log.message : JSON.stringify(log.message)
        }));

        return {
            count: entries.length,
            entries
        };
    }

    /**
     * Format terminal output
     */
    formatTerminal(terminal) {
        if (!terminal) {
            return { available: false, output: [] };
        }

        return {
            available: true,
            output: (terminal.output || []).map(entry => ({
                type: entry.type || 'output',
                content: entry.content || ''
            }))
        };
    }

    /**
     * Format artifacts
     */
    formatArtifacts(artifacts) {
        if (!artifacts || !Array.isArray(artifacts)) {
            return { available: false, items: [] };
        }

        return {
            available: artifacts.length > 0,
            items: artifacts.map(art => ({
                id: art.id || this.generateId(),
                type: art.type || 'code',
                title: art.title || '',
                content: art.content || '',
                language: art.language || 'plaintext'
            }))
        };
    }

    /**
     * Format diffs
     */
    formatDiffs(diffs) {
        if (!diffs || !Array.isArray(diffs)) {
            return { available: false, changes: [] };
        }

        return {
            available: diffs.length > 0,
            changes: diffs.map(diff => ({
                file: diff.file || '',
                type: diff.type || 'modify',
                hunks: diff.hunks || []
            }))
        };
    }

    /**
     * Calculate completeness percentage
     */
    calculateCompleteness(metadata) {
        let score = 0;
        let total = 0;

        // Chat history (40% weight)
        total += 40;
        if (metadata.chatHistory && metadata.chatHistory.length > 0) {
            score += 40;
        }

        // Errors captured (20% weight)
        total += 20;
        if (metadata.errors && metadata.errors.length > 0) {
            score += 20;
        }

        // Console logs (15% weight)
        total += 15;
        if (metadata.consoleLogs && metadata.consoleLogs.length > 0) {
            score += 15;
        }

        // File tree (15% weight)
        total += 15;
        if (metadata.fileTree) {
            score += 15;
        }

        // Artifacts/Diffs (10% weight)
        total += 10;
        if (metadata.artifacts || metadata.diffs) {
            score += 10;
        }

        return Math.round((score / total) * 100);
    }

    /**
     * Get list of enabled features
     */
    getEnabledFeatures(metadata) {
        const features = [];
        if (metadata.chatHistory?.length > 0) features.push('chatCapture');
        if (metadata.errors?.length > 0) features.push('errorCapture');
        if (metadata.consoleLogs?.length > 0) features.push('consoleCapture');
        if (metadata.fileTree) features.push('fileTreeCapture');
        if (metadata.terminal) features.push('terminalCapture');
        if (metadata.artifacts?.length > 0) features.push('artifactCapture');
        if (metadata.diffs?.length > 0) features.push('diffCapture');
        return features;
    }

    /**
     * Send payload to KripTik API via background script (avoids CORS)
     */
    async sendToKripTik(payload) {
        this.log('Sending to KripTik API via background script...');

        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'SEND_TO_KRIPTIK_API',
                endpoint: this.kriptikApiEndpoint,
                token: this.kriptikToken,
                payload: payload
            }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({
                        success: false,
                        error: chrome.runtime.lastError.message
                    });
                } else {
                    resolve(response || { success: false, error: 'No response from background' });
                }
            });
        });
    }

    /**
     * Show success notification with link to KripTik
     */
    async showSuccessNotification(result) {
        this.log(`Project created: ${result.projectName}`);
        this.log(`Dashboard: ${result.dashboardUrl}`);

        // Update overlay with success message
        if (window.Overlay && window.Overlay.isVisible) {
            window.Overlay.addLog('[SUCCESS] Project sent to KripTik AI!');
            window.Overlay.addLog(`[STATS] ${result.stats?.files || 0} files, ${result.stats?.chatMessages || 0} messages`);
            window.Overlay.addLog(`[LINK] Opening KripTik dashboard...`);
            window.Overlay.updateStatus('exported', 'Sent to KripTik AI');
        }

        // Open KripTik in new tab after short delay
        setTimeout(() => {
            if (result.builderUrl) {
                window.open(result.builderUrl, '_blank');
            } else if (result.dashboardUrl) {
                window.open(result.dashboardUrl, '_blank');
            }
        }, 1500);
    }

    /**
     * Show configuration needed message
     */
    async showConfigurationNeeded() {
        if (window.Overlay && window.Overlay.isVisible) {
            window.Overlay.addLog('[ERROR] KripTik not configured');
            window.Overlay.addLog('[INFO] Please click the extension icon and set:');
            window.Overlay.addLog('[INFO] 1. API Endpoint (your KripTik URL)');
            window.Overlay.addLog('[INFO] 2. Extension Token (from KripTik settings)');
            window.Overlay.updateStatus('error', 'Configuration needed');
        }
        return false;
    }

    /**
     * Convert Blob to base64
     */
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Generate unique project ID
     */
    generateProjectId() {
        return `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Make available globally
window.KripTikAPIHandler = KripTikAPIHandler;
