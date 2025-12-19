// Capture Phases - Professional phase definitions without emoji-style content

const CapturePhases = {
    phases: [
        {
            id: 'init',
            name: 'INITIALIZATION',
            messages: [
                'Initializing capture system...',
                'Preparing data extraction modules...',
                'Establishing secure capture environment...'
            ],
            duration: 1500,
            color: '#ffffff',
            glowColor: 'rgba(255, 255, 255, 0.3)'
        },
        {
            id: 'scan',
            name: 'SCANNING',
            messages: [
                'Scanning platform environment...',
                'Analyzing page structure...',
                'Detecting available data sources...'
            ],
            duration: 2000,
            color: '#ff9966',
            glowColor: 'rgba(255, 153, 102, 0.4)'
        },
        {
            id: 'extract',
            name: 'EXTRACTING CONVERSATIONS',
            messages: [
                'Capturing chat history...',
                'Extracting message content...',
                'Preserving conversation context...'
            ],
            duration: null, // Variable
            color: '#ffcc66',
            glowColor: 'rgba(255, 204, 102, 0.4)'
        },
        {
            id: 'errors',
            name: 'ERROR ANALYSIS',
            messages: [
                'Collecting error logs...',
                'Capturing console output...',
                'Analyzing exception traces...'
            ],
            duration: 1500,
            color: '#ff6666',
            glowColor: 'rgba(255, 102, 102, 0.4)'
        },
        {
            id: 'files',
            name: 'FILE STRUCTURE',
            messages: [
                'Mapping project structure...',
                'Indexing file hierarchy...',
                'Capturing directory tree...'
            ],
            duration: 2000,
            color: '#66ff99',
            glowColor: 'rgba(102, 255, 153, 0.4)'
        },
        {
            id: 'artifacts',
            name: 'ARTIFACTS',
            messages: [
                'Capturing code artifacts...',
                'Extracting iterations...',
                'Preserving version history...'
            ],
            duration: 1500,
            color: '#66ccff',
            glowColor: 'rgba(102, 204, 255, 0.4)'
        },
        {
            id: 'diffs',
            name: 'CHANGE TRACKING',
            messages: [
                'Analyzing code changes...',
                'Capturing file modifications...',
                'Extracting diff data...'
            ],
            duration: 1500,
            color: '#cc99ff',
            glowColor: 'rgba(204, 153, 255, 0.4)'
        },
        {
            id: 'terminal',
            name: 'TERMINAL OUTPUT',
            messages: [
                'Capturing terminal history...',
                'Extracting command output...',
                'Preserving execution logs...'
            ],
            duration: 1500,
            color: '#99ffcc',
            glowColor: 'rgba(153, 255, 204, 0.4)'
        },
        {
            id: 'compile',
            name: 'COMPILATION',
            messages: [
                'Compiling captured data...',
                'Building metadata package...',
                'Finalizing export bundle...'
            ],
            duration: 2000,
            color: '#ffffff',
            glowColor: 'rgba(255, 255, 255, 0.4)'
        },
        {
            id: 'complete',
            name: 'COMPLETE',
            messages: [
                'Capture completed successfully.',
                'All data captured and organized.',
                'Ready for export.'
            ],
            duration: 1000,
            color: '#66ff99',
            glowColor: 'rgba(102, 255, 153, 0.6)'
        }
    ],

    /**
     * Get phase configuration by ID
     * @param {string} id - Phase ID
     * @returns {Object|null} Phase configuration
     */
    getPhase(id) {
        return this.phases.find(p => p.id === id) || null;
    },

    /**
     * Get random message for phase
     * @param {string} phaseId - Phase ID
     * @returns {string} Random message
     */
    getRandomMessage(phaseId) {
        const phase = this.getPhase(phaseId);
        if (!phase) return '';
        return phase.messages[Math.floor(Math.random() * phase.messages.length)];
    },

    /**
     * Get phase index
     * @param {string} id - Phase ID
     * @returns {number} Phase index
     */
    getPhaseIndex(id) {
        return this.phases.findIndex(p => p.id === id);
    },

    /**
     * Get overall progress for a phase
     * @param {string} phaseId - Phase ID
     * @param {number} internalProgress - Progress within phase (0-100)
     * @returns {number} Overall progress (0-100)
     */
    getProgressForPhase(phaseId, internalProgress = 0) {
        const index = this.getPhaseIndex(phaseId);
        if (index === -1) return 0;

        const totalPhases = this.phases.length;
        const phaseSize = 100 / totalPhases;
        return (index * phaseSize) + (internalProgress * phaseSize / 100);
    },

    /**
     * Get next phase
     * @param {string} currentPhaseId - Current phase ID
     * @returns {Object|null} Next phase
     */
    getNextPhase(currentPhaseId) {
        const index = this.getPhaseIndex(currentPhaseId);
        if (index === -1 || index >= this.phases.length - 1) return null;
        return this.phases[index + 1];
    },

    /**
     * Get all phase IDs
     * @returns {Array} Array of phase IDs
     */
    getAllPhaseIds() {
        return this.phases.map(p => p.id);
    }
};

window.CapturePhases = CapturePhases;
