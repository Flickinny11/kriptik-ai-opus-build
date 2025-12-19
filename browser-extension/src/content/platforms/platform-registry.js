// Platform Registry - Central registry for all supported AI builder platforms
// This system allows dynamic platform detection and configuration management

const PlatformRegistry = {
  platforms: new Map(),

  /**
   * Register a platform configuration
   * @param {Object} config - Platform configuration object
   */
  register(config) {
    if (!config.id || !config.name || !config.hostPatterns) {
      console.error('Invalid platform config:', config);
      return false;
    }
    this.platforms.set(config.id, config);
    return true;
  },

  /**
   * Register multiple platforms at once
   * @param {Array} configs - Array of platform configurations
   */
  registerMultiple(configs) {
    configs.forEach(config => this.register(config));
  },

  /**
   * Detect which platform the user is currently on
   * @returns {Object|null} Platform config with projectId, or null if no match
   */
  detectCurrentPlatform() {
    const hostname = window.location.hostname;
    const url = window.location.href;

    for (const [id, config] of this.platforms) {
      // Check if hostname matches any of the platform's host patterns
      if (config.hostPatterns.some(pattern => hostname.includes(pattern))) {
        const projectId = this.extractProjectId(url, config.projectUrlPattern);
        return {
          ...config,
          projectId,
          detectedAt: new Date().toISOString(),
          url: url
        };
      }
    }

    return null;
  },

  /**
   * Extract project ID from URL using platform's regex pattern
   * @param {string} url - Current URL
   * @param {RegExp} pattern - Platform's project URL pattern
   * @returns {string|null} Extracted project ID or null
   */
  extractProjectId(url, pattern) {
    if (!pattern) return null;
    const match = url.match(pattern);
    return match ? match[1] : null;
  },

  /**
   * Get platform configuration by ID
   * @param {string} platformId - Platform identifier
   * @returns {Object|null} Platform config or null
   */
  getPlatform(platformId) {
    return this.platforms.get(platformId) || null;
  },

  /**
   * Get all registered platforms
   * @returns {Array} Array of all platform configs
   */
  getAllPlatforms() {
    return Array.from(this.platforms.values());
  },

  /**
   * Get platforms by tier
   * @param {number} tier - Tier number (1, 2, or 3)
   * @returns {Array} Array of platform configs in that tier
   */
  getPlatformsByTier(tier) {
    return this.getAllPlatforms().filter(p => p.tier === tier);
  },

  /**
   * Check if a feature is supported on current platform
   * @param {Object} platform - Platform config
   * @param {string} feature - Feature name to check
   * @returns {boolean} True if feature is supported
   */
  hasFeature(platform, feature) {
    return platform.features && platform.features[feature] === true;
  },

  /**
   * Get selector for a specific element type on a platform
   * @param {Object} platform - Platform config
   * @param {string} selectorName - Name of selector
   * @returns {string|null} Selector string or null
   */
  getSelector(platform, selectorName) {
    return platform.selectors?.[selectorName] || null;
  },

  /**
   * Find element using platform-specific selector with fallbacks
   * @param {Object} platform - Platform config
   * @param {string} selectorName - Name of selector
   * @returns {Element|null} Found element or null
   */
  findElement(platform, selectorName) {
    const selector = this.getSelector(platform, selectorName);
    if (!selector) return null;

    // Selector can be comma-separated for fallbacks
    const selectors = selector.split(', ').map(s => s.trim());

    for (const sel of selectors) {
      // Handle :contains() pseudo-selector (not native CSS)
      if (sel.includes(':contains(')) {
        const match = sel.match(/(.+):contains\("(.+)"\)/);
        if (match) {
          const [, baseSelector, text] = match;
          const elements = document.querySelectorAll(baseSelector);
          const found = Array.from(elements).find(el =>
            el.textContent.includes(text)
          );
          if (found) return found;
        }
      } else {
        // Standard CSS selector
        const element = document.querySelector(sel);
        if (element) return element;
      }
    }

    return null;
  },

  /**
   * Find all elements using platform-specific selector
   * @param {Object} platform - Platform config
   * @param {string} selectorName - Name of selector
   * @returns {NodeList} NodeList of found elements (may be empty)
   */
  findElements(platform, selectorName) {
    const selector = this.getSelector(platform, selectorName);
    if (!selector) return document.querySelectorAll('');

    // Use first selector that matches
    const selectors = selector.split(', ').map(s => s.trim());
    for (const sel of selectors) {
      // Skip :contains() for querySelectorAll
      if (!sel.includes(':contains(')) {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) return elements;
      }
    }

    return document.querySelectorAll('');
  },

  /**
   * Determine export mechanism for a platform
   * @param {Object} platform - Platform config
   * @returns {string} Export mechanism type
   */
  getExportMechanism(platform) {
    return platform.exportMechanism || 'unknown';
  },

  /**
   * Get platform logo/icon
   * @param {Object} platform - Platform config
   * @returns {string} Path to platform logo
   */
  getPlatformLogo(platform) {
    return `assets/platform-logos/${platform.id}.svg`;
  },

  /**
   * Validate platform configuration
   * @param {Object} config - Platform config to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validateConfig(config) {
    const errors = [];
    const requiredFields = ['id', 'name', 'provider', 'hostPatterns', 'exportMechanism', 'features', 'selectors'];

    requiredFields.forEach(field => {
      if (!config[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    if (config.hostPatterns && !Array.isArray(config.hostPatterns)) {
      errors.push('hostPatterns must be an array');
    }

    if (config.features && typeof config.features !== 'object') {
      errors.push('features must be an object');
    }

    if (config.selectors && typeof config.selectors !== 'object') {
      errors.push('selectors must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// Make available globally
window.PlatformRegistry = PlatformRegistry;
