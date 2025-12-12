/**
 * Developer Mode - Feature Agent Types
 *
 * These types model the higher-level "Feature Agent" lifecycle:
 * intent locking → plan approval → credential gathering → implementation → verification → completion.
 */

export interface FeatureAgentConfig {
  id: string;
  name: string;
  sessionId: string;
  projectId: string;
  userId: string;
  taskPrompt: string;
  model: string;
  status: FeatureAgentStatus;
  implementationPlan: ImplementationPlan | null;
  ghostModeConfig: GhostModeAgentConfig | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export type FeatureAgentStatus =
  | 'pending_intent'
  | 'intent_locked'
  | 'awaiting_plan_approval'
  | 'awaiting_credentials'
  | 'implementing'
  | 'verifying'
  | 'complete'
  | 'failed'
  | 'paused'
  | 'ghost_mode';

export interface ImplementationPlan {
  intentSummary: string;
  whatIsDone: string;
  phases: ImplementationPhase[];
  requiredCredentials: RequiredCredential[];
  estimatedTokenUsage: number;
  estimatedCostUSD: number;
  parallelAgentsNeeded: number;
  frontendFirst: boolean;
  backendFirst: boolean;
  parallelFrontendBackend: boolean;
}

export interface ImplementationPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  steps: PhaseStep[];
  approved: boolean;
  modified: boolean;
  userModification: string | null;
}

export interface PhaseStep {
  id: string;
  description: string;
  type: 'frontend' | 'backend' | 'integration' | 'testing' | 'verification';
  parallelAgents: string[];
  estimatedTokens: number;
}

export interface RequiredCredential {
  id: string;
  name: string;
  description: string;
  envVariableName: string;
  platformName: string;
  platformUrl: string;
  required: boolean;
  value: string | null;
}

export interface GhostModeAgentConfig {
  enabled: boolean;
  notifyOn: ('error' | 'decision_needed' | 'completion' | 'budget_threshold')[];
  notificationChannels: {
    email: string | null;
    sms: string | null;
    slack: string | null;
    push: boolean;
  };
  maxBudgetUSD: number;
  mergeWhenComplete: boolean;
}


