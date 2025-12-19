// File Tree Scraper
// Captures project file structure
// Adapted to work with platform registry system

const FileTreeScraper = {
    /**
     * Capture file tree structure
     * @param {Object} platform - Platform configuration
     * @param {function} onProgress - Progress callback
     * @returns {Promise<Object>} File tree data
     */
    async capture(platform, onProgress) {
        onProgress({
            phase: 'scanning-files',
            message: 'Mapping directory hypercube structure...',
            progress: 0
        });

        const fileTree = {
            files: [],
            structure: {},
            stats: {
                totalFiles: 0,
                totalFolders: 0,
                fileTypes: {}
            }
        };

        // Find file tree container
        const fileTreeContainer = PlatformDetector.findElement('fileTree');

        if (!fileTreeContainer) {
            onProgress({
                phase: 'files-complete',
                message: 'No file tree found',
                progress: 100
            });
            return fileTree;
        }

        onProgress({
            phase: 'expanding-folders',
            message: 'Expanding directory nodes...',
            progress: 20
        });

        // Try to expand all folders first
        await this.expandAllFolders(platform);

        onProgress({
            phase: 'extracting-files',
            message: 'Extracting file metadata...',
            progress: 50
        });

        // Scrape the file tree
        const fileItems = PlatformDetector.findElements('fileItem');

        fileItems.forEach((item, index) => {
            const fileInfo = this.extractFileInfo(item, platform);
            if (fileInfo) {
                fileTree.files.push(fileInfo);

                // Update stats
                if (fileInfo.type === 'file') {
                    fileTree.stats.totalFiles++;
                    const ext = this.getExtension(fileInfo.name);
                    fileTree.stats.fileTypes[ext] = (fileTree.stats.fileTypes[ext] || 0) + 1;
                } else {
                    fileTree.stats.totalFolders++;
                }
            }

            // Update progress
            const progress = 50 + ((index + 1) / fileItems.length) * 40;
            onProgress({
                phase: 'extracting-files',
                message: `Extracted ${index + 1}/${fileItems.length} items...`,
                progress: progress
            });
        });

        onProgress({
            phase: 'building-hierarchy',
            message: 'Building hierarchical structure...',
            progress: 95
        });

        // Build hierarchical structure
        fileTree.structure = this.buildHierarchy(fileTree.files);

        onProgress({
            phase: 'files-complete',
            message: `Mapped ${fileTree.stats.totalFiles} files in ${fileTree.stats.totalFolders} directories`,
            progress: 100,
            count: fileTree.stats.totalFiles
        });

        return fileTree;
    },

    /**
     * Expand all folders in file tree
     * @param {Object} platform - Platform configuration
     * @returns {Promise<void>}
     */
    async expandAllFolders(platform) {
        let expanded = true;
        let iterations = 0;

        while (expanded && iterations < 20) {
            expanded = false;
            iterations++;

            // Look for collapsed folder toggles
            const folderToggleSelectors = [
                '[data-testid="folder-toggle"]:not([data-expanded="true"])',
                '.folder-toggle:not(.expanded)',
                '[class*="folder"][class*="collapsed"]',
                '[aria-expanded="false"]'
            ];

            for (const selector of folderToggleSelectors) {
                const folderToggles = document.querySelectorAll(selector);

                for (const toggle of folderToggles) {
                    if (DOMHelpers.isVisible(toggle)) {
                        toggle.click();
                        expanded = true;
                        await this.wait(100);
                    }
                }
            }

            await this.wait(300);
        }
    },

    /**
     * Extract file info from element
     * @param {Element} element - File item element
     * @param {Object} platform - Platform configuration
     * @returns {Object|null} File info
     */
    extractFileInfo(element, platform) {
        // Get file name
        const nameSelectors = [
            '[class*="name"]',
            '.file-name',
            'span:not([class*="icon"])'
        ];

        let nameEl = null;
        for (const selector of nameSelectors) {
            nameEl = element.querySelector(selector);
            if (nameEl) break;
        }

        const name = nameEl?.textContent?.trim();
        if (!name) return null;

        // Determine if file or folder
        const isFolder = element.classList.contains('folder') ||
            element.querySelector('[class*="folder-icon"]') ||
            element.hasAttribute('data-folder') ||
            element.getAttribute('aria-expanded') !== null;

        // Get path from data attributes or DOM hierarchy
        const path = this.extractPath(element, name);

        // Get depth/indentation level
        const depth = this.extractDepth(element);

        return {
            name,
            path,
            type: isFolder ? 'folder' : 'file',
            depth,
            extension: isFolder ? null : this.getExtension(name)
        };
    },

    /**
     * Extract file path
     * @param {Element} element - File element
     * @param {string} name - File name
     * @returns {string} File path
     */
    extractPath(element, name) {
        // Try data attribute
        const dataPath = element.getAttribute('data-path') ||
            element.getAttribute('data-filepath');
        if (dataPath) return dataPath;

        // Build path from parent folders
        const parts = [name];
        let parent = element.parentElement;

        while (parent) {
            if (parent.classList.contains('folder') ||
                parent.hasAttribute('data-folder')) {
                const parentNameEl = parent.querySelector('[class*="name"]');
                const parentName = parentNameEl?.textContent?.trim();
                if (parentName && parentName !== name) {
                    parts.unshift(parentName);
                }
            }
            parent = parent.parentElement;

            // Stop at tree root
            if (parent?.classList.contains('file-tree') ||
                parent?.hasAttribute('data-testid')?.includes('tree')) {
                break;
            }
        }

        return '/' + parts.join('/');
    },

    /**
     * Extract depth from element
     * @param {Element} element - File element
     * @returns {number} Depth level
     */
    extractDepth(element) {
        // Try to get depth from style (padding/margin often indicates depth)
        const style = window.getComputedStyle(element);
        const paddingLeft = parseInt(style.paddingLeft);

        if (paddingLeft > 0) {
            return Math.floor(paddingLeft / 16); // Assuming 16px per level
        }

        // Count parent folders
        let depth = 0;
        let parent = element.parentElement;
        while (parent && !parent.classList.contains('file-tree')) {
            if (parent.classList.contains('folder')) depth++;
            parent = parent.parentElement;
        }

        return depth;
    },

    /**
     * Build hierarchical structure from flat file list
     * @param {Array} files - Flat file list
     * @returns {Object} Hierarchical structure
     */
    buildHierarchy(files) {
        const root = {};

        files.forEach(file => {
            const parts = file.path.split('/').filter(Boolean);
            let current = root;

            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = index === parts.length - 1 && file.type === 'file'
                        ? null // File (leaf node)
                        : {}; // Folder
                }
                if (current[part] !== null) {
                    current = current[part];
                }
            });
        });

        return root;
    },

    /**
     * Get file extension
     * @param {string} filename - Filename
     * @returns {string} File extension
     */
    getExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : 'none';
    },

    /**
     * Wait helper
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise} Promise
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

window.FileTreeScraper = FileTreeScraper;
