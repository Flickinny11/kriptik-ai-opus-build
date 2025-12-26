/**
 * Anthropic Advanced Tool Use Integration
 *
 * Implements the three features from Anthropic's November 2025 release:
 * 1. Tool Search Tool - Dynamic tool discovery to reduce token usage
 * 2. Programmatic Tool Calling (PTC) - Code-based tool orchestration
 * 3. Tool Use Examples - Examples for complex parameter handling
 *
 * @see https://www.anthropic.com/engineering/advanced-tool-use
 */

import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'events';

// ============================================
// TYPES
// ============================================

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  category?: string;
  examples?: ToolExample[];
}

export interface ToolExample {
  description: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface ToolSearchConfig {
  enabled: boolean;
  toolLibrary: ToolDefinition[];
  maxToolsToLoad: number;
  categories: string[];
}

export interface ProgrammaticToolCallingConfig {
  enabled: boolean;
  pythonEnvironment: 'sandboxed' | 'local';
  maxExecutionTime: number;
  allowedModules: string[];
}

export interface AdvancedToolUseConfig {
  toolSearch: ToolSearchConfig;
  programmaticToolCalling: ProgrammaticToolCallingConfig;
  enableExamples: boolean;
}

// ============================================
// KRIPTIK TOOL LIBRARY
// All tools available for Tool Search
// ============================================

export const KRIPTIK_TOOL_LIBRARY: ToolDefinition[] = [
  // Verification Swarm Tools
  {
    name: 'run_verification_swarm',
    description: 'Run the 6-agent verification swarm on the current build. Agents: error_checker, code_quality, visual_verifier, security_scanner, placeholder_eliminator, design_style.',
    input_schema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['lightning', 'standard', 'thorough', 'production', 'paranoid'],
          description: 'Verification mode affecting speed vs thoroughness',
        },
        agents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific agents to run, or "all" for all agents',
        },
        threshold: {
          type: 'number',
          description: 'Minimum score to pass (default 85)',
        },
      },
      required: ['mode'],
    },
    category: 'verification',
    examples: [
      {
        description: 'Run quick verification for small change',
        input: { mode: 'lightning', agents: ['error_checker', 'placeholder_eliminator'] },
        output: { verdict: 'APPROVED', score: 92, time_ms: 15000 },
      },
      {
        description: 'Run full production verification before deploy',
        input: { mode: 'production', agents: ['all'], threshold: 90 },
        output: { verdict: 'APPROVED', score: 94, time_ms: 300000 },
      },
    ],
  },
  {
    name: 'run_error_checker',
    description: 'Run TypeScript/ESLint error checking on the codebase',
    input_schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string' } },
        fix: { type: 'boolean', description: 'Auto-fix simple errors' },
      },
    },
    category: 'verification',
  },
  {
    name: 'run_security_scanner',
    description: 'Scan for security vulnerabilities, exposed keys, injection risks',
    input_schema: {
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      },
    },
    category: 'verification',
  },

  // Build Loop Tools
  {
    name: 'start_build_loop',
    description: 'Start the 6-phase build loop: Intent Lock → Initialization → Build → Integration → Test → Demo',
    input_schema: {
      type: 'object',
      properties: {
        intentId: { type: 'string' },
        mode: { type: 'string', enum: ['lightning', 'standard', 'tournament', 'production'] },
        parallelAgents: { type: 'number', description: 'Number of parallel build agents (1-unlimited)' },
      },
      required: ['intentId'],
    },
    category: 'build',
    examples: [
      {
        description: 'Start parallel build with 6 agents',
        input: { intentId: 'intent_123', mode: 'standard', parallelAgents: 6 },
        output: { buildId: 'build_456', phase: 'INITIALIZATION', agentsDeployed: 6 },
      },
    ],
  },
  {
    name: 'get_build_phase',
    description: 'Get current phase of an active build',
    input_schema: {
      type: 'object',
      properties: {
        buildId: { type: 'string' },
      },
      required: ['buildId'],
    },
    category: 'build',
  },
  {
    name: 'advance_build_phase',
    description: 'Manually advance to next build phase (if conditions met)',
    input_schema: {
      type: 'object',
      properties: {
        buildId: { type: 'string' },
        targetPhase: { type: 'number', minimum: 0, maximum: 6 },
      },
      required: ['buildId'],
    },
    category: 'build',
  },

  // Intent Lock Tools
  {
    name: 'create_intent_lock',
    description: 'Create an immutable Intent Lock contract (Sacred Contract) defining success criteria',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        appSoul: {
          type: 'string',
          enum: ['immersive_media', 'professional', 'developer', 'creative', 'social', 'ecommerce', 'utility', 'gaming'],
        },
        successCriteria: { type: 'array', items: { type: 'string' } },
      },
      required: ['description'],
    },
    category: 'intent',
    examples: [
      {
        description: 'Create intent for e-commerce app',
        input: {
          description: 'Build a modern e-commerce store with Stripe payments',
          appSoul: 'ecommerce',
          successCriteria: ['Products display correctly', 'Cart functions', 'Checkout completes'],
        },
        output: { intentId: 'intent_789', locked: true, appSoul: 'ecommerce' },
      },
    ],
  },
  {
    name: 'verify_intent_satisfaction',
    description: 'Check if all Intent Lock success criteria are satisfied',
    input_schema: {
      type: 'object',
      properties: {
        intentId: { type: 'string' },
        buildId: { type: 'string' },
      },
      required: ['intentId'],
    },
    category: 'intent',
  },

  // Ghost Mode Tools
  {
    name: 'start_ghost_mode',
    description: 'Start autonomous background building with configurable wake conditions',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        maxRuntime: { type: 'number', description: 'Maximum runtime in minutes' },
        maxCredits: { type: 'number', description: 'Credit limit' },
        wakeConditions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['completion', 'error', 'critical_error', 'decision_needed', 'cost_threshold', 'time_elapsed', 'feature_complete', 'quality_threshold'],
          },
        },
        notificationChannels: {
          type: 'array',
          items: { type: 'string', enum: ['email', 'sms', 'slack', 'discord', 'push'] },
        },
      },
      required: ['projectId'],
    },
    category: 'ghost_mode',
  },

  // Learning Engine Tools
  {
    name: 'capture_experience',
    description: 'Capture a decision trace or code artifact for the learning engine',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['decision', 'code', 'design', 'error_recovery'] },
        content: { type: 'string' },
        context: { type: 'object' },
        outcome: { type: 'string', enum: ['success', 'failure', 'pending'] },
      },
      required: ['type', 'content'],
    },
    category: 'learning',
  },
  {
    name: 'query_pattern_library',
    description: 'Search the pattern library for relevant learned patterns',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        appSoul: { type: 'string' },
        minConfidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['query'],
    },
    category: 'learning',
  },

  // Cloud Provisioning Tools
  {
    name: 'provision_runpod',
    description: 'Provision GPU resources on RunPod (pods or serverless)',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['pod', 'serverless'] },
        gpuType: { type: 'string', enum: ['RTX4090', 'A100', 'H100', 'H200'] },
        gpuCount: { type: 'number' },
        containerImage: { type: 'string' },
        volumeSize: { type: 'number', description: 'Volume size in GB' },
      },
      required: ['type', 'gpuType'],
    },
    category: 'cloud',
  },
  {
    name: 'provision_vastai',
    description: 'Provision GPU resources on Vast.ai marketplace',
    input_schema: {
      type: 'object',
      properties: {
        gpuType: { type: 'string' },
        maxPrice: { type: 'number', description: 'Maximum $/hour' },
        diskSpace: { type: 'number' },
        dockerImage: { type: 'string' },
      },
      required: ['gpuType'],
    },
    category: 'cloud',
  },
  {
    name: 'deploy_huggingface',
    description: 'Deploy a model to HuggingFace Inference Endpoints',
    input_schema: {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        instanceType: { type: 'string' },
        framework: { type: 'string', enum: ['vllm', 'tgi', 'sglang', 'custom'] },
        autoScale: { type: 'boolean' },
      },
      required: ['modelId'],
    },
    category: 'cloud',
  },

  // Feature Agent Tools
  {
    name: 'deploy_feature_agent',
    description: 'Deploy a feature agent with full 6-phase build loop',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        modelId: { type: 'string' },
        verificationMode: { type: 'string', enum: ['quick', 'standard', 'thorough', 'full_swarm'] },
        parentIntentId: { type: 'string' },
      },
      required: ['description'],
    },
    category: 'agents',
  },
  {
    name: 'get_agent_status',
    description: 'Get status of a deployed agent',
    input_schema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
      },
      required: ['agentId'],
    },
    category: 'agents',
  },

  // Context Management Tools
  {
    name: 'enforce_context_ingestion',
    description: 'Enforce Context Lock ingestion gate - blocks until all context loaded',
    input_schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        projectId: { type: 'string' },
        agentId: { type: 'string' },
      },
      required: ['sessionId', 'projectId', 'agentId'],
    },
    category: 'context',
  },
  {
    name: 'create_context_artifact',
    description: 'Create a context artifact documenting an action',
    input_schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        type: { type: 'string', enum: ['decision', 'file_change', 'integration', 'error', 'context_update'] },
        rationale: { type: 'string' },
        filesChanged: { type: 'array', items: { type: 'string' } },
      },
      required: ['sessionId', 'type', 'rationale'],
    },
    category: 'context',
  },

  // LATTICE Speed Tools
  {
    name: 'crystallize_intent',
    description: 'Transform Intent Lock into LATTICE Blueprint with parallel cells',
    input_schema: {
      type: 'object',
      properties: {
        intentId: { type: 'string' },
        maxParallelism: { type: 'number' },
      },
      required: ['intentId'],
    },
    category: 'lattice',
  },
  {
    name: 'build_cell',
    description: 'Build a single LATTICE cell with interface contracts',
    input_schema: {
      type: 'object',
      properties: {
        cellId: { type: 'string' },
        blueprintId: { type: 'string' },
        burstMode: { type: 'boolean', description: 'Use 3 concurrent generators' },
      },
      required: ['cellId', 'blueprintId'],
    },
    category: 'lattice',
  },
];

// ============================================
// ADVANCED TOOL USE SERVICE
// ============================================

export class AdvancedToolUseService extends EventEmitter {
  private anthropic: Anthropic;
  private config: AdvancedToolUseConfig;
  private toolLibraryByCategory: Map<string, ToolDefinition[]> = new Map();

  constructor(config?: Partial<AdvancedToolUseConfig>) {
    super();

    this.anthropic = new Anthropic();

    this.config = {
      toolSearch: {
        enabled: true,
        toolLibrary: KRIPTIK_TOOL_LIBRARY,
        maxToolsToLoad: 10,
        categories: ['verification', 'build', 'intent', 'ghost_mode', 'learning', 'cloud', 'agents', 'context', 'lattice'],
      },
      programmaticToolCalling: {
        enabled: true,
        pythonEnvironment: 'sandboxed',
        maxExecutionTime: 30000,
        allowedModules: ['asyncio', 'json', 'datetime', 'math', 'typing'],
      },
      enableExamples: true,
      ...config,
    };

    // Index tools by category
    this.indexToolsByCategory();
  }

  private indexToolsByCategory(): void {
    for (const tool of this.config.toolSearch.toolLibrary) {
      const category = tool.category || 'general';
      if (!this.toolLibraryByCategory.has(category)) {
        this.toolLibraryByCategory.set(category, []);
      }
      this.toolLibraryByCategory.get(category)!.push(tool);
    }
  }

  // ============================================
  // TOOL SEARCH TOOL
  // Defers loading tools until needed - saves 40K+ tokens
  // ============================================

  getToolSearchTool(): Anthropic.Tool {
    return {
      name: 'search_kriptik_tools',
      description: `Search for KripTik AI tools. Available categories: ${this.config.toolSearch.categories.join(', ')}. Use this to discover tools before calling them.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Natural language description of what you want to do',
          },
          category: {
            type: 'string',
            enum: this.config.toolSearch.categories,
            description: 'Optional category filter',
          },
        },
        required: ['query'],
      },
    };
  }

  async searchTools(query: string, category?: string): Promise<ToolDefinition[]> {
    let candidates = this.config.toolSearch.toolLibrary;

    // Filter by category if specified
    if (category) {
      candidates = this.toolLibraryByCategory.get(category) || [];
    }

    // Simple keyword matching (in production, would use embeddings)
    const queryLower = query.toLowerCase();
    const scored = candidates.map(tool => {
      let score = 0;
      if (tool.name.toLowerCase().includes(queryLower)) score += 10;
      if (tool.description.toLowerCase().includes(queryLower)) score += 5;
      for (const word of queryLower.split(' ')) {
        if (tool.description.toLowerCase().includes(word)) score += 1;
      }
      return { tool, score };
    });

    // Sort by score and return top results
    scored.sort((a, b) => b.score - a.score);
    const results = scored
      .filter(s => s.score > 0)
      .slice(0, this.config.toolSearch.maxToolsToLoad)
      .map(s => s.tool);

    this.emit('tools_searched', { query, category, resultsCount: results.length });

    return results;
  }

  // ============================================
  // TOOL USE EXAMPLES
  // Add examples to tools for 72% → 90% accuracy
  // ============================================

  getToolWithExamples(tool: ToolDefinition): Anthropic.Tool {
    const baseToolSpec: Anthropic.Tool = {
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
    };

    if (this.config.enableExamples && tool.examples && tool.examples.length > 0) {
      // Add examples to description
      const exampleText = tool.examples.map((ex, i) =>
        `\nExample ${i + 1}: ${ex.description}\nInput: ${JSON.stringify(ex.input)}\nOutput: ${JSON.stringify(ex.output)}`
      ).join('\n');

      baseToolSpec.description = `${tool.description}\n\n${exampleText}`;
    }

    return baseToolSpec;
  }

  // ============================================
  // PROGRAMMATIC TOOL CALLING
  // Code-based orchestration - 37% token reduction
  // ============================================

  getProgrammaticToolCallingTool(): Anthropic.Tool {
    return {
      name: 'execute_tool_code',
      description: `Execute Python code that orchestrates multiple KripTik tools. The code can:
- Call multiple tools in parallel using asyncio
- Process tool outputs before returning
- Control what information enters the conversation context
- Handle errors and retries

Only final results are returned to the model, saving context tokens.

Available tool functions:
${KRIPTIK_TOOL_LIBRARY.map(t => `- ${t.name}(${Object.keys((t.input_schema as any).properties || {}).join(', ')})`).join('\n')}`,
      input_schema: {
        type: 'object' as const,
        properties: {
          code: {
            type: 'string',
            description: 'Python code to execute. Use async def main() as entry point.',
          },
        },
        required: ['code'],
      },
    };
  }

  async executeProgrammaticToolCalling(code: string): Promise<unknown> {
    if (!this.config.programmaticToolCalling.enabled) {
      throw new Error('Programmatic Tool Calling is disabled');
    }

    // In production, this would use a sandboxed Python environment
    // For now, we'll parse and execute the tool calls

    this.emit('ptc_execution_started', { code });

    try {
      // Parse the code to extract tool calls
      const toolCalls = this.parseToolCallsFromCode(code);

      // Execute tool calls in parallel where possible
      const results = await Promise.all(
        toolCalls.map(tc => this.executeToolCall(tc.name, tc.args))
      );

      // Combine results
      const finalResult = this.combineResults(toolCalls, results);

      this.emit('ptc_execution_completed', { toolCallsCount: toolCalls.length, result: finalResult });

      return finalResult;
    } catch (error) {
      this.emit('ptc_execution_failed', { error });
      throw error;
    }
  }

  private parseToolCallsFromCode(code: string): Array<{ name: string; args: Record<string, unknown> }> {
    // Simple parser for tool calls in the format: tool_name(arg1=value1, arg2=value2)
    const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const toolNames = KRIPTIK_TOOL_LIBRARY.map(t => t.name);

    for (const toolName of toolNames) {
      const regex = new RegExp(`${toolName}\\s*\\(([^)]+)\\)`, 'g');
      let match;
      while ((match = regex.exec(code)) !== null) {
        try {
          // Parse arguments (simplified - in production would use AST)
          const argsString = match[1];
          const args: Record<string, unknown> = {};

          // Handle keyword arguments
          const argPairs = argsString.split(',').map(s => s.trim());
          for (const pair of argPairs) {
            const [key, ...valueParts] = pair.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=').trim();
              try {
                args[key.trim()] = JSON.parse(value);
              } catch {
                args[key.trim()] = value.replace(/['"]/g, '');
              }
            }
          }

          toolCalls.push({ name: toolName, args });
        } catch (e) {
          console.warn(`Failed to parse tool call: ${match[0]}`);
        }
      }
    }

    return toolCalls;
  }

  private async executeToolCall(
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    // In production, this would dispatch to actual tool implementations
    // For now, return mock results based on tool type

    const tool = KRIPTIK_TOOL_LIBRARY.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Simulate tool execution
    await new Promise(resolve => setTimeout(resolve, 100));

    // Return mock result based on tool
    switch (name) {
      case 'run_verification_swarm':
        return { verdict: 'APPROVED', score: 92, time_ms: 15000 };
      case 'run_error_checker':
        return { errors: 0, warnings: 2, fixed: 0 };
      case 'get_build_phase':
        return { phase: 2, name: 'PARALLEL_BUILD', progress: 0.45 };
      default:
        return { success: true, tool: name, args };
    }
  }

  private combineResults(
    toolCalls: Array<{ name: string; args: Record<string, unknown> }>,
    results: unknown[]
  ): Record<string, unknown> {
    const combined: Record<string, unknown> = {};
    for (let i = 0; i < toolCalls.length; i++) {
      combined[toolCalls[i].name] = results[i];
    }
    return combined;
  }

  // ============================================
  // CREATE API REQUEST WITH ADVANCED FEATURES
  // ============================================

  async createMessageWithAdvancedToolUse(
    messages: Anthropic.MessageParam[],
    options: {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
      toolCategories?: string[];
    } = {}
  ): Promise<Anthropic.Message> {
    const {
      model = 'claude-opus-4-5-20251101',
      maxTokens = 8192,
      systemPrompt,
      toolCategories,
    } = options;

    // Build tool list
    const tools: Anthropic.Tool[] = [];

    // Always include Tool Search Tool
    if (this.config.toolSearch.enabled) {
      tools.push(this.getToolSearchTool());
    }

    // Add Programmatic Tool Calling if enabled
    if (this.config.programmaticToolCalling.enabled) {
      tools.push(this.getProgrammaticToolCallingTool());
    }

    // Add tools from specified categories (with examples)
    if (toolCategories) {
      for (const category of toolCategories) {
        const categoryTools = this.toolLibraryByCategory.get(category) || [];
        for (const tool of categoryTools) {
          tools.push(this.getToolWithExamples(tool));
        }
      }
    }

    // Make API request with advanced tool use beta header
    const response = await this.anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      tools,
      // @ts-ignore - Beta header for advanced tool use
      betas: ['advanced-tool-use-2025-11-20'],
    });

    return response;
  }

  // ============================================
  // PROMPT CACHING
  // 50% discount on cached tokens, 80% latency reduction
  // ============================================

  createCachedSystemPrompt(
    intentContract: string,
    projectArchitecture: string,
    antiSlopRules: string
  ): Anthropic.MessageCreateParams['system'] {
    // Mark static parts for caching
    return [
      {
        type: 'text' as const,
        text: intentContract,
        // @ts-ignore - Cache control for prompt caching
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text' as const,
        text: projectArchitecture,
        // @ts-ignore
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text' as const,
        text: antiSlopRules,
        // @ts-ignore
        cache_control: { type: 'ephemeral' },
      },
    ];
  }

  // ============================================
  // TOKEN ESTIMATION
  // ============================================

  estimateToolTokens(tools: ToolDefinition[]): number {
    // Approximate token count for tool definitions
    return tools.reduce((sum, tool) => {
      const schemaStr = JSON.stringify(tool.input_schema);
      const examplesStr = tool.examples ? JSON.stringify(tool.examples) : '';
      return sum + (tool.description.length + schemaStr.length + examplesStr.length) / 4;
    }, 0);
  }

  estimateTokenSavings(): {
    withoutToolSearch: number;
    withToolSearch: number;
    savings: number;
    percentReduction: number;
  } {
    const allToolsTokens = this.estimateToolTokens(KRIPTIK_TOOL_LIBRARY);
    const toolSearchTokens = 500; // Tool Search Tool itself
    const avgLoadedTools = this.config.toolSearch.maxToolsToLoad;
    const avgLoadedTokens = (allToolsTokens / KRIPTIK_TOOL_LIBRARY.length) * avgLoadedTools;

    return {
      withoutToolSearch: allToolsTokens,
      withToolSearch: toolSearchTokens + avgLoadedTokens,
      savings: allToolsTokens - (toolSearchTokens + avgLoadedTokens),
      percentReduction: Math.round((1 - (toolSearchTokens + avgLoadedTokens) / allToolsTokens) * 100),
    };
  }
}

// Export singleton
export const advancedToolUseService = new AdvancedToolUseService();

export default AdvancedToolUseService;
