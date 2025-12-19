// Console Capture
// Additional console monitoring and capture capabilities
// Complements the error scraper

const ConsoleCapture = {
    captureBuffer: [],
    isMonitoring: false,
    maxBufferSize: 1000,

    /**
     * Start monitoring console
     */
    start() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        this.captureBuffer = [];
    },

    /**
     * Stop monitoring console
     */
    stop() {
        this.isMonitoring = false;
    },

    /**
     * Add entry to capture buffer
     * @param {string} type - Log type
     * @param {Array} args - Console arguments
     */
    addEntry(type, args) {
        if (!this.isMonitoring) return;

        const entry = {
            type: type,
            timestamp: new Date().toISOString(),
            message: args.map(arg => this.formatArg(arg)).join(' '),
            args: args.map(arg => {
                try {
                    return JSON.parse(JSON.stringify(arg));
                } catch {
                    return String(arg);
                }
            })
        };

        this.captureBuffer.push(entry);

        // Trim buffer if needed
        if (this.captureBuffer.length > this.maxBufferSize) {
            this.captureBuffer.shift();
        }
    },

    /**
     * Format console argument
     * @param {*} arg - Argument to format
     * @returns {string} Formatted string
     */
    formatArg(arg) {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'string') return arg;
        if (typeof arg === 'number') return String(arg);
        if (typeof arg === 'boolean') return String(arg);
        if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}`;
        }
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            } catch {
                return '[Object]';
            }
        }
        return String(arg);
    },

    /**
     * Get captured console logs
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Console log entries
     */
    getLogs(limit = null) {
        if (limit) {
            return this.captureBuffer.slice(-limit);
        }
        return [...this.captureBuffer];
    },

    /**
     * Clear capture buffer
     */
    clear() {
        this.captureBuffer = [];
    },

    /**
     * Filter logs by type
     * @param {string} type - Log type to filter
     * @returns {Array} Filtered logs
     */
    filterByType(type) {
        return this.captureBuffer.filter(entry => entry.type === type);
    },

    /**
     * Search logs by text
     * @param {string} searchText - Text to search for
     * @returns {Array} Matching logs
     */
    search(searchText) {
        const lowerSearch = searchText.toLowerCase();
        return this.captureBuffer.filter(entry =>
            entry.message.toLowerCase().includes(lowerSearch)
        );
    },

    /**
     * Get statistics about captured logs
     * @returns {Object} Log statistics
     */
    getStats() {
        const stats = {
            total: this.captureBuffer.length,
            byType: {}
        };

        this.captureBuffer.forEach(entry => {
            stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
        });

        return stats;
    }
};

window.ConsoleCapture = ConsoleCapture;
