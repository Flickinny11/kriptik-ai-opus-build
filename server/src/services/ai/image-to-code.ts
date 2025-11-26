/**
 * Image-to-Code Service
 *
 * Converts images, screenshots, Figma exports, and sketches into
 * production-ready React/TypeScript code using vision models.
 */

import { getModelRouter, GenerationResponse } from './model-router';

export type ImageSource =
    | { type: 'url'; url: string }
    | { type: 'base64'; data: string; mimeType: string }
    | { type: 'figma'; fileKey: string; nodeId?: string };

export type OutputFramework = 'react' | 'react-native' | 'vue' | 'html';
export type StylingApproach = 'tailwind' | 'css-modules' | 'styled-components' | 'inline';

export interface ImageToCodeRequest {
    images: ImageSource[];
    framework?: OutputFramework;
    styling?: StylingApproach;
    componentName?: string;
    includeResponsive?: boolean;
    includeAccessibility?: boolean;
    includeInteractions?: boolean;
    additionalInstructions?: string;
}

export interface GeneratedComponent {
    name: string;
    code: string;
    styles?: string;
    path: string;
    dependencies: string[];
    preview?: string;
}

export interface ImageToCodeResult {
    components: GeneratedComponent[];
    entryPoint: string;
    analysis: {
        detectedElements: string[];
        layout: string;
        colorPalette: string[];
        typography: string[];
        interactions: string[];
    };
    usage: {
        inputTokens: number;
        outputTokens: number;
        estimatedCost: number;
    };
}

export class ImageToCodeService {
    /**
     * Convert images to code
     */
    async convert(request: ImageToCodeRequest): Promise<ImageToCodeResult> {
        const router = getModelRouter();

        // Prepare image URLs
        const imageUrls = await this.prepareImages(request.images);

        // Step 1: Analyze the design
        const analysisPrompt = this.buildAnalysisPrompt(request);
        const analysisResponse = await router.generate({
            prompt: analysisPrompt,
            images: imageUrls,
            taskType: 'vision',
            forceTier: 'vision',
            systemPrompt: VISION_SYSTEM_PROMPT,
        });

        const analysis = this.parseAnalysis(analysisResponse.content);

        // Step 2: Generate code based on analysis
        const codePrompt = this.buildCodeGenerationPrompt(request, analysis);
        const codeResponse = await router.generate({
            prompt: codePrompt,
            taskType: 'generation',
            forceTier: 'critical', // Use best model for code generation
            systemPrompt: CODE_GENERATION_SYSTEM_PROMPT,
        });

        const components = this.parseGeneratedCode(codeResponse.content, request);

        return {
            components,
            entryPoint: components[0]?.path || 'src/App.tsx',
            analysis,
            usage: {
                inputTokens: analysisResponse.usage.inputTokens + codeResponse.usage.inputTokens,
                outputTokens: analysisResponse.usage.outputTokens + codeResponse.usage.outputTokens,
                estimatedCost: analysisResponse.usage.estimatedCost + codeResponse.usage.estimatedCost,
            },
        };
    }

    /**
     * Generate code with streaming
     */
    async convertWithStreaming(
        request: ImageToCodeRequest,
        onProgress: (update: { stage: string; content: string }) => void
    ): Promise<ImageToCodeResult> {
        const router = getModelRouter();

        // Prepare image URLs
        const imageUrls = await this.prepareImages(request.images);

        onProgress({ stage: 'analyzing', content: 'Analyzing design...' });

        // Step 1: Analyze the design
        const analysisPrompt = this.buildAnalysisPrompt(request);
        let analysisContent = '';

        await router.generateStream(
            {
                prompt: analysisPrompt,
                images: imageUrls,
                taskType: 'vision',
                forceTier: 'vision',
                systemPrompt: VISION_SYSTEM_PROMPT,
            },
            {
                onToken: (token) => {
                    analysisContent += token;
                    onProgress({ stage: 'analyzing', content: analysisContent });
                },
            }
        );

        const analysis = this.parseAnalysis(analysisContent);

        onProgress({ stage: 'generating', content: 'Generating code...' });

        // Step 2: Generate code
        const codePrompt = this.buildCodeGenerationPrompt(request, analysis);
        let codeContent = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let estimatedCost = 0;

        await router.generateStream(
            {
                prompt: codePrompt,
                taskType: 'generation',
                forceTier: 'critical',
                systemPrompt: CODE_GENERATION_SYSTEM_PROMPT,
            },
            {
                onToken: (token) => {
                    codeContent += token;
                    onProgress({ stage: 'generating', content: codeContent });
                },
                onComplete: (response) => {
                    inputTokens = response.usage.inputTokens;
                    outputTokens = response.usage.outputTokens;
                    estimatedCost = response.usage.estimatedCost;
                },
            }
        );

        const components = this.parseGeneratedCode(codeContent, request);

        return {
            components,
            entryPoint: components[0]?.path || 'src/App.tsx',
            analysis,
            usage: {
                inputTokens,
                outputTokens,
                estimatedCost,
            },
        };
    }

    /**
     * Prepare images for API call
     */
    private async prepareImages(
        sources: ImageSource[]
    ): Promise<Array<{ url: string; detail: 'high' | 'low' | 'auto' }>> {
        return Promise.all(
            sources.map(async (source) => {
                switch (source.type) {
                    case 'url':
                        return { url: source.url, detail: 'high' as const };

                    case 'base64':
                        return {
                            url: `data:${source.mimeType};base64,${source.data}`,
                            detail: 'high' as const,
                        };

                    case 'figma':
                        // Fetch Figma image
                        const figmaUrl = await this.fetchFigmaImage(source.fileKey, source.nodeId);
                        return { url: figmaUrl, detail: 'high' as const };

                    default:
                        throw new Error('Unknown image source type');
                }
            })
        );
    }

    /**
     * Fetch image from Figma API
     */
    private async fetchFigmaImage(fileKey: string, nodeId?: string): Promise<string> {
        const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
        if (!figmaToken) {
            throw new Error('FIGMA_ACCESS_TOKEN is not set');
        }

        const endpoint = nodeId
            ? `https://api.figma.com/v1/images/${fileKey}?ids=${nodeId}&format=png&scale=2`
            : `https://api.figma.com/v1/images/${fileKey}?format=png&scale=2`;

        const response = await fetch(endpoint, {
            headers: { 'X-Figma-Token': figmaToken },
        });

        if (!response.ok) {
            throw new Error(`Figma API error: ${response.statusText}`);
        }

        const data = await response.json();
        const imageUrl = nodeId ? data.images[nodeId] : Object.values(data.images)[0];

        if (!imageUrl) {
            throw new Error('No image returned from Figma');
        }

        return imageUrl as string;
    }

    /**
     * Build prompt for design analysis
     */
    private buildAnalysisPrompt(request: ImageToCodeRequest): string {
        return `Analyze this UI design and extract:

1. **Layout Structure**
   - Overall layout pattern (grid, flex, columns)
   - Component hierarchy
   - Spacing patterns

2. **Visual Elements**
   - List all UI components (buttons, inputs, cards, etc.)
   - Navigation elements
   - Interactive elements

3. **Styling Details**
   - Color palette (exact hex values if visible)
   - Typography (font sizes, weights)
   - Border radius, shadows
   - Spacing values

4. **Responsive Considerations**
   - Mobile-friendly elements
   - Potential breakpoints

5. **Accessibility**
   - Contrast issues
   - Touch target sizes
   - Semantic structure suggestions

6. **Interactions**
   - Hover states visible
   - Click actions implied
   - Animations suggested

Respond with a structured JSON object.`;
    }

    /**
     * Build prompt for code generation
     */
    private buildCodeGenerationPrompt(
        request: ImageToCodeRequest,
        analysis: ImageToCodeResult['analysis']
    ): string {
        const framework = request.framework || 'react';
        const styling = request.styling || 'tailwind';
        const componentName = request.componentName || 'GeneratedComponent';

        return `Generate production-ready ${framework} code for this UI design.

## Design Analysis
${JSON.stringify(analysis, null, 2)}

## Requirements

### Framework: ${framework}
### Styling: ${styling}
### Component Name: ${componentName}

### Code Requirements:
1. Use TypeScript with proper types
2. Include all visual elements from the design
3. Match colors, spacing, and typography exactly
4. ${request.includeResponsive ? 'Include responsive breakpoints' : 'Desktop-only for now'}
5. ${request.includeAccessibility ? 'Include full accessibility (ARIA labels, semantic HTML, keyboard navigation)' : 'Basic accessibility'}
6. ${request.includeInteractions ? 'Include hover states and interactions' : 'Static layout only'}

${request.additionalInstructions ? `### Additional Instructions:\n${request.additionalInstructions}` : ''}

### Output Format:
Provide the code in this exact format:

\`\`\`component:ComponentName:path/to/file.tsx
// Full component code here
\`\`\`

\`\`\`styles:path/to/styles.css
// Styles if using CSS modules
\`\`\`

\`\`\`dependencies
["dependency1", "dependency2"]
\`\`\`

Generate complete, pixel-perfect code. NO placeholders.`;
    }

    /**
     * Parse analysis response
     */
    private parseAnalysis(content: string): ImageToCodeResult['analysis'] {
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                              content.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                return {
                    detectedElements: json.visualElements || json.elements || [],
                    layout: json.layout || json.layoutStructure || 'unknown',
                    colorPalette: json.colors || json.colorPalette || [],
                    typography: json.typography || [],
                    interactions: json.interactions || [],
                };
            }
        } catch {
            // If parsing fails, extract what we can
        }

        return {
            detectedElements: [],
            layout: 'flex',
            colorPalette: [],
            typography: [],
            interactions: [],
        };
    }

    /**
     * Parse generated code
     */
    private parseGeneratedCode(
        content: string,
        request: ImageToCodeRequest
    ): GeneratedComponent[] {
        const components: GeneratedComponent[] = [];

        // Parse component blocks
        const componentMatches = content.matchAll(
            /```component:(\w+):([^\n]+)\n([\s\S]*?)```/g
        );

        for (const match of componentMatches) {
            const [, name, path, code] = match;
            components.push({
                name,
                code: code.trim(),
                path,
                dependencies: [],
            });
        }

        // Parse style blocks
        const styleMatches = content.matchAll(
            /```styles:([^\n]+)\n([\s\S]*?)```/g
        );

        for (const match of styleMatches) {
            const [, path, styles] = match;
            // Find matching component
            const componentPath = path.replace(/\.css$/, '.tsx');
            const component = components.find(c =>
                c.path === componentPath || c.path.includes(path.split('/').pop()?.replace('.css', '') || '')
            );
            if (component) {
                component.styles = styles.trim();
            }
        }

        // Parse dependencies
        const depsMatch = content.match(/```dependencies\n?\[([\s\S]*?)\]```/);
        if (depsMatch) {
            try {
                const deps = JSON.parse(`[${depsMatch[1]}]`);
                components.forEach(c => {
                    c.dependencies = deps;
                });
            } catch {
                // Ignore parsing errors
            }
        }

        // If no components parsed, try to extract raw code
        if (components.length === 0) {
            const codeMatch = content.match(/```(?:tsx?|jsx?)\n([\s\S]*?)```/);
            if (codeMatch) {
                components.push({
                    name: request.componentName || 'GeneratedComponent',
                    code: codeMatch[1].trim(),
                    path: `src/components/${request.componentName || 'GeneratedComponent'}.tsx`,
                    dependencies: ['react', 'lucide-react'],
                });
            }
        }

        return components;
    }
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const VISION_SYSTEM_PROMPT = `You are an expert UI/UX analyst and designer. Your job is to analyze UI designs
and extract detailed information about layout, components, styling, and interactions.

Be extremely precise about:
- Color values (hex codes)
- Spacing (in pixels or rem)
- Typography (sizes, weights, line heights)
- Component types (exact UI elements)

Always respond with structured JSON.`;

const CODE_GENERATION_SYSTEM_PROMPT = `You are an expert frontend developer specializing in pixel-perfect
UI implementation. You convert designs into production-ready React/TypeScript code.

Your code must:
1. Be complete and functional - NO placeholders or TODOs
2. Match the design exactly - colors, spacing, typography
3. Use modern React patterns (hooks, functional components)
4. Include proper TypeScript types
5. Follow accessibility best practices
6. Be clean, readable, and well-organized

Use Tailwind CSS classes for styling unless otherwise specified.
Include responsive breakpoints (sm, md, lg, xl) for responsive designs.`;

// ============================================================================
// SINGLETON
// ============================================================================

let instance: ImageToCodeService | null = null;

export function getImageToCodeService(): ImageToCodeService {
    if (!instance) {
        instance = new ImageToCodeService();
    }
    return instance;
}

