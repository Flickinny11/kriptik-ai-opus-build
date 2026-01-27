/**
 * Code Generator Bridge
 *
 * Connects AI code generation (OpenRouter/Anthropic) to the task execution system.
 * This is the critical bridge between intent and implementation.
 *
 * Flow:
 * 1. Task comes from work-stealing queue
 * 2. Bridge constructs prompt with context
 * 3. AI generates code
 * 4. Code is validated and written
 * 5. Type checker verifies
 * 6. Discovery is announced
 *
 * Integrations:
 * - OpenRouter for multi-model support
 * - Anthropic SDK for Claude models
 * - Interface contracts for type safety
 * - Local context for shared knowledge
 */

import { EventEmitter } from 'events';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// =============================================================================
// TYPES
// =============================================================================

export interface CodeGenerationRequest {
  taskId: string;
  agentId: string;
  taskType: 'component' | 'hook' | 'service' | 'store' | 'route' | 'type' | 'style' | 'test' | 'config';
  filePath: string;
  action: 'create' | 'modify' | 'delete';
  description: string;
  requirements: string[];
  dependencies: string[];
  exports: string[];
  imports: Array<{ name: string; from: string }>;
  existingCode?: string; // For modifications
  relatedFiles?: Array<{ path: string; content: string }>;
  designContext?: {
    mockupUrl?: string;
    blueprint?: Record<string, unknown>;
    visualIntent?: Record<string, unknown>;
  };
  constraints?: {
    maxLines?: number;
    framework?: string;
    styling?: string;
    stateManagement?: string;
  };
}

export interface CodeGenerationResult {
  success: boolean;
  taskId: string;
  agentId: string;
  filePath: string;
  code: string;
  exports: string[];
  imports: Array<{ name: string; from: string }>;
  metadata: {
    model: string;
    tokensUsed: number;
    generationTimeMs: number;
    confidence: number;
  };
  error?: string;
}

export interface GeneratorConfig {
  provider: 'anthropic' | 'openrouter';
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  retryAttempts: number;
  timeoutMs: number;
}

export interface ProviderClients {
  anthropic?: Anthropic;
  openrouter?: OpenAI;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_GENERATOR_CONFIG: GeneratorConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 8192,
  temperature: 0.3,
  systemPrompt: `You are an expert code generator for a React/TypeScript application.

CRITICAL RULES:
1. Generate ONLY the requested code - no explanations, no markdown
2. Use TypeScript with strict typing
3. Follow the imports/exports exactly as specified
4. Match the existing codebase style
5. Never use placeholder content (TODO, FIXME, lorem ipsum)
6. Never use emoji in code
7. Use functional components with hooks
8. Export types and interfaces separately

STYLE REQUIREMENTS:
- Tailwind CSS for styling
- Zustand for state management
- React Query for data fetching
- Framer Motion for animations

CODE FORMAT:
Return ONLY the code, starting with imports and ending with exports.
No markdown code blocks, no explanations.`,
  retryAttempts: 3,
  timeoutMs: 60000,
};

// =============================================================================
// PROMPT TEMPLATES
// =============================================================================

const PROMPT_TEMPLATES = {
  component: (req: CodeGenerationRequest) => `
Create a React component at: ${req.filePath}

COMPONENT NAME: ${req.filePath.split('/').pop()?.replace('.tsx', '')}

REQUIREMENTS:
${req.requirements.map(r => `- ${r}`).join('\n')}

IMPORTS NEEDED:
${req.imports.map(i => `import { ${i.name} } from '${i.from}';`).join('\n')}

EXPORTS REQUIRED:
${req.exports.map(e => `- ${e}`).join('\n')}

${req.designContext?.blueprint ? `
DESIGN BLUEPRINT:
${JSON.stringify(req.designContext.blueprint, null, 2)}
` : ''}

${req.relatedFiles?.length ? `
RELATED FILES FOR CONTEXT:
${req.relatedFiles.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n')}
` : ''}

${req.existingCode ? `
EXISTING CODE TO MODIFY:
${req.existingCode}
` : ''}

Generate the complete TypeScript/React code now:`,

  hook: (req: CodeGenerationRequest) => `
Create a custom React hook at: ${req.filePath}

HOOK NAME: ${req.filePath.split('/').pop()?.replace('.ts', '')}

REQUIREMENTS:
${req.requirements.map(r => `- ${r}`).join('\n')}

IMPORTS NEEDED:
${req.imports.map(i => `import { ${i.name} } from '${i.from}';`).join('\n')}

EXPORTS REQUIRED:
${req.exports.map(e => `- ${e}`).join('\n')}

USAGE PATTERN:
const { ... } = ${req.exports[0] || 'useCustomHook'}();

Generate the complete TypeScript hook code now:`,

  store: (req: CodeGenerationRequest) => `
Create a Zustand store at: ${req.filePath}

STORE NAME: ${req.filePath.split('/').pop()?.replace('.ts', '')}

REQUIREMENTS:
${req.requirements.map(r => `- ${r}`).join('\n')}

STATE STRUCTURE AND ACTIONS:
${req.description}

EXPORTS REQUIRED:
${req.exports.map(e => `- ${e}`).join('\n')}

Use this Zustand pattern:
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface StoreState {
  // state
}

interface StoreActions {
  // actions
}

export const useStore = create<StoreState & StoreActions>()(
  devtools(
    persist(
      (set, get) => ({
        // implementation
      }),
      { name: 'store-name' }
    )
  )
);

Generate the complete Zustand store code now:`,

  service: (req: CodeGenerationRequest) => `
Create an API service at: ${req.filePath}

SERVICE NAME: ${req.filePath.split('/').pop()?.replace('.ts', '')}

REQUIREMENTS:
${req.requirements.map(r => `- ${r}`).join('\n')}

API METHODS NEEDED:
${req.description}

EXPORTS REQUIRED:
${req.exports.map(e => `- ${e}`).join('\n')}

Use this service pattern:
- Use fetch or axios for HTTP requests
- Include proper error handling
- Return typed responses
- Support cancellation tokens

Generate the complete TypeScript service code now:`,

  route: (req: CodeGenerationRequest) => `
Create an Express API route at: ${req.filePath}

ROUTE PATH: ${req.description.split(':')[0] || '/api/endpoint'}

REQUIREMENTS:
${req.requirements.map(r => `- ${r}`).join('\n')}

METHODS TO IMPLEMENT:
${req.description}

Use this Express pattern:
import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router = Router();

// Input validation with Zod
const inputSchema = z.object({...});

router.get('/', async (req: Request, res: Response) => {
  // implementation
});

export default router;

Generate the complete Express route code now:`,

  type: (req: CodeGenerationRequest) => `
Create TypeScript types/interfaces at: ${req.filePath}

TYPE DEFINITIONS NEEDED:
${req.description}

EXPORTS REQUIRED:
${req.exports.map(e => `- ${e}`).join('\n')}

Requirements:
- Use interfaces for object shapes
- Use type for unions/intersections
- Include JSDoc documentation
- Export all types

Generate the complete TypeScript type definitions now:`,

  style: (req: CodeGenerationRequest) => `
Create Tailwind CSS configuration/styles at: ${req.filePath}

STYLING REQUIREMENTS:
${req.requirements.map(r => `- ${r}`).join('\n')}

DESIGN CONTEXT:
${req.description}

${req.designContext?.blueprint ? `
DESIGN TOKENS:
${JSON.stringify(req.designContext.blueprint, null, 2)}
` : ''}

Generate the complete styling code now:`,

  test: (req: CodeGenerationRequest) => `
Create tests at: ${req.filePath}

TESTING:
${req.description}

REQUIREMENTS:
${req.requirements.map(r => `- ${r}`).join('\n')}

${req.relatedFiles?.length ? `
CODE TO TEST:
${req.relatedFiles.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n')}
` : ''}

Use this testing pattern:
- Vitest for test runner
- React Testing Library for components
- Mock API calls
- Test happy path and error cases

Generate the complete test code now:`,

  config: (req: CodeGenerationRequest) => `
Create configuration at: ${req.filePath}

CONFIGURATION TYPE:
${req.description}

REQUIREMENTS:
${req.requirements.map(r => `- ${r}`).join('\n')}

Generate the complete configuration code now:`,
};

// =============================================================================
// CODE GENERATOR BRIDGE
// =============================================================================

export class CodeGeneratorBridge extends EventEmitter {
  private config: GeneratorConfig;
  private clients: ProviderClients = {};
  private generationCount = 0;
  private totalTokensUsed = 0;

  constructor(config: Partial<GeneratorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_GENERATOR_CONFIG, ...config };
    this.initializeClients();
  }

  /**
   * Initialize AI provider clients.
   */
  private initializeClients(): void {
    // Initialize Anthropic client
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      this.clients.anthropic = new Anthropic({
        apiKey: anthropicKey,
      });
    }

    // Initialize OpenRouter client
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (openrouterKey) {
      this.clients.openrouter = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: openrouterKey,
        defaultHeaders: {
          'HTTP-Referer': process.env.APP_URL || 'https://kriptik.app',
          'X-Title': 'KripTik AI',
        },
      });
    }
  }

  // ===========================================================================
  // CODE GENERATION
  // ===========================================================================

  /**
   * Generate code for a task.
   */
  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    const startTime = Date.now();

    this.emit('generation:started', {
      taskId: request.taskId,
      agentId: request.agentId,
      filePath: request.filePath,
    });

    try {
      // Build the prompt
      const prompt = this.buildPrompt(request);

      // Generate code
      const response = await this.callProvider(prompt);

      // Extract and validate code
      const code = this.extractCode(response.content);
      const { exports, imports } = this.analyzeCode(code);

      const result: CodeGenerationResult = {
        success: true,
        taskId: request.taskId,
        agentId: request.agentId,
        filePath: request.filePath,
        code,
        exports,
        imports,
        metadata: {
          model: response.model,
          tokensUsed: response.tokensUsed,
          generationTimeMs: Date.now() - startTime,
          confidence: this.calculateConfidence(code, request),
        },
      };

      this.generationCount++;
      this.totalTokensUsed += response.tokensUsed;

      this.emit('generation:completed', result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const result: CodeGenerationResult = {
        success: false,
        taskId: request.taskId,
        agentId: request.agentId,
        filePath: request.filePath,
        code: '',
        exports: [],
        imports: [],
        metadata: {
          model: this.config.model,
          tokensUsed: 0,
          generationTimeMs: Date.now() - startTime,
          confidence: 0,
        },
        error: errorMessage,
      };

      this.emit('generation:failed', result);
      return result;
    }
  }

  /**
   * Build the prompt for code generation.
   */
  private buildPrompt(request: CodeGenerationRequest): string {
    const template = PROMPT_TEMPLATES[request.taskType];
    if (!template) {
      return `Generate code for: ${request.description}`;
    }

    return template(request);
  }

  /**
   * Call the AI provider.
   */
  private async callProvider(prompt: string): Promise<{
    content: string;
    model: string;
    tokensUsed: number;
  }> {
    if (this.config.provider === 'anthropic' && this.clients.anthropic) {
      return this.callAnthropic(prompt);
    }

    if (this.config.provider === 'openrouter' && this.clients.openrouter) {
      return this.callOpenRouter(prompt);
    }

    throw new Error(`No client available for provider: ${this.config.provider}`);
  }

  /**
   * Call Anthropic Claude.
   */
  private async callAnthropic(prompt: string): Promise<{
    content: string;
    model: string;
    tokensUsed: number;
  }> {
    const client = this.clients.anthropic!;

    const response = await client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: this.config.systemPrompt,
      messages: [
        { role: 'user', content: prompt },
      ],
    });

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return {
      content,
      model: response.model,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  /**
   * Call OpenRouter.
   */
  private async callOpenRouter(prompt: string): Promise<{
    content: string;
    model: string;
    tokensUsed: number;
  }> {
    const client = this.clients.openrouter!;

    const response = await client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [
        { role: 'system', content: this.config.systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    return {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }

  // ===========================================================================
  // CODE PROCESSING
  // ===========================================================================

  /**
   * Extract code from AI response.
   */
  private extractCode(response: string): string {
    // Remove markdown code blocks if present
    let code = response;

    // Remove ```typescript or ```tsx blocks
    const codeBlockMatch = code.match(/```(?:typescript|tsx|ts|javascript|jsx|js)?\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1];
    }

    // Trim whitespace
    code = code.trim();

    return code;
  }

  /**
   * Analyze generated code for exports and imports.
   */
  private analyzeCode(code: string): {
    exports: string[];
    imports: Array<{ name: string; from: string }>;
  } {
    const exports: string[] = [];
    const imports: Array<{ name: string; from: string }> = [];

    // Find exports
    const exportMatches = code.matchAll(/export\s+(?:const|function|class|interface|type|enum)\s+(\w+)/g);
    for (const match of exportMatches) {
      exports.push(match[1]);
    }

    // Find default exports
    const defaultExportMatch = code.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    if (defaultExportMatch) {
      exports.push(`default:${defaultExportMatch[1]}`);
    }

    // Find named export blocks
    const namedExportMatch = code.match(/export\s+\{\s*([\w\s,]+)\s*\}/);
    if (namedExportMatch) {
      const names = namedExportMatch[1].split(',').map(n => n.trim());
      exports.push(...names);
    }

    // Find imports
    const importMatches = code.matchAll(/import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      const from = match[4];

      if (match[1]) {
        // Named imports: import { a, b } from '...'
        const names = match[1].split(',').map(n => n.trim());
        for (const name of names) {
          imports.push({ name, from });
        }
      } else if (match[2]) {
        // Namespace import: import * as X from '...'
        imports.push({ name: `* as ${match[2]}`, from });
      } else if (match[3]) {
        // Default import: import X from '...'
        imports.push({ name: match[3], from });
      }
    }

    return { exports, imports };
  }

  /**
   * Calculate confidence score for generated code.
   */
  private calculateConfidence(code: string, request: CodeGenerationRequest): number {
    let score = 1.0;

    // Check if all required exports are present
    const { exports } = this.analyzeCode(code);
    for (const required of request.exports) {
      if (!exports.includes(required)) {
        score -= 0.2;
      }
    }

    // Check for anti-patterns
    if (code.includes('TODO') || code.includes('FIXME')) {
      score -= 0.3;
    }

    if (code.includes('lorem ipsum') || code.includes('placeholder')) {
      score -= 0.3;
    }

    // Check for TypeScript types
    if (!code.includes(': ') && !code.includes('interface ') && !code.includes('type ')) {
      score -= 0.2; // Likely missing types
    }

    return Math.max(0, Math.min(1, score));
  }

  // ===========================================================================
  // BATCH GENERATION
  // ===========================================================================

  /**
   * Generate code for multiple tasks in parallel.
   */
  async generateBatch(
    requests: CodeGenerationRequest[],
    maxConcurrent = 5
  ): Promise<CodeGenerationResult[]> {
    const results: CodeGenerationResult[] = [];
    const queue = [...requests];

    // Process in batches
    while (queue.length > 0) {
      const batch = queue.splice(0, maxConcurrent);
      const batchResults = await Promise.all(
        batch.map(req => this.generateCode(req))
      );
      results.push(...batchResults);
    }

    return results;
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<GeneratorConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize clients if provider changed
    if (config.provider) {
      this.initializeClients();
    }
  }

  /**
   * Get current configuration.
   */
  getConfig(): GeneratorConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get generation statistics.
   */
  getStats(): {
    totalGenerations: number;
    totalTokensUsed: number;
    averageTokensPerGeneration: number;
    provider: string;
    model: string;
  } {
    return {
      totalGenerations: this.generationCount,
      totalTokensUsed: this.totalTokensUsed,
      averageTokensPerGeneration: this.generationCount > 0
        ? this.totalTokensUsed / this.generationCount
        : 0,
      provider: this.config.provider,
      model: this.config.model,
    };
  }

  /**
   * Check if the bridge is ready.
   */
  isReady(): boolean {
    return !!(
      (this.config.provider === 'anthropic' && this.clients.anthropic) ||
      (this.config.provider === 'openrouter' && this.clients.openrouter)
    );
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a code generator bridge.
 */
export function createCodeGeneratorBridge(
  config?: Partial<GeneratorConfig>
): CodeGeneratorBridge {
  return new CodeGeneratorBridge(config);
}
