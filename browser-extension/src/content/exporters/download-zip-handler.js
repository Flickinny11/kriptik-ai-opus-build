// Download ZIP Handler
// Handles platforms that export via ZIP download (Bolt, Lovable, Replit, Marblism)

class DownloadZipHandler extends ExportHandlerBase {
    constructor(platform) {
        super(platform);
        this.exportButton = null;
        this.downloadStarted = false;
    }

    /**
     * Trigger ZIP export
     * @returns {Promise<boolean>} Success status
     */
    async export() {
        this.log('Starting ZIP export...');

        if (!this.validateData()) {
            return false;
        }

        try {
            // Store metadata in chrome.storage for service worker to access
            await this.storeMetadataForServiceWorker();

            // Find and click the export button
            await this.triggerPlatformExport();

            this.log('Export triggered successfully');
            return true;

        } catch (error) {
            return this.handleError(error, 'during ZIP export');
        }
    }

    /**
     * Store metadata for background service worker to inject into ZIP
     * @returns {Promise<void>}
     */
    async storeMetadataForServiceWorker() {
        const metadata = this.prepareMetadata();

        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'STORE_CAPTURED_DATA',
                data: metadata
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    this.log('Metadata stored for service worker');
                    resolve();
                } else {
                    reject(new Error('Failed to store metadata'));
                }
            });
        });
    }

    /**
     * Find and trigger the platform's export button
     * @returns {Promise<void>}
     */
    async triggerPlatformExport() {
        // Find export button
        this.exportButton = PlatformDetector.findElement('exportButton');

        if (!this.exportButton) {
            throw new Error('Export button not found');
        }

        if (!DOMHelpers.isVisible(this.exportButton)) {
            throw new Error('Export button is not visible');
        }

        this.log('Found export button, clicking...');

        // Click the button
        this.exportButton.click();

        // Wait a bit for download to start
        await this.wait(1000);

        // Set flag that download was triggered
        this.downloadStarted = true;
    }

    /**
     * Check if download has started
     * @returns {boolean} True if download started
     */
    hasDownloadStarted() {
        return this.downloadStarted;
    }
}

// Make available globally
window.DownloadZipHandler = DownloadZipHandler;
