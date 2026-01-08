/**
 * Decomposition Strategies
 *
 * Different approaches for breaking down complex tasks.
 * Each strategy is optimized for different types of problems.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  DecompositionStrategy,
  Subtask,
  SubtaskType,
  DecompositionConfig,
} from './types.js';
import type { ComplexityLevel, ModelConfig } from '../types.js';
import { getProvider } from '../providers/index.js';
import { HYPER_THINKING_MODELS, DEFAULT_MODEL_BY_TIER } from '../model-router.js';

// ============================================================================
// Strategy Interface
// ============================================================================

export interface IDecompositionStrategy {
  /** Strategy name */
  name: DecompositionStrategy;
  /** Decompose a task into subtasks */
  decompose(task: string, config: DecompositionConfig): Promise<Subtask[]>;
  /** Check if this strategy is suitable for the task */
  isSuitable(task: string): number; // 0-1 suitability score
}

// ============================================================================
// Base Strategy Class
// ============================================================================

abstract class BaseDecompositionStrategy implements IDecompositionStrategy {
  abstract name: DecompositionStrategy;
  abstract strategyPrompt: string;

  /**
   * Decompose task using AI
   */
  async decompose(task: string, config: DecompositionConfig): Promise<Subtask[]> {
    const modelId = DEFAULT_MODEL_BY_TIER[config.modelTier];
    const model = HYPER_THINKING_MODELS[modelId];

    const provider = getProvider(model.provider);

    const prompt = this.buildPrompt(task, config);

    const response = await provider.reason({
      prompt,
      systemPrompt: this.getSystemPrompt(),
      model,
      thinkingBudget: 16000,
      temperature: config.temperature,
    });

    return this.parseResponse(response.content, task, config);
  }

  /**
   * Build decomposition prompt
   */
  protected buildPrompt(task: string, config: DecompositionConfig): string {
    return `${this.strategyPrompt}

## Task to Decompose
${task}

## Configuration
- Maximum depth: ${config.maxDepth}
- Maximum subtasks: ${config.maxSubtasks}
- Minimum subtask size: ${config.minSubtaskSize} tokens
- Maximum subtask size: ${config.maxSubtaskSize} tokens
- Enable parallelization: ${config.enableParallelization}

## Required Output Format
Provide a JSON array of subtasks with the following structure for each:
\`\`\`json
[
  {
    "title": "Short descriptive title",
    "description": "Detailed description of what needs to be done",
    "type": "feature|refactor|integration|analysis|design|testing|documentation|configuration|data|ui|api|infrastructure|other",
    "complexity": "trivial|simple|moderate|complex|extreme",
    "estimatedTokens": 1000,
    "dependencies": ["id_of_dependency"],
    "priority": 1-10,
    "parallelizable": true|false,
    "tags": ["tag1", "tag2"]
  }
]
\`\`\`

Important:
- Use temporary IDs like "task_1", "task_2" for dependencies
- Order subtasks logically (earlier tasks should be listed first)
- Ensure dependencies reference IDs of tasks listed before them
- Set parallelizable to true if the task can run alongside siblings without dependencies
- Estimate tokens based on complexity (trivial: 500, simple: 1500, moderate: 4000, complex: 8000, extreme: 15000)`;
  }

  /**
   * Get system prompt for decomposition
   */
  protected getSystemPrompt(): string {
    return `You are an expert task decomposition agent. Your role is to break complex tasks into smaller, manageable subtasks that can be executed systematically.

Guidelines:
1. Create clear, actionable subtasks
2. Identify dependencies between tasks
3. Estimate complexity accurately
4. Detect parallelization opportunities
5. Maintain logical ordering
6. Use specific, descriptive titles
7. Include enough detail in descriptions for independent execution`;
  }

  /**
   * Parse AI response into subtasks
   */
  protected parseResponse(
    content: string,
    originalTask: string,
    config: DecompositionConfig
  ): Subtask[] {
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse decomposition response: no JSON array found');
    }

    let parsed: Array<{
      title: string;
      description: string;
      type: SubtaskType;
      complexity: ComplexityLevel;
      estimatedTokens: number;
      dependencies: string[];
      priority: number;
      parallelizable: boolean;
      tags: string[];
    }>;

    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error(`Failed to parse decomposition JSON: ${e}`);
    }

    // Create ID mapping
    const idMap = new Map<string, string>();

    // First pass: create real IDs
    const subtasks: Subtask[] = parsed.map((item, index) => {
      const tempId = `task_${index + 1}`;
      const realId = uuidv4();
      idMap.set(tempId, realId);

      return {
        id: realId,
        parentId: null, // Will be set if needed
        title: item.title,
        description: item.description,
        type: item.type || 'other',
        complexity: item.complexity || 'moderate',
        estimatedTokens: item.estimatedTokens || 2000,
        dependencies: item.dependencies || [],
        children: [],
        status: 'pending',
        depth: 0, // Will be calculated
        priority: item.priority || 5,
        parallelizable: item.parallelizable !== false,
        tags: item.tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          strategy: this.name,
          originalIndex: index,
        },
      };
    });

    // Second pass: resolve dependency IDs
    for (const subtask of subtasks) {
      subtask.dependencies = subtask.dependencies
        .map(dep => {
          // Try to resolve temporary ID
          const resolved = idMap.get(dep);
          if (resolved) return resolved;

          // Try to find by index
          const indexMatch = dep.match(/task_(\d+)/);
          if (indexMatch) {
            const idx = parseInt(indexMatch[1], 10) - 1;
            if (subtasks[idx]) return subtasks[idx].id;
          }

          return null;
        })
        .filter((id): id is string => id !== null);
    }

    // Enforce max subtasks
    if (subtasks.length > config.maxSubtasks) {
      return subtasks.slice(0, config.maxSubtasks);
    }

    return subtasks;
  }

  /**
   * Abstract suitability check
   */
  abstract isSuitable(task: string): number;
}

// ============================================================================
// Functional Decomposition
// ============================================================================

export class FunctionalDecomposition extends BaseDecompositionStrategy {
  name: DecompositionStrategy = 'functional';

  strategyPrompt = `You are using FUNCTIONAL DECOMPOSITION strategy.

Break the task down by features and capabilities:
1. Identify distinct functional areas
2. Group related functionality together
3. Define clear interfaces between functions
4. Minimize coupling between functional units

Focus on "what" the system should do, not "how" or "when".`;

  isSuitable(task: string): number {
    const functionalKeywords = [
      'feature', 'capability', 'function', 'user story', 'requirement',
      'implement', 'add', 'create', 'build', 'develop', 'module',
      'component', 'service', 'functionality'
    ];

    const lowerTask = task.toLowerCase();
    let score = 0;

    for (const keyword of functionalKeywords) {
      if (lowerTask.includes(keyword)) {
        score += 0.1;
      }
    }

    return Math.min(score, 1);
  }
}

// ============================================================================
// Data Flow Decomposition
// ============================================================================

export class DataFlowDecomposition extends BaseDecompositionStrategy {
  name: DecompositionStrategy = 'data_flow';

  strategyPrompt = `You are using DATA FLOW DECOMPOSITION strategy.

Break the task down by data transformation steps:
1. Identify input data sources
2. Trace data transformations
3. Define intermediate data states
4. Specify output destinations

Focus on "what data flows where" and transformations at each step.`;

  isSuitable(task: string): number {
    const dataFlowKeywords = [
      'data', 'transform', 'process', 'pipeline', 'etl', 'convert',
      'parse', 'serialize', 'import', 'export', 'migrate', 'sync',
      'stream', 'batch', 'input', 'output', 'format'
    ];

    const lowerTask = task.toLowerCase();
    let score = 0;

    for (const keyword of dataFlowKeywords) {
      if (lowerTask.includes(keyword)) {
        score += 0.1;
      }
    }

    return Math.min(score, 1);
  }
}

// ============================================================================
// Architectural Decomposition
// ============================================================================

export class ArchitecturalDecomposition extends BaseDecompositionStrategy {
  name: DecompositionStrategy = 'architectural';

  strategyPrompt = `You are using ARCHITECTURAL DECOMPOSITION strategy.

Break the task down by system layers and components:
1. Identify architectural layers (UI, business logic, data access, infrastructure)
2. Define component boundaries
3. Specify inter-component contracts
4. Plan for scalability and maintainability

Focus on "how" the system is structured, emphasizing separation of concerns.`;

  isSuitable(task: string): number {
    const architecturalKeywords = [
      'architecture', 'layer', 'component', 'system', 'design',
      'structure', 'pattern', 'microservice', 'api', 'interface',
      'infrastructure', 'backend', 'frontend', 'database', 'schema'
    ];

    const lowerTask = task.toLowerCase();
    let score = 0;

    for (const keyword of architecturalKeywords) {
      if (lowerTask.includes(keyword)) {
        score += 0.1;
      }
    }

    return Math.min(score, 1);
  }
}

// ============================================================================
// Temporal Decomposition
// ============================================================================

export class TemporalDecomposition extends BaseDecompositionStrategy {
  name: DecompositionStrategy = 'temporal';

  strategyPrompt = `You are using TEMPORAL DECOMPOSITION strategy.

Break the task down by execution sequence and phases:
1. Identify distinct phases (setup, execution, cleanup)
2. Order tasks by timing requirements
3. Handle concurrent vs sequential operations
4. Plan for state management between phases

Focus on "when" things happen and their temporal relationships.`;

  isSuitable(task: string): number {
    const temporalKeywords = [
      'phase', 'step', 'stage', 'sequence', 'order', 'first', 'then',
      'after', 'before', 'concurrent', 'parallel', 'sequential',
      'workflow', 'process', 'pipeline', 'schedule', 'timing'
    ];

    const lowerTask = task.toLowerCase();
    let score = 0;

    for (const keyword of temporalKeywords) {
      if (lowerTask.includes(keyword)) {
        score += 0.1;
      }
    }

    return Math.min(score, 1);
  }
}

// ============================================================================
// Hybrid Decomposition
// ============================================================================

export class HybridDecomposition extends BaseDecompositionStrategy {
  name: DecompositionStrategy = 'hybrid';

  private strategies: IDecompositionStrategy[];

  constructor() {
    super();
    this.strategies = [
      new FunctionalDecomposition(),
      new DataFlowDecomposition(),
      new ArchitecturalDecomposition(),
      new TemporalDecomposition(),
    ];
  }

  strategyPrompt = `You are using HYBRID DECOMPOSITION strategy.

Combine multiple decomposition approaches for optimal results:
1. Identify functional areas (what the system does)
2. Consider data flows (how data moves)
3. Respect architectural boundaries (system structure)
4. Account for temporal ordering (when things happen)

Use the most appropriate approach for each part of the task.`;

  async decompose(task: string, config: DecompositionConfig): Promise<Subtask[]> {
    // Score all strategies
    const scores = this.strategies.map(s => ({
      strategy: s,
      score: s.isSuitable(task),
    }));

    // Find best strategy
    scores.sort((a, b) => b.score - a.score);
    const bestStrategy = scores[0].strategy;

    // If best strategy has high suitability, use it exclusively
    if (scores[0].score >= 0.7) {
      return bestStrategy.decompose(task, config);
    }

    // Otherwise, use hybrid approach
    const modelId = DEFAULT_MODEL_BY_TIER[config.modelTier];
    const model = HYPER_THINKING_MODELS[modelId];

    const provider = getProvider(model.provider);

    const prompt = this.buildHybridPrompt(task, config, scores);

    const response = await provider.reason({
      prompt,
      systemPrompt: this.getSystemPrompt(),
      model,
      thinkingBudget: 20000,
      temperature: config.temperature,
    });

    return this.parseResponse(response.content, task, config);
  }

  private buildHybridPrompt(
    task: string,
    config: DecompositionConfig,
    scores: Array<{ strategy: IDecompositionStrategy; score: number }>
  ): string {
    const strategyInsights = scores
      .filter(s => s.score > 0.2)
      .map(s => `- ${s.strategy.name}: ${Math.round(s.score * 100)}% suitable`)
      .join('\n');

    return `${this.strategyPrompt}

## Strategy Analysis
Based on task analysis, here are the suitability scores:
${strategyInsights}

Consider using a combination of these approaches.

## Task to Decompose
${task}

## Configuration
- Maximum depth: ${config.maxDepth}
- Maximum subtasks: ${config.maxSubtasks}
- Minimum subtask size: ${config.minSubtaskSize} tokens
- Maximum subtask size: ${config.maxSubtaskSize} tokens
- Enable parallelization: ${config.enableParallelization}

## Required Output Format
Provide a JSON array of subtasks with the following structure for each:
\`\`\`json
[
  {
    "title": "Short descriptive title",
    "description": "Detailed description of what needs to be done",
    "type": "feature|refactor|integration|analysis|design|testing|documentation|configuration|data|ui|api|infrastructure|other",
    "complexity": "trivial|simple|moderate|complex|extreme",
    "estimatedTokens": 1000,
    "dependencies": ["id_of_dependency"],
    "priority": 1-10,
    "parallelizable": true|false,
    "tags": ["tag1", "tag2"]
  }
]
\`\`\`

Important:
- Use temporary IDs like "task_1", "task_2" for dependencies
- Order subtasks logically (earlier tasks should be listed first)
- Ensure dependencies reference IDs of tasks listed before them
- Set parallelizable to true if the task can run alongside siblings without dependencies
- Use the most appropriate decomposition approach for each part of the task`;
  }

  isSuitable(_task: string): number {
    // Hybrid is always moderately suitable
    return 0.5;
  }
}

// ============================================================================
// Strategy Factory
// ============================================================================

/**
 * Get decomposition strategy by name
 */
export function getDecompositionStrategy(name: DecompositionStrategy): IDecompositionStrategy {
  switch (name) {
    case 'functional':
      return new FunctionalDecomposition();
    case 'data_flow':
      return new DataFlowDecomposition();
    case 'architectural':
      return new ArchitecturalDecomposition();
    case 'temporal':
      return new TemporalDecomposition();
    case 'hybrid':
    default:
      return new HybridDecomposition();
  }
}

/**
 * Select best strategy for a task
 */
export function selectBestStrategy(task: string): DecompositionStrategy {
  const strategies: IDecompositionStrategy[] = [
    new FunctionalDecomposition(),
    new DataFlowDecomposition(),
    new ArchitecturalDecomposition(),
    new TemporalDecomposition(),
  ];

  let bestStrategy: DecompositionStrategy = 'hybrid';
  let bestScore = 0;

  for (const strategy of strategies) {
    const score = strategy.isSuitable(task);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestStrategy = strategy.name;
    }
  }

  return bestStrategy;
}

export default {
  FunctionalDecomposition,
  DataFlowDecomposition,
  ArchitecturalDecomposition,
  TemporalDecomposition,
  HybridDecomposition,
  getDecompositionStrategy,
  selectBestStrategy,
};
