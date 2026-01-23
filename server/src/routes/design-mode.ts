/**
 * Design Mode API Routes
 *
 * Endpoints for UI mockup generation, blueprint creation,
 * and semantic page analysis for the Design Mode feature.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getUIMockupGeneratorService } from '../services/ai/ui-mockup-generator.js';
import { getUIBlueprintService } from '../services/ai/ui-blueprint-service.js';
import { getSemanticPageAnalyzer } from '../services/ai/semantic-page-analyzer.js';
import { getUIGeneratorProvider } from '../services/embeddings/providers/runpod-ui-generator.js';

const router = Router();

// ============================================================================
// Mockup Generation Endpoints
// ============================================================================

/**
 * POST /api/design-mode/mockup/generate
 * Generate a UI mockup from natural language description
 */
router.post('/mockup/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      prompt,
      viewName,
      styleDescription,
      platform,
      stylePreferences,
      planContext,
      existingComponents,
    } = req.body;

    if (!prompt || !viewName) {
      return res.status(400).json({
        error: 'Missing required fields: prompt, viewName',
      });
    }

    const mockupService = getUIMockupGeneratorService();
    const result = await mockupService.generate({
      prompt,
      viewName,
      styleDescription,
      platform: platform || 'web',
      stylePreferences,
      planContext,
      existingComponents,
    });

    res.json({
      success: true,
      mockup: {
        id: result.id,
        viewName: result.viewName,
        imageBase64: result.imageBase64,
        imagePrompt: result.imagePrompt,
        elements: result.elements,
        matchRate: result.matchRate,
        inferenceTime: result.inferenceTime,
        generatedAt: result.generatedAt,
      },
    });
  } catch (error) {
    console.error('[Design-Mode] Mockup generation failed:', error);
    next(error);
  }
});

/**
 * POST /api/design-mode/mockup/generate-batch
 * Generate mockups for multiple views (from implementation plan)
 */
router.post('/mockup/generate-batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { views, stylePreferences, planContext } = req.body;

    if (!views || !Array.isArray(views) || views.length === 0) {
      return res.status(400).json({
        error: 'Missing required field: views (array)',
      });
    }

    const mockupService = getUIMockupGeneratorService();
    const results = [];

    for (const view of views) {
      try {
        const result = await mockupService.generate({
          prompt: view.description,
          viewName: view.name,
          platform: view.platform || 'web',
          stylePreferences,
          planContext,
        });

        results.push({
          viewName: view.name,
          success: true,
          mockup: {
            id: result.id,
            imageBase64: result.imageBase64,
            elements: result.elements,
            matchRate: result.matchRate,
          },
        });
      } catch (error) {
        results.push({
          viewName: view.name,
          success: false,
          error: error instanceof Error ? error.message : 'Generation failed',
        });
      }
    }

    res.json({
      success: true,
      results,
      totalViews: views.length,
      successfulViews: results.filter(r => r.success).length,
    });
  } catch (error) {
    console.error('[Design-Mode] Batch generation failed:', error);
    next(error);
  }
});

/**
 * POST /api/design-mode/mockup/variations
 * Generate multiple variations of a mockup
 */
router.post('/mockup/variations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, viewName, platform, stylePreferences, count = 3 } = req.body;

    if (!prompt || !viewName) {
      return res.status(400).json({
        error: 'Missing required fields: prompt, viewName',
      });
    }

    const mockupService = getUIMockupGeneratorService();
    const results = await mockupService.generateVariations(
      { prompt, viewName, platform, stylePreferences },
      Math.min(count, 5) // Max 5 variations
    );

    res.json({
      success: true,
      variations: results.map(r => ({
        id: r.id,
        viewName: r.viewName,
        imageBase64: r.imageBase64,
        matchRate: r.matchRate,
        inferenceTime: r.inferenceTime,
      })),
    });
  } catch (error) {
    console.error('[Design-Mode] Variations generation failed:', error);
    next(error);
  }
});

/**
 * POST /api/design-mode/mockup/modify
 * Modify an existing mockup based on user feedback
 */
router.post('/mockup/modify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mockupId, prompt, elementId } = req.body;

    if (!mockupId || !prompt) {
      return res.status(400).json({
        error: 'Missing required fields: mockupId, prompt',
      });
    }

    const mockupService = getUIMockupGeneratorService();
    const result = await mockupService.modify({
      mockupId,
      prompt,
      elementId,
    });

    res.json({
      success: true,
      mockup: {
        id: result.id,
        viewName: result.viewName,
        imageBase64: result.imageBase64,
        elements: result.elements,
        matchRate: result.matchRate,
        inferenceTime: result.inferenceTime,
      },
    });
  } catch (error) {
    console.error('[Design-Mode] Mockup modification failed:', error);
    next(error);
  }
});

/**
 * GET /api/design-mode/mockup/:id
 * Get a mockup by ID
 */
router.get('/mockup/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const mockupService = getUIMockupGeneratorService();
    const mockup = mockupService.getMockup(id);

    if (!mockup) {
      return res.status(404).json({
        error: 'Mockup not found',
      });
    }

    res.json({
      success: true,
      mockup: {
        id: mockup.id,
        viewName: mockup.viewName,
        imageBase64: mockup.imageBase64,
        blueprint: mockup.blueprint,
        elements: mockup.elements,
        matchRate: mockup.matchRate,
        generatedAt: mockup.generatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Blueprint Endpoints
// ============================================================================

/**
 * POST /api/design-mode/blueprint/generate
 * Generate a UISceneBlueprint from natural language
 */
router.post('/blueprint/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, viewName, platform, stylePreferences, planContext } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: 'Missing required field: prompt',
      });
    }

    const blueprintService = getUIBlueprintService();
    const result = await blueprintService.generateBlueprint({
      prompt,
      viewName,
      platform,
      stylePreferences,
      planContext,
    });

    res.json({
      success: true,
      blueprint: result.blueprint,
      imagePrompt: result.imagePrompt,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error('[Design-Mode] Blueprint generation failed:', error);
    next(error);
  }
});

/**
 * POST /api/design-mode/blueprint/modify
 * Modify an existing blueprint
 */
router.post('/blueprint/modify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { blueprint, prompt } = req.body;

    if (!blueprint || !prompt) {
      return res.status(400).json({
        error: 'Missing required fields: blueprint, prompt',
      });
    }

    const blueprintService = getUIBlueprintService();
    const result = await blueprintService.modifyBlueprint(blueprint, prompt);

    res.json({
      success: true,
      blueprint: result.blueprint,
      imagePrompt: result.imagePrompt,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error('[Design-Mode] Blueprint modification failed:', error);
    next(error);
  }
});

// ============================================================================
// Semantic Analysis Endpoints
// ============================================================================

/**
 * POST /api/design-mode/analyze/page
 * Analyze an existing page for semantic elements and function bindings
 */
router.post('/analyze/page', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, filePath, screenshotBase64 } = req.body;

    if (!code || !filePath) {
      return res.status(400).json({
        error: 'Missing required fields: code, filePath',
      });
    }

    const analyzer = getSemanticPageAnalyzer();
    const analysis = await analyzer.analyzePage({
      code,
      filePath,
      screenshotBase64,
    });

    res.json({
      success: true,
      analysis: {
        componentName: analysis.componentName,
        filePath: analysis.filePath,
        elements: analysis.elements,
        functions: analysis.functions,
        apiCalls: analysis.apiCalls,
        stateUsage: analysis.stateUsage,
        imports: analysis.imports,
        confidence: analysis.confidence,
      },
    });
  } catch (error) {
    console.error('[Design-Mode] Page analysis failed:', error);
    next(error);
  }
});

/**
 * POST /api/design-mode/analyze/compare
 * Compare existing page with new design
 */
router.post('/analyze/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { analysis, newDesignImage } = req.body;

    if (!analysis || !newDesignImage) {
      return res.status(400).json({
        error: 'Missing required fields: analysis, newDesignImage',
      });
    }

    const analyzer = getSemanticPageAnalyzer();
    const comparison = await analyzer.compareWithDesign(analysis, newDesignImage);

    res.json({
      success: true,
      comparison: {
        newElements: comparison.newElements,
        mappings: comparison.mappings,
        unmappedNewElements: comparison.unmappedNewElements,
        unmappedExistingElements: comparison.unmappedExistingElements,
        overallMatchScore: comparison.overallMatchScore,
      },
    });
  } catch (error) {
    console.error('[Design-Mode] Comparison failed:', error);
    next(error);
  }
});

/**
 * POST /api/design-mode/analyze/replace
 * Generate replacement code preserving functionality
 */
router.post('/analyze/replace', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { analysis, comparison, preserveFunctions = true, preserveState = true } = req.body;

    if (!analysis || !comparison) {
      return res.status(400).json({
        error: 'Missing required fields: analysis, comparison',
      });
    }

    const analyzer = getSemanticPageAnalyzer();
    const replacement = await analyzer.generateReplacement(analysis, comparison, {
      preserveFunctions,
      preserveState,
    });

    res.json({
      success: true,
      replacement: {
        code: replacement.code,
        preservedFunctions: replacement.preservedFunctions.length,
        preservedAPICalls: replacement.preservedAPICalls.length,
        preservedStateUsage: replacement.preservedStateUsage.length,
        requiredImports: replacement.requiredImports,
        userDecisions: replacement.userDecisions,
      },
    });
  } catch (error) {
    console.error('[Design-Mode] Replacement generation failed:', error);
    next(error);
  }
});

// ============================================================================
// Image Generation Endpoints (Direct RunPod)
// ============================================================================

/**
 * POST /api/design-mode/image/generate
 * Generate image directly via RunPod (without blueprint)
 */
router.post('/image/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      prompt,
      platform,
      width,
      height,
      steps,
      cfgScale,
      loraStrength,
      negativePrompt,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: 'Missing required field: prompt',
      });
    }

    const uiGenerator = getUIGeneratorProvider();

    if (!uiGenerator.isConfigured()) {
      return res.status(503).json({
        error: 'UI Generator not configured. Set RUNPOD_UI_GENERATOR_ENDPOINT.',
      });
    }

    const result = await uiGenerator.generate({
      prompt,
      platform,
      width,
      height,
      steps,
      cfgScale,
      loraStrength,
      negativePrompt,
    });

    res.json({
      success: true,
      images: result.images,
      seeds: result.seeds,
      inferenceTime: result.inferenceTime,
      parameters: result.parameters,
    });
  } catch (error) {
    console.error('[Design-Mode] Image generation failed:', error);
    next(error);
  }
});

/**
 * GET /api/design-mode/health
 * Check design mode service health
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uiGenerator = getUIGeneratorProvider();
    const generatorHealth = await uiGenerator.healthCheck();

    res.json({
      success: true,
      services: {
        uiGenerator: generatorHealth,
        mockupService: { healthy: true, name: 'ui-mockup-generator' },
        blueprintService: { healthy: true, name: 'ui-blueprint-service' },
        semanticAnalyzer: { healthy: true, name: 'semantic-page-analyzer' },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
