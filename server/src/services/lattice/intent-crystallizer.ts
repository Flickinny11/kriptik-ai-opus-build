/**
 * Intent Crystallizer
 *
 * Transforms Intent Lock contracts into Lattice Blueprints.
 * Uses AI to decompose app requirements into perfectly-fitting cells
 * with defined interfaces that guarantee zero merge conflicts.
 *
 * Part of Phase 1: LATTICE Blueprint Generation
 */

import { createClaudeService, CLAUDE_MODELS, type ClaudeService } from '../ai/claude-service.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Interface contract for cell inputs/outputs
 */
export interface CellInterface {
    id: string;
    name: string;
    type: 'input' | 'output';
    dataShape: string; // TypeScript type definition
    description: string;
    required: boolean;
    defaultValue?: string;
}

/**
 * A discrete buildable unit within the lattice
 */
export interface LatticeCell {
    id: string;
    name: string;
    description: string;
    type: 'ui' | 'api' | 'logic' | 'data' | 'integration' | 'style';
    priority: number; // 1-10, higher = build first
    estimatedComplexity: 'simple' | 'medium' | 'complex';

    // Interface contracts
    inputs: CellInterface[];
    outputs: CellInterface[];

    // Dependencies
    dependsOn: string[]; // Cell IDs this cell needs
    blockedBy: string[]; // Cell IDs that must complete first

    // Implementation hints
    suggestedPatterns: string[]; // Building block patterns that might match
    antiPatterns: string[]; // What NOT to do
    filePatterns: string[]; // Expected output file patterns (e.g., "src/components/*.tsx")

    // Success criteria (from Intent Lock)
    successCriteria: string[];

    // Metadata
    estimatedBuildTimeSeconds: number;
    retryCount: number;
    lastBuildAttempt?: Date;
}

/**
 * Complete lattice blueprint for parallel building
 */
export interface LatticeBlueprint {
    id: string;
    intentId: string;
    appName: string;
    appSoul: string;
    cells: LatticeCell[];

    // Interface graph
    interfaceMap: Map<string, string[]>; // cellId -> connected cellIds

    // Execution order
    parallelGroups: string[][]; // Groups of cells that can run in parallel
    criticalPath: string[]; // Longest dependency chain

    // Timing estimates
    estimatedTotalTime: number; // seconds (sequential)
    estimatedParallelTime: number; // seconds (with full parallelism)

    // Visual identity from intent
    visualIdentity: VisualIdentity;

    // Metadata
    createdAt: Date;
    version: number;
}

/**
 * Visual identity extracted from intent
 */
export interface VisualIdentity {
    colorPalette: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        surface: string;
        text: { primary: string; secondary: string; muted: string };
    };
    typography: {
        headingFont: string;
        bodyFont: string;
        monoFont: string;
    };
    depth: 'minimal' | 'subtle' | 'moderate' | 'high' | 'immersive';
    motion: 'instant' | 'snappy' | 'smooth' | 'fluid' | 'cinematic';
    borderRadius: 'sharp' | 'rounded' | 'pill';
}

/**
 * Intent Contract (simplified version for LATTICE)
 */
export interface IntentContract {
    id: string;
    appName: string;
    appSoul: string;
    description: string;
    features: string[];
    requirements: string[];
    technicalStack: {
        framework: string;
        styling: string;
        database?: string;
        auth?: string;
    };
    visualIdentity?: Partial<VisualIdentity>;
    successCriteria: string[];
}

// ============================================================================
// INTENT CRYSTALLIZER CLASS
// ============================================================================

export class IntentCrystallizer {
    private claudeService: ClaudeService;
    private projectId: string;
    private userId: string;

    constructor(projectId: string, userId: string) {
        this.projectId = projectId;
        this.userId = userId;
        this.claudeService = createClaudeService({
            agentType: 'planning',
            projectId,
            userId,
        });
    }

    /**
     * Main entry point: Transform an Intent Contract into a Lattice Blueprint
     */
    async crystallize(intent: IntentContract): Promise<LatticeBlueprint> {
        console.log(`[IntentCrystallizer] Crystallizing intent: ${intent.appName}`);
        const startTime = Date.now();

        // Step 1: Decompose into cells using AI
        const cells = await this.decomposeToCells(intent);
        console.log(`[IntentCrystallizer] Decomposed into ${cells.length} cells`);

        // Step 2: Generate interface contracts
        const cellsWithInterfaces = await this.generateInterfaces(cells, intent);
        console.log(`[IntentCrystallizer] Generated interface contracts`);

        // Step 3: Build dependency graph
        const { interfaceMap, parallelGroups, criticalPath } = this.buildDependencyGraph(cellsWithInterfaces);
        console.log(`[IntentCrystallizer] Built dependency graph: ${parallelGroups.length} parallel groups, critical path length: ${criticalPath.length}`);

        // Step 4: Estimate timing
        const { totalTime, parallelTime } = this.estimateTiming(cellsWithInterfaces, parallelGroups);

        // Step 5: Build visual identity
        const visualIdentity = this.buildVisualIdentity(intent);

        const blueprint: LatticeBlueprint = {
            id: `lattice_${uuidv4()}`,
            intentId: intent.id,
            appName: intent.appName,
            appSoul: intent.appSoul,
            cells: cellsWithInterfaces,
            interfaceMap,
            parallelGroups,
            criticalPath,
            estimatedTotalTime: totalTime,
            estimatedParallelTime: parallelTime,
            visualIdentity,
            createdAt: new Date(),
            version: 1,
        };

        console.log(`[IntentCrystallizer] Blueprint created in ${Date.now() - startTime}ms`);
        console.log(`[IntentCrystallizer] Speed improvement potential: ${(totalTime / parallelTime).toFixed(1)}x`);

        return blueprint;
    }

    /**
     * Step 1: Decompose intent into discrete cells
     */
    private async decomposeToCells(intent: IntentContract): Promise<Partial<LatticeCell>[]> {
        const prompt = `You are decomposing an application into LATTICE cells for parallel building.

INTENT CONTRACT:
Application: ${intent.appName}
App Soul: ${intent.appSoul}
Description: ${intent.description}
Features: ${intent.features.join(', ')}
Requirements: ${intent.requirements.join(', ')}
Tech Stack: ${JSON.stringify(intent.technicalStack)}
Success Criteria: ${intent.successCriteria.join(', ')}

Decompose this into discrete cells that can be built independently.
Each cell should be:
- Self-contained with clear boundaries
- Small enough to build in 1-3 minutes
- Large enough to be meaningful (not trivial)

RULES:
- UI components are separate cells from their API endpoints
- Each API route group is one cell
- Database schema is one cell
- Auth flow is one cell
- Each major feature should be 2-3 cells (UI + logic + integration)
- Shared utilities/hooks are separate cells
- Style/theme system is one cell (must build first)
- Always include a "setup" cell for project scaffolding

CELL TYPES:
- ui: React components, pages, layouts
- api: Server routes, endpoints
- logic: Hooks, services, utilities
- data: Database schema, models, migrations
- integration: Third-party integrations, external APIs
- style: Theme, design tokens, global styles

Return a JSON array of cells with:
{
  "cells": [
    {
      "id": "cell_unique_id",
      "name": "Human readable name",
      "description": "What this cell does",
      "type": "ui" | "api" | "logic" | "data" | "integration" | "style",
      "priority": 1-10 (10 = build first, 1 = build last),
      "estimatedComplexity": "simple" | "medium" | "complex",
      "dependsOn": ["cell_id_1", "cell_id_2"],
      "suggestedPatterns": ["auth-flow", "crud-api"],
      "antiPatterns": ["no-placeholder-content", "no-generic-styling"],
      "filePatterns": ["src/components/*.tsx"],
      "successCriteria": ["Must render correctly", "Must handle errors"]
    }
  ]
}`;

        const response = await this.claudeService.generateStructured<{ cells: Partial<LatticeCell>[] }>(
            prompt,
            'You are a software architect decomposing applications into parallelizable build units. Return valid JSON only.',
            {
                model: CLAUDE_MODELS.SONNET_4_5,
                maxTokens: 8000,
                useExtendedThinking: true,
                thinkingBudgetTokens: 12000,
            }
        );

        // Ensure all cells have required fields
        return response.cells.map(cell => ({
            ...cell,
            id: cell.id || `cell_${uuidv4().slice(0, 8)}`,
            inputs: [],
            outputs: [],
            blockedBy: cell.dependsOn || [],
            estimatedBuildTimeSeconds: this.estimateCellBuildTime(cell.estimatedComplexity || 'medium'),
            retryCount: 0,
        }));
    }

    /**
     * Step 2: Generate interface contracts for each cell
     */
    private async generateInterfaces(
        cells: Partial<LatticeCell>[],
        intent: IntentContract
    ): Promise<LatticeCell[]> {
        const prompt = `Generate TypeScript interface contracts for each cell in this LATTICE.

CELLS:
${JSON.stringify(cells, null, 2)}

INTENT:
App: ${intent.appName}
Description: ${intent.description}
Tech Stack: ${JSON.stringify(intent.technicalStack)}

For each cell, define:
- inputs: What data/props/dependencies it receives
- outputs: What data/events/exports it produces

These interfaces are CONTRACTS. When cells are built, they MUST match these interfaces exactly.
This guarantees zero merge conflicts when cells are combined.

For each interface, provide:
{
  "id": "unique_id",
  "name": "InterfaceName",
  "type": "input" | "output",
  "dataShape": "TypeScript type definition (e.g., '{ id: string; name: string }')",
  "description": "What this interface represents",
  "required": true | false,
  "defaultValue": "optional default value"
}

Return JSON with the cells array updated to include inputs and outputs:
{
  "cells": [
    {
      ...originalCellFields,
      "inputs": [{ interface objects }],
      "outputs": [{ interface objects }]
    }
  ]
}`;

        const response = await this.claudeService.generateStructured<{ cells: LatticeCell[] }>(
            prompt,
            'You are a TypeScript architect defining interface contracts. Return valid JSON only.',
            {
                model: CLAUDE_MODELS.SONNET_4_5,
                maxTokens: 16000,
                useExtendedThinking: true,
                thinkingBudgetTokens: 10000,
            }
        );

        // Ensure all interfaces have IDs
        return response.cells.map(cell => ({
            ...cell,
            inputs: (cell.inputs || []).map(input => ({
                ...input,
                id: input.id || `iface_${uuidv4().slice(0, 8)}`,
            })),
            outputs: (cell.outputs || []).map(output => ({
                ...output,
                id: output.id || `iface_${uuidv4().slice(0, 8)}`,
            })),
        }));
    }

    /**
     * Step 3: Build dependency graph and determine parallel groups
     */
    private buildDependencyGraph(cells: LatticeCell[]): {
        interfaceMap: Map<string, string[]>;
        parallelGroups: string[][];
        criticalPath: string[];
    } {
        const interfaceMap = new Map<string, string[]>();

        // Build adjacency list from dependencies
        for (const cell of cells) {
            const connected = [...(cell.dependsOn || [])];

            // Also find cells that depend on this cell's outputs
            for (const other of cells) {
                if (other.dependsOn?.includes(cell.id)) {
                    connected.push(other.id);
                }
            }

            interfaceMap.set(cell.id, [...new Set(connected)]);
        }

        // Topological sort to find parallel groups
        const parallelGroups = this.topologicalGroupSort(cells);

        // Find critical path (longest dependency chain)
        const criticalPath = this.findCriticalPath(cells);

        return { interfaceMap, parallelGroups, criticalPath };
    }

    /**
     * Topological sort that groups cells that can run in parallel
     */
    private topologicalGroupSort(cells: LatticeCell[]): string[][] {
        const groups: string[][] = [];
        const completed = new Set<string>();
        const remaining = new Set(cells.map(c => c.id));

        let iterations = 0;
        const maxIterations = cells.length + 1;

        while (remaining.size > 0 && iterations < maxIterations) {
            const group: string[] = [];

            for (const cellId of remaining) {
                const cell = cells.find(c => c.id === cellId);
                if (!cell) continue;

                // Check if all dependencies are completed
                const deps = cell.dependsOn || [];
                const depsCompleted = deps.every(d => completed.has(d));

                if (depsCompleted) {
                    group.push(cellId);
                }
            }

            if (group.length === 0) {
                // Circular dependency detected - break the cycle
                console.warn('[IntentCrystallizer] Circular dependency detected, adding remaining cells');
                const remainingCells = Array.from(remaining);
                groups.push(remainingCells);
                break;
            }

            // Sort group by priority (higher priority first)
            group.sort((a, b) => {
                const cellA = cells.find(c => c.id === a);
                const cellB = cells.find(c => c.id === b);
                return (cellB?.priority || 0) - (cellA?.priority || 0);
            });

            groups.push(group);

            for (const id of group) {
                completed.add(id);
                remaining.delete(id);
            }

            iterations++;
        }

        return groups;
    }

    /**
     * Find the critical path (longest dependency chain)
     */
    private findCriticalPath(cells: LatticeCell[]): string[] {
        const memo = new Map<string, string[]>();

        const findPath = (cellId: string): string[] => {
            if (memo.has(cellId)) return memo.get(cellId)!;

            const cell = cells.find(c => c.id === cellId);
            if (!cell || !cell.dependsOn || cell.dependsOn.length === 0) {
                memo.set(cellId, [cellId]);
                return [cellId];
            }

            let longestPrev: string[] = [];
            for (const depId of cell.dependsOn) {
                const path = findPath(depId);
                if (path.length > longestPrev.length) {
                    longestPrev = path;
                }
            }

            const result = [...longestPrev, cellId];
            memo.set(cellId, result);
            return result;
        };

        let criticalPath: string[] = [];
        for (const cell of cells) {
            const path = findPath(cell.id);
            if (path.length > criticalPath.length) {
                criticalPath = path;
            }
        }

        return criticalPath;
    }

    /**
     * Step 4: Estimate timing for sequential and parallel execution
     */
    private estimateTiming(
        cells: LatticeCell[],
        parallelGroups: string[][]
    ): { totalTime: number; parallelTime: number } {
        const complexityTime: Record<string, number> = {
            simple: 30,    // 30 seconds
            medium: 90,    // 1.5 minutes
            complex: 180,  // 3 minutes
        };

        // Sequential time (sum of all)
        let totalTime = 0;
        for (const cell of cells) {
            totalTime += complexityTime[cell.estimatedComplexity] || 90;
        }

        // Parallel time (sum of max per group)
        let parallelTime = 0;
        for (const group of parallelGroups) {
            let groupMax = 0;
            for (const cellId of group) {
                const cell = cells.find(c => c.id === cellId);
                if (cell) {
                    const time = complexityTime[cell.estimatedComplexity] || 90;
                    if (time > groupMax) groupMax = time;
                }
            }
            parallelTime += groupMax;
        }

        return { totalTime, parallelTime };
    }

    /**
     * Estimate build time for a single cell based on complexity
     */
    private estimateCellBuildTime(complexity: string): number {
        const times: Record<string, number> = {
            simple: 30,
            medium: 90,
            complex: 180,
        };
        return times[complexity] || 90;
    }

    /**
     * Build visual identity from intent
     */
    private buildVisualIdentity(intent: IntentContract): VisualIdentity {
        // Default visual identity (dark mode, modern, premium)
        const defaults: VisualIdentity = {
            colorPalette: {
                primary: 'amber-500',
                secondary: 'slate-700',
                accent: 'orange-500',
                background: '#0a0a0f',
                surface: 'slate-900/50',
                text: {
                    primary: 'white',
                    secondary: 'slate-300',
                    muted: 'slate-500',
                },
            },
            typography: {
                headingFont: 'Plus Jakarta Sans',
                bodyFont: 'Inter',
                monoFont: 'JetBrains Mono',
            },
            depth: 'high',
            motion: 'smooth',
            borderRadius: 'rounded',
        };

        // Merge with intent's visual identity if provided
        if (intent.visualIdentity) {
            return {
                ...defaults,
                ...intent.visualIdentity,
                colorPalette: {
                    ...defaults.colorPalette,
                    ...intent.visualIdentity.colorPalette,
                    text: {
                        ...defaults.colorPalette.text,
                        ...intent.visualIdentity.colorPalette?.text,
                    },
                },
                typography: {
                    ...defaults.typography,
                    ...intent.visualIdentity.typography,
                },
            };
        }

        return defaults;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createIntentCrystallizer(projectId: string, userId: string): IntentCrystallizer {
    return new IntentCrystallizer(projectId, userId);
}

export default IntentCrystallizer;
