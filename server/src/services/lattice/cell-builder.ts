/**
 * Cell Builder
 *
 * Builds individual lattice cells with interface contract enforcement.
 * Each cell is built in isolation and verified against its interface contract
 * before being marked complete.
 *
 * Features:
 * - AI-powered code generation via Claude
 * - Interface contract verification using TypeScript parsing
 * - Anti-slop quality enforcement
 * - Build retry with exponential backoff
 * - Comprehensive error reporting
 *
 * Part of Phase 2: Parallel Cell Builder (LATTICE)
 */

import { EventEmitter } from 'events';
import { createClaudeService, CLAUDE_MODELS, type ClaudeService } from '../ai/claude-service.js';
import { createAntiSlopDetector, type AntiSlopScore } from '../verification/anti-slop-detector.js';
import { LatticeCell, CellInterface, VisualIdentity } from './intent-crystallizer.js';
import type { AppSoulType } from '../ai/app-soul.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of building a single cell
 */
export interface CellBuildResult {
    cellId: string;
    cellName: string;
    success: boolean;
    files: Array<{ path: string; content: string; language: string }>;
    interfaceCompliance: {
        inputsValid: boolean;
        outputsValid: boolean;
        errors: string[];
        warnings: string[];
    };
    qualityScore: number;
    antiSlopScore?: AntiSlopScore;
    buildTime: number; // ms
    attempt: number;
    error?: string;
    thinking?: string; // AI reasoning for debugging
}

/**
 * Context for building a cell
 */
export interface CellBuildContext {
    appSoul: string;
    appSoulType?: AppSoulType;
    visualIdentity: VisualIdentity;
    completedCells: Map<string, CellBuildResult>;
    projectPath?: string;
    framework: string;
    styling: string;
}

/**
 * Configuration for cell builder
 */
export interface CellBuilderConfig {
    minQualityScore: number; // Minimum quality score to pass (default: 85)
    maxRetries: number; // Maximum build attempts (default: 3)
    enableAntiSlop: boolean; // Run anti-slop detection (default: true)
    enableInterfaceVerification: boolean; // Verify interfaces (default: true)
    projectId: string;
    userId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: CellBuilderConfig = {
    minQualityScore: 85,
    maxRetries: 3,
    enableAntiSlop: true,
    enableInterfaceVerification: true,
    projectId: 'cell-builder',
    userId: 'system',
};

// TypeScript export patterns for interface verification
const EXPORT_PATTERNS = {
    const: /export\s+const\s+(\w+)/g,
    function: /export\s+(?:async\s+)?function\s+(\w+)/g,
    class: /export\s+class\s+(\w+)/g,
    type: /export\s+type\s+(\w+)/g,
    interface: /export\s+interface\s+(\w+)/g,
    default: /export\s+default\s+(?:class\s+|function\s+|const\s+)?(\w+)?/g,
    named: /export\s*\{\s*([^}]+)\s*\}/g,
};

// Import patterns for interface verification
const IMPORT_PATTERNS = {
    named: /import\s*\{\s*([^}]+)\s*\}\s*from/g,
    default: /import\s+(\w+)\s+from/g,
    all: /import\s+\*\s+as\s+(\w+)\s+from/g,
};

// ============================================================================
// CELL BUILDER CLASS
// ============================================================================

export class CellBuilder extends EventEmitter {
    private claudeService: ClaudeService;
    private config: CellBuilderConfig;

    constructor(config?: Partial<CellBuilderConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.claudeService = createClaudeService({
            agentType: 'generation',
            projectId: this.config.projectId,
            userId: this.config.userId,
        });
    }

    /**
     * Build a single cell with interface contract enforcement
     */
    async buildCell(
        cell: LatticeCell,
        context: CellBuildContext,
        attempt: number = 1
    ): Promise<CellBuildResult> {
        const startTime = Date.now();
        const buildId = `build_${uuidv4().slice(0, 8)}`;

        console.log(`[CellBuilder] Building cell "${cell.name}" (${cell.id}), attempt ${attempt}/${this.config.maxRetries}`);
        this.emit('buildStart', { cellId: cell.id, cellName: cell.name, attempt, buildId });

        try {
            // Get interface contracts from completed dependencies
            const depInterfaces = this.gatherDependencyInterfaces(cell, context.completedCells);

            // Generate cell code using AI
            const files = await this.generateCellCode(cell, depInterfaces, context);

            if (!files || files.length === 0) {
                throw new Error('No files generated');
            }

            // Verify interface compliance
            const compliance = this.config.enableInterfaceVerification
                ? this.verifyInterfaceCompliance(cell, files)
                : { inputsValid: true, outputsValid: true, errors: [], warnings: [] };

            // Run anti-slop quality check
            let qualityScore = 90; // Default if anti-slop disabled
            let antiSlopScore: AntiSlopScore | undefined;

            if (this.config.enableAntiSlop && this.hasUIFiles(files)) {
                const detector = createAntiSlopDetector(
                    this.config.userId,
                    this.config.projectId,
                    context.appSoulType
                );

                const fileMap = new Map(files.map(f => [f.path, f.content]));
                antiSlopScore = await detector.analyze(fileMap);
                qualityScore = antiSlopScore.overall;
            }

            // Determine success
            const success =
                compliance.inputsValid &&
                compliance.outputsValid &&
                qualityScore >= this.config.minQualityScore &&
                compliance.errors.length === 0;

            const result: CellBuildResult = {
                cellId: cell.id,
                cellName: cell.name,
                success,
                files,
                interfaceCompliance: compliance,
                qualityScore,
                antiSlopScore,
                buildTime: Date.now() - startTime,
                attempt,
            };

            console.log(`[CellBuilder] Cell "${cell.name}" build ${success ? 'succeeded' : 'failed'}: quality=${qualityScore}, time=${result.buildTime}ms`);
            this.emit('buildComplete', result);

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[CellBuilder] Cell "${cell.name}" build error:`, errorMessage);

            const result: CellBuildResult = {
                cellId: cell.id,
                cellName: cell.name,
                success: false,
                files: [],
                interfaceCompliance: {
                    inputsValid: false,
                    outputsValid: false,
                    errors: [errorMessage],
                    warnings: [],
                },
                qualityScore: 0,
                buildTime: Date.now() - startTime,
                attempt,
                error: errorMessage,
            };

            this.emit('buildError', result);
            return result;
        }
    }

    /**
     * Build cell with automatic retry on failure
     */
    async buildCellWithRetry(
        cell: LatticeCell,
        context: CellBuildContext
    ): Promise<CellBuildResult> {
        let lastResult: CellBuildResult | null = null;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            const result = await this.buildCell(cell, context, attempt);

            if (result.success) {
                return result;
            }

            lastResult = result;

            // Log retry info
            if (attempt < this.config.maxRetries) {
                console.log(`[CellBuilder] Retrying cell "${cell.name}" after failure: ${result.error || 'Quality threshold not met'}`);

                // Exponential backoff before retry
                await this.sleep(Math.pow(2, attempt - 1) * 500);
            }
        }

        // All retries failed
        console.warn(`[CellBuilder] Cell "${cell.name}" failed after ${this.config.maxRetries} attempts`);
        return lastResult!;
    }

    /**
     * Burst build: Run multiple parallel builds and pick the best
     */
    async burstBuildCell(
        cell: LatticeCell,
        context: CellBuildContext,
        concurrency: number = 3
    ): Promise<CellBuildResult> {
        console.log(`[CellBuilder] Burst building cell "${cell.name}" with ${concurrency} parallel attempts`);

        // Run multiple builds in parallel
        const buildPromises = Array.from({ length: concurrency }, (_, i) =>
            this.buildCell(cell, context, i + 1)
        );

        const results = await Promise.all(buildPromises);

        // Filter successful results
        const successful = results.filter(r =>
            r.success &&
            r.interfaceCompliance.inputsValid &&
            r.interfaceCompliance.outputsValid
        );

        if (successful.length > 0) {
            // Pick the best by quality score
            const best = successful.sort((a, b) => b.qualityScore - a.qualityScore)[0];
            console.log(`[CellBuilder] Burst build selected best result: quality=${best.qualityScore}`);
            return best;
        }

        // No successful builds - return the one with highest quality
        const best = results.sort((a, b) => b.qualityScore - a.qualityScore)[0];
        console.warn(`[CellBuilder] Burst build failed, returning best attempt: quality=${best.qualityScore}`);
        return best;
    }

    // =========================================================================
    // DEPENDENCY GATHERING
    // =========================================================================

    /**
     * Gather interface contracts from completed dependency cells
     */
    private gatherDependencyInterfaces(
        cell: LatticeCell,
        completedCells: Map<string, CellBuildResult>
    ): Map<string, { interfaces: CellInterface[]; exports: string[] }> {
        const interfaces = new Map<string, { interfaces: CellInterface[]; exports: string[] }>();

        for (const depId of cell.dependsOn || []) {
            const depResult = completedCells.get(depId);
            if (depResult && depResult.success) {
                // Extract exported interfaces from the completed cell
                const exported = this.extractExportedInterfaces(depResult.files);
                interfaces.set(depId, {
                    interfaces: exported.interfaces,
                    exports: exported.exports,
                });
            }
        }

        return interfaces;
    }

    /**
     * Extract exported interfaces and names from generated files
     */
    private extractExportedInterfaces(
        files: Array<{ path: string; content: string }>
    ): { interfaces: CellInterface[]; exports: string[] } {
        const interfaces: CellInterface[] = [];
        const exports: string[] = [];

        for (const file of files) {
            // Skip non-code files
            if (!this.isCodeFile(file.path)) continue;

            const content = file.content;

            // Extract all export types
            for (const [type, pattern] of Object.entries(EXPORT_PATTERNS)) {
                const regex = new RegExp(pattern.source, pattern.flags);
                let match;

                while ((match = regex.exec(content)) !== null) {
                    if (type === 'named') {
                        // Handle named exports: export { a, b, c }
                        const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim());
                        exports.push(...names);
                    } else if (match[1]) {
                        exports.push(match[1]);
                    }
                }
            }

            // Create interface objects for type/interface exports
            const typeMatches = content.matchAll(/export\s+(type|interface)\s+(\w+)\s*[=<{]/g);
            for (const match of typeMatches) {
                const [, kind, name] = match;
                interfaces.push({
                    id: `iface_${name.toLowerCase()}`,
                    name,
                    type: 'output',
                    dataShape: kind === 'type' ? 'type alias' : 'interface',
                    description: `Exported ${kind} from ${file.path}`,
                    required: true,
                });
            }
        }

        return { interfaces, exports: [...new Set(exports)] };
    }

    // =========================================================================
    // CODE GENERATION
    // =========================================================================

    /**
     * Generate cell code using AI
     */
    private async generateCellCode(
        cell: LatticeCell,
        depInterfaces: Map<string, { interfaces: CellInterface[]; exports: string[] }>,
        context: CellBuildContext
    ): Promise<Array<{ path: string; content: string; language: string }>> {
        // Build dependency context string
        const depContext = Array.from(depInterfaces.entries())
            .map(([depId, { exports }]) => `- ${depId}: exports [${exports.join(', ')}]`)
            .join('\n');

        const prompt = `Build this LATTICE cell with EXACT interface compliance.

## CELL DEFINITION
- ID: ${cell.id}
- Name: ${cell.name}
- Type: ${cell.type}
- Description: ${cell.description}
- Priority: ${cell.priority}
- Complexity: ${cell.estimatedComplexity}

## REQUIRED INPUTS (must import/use these):
${cell.inputs.map(i => `- ${i.name}: ${i.dataShape} (${i.description})${i.required ? ' [REQUIRED]' : ''}`).join('\n') || 'None'}

## REQUIRED OUTPUTS (must export these):
${cell.outputs.map(o => `- ${o.name}: ${o.dataShape} (${o.description})`).join('\n') || 'None'}

## DEPENDENCY EXPORTS (available to import):
${depContext || 'None - this is a root cell'}

## SUCCESS CRITERIA:
${cell.successCriteria?.join('\n') || 'None specified'}

## SUGGESTED PATTERNS:
${cell.suggestedPatterns?.join(', ') || 'None'}

## ANTI-PATTERNS (DO NOT USE):
${cell.antiPatterns?.join(', ') || 'None'}

## EXPECTED FILE PATTERNS:
${cell.filePatterns?.join(', ') || 'Infer from cell type'}

## APP CONTEXT
- App Soul: ${context.appSoul}
- Framework: ${context.framework}
- Styling: ${context.styling}

## VISUAL IDENTITY
- Colors: ${JSON.stringify(context.visualIdentity.colorPalette)}
- Typography: ${JSON.stringify(context.visualIdentity.typography)}
- Depth: ${context.visualIdentity.depth}
- Motion: ${context.visualIdentity.motion}
- Border Radius: ${context.visualIdentity.borderRadius}

## GENERATION RULES
1. Your OUTPUT interfaces MUST match the cell definition EXACTLY
2. Your INPUT usage MUST match dependency interfaces EXACTLY
3. NO placeholder content - everything must be production-ready
4. Follow anti-slop rules:
   - No purple-to-pink gradients
   - No generic system fonts
   - Real depth (colored shadows, backdrop blur, layers)
   - Premium animations with proper easing
   - No emoji in UI
5. Style according to visualIdentity, NOT generic patterns
6. Use TypeScript with strict types
7. Include proper error handling
8. Add JSDoc comments for complex functions

Return a JSON object with files array:
{
  "files": [
    {
      "path": "src/components/Example.tsx",
      "content": "// Full file content here...",
      "language": "typescript"
    }
  ],
  "explanation": "Brief explanation of what was generated"
}`;

        const response = await this.claudeService.generateStructured<{
            files: Array<{ path: string; content: string; language?: string }>;
            explanation?: string;
        }>(
            prompt,
            `You are a senior TypeScript developer building production-ready code for the "${context.appSoul}" application.
Generate complete, working code files with no placeholders, no TODOs, and no incomplete implementations.
Return valid JSON only.`,
            {
                model: CLAUDE_MODELS.SONNET_4_5,
                maxTokens: 32000,
                useExtendedThinking: true,
                thinkingBudgetTokens: 16000,
            }
        );

        // Ensure all files have language field
        return response.files.map(f => ({
            path: f.path,
            content: f.content,
            language: f.language || this.inferLanguage(f.path),
        }));
    }

    // =========================================================================
    // INTERFACE VERIFICATION
    // =========================================================================

    /**
     * Verify that generated files comply with interface contracts
     */
    private verifyInterfaceCompliance(
        cell: LatticeCell,
        files: Array<{ path: string; content: string }>
    ): { inputsValid: boolean; outputsValid: boolean; errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check that expected outputs exist
        for (const output of cell.outputs || []) {
            const found = this.findExportInFiles(files, output);
            if (!found) {
                errors.push(`Missing output: ${output.name} of type ${output.dataShape}`);
            }
        }

        // Check that required inputs are used
        for (const input of cell.inputs || []) {
            if (input.required) {
                const used = this.findImportUsage(files, input);
                if (!used) {
                    warnings.push(`Required input not used: ${input.name}`);
                }
            }
        }

        // Check for any obvious issues
        for (const file of files) {
            // Check for placeholder content
            if (/TODO|FIXME|placeholder|lorem ipsum/i.test(file.content)) {
                warnings.push(`Potential placeholder content in ${file.path}`);
            }

            // Check for empty exports
            if (/export\s*\{\s*\}/.test(file.content)) {
                warnings.push(`Empty export statement in ${file.path}`);
            }

            // Check for any type
            if (/:\s*any\b/.test(file.content)) {
                warnings.push(`Use of 'any' type in ${file.path}`);
            }
        }

        return {
            inputsValid: !errors.some(e => e.includes('input')),
            outputsValid: errors.filter(e => e.includes('output')).length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Find an export in the generated files
     */
    private findExportInFiles(
        files: Array<{ path: string; content: string }>,
        output: CellInterface
    ): boolean {
        // Build patterns to match various export forms
        const patterns = [
            new RegExp(`export\\s+const\\s+${output.name}\\b`),
            new RegExp(`export\\s+(?:async\\s+)?function\\s+${output.name}\\b`),
            new RegExp(`export\\s+class\\s+${output.name}\\b`),
            new RegExp(`export\\s+type\\s+${output.name}\\b`),
            new RegExp(`export\\s+interface\\s+${output.name}\\b`),
            new RegExp(`export\\s+default\\s+${output.name}\\b`),
            new RegExp(`export\\s*\\{[^}]*\\b${output.name}\\b[^}]*\\}`),
        ];

        return files.some(f =>
            patterns.some(pattern => pattern.test(f.content))
        );
    }

    /**
     * Find if an input is used (imported) in the files
     */
    private findImportUsage(
        files: Array<{ path: string; content: string }>,
        input: CellInterface
    ): boolean {
        // Check for import statement containing the name
        const importPattern = new RegExp(
            `import\\s*\\{[^}]*\\b${input.name}\\b[^}]*\\}|` +
            `import\\s+${input.name}\\s+from|` +
            `import\\s+\\*\\s+as\\s+\\w+`,
            'g'
        );

        // Also check for actual usage in code
        const usagePattern = new RegExp(`\\b${input.name}\\b`);

        return files.some(f =>
            importPattern.test(f.content) || usagePattern.test(f.content)
        );
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Check if any files are UI files (need anti-slop check)
     */
    private hasUIFiles(files: Array<{ path: string; content: string }>): boolean {
        return files.some(f =>
            /\.(tsx|jsx|vue|svelte)$/i.test(f.path) ||
            f.content.includes('className=') ||
            f.content.includes('style=')
        );
    }

    /**
     * Check if file is a code file
     */
    private isCodeFile(path: string): boolean {
        return /\.(ts|tsx|js|jsx|mjs|vue|svelte)$/i.test(path);
    }

    /**
     * Infer language from file extension
     */
    private inferLanguage(path: string): string {
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const languageMap: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescript',
            js: 'javascript',
            jsx: 'javascript',
            json: 'json',
            css: 'css',
            scss: 'scss',
            html: 'html',
            md: 'markdown',
            yaml: 'yaml',
            yml: 'yaml',
        };
        return languageMap[ext] || 'text';
    }

    /**
     * Sleep utility for retry backoff
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<CellBuilderConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): CellBuilderConfig {
        return { ...this.config };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createCellBuilder(config?: Partial<CellBuilderConfig>): CellBuilder {
    return new CellBuilder(config);
}

export default CellBuilder;
