// DOM Helper Utilities

const DOMHelpers = {
    /**
     * Find scrollable parent of an element
     * @param {Element} element - Element to start from
     * @returns {Element|null} Scrollable parent or null
     */
    findScrollableParent(element) {
        let current = element;
        while (current) {
            const style = window.getComputedStyle(current);
            const overflowY = style.getPropertyValue('overflow-y');
            const overflowX = style.getPropertyValue('overflow-x');

            if (overflowY === 'auto' || overflowY === 'scroll' ||
                overflowX === 'auto' || overflowX === 'scroll') {
                return current;
            }
            current = current.parentElement;
        }
        return document.documentElement;
    },

    /**
     * Scroll element into view smoothly
     * @param {Element} element - Element to scroll to
     */
    scrollIntoView(element) {
        if (element && typeof element.scrollIntoView === 'function') {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    /**
     * Get all text content from element, preserving code blocks
     * @param {Element} element - Element to extract text from
     * @returns {string} Extracted text
     */
    extractTextWithCode(element) {
        let result = '';

        const walk = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                result += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();

                if (tagName === 'pre' || tagName === 'code') {
                    result += '\n```\n' + node.textContent + '\n```\n';
                } else if (tagName === 'br') {
                    result += '\n';
                } else if (tagName === ' p' || tagName === 'div') {
                    node.childNodes.forEach(walk);
                    result += '\n';
                } else {
                    node.childNodes.forEach(walk);
                }
            }
        };

        walk(element);
        return result.trim();
    },

    /**
     * Check if element is visible
     * @param {Element} element - Element to check
     * @returns {boolean} True if visible
     */
    isVisible(element) {
        if (!element) return false;
        return element.offsetParent !== null &&
            window.getComputedStyle(element).display !== 'none' &&
            window.getComputedStyle(element).visibility !== 'hidden';
    },

    /**
     * Wait for condition to be true
     * @param {function} condition - Function that returns boolean
     * @param {number} timeout - Timeout in ms
     * @param {number} interval - Check interval in ms
     * @returns {Promise<boolean>} Resolves to true if condition met
     */
    async waitForCondition(condition, timeout = 10000, interval = 100) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            if (condition()) return true;
            await this.wait(interval);
        }

        return false;
    },

    /**
     * Simple wait helper
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise} Promise that resolves after wait
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Get element's depth in DOM tree
     * @param {Element} element - Element to check
     * @returns {number} Depth in tree
     */
    getDepth(element) {
        let depth = 0;
        let current = element;
        while (current && current !== document.body) {
            depth++;
            current = current.parentElement;
        }
        return depth;
    },

    /**
     * Generate stable hash from string
     * @param {string} str - String to hash
     * @returns {number} Hash value
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
};

window.DOMHelpers = DOMHelpers;
