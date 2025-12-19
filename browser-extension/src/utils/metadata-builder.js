// Metadata Builder - Constructs the enhanced metadata structure (v2.0)

const MetadataBuilder = {
    /**
     * Build complete metadata object
     * @param {Object} platform - Platform config
     * @param {Object} capturedData - All captured data
     * @returns {Object} Complete metadata object
     */
    build(platform, capturedData) {
        return {
            version: '2.0',
            exportedAt: new Date().toISOString(),

            platform: this.buildPlatformInfo(platform),
            project: this.buildProjectInfo(platform, capturedData),
            chatHistory: this.buildChatHistory(capturedData.chatHistory),
            files: this.buildFileStructure(capturedData.fileTree),
            errors: this.buildErrorInfo(capturedData.errors),
            console: this.buildConsoleInfo(capturedData.consoleLogs),
            terminal: this.buildTerminalInfo(capturedData.terminal),
            artifacts: this.buildArtifactInfo(capturedData.artifacts),
            diffs: this.buildDiffInfo(capturedData.diffs),
            captureStats: this.buildCaptureStats(capturedData)
        };
    },

    buildPlatformInfo(platform) {
        return {
            id: platform.id,
            name: platform.name,
            provider: platform.provider,
            version: platform.version || 'unknown',
            tier: platform.tier
        };
    },

    buildProjectInfo(platform, capturedData) {
        return {
            id: platform.projectId || 'unknown',
            name: capturedData.projectName || platform.projectId || 'untitled',
            url: platform.url || window.location.href
        };
    },

    buildChatHistory(messages) {
        if (!messages || !Array.isArray(messages)) {
            return { messageCount: 0, messages: [] };
        }

        return {
            messageCount: messages.length,
            messages: messages.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                codeBlocks: msg.codeBlocks || [],
                artifacts: msg.artifacts || []
            }))
        };
    },

    buildFileStructure(fileTree) {
        if (!fileTree) {
            return {
                structure: {},
                stats: { totalFiles: 0, totalFolders: 0, fileTypes: {} }
            };
        }

        return {
            structure: fileTree.structure || {},
            stats: fileTree.stats || {
                totalFiles: 0,
                totalFolders: 0,
                fileTypes: {}
            },
            files: fileTree.files || []
        };
    },

    buildErrorInfo(errors) {
        if (!errors || !Array.isArray(errors)) {
            return { count: 0, entries: [] };
        }

        return {
            count: errors.length,
            entries: errors.map(err => ({
                type: err.type,
                severity: err.severity || 'error',
                timestamp: err.timestamp,
                message: err.message,
                stack: err.stack,
                source: err.source
            }))
        };
    },

    buildConsoleInfo(consoleLogs) {
        if (!consoleLogs || !Array.isArray(consoleLogs)) {
            return { count: 0, entries: [] };
        }

        return {
            count: consoleLogs.length,
            entries: consoleLogs
        };
    },

    buildTerminalInfo(terminal) {
        if (!terminal || !terminal.available) {
            return { available: false, output: [] };
        }

        return {
            available: true,
            output: terminal.output || []
        };
    },

    buildArtifactInfo(artifacts) {
        if (!artifacts || !artifacts.available) {
            return { available: false, items: [] };
        }

        return {
            available: true,
            items: artifacts.items || []
        };
    },

    buildDiffInfo(diffs) {
        if (!diffs || !diffs.available) {
            return { available: false, changes: [] };
        }

        return {
            available: true,
            changes: diffs.changes || []
        };
    },

    buildCaptureStats(capturedData) {
        const startTime = capturedData.startTime || Date.now();
        const endTime = Date.now();

        return {
            duration: endTime - startTime,
            completeness: this.calculateCompleteness(capturedData),
            features: this.listCapturedFeatures(capturedData)
        };
    },

    calculateCompleteness(capturedData) {
        let total = 0;
        let captured = 0;

        const features = [
            'chatHistory',
            'fileTree',
            'errors',
            'consoleLogs',
            'terminal',
            'artifacts',
            'diffs'
        ];

        features.forEach(feature => {
            total++;
            if (capturedData[feature] && this.hasData(capturedData[feature])) {
                captured++;
            }
        });

        return Math.round((captured / total) * 100);
    },

    hasData(obj) {
        if (!obj) return false;
        if (Array.isArray(obj)) return obj.length > 0;
        if (obj.available !== undefined) return obj.available;
        return Object.keys(obj).length > 0;
    },

    listCapturedFeatures(capturedData) {
        const features = [];

        if (capturedData.chatHistory?.length > 0) features.push('chat');
        if (capturedData.fileTree?.stats?.totalFiles > 0) features.push('files');
        if (capturedData.errors?.length > 0) features.push('errors');
        if (capturedData.consoleLogs?.length > 0) features.push('console');
        if (capturedData.terminal?.available) features.push('terminal');
        if (capturedData.artifacts?.available) features.push('artifacts');
        if (capturedData.diffs?.available) features.push('diffs');

        return features;
    }
};

window.MetadataBuilder = MetadataBuilder;
