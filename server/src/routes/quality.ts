/**
 * Code Quality API Routes
 *
 * Endpoints for linting, formatting, and code review.
 */

import { Router } from 'express';
import { getCodeQualityService } from '../services/quality/code-quality';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const qualityService = getCodeQualityService();

// ============================================================================
// LINTING
// ============================================================================

// Run ESLint on code
router.post('/lint', async (req, res) => {
    const { files, config } = req.body;

    if (!files || typeof files !== 'object') {
        return res.status(400).json({ message: 'Files are required' });
    }

    try {
        const results = await qualityService.runESLint(files, config);

        const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
        const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);

        res.status(200).json({
            results,
            summary: {
                totalFiles: results.length,
                totalErrors,
                totalWarnings,
                totalFixable: results.reduce((sum, r) => sum + r.fixable, 0),
            },
        });
    } catch (error) {
        console.error('Error running ESLint:', error);
        res.status(500).json({
            message: 'Failed to run linting',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// FORMATTING
// ============================================================================

// Format code with Prettier
router.post('/format', async (req, res) => {
    const { files, config } = req.body;

    if (!files || typeof files !== 'object') {
        return res.status(400).json({ message: 'Files are required' });
    }

    try {
        const results = await qualityService.formatWithPrettier(files, config);

        res.status(200).json({
            results,
            summary: {
                totalFiles: results.length,
                filesChanged: results.filter(r => r.changed).length,
            },
        });
    } catch (error) {
        console.error('Error formatting code:', error);
        res.status(500).json({
            message: 'Failed to format code',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// CODE REVIEW
// ============================================================================

// Run AI code review
router.post('/review', async (req, res) => {
    const { files, context, provider } = req.body;

    if (!files || typeof files !== 'object') {
        return res.status(400).json({ message: 'Files are required' });
    }

    try {
        let review;

        if (provider === 'coderabbit') {
            review = await qualityService.runCodeRabbitReview(files);
        } else {
            review = await qualityService.runAICodeReview(files, context);
        }

        res.status(200).json({ review });
    } catch (error) {
        console.error('Error running code review:', error);
        res.status(500).json({
            message: 'Failed to run code review',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// SECURITY
// ============================================================================

// Run security scan
router.post('/security', async (req, res) => {
    const { files } = req.body;

    if (!files || typeof files !== 'object') {
        return res.status(400).json({ message: 'Files are required' });
    }

    try {
        const findings = await qualityService.runSecurityScan(files);

        res.status(200).json({
            findings,
            summary: {
                totalFindings: findings.length,
                critical: findings.filter(f => f.severity === 'critical').length,
                high: findings.filter(f => f.severity === 'high').length,
                medium: findings.filter(f => f.severity === 'medium').length,
                low: findings.filter(f => f.severity === 'low').length,
            },
        });
    } catch (error) {
        console.error('Error running security scan:', error);
        res.status(500).json({
            message: 'Failed to run security scan',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// COMPREHENSIVE CHECK
// ============================================================================

// Run all quality checks
router.post('/check-all', async (req, res) => {
    const { files, config } = req.body;

    if (!files || typeof files !== 'object') {
        return res.status(400).json({ message: 'Files are required' });
    }

    try {
        const results = await qualityService.runAllChecks(files, config);

        res.status(200).json(results);
    } catch (error) {
        console.error('Error running quality checks:', error);
        res.status(500).json({
            message: 'Failed to run quality checks',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;

