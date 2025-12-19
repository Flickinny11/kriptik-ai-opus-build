// Export Handler Base Class
// Base class for all platform-specific export handlers

class ExportHandlerBase {
    constructor(platform) {
        this.platform = platform;
        this.capturedData = null;
    }

    /**
     * Set the captured data to be exported
     * @param {Object} data - Captured project data
     */
    setCapturedData(data) {
        this.capturedData = data;
    }

    /**
     * Trigger the export process
     * Must be implemented by subclasses
     * @returns {Promise<boolean>} Success status
     */
    async export() {
        throw new Error('export() must be implemented by subclass');
    }

    /**
     * Prepare metadata for export
     * @returns {Object} Metadata object
     */
    prepareMetadata() {
        if (!this.capturedData) {
            throw new Error('No captured data available');
        }

        return MetadataBuilder.build(this.platform, this.capturedData);
    }

    /**
     * Validate that we have required data
     * @returns {boolean} True if data is valid
     */
    validateData() {
        if (!this.capturedData) {
            console.error('[Export Handler] No captured data');
            return false;
        }

        if (!this.capturedData.chatHistory || this.capturedData.chatHistory.length === 0) {
            console.warn('[Export Handler] No chat history captured');
        }

        return true;
    }

    /**
     * Get export mechanism type
     * @returns {string} Export mechanism
     */
    getType() {
        return this.platform.exportMechanism;
    }

    /**
     * Log export activity
     * @param {string} message - Log message
     * @param {string} level - Log level (info, warn, error)
     */
    log(message, level = 'info') {
        const prefix = `[Export Handler: ${this.platform.name}]`;
        switch (level) {
            case 'error':
                console.error(prefix, message);
                break;
            case 'warn':
                console.warn(prefix, message);
                break;
            default:
                console.log(prefix, message);
        }
    }

    /**
     * Handle export errors
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    handleError(error, context = '') {
        this.log(`Error ${context}: ${error.message}`, 'error');
        console.error(error);
        return false;
    }

    /**
     * Wait helper
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise} Promise that resolves after wait
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Make available globally
window.ExportHandlerBase = ExportHandlerBase;
