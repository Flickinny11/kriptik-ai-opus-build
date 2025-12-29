/**
 * Code Quality API Routes
 *
 * Endpoints for linting, formatting, and code review.
 */

import { Router, type Request } from 'express';
import { getCodeQualityService } from '../services/quality/code-quality.js';
import { db } from '../db.js';
import { files as filesTable, projects } from '../schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();
function getRequestUserId(req: Request): string | null {
    const sessionUserId = (req as any).user?.id;
    const legacyUserId = (req as any).userId;
    const headerUserId = req.headers['x-user-id'];

    if (typeof sessionUserId === 'string' && sessionUserId.length > 0) return sessionUserId;
    if (typeof legacyUserId === 'string' && legacyUserId.length > 0) return legacyUserId;
    if (typeof headerUserId === 'string' && headerUserId.length > 0) return headerUserId;
    return null;
}

const qualityService = getCodeQualityService();

// ============================================================================
// LINTING
// ============================================================================

// Run ESLint on code
router.post('/lint', async (req, res) => {
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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

// ============================================================================
// PROJECT-SPECIFIC QUALITY CHECKS
// ============================================================================

/**
 * POST /api/quality/:projectId/check
 * Run comprehensive quality checks on a project's files
 */
router.post('/:projectId/check', async (req, res) => {
    const userId = getRequestUserId(req);
    const { projectId } = req.params;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Verify project exists and belongs to user
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get project files
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        if (projectFiles.length === 0) {
            return res.status(200).json({
                lint: [],
                format: [],
                review: {
                    id: '',
                    summary: 'No files to check',
                    score: 100,
                    issues: [],
                    suggestions: [],
                    security: [],
                    performance: [],
                },
                security: [],
                overallScore: 100,
                status: 'pass',
            });
        }

        // Convert to files map
        const files: Record<string, string> = {};
        for (const file of projectFiles) {
            files[file.path] = file.content;
        }

        // Run all checks
        const results = await qualityService.runAllChecks(files);

        // Calculate overall score
        const lintScore = Math.max(0, 100 - results.lint.reduce((sum, r) =>
            sum + r.errorCount * 5 + r.warningCount * 1, 0));
        const securityScore = Math.max(0, 100 - results.security.reduce((sum, s) => {
            if (s.severity === 'critical') return sum + 25;
            if (s.severity === 'high') return sum + 15;
            if (s.severity === 'medium') return sum + 8;
            return sum + 3;
        }, 0));
        const reviewScore = results.review.score;

        const overallScore = Math.round((lintScore + securityScore + reviewScore) / 3);

        // Determine status
        let status: 'pass' | 'pass_with_warnings' | 'fail' = 'pass';
        if (overallScore < 50 || results.security.some(s => s.severity === 'critical')) {
            status = 'fail';
        } else if (overallScore < 80 || results.lint.some(r => r.errorCount > 0)) {
            status = 'pass_with_warnings';
        }

        res.status(200).json({
            ...results,
            overallScore,
            status,
            categories: {
                security: {
                    score: securityScore,
                    issues: results.security.map(s => ({
                        id: s.id,
                        category: 'security',
                        severity: s.severity === 'critical' || s.severity === 'high' ? 'critical' : 'warning',
                        message: s.description,
                        file: s.file,
                        line: s.line,
                        fixAvailable: true,
                        description: s.remediation,
                    })),
                },
                quality: {
                    score: lintScore,
                    issues: results.lint.flatMap(r =>
                        r.issues.map(i => ({
                            id: `lint-${r.file}-${i.line}-${i.column}`,
                            category: 'quality',
                            severity: i.severity === 'error' ? 'critical' : i.severity,
                            message: i.message,
                            file: r.file,
                            line: i.line,
                            fixAvailable: !!i.fix,
                            description: `Rule: ${i.ruleId}`,
                        }))
                    ),
                },
                testing: {
                    score: 85, // Would need test coverage data
                    issues: [],
                },
                accessibility: {
                    score: reviewScore,
                    issues: results.review.issues
                        .filter(i => i.message.toLowerCase().includes('accessibility') || i.message.toLowerCase().includes('a11y'))
                        .map(i => ({
                            id: i.id,
                            category: 'accessibility',
                            severity: i.severity === 'critical' ? 'critical' : 'warning',
                            message: i.message,
                            file: i.file,
                            fixAvailable: !!i.suggestion,
                            description: i.suggestion || '',
                        })),
                },
                performance: {
                    score: 90, // Would need performance analysis
                    issues: results.review.performance?.map(p => ({
                        id: p.id,
                        category: 'performance',
                        severity: p.impact === 'high' ? 'critical' : 'info',
                        message: p.description,
                        file: p.file,
                        fixAvailable: true,
                        description: p.suggestion,
                    })) || [],
                },
            },
        });
    } catch (error) {
        console.error('Error running project quality checks:', error);
        res.status(500).json({
            error: 'Failed to run quality checks',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/quality/:projectId/report
 * Get the last quality report for a project (cached)
 */
router.get('/:projectId/report', async (req, res) => {
    const userId = getRequestUserId(req);
    const { projectId } = req.params;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Verify project exists and belongs to user
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // For now, run a fresh check - in production you'd cache this
        // Redirect to POST endpoint behavior
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        if (projectFiles.length === 0) {
            return res.status(200).json({
                overallScore: 100,
                status: 'pass',
                categories: {},
            });
        }

        const files: Record<string, string> = {};
        for (const file of projectFiles) {
            files[file.path] = file.content;
        }

        const results = await qualityService.runAllChecks(files);

        res.status(200).json({
            ...results,
            overallScore: results.review.score,
            status: results.review.score >= 80 ? 'pass' : 'pass_with_warnings',
        });
    } catch (error) {
        console.error('Error getting quality report:', error);
        res.status(500).json({
            error: 'Failed to get quality report',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;

