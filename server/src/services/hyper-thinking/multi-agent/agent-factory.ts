/**
 * Agent Factory
 * 
 * Creates and configures reasoning agents for the multi-agent swarm.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AgentRole,
  SwarmAgent,
  SwarmConfig,
  AgentPromptInput,
} from './types.js';
import type { ModelTier, TokenUsage } from '../types.js';

// ============================================================================
// Role System Prompts
// ============================================================================

const ROLE_SYSTEM_PROMPTS: Record<AgentRole, string> = {
  lead: `You are the LEAD AGENT in a multi-agent reasoning system.
Your responsibilities:
1. Understand the core problem and create a plan
2. Coordinate other agents by defining clear tasks
3. Integrate insights from all agents
4. Make final decisions when agents disagree
5. Ensure comprehensive coverage of the problem

Be decisive, clear, and organized. Your plan should enable parallel work.`,

  analyst: `You are an ANALYST AGENT in a multi-agent reasoning system.
Your responsibilities:
1. Break down the problem into components
2. Identify requirements, constraints, and dependencies
3. Analyze feasibility and risks
4. Provide structured analysis with clear reasoning
5. Quantify where possible

Be thorough and methodical. Focus on facts and logical analysis.`,

  critic: `You are a CRITIC AGENT in a multi-agent reasoning system.
Your responsibilities:
1. Challenge assumptions and identify weaknesses
2. Find edge cases and potential failures
3. Question the reasoning of other agents
4. Identify what could go wrong
5. Suggest improvements and safeguards

Be constructive but rigorous. Don't accept things at face value.`,

  creative: `You are a CREATIVE AGENT in a multi-agent reasoning system.
Your responsibilities:
1. Generate novel and unconventional approaches
2. Think outside the box and challenge conventions
3. Propose innovative solutions
4. Find unexpected connections
5. Consider approaches others might miss

Be bold and imaginative. Don't be constrained by obvious solutions.`,

  implementer: `You are an IMPLEMENTER AGENT in a multi-agent reasoning system.
Your responsibilities:
1. Focus on concrete, actionable steps
2. Define specific implementation details
3. Consider practical constraints
4. Create clear, executable plans
5. Identify tools, resources, and methods needed

Be practical and detailed. Focus on "how" not just "what".`,

  synthesizer: `You are a SYNTHESIZER AGENT in a multi-agent reasoning system.
Your responsibilities:
1. Combine insights from all other agents
2. Resolve contradictions and conflicts
3. Create a coherent, unified answer
4. Weigh different perspectives fairly
5. Produce clear, actionable output

Be balanced and comprehensive. Honor all valuable contributions.`,
};

// ============================================================================
// Agent Factory Class
// ============================================================================

export class AgentFactory {
  private config: SwarmConfig;
  
  constructor(config: SwarmConfig) {
    this.config = config;
  }
  
  /**
   * Create a single agent with specified role
   */
  createAgent(role: AgentRole | string, customPrompt?: string, customTier?: ModelTier): SwarmAgent {
    // Handle custom roles as 'analyst' type
    const normalizedRole: AgentRole = this.isAgentRole(role) ? role : 'analyst';
    
    const modelTier = customTier || (
      normalizedRole === 'lead' || normalizedRole === 'synthesizer'
        ? this.config.leadModelTier
        : this.config.agentModelTier
    );
    
    return {
      id: uuidv4(),
      role: normalizedRole,
      modelTier,
      status: 'idle',
      systemPrompt: customPrompt || ROLE_SYSTEM_PROMPTS[normalizedRole] || ROLE_SYSTEM_PROMPTS.analyst,
      currentTask: null,
      result: null,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
      },
      latencyMs: 0,
      createdAt: new Date(),
      metadata: {
        originalRole: role,
      },
    };
  }
  
  /**
   * Check if a string is a valid AgentRole
   */
  private isAgentRole(role: string): role is AgentRole {
    return ['lead', 'analyst', 'critic', 'creative', 'implementer', 'synthesizer'].includes(role);
  }
  
  /**
   * Create a swarm of agents with specified roles
   */
  createSwarm(roles: AgentRole[]): Map<string, SwarmAgent> {
    const agents = new Map<string, SwarmAgent>();
    
    for (const role of roles) {
      const agent = this.createAgent(role);
      agents.set(agent.id, agent);
    }
    
    return agents;
  }
  
  /**
   * Spawn a team of agents based on problem analysis
   * Returns an array of agents instead of a Map
   */
  spawnTeam(problem: string): SwarmAgent[] {
    // Analyze problem complexity based on length and keywords
    const isComplex = problem.length > 500 ||
      /architect|design|implement|build|create|develop|system|complex|multiple|integrate/i.test(problem);
    
    const isModerate = problem.length > 200 ||
      /analyze|optimize|improve|fix|debug|refactor|update/i.test(problem);
    
    let roles: AgentRole[];
    
    if (isComplex) {
      // Full team for complex problems
      roles = ['lead', 'analyst', 'critic', 'creative', 'implementer', 'synthesizer'];
    } else if (isModerate) {
      // Balanced team for moderate problems
      roles = ['lead', 'analyst', 'implementer', 'synthesizer'];
    } else {
      // Minimal team for simple problems
      roles = ['analyst', 'implementer'];
    }
    
    // Limit to configured max
    roles = roles.slice(0, this.config.maxAgents);
    
    // Create agents
    return roles.map(role => this.createAgent(role));
  }
  
  /**
   * Create default swarm configuration
   */
  createDefaultSwarm(): Map<string, SwarmAgent> {
    // Default roles: lead + 3 specialists + synthesizer
    const roles: AgentRole[] = ['lead', 'analyst', 'critic', 'implementer', 'synthesizer'];
    return this.createSwarm(roles.slice(0, this.config.maxAgents));
  }
  
  /**
   * Create swarm based on problem complexity
   */
  createSwarmForProblem(problemComplexity: 'simple' | 'moderate' | 'complex'): Map<string, SwarmAgent> {
    let roles: AgentRole[];
    
    switch (problemComplexity) {
      case 'simple':
        roles = ['analyst', 'implementer'];
        break;
      case 'moderate':
        roles = ['lead', 'analyst', 'implementer', 'synthesizer'];
        break;
      case 'complex':
      default:
        roles = ['lead', 'analyst', 'critic', 'creative', 'implementer', 'synthesizer'];
        break;
    }
    
    // Limit to configured max
    roles = roles.slice(0, this.config.maxAgents);
    
    return this.createSwarm(roles);
  }
  
  /**
   * Get system prompt for a role
   */
  static getSystemPromptForRole(role: AgentRole): string {
    return ROLE_SYSTEM_PROMPTS[role];
  }
  
  /**
   * Build task prompt for an agent
   */
  buildTaskPrompt(input: AgentPromptInput): string {
    let prompt = `# Problem\n${input.problem}\n\n`;
    
    if (input.task) {
      prompt += `# Your Task\n${input.task}\n\n`;
    }
    
    if (input.sharedContext) {
      prompt += `# Shared Context\n${input.sharedContext}\n\n`;
    }
    
    if (input.otherInsights && input.otherInsights.length > 0) {
      prompt += `# Insights from Other Agents\n${input.otherInsights.map(i => `- ${i}`).join('\n')}\n\n`;
    }
    
    if (input.otherConcerns && input.otherConcerns.length > 0) {
      prompt += `# Concerns Raised\n${input.otherConcerns.map(c => `- ${c}`).join('\n')}\n\n`;
    }
    
    prompt += `# Expected Output
Please provide:
1. Your analysis/reasoning
2. Key insights (list 2-5 points)
3. Concerns (list any issues or risks)
4. Suggestions (for other agents or final answer)
5. Confidence level (0-1)

Format your response clearly with these sections.`;
    
    return prompt;
  }
  
  /**
   * Build debate prompt for an agent
   */
  buildDebatePrompt(
    role: AgentRole,
    problem: string,
    topic: string,
    otherArguments: Array<{ role: AgentRole; argument: string }>
  ): string {
    let prompt = `# Debate Topic\n${topic}\n\n`;
    prompt += `# Original Problem\n${problem}\n\n`;
    
    if (otherArguments.length > 0) {
      prompt += `# Arguments from Other Agents\n`;
      for (const arg of otherArguments) {
        prompt += `\n## ${arg.role.toUpperCase()}\n${arg.argument}\n`;
      }
      prompt += '\n';
    }
    
    prompt += `# Your Task
As the ${role.toUpperCase()}, provide your perspective on this topic.
If you disagree with other agents, explain why.
If you agree, add supporting points.

Format:
ARGUMENT: [Your main point]
REBUTTALS: [Any disagreements with other agents]
CONCESSIONS: [Points you agree with]`;
    
    return prompt;
  }
}

/**
 * Create agent factory
 */
export function createAgentFactory(config: SwarmConfig): AgentFactory {
  return new AgentFactory(config);
}

export default AgentFactory;
