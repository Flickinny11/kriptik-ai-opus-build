/**
 * Figma Integration Service
 *
 * Provides real Figma API integration for:
 * - Fetching designs from Figma files
 * - Extracting design tokens and styles
 * - Converting Figma frames to code
 */

import fetch from 'node-fetch';

export interface FigmaConfig {
    accessToken: string;
    personalAccessToken?: string;
}

export interface FigmaFile {
    name: string;
    lastModified: string;
    thumbnailUrl: string;
    version: string;
    document: FigmaDocument;
    styles: Record<string, FigmaStyle>;
}

export interface FigmaDocument {
    id: string;
    name: string;
    type: string;
    children: FigmaNode[];
}

export interface FigmaNode {
    id: string;
    name: string;
    type: string;
    visible?: boolean;
    children?: FigmaNode[];
    backgroundColor?: FigmaColor;
    fills?: FigmaPaint[];
    strokes?: FigmaPaint[];
    strokeWeight?: number;
    cornerRadius?: number;
    effects?: FigmaEffect[];
    absoluteBoundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    constraints?: {
        vertical: string;
        horizontal: string;
    };
    characters?: string;
    style?: FigmaTypeStyle;
    layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    itemSpacing?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
}

export interface FigmaColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface FigmaPaint {
    type: string;
    visible?: boolean;
    opacity?: number;
    color?: FigmaColor;
    gradientStops?: Array<{
        position: number;
        color: FigmaColor;
    }>;
}

export interface FigmaEffect {
    type: string;
    visible: boolean;
    radius?: number;
    color?: FigmaColor;
    offset?: { x: number; y: number };
    spread?: number;
}

export interface FigmaStyle {
    key: string;
    name: string;
    styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
    description: string;
}

export interface FigmaTypeStyle {
    fontFamily: string;
    fontPostScriptName?: string;
    fontWeight: number;
    fontSize: number;
    textAlignHorizontal?: string;
    textAlignVertical?: string;
    letterSpacing: number;
    lineHeightPx: number;
    lineHeightPercent?: number;
    lineHeightUnit?: string;
}

export interface FigmaImage {
    err: string | null;
    images: Record<string, string>;
}

export interface DesignAnalysis {
    colors: string[];
    fonts: string[];
    layout: string;
    components: string[];
    style: string;
    spacing: {
        padding: string;
        gap: string;
    };
    tokens: {
        colors: Record<string, string>;
        typography: Record<string, { family: string; size: string; weight: number }>;
        spacing: Record<string, string>;
        borderRadius: Record<string, string>;
    };
}

export class FigmaService {
    private config: FigmaConfig;
    private baseUrl = 'https://api.figma.com/v1';

    constructor(config: FigmaConfig) {
        this.config = config;
    }

    /**
     * Get headers for Figma API requests
     */
    private getHeaders(): Record<string, string> {
        const token = this.config.personalAccessToken || this.config.accessToken;
        return {
            'X-Figma-Token': token,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Parse Figma URL to extract file key and node ID
     */
    parseUrl(url: string): { fileKey: string; nodeId?: string } | null {
        // Match Figma URLs:
        // https://www.figma.com/file/FILE_KEY/...
        // https://www.figma.com/design/FILE_KEY/...
        // https://www.figma.com/file/FILE_KEY/...?node-id=NODE_ID
        const patterns = [
            /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                const fileKey = match[1];

                // Extract node ID if present
                const nodeIdMatch = url.match(/node-id=([^&]+)/);
                const nodeId = nodeIdMatch ? decodeURIComponent(nodeIdMatch[1]) : undefined;

                return { fileKey, nodeId };
            }
        }

        return null;
    }

    /**
     * Get Figma file data
     */
    async getFile(fileKey: string): Promise<FigmaFile> {
        const response = await fetch(`${this.baseUrl}/files/${fileKey}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch Figma file: ${error}`);
        }

        return response.json() as Promise<FigmaFile>;
    }

    /**
     * Get specific node from Figma file
     */
    async getNode(fileKey: string, nodeId: string): Promise<FigmaNode | null> {
        const response = await fetch(
            `${this.baseUrl}/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
            { headers: this.getHeaders() }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch Figma node: ${error}`);
        }

        const data = await response.json() as { nodes: Record<string, { document: FigmaNode }> };
        return data.nodes[nodeId]?.document || null;
    }

    /**
     * Get images for specific nodes
     */
    async getImages(
        fileKey: string,
        nodeIds: string[],
        format: 'png' | 'svg' | 'jpg' = 'png',
        scale: number = 2
    ): Promise<Record<string, string>> {
        const ids = nodeIds.join(',');
        const response = await fetch(
            `${this.baseUrl}/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`,
            { headers: this.getHeaders() }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch Figma images: ${error}`);
        }

        const data = await response.json() as FigmaImage;
        if (data.err) {
            throw new Error(`Figma API error: ${data.err}`);
        }

        return data.images;
    }

    /**
     * Analyze a Figma design and extract design tokens
     */
    async analyzeDesign(fileKey: string, nodeId?: string): Promise<DesignAnalysis> {
        const file = await this.getFile(fileKey);
        const targetNode = nodeId
            ? await this.getNode(fileKey, nodeId)
            : file.document;

        if (!targetNode) {
            throw new Error('Node not found');
        }

        const analysis: DesignAnalysis = {
            colors: [],
            fonts: [],
            layout: this.detectLayoutType(targetNode),
            components: [],
            style: this.detectStyleType(targetNode),
            spacing: {
                padding: 'md',
                gap: 'md',
            },
            tokens: {
                colors: {},
                typography: {},
                spacing: {},
                borderRadius: {},
            },
        };

        // Extract colors and typography from styles
        for (const [key, style] of Object.entries(file.styles)) {
            if (style.styleType === 'FILL') {
                analysis.tokens.colors[style.name] = key;
            } else if (style.styleType === 'TEXT') {
                analysis.tokens.typography[style.name] = {
                    family: 'Inter',
                    size: '16px',
                    weight: 400,
                };
            }
        }

        // Traverse the design tree
        this.traverseNode(targetNode, analysis);

        return analysis;
    }

    /**
     * Traverse node tree to extract design information
     */
    private traverseNode(node: FigmaNode, analysis: DesignAnalysis): void {
        // Extract colors from fills
        if (node.fills) {
            for (const fill of node.fills) {
                if (fill.visible !== false && fill.color) {
                    const colorHex = this.rgbToHex(fill.color);
                    if (!analysis.colors.includes(colorHex)) {
                        analysis.colors.push(colorHex);
                    }
                }
            }
        }

        // Extract fonts
        if (node.style?.fontFamily) {
            if (!analysis.fonts.includes(node.style.fontFamily)) {
                analysis.fonts.push(node.style.fontFamily);
            }
        }

        // Detect component types
        const componentType = this.detectComponentType(node);
        if (componentType && !analysis.components.includes(componentType)) {
            analysis.components.push(componentType);
        }

        // Extract spacing
        if (node.paddingLeft !== undefined || node.paddingTop !== undefined) {
            const maxPadding = Math.max(
                node.paddingLeft || 0,
                node.paddingRight || 0,
                node.paddingTop || 0,
                node.paddingBottom || 0
            );
            analysis.spacing.padding = this.mapToSpacingToken(maxPadding);
        }

        if (node.itemSpacing !== undefined) {
            analysis.spacing.gap = this.mapToSpacingToken(node.itemSpacing);
        }

        // Extract border radius
        if (node.cornerRadius !== undefined) {
            const radiusKey = `radius-${node.name.toLowerCase().replace(/\s+/g, '-')}`;
            analysis.tokens.borderRadius[radiusKey] = `${node.cornerRadius}px`;
        }

        // Recurse into children
        if (node.children) {
            for (const child of node.children) {
                this.traverseNode(child, analysis);
            }
        }
    }

    /**
     * Detect layout type from node
     */
    private detectLayoutType(node: FigmaNode): string {
        if (node.layoutMode === 'HORIZONTAL') return 'flex-row';
        if (node.layoutMode === 'VERTICAL') return 'flex-col';
        if (node.children && node.children.length > 0) {
            // Check for grid-like patterns
            const hasMultipleRowsOrCols = node.children.length >= 4;
            if (hasMultipleRowsOrCols) return 'grid';
        }
        return 'stack';
    }

    /**
     * Detect style type (theme)
     */
    private detectStyleType(node: FigmaNode): string {
        // Check background for dark/light theme
        if (node.backgroundColor) {
            const brightness =
                node.backgroundColor.r * 0.299 +
                node.backgroundColor.g * 0.587 +
                node.backgroundColor.b * 0.114;
            return brightness < 0.5 ? 'dark' : 'light';
        }
        return 'light';
    }

    /**
     * Detect component type from node
     */
    private detectComponentType(node: FigmaNode): string | null {
        const name = node.name.toLowerCase();

        // Common component patterns
        if (name.includes('button') || name.includes('btn')) return 'Button';
        if (name.includes('input') || name.includes('field')) return 'Input';
        if (name.includes('card')) return 'Card';
        if (name.includes('nav') || name.includes('header')) return 'Navigation';
        if (name.includes('hero')) return 'Hero';
        if (name.includes('footer')) return 'Footer';
        if (name.includes('modal') || name.includes('dialog')) return 'Modal';
        if (name.includes('avatar')) return 'Avatar';
        if (name.includes('badge')) return 'Badge';
        if (name.includes('tab')) return 'Tabs';
        if (name.includes('dropdown') || name.includes('select')) return 'Select';
        if (name.includes('checkbox')) return 'Checkbox';
        if (name.includes('toggle') || name.includes('switch')) return 'Switch';

        return null;
    }

    /**
     * Map pixel value to spacing token
     */
    private mapToSpacingToken(px: number): string {
        if (px <= 4) return 'xs';
        if (px <= 8) return 'sm';
        if (px <= 16) return 'md';
        if (px <= 24) return 'lg';
        if (px <= 32) return 'xl';
        if (px <= 48) return '2xl';
        return '3xl';
    }

    /**
     * Convert RGB to hex color
     */
    private rgbToHex(color: FigmaColor): string {
        const toHex = (n: number) => {
            const hex = Math.round(n * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
    }

    /**
     * Generate CSS variables from design analysis
     */
    generateCSSVariables(analysis: DesignAnalysis): string {
        const lines: string[] = [':root {'];

        // Color variables
        analysis.colors.forEach((color, index) => {
            lines.push(`  --color-${index + 1}: ${color};`);
        });

        // Add named color tokens
        for (const [name, value] of Object.entries(analysis.tokens.colors)) {
            lines.push(`  --${name.toLowerCase().replace(/\s+/g, '-')}: ${value};`);
        }

        // Spacing tokens
        for (const [name, value] of Object.entries(analysis.tokens.spacing)) {
            lines.push(`  --${name}: ${value};`);
        }

        // Border radius tokens
        for (const [name, value] of Object.entries(analysis.tokens.borderRadius)) {
            lines.push(`  --${name}: ${value};`);
        }

        lines.push('}');
        return lines.join('\n');
    }

    /**
     * Generate Tailwind config extension from design analysis
     */
    generateTailwindConfig(analysis: DesignAnalysis): Record<string, unknown> {
        const colors: Record<string, string> = {};
        analysis.colors.forEach((color, index) => {
            colors[`figma-${index + 1}`] = color;
        });

        return {
            theme: {
                extend: {
                    colors,
                    fontFamily: {
                        figma: analysis.fonts,
                    },
                    borderRadius: analysis.tokens.borderRadius,
                },
            },
        };
    }
}

// Singleton factory
let figmaInstance: FigmaService | null = null;

export function getFigmaService(config?: FigmaConfig): FigmaService {
    if (!figmaInstance && config) {
        figmaInstance = new FigmaService(config);
    }
    if (!figmaInstance) {
        throw new Error('Figma service not initialized. Provide config on first call.');
    }
    return figmaInstance;
}

export function createFigmaService(config: FigmaConfig): FigmaService {
    return new FigmaService(config);
}

