// Platform Detector - Refactored to use Platform Registry
// This module detects the current platform and provides helper methods

const PlatformDetector = {
    currentPlatform: null,

    /**
     * Initialize platform detection
     * @returns {Object|null} Detected platform or null
     */
    init() {
        this.currentPlatform = PlatformRegistry.detectCurrentPlatform();

        if (this.currentPlatform) {
            console.log(`[KripTik AI Importer] Detected platform: ${this.currentPlatform.name}`);
            window.currentPlatform = this.currentPlatform; // For global access
        } else {
            console.log('[KripTik AI Importer] No supported platform detected');
        }

        return this.currentPlatform;
    },

    /**
     * Get currently detected platform
     * @returns {Object|null} Current platform config
     */
    getPlatform() {
        return this.currentPlatform || window.currentPlatform;
    },

    /**
     * Check if current platform is supported
     * @returns {boolean} True if platform is supported
     */
    isSupported() {
        return this.getPlatform() !== null;
    },

    /**
     * Get selector for current platform
     * @ param {string} selectorName - Name of selector
     * @returns {string|null} Selector string
     */
    getSelector(selectorName) {
        const platform = this.getPlatform();
        return platform ? PlatformRegistry.getSelector(platform, selectorName) : null;
    },

    /**
     * Find element on current platform
     * @param {string} selectorName - Name of selector
     * @returns {Element|null} Found element
     */
    findElement(selectorName) {
        const platform = this.getPlatform();
        return platform ? PlatformRegistry.findElement(platform, selectorName) : null;
    },

    /**
     * Find elements on current platform
     * @param {string} selectorName - Name of selector
     * @returns {NodeList} NodeList of elements
     */
    findElements(selectorName) {
        const platform = this.getPlatform();
        return platform ? PlatformRegistry.findElements(platform, selectorName) : document.querySelectorAll('');
    },

    /**
     * Check if current platform has a feature
     * @param {string} feature - Feature name
     * @returns {boolean} True if feature is supported
     */
    hasFeature(feature) {
        const platform = this.getPlatform();
        return platform ? PlatformRegistry.hasFeature(platform, feature) : false;
    },

    /**
     * Get export mechanism for current platform
     * @returns {string} Export mechanism type
     */
    getExportMechanism() {
        const platform = this.getPlatform();
        return platform ? PlatformRegistry.getExportMechanism(platform) : 'unknown';
    },

    /**
     * Wait for an element to appear
     * @param {string} selectorName - Name of selector
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<Element|null>} Promise that resolves with element
     */
    async waitForElement(selectorName, timeout = 10000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const element = this.findElement(selectorName);
            if (element) return element;
            await this.wait(100);
        }

        return null;
    },

    /**
     * Helper: wait for specified time
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise} Promise that resolves after wait
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Observe DOM changes for an element
     * @param {string} selectorName - Name of selector
     * @param {function} callback - Callback when element appears
     * @returns {MutationObserver} Observer instance
     */
    observe(selectorName, callback) {
        const observer = new MutationObserver(() => {
            const element = this.findElement(selectorName);
            if (element) {
                callback(element);
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    }
};

// Make available globally
window.PlatformDetector = PlatformDetector;
