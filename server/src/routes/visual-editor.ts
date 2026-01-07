/**
 * Visual Editor API Routes
 *
 * Endpoints for the Visual Property Panel and Point-and-Prompt system.
 * Provides AI-assisted style generation and validation.
 */

import { Router, type Request } from 'express';
import { getPromptToStyleService, antiSlopValidator, getPropExtractionService, type StyleEntry } from '../services/visual-editor/index.js';

const router = Router();

// Helper to get user ID from request
function getRequestUserId(req: Request): string | null {
  const sessionUserId = (req as any).user?.id;
  const legacyUserId = (req as any).userId;
  const headerUserId = req.headers['x-user-id'];

  if (typeof sessionUserId === 'string' && sessionUserId.length > 0) return sessionUserId;
  if (typeof legacyUserId === 'string' && legacyUserId.length > 0) return legacyUserId;
  if (typeof headerUserId === 'string' && headerUserId.length > 0) return headerUserId;
  return null;
}

// =============================================================================
// POINT-AND-PROMPT: AI Style Generation
// =============================================================================

/**
 * POST /api/visual-editor/element-prompt
 * Generate styles from a natural language prompt for a specific element
 */
router.post('/element-prompt', async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { prompt, elementContext, projectContext, projectId } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!elementContext || typeof elementContext !== 'object') {
    return res.status(400).json({ error: 'Element context is required' });
  }

  try {
    const promptToStyleService = getPromptToStyleService();
    const result = await promptToStyleService.generateStylesFromPrompt({
      prompt,
      elementContext,
      projectContext,
      userId,
      projectId,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Visual Editor] Error generating styles from prompt:', error);
    res.status(500).json({
      error: 'Failed to generate styles',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/visual-editor/validate-styles
 * Validate styles against anti-slop rules
 */
router.post('/validate-styles', async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { styles } = req.body;

  if (!styles || !Array.isArray(styles)) {
    return res.status(400).json({ error: 'Styles array is required' });
  }

  try {
    const validation = antiSlopValidator.validateStyles(styles as StyleEntry[]);

    res.status(200).json({
      success: true,
      ...validation,
    });
  } catch (error) {
    console.error('[Visual Editor] Error validating styles:', error);
    res.status(500).json({
      error: 'Failed to validate styles',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/visual-editor/design-score
 * Get design quality score for styles
 */
router.post('/design-score', async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { styles } = req.body;

  if (!styles || !Array.isArray(styles)) {
    return res.status(400).json({ error: 'Styles array is required' });
  }

  try {
    const score = antiSlopValidator.getDesignScore(styles as StyleEntry[]);
    const validation = antiSlopValidator.validateStyles(styles as StyleEntry[]);

    res.status(200).json({
      success: true,
      score,
      designPrincipleScores: validation.designPrincipleScores,
      suggestions: validation.suggestions,
    });
  } catch (error) {
    console.error('[Visual Editor] Error calculating design score:', error);
    res.status(500).json({
      error: 'Failed to calculate design score',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/visual-editor/suggest-improvements
 * Get improvement suggestions for a specific style property
 */
router.post('/suggest-improvements', async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { property, value } = req.body;

  if (!property || !value) {
    return res.status(400).json({ error: 'Property and value are required' });
  }

  try {
    const suggestions = antiSlopValidator.suggestImprovements(property, value);
    const isValid = antiSlopValidator.isValidValue(property, value);

    res.status(200).json({
      success: true,
      isValid,
      suggestions,
    });
  } catch (error) {
    console.error('[Visual Editor] Error suggesting improvements:', error);
    res.status(500).json({
      error: 'Failed to suggest improvements',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * POST /api/visual-editor/batch-generate
 * Generate styles for multiple elements in a batch
 */
router.post('/batch-generate', async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { requests, projectContext, projectId } = req.body;

  if (!requests || !Array.isArray(requests)) {
    return res.status(400).json({ error: 'Requests array is required' });
  }

  if (requests.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 requests per batch' });
  }

  try {
    const promptToStyleService = getPromptToStyleService();
    const results = await Promise.all(
      requests.map(async (request: { prompt: string; elementContext: any }) => {
        try {
          return await promptToStyleService.generateStylesFromPrompt({
            prompt: request.prompt,
            elementContext: request.elementContext,
            projectContext,
            userId,
            projectId,
          });
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : 'Unknown error',
            styles: [],
            tailwindClasses: [],
            cssDeclarations: '',
            inlineStyle: '',
            validation: { isValid: false, score: 0, blockers: [], warnings: [], suggestions: [], designPrincipleScores: { depth: 0, motion: 0, typography: 0, color: 0, layout: 0 } },
            suggestions: [],
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      results,
      totalProcessed: results.length,
      successCount: results.filter((r: any) => !r.error).length,
    });
  } catch (error) {
    console.error('[Visual Editor] Error in batch generation:', error);
    res.status(500).json({
      error: 'Failed to process batch',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =============================================================================
// DESIGN TOKENS
// =============================================================================

/**
 * GET /api/visual-editor/design-tokens
 * Get KripTik design tokens for the visual editor
 */
router.get('/design-tokens', async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Return KripTik design tokens
    const tokens = {
      colors: {
        primary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        neutral: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#0f0f11',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px',
      },
      shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.12)',
        glow: '0 0 20px rgba(234, 179, 8, 0.3)',
      },
      fonts: {
        sans: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        mono: "'Space Mono', 'SF Mono', monospace",
        display: "'Space Grotesk', 'DM Sans', sans-serif",
      },
    };

    res.status(200).json({
      success: true,
      tokens,
    });
  } catch (error) {
    console.error('[Visual Editor] Error fetching design tokens:', error);
    res.status(500).json({
      error: 'Failed to fetch design tokens',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =============================================================================
// STYLE CONVERSION
// =============================================================================

/**
 * POST /api/visual-editor/convert-styles
 * Convert styles between formats (Tailwind, CSS, inline)
 */
router.post('/convert-styles', async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { styles, targetFormat } = req.body;

  if (!styles || !Array.isArray(styles)) {
    return res.status(400).json({ error: 'Styles array is required' });
  }

  if (!targetFormat || !['tailwind', 'css', 'inline'].includes(targetFormat)) {
    return res.status(400).json({ error: 'Valid target format is required (tailwind, css, inline)' });
  }

  try {
    let result: string | string[] = '';

    switch (targetFormat) {
      case 'tailwind':
        result = (styles as StyleEntry[])
          .filter(s => s.tailwindClass)
          .map(s => s.tailwindClass as string);
        break;

      case 'css':
        result = (styles as StyleEntry[])
          .map(s => {
            const kebabProperty = s.property.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `${kebabProperty}: ${s.value};`;
          })
          .join('\n');
        break;

      case 'inline':
        result = (styles as StyleEntry[])
          .map(s => `${s.property}: ${s.value}`)
          .join('; ');
        break;
    }

    res.status(200).json({
      success: true,
      format: targetFormat,
      result,
    });
  } catch (error) {
    console.error('[Visual Editor] Error converting styles:', error);
    res.status(500).json({
      error: 'Failed to convert styles',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =============================================================================
// PROPS INSPECTOR
// =============================================================================

/**
 * POST /api/visual-editor/extract-props
 * Extract props from a React component source code
 */
router.post('/extract-props', async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { sourceCode, filePath } = req.body;

  if (!sourceCode || typeof sourceCode !== 'string') {
    return res.status(400).json({ error: 'Source code is required' });
  }

  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'File path is required' });
  }

  try {
    const propExtractionService = getPropExtractionService();
    const result = propExtractionService.extractProps(sourceCode, filePath);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Visual Editor] Error extracting props:', error);
    res.status(500).json({
      error: 'Failed to extract props',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/visual-editor/element-props/:tagName
 * Get standard HTML element props for a tag
 */
router.get('/element-props/:tagName', async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { tagName } = req.params;

  if (!tagName) {
    return res.status(400).json({ error: 'Tag name is required' });
  }

  try {
    const propExtractionService = getPropExtractionService();
    const props = propExtractionService.getStandardElementProps(tagName);

    res.status(200).json({
      success: true,
      tagName,
      props,
    });
  } catch (error) {
    console.error('[Visual Editor] Error getting element props:', error);
    res.status(500).json({
      error: 'Failed to get element props',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
