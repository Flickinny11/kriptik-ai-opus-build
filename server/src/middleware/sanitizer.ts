/**
 * Input Sanitization Middleware
 *
 * Sanitizes all user inputs for security:
 * - XSS prevention
 * - SQL injection prevention
 * - Path traversal prevention
 * - Command injection prevention
 */

import { Request, Response, NextFunction } from 'express';

// ============================================================================
// TYPES
// ============================================================================

interface SanitizerOptions {
    allowHtml?: boolean;
    allowedTags?: string[];
    maxLength?: number;
    stripNull?: boolean;
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(str: string): string {
    const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;',
    };

    return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char]);
}

/**
 * Strip dangerous patterns that could be used for injection
 */
function stripDangerousPatterns(str: string): string {
    // Remove null bytes
    let result = str.replace(/\0/g, '');

    // Remove common XSS patterns
    result = result
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/on\w+\s*=/gi, '');

    // Remove potential SQL injection patterns
    result = result
        .replace(/(['";])\s*(or|and)\s+\d+\s*=\s*\d+/gi, '$1')
        .replace(/--\s*$/gm, '')
        .replace(/;\s*drop\s+/gi, '; ')
        .replace(/;\s*delete\s+/gi, '; ')
        .replace(/;\s*update\s+/gi, '; ')
        .replace(/;\s*insert\s+/gi, '; ')
        .replace(/;\s*truncate\s+/gi, '; ');

    // Remove command injection patterns
    result = result
        .replace(/[;&|`$]/g, '')
        .replace(/\$\([^)]*\)/g, '')
        .replace(/`[^`]*`/g, '');

    return result;
}

/**
 * Sanitize file paths to prevent path traversal
 */
function sanitizePath(path: string): string {
    // Remove null bytes
    let result = path.replace(/\0/g, '');

    // Remove path traversal attempts
    result = result
        .replace(/\.\.\//g, '')
        .replace(/\.\.\\/g, '')
        .replace(/\.\./g, '')
        .replace(/^\/+/, '')  // Remove leading slashes
        .replace(/^\\+/, ''); // Remove leading backslashes

    // Remove Windows drive letters if present
    result = result.replace(/^[a-zA-Z]:\\?/, '');

    // Normalize path separators
    result = result.replace(/\\/g, '/');

    // Remove any remaining dangerous characters
    result = result.replace(/[<>:"|?*]/g, '');

    return result;
}

/**
 * Sanitize project/resource names
 */
function sanitizeName(name: string): string {
    // Only allow alphanumeric, dash, underscore, space, and dot
    return name
        .replace(/[^a-zA-Z0-9\-_. ]/g, '')
        .trim()
        .slice(0, 100);  // Limit length
}

/**
 * Sanitize email addresses
 */
function sanitizeEmail(email: string): string {
    // Basic email sanitization
    return email
        .toLowerCase()
        .trim()
        .replace(/[<>'"]/g, '')
        .slice(0, 254);  // Max email length per RFC
}

/**
 * Sanitize URLs
 */
function sanitizeUrl(url: string): string {
    try {
        const parsed = new URL(url);

        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return '';
        }

        // Return sanitized URL
        return parsed.href;
    } catch {
        return '';
    }
}

/**
 * Deep sanitize an object recursively
 */
function sanitizeObject(
    obj: unknown,
    options: SanitizerOptions = {},
    depth = 0
): unknown {
    // Prevent infinite recursion
    if (depth > 10) {
        return null;
    }

    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        let result = obj;

        // Apply max length
        if (options.maxLength && result.length > options.maxLength) {
            result = result.slice(0, options.maxLength);
        }

        // Strip null bytes
        if (options.stripNull !== false) {
            result = result.replace(/\0/g, '');
        }

        // Escape HTML unless explicitly allowed
        if (!options.allowHtml) {
            result = escapeHtml(result);
        }

        // Strip dangerous patterns
        result = stripDangerousPatterns(result);

        return result;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, options, depth + 1));
    }

    if (typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            // Sanitize keys too
            const sanitizedKey = sanitizeName(key);
            if (sanitizedKey) {
                result[sanitizedKey] = sanitizeObject(value, options, depth + 1);
            }
        }
        return result;
    }

    return null;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate and sanitize request body
 */
function validateRequestBody(body: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (body === null || body === undefined) {
        return { valid: true, errors: [] };
    }

    const bodyStr = JSON.stringify(body);

    // Check for excessively large payloads
    if (bodyStr.length > 10 * 1024 * 1024) { // 10MB limit
        errors.push('Request body too large');
    }

    // Check for nested depth attacks
    let depth = 0;
    let maxDepth = 0;
    for (const char of bodyStr) {
        if (char === '{' || char === '[') {
            depth++;
            maxDepth = Math.max(maxDepth, depth);
        } else if (char === '}' || char === ']') {
            depth--;
        }
    }

    if (maxDepth > 20) {
        errors.push('Request body nested too deeply');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate file path
 */
function isValidPath(path: string): boolean {
    // Check for path traversal attempts
    if (path.includes('..') || path.includes('\0')) {
        return false;
    }

    // Check for absolute paths
    if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
        return false;
    }

    // Check for dangerous characters
    if (/[<>:"|?*]/.test(path)) {
        return false;
    }

    return true;
}

/**
 * Validate project name
 */
function isValidProjectName(name: string): boolean {
    // Must be 2-100 characters, alphanumeric with dash/underscore
    return /^[a-zA-Z][a-zA-Z0-9\-_]{1,99}$/.test(name);
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Create sanitizer middleware
 */
export function createSanitizer(options: SanitizerOptions = {}) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            // Validate request body structure
            const { valid, errors } = validateRequestBody(req.body);
            if (!valid) {
                res.status(400).json({
                    error: 'Invalid Request',
                    message: errors.join(', '),
                });
                return;
            }

            // Sanitize body
            if (req.body) {
                req.body = sanitizeObject(req.body, options);
            }

            // Sanitize query parameters
            if (req.query) {
                req.query = sanitizeObject(req.query, options) as typeof req.query;
            }

            // Sanitize URL parameters
            if (req.params) {
                req.params = sanitizeObject(req.params, options) as typeof req.params;
            }

            next();
        } catch (error) {
            console.error('Sanitization error:', error);
            res.status(400).json({
                error: 'Invalid Request',
                message: 'Request could not be processed',
            });
        }
    };
}

/**
 * File path sanitizer middleware
 */
export function filePathSanitizer(req: Request, res: Response, next: NextFunction): void {
    // Check path parameters for file paths
    const pathParams = ['path', 'filePath', 'file', 'filename'];

    for (const param of pathParams) {
        if (req.params[param]) {
            if (!isValidPath(req.params[param])) {
                res.status(400).json({
                    error: 'Invalid Path',
                    message: 'File path contains invalid characters or traversal attempts',
                });
                return;
            }
            req.params[param] = sanitizePath(req.params[param]);
        }

        if (req.body?.[param]) {
            if (!isValidPath(req.body[param])) {
                res.status(400).json({
                    error: 'Invalid Path',
                    message: 'File path contains invalid characters or traversal attempts',
                });
                return;
            }
            req.body[param] = sanitizePath(req.body[param]);
        }
    }

    next();
}

/**
 * Project name validator middleware
 */
export function projectNameValidator(req: Request, res: Response, next: NextFunction): void {
    const nameParams = ['projectName', 'name', 'siteName'];

    for (const param of nameParams) {
        const value = req.params[param] || req.body?.[param];

        if (value && !isValidProjectName(value)) {
            res.status(400).json({
                error: 'Invalid Project Name',
                message: 'Project name must be 2-100 characters, start with a letter, and contain only letters, numbers, dashes, and underscores',
            });
            return;
        }
    }

    next();
}

/**
 * URL validator middleware
 */
export function urlValidator(req: Request, res: Response, next: NextFunction): void {
    const urlParams = ['url', 'webhookUrl', 'callbackUrl', 'redirectUrl', 'figmaUrl', 'githubUrl'];

    for (const param of urlParams) {
        const value = req.body?.[param];

        if (value) {
            const sanitizedUrl = sanitizeUrl(value);
            if (!sanitizedUrl && value) {
                res.status(400).json({
                    error: 'Invalid URL',
                    message: `${param} must be a valid HTTP or HTTPS URL`,
                });
                return;
            }
            req.body[param] = sanitizedUrl;
        }
    }

    next();
}

/**
 * Prompt sanitizer - allows more characters for AI prompts but still safe
 */
export function promptSanitizer(req: Request, res: Response, next: NextFunction): void {
    if (req.body?.prompt) {
        // For prompts, we only strip truly dangerous patterns
        let prompt = req.body.prompt;

        // Remove null bytes
        prompt = prompt.replace(/\0/g, '');

        // Remove potential command injection
        prompt = prompt
            .replace(/\$\([^)]*\)/g, '')  // $(command)
            .replace(/`[^`]*`/g, '')      // `command`
            .replace(/\$\{[^}]*\}/g, ''); // ${var}

        // Limit length to 100KB
        if (prompt.length > 100 * 1024) {
            prompt = prompt.slice(0, 100 * 1024);
        }

        req.body.prompt = prompt;
    }

    next();
}

// ============================================================================
// DEFAULT MIDDLEWARE INSTANCE
// ============================================================================

/**
 * Default sanitizer with sensible defaults
 */
export const sanitizer = createSanitizer({
    allowHtml: false,
    maxLength: 50000,
    stripNull: true,
});

/**
 * Combined sanitization middleware
 */
export function fullSanitization(req: Request, res: Response, next: NextFunction): void {
    // Apply all sanitization in sequence
    sanitizer(req, res, (err) => {
        if (err) return next(err);
        filePathSanitizer(req, res, (err) => {
            if (err) return next(err);
            urlValidator(req, res, next);
        });
    });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
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
};

