/**
 * Hyper-Thinking Orchestrator
 * 
 * Central coordinator for all hyper-thinking operations.
 * Features:
 * - Complexity analysis and strategy selection
 * - Model routing based on task requirements
 * - Budget management and tracking
 * - Multiple reasoning strategies: CoT, ToT, Multi-Agent
 * - Streaming support with hallucination detection
 */

import { v4 as uuidv4 } from 'uuid';
import {
  type HyperThinkingConfig,
  type HyperThinkingInput,
  type HyperThinkingResult,
  type ReasoningStep,
  type ReasoningStrategy,
  type StreamingEvent,
  type TokenUsage,
  type ThinkingBudget,
  type ModelTier,
  DEFAULT_HYPER_THINKING_CONFIG,
  HyperThinkingError,
} from './types.js';
import { getComplexityAnalyzer, type ComplexityAnalyzer } from './complexity-analyzer.js';
import { getModelRouter, type ModelRouter } from './model-router.js';
import { getBudgetManager, type BudgetManager, type BudgetSession } from './budget-manager.js';
import type { RoutingDecision } from './types.js';
import {
  getProvider,
  type ReasoningProvider,
  type ReasoningRequest,
  type ReasoningResponse,
} from './providers/index.js';
import { createToTEngine, type ToTEngine, type ToTResult } from './tree-of-thought/index.js';
import { createSwarmEngine, type SwarmEngine, type SwarmResult } from './multi-agent/index.js';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Default timeout in milliseconds */
  defaultTimeoutMs: parseInt(process.env.HYPER_THINKING_TIMEOUT_MS || '300000', 10),
  /** Maximum parallel operations */
  maxParallelOps: parseInt(process.env.HYPER_THINKING_MAX_PARALLEL_AGENTS || '5', 10),
  /** Default temperature */
  defaultTemperature: 0.7,
  /** System prompt for reasoning */
  systemPrompt: `You are an expert reasoning assistant with advanced analytical capabilities.
When solving problems:
1. Break down complex problems into manageable parts
2. Consider multiple perspectives and approaches
3. Validate your reasoning at each step
4. Be explicit about assumptions and uncertainties
5. Provide clear, well-structured responses`,
};

// ============================================================================
// Orchestrator Class
// ============================================================================

export class HyperThinkingOrchestrator {
  private complexityAnalyzer: ComplexityAnalyzer;
  private modelRouter: ModelRouter;
  private budgetManager: BudgetManager;
  private activeSessions: Map<string, {
    sessionId: string;
    budgetSession: BudgetSession;
    routing: RoutingDecision;
    startedAt: Date;
  }> = new Map();
  
  constructor() {
    this.complexityAnalyzer = getComplexityAnalyzer();
    this.modelRouter = getModelRouter();
    this.budgetManager = getBudgetManager();
  }
  
  // ============================================================================
  // Main Entry Points
  // ============================================================================
  
  /**
   * Primary reasoning method - automatically selects best strategy
   */
  async think(input: HyperThinkingInput): Promise<HyperThinkingResult> {
    const sessionId = uuidv4();
    const startedAt = new Date();
    const config = this.mergeConfig(input.config);
    
    try {
      // Analyze complexity
      const analysis = await this.complexityAnalyzer.analyze(input.prompt, input.context);
      
      // Override strategy if specified in config
      const strategy = config.strategy !== DEFAULT_HYPER_THINKING_CONFIG.strategy
        ? config.strategy
        : analysis.recommendedStrategy;
      
      // Route to model
      const routing = await this.modelRouter.route(analysis, {
        forceModel: config.forceModel,
        forceProvider: config.forceProvider,
        forceTier: config.modelTier !== DEFAULT_HYPER_THINKING_CONFIG.modelTier
          ? config.modelTier
          : undefined,
        maxBudget: config.maxThinkingBudget,
      });
      
      // Create budget session
      const budgetSession = this.budgetManager.createSession(
        sessionId,
        config.userId || 'anonymous',
        routing.model.tier,
        { maxBudget: routing.thinkingBudget }
      );
      
      // Track active session
      this.activeSessions.set(sessionId, {
        sessionId,
        budgetSession,
        routing,
        startedAt,
      });
      
      // Execute strategy
      let result: HyperThinkingResult;
      
      switch (strategy) {
        case 'chain_of_thought':
          result = await this.chainOfThought(sessionId, input, config, routing);
          break;
        case 'tree_of_thought':
          result = await this.treeOfThought(sessionId, input, config, routing);
          break;
        case 'multi_agent':
          result = await this.multiAgentReasoning(sessionId, input, config, routing);
          break;
        case 'hybrid':
          result = await this.hybridReasoning(sessionId, input, config, routing);
          break;
        default:
          result = await this.chainOfThought(sessionId, input, config, routing);
      }
      
      // Complete budget session
      this.budgetManager.completeSession(sessionId);
      this.activeSessions.delete(sessionId);
      
      return result;
    } catch (error) {
      // Clean up on error
      this.budgetManager.cancelSession(sessionId);
      this.activeSessions.delete(sessionId);
      
      throw error;
    }
  }
  
  /**
   * Streaming reasoning - yields events during processing
   */
  async *thinkStream(input: HyperThinkingInput): AsyncGenerator<StreamingEvent, HyperThinkingResult> {
    const sessionId = uuidv4();
    const startedAt = new Date();
    const config = this.mergeConfig(input.config);
    
    try {
      // Analyze complexity
      const analysis = await this.complexityAnalyzer.analyze(input.prompt, input.context);
      
      yield {
        type: 'thinking_start',
        content: `Analyzing task complexity: ${analysis.level} (score: ${analysis.score})`,
        metadata: { progress: 0.05 },
        timestamp: new Date(),
      };
      
      // Route to model
      const routing = await this.modelRouter.route(analysis, {
        forceModel: config.forceModel,
        forceProvider: config.forceProvider,
        maxBudget: config.maxThinkingBudget,
      });
      
      yield {
        type: 'thinking_step',
        content: `Selected model: ${routing.model.displayName} (${routing.model.tier} tier)`,
        metadata: { progress: 0.1 },
        timestamp: new Date(),
      };
      
      // Create budget session
      const budgetSession = this.budgetManager.createSession(
        sessionId,
        config.userId || 'anonymous',
        routing.model.tier,
        { maxBudget: routing.thinkingBudget }
      );
      
      this.activeSessions.set(sessionId, {
        sessionId,
        budgetSession,
        routing,
        startedAt,
      });
      
      // Get provider
      const provider = getProvider(routing.model.provider);
      
      // Build request
      const request: ReasoningRequest = {
        prompt: this.buildPrompt(input),
        systemPrompt: input.systemPrompt || CONFIG.systemPrompt,
        model: routing.model,
        thinkingBudget: routing.thinkingBudget,
        temperature: config.temperature,
        stream: true,
        previousContext: input.context,
      };
      
      // Execute with streaming
      const { stream, response } = provider.reasonStream(request);
      
      // Yield streaming events
      for await (const event of stream) {
        yield event;
      }
      
      // Wait for final response
      const finalResponse = await response;
      
      // Record usage
      this.budgetManager.recordUsage(sessionId, 'main', finalResponse.tokenUsage);
      
      // Complete session
      this.budgetManager.completeSession(sessionId);
      this.activeSessions.delete(sessionId);
      
      // Build result
      const result = this.buildResult(
        sessionId,
        config.strategy,
        finalResponse,
        [],
        startedAt
      );
      
      yield {
        type: 'thinking_complete',
        content: 'Reasoning complete',
        metadata: {
          tokensUsed: result.totalTokens.totalTokens,
          confidence: result.confidence,
        },
        timestamp: new Date(),
      };
      
      return result;
    } catch (error) {
      this.budgetManager.cancelSession(sessionId);
      this.activeSessions.delete(sessionId);
      
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
        metadata: {},
        timestamp: new Date(),
      };
      
      throw error;
    }
  }
  
  // ============================================================================
  // Reasoning Strategies
  // ============================================================================
  
  /**
   * Chain-of-Thought reasoning - sequential thinking
   */
  async chainOfThought(
    sessionId: string,
    input: HyperThinkingInput,
    config: HyperThinkingConfig,
    routing: RoutingDecision
  ): Promise<HyperThinkingResult> {
    const startedAt = new Date();
    const provider = getProvider(routing.model.provider);
    
    // Build prompt with CoT instructions
    const cotPrompt = `${this.buildPrompt(input)}

Think through this step by step:
1. First, understand the core problem or question
2. Break it down into logical components
3. Reason through each component
4. Synthesize your findings into a coherent answer

Provide your reasoning and final answer.`;
    
    const request: ReasoningRequest = {
      prompt: cotPrompt,
      systemPrompt: input.systemPrompt || CONFIG.systemPrompt,
      model: routing.model,
      thinkingBudget: routing.thinkingBudget,
      temperature: config.temperature,
      previousContext: input.context,
    };
    
    const response = await provider.reason(request);
    
    // Record usage
    this.budgetManager.recordUsage(sessionId, 'cot-main', response.tokenUsage);
    
    // Create reasoning step
    const step: ReasoningStep = {
      id: uuidv4(),
      parentId: null,
      depth: 0,
      thought: response.thinking || response.content,
      model: response.model,
      provider: response.provider,
      tokenUsage: response.tokenUsage,
      latencyMs: response.latencyMs,
      createdAt: new Date(),
      children: [],
      metadata: { strategy: 'chain_of_thought' },
    };
    
    return this.buildResult(
      sessionId,
      'chain_of_thought',
      response,
      [step],
      startedAt
    );
  }
  
  /**
   * Tree-of-Thought reasoning - parallel path exploration
   * Uses the full ToT engine with beam search, evaluation, and synthesis
   */
  async treeOfThought(
    sessionId: string,
    input: HyperThinkingInput,
    config: HyperThinkingConfig,
    routing: RoutingDecision
  ): Promise<HyperThinkingResult> {
    const startedAt = new Date();
    
    // Create ToT engine with configuration
    const totEngine = createToTEngine(routing.model, {
      strategy: 'beam',
      beamWidth: 5,
      maxDepth: 4,
      maxBranches: 3,
      evaluationThreshold: 0.5,
      pruningThreshold: 0.3,
      generationTemperature: Math.max(config.temperature, 0.8),
      evaluationTemperature: 0.3,
      minSuccessScore: 0.7,
    });
    
    // Run ToT
    const totResult = await totEngine.solve(
      this.buildPrompt(input),
      input.hints
    );
    
    // Record usage
    this.budgetManager.recordUsage(sessionId, 'tot-main', totResult.totalTokens);
    
    // Convert ToT result to reasoning steps
    const steps: ReasoningStep[] = totResult.tree.bestPath.map((nodeId, index) => {
      const node = totResult.tree.nodes.get(nodeId)!;
      return {
        id: node.id,
        parentId: node.parentId,
        depth: node.depth,
        thought: node.thought,
        evaluation: node.evaluation ? {
          score: node.evaluation.score,
          confidence: node.evaluation.confidence,
          reasoning: node.evaluation.reasoning,
          isTerminal: node.evaluation.isTerminal,
          shouldExpand: node.evaluation.shouldExpand,
          concerns: node.evaluation.concerns,
          suggestions: node.evaluation.suggestions,
        } : undefined,
        model: node.model,
        provider: node.provider,
        tokenUsage: node.tokenUsage,
        latencyMs: node.latencyMs,
        createdAt: node.createdAt,
        children: node.children,
        metadata: { 
          strategy: 'tree_of_thought',
          generationStrategy: node.generationStrategy,
          pruned: node.pruned,
        },
      };
    });
    
    // Build final result
    const completedAt = new Date();
    
    return {
      success: totResult.success,
      strategy: 'tree_of_thought',
      finalAnswer: totResult.finalAnswer,
      reasoningPath: steps,
      confidence: totResult.confidence,
      totalTokens: totResult.totalTokens,
      totalLatencyMs: totResult.totalLatencyMs,
      modelsUsed: totResult.modelsUsed,
      budgetStatus: this.activeSessions.get(sessionId)?.budgetSession.currentBudget || {
        totalTokens: totResult.totalTokens.totalTokens,
        usedTokens: totResult.totalTokens.totalTokens,
        remainingTokens: 0,
        budgetPerStep: 0,
        maxSteps: 0,
        estimatedCreditCost: Math.ceil(totResult.totalTokens.totalTokens / 1000),
      },
      metadata: {
        startedAt,
        completedAt,
        stepsCompleted: steps.length,
        stepsEvaluated: totResult.metadata.nodesEvaluated,
        branchesPruned: totResult.metadata.nodesPruned,
      },
    };
  }
  
  /**
   * Multi-Agent reasoning - parallel agents with synthesis
   * Uses the full Swarm Engine with conflict detection and resolution
   */
  async multiAgentReasoning(
    sessionId: string,
    input: HyperThinkingInput,
    config: HyperThinkingConfig,
    routing: RoutingDecision
  ): Promise<HyperThinkingResult> {
    const startedAt = new Date();
    
    // Create swarm engine with configuration based on routing
    const swarmEngine = createSwarmEngine({
      config: {
        parallelAgents: CONFIG.maxParallelOps,
        conflictResolution: 'hybrid',
        debateRounds: 1,
        temperature: config.temperature,
        modelTierDistribution: {
          maximum: routing.model.tier === 'maximum' ? 0.4 : 0.1,
          deep: routing.model.tier === 'deep' ? 0.5 : 0.3,
          standard: 0.3,
          fast: 0.2,
        },
      },
      onProgress: (event) => {
        // Track progress events
        console.log(`[Swarm] ${event.type}: ${event.message}`);
      },
    });
    
    // Execute swarm reasoning
    const swarmResult = await swarmEngine.reason({
      problem: this.buildPrompt(input),
      context: input.context,
    });
    
    // Record total token usage
    this.budgetManager.recordUsage(sessionId, 'multi-agent-swarm', swarmResult.tokenUsage);
    
    // Convert swarm reasoning steps to hyper-thinking format
    const steps: ReasoningStep[] = swarmResult.reasoning.map((step, index) => ({
      id: uuidv4(),
      parentId: index > 0 ? steps[index - 1]?.id || null : null,
      depth: step.step - 1,
      thought: step.reasoning,
      evaluation: step.conclusion ? {
        score: step.confidence,
        confidence: step.confidence,
        reasoning: step.conclusion,
        isTerminal: index === swarmResult.reasoning.length - 1,
        shouldExpand: false,
        concerns: [],
        suggestions: [],
      } : undefined,
      model: routing.model.displayName,
      provider: routing.model.provider,
      tokenUsage: {
        promptTokens: Math.floor(swarmResult.tokenUsage.promptTokens / swarmResult.reasoning.length),
        completionTokens: Math.floor(swarmResult.tokenUsage.completionTokens / swarmResult.reasoning.length),
        thinkingTokens: Math.floor((swarmResult.tokenUsage.thinkingTokens || 0) / swarmResult.reasoning.length),
        totalTokens: Math.floor(swarmResult.tokenUsage.totalTokens / swarmResult.reasoning.length),
      },
      latencyMs: Math.floor(swarmResult.latencyMs / swarmResult.reasoning.length),
      createdAt: new Date(),
      children: [],
      metadata: { 
        strategy: 'multi_agent',
        agentCount: swarmResult.contributingAgents.length,
        phase: step.thought,
      },
    }));
    
    // Build result
    const completedAt = new Date();
    const session = this.activeSessions.get(sessionId);
    
    return {
      success: swarmResult.confidence > 0.5,
      strategy: 'multi_agent',
      finalAnswer: swarmResult.answer,
      reasoningPath: steps,
      confidence: swarmResult.confidence,
      totalTokens: {
        promptTokens: swarmResult.tokenUsage.promptTokens,
        completionTokens: swarmResult.tokenUsage.completionTokens,
        thinkingTokens: swarmResult.tokenUsage.thinkingTokens || 0,
        totalTokens: swarmResult.tokenUsage.totalTokens,
      },
      totalLatencyMs: swarmResult.latencyMs,
      modelsUsed: [...new Set(swarmResult.contributingAgents.map(a => a.role))],
      budgetStatus: session?.budgetSession.currentBudget || {
        totalTokens: swarmResult.tokenUsage.totalTokens,
        usedTokens: swarmResult.tokenUsage.totalTokens,
        remainingTokens: 0,
        budgetPerStep: 0,
        maxSteps: 0,
        estimatedCreditCost: Math.ceil(swarmResult.tokenUsage.totalTokens / 1000),
      },
      metadata: {
        startedAt,
        completedAt,
        stepsCompleted: steps.length,
        stepsEvaluated: steps.filter(s => s.evaluation).length,
        agentsUsed: swarmResult.contributingAgents.length,
        conflictsResolved: swarmResult.conflictResolutions.length,
      },
    };
  }
  
  /**
   * Hybrid reasoning - combines strategies
   */
  async hybridReasoning(
    sessionId: string,
    input: HyperThinkingInput,
    config: HyperThinkingConfig,
    routing: RoutingDecision
  ): Promise<HyperThinkingResult> {
    const startedAt = new Date();
    const provider = getProvider(routing.model.provider);
    
    // Allocate budget across phases
    const decompositionBudget = Math.floor(routing.thinkingBudget * 0.2);
    const explorationBudget = Math.floor(routing.thinkingBudget * 0.4);
    const synthesisBudget = Math.floor(routing.thinkingBudget * 0.4);
    
    const steps: ReasoningStep[] = [];
    let context = input.context || '';
    
    // Phase 1: Decomposition
    const decompositionPrompt = `Decompose this task into clear subtasks:
${this.buildPrompt(input)}

List 3-5 subtasks that need to be solved.`;
    
    const decompositionResponse = await provider.reason({
      prompt: decompositionPrompt,
      systemPrompt: 'You are a task decomposition expert.',
      model: routing.model,
      thinkingBudget: decompositionBudget,
      temperature: 0.5,
    });
    
    this.budgetManager.recordUsage(sessionId, 'hybrid-decomp', decompositionResponse.tokenUsage);
    
    steps.push({
      id: uuidv4(),
      parentId: null,
      depth: 0,
      thought: decompositionResponse.content,
      model: decompositionResponse.model,
      provider: decompositionResponse.provider,
      tokenUsage: decompositionResponse.tokenUsage,
      latencyMs: decompositionResponse.latencyMs,
      createdAt: new Date(),
      children: [],
      metadata: { phase: 'decomposition' },
    });
    
    context += `\n\nDecomposition:\n${decompositionResponse.content}`;
    
    // Phase 2: Exploration (ToT-style)
    const explorationPrompt = `Given this decomposition:
${decompositionResponse.content}

Now explore solutions using Tree-of-Thought:
1. Generate 2 different approaches
2. Evaluate each approach
3. Select the best one`;
    
    const explorationResponse = await provider.reason({
      prompt: explorationPrompt,
      systemPrompt: 'You are an expert problem solver.',
      model: routing.model,
      thinkingBudget: explorationBudget,
      temperature: 0.8,
      previousContext: context,
    });
    
    this.budgetManager.recordUsage(sessionId, 'hybrid-explore', explorationResponse.tokenUsage);
    
    steps.push({
      id: uuidv4(),
      parentId: steps[0].id,
      depth: 1,
      thought: explorationResponse.content,
      model: explorationResponse.model,
      provider: explorationResponse.provider,
      tokenUsage: explorationResponse.tokenUsage,
      latencyMs: explorationResponse.latencyMs,
      createdAt: new Date(),
      children: [],
      metadata: { phase: 'exploration' },
    });
    
    context += `\n\nExploration:\n${explorationResponse.content}`;
    
    // Phase 3: Synthesis
    const synthesisPrompt = `Given the decomposition and exploration above, synthesize a final solution.
Original task: ${input.prompt}

Provide a comprehensive, well-structured answer.`;
    
    const synthesisResponse = await provider.reason({
      prompt: synthesisPrompt,
      systemPrompt: 'You are a synthesis expert. Combine insights into a coherent solution.',
      model: routing.model,
      thinkingBudget: synthesisBudget,
      temperature: 0.5,
      previousContext: context,
    });
    
    this.budgetManager.recordUsage(sessionId, 'hybrid-synth', synthesisResponse.tokenUsage);
    
    steps.push({
      id: uuidv4(),
      parentId: steps[1].id,
      depth: 2,
      thought: synthesisResponse.content,
      model: synthesisResponse.model,
      provider: synthesisResponse.provider,
      tokenUsage: synthesisResponse.tokenUsage,
      latencyMs: synthesisResponse.latencyMs,
      createdAt: new Date(),
      children: [],
      metadata: { phase: 'synthesis' },
    });
    
    return this.buildResult(sessionId, 'hybrid', synthesisResponse, steps, startedAt);
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  /**
   * Merge user config with defaults
   */
  private mergeConfig(userConfig?: Partial<HyperThinkingConfig>): HyperThinkingConfig {
    return {
      ...DEFAULT_HYPER_THINKING_CONFIG,
      ...userConfig,
    };
  }
  
  /**
   * Build prompt from input
   */
  private buildPrompt(input: HyperThinkingInput): string {
    let prompt = input.prompt;
    
    if (input.hints && input.hints.length > 0) {
      prompt += `\n\nHints:\n${input.hints.map(h => `- ${h}`).join('\n')}`;
    }
    
    if (input.outputFormat === 'json') {
      prompt += '\n\nProvide your response in valid JSON format.';
      if (input.outputSchema) {
        prompt += `\n\nSchema: ${JSON.stringify(input.outputSchema, null, 2)}`;
      }
    } else if (input.outputFormat === 'code') {
      prompt += '\n\nProvide your response as well-documented code.';
    } else if (input.outputFormat === 'structured') {
      prompt += '\n\nProvide your response in a clear, structured format with headers and sections.';
    }
    
    return prompt;
  }
  
  /**
   * Build final result
   */
  private buildResult(
    sessionId: string,
    strategy: ReasoningStrategy,
    response: ReasoningResponse,
    steps: ReasoningStep[],
    startedAt: Date
  ): HyperThinkingResult {
    const completedAt = new Date();
    const session = this.activeSessions.get(sessionId);
    
    // Calculate total token usage
    const totalTokens: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      thinkingTokens: 0,
      totalTokens: 0,
    };
    
    for (const step of steps) {
      totalTokens.promptTokens += step.tokenUsage.promptTokens;
      totalTokens.completionTokens += step.tokenUsage.completionTokens;
      totalTokens.thinkingTokens += step.tokenUsage.thinkingTokens;
      totalTokens.totalTokens += step.tokenUsage.totalTokens;
    }
    
    // Get budget status
    const budgetStatus = session?.budgetSession.currentBudget || {
      totalTokens: 0,
      usedTokens: totalTokens.totalTokens,
      remainingTokens: 0,
      budgetPerStep: 0,
      maxSteps: 0,
      estimatedCreditCost: 0,
    };
    
    // Calculate confidence based on response quality indicators
    const confidence = this.calculateConfidence(response, steps);
    
    return {
      success: true,
      strategy,
      finalAnswer: response.content,
      reasoningPath: steps,
      confidence,
      totalTokens,
      totalLatencyMs: completedAt.getTime() - startedAt.getTime(),
      modelsUsed: [...new Set(steps.map(s => s.model))],
      budgetStatus,
      metadata: {
        startedAt,
        completedAt,
        stepsCompleted: steps.length,
        stepsEvaluated: steps.filter(s => s.evaluation).length,
      },
    };
  }
  
  /**
   * Calculate confidence score
   */
  private calculateConfidence(response: ReasoningResponse, steps: ReasoningStep[]): number {
    let confidence = 0.7; // Base confidence
    
    // Extended thinking increases confidence
    if (response.thinking && response.thinking.length > 500) {
      confidence += 0.1;
    }
    
    // More steps with evaluation increases confidence
    const evaluatedSteps = steps.filter(s => s.evaluation);
    if (evaluatedSteps.length > 0) {
      confidence += 0.1 * Math.min(evaluatedSteps.length / 3, 1);
    }
    
    // Longer, more detailed responses suggest more thorough reasoning
    if (response.content.length > 1000) {
      confidence += 0.05;
    }
    
    return Math.min(confidence, 0.95); // Cap at 0.95
  }
  
  // ============================================================================
  // Session Management
  // ============================================================================
  
  /**
   * Get active session
   */
  getActiveSession(sessionId: string) {
    return this.activeSessions.get(sessionId);
  }
  
  /**
   * Cancel active session
   */
  cancelSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.budgetManager.cancelSession(sessionId);
      this.activeSessions.delete(sessionId);
      return true;
    }
    return false;
  }
  
  /**
   * Get all active sessions for a user
   */
  getUserActiveSessions(userId: string) {
    return Array.from(this.activeSessions.values()).filter(
      s => s.budgetSession.userId === userId
    );
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    providers: Record<string, boolean>;
    activeSessions: number;
  }> {
    const [anthropic, openai, openrouter] = await Promise.all([
      getProvider('anthropic').healthCheck(),
      getProvider('openai').healthCheck(),
      getProvider('openrouter').healthCheck(),
    ]);
    
    return {
      healthy: anthropic || openai || openrouter,
      providers: { anthropic, openai, openrouter },
      activeSessions: this.activeSessions.size,
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let orchestratorInstance: HyperThinkingOrchestrator | null = null;

export function getHyperThinkingOrchestrator(): HyperThinkingOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new HyperThinkingOrchestrator();
  }
  return orchestratorInstance;
}

export function resetHyperThinkingOrchestrator(): void {
  orchestratorInstance = null;
}

export default HyperThinkingOrchestrator;
