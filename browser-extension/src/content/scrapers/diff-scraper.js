// Diff Scraper
// Captures file changes and diffs from platforms like Cursor and Copilot

const DiffScraper = {
    capturedDiffs: [],

    /**
     * Capture file changes and diffs
     * @param {Object} platform - Platform configuration
     * @param {function} onProgress - Progress callback
     * @returns {Promise<Object>} Diff data
     */
    async capture(platform, onProgress) {
        this.capturedDiffs = [];

        if (!PlatformRegistry.hasFeature(platform, 'diffTracking') &&
            !PlatformRegistry.hasFeature(platform, 'fileChanges')) {
            return { available: false, changes: [] };
        }

        onProgress({
            phase: 'diffs',
            message: 'Scanning for file changes...',
            progress: 0
        });

        try {
            // Find diff views
            const diffViews = this.findDiffViews(platform);

            if (diffViews.length === 0) {
                onProgress({
                    phase: 'diffs',
                    message: 'No file changes found',
                    progress: 100
                });
                return { available: true, changes: [] };
            }

            onProgress({
                phase: 'diffs',
                message: `Found ${diffViews.length} file changes, extracting...`,
                progress: 30
            });

            // Extract each diff
            for (let i = 0; i < diffViews.length; i++) {
                const diff = await this.extractDiff(diffViews[i], i);
                if (diff) {
                    this.capturedDiffs.push(diff);
                }

                const progress = 30 + ((i + 1) / diffViews.length) * 70;
                onProgress({
                    phase: 'diffs',
                    message: `Extracted change ${i + 1}/${diffViews.length}`,
                    progress: progress
                });
            }

            onProgress({
                phase: 'diffs',
                message: `Captured ${this.capturedDiffs.length} file changes`,
                progress: 100
            });

            return {
                available: true,
                changes: this.capturedDiffs
            };

        } catch (error) {
            console.error('[Diff Scraper] Error:', error);
            return { available: true, changes: this.capturedDiffs, error: error.message };
        }
    },

    /**
     * Find diff view elements
     * @param {Object} platform - Platform configuration
     * @returns {Array} Array of diff view elements
     */
    findDiffViews(platform) {
        const diffViews = [];

        // Use platform-specific diff selector
        const diffElements = PlatformDetector.findElements('diffView');
        if (diffElements.length > 0) {
            diffViews.push(...Array.from(diffElements));
        }

        // Also look for common diff patterns
        const commonSelectors = [
            '.diff, [class*="diff"]',
            '[class*="change"], [class*="Change"]',
            '[data-diff], [data-change]'
        ];

        commonSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (!diffViews.includes(el)) {
                    diffViews.push(el);
                }
            });
        });

        return diffViews;
    },

    /**
     * Extract diff data from element
     * @param {Element} diffElement - Diff view element
     * @param {number} index - Diff index
     * @returns {Promise<Object|null>} Diff data
     */
    async extractDiff(diffElement, index) {
        try {
            const diff = {
                id: this.generateDiffId(diffElement, index),
                filename: this.extractFilename(diffElement),
                changeType: this.determineChangeType(diffElement),
                additions: this.extractAdditions(diffElement),
                deletions: this.extractDeletions(diffElement),
                hunks: this.extractHunks(diffElement),
                timestamp: this.extractTimestamp(diffElement),
                author: this.extractAuthor(diffElement),
                stats: this.calculateStats(diffElement)
            };

            return diff;

        } catch (error) {
            console.error(`[Diff Scraper] Error extracting diff ${index}:`, error);
            return null;
        }
    },

    /**
     * Generate stable diff ID
     * @param {Element} element - Diff element
     * @param {number} index - Index
     * @returns {string} Diff ID
     */
    generateDiffId(element, index) {
        const dataId = element.getAttribute('data-diff-id') ||
            element.getAttribute('data-file-id') ||
            element.getAttribute('id');

        if (dataId) return dataId;

        const content = element.textContent.slice(0, 100);
        const hash = DOMHelpers.hashString(content);
        return `diff_${hash}_${index}`;
    },

    /**
     * Extract filename from diff
     * @param {Element} element - Diff element
     * @returns {string|null} Filename
     */
    extractFilename(element) {
        // Try data attribute
        const dataFile = element.getAttribute('data-file') ||
            element.getAttribute('data-filename');
        if (dataFile) return dataFile;

        // Try to find filename in header
        const header = element.querySelector('[class*="header"], [class*="filename"], [data-filename]');
        if (header) {
            const text = header.textContent.trim();
            // Extract filename from "a/filename" or "b/filename" patterns
            const match = text.match(/[ab]\/([^\s]+)/);
            if (match) return match[1];
            return text;
        }

        return null;
    },

    /**
     * Determine change type
     * @param {Element} element - Diff element
     * @returns {string} Change type
     */
    determineChangeType(element) {
        const typeAttr = element.getAttribute('data-change-type');
        if (typeAttr) return typeAttr;

        const classList = element.className.toLowerCase();

        if (classList.includes('add') || classList.includes('new')) return 'added';
        if (classList.includes('delete') || classList.includes('remove')) return 'deleted';
        if (classList.includes('modify') || classList.includes('change')) return 'modified';
        if (classList.includes('rename')) return 'renamed';

        return 'modified';
    },

    /**
     * Extract additions (new lines)
     * @param {Element} element - Diff element
     * @returns {Array} Added lines
     */
    extractAdditions(element) {
        const additions = [];

        // Look for lines marked as additions
        const addedLines = element.querySelectorAll(
            '[class*="add"], [class*="insert"], ' +
            'tr.add, tr.insert, .diff-line-add'
        );

        addedLines.forEach((line, i) => {
            const text = line.textContent.trim();
            if (text && !text.startsWith('+++')) { // Skip diff headers
                additions.push({
                    lineNumber: this.extractLineNumber(line),
                    content: text.replace(/^\+\s?/, '') // Remove + prefix
                });
            }
        });

        return additions;
    },

    /**
     * Extract deletions (removed lines)
     * @param {Element} element - Diff element
     * @returns {Array} Deleted lines
     */
    extractDeletions(element) {
        const deletions = [];

        // Look for lines marked as deletions
        const deletedLines = element.querySelectorAll(
            '[class*="delete"], [class*="remove"], ' +
            'tr.delete, tr.remove, .diff-line-del'
        );

        deletedLines.forEach((line, i) => {
            const text = line.textContent.trim();
            if (text && !text.startsWith('---')) { // Skip diff headers
                deletions.push({
                    lineNumber: this.extractLineNumber(line),
                    content: text.replace(/^-\s?/, '') // Remove - prefix
                });
            }
        });

        return deletions;
    },

    /**
     * Extract diff hunks
     * @param {Element} element - Diff element
     * @returns {Array} Diff hunks
     */
    extractHunks(element) {
        const hunks = [];

        // Try to parse unified diff format
        const text = element.textContent;
        const hunkPattern = /@@\s+-(\d+),?(\d+)?\s+\+(\d+),?(\d+)?\s+@@/g;

        let match;
        while ((match = hunkPattern.exec(text)) !== null) {
            hunks.push({
                oldStart: parseInt(match[1]),
                oldLines: parseInt(match[2] || '1'),
                newStart: parseInt(match[3]),
                newLines: parseInt(match[4] || '1'),
                header: match[0]
            });
        }

        return hunks;
    },

    /**
     * Extract line number from diff line
     * @param {Element} line - Line element
     * @returns {number|null} Line number
     */
    extractLineNumber(line) {
        const lineNumEl = line.querySelector('[class*="line-number"], [data-line-number]');
        if (lineNumEl) {
            const num = parseInt(lineNumEl.textContent);
            if (!isNaN(num)) return num;
        }

        const dataLineNum = line.getAttribute('data-line-number') ||
            line.getAttribute('data-line');
        if (dataLineNum) {
            const num = parseInt(dataLineNum);
            if (!isNaN(num)) return num;
        }

        return null;
    },

    /**
     * Extract timestamp
     * @param {Element} element - Diff element
     * @returns {string|null} Timestamp
     */
    extractTimestamp(element) {
        const timeEl = element.querySelector('time, [data-timestamp], [datetime]');
        if (timeEl) {
            return timeEl.getAttribute('datetime') || timeEl.textContent.trim();
        }
        return null;
    },

    /**
     * Extract author
     * @param {Element} element - Diff element
     * @returns {string|null} Author
     */
    extractAuthor(element) {
        const authorEl = element.querySelector('[data-author], [class*="author"]');
        return authorEl ? authorEl.textContent.trim() : null;
    },

    /**
     * Calculate diff statistics
     * @param {Element} element - Diff element
     * @returns {Object} Statistics
     */
    calculateStats(element) {
        const additions = element.querySelectorAll('[class*="add"], .diff-line-add');
        const deletions = element.querySelectorAll('[class*="delete"], .diff-line-del');

        return {
            additions: additions.length,
            deletions: deletions.length,
            changes: additions.length + deletions.length
        };
    }
};

window.DiffScraper = DiffScraper;
