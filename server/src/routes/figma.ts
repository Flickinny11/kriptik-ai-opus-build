/**
 * Figma API Routes
 *
 * Provides endpoints for Figma integration:
 * - Parse Figma URLs
 * - Fetch Figma designs
 * - Analyze design tokens
 * - Convert Figma to code
 */

import { Router, Request, Response } from 'express';
import { createFigmaService, FigmaService, DesignAnalysis } from '../services/integrations/figma.js';
import { getCredentialVault } from '../services/security/credential-vault.js';
import { getImageToCodeService } from '../services/ai/image-to-code.js';

const router = Router();

/**
 * Get or create Figma service for a user
 */
async function getFigmaServiceForUser(userId: string): Promise<FigmaService | null> {
    const vault = getCredentialVault();

    // Try to get Figma credentials from vault
    const credentials = await vault.getCredential(userId, 'figma');
    const accessToken = credentials?.data?.accessToken as string ||
                        credentials?.oauthAccessToken ||
                        process.env.FIGMA_ACCESS_TOKEN;

    if (!accessToken) {
        return null;
    }

    return createFigmaService({ accessToken });
}

/**
 * POST /api/figma/parse-url
 * Parse a Figma URL and extract file/node information
 */
router.post('/parse-url', async (req: Request, res: Response) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Create a temporary service just for parsing (doesn't need auth)
    const tempService = createFigmaService({ accessToken: 'temp' });
    const parsed = tempService.parseUrl(url);

    if (!parsed) {
        return res.status(400).json({
            error: 'Invalid Figma URL',
            message: 'Please provide a valid Figma file or design URL',
        });
    }

    res.json({
        success: true,
        fileKey: parsed.fileKey,
        nodeId: parsed.nodeId,
    });
});

/**
 * POST /api/figma/analyze
 * Analyze a Figma design and extract tokens
 */
router.post('/analyze', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { url, fileKey, nodeId } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const figma = await getFigmaServiceForUser(userId);
    if (!figma) {
        return res.status(400).json({
            error: 'Figma not configured',
            message: 'Please add your Figma access token in credentials settings',
            missingCredential: 'figma',
        });
    }

    try {
        let resolvedFileKey = fileKey;
        let resolvedNodeId = nodeId;

        // If URL provided, parse it
        if (url) {
            const parsed = figma.parseUrl(url);
            if (!parsed) {
                return res.status(400).json({ error: 'Invalid Figma URL' });
            }
            resolvedFileKey = parsed.fileKey;
            resolvedNodeId = parsed.nodeId || nodeId;
        }

        if (!resolvedFileKey) {
            return res.status(400).json({ error: 'Either url or fileKey is required' });
        }

        // Analyze the design
        const analysis = await figma.analyzeDesign(resolvedFileKey, resolvedNodeId);

        // Generate CSS variables and Tailwind config
        const cssVariables = figma.generateCSSVariables(analysis);
        const tailwindConfig = figma.generateTailwindConfig(analysis);

        res.json({
            success: true,
            analysis,
            cssVariables,
            tailwindConfig,
        });
    } catch (error) {
        console.error('Figma analysis error:', error);
        res.status(500).json({
            error: 'Failed to analyze Figma design',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/figma/get-images
 * Get rendered images of Figma frames
 */
router.post('/get-images', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { fileKey, nodeIds, format = 'png', scale = 2 } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!fileKey || !nodeIds || !Array.isArray(nodeIds)) {
        return res.status(400).json({ error: 'fileKey and nodeIds array are required' });
    }

    const figma = await getFigmaServiceForUser(userId);
    if (!figma) {
        return res.status(400).json({
            error: 'Figma not configured',
            missingCredential: 'figma',
        });
    }

    try {
        const images = await figma.getImages(fileKey, nodeIds, format, scale);
        res.json({ success: true, images });
    } catch (error) {
        console.error('Figma images error:', error);
        res.status(500).json({
            error: 'Failed to fetch Figma images',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/figma/to-code
 * Convert Figma design to code using Image-to-Code service
 */
router.post('/to-code', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { url, fileKey, nodeId, framework = 'react', styling = 'tailwind' } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const figma = await getFigmaServiceForUser(userId);
    if (!figma) {
        return res.status(400).json({
            error: 'Figma not configured',
            missingCredential: 'figma',
        });
    }

    try {
        let resolvedFileKey = fileKey;
        let resolvedNodeId = nodeId;

        // Parse URL if provided
        if (url) {
            const parsed = figma.parseUrl(url);
            if (!parsed) {
                return res.status(400).json({ error: 'Invalid Figma URL' });
            }
            resolvedFileKey = parsed.fileKey;
            resolvedNodeId = parsed.nodeId || nodeId;
        }

        if (!resolvedFileKey) {
            return res.status(400).json({ error: 'Either url or fileKey is required' });
        }

        // Get the design analysis for context
        const analysis = await figma.analyzeDesign(resolvedFileKey, resolvedNodeId);

        // Get the rendered image of the design
        const nodeIds = resolvedNodeId ? [resolvedNodeId] : ['0:1']; // Root frame if no node specified
        const images = await figma.getImages(resolvedFileKey, nodeIds, 'png', 2);
        const imageUrl = Object.values(images)[0];

        if (!imageUrl) {
            return res.status(400).json({ error: 'Could not render Figma design to image' });
        }

        // Use Image-to-Code service with design context
        const imageToCode = getImageToCodeService();

        const result = await imageToCode.convert({
            images: [{ type: 'url', url: imageUrl }],
            framework,
            styling,
            includeResponsive: true,
            includeAccessibility: true,
            // Inject design analysis as context
            additionalInstructions: buildDesignContext(analysis),
        });

        res.json({
            success: true,
            components: result.components,
            entryPoint: result.entryPoint,
            analysis: {
                ...result.analysis,
                figmaDesign: analysis,
            },
            usage: result.usage,
        });
    } catch (error) {
        console.error('Figma to code error:', error);
        res.status(500).json({
            error: 'Failed to convert Figma to code',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/figma/to-code/stream
 * Convert Figma design to code with SSE streaming
 */
router.post('/to-code/stream', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { url, fileKey, nodeId, framework = 'react', styling = 'tailwind' } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const figma = await getFigmaServiceForUser(userId);
        if (!figma) {
            sendEvent('error', { error: 'Figma not configured', missingCredential: 'figma' });
            return res.end();
        }

        sendEvent('progress', { status: 'parsing', message: 'Parsing Figma URL...' });

        let resolvedFileKey = fileKey;
        let resolvedNodeId = nodeId;

        if (url) {
            const parsed = figma.parseUrl(url);
            if (!parsed) {
                sendEvent('error', { error: 'Invalid Figma URL' });
                return res.end();
            }
            resolvedFileKey = parsed.fileKey;
            resolvedNodeId = parsed.nodeId || nodeId;
        }

        sendEvent('progress', { status: 'analyzing', message: 'Analyzing Figma design...', progress: 20 });

        // Analyze design
        const analysis = await figma.analyzeDesign(resolvedFileKey, resolvedNodeId);

        sendEvent('progress', { status: 'rendering', message: 'Rendering design to image...', progress: 40 });

        // Get rendered image
        const nodeIds = resolvedNodeId ? [resolvedNodeId] : ['0:1'];
        const images = await figma.getImages(resolvedFileKey, nodeIds, 'png', 2);
        const imageUrl = Object.values(images)[0];

        if (!imageUrl) {
            sendEvent('error', { error: 'Could not render Figma design' });
            return res.end();
        }

        sendEvent('progress', { status: 'generating', message: 'Converting to code...', progress: 60 });

        // Convert to code
        const imageToCode = getImageToCodeService();
        const result = await imageToCode.convert({
            images: [{ type: 'url', url: imageUrl }],
            framework,
            styling,
            includeResponsive: true,
            includeAccessibility: true,
            additionalInstructions: buildDesignContext(analysis),
        });

        sendEvent('progress', { status: 'complete', message: 'Conversion complete!', progress: 100 });

        sendEvent('complete', {
            components: result.components,
            entryPoint: result.entryPoint,
            analysis: {
                ...result.analysis,
                figmaDesign: analysis,
            },
            usage: result.usage,
        });

    } catch (error) {
        console.error('Figma to code stream error:', error);
        sendEvent('error', {
            error: 'Failed to convert Figma to code',
            message: error instanceof Error ? error.message : String(error),
        });
    } finally {
        res.end();
    }
});

/**
 * Build design context string from analysis
 */
function buildDesignContext(analysis: DesignAnalysis): string {
    return `
## Design Context from Figma

### Color Palette
${analysis.colors.map((c, i) => `- Color ${i + 1}: ${c}`).join('\n')}

### Typography
${analysis.fonts.map(f => `- Font: ${f}`).join('\n')}

### Layout
- Layout type: ${analysis.layout}
- Style: ${analysis.style} theme

### Components Detected
${analysis.components.map(c => `- ${c}`).join('\n')}

### Spacing
- Padding: ${analysis.spacing.padding}
- Gap: ${analysis.spacing.gap}

Use these design tokens and patterns when generating code.
`.trim();
}

export default router;

