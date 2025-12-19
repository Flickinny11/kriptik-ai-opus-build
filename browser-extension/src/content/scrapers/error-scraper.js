// Error and Console Scraper
// Captures errors and console logs from the page
// Adapted to work with platform registry system

const ErrorScraper = {
    capturedErrors: [],
    capturedConsoleLogs: [],
    originalConsole: {},
    isInitialized: false,

    /**
     * Initialize error scraper
     */
    init() {
        if (this.isInitialized) return;

        this.interceptConsole();
        this.watchForErrors();
        this.isInitialized = true;
    },

    /**
     * Intercept console methods
     */
    interceptConsole() {
        // Store original methods
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
        };

        // Intercept console methods
        const self = this;

        console.error = function (...args) {
            self.capturedConsoleLogs.push({
                type: 'error',
                timestamp: new Date().toISOString(),
                message: args.map(a => self.stringify(a)).join(' '),
                stack: new Error().stack
            });
            self.originalConsole.error.apply(console, args);
        };

        console.warn = function (...args) {
            self.capturedConsoleLogs.push({
                type: 'warn',
                timestamp: new Date().toISOString(),
                message: args.map(a => self.stringify(a)).join(' ')
            });
            self.originalConsole.warn.apply(console, args);
        };

        console.log = function (...args) {
            // Only capture if it looks like an error or important
            const message = args.map(a => self.stringify(a)).join(' ');
            if (self.isSignificantLog(message)) {
                self.capturedConsoleLogs.push({
                    type: 'log',
                    timestamp: new Date().toISOString(),
                    message: message
                });
            }
            self.originalConsole.log.apply(console, args);
        };
    },

    /**
     * Check if log message is significant
     * @param {string} message - Log message
     * @returns {boolean} True if significant
     */
    isSignificantLog(message) {
        const patterns = [
            /error/i,
            /fail/i,
            /exception/i,
            /warning/i,
            /undefined/i,
            /null/i,
            /cannot/i,
            /unable/i,
            /invalid/i,
            /missing/i
        ];
        return patterns.some(p => p.test(message));
    },

    /**
     * Stringify object for logging
     * @param {*} obj - Object to stringify
     * @returns {string} Stringified object
     */
    stringify(obj) {
        if (typeof obj === 'string') return obj;
        if (obj instanceof Error) {
            return `${obj.name}: ${obj.message}\n${obj.stack}`;
        }
        try {
            return JSON.stringify(obj, null, 2);
        } catch {
            return String(obj);
        }
    },

    /**
     * Watch for global errors
     */
    watchForErrors() {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.capturedErrors.push({
                type: 'runtime',
                timestamp: new Date().toISOString(),
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.capturedErrors.push({
                type: 'promise',
                timestamp: new Date().toISOString(),
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack
            });
        });
    },

    /**
     * Scrape visible errors from UI
     * @param {Object} platform - Platform configuration
     * @returns {Array} UI errors
     */
    scrapeVisibleErrors(platform) {
        const errors = [];

        // Look for error panels in the UI
        const errorPanel = PlatformDetector.findElement('errorPanel');
        if (errorPanel && DOMHelpers.isVisible(errorPanel)) {
            const errorText = errorPanel.textContent;
            if (errorText && errorText.trim()) {
                errors.push({
                    type: 'ui',
                    timestamp: new Date().toISOString(),
                    message: errorText.trim(),
                    source: 'error-panel'
                });
            }
        }

        // Look for error toasts or notifications
        const toastSelectors = [
            '[class*="toast"][class*="error"]',
            '[class*="notification"][class*="error"]',
            '[class*="alert"][class*="error"]',
            '[role="alert"]'
        ];

        toastSelectors.forEach(selector => {
            const toasts = document.querySelectorAll(selector);
            toasts.forEach(toast => {
                const text = toast.textContent.trim();
                if (text) {
                    errors.push({
                        type: 'toast',
                        timestamp: new Date().toISOString(),
                        message: text,
                        source: 'ui-toast'
                    });
                }
            });
        });

        // Try to access preview iframe errors
        const previewFrame = PlatformDetector.findElement('previewFrame');
        if (previewFrame) {
            try {
                const frameErrors = this.scrapeIframeErrors(previewFrame);
                errors.push(...frameErrors);
            } catch (e) {
                // Cross-origin restriction, can't access iframe
            }
        }

        return errors;
    },

    /**
     * Scrape errors from iframe
     * @param {Element} iframe - Iframe element
     * @returns {Array} Iframe errors
     */
    scrapeIframeErrors(iframe) {
        const errors = [];
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

            // Look for React error boundaries
            const errorBoundarySelectors = [
                '[class*="error-boundary"]',
                '[class*="ErrorBoundary"]',
                '#__next-error'
            ];

            errorBoundarySelectors.forEach(selector => {
                const errorBoundary = iframeDoc.querySelector(selector);
                if (errorBoundary) {
                    errors.push({
                        type: 'react-error',
                        timestamp: new Date().toISOString(),
                        message: errorBoundary.textContent.trim(),
                        source: 'preview-iframe'
                    });
                }
            });
        } catch (e) {
            // Cross-origin, ignore
        }
        return errors;
    },

    /**
     * Get all captured errors and console logs
     * @param {Object} platform - Platform configuration
     * @returns {Object} All errors and logs
     */
    getAll(platform) {
        const visibleErrors = platform ? this.scrapeVisibleErrors(platform) : [];

        return {
            errors: [
                ...this.capturedErrors,
                ...visibleErrors
            ],
            consoleLogs: this.capturedConsoleLogs.slice(-500) // Last 500 logs
        };
    },

    /**
     * Clear captured data
     */
    clear() {
        this.capturedErrors = [];
        this.capturedConsoleLogs = [];
    }
};

// Initialize immediately
ErrorScraper.init();
window.ErrorScraper = ErrorScraper;
