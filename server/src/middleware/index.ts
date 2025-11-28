/**
 * Middleware exports
 */

export {
    authMiddleware,
    optionalAuthMiddleware,
    requireRole,
    default
} from './auth.js';

export {
    createRateLimiter,
    aiRateLimiter,
    orchestrationRateLimiter,
    autonomousRateLimiter,
    generalRateLimiter,
    strictRateLimiter,
    aiCostLimiter,
    createCostBasedLimiter,
    getUserTier,
    getUserIdentifier,
    TIER_LIMITS,
    ROUTE_LIMITS,
} from './rate-limiter.js';

export {
    createSanitizer,
    sanitizer,
    filePathSanitizer,
    projectNameValidator,
    urlValidator,
    promptSanitizer,
    fullSanitization,
    escapeHtml,
    stripDangerousPatterns,
    sanitizePath,
    sanitizeName,
    sanitizeEmail,
    sanitizeUrl,
    sanitizeObject,
    isValidPath,
    isValidProjectName,
    validateRequestBody,
} from './sanitizer.js';

