/**
 * Agent Activity Types - Standardized event types for real-time orchestration activities
 *
 * Used by:
 * - AgentActivityStream (Builder View)
 * - FeatureAgentActivityStream (Feature Agent Tiles)
 * - Build Loop event emission
 */

export type AgentActivityEventType =
  | 'thinking'
  | 'file_read'
  | 'file_write'
  | 'file_edit'
  | 'tool_call'
  | 'status'
  | 'verification'
  | 'error';

export type AgentActivityPhase =
  | 'thinking'
  | 'planning'
  | 'coding'
  | 'testing'
  | 'verifying'
  | 'integrating'
  | 'deploying';

export interface AgentActivityEventMetadata {
  filePath?: string;
  toolName?: string;
  phase?: AgentActivityPhase;
  lineNumbers?: { start: number; end: number };
  tokenCount?: number;
  duration?: number;
  parameters?: Record<string, unknown>;
  result?: 'success' | 'failure' | 'pending';
}

export interface AgentActivityEvent {
  id: string;
  type: AgentActivityEventType;
  agentId?: string;
  agentName?: string;
  content: string;
  metadata?: AgentActivityEventMetadata;
  timestamp: number;
}

export interface AgentActivityStreamState {
  events: AgentActivityEvent[];
  isThinkingExpanded: boolean;
  activePhase: AgentActivityPhase | null;
}

/**
 * Parse raw SSE/WebSocket chunks into normalized AgentActivityEvent
 * Handles Anthropic thinking tokens, OpenAI reasoning tokens, and custom events
 */
export function parseStreamChunkToEvent(
  chunk: unknown,
  fallbackAgentId?: string
): AgentActivityEvent | null {
  if (!chunk || typeof chunk !== 'object') return null;

  const raw = chunk as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = typeof raw.timestamp === 'number' ? raw.timestamp : Date.now();

  // Anthropic thinking tokens
  const delta = raw.delta as Record<string, unknown> | undefined;
  if (raw.type === 'thinking' || (raw.type === 'content_block_delta' && delta?.type === 'thinking_delta')) {
    const content = typeof raw.thinking === 'string'
      ? raw.thinking
      : typeof delta?.thinking === 'string'
        ? delta.thinking
        : typeof raw.content === 'string'
          ? raw.content
          : '';
    return {
      id,
      type: 'thinking',
      agentId: fallbackAgentId,
      content: String(content),
      timestamp,
    };
  }

  // OpenAI reasoning tokens (o1/o3 models)
  const choices = raw.choices as Array<{ delta?: { reasoning_content?: string } }> | undefined;
  const firstChoice = choices?.[0];
  if (raw.type === 'reasoning' || (raw.object === 'chat.completion.chunk' && firstChoice?.delta?.reasoning_content)) {
    const content = typeof raw.reasoning === 'string'
      ? raw.reasoning
      : typeof firstChoice?.delta?.reasoning_content === 'string'
        ? firstChoice.delta.reasoning_content
        : '';
    return {
      id,
      type: 'thinking',
      agentId: fallbackAgentId,
      content: String(content),
      metadata: { phase: 'thinking' },
      timestamp,
    };
  }

  // File operations
  if (raw.type === 'file_read' || raw.type === 'file_write' || raw.type === 'file_edit') {
    return {
      id,
      type: raw.type as AgentActivityEventType,
      agentId: typeof raw.agentId === 'string' ? raw.agentId : fallbackAgentId,
      agentName: typeof raw.agentName === 'string' ? raw.agentName : undefined,
      content: typeof raw.content === 'string' ? raw.content : `File operation: ${raw.filePath || 'unknown'}`,
      metadata: {
        filePath: typeof raw.filePath === 'string' ? raw.filePath : undefined,
        lineNumbers: raw.lineNumbers as { start: number; end: number } | undefined,
      },
      timestamp,
    };
  }

  // Tool calls
  if (raw.type === 'tool_call' || raw.type === 'tool_use') {
    return {
      id,
      type: 'tool_call',
      agentId: typeof raw.agentId === 'string' ? raw.agentId : fallbackAgentId,
      agentName: typeof raw.agentName === 'string' ? raw.agentName : undefined,
      content: typeof raw.content === 'string' ? raw.content : `Using tool: ${raw.toolName || raw.name || 'unknown'}`,
      metadata: {
        toolName: typeof raw.toolName === 'string' ? raw.toolName : typeof raw.name === 'string' ? raw.name : undefined,
        parameters: raw.parameters as Record<string, unknown> | undefined,
      },
      timestamp,
    };
  }

  // Status updates
  if (raw.type === 'status' || raw.type === 'phase' || raw.type === 'progress') {
    return {
      id,
      type: 'status',
      agentId: typeof raw.agentId === 'string' ? raw.agentId : fallbackAgentId,
      agentName: typeof raw.agentName === 'string' ? raw.agentName : undefined,
      content: typeof raw.content === 'string' ? raw.content : typeof raw.message === 'string' ? raw.message : 'Status update',
      metadata: {
        phase: typeof raw.phase === 'string' ? raw.phase as AgentActivityPhase : undefined,
      },
      timestamp,
    };
  }

  // Verification results
  if (raw.type === 'verification' || raw.type === 'verification_result') {
    return {
      id,
      type: 'verification',
      agentId: typeof raw.agentId === 'string' ? raw.agentId : fallbackAgentId,
      agentName: typeof raw.agentName === 'string' ? raw.agentName : undefined,
      content: typeof raw.content === 'string' ? raw.content : 'Verification check',
      metadata: {
        result: raw.passed === true ? 'success' : raw.passed === false ? 'failure' : 'pending',
      },
      timestamp,
    };
  }

  // Errors
  if (raw.type === 'error') {
    return {
      id,
      type: 'error',
      agentId: typeof raw.agentId === 'string' ? raw.agentId : fallbackAgentId,
      agentName: typeof raw.agentName === 'string' ? raw.agentName : undefined,
      content: typeof raw.content === 'string' ? raw.content : typeof raw.error === 'string' ? raw.error : 'An error occurred',
      timestamp,
    };
  }

  // Generic event fallback
  if (typeof raw.type === 'string' && typeof raw.content === 'string') {
    const mappedType: AgentActivityEventType = ['thinking', 'file_read', 'file_write', 'file_edit', 'tool_call', 'status', 'verification', 'error'].includes(raw.type)
      ? raw.type as AgentActivityEventType
      : 'status';
    return {
      id,
      type: mappedType,
      agentId: typeof raw.agentId === 'string' ? raw.agentId : fallbackAgentId,
      agentName: typeof raw.agentName === 'string' ? raw.agentName : undefined,
      content: raw.content,
      metadata: raw.metadata as AgentActivityEventMetadata | undefined,
      timestamp,
    };
  }

  return null;
}

/**
 * Extract phase from event content or metadata
 */
export function extractPhaseFromEvent(event: AgentActivityEvent): AgentActivityPhase | null {
  if (event.metadata?.phase) return event.metadata.phase;

  const content = event.content.toLowerCase();
  if (content.includes('thinking') || content.includes('analyzing') || content.includes('considering')) return 'thinking';
  if (content.includes('planning') || content.includes('designing') || content.includes('architecting')) return 'planning';
  if (content.includes('coding') || content.includes('implementing') || content.includes('writing code')) return 'coding';
  if (content.includes('testing') || content.includes('running tests')) return 'testing';
  if (content.includes('verifying') || content.includes('checking') || content.includes('validating')) return 'verifying';
  if (content.includes('integrating') || content.includes('merging')) return 'integrating';
  if (content.includes('deploying') || content.includes('publishing')) return 'deploying';

  return null;
}

/**
 * Get icon name for event type (for use with custom icon components)
 */
export function getEventTypeIconName(type: AgentActivityEventType): string {
  switch (type) {
    case 'thinking': return 'brain';
    case 'file_read': return 'file-search';
    case 'file_write': return 'file-plus';
    case 'file_edit': return 'file-edit';
    case 'tool_call': return 'wrench';
    case 'status': return 'activity';
    case 'verification': return 'check-circle';
    case 'error': return 'alert-circle';
    default: return 'activity';
  }
}

/**
 * Get display label for event type
 */
export function getEventTypeLabel(type: AgentActivityEventType): string {
  switch (type) {
    case 'thinking': return 'Thinking';
    case 'file_read': return 'Reading';
    case 'file_write': return 'Writing';
    case 'file_edit': return 'Editing';
    case 'tool_call': return 'Tool Call';
    case 'status': return 'Status';
    case 'verification': return 'Verification';
    case 'error': return 'Error';
    default: return 'Activity';
  }
}
