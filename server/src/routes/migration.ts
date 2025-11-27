/**
 * Migration API Routes
 *
 * Endpoints for project migration and export.
 */

import { Router } from 'express';
import { getMigrationService } from '../services/migration/migration-service.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const migrationService = getMigrationService();

// ============================================================================
// PROJECT ANALYSIS
// ============================================================================

// Analyze project for migration
router.post('/analyze', async (req, res) => {
    const { projectFiles } = req.body;

    if (!projectFiles || typeof projectFiles !== 'object') {
        return res.status(400).json({ message: 'Project files are required' });
    }

    try {
        const analysis = await migrationService.analyzeProject(projectFiles);
        res.status(200).json(analysis);
    } catch (error) {
        console.error('Error analyzing project:', error);
        res.status(500).json({
            message: 'Failed to analyze project',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// MIGRATION PLANNING
// ============================================================================

// Create migration plan
router.post('/plan', async (req, res) => {
    const { sourceProject, targetPlatform, targetUrl, includeBackend, transferIntegrations, assistanceLevel } = req.body;

    if (!sourceProject || !targetPlatform) {
        return res.status(400).json({ message: 'Source project and target platform are required' });
    }

    try {
        const plan = await migrationService.createMigrationPlan({
            sourceProject,
            targetPlatform,
            targetUrl,
            includeBackend: includeBackend ?? true,
            transferIntegrations: transferIntegrations ?? true,
            assistanceLevel: assistanceLevel ?? 'full-ai',
        });

        res.status(201).json({ plan });
    } catch (error) {
        console.error('Error creating migration plan:', error);
        res.status(500).json({
            message: 'Failed to create migration plan',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// MIGRATION EXECUTION
// ============================================================================

// Execute migration
router.post('/execute', async (req, res) => {
    const { plan, projectFiles } = req.body;

    if (!plan || !projectFiles) {
        return res.status(400).json({ message: 'Migration plan and project files are required' });
    }

    // Set up SSE for progress updates
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const result = await migrationService.executeMigration(
            plan,
            projectFiles,
            (step) => {
                // Send progress update
                res.write(`data: ${JSON.stringify({ type: 'progress', step })}\n\n`);
            }
        );

        // Send final result
        res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
        res.end();
    } catch (error) {
        console.error('Error executing migration:', error);
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        })}\n\n`);
        res.end();
    }
});

// ============================================================================
// PLATFORM CONFIGURATION
// ============================================================================

// Generate platform configuration files
router.post('/config', async (req, res) => {
    const { platform, analysis } = req.body;

    if (!platform || !analysis) {
        return res.status(400).json({ message: 'Platform and analysis are required' });
    }

    try {
        const config = migrationService.generatePlatformConfig(platform, analysis);
        res.status(200).json({ config });
    } catch (error) {
        console.error('Error generating platform config:', error);
        res.status(500).json({
            message: 'Failed to generate platform configuration',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// EXPORT
// ============================================================================

// Export project as archive
router.post('/export', async (req, res) => {
    const { projectFiles, platform, analysis } = req.body;

    if (!projectFiles) {
        return res.status(400).json({ message: 'Project files are required' });
    }

    try {
        // Get analysis if not provided
        const projectAnalysis = analysis || await migrationService.analyzeProject(projectFiles);
        const targetPlatform = platform || 'self-hosted';

        const archive = await migrationService.exportProject(projectFiles, targetPlatform, projectAnalysis);

        // Set headers for file download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="kriptik-export-${Date.now()}.zip"`);

        // Convert Blob to Buffer and send
        const arrayBuffer = await archive.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (error) {
        console.error('Error exporting project:', error);
        res.status(500).json({
            message: 'Failed to export project',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// PLATFORM INFO
// ============================================================================

// Get supported platforms
router.get('/platforms', async (_req, res) => {
    const platforms = [
        {
            id: 'vercel',
            name: 'Vercel',
            description: 'Zero-config deployments for frontend and serverless',
            features: ['Automatic HTTPS', 'Edge Functions', 'Preview Deployments'],
            requiresAuth: true,
        },
        {
            id: 'netlify',
            name: 'Netlify',
            description: 'All-in-one platform for web projects',
            features: ['Form Handling', 'Identity', 'Functions'],
            requiresAuth: true,
        },
        {
            id: 'cloudflare',
            name: 'Cloudflare Pages',
            description: 'JAMstack platform with edge computing',
            features: ['Workers', 'KV Storage', 'Durable Objects'],
            requiresAuth: true,
        },
        {
            id: 'aws-amplify',
            name: 'AWS Amplify',
            description: 'Full-stack AWS-powered hosting',
            features: ['GraphQL API', 'Authentication', 'Storage'],
            requiresAuth: true,
        },
        {
            id: 'railway',
            name: 'Railway',
            description: 'Instant infrastructure deployment',
            features: ['Databases', 'Auto Scaling', 'Private Networks'],
            requiresAuth: true,
        },
        {
            id: 'fly',
            name: 'Fly.io',
            description: 'Global application platform',
            features: ['Edge Regions', 'Machines', 'Volumes'],
            requiresAuth: true,
        },
        {
            id: 'self-hosted',
            name: 'Self-Hosted (Docker)',
            description: 'Export as Docker container for any host',
            features: ['Full Control', 'Any Provider', 'Air-Gapped'],
            requiresAuth: false,
        },
    ];

    res.status(200).json({ platforms });
});

export default router;

