// Artifact Scraper
// Captures artifacts from platforms like Claude and v0

const ArtifactScraper = {
    capturedArtifacts: [],

    /**
     * Capture all artifacts from the platform
     * @param {Object} platform - Platform configuration
     * @param {function} onProgress - Progress callback
     * @returns {Promise<Object>} Artifact data
     */
    async capture(platform, onProgress) {
        this.capturedArtifacts = [];

        if (!PlatformRegistry.hasFeature(platform, 'artifacts')) {
            return { available: false, items: [] };
        }

        onProgress({
            phase: 'artifacts',
            message: 'Scanning for artifacts...',
            progress: 0
        });

        try {
            // Find artifact containers
            const artifactContainers = this.findArtifactContainers(platform);

            if (artifactContainers.length === 0) {
                onProgress({
                    phase: 'artifacts',
                    message: 'No artifacts found',
                    progress: 100
                });
                return { available: true, items: [] };
            }

            onProgress({
                phase: 'artifacts',
                message: `Found ${artifactContainers.length} artifacts, extracting...`,
                progress: 30
            });

            // Extract each artifact
            for (let i = 0; i < artifactContainers.length; i++) {
                const artifact = await this.extractArtifact(artifactContainers[i], platform, i);
                if (artifact) {
                    this.capturedArtifacts.push(artifact);
                }

                const progress = 30 + ((i + 1) / artifactContainers.length) * 70;
                onProgress({
                    phase: 'artifacts',
                    message: `Extracted artifact ${i + 1}/${artifactContainers.length}`,
                    progress: progress
                });
            }

            onProgress({
                phase: 'artifacts',
                message: `Captured ${this.capturedArtifacts.length} artifacts`,
                progress: 100
            });

            return {
                available: true,
                items: this.capturedArtifacts
            };

        } catch (error) {
            console.error('[Artifact Scraper] Error:', error);
            return { available: true, items: this.capturedArtifacts, error: error.message };
        }
    },

    /**
     * Find artifact containers on the page
     * @param {Object} platform - Platform configuration
     * @returns {Array} Array of artifact container elements
     */
    findArtifactContainers(platform) {
        const containers = [];

        // Try artifact-specific selector
        const artifactSelector = platform.selectors.artifact || platform.selectors.artifactContainer;
        if (artifactSelector) {
            const elements = document.querySelectorAll(artifactSelector);
            containers.push(...Array.from(elements));
        }

        // Also check for preview frames that might contain artifacts
        if (containers.length === 0) {
            const previewFrames = PlatformDetector.findElements('previewFrame');
            containers.push(...Array.from(previewFrames));
        }

        return containers;
    },

    /**
     * Extract artifact data from container
     * @param {Element} container - Artifact container element
     * @param {Object} platform - Platform configuration
     * @param {number} index - Artifact index
     * @returns {Promise<Object|null>} Artifact data
     */
    async extractArtifact(container, platform, index) {
        try {
            const artifact = {
                id: this.generateArtifactId(container, index),
                type: this.determineArtifactType(container),
                title: this.extractTitle(container),
                createdAt: this.extractTimestamp(container),
                code: this.extractCode(container),
                preview: await this.capturePreview(container),
                versions: await this.extractVersions(container, platform),
                metadata: this.extractMetadata(container)
            };

            return artifact;

        } catch (error) {
            console.error(`[Artifact Scraper] Error extracting artifact ${index}:`, error);
            return null;
        }
    },

    /**
     * Generate stable artifact ID
     * @param {Element} container - Artifact container
     * @param {number} index - Index
     * @returns {string} Artifact ID
     */
    generateArtifactId(container, index) {
        const dataId = container.getAttribute('data-artifact-id') ||
            container.getAttribute('data-id') ||
            container.getAttribute('id');

        if (dataId) return dataId;

        // Generate from content hash
        const content = container.textContent.slice(0, 100);
        const hash = DOMHelpers.hashString(content);
        return `artifact_${hash}_${index}`;
    },

    /**
     * Determine artifact type
     * @param {Element} container - Artifact container
     * @returns {string} Artifact type
     */
    determineArtifactType(container) {
        const typeAttr = container.getAttribute('data-artifact-type') ||
            container.getAttribute('data-type');
        if (typeAttr) return typeAttr;

        // Infer from content
        const hasCode = container.querySelector('pre, code');
        const hasIframe = container.querySelector('iframe');
        const hasCanvas = container.querySelector('canvas');

        if (hasCanvas) return 'canvas';
        if (hasIframe) return 'preview';
        if (hasCode) return 'code';
        return 'component';
    },

    /**
     * Extract artifact title
     * @param {Element} container - Artifact container
     * @returns {string|null} Title
     */
    extractTitle(container) {
        const titleEl = container.querySelector('[data-title], h1, h2, h3, .title, [class*="title"]');
        return titleEl ? titleEl.textContent.trim() : null;
    },

    /**
     * Extract timestamp
     * @param {Element} container - Artifact container
     * @returns {string|null} Timestamp
     */
    extractTimestamp(container) {
        const timeEl = container.querySelector('time, [data-timestamp], [datetime]');
        if (timeEl) {
            return timeEl.getAttribute('datetime') || timeEl.textContent.trim();
        }
        return null;
    },

    /**
     * Extract code from artifact
     * @param {Element} container - Artifact container
     * @returns {Array} Code blocks
     */
    extractCode(container) {
        const codeBlocks = [];
        const codeElements = container.querySelectorAll('pre code, [data-code]');

        codeElements.forEach((el, i) => {
            const language = el.getAttribute('data-language') ||
                el.className.match(/language-(\w+)/)?.[1] ||
                'text';

            codeBlocks.push({
                id: `code_${i}`,
                language: language,
                content: el.textContent || el.innerText
            });
        });

        return codeBlocks;
    },

    /**
     * Capture preview screenshot
     * @param {Element} container - Artifact container
     * @returns {Promise<string|null>} Preview data URL or null
     */
    async capturePreview(container) {
        // Try to find iframe
        const iframe = container.querySelector('iframe');
        if (iframe && iframe.src) {
            return iframe.src; // Return iframe src as preview reference
        }

        // Try to find canvas
        const canvas = container.querySelector('canvas');
        if (canvas) {
            try {
                return canvas.toDataURL();
            } catch (e) {
                // Canvas might be tainted
                return null;
            }
        }

        return null;
    },

    /**
     * Extract artifact versions/iterations
     * @param {Element} container - Artifact container
     * @param {Object} platform - Platform configuration
     * @returns {Promise<Array>} Version history
     */
    async extractVersions(container, platform) {
        const versions = [];

        // Look for version/iteration indicators
        const iterationSelector = platform.selectors.iterationSelector;
        if (iterationSelector) {
            const versionElements = container.querySelectorAll(iterationSelector);

            versionElements.forEach((el, i) => {
                versions.push({
                    version: i + 1,
                    timestamp: this.extractTimestamp(el),
                    content: el.textContent.trim()
                });
            });
        }

        return versions;
    },

    /**
     * Extract additional metadata
     * @param {Element} container - Artifact container
     * @returns {Object} Metadata
     */
    extractMetadata(container) {
        const metadata = {};

        // Extract all data- attributes
        Array.from(container.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
                const key = attr.name.replace('data-', '');
                metadata[key] = attr.value;
            }
        });

        return metadata;
    }
};

window.ArtifactScraper = ArtifactScraper;
