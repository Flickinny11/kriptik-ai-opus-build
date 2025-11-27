/**
 * Template API Routes
 * 
 * Endpoints for browsing, matching, and instantiating templates.
 */

import { Router, Request, Response } from 'express';
import { 
    getTemplateLibrary, 
    getTemplateMatcher, 
    getTemplateInstantiator,
    TemplateSearchQuery,
    TemplateInstantiationRequest,
} from '../services/templates/index.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (browsing)
// ============================================================================

/**
 * GET /api/templates
 * List all available templates
 */
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const library = getTemplateLibrary();
        const { category, framework, search } = req.query;

        let templates = library.getAllTemplates();

        // Filter by category
        if (category && typeof category === 'string') {
            templates = templates.filter(t => 
                t.categories.includes(category as never)
            );
        }

        // Filter by framework
        if (framework && typeof framework === 'string') {
            templates = templates.filter(t => t.framework === framework);
        }

        // Search filter
        if (search && typeof search === 'string') {
            const searchLower = search.toLowerCase();
            templates = templates.filter(t => 
                t.name.toLowerCase().includes(searchLower) ||
                t.description.toLowerCase().includes(searchLower) ||
                t.tags.some(tag => tag.toLowerCase().includes(searchLower))
            );
        }

        // Return templates without full file contents for listing
        const templatesWithoutFiles = templates.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            shortDescription: t.shortDescription,
            categories: t.categories,
            tags: t.tags,
            framework: t.framework,
            uiLibrary: t.uiLibrary,
            database: t.database,
            auth: t.auth,
            complexity: t.complexity,
            estimatedSetupTime: t.estimatedSetupTime,
            popularity: t.popularity,
            previewImage: t.previewImage,
            demoUrl: t.demoUrl,
        }));

        res.json({
            success: true,
            templates: templatesWithoutFiles,
            total: templatesWithoutFiles.length,
        });
    } catch (error) {
        console.error('Error listing templates:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to list templates' 
        });
    }
});

/**
 * GET /api/templates/library
 * Get library info with categories and frameworks
 */
router.get('/library', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const library = getTemplateLibrary();
        const info = library.getLibraryInfo();

        res.json({
            success: true,
            ...info,
        });
    } catch (error) {
        console.error('Error getting library info:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get library info' 
        });
    }
});

/**
 * GET /api/templates/:id
 * Get a specific template by ID
 */
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const library = getTemplateLibrary();
        const template = library.getTemplate(req.params.id);

        if (!template) {
            res.status(404).json({
                success: false,
                error: 'Template not found',
            });
            return;
        }

        res.json({
            success: true,
            template,
        });
    } catch (error) {
        console.error('Error getting template:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get template' 
        });
    }
});

// ============================================================================
// MATCHING ROUTES
// ============================================================================

/**
 * POST /api/templates/match
 * Find matching templates based on a prompt
 */
router.post('/match', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const { prompt, categories, frameworks, complexity, useAI } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Prompt is required',
            });
            return;
        }

        const matcher = getTemplateMatcher();
        
        const query: TemplateSearchQuery = {
            prompt,
            categories,
            frameworks,
            complexity,
        };

        let matches;
        
        if (useAI && process.env.OPENROUTER_API_KEY) {
            const bestMatch = await matcher.getAIEnhancedMatch(
                prompt,
                process.env.OPENROUTER_API_KEY
            );
            matches = bestMatch ? [bestMatch] : [];
        } else {
            matches = await matcher.findMatches(query);
        }

        res.json({
            success: true,
            matches: matches.map(m => ({
                template: {
                    id: m.template.id,
                    name: m.template.name,
                    description: m.template.shortDescription,
                    categories: m.template.categories,
                    framework: m.template.framework,
                    complexity: m.template.complexity,
                },
                score: m.score,
                matchReasons: m.matchReasons,
                suggestedVariables: m.suggestedVariables,
            })),
        });
    } catch (error) {
        console.error('Error matching templates:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to match templates' 
        });
    }
});

/**
 * POST /api/templates/best-match
 * Get the single best matching template
 */
router.post('/best-match', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Prompt is required',
            });
            return;
        }

        const matcher = getTemplateMatcher();
        const match = await matcher.getAIEnhancedMatch(
            prompt,
            process.env.OPENROUTER_API_KEY
        );

        if (!match) {
            res.json({
                success: true,
                match: null,
                message: 'No matching templates found',
            });
            return;
        }

        res.json({
            success: true,
            match: {
                template: {
                    id: match.template.id,
                    name: match.template.name,
                    description: match.template.shortDescription,
                    categories: match.template.categories,
                    framework: match.template.framework,
                },
                score: match.score,
                matchReasons: match.matchReasons,
                suggestedVariables: match.suggestedVariables,
            },
        });
    } catch (error) {
        console.error('Error finding best match:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to find best match' 
        });
    }
});

// ============================================================================
// INSTANTIATION ROUTES (requires auth)
// ============================================================================

/**
 * POST /api/templates/instantiate
 * Instantiate a template into project files
 */
router.post('/instantiate', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { templateId, projectName, variables, customizations } = req.body;

        if (!templateId || typeof templateId !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Template ID is required',
            });
            return;
        }

        if (!projectName || typeof projectName !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Project name is required',
            });
            return;
        }

        const instantiator = getTemplateInstantiator();
        
        const request: TemplateInstantiationRequest = {
            templateId,
            projectName,
            variables: variables || { projectName },
            customizations,
        };

        const result = await instantiator.instantiate(request);

        if (!result.success) {
            res.status(400).json({
                success: false,
                errors: result.warnings,
            });
            return;
        }

        res.json({
            success: true,
            files: result.files.map(f => ({
                path: f.path,
                content: f.content,
                language: f.language,
                size: f.size,
            })),
            dependencies: result.dependencies,
            devDependencies: result.devDependencies,
            setupInstructions: result.setupInstructions,
        });
    } catch (error) {
        console.error('Error instantiating template:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to instantiate template' 
        });
    }
});

/**
 * POST /api/templates/quick-start
 * Quick start with a template and project name
 */
router.post('/quick-start', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { prompt, projectName } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Prompt is required',
            });
            return;
        }

        const name = projectName || 'my-project';

        // Find best matching template
        const matcher = getTemplateMatcher();
        const match = await matcher.getAIEnhancedMatch(
            prompt,
            process.env.OPENROUTER_API_KEY
        );

        if (!match) {
            res.status(404).json({
                success: false,
                error: 'No matching templates found for your description',
            });
            return;
        }

        // Instantiate the template
        const instantiator = getTemplateInstantiator();
        const result = await instantiator.quickInstantiate(match.template.id, name);

        if (!result.success) {
            res.status(400).json({
                success: false,
                errors: result.warnings,
            });
            return;
        }

        res.json({
            success: true,
            matchedTemplate: {
                id: match.template.id,
                name: match.template.name,
                matchReasons: match.matchReasons,
            },
            files: result.files.map(f => ({
                path: f.path,
                content: f.content,
                language: f.language,
            })),
            dependencies: result.dependencies,
            devDependencies: result.devDependencies,
            setupInstructions: result.setupInstructions,
        });
    } catch (error) {
        console.error('Error in quick start:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to quick start project' 
        });
    }
});

export default router;

