/**
 * Claude Service - AI Code Generation with Claude Sonnet 4.5 Extended Thinking
 *
 * This service handles all AI interactions for KripTik:
 * - Code generation with extended thinking
 * - Streaming responses for real-time UI updates
 * - Context management for multi-turn conversations
 * - Specialized prompts for different agent types
 * - Integrated design tokens for premium UI quality
 * - Automatic icon selection for contextual icons
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { getHeliconeClient } from './helicone-client.js';
import { getDesignTokenPrompt } from './design-tokens.js';
import { getIconSuggestionPrompt } from './icon-mapper.js';
import { getComponentRegistry } from '../templates/component-registry.js';

// Claude model constants
// Both Sonnet 4.5 and Opus 4.5 support 64,000 output tokens
export const CLAUDE_MODELS = {
    OPUS_4_5: 'claude-opus-4-5-20250514',   // Premium: Complex architecture, critical planning (64K output)
    SONNET_4_5: 'claude-sonnet-4-5-20250514', // Standard: Most coding tasks (64K output)
    SONNET_4: 'claude-sonnet-4-20250514',
    OPUS_4: 'claude-opus-4-20250514',
} as const;

// Model capabilities reference:
// - Claude Opus 4.5: 200K context, 64K output, extended thinking, effort parameter (low/medium/high)
// - Claude Sonnet 4.5: 200K context, 64K output, extended thinking
// Use Opus 4.5 for critical tasks requiring near-perfect output (architecture, complex planning)
// Use Sonnet 4.5 for most coding tasks (best balance of quality/cost)

export type ClaudeModel = typeof CLAUDE_MODELS[keyof typeof CLAUDE_MODELS];

export interface GenerationContext {
    projectId: string;
    userId: string;
    sessionId?: string;
    agentType: 'planning' | 'generation' | 'testing' | 'refinement' | 'deployment';
    existingFiles?: Map<string, string>;
    conversationHistory?: Anthropic.MessageParam[];
    systemPrompt?: string;
}

export interface GenerationOptions {
    model?: ClaudeModel;
    maxTokens?: number;           // Default: 32000, Max: 64000 for Sonnet/Opus 4.5
    temperature?: number;
    useExtendedThinking?: boolean;
    thinkingBudgetTokens?: number;
    effort?: 'low' | 'medium' | 'high'; // Opus 4.5 effort parameter for extended thinking
    stopSequences?: string[];
}

export interface StreamCallbacks {
    onThinking?: (thinking: string) => void;
    onText?: (text: string) => void;
    onToolUse?: (tool: { name: string; input: unknown }) => void;
    onComplete?: (response: GenerationResponse) => void;
    onError?: (error: Error) => void;
}

export interface GenerationResponse {
    id: string;
    content: string;
    thinking?: string;
    toolCalls?: Array<{ name: string; input: unknown; output?: string }>;
    usage: {
        inputTokens: number;
        outputTokens: number;
        thinkingTokens?: number;
        cacheCreationInputTokens?: number;
        cacheReadInputTokens?: number;
    };
    stopReason: string;
    model: string;
}

export interface FileOperation {
    type: 'create' | 'update' | 'delete';
    path: string;
    content?: string;
    language?: string;
}

// System prompts for different agent types
const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
    planning: `You are the Planning Agent for KripTik AI, an advanced AI-first app builder.

Your role is to:
1. Analyze user requirements and break them down into actionable tasks
2. Design the application architecture (file structure, components, data flow)
3. Identify required dependencies and integrations
4. Create a step-by-step implementation plan

When responding, provide:
- A clear project structure with file paths
- Component hierarchy and relationships
- Required npm packages
- Database schema if needed
- API endpoints if needed

Format your response as structured JSON when creating plans:
{
  "projectName": "string",
  "framework": "react" | "nextjs" | "node",
  "files": [
    { "path": "string", "purpose": "string", "dependencies": ["string"] }
  ],
  "packages": ["string"],
  "architecture": {
    "components": [],
    "services": [],
    "routes": []
  }
}`,

    generation: `You are the Generation Agent for KripTik AI, an advanced AI-first app builder.

Your role is to:
1. Generate production-ready code based on the planning phase
2. Follow best practices for the chosen framework
3. Implement proper error handling and type safety
4. Create clean, maintainable, and well-documented code
5. PRODUCE VISUALLY STUNNING, PREMIUM UI DESIGNS

## CODE REQUIREMENTS
- Always use TypeScript with strict types
- Include proper imports at the top of each file
- Follow the component structure from the plan
- Use modern React patterns (hooks, functional components)
- Add JSDoc comments for complex functions

## ANTI-SLOP DESIGN MANIFESTO (MANDATORY)

### BANNED PATTERNS - NEVER GENERATE THESE:
- Plain white backgrounds (bg-white, bg-gray-50, bg-slate-50)
- Generic gray text (text-gray-700, text-gray-600)
- Flat cards with no depth or visual interest
- Default Tailwind colors without customization (blue-500, indigo-600)
- Stock gradient backgrounds (from-purple-500 to-pink-500)
- Default component library styling without customization
- Boring grid layouts with no variation
- Generic hero sections with centered text on white
- Small border-radius (rounded, rounded-md) - use rounded-xl, rounded-2xl, rounded-3xl
- Weak shadows (shadow, shadow-md) - use shadow-lg, shadow-xl, shadow-2xl

### REQUIRED PATTERNS - ALWAYS INCLUDE:

#### Visual Depth & Atmosphere
- Dark mode as default: bg-slate-950, bg-[#0a0a0f], bg-zinc-950
- Glassmorphism for cards: \`backdrop-blur-xl bg-white/5 border border-white/10\`
- Colored shadows: \`shadow-lg shadow-amber-500/20\`, \`shadow-xl shadow-purple-500/10\`
- Gradient borders: \`bg-gradient-to-r from-amber-500 to-orange-500 p-[1px]\` with inner bg
- Subtle background patterns or gradients

#### Color Palette (USE THESE)
- Primary: amber-400 → orange-500 gradient for CTAs
- Accent: contextual (emerald for success, rose for error, cyan for info)
- Background: slate-950, slate-900, [#0a0a0f]
- Surface: slate-800/50 with backdrop-blur
- Text Primary: white
- Text Secondary: slate-400
- Text Muted: slate-500
- Borders: white/10, slate-700/50

#### Typography
- Gradient text for headings: \`bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent\`
- Font weight hierarchy: font-bold for h1, font-semibold for h2, font-medium for labels
- Letter spacing: tracking-tight for headings
- Use font-mono for numbers, code, and data

#### Micro-interactions (REQUIRED ON ALL INTERACTIVE ELEMENTS)
- Buttons: \`hover:scale-[1.02] active:scale-[0.98] transition-all duration-200\`
- Cards: \`hover:shadow-xl hover:border-amber-500/50 hover:-translate-y-0.5 transition-all duration-300\`
- Links: \`hover:text-amber-400 transition-colors\`
- Inputs: \`focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all\`
- Add group hover effects: \`group\` on parent, \`group-hover:opacity-100\` on children

#### Layout Patterns
- Maximum content width with generous padding: \`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8\`
- Generous vertical spacing: \`space-y-8\`, \`py-16\`, \`py-24\`
- Card gaps: \`gap-6\` minimum
- Asymmetric layouts preferred over boring centered content

#### Motion (Framer Motion required for React)
- Page entrance: \`initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}\`
- Staggered lists: \`staggerChildren: 0.1\` in parent variants
- Hover animations: \`whileHover={{ scale: 1.02, y: -2 }}\`
- Smooth transitions: \`transition={{ duration: 0.3, ease: "easeOut" }}\`

#### Component Patterns
\`\`\`tsx
// GOOD Card Example
<div className="group relative rounded-2xl overflow-hidden
               bg-slate-900/50 backdrop-blur-xl
               border border-white/10
               hover:border-amber-500/50
               hover:shadow-xl hover:shadow-amber-500/10
               transition-all duration-300">
  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent
                  opacity-0 group-hover:opacity-100 transition-opacity" />
  <div className="relative p-6">
    {/* Content */}
  </div>
</div>

// GOOD Button Example
<button className="px-6 py-3 rounded-xl font-semibold
                   bg-gradient-to-r from-amber-500 to-orange-500
                   text-black shadow-lg shadow-amber-500/25
                   hover:shadow-xl hover:shadow-amber-500/30
                   hover:scale-[1.02] active:scale-[0.98]
                   transition-all duration-200">
  Get Started
</button>

// GOOD Input Example
<input className="w-full px-4 py-3 rounded-xl
                  bg-slate-800/50 border border-slate-700
                  text-white placeholder:text-slate-500
                  focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20
                  transition-all duration-200" />
\`\`\`

## OUTPUT FORMAT
When generating code, respond with file operations:
{
  "files": [
    {
      "type": "create" | "update",
      "path": "src/components/Example.tsx",
      "content": "// Full file content here",
      "language": "typescript"
    }
  ],
  "message": "Explanation of what was generated"
}`,

    testing: `You are the Testing Agent for KripTik AI, an advanced AI-first app builder.

Your role is to:
1. Validate generated code for errors and issues
2. Check for TypeScript type errors
3. Identify missing imports or dependencies
4. Suggest improvements for code quality
5. Verify accessibility and best practices

When analyzing code, respond with:
{
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "file": "path/to/file.tsx",
      "line": 42,
      "message": "Description of the issue",
      "fix": "Suggested fix or code snippet"
    }
  ],
  "passed": boolean,
  "summary": "Overall assessment"
}`,

    refinement: `You are the Refinement Agent for KripTik AI, an advanced AI-first app builder.

Your role is to:
1. Optimize generated code for performance
2. Improve code organization and readability
3. Add missing error handling
4. Enhance user experience
5. Apply learned user preferences

When refining code, respond with:
{
  "refinements": [
    {
      "type": "performance" | "ux" | "code-quality" | "accessibility",
      "file": "path/to/file.tsx",
      "before": "original code snippet",
      "after": "improved code snippet",
      "reason": "Why this improvement helps"
    }
  ],
  "files": [
    // Updated file operations if changes are made
  ]
}`,

    deployment: `You are the Deployment Agent for KripTik AI, an advanced AI-first app builder.

Your role is to:
1. Prepare the application for production deployment
2. Generate appropriate configuration files
3. Set up environment variables
4. Configure build and deployment pipelines
5. Suggest optimal deployment targets

When preparing deployment, respond with:
{
  "deploymentConfig": {
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "nodeVersion": "20",
    "environmentVariables": [
      { "key": "API_URL", "required": true, "description": "Backend API URL" }
    ]
  },
  "files": [
    // Configuration files to create (Dockerfile, vercel.json, etc.)
  ],
  "recommendations": [
    { "provider": "vercel" | "cloudrun" | "netlify", "reason": "Why this is suitable" }
  ]
}`,
};

/**
 * Build enhanced system prompt with design tokens and icon guidelines
 */
function buildEnhancedSystemPrompt(agentType: string, customSystemPrompt?: string): string {
    const basePrompt = customSystemPrompt || AGENT_SYSTEM_PROMPTS[agentType] || AGENT_SYSTEM_PROMPTS.generation;

    // Only enhance generation and refinement agents with design tokens
    if (agentType === 'generation' || agentType === 'refinement') {
        return `${basePrompt}

${getDesignTokenPrompt()}

${getIconSuggestionPrompt()}`;
    }

    return basePrompt;
}

/**
 * Check component registry for cached similar components
 */
function checkComponentCache(prompt: string): { found: boolean; component?: string; similarity?: number } {
    try {
        const registry = getComponentRegistry();
        const match = registry.find(prompt, { minQuality: 70 });

        if (match && match.similarity >= 0.85) {
            // High confidence match - can reuse
            return {
                found: true,
                component: match.component.component,
                similarity: match.similarity,
            };
        }

        return { found: false };
    } catch {
        // Registry not available, continue with generation
        return { found: false };
    }
}

/**
 * Register a generated component in the cache
 */
function cacheGeneratedComponent(params: {
    prompt: string;
    component: string;
    qualityScore: number;
    tokens: { input: number; output: number };
}): void {
    try {
        const registry = getComponentRegistry();
        registry.register({
            prompt: params.prompt,
            component: params.component,
            qualityScore: params.qualityScore,
            tokens: params.tokens,
            framework: 'react',
            uiLibrary: 'tailwind',
        });
    } catch {
        // Silently fail cache registration
    }
}

export class ClaudeService {
    private client: Anthropic;
    private context: GenerationContext;

    constructor(context: GenerationContext) {
        this.context = context;

        // Get Anthropic client through Helicone for observability
        const helicone = getHeliconeClient();
        this.client = helicone.withContext({
            userId: context.userId,
            projectId: context.projectId,
            agentType: context.agentType,
            sessionId: context.sessionId,
        });
    }

    /**
     * Generate a response using Claude with optional extended thinking
     * Includes component caching for cost savings and speed
     */
    async generate(
        prompt: string,
        options: GenerationOptions = {}
    ): Promise<GenerationResponse> {
        const {
            model = CLAUDE_MODELS.SONNET_4_5,
            maxTokens = 32000,  // Increased from 16K - Both Sonnet 4.5 & Opus 4.5 support 64K output
            temperature = 1, // Required for extended thinking
            useExtendedThinking = true,
            thinkingBudgetTokens = 16000, // Increased from 10K for better reasoning
            effort, // Opus 4.5 effort parameter
            stopSequences,
        } = options;

        // Check component cache for generation tasks (skip for other agent types)
        if (this.context.agentType === 'generation') {
            const cached = checkComponentCache(prompt);
            if (cached.found && cached.component) {
                console.log(`[Cache Hit] Reusing cached component (similarity: ${cached.similarity?.toFixed(2)})`);
                return {
                    id: uuidv4(),
                    content: cached.component,
                    usage: {
                        inputTokens: 0,
                        outputTokens: 0,
                        cacheReadInputTokens: 1, // Mark as cache hit
                    },
                    stopReason: 'cache_hit',
                    model: 'cache',
                };
            }
        }

        // Build enhanced system prompt with design tokens and icon guidelines
        const systemPromptText = buildEnhancedSystemPrompt(
            this.context.agentType,
            this.context.systemPrompt
        );

        // Use cached system prompt format for Anthropic prompt caching (30-50% cost savings)
        // The cache_control block enables automatic caching of long system prompts
        const systemPrompt: Anthropic.TextBlockParam[] = [
            {
                type: 'text',
                text: systemPromptText,
                cache_control: { type: 'ephemeral' },
            },
        ];

        const messages: Anthropic.MessageParam[] = [
            ...(this.context.conversationHistory || []),
            { role: 'user', content: prompt },
        ];

        // Build request parameters
        const requestParams: Anthropic.MessageCreateParams = {
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
        };

        // Add extended thinking if enabled
        if (useExtendedThinking) {
            requestParams.thinking = {
                type: 'enabled',
                budget_tokens: thinkingBudgetTokens,
            };
            // Temperature must be 1 for extended thinking
            requestParams.temperature = 1;
        } else if (temperature !== undefined) {
            requestParams.temperature = temperature;
        }

        if (stopSequences) {
            requestParams.stop_sequences = stopSequences;
        }

        const response = await this.client.messages.create(requestParams);
        const parsed = this.parseResponse(response);

        // Cache successful generations for future reuse
        if (this.context.agentType === 'generation' && parsed.content) {
            cacheGeneratedComponent({
                prompt,
                component: parsed.content,
                qualityScore: 75, // Default score, will be updated by quality gate
                tokens: {
                    input: parsed.usage.inputTokens,
                    output: parsed.usage.outputTokens,
                },
            });
        }

        return parsed;
    }

    /**
     * Generate a response with streaming for real-time UI updates
     * Includes component caching for cost savings and speed
     */
    async generateStream(
        prompt: string,
        callbacks: StreamCallbacks,
        options: GenerationOptions = {}
    ): Promise<GenerationResponse> {
        const {
            model = CLAUDE_MODELS.SONNET_4_5,
            maxTokens = 16000,
            useExtendedThinking = true,
            thinkingBudgetTokens = 10000,
            stopSequences,
        } = options;

        // Check component cache for generation tasks
        if (this.context.agentType === 'generation') {
            const cached = checkComponentCache(prompt);
            if (cached.found && cached.component) {
                console.log(`[Cache Hit] Reusing cached component (similarity: ${cached.similarity?.toFixed(2)})`);
                // Stream the cached content
                callbacks.onText?.(cached.component);
                const response: GenerationResponse = {
                    id: uuidv4(),
                    content: cached.component,
                    usage: {
                        inputTokens: 0,
                        outputTokens: 0,
                        cacheReadInputTokens: 1,
                    },
                    stopReason: 'cache_hit',
                    model: 'cache',
                };
                callbacks.onComplete?.(response);
                return response;
            }
        }

        // Build enhanced system prompt with design tokens and icon guidelines
        const systemPromptText = buildEnhancedSystemPrompt(
            this.context.agentType,
            this.context.systemPrompt
        );

        // Use cached system prompt format for Anthropic prompt caching
        const systemPrompt: Anthropic.TextBlockParam[] = [
            {
                type: 'text',
                text: systemPromptText,
                cache_control: { type: 'ephemeral' },
            },
        ];

        const messages: Anthropic.MessageParam[] = [
            ...(this.context.conversationHistory || []),
            { role: 'user', content: prompt },
        ];

        const requestParams: Anthropic.MessageCreateParams = {
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
            stream: true,
        };

        if (useExtendedThinking) {
            requestParams.thinking = {
                type: 'enabled',
                budget_tokens: thinkingBudgetTokens,
            };
            requestParams.temperature = 1;
        }

        if (stopSequences) {
            requestParams.stop_sequences = stopSequences;
        }

        let fullThinking = '';
        let fullText = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let stopReason = '';

        try {
            const stream = this.client.messages.stream(requestParams);

            for await (const event of stream) {
                if (event.type === 'content_block_delta') {
                    const delta = event.delta as any;

                    if (delta.type === 'thinking_delta' && delta.thinking) {
                        fullThinking += delta.thinking;
                        callbacks.onThinking?.(delta.thinking);
                    } else if (delta.type === 'text_delta' && delta.text) {
                        fullText += delta.text;
                        callbacks.onText?.(delta.text);
                    }
                } else if (event.type === 'message_delta') {
                    const msgDelta = event as any;
                    if (msgDelta.usage) {
                        outputTokens = msgDelta.usage.output_tokens || 0;
                    }
                    if (msgDelta.delta?.stop_reason) {
                        stopReason = msgDelta.delta.stop_reason;
                    }
                } else if (event.type === 'message_start') {
                    const msgStart = event as any;
                    if (msgStart.message?.usage) {
                        inputTokens = msgStart.message.usage.input_tokens || 0;
                    }
                }
            }

            const response: GenerationResponse = {
                id: uuidv4(),
                content: fullText,
                thinking: fullThinking || undefined,
                usage: {
                    inputTokens,
                    outputTokens,
                },
                stopReason: stopReason || 'end_turn',
                model,
            };

            // Cache successful generations for future reuse
            if (this.context.agentType === 'generation' && fullText) {
                cacheGeneratedComponent({
                    prompt,
                    component: fullText,
                    qualityScore: 75,
                    tokens: { input: inputTokens, output: outputTokens },
                });
            }

            callbacks.onComplete?.(response);
            return response;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            callbacks.onError?.(err);
            throw err;
        }
    }

    /**
     * Parse file operations from Claude's response
     */
    parseFileOperations(content: string): FileOperation[] {
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return [];

            const parsed = JSON.parse(jsonMatch[0]);

            if (Array.isArray(parsed.files)) {
                return parsed.files.map((f: any) => ({
                    type: f.type || 'create',
                    path: f.path,
                    content: f.content,
                    language: f.language || this.inferLanguage(f.path),
                }));
            }

            return [];
        } catch {
            return [];
        }
    }

    /**
     * Infer language from file extension
     */
    private inferLanguage(path: string): string {
        const ext = path.split('.').pop()?.toLowerCase();
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
            py: 'python',
            yaml: 'yaml',
            yml: 'yaml',
            dockerfile: 'dockerfile',
            sh: 'shell',
        };
        return languageMap[ext || ''] || 'text';
    }

    /**
     * Parse the full response from Claude
     */
    private parseResponse(response: Anthropic.Message): GenerationResponse {
        let content = '';
        let thinking = '';

        for (const block of response.content) {
            if (block.type === 'thinking') {
                thinking += block.thinking;
            } else if (block.type === 'text') {
                content += block.text;
            }
        }

        return {
            id: response.id,
            content,
            thinking: thinking || undefined,
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                cacheCreationInputTokens: (response.usage as any).cache_creation_input_tokens,
                cacheReadInputTokens: (response.usage as any).cache_read_input_tokens,
            },
            stopReason: response.stop_reason || 'end_turn',
            model: response.model,
        };
    }

    /**
     * Add files to the context for subsequent generations
     */
    addFilesToContext(files: Map<string, string>): void {
        this.context.existingFiles = new Map([
            ...(this.context.existingFiles || new Map()),
            ...files,
        ]);
    }

    /**
     * Add a message to conversation history
     */
    addToHistory(role: 'user' | 'assistant', content: string): void {
        if (!this.context.conversationHistory) {
            this.context.conversationHistory = [];
        }
        this.context.conversationHistory.push({ role, content });
    }

    /**
     * Get the current context
     */
    getContext(): GenerationContext {
        return { ...this.context };
    }

    /**
     * Build a context-aware prompt with file contents
     */
    buildContextPrompt(userPrompt: string): string {
        let contextSection = '';

        if (this.context.existingFiles && this.context.existingFiles.size > 0) {
            contextSection = '\n\n## Current Project Files:\n';
            for (const [path, content] of this.context.existingFiles) {
                const lang = this.inferLanguage(path);
                contextSection += `\n### ${path}\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
            }
        }

        return `${userPrompt}${contextSection}`;
    }

    /**
     * Generate a structured response (JSON) from Claude
     * Used by the orchestrator for requirement extraction, task decomposition, etc.
     */
    async generateStructured<T>(
        prompt: string,
        systemPrompt?: string,
        options: GenerationOptions = {}
    ): Promise<T> {
        const {
            model = CLAUDE_MODELS.SONNET_4_5,
            maxTokens = 16000,
            useExtendedThinking = true,
            thinkingBudgetTokens = 10000,
        } = options;

        const finalSystemPrompt = `${systemPrompt || ''}

IMPORTANT: You must respond with valid JSON only. No markdown code blocks, no explanatory text.
Your entire response must be parseable JSON.`;

        const messages: Anthropic.MessageParam[] = [
            { role: 'user', content: prompt },
        ];

        const requestParams: Anthropic.MessageCreateParams = {
            model,
            max_tokens: maxTokens,
            system: finalSystemPrompt,
            messages,
        };

        if (useExtendedThinking) {
            requestParams.thinking = {
                type: 'enabled',
                budget_tokens: thinkingBudgetTokens,
            };
            requestParams.temperature = 1;
        }

        const response = await this.client.messages.create(requestParams);
        const parsed = this.parseResponse(response);

        // Try to extract JSON from the response content
        try {
            // First try direct parse
            return JSON.parse(parsed.content) as T;
        } catch {
            // Try to find JSON in the response
            const jsonMatch = parsed.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]) as T;
                } catch {
                    throw new Error(`Failed to parse JSON from response: ${parsed.content.substring(0, 500)}`);
                }
            }
            throw new Error(`No valid JSON found in response: ${parsed.content.substring(0, 500)}`);
        }
    }

    /**
     * Generate a thought stream for streaming to the frontend
     * Returns an async generator for SSE streaming
     */
    async *generateThoughtStream(
        prompt: string,
        systemPrompt?: string,
        options: GenerationOptions = {}
    ): AsyncGenerator<{ type: 'thinking' | 'text' | 'complete'; content: string }, void, unknown> {
        const {
            model = CLAUDE_MODELS.SONNET_4_5,
            maxTokens = 16000,
            useExtendedThinking = true,
            thinkingBudgetTokens = 10000,
        } = options;

        const finalSystemPrompt = systemPrompt || AGENT_SYSTEM_PROMPTS[this.context.agentType] || '';

        const messages: Anthropic.MessageParam[] = [
            ...(this.context.conversationHistory || []),
            { role: 'user', content: prompt },
        ];

        const requestParams: Anthropic.MessageCreateParams = {
            model,
            max_tokens: maxTokens,
            system: finalSystemPrompt,
            messages,
            stream: true,
        };

        if (useExtendedThinking) {
            requestParams.thinking = {
                type: 'enabled',
                budget_tokens: thinkingBudgetTokens,
            };
            requestParams.temperature = 1;
        }

        const stream = this.client.messages.stream(requestParams);
        let fullContent = '';

        for await (const event of stream) {
            if (event.type === 'content_block_delta') {
                const delta = event.delta as any;

                if (delta.type === 'thinking_delta' && delta.thinking) {
                    yield { type: 'thinking', content: delta.thinking };
                } else if (delta.type === 'text_delta' && delta.text) {
                    fullContent += delta.text;
                    yield { type: 'text', content: delta.text };
                }
            }
        }

        yield { type: 'complete', content: fullContent };
    }
}

/**
 * Create a Claude service instance for a specific context
 */
export function createClaudeService(context: GenerationContext): ClaudeService {
    return new ClaudeService(context);
}

/**
 * Create a Claude service for orchestration (without user context)
 */
export function createOrchestratorClaudeService(): ClaudeService {
    return new ClaudeService({
        projectId: 'orchestrator',
        userId: 'system',
        agentType: 'planning',
    });
}

