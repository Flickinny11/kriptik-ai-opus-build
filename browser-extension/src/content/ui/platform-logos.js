// Platform Logos - SVG logos for all supported platforms

const PlatformLogos = {
    /**
     * Get SVG logo for platform
     * @param {string} platformId - Platform ID
     * @returns {string} SVG logo HTML
     */
    getLogo(platformId) {
        const logos = this.getLogos();
        return logos[platformId] || logos.default;
    },

    /**
     * Get all logos
     * @returns {Object} Map of platform IDs to SVG logos
     */
    getLogos() {
        return {
            // Default/Generic logo
            default: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      `,

            // Bolt.new logo
            bolt: `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/>
        </svg>
      `,

            // Lovable logo
            lovable: `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      `,

            // v0.dev logo
            v0: `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/>
        </svg>
      `,

            // Cursor logo
            cursor: `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        </svg>
      `,

            // Replit logo
            replit: `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 5-5v10zm4-10l5 5-5 5V7z"/>
        </svg>
      `,

            // GitHub Copilot logo
            'copilot-workspace': `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      `,

            // Windsurf logo
            windsurf: `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L4 8v8l8 6 8-6V8l-8-6zm0 18.5l-6-4.5V9l6-4.5L18 9v7l-6 4.5z"/>
        </svg>
      `,

            // Claude Artifacts logo
            'claude-artifacts': `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
        </svg>
      `,

            // Marblism logo
            marblism: `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6" fill="white" opacity="0.3"/>
          <circle cx="12" cy="12" r="3" fill="white" opacity="0.6"/>
        </svg>
      `,

            // Create.xyz logo
            create: `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      `
        };
    },

    /**
     * Create logo element for platform
     * @param {Object} platform - Platform configuration
     * @param {string} className - Additional CSS classes
     * @returns {HTMLElement} Logo element
     */
    createLogoElement(platform, className = '') {
        const div = document.createElement('div');
        div.className = `platform-logo ${className}`;
        div.innerHTML = this.getLogo(platform.id);
        div.style.color = platform.metadata?.color || '#ffffff';
        return div;
    }
};

window.PlatformLogos = PlatformLogos;
