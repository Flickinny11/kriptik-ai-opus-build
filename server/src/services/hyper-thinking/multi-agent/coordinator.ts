/**
 * Agent Coordinator
 *
 * Coordinates execution of multiple reasoning agents.
 * Handles parallel execution, sequential chains, and debates.
 */

import type {
  SwarmAgent,
  AgentResult,
  SwarmConfig,
  DebateRound,
  SwarmProgressEvent,
  AgentPromptInput,
} from './types.js';
import type { ModelConfig, TokenUsage } from '../types.js';
import { getProvider } from '../providers/index.js';
import { getModelRouter, HYPER_THINKING_MODELS, DEFAULT_MODEL_BY_TIER } from '../model-router.js';
import { AgentFactory } from './agent-factory.js';

// ============================================================================
// Agent Coordinator Class
// ============================================================================

export class AgentCoordinator {
  private config: SwarmConfig;
  private agentFactory: AgentFactory;

  constructor(config: SwarmConfig) {
    this.config = config;
    this.agentFactory = new AgentFactory(config);
  }

  /**
   * Execute agents in parallel
   */
  async executeParallel(
    agents: SwarmAgent[],
    problem: string,
    sharedContext?: string,
    onProgress?: (event: SwarmProgressEvent) => void
  ): Promise<AgentResult[]> {
    // Filter to only idle agents
    const idleAgents = agents.filter(a => a.status === 'idle');

    // Batch based on parallelAgents config
    const results: AgentResult[] = [];

    for (let i = 0; i < idleAgents.length; i += this.config.parallelAgents) {
      const batch = idleAgents.slice(i, i + this.config.parallelAgents);

      const batchPromises = batch.map(agent =>
        this.executeAgent(agent, problem, sharedContext, onProgress)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute agents sequentially (with context passing)
   */
  async executeSequential(
    agents: SwarmAgent[],
    problem: string,
    initialContext?: string,
    onProgress?: (event: SwarmProgressEvent) => void
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    let accumulatedContext = initialContext || '';

    for (const agent of agents) {
      // Include insights from previous agents
      const previousInsights = results.flatMap(r => r.insights);
      const previousConcerns = results.flatMap(r => r.concerns);

      const result = await this.executeAgent(
        agent,
        problem,
        accumulatedContext,
        onProgress,
        previousInsights,
        previousConcerns
      );

      results.push(result);

      // Add to accumulated context
      accumulatedContext += `\n\n## ${agent.role.toUpperCase()} Output\n${result.output}`;
    }

    return results;
  }

  /**
   * Execute a single agent
   */
  async executeAgent(
    agent: SwarmAgent,
    problem: string,
    sharedContext?: string,
    onProgress?: (event: SwarmProgressEvent) => void,
    otherInsights?: string[],
    otherConcerns?: string[]
  ): Promise<AgentResult> {
    const startTime = Date.now();

    // Update status
    agent.status = 'thinking';
    onProgress?.({
      type: 'agent_thinking',
      message: `${agent.role} agent starting analysis`,
      state: { phase: 'parallel_reasoning', agentsActive: 1, agentsComplete: 0, conflictsDetected: 0, progress: 0.3 },
      agent,
      timestamp: new Date(),
    });

    try {
      // Get model for this agent
      const modelId = DEFAULT_MODEL_BY_TIER[agent.modelTier];
      const model = HYPER_THINKING_MODELS[modelId];

      if (!model) {
        throw new Error(`No model found for tier: ${agent.modelTier}`);
      }

      // Build prompt
      const promptInput: AgentPromptInput = {
        problem,
        role: agent.role,
        sharedContext,
        task: agent.currentTask || undefined,
        otherInsights,
        otherConcerns,
      };

      const taskPrompt = this.agentFactory.buildTaskPrompt(promptInput);

      // Execute with provider
      const provider = getProvider(model.provider);
      const response = await provider.reason({
        prompt: taskPrompt,
        systemPrompt: agent.systemPrompt,
        model,
        thinkingBudget: 16000,
        temperature: this.config.temperature,
      });

      // Parse result
      const result = this.parseAgentResult(agent, response.content, response.tokenUsage, response.latencyMs);

      // Update agent state
      agent.status = 'complete';
      agent.result = result;
      agent.tokenUsage = response.tokenUsage;
      agent.latencyMs = Date.now() - startTime;

      onProgress?.({
        type: 'agent_complete',
        message: `${agent.role} agent complete with confidence ${result.confidence}`,
        state: { phase: 'parallel_reasoning', agentsActive: 0, agentsComplete: 1, conflictsDetected: 0, progress: 0.5 },
        agent,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      agent.status = 'error';
      throw error;
    }
  }

  /**
   * Run a debate round between agents
   */
  async runDebate(
    agents: SwarmAgent[],
    problem: string,
    topic: string,
    round: number,
    onProgress?: (event: SwarmProgressEvent) => void
  ): Promise<DebateRound> {
    const debateRound: DebateRound = {
      round,
      participants: agents.map(a => a.id),
      topic,
      arguments: [],
      outcome: '',
    };

    onProgress?.({
      type: 'debate_round',
      message: `Starting debate round ${round}: ${topic}`,
      state: { phase: 'debate', agentsActive: agents.length, agentsComplete: 0, conflictsDetected: 0, progress: 0.6 },
      timestamp: new Date(),
    });

    // First pass: initial arguments
    const argumentPromises = agents.map(async agent => {
      const modelId = DEFAULT_MODEL_BY_TIER[agent.modelTier];
      const model = HYPER_THINKING_MODELS[modelId];

      const prompt = this.agentFactory.buildDebatePrompt(
        agent.role,
        problem,
        topic,
        [] // No other arguments in first pass
      );

      const provider = getProvider(model.provider);
      const response = await provider.reason({
        prompt,
        systemPrompt: agent.systemPrompt,
        model,
        thinkingBudget: 8000,
        temperature: this.config.temperature,
      });

      return {
        agentId: agent.id,
        role: agent.role,
        argument: this.parseArgument(response.content),
      };
    });

    const initialArguments = await Promise.all(argumentPromises);

    // Second pass: rebuttals
    if (this.config.debateRounds > 1 && round < this.config.debateRounds) {
      const rebuttalPromises = agents.map(async (agent, index) => {
        const modelId = DEFAULT_MODEL_BY_TIER[agent.modelTier];
        const model = HYPER_THINKING_MODELS[modelId];

        // Get other agents' arguments
        const otherArguments = initialArguments
          .filter((_, i) => i !== index)
          .map(a => ({ role: a.role, argument: a.argument }));

        const prompt = this.agentFactory.buildDebatePrompt(
          agent.role,
          problem,
          topic,
          otherArguments
        );

        const provider = getProvider(model.provider);
        const response = await provider.reason({
          prompt,
          systemPrompt: agent.systemPrompt,
          model,
          thinkingBudget: 8000,
          temperature: this.config.temperature,
        });

        const parsed = this.parseDebateResponse(response.content);

        return {
          agentId: agent.id,
          argument: initialArguments[index].argument,
          rebuttal: parsed.rebuttal,
          concession: parsed.concession,
        };
      });

      debateRound.arguments = await Promise.all(rebuttalPromises);
    } else {
      debateRound.arguments = initialArguments.map(a => ({
        agentId: a.agentId,
        argument: a.argument,
      }));
    }

    // Determine outcome
    debateRound.outcome = this.summarizeDebate(debateRound);

    return debateRound;
  }

  /**
   * Parse agent result from response
   */
  private parseAgentResult(
    agent: SwarmAgent,
    content: string,
    tokenUsage: TokenUsage,
    latencyMs: number
  ): AgentResult {
    // Parse structured sections
    const insightsMatch = content.match(/(?:insights?|key points?):\s*([\s\S]*?)(?=concerns?:|suggestions?:|confidence:|$)/i);
    const concernsMatch = content.match(/concerns?:\s*([\s\S]*?)(?=suggestions?:|confidence:|$)/i);
    const suggestionsMatch = content.match(/suggestions?:\s*([\s\S]*?)(?=confidence:|$)/i);
    const confidenceMatch = content.match(/confidence(?:\s*level)?:\s*([\d.]+)/i);

    const insights = insightsMatch
      ? insightsMatch[1].split(/[-•\n]/).map(i => i.trim()).filter(i => i.length > 5)
      : [];

    const concerns = concernsMatch
      ? concernsMatch[1].split(/[-•\n]/).map(c => c.trim()).filter(c => c.length > 5)
      : [];

    const suggestions = suggestionsMatch
      ? suggestionsMatch[1].split(/[-•\n]/).map(s => s.trim()).filter(s => s.length > 5)
      : [];

    let confidence = 0.7;
    if (confidenceMatch) {
      confidence = Math.min(1, Math.max(0, parseFloat(confidenceMatch[1])));
    }

    return {
      agentId: agent.id,
      role: agent.role,
      output: content,
      confidence,
      insights: insights.slice(0, 5),
      concerns: concerns.slice(0, 5),
      suggestions: suggestions.slice(0, 5),
      tokenUsage,
      latencyMs,
    };
  }

  /**
   * Parse argument from debate response
   */
  private parseArgument(content: string): string {
    const match = content.match(/ARGUMENT:\s*([\s\S]*?)(?=REBUTTALS?:|CONCESSIONS?:|$)/i);
    return match ? match[1].trim() : content.trim();
  }

  /**
   * Parse debate response with rebuttals and concessions
   */
  private parseDebateResponse(content: string): { rebuttal?: string; concession?: string } {
    const rebuttalMatch = content.match(/REBUTTALS?:\s*([\s\S]*?)(?=CONCESSIONS?:|$)/i);
    const concessionMatch = content.match(/CONCESSIONS?:\s*([\s\S]*?)$/i);

    return {
      rebuttal: rebuttalMatch ? rebuttalMatch[1].trim() : undefined,
      concession: concessionMatch ? concessionMatch[1].trim() : undefined,
    };
  }

  /**
   * Summarize debate outcome
   */
  private summarizeDebate(debate: DebateRound): string {
    const argCount = debate.arguments.length;
    const withRebuttals = debate.arguments.filter(a => a.rebuttal).length;
    const withConcessions = debate.arguments.filter(a => a.concession).length;

    return `Debate round ${debate.round}: ${argCount} arguments, ${withRebuttals} rebuttals, ${withConcessions} concessions`;
  }
}

/**
 * Create agent coordinator
 */
export function createAgentCoordinator(config: SwarmConfig): AgentCoordinator {
  return new AgentCoordinator(config);
}

export default AgentCoordinator;
